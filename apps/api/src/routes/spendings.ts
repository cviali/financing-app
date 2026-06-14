import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { eq, and, isNull, desc } from "drizzle-orm";
import { spendings, pettyCashMutations, projects, categories } from "@repo/db/schema";
import { createSpendingSchema, updateSpendingSchema, voidSpendingSchema } from "@repo/shared/schemas/spendings";
import { canEditSpending, canVoidSpending } from "@repo/shared";
import { writeAuditLog } from "../lib/audit.js";
import { dbMiddleware, authMiddleware, adminMiddleware } from "../middleware/auth.js";
import { computeSpendingMutations, buildReversalMutations, getProjectBalance } from "../services/pettyCash.js";
import type { AppContext } from "../types/context.js";

export const spendingsRouter = new Hono<AppContext>();

spendingsRouter.use("*", dbMiddleware, authMiddleware);

// GET /spendings  (with optional filters via query params)
spendingsRouter.get("/", async (c) => {
  const db = c.get("db");
  // Intentionally load all non-voided by default; callers can filter
  const all = await db
    .select()
    .from(spendings)
    .where(isNull(spendings.voidedAt))
    .orderBy(desc(spendings.spendingDate), desc(spendings.createdAt))
    .all();
  return c.json({ data: all });
});

// POST /spendings
spendingsRouter.post("/", zValidator("json", createSpendingSchema), async (c) => {
  const body = c.req.valid("json");
  const db = c.get("db");
  const actor = c.get("user");

  // Validate project and category exist
  const project = await db.select().from(projects).where(eq(projects.id, body.projectId)).get();
  if (!project) return c.json({ error: "Project not found" }, 404);
  if (project.status === "archived") return c.json({ error: "Project is archived" }, 422);

  const category = await db.select().from(categories).where(eq(categories.id, body.categoryId)).get();
  if (!category) return c.json({ error: "Category not found" }, 404);
  if (category.status === "archived") return c.json({ error: "Category is archived" }, 422);

  const now = new Date().toISOString();
  const spendingId = crypto.randomUUID();

  const newSpending: typeof spendings.$inferInsert = {
    id: spendingId,
    projectId: body.projectId,
    categoryId: body.categoryId,
    amountIdr: body.amountIdr,
    paymentSource: body.paymentSource,
    pettyCashCutIdr: body.pettyCashCutIdr ?? 0,
    description: body.description ?? null,
    spendingDate: body.spendingDate,
    createdBy: actor.id,
    createdAt: now,
    updatedAt: now,
  };

  // Compute petty cash mutations (may throw 422 for insufficient balance)
  const mutations = await computeSpendingMutations(db, {
    projectId: body.projectId,
    spendingId,
    paymentSource: body.paymentSource,
    amountIdr: body.amountIdr,
    pettyCashCutIdr: body.pettyCashCutIdr ?? 0,
    createdBy: actor.id,
  });

  // Atomic batch: spending insert + any petty cash mutations
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await db.batch([
    db.insert(spendings).values(newSpending),
    ...mutations.map((m) => db.insert(pettyCashMutations).values(m)),
  ] as any);

  await writeAuditLog(db, {
    actorUserId: actor.id,
    action: "spending.create",
    entityType: "spending",
    entityId: spendingId,
    after: { ...newSpending },
  });

  return c.json({ data: { ...newSpending } }, 201);
});

// GET /spendings/:id
spendingsRouter.get("/:id", async (c) => {
  const db = c.get("db");
  const { id } = c.req.param();
  const spending = await db.select().from(spendings).where(eq(spendings.id, id)).get();
  if (!spending) return c.json({ error: "Spending not found" }, 404);
  return c.json({ data: spending });
});

// PATCH /spendings/:id
spendingsRouter.patch("/:id", zValidator("json", updateSpendingSchema), async (c) => {
  const db = c.get("db");
  const actor = c.get("user");
  const { id } = c.req.param();
  const body = c.req.valid("json");

  const spending = await db.select().from(spendings).where(eq(spendings.id, id)).get();
  if (!spending) return c.json({ error: "Spending not found" }, 404);
  if (spending.voidedAt) return c.json({ error: "Cannot edit a voided spending" }, 422);

  if (!canEditSpending({ id: actor.id, role: actor.role, status: actor.status }, spending.createdBy)) {
    return c.json({ error: "Forbidden: you can only edit your own spendings" }, 403);
  }

  const now = new Date().toISOString();
  const updates = { ...body, updatedBy: actor.id, updatedAt: now };

  // If petty cash impact changed, we need reversals + new mutations
  const newPaymentSource = body.paymentSource ?? spending.paymentSource;
  const newAmountIdr = body.amountIdr ?? spending.amountIdr;
  const newPettyCashCutIdr = body.pettyCashCutIdr ?? spending.pettyCashCutIdr;
  const projectId = body.projectId ?? spending.projectId;

  const oldHasPettyCashImpact =
    spending.paymentSource === "project_petty_cash" ||
    (spending.paymentSource === "external" && spending.pettyCashCutIdr > 0);
  const newHasPettyCashImpact =
    newPaymentSource === "project_petty_cash" ||
    (newPaymentSource === "external" && newPettyCashCutIdr > 0);

  const pettyCashChanged =
    oldHasPettyCashImpact !== newHasPettyCashImpact ||
    newAmountIdr !== spending.amountIdr ||
    newPettyCashCutIdr !== spending.pettyCashCutIdr ||
    newPaymentSource !== spending.paymentSource ||
    projectId !== spending.projectId;

  const reversals: Array<typeof pettyCashMutations.$inferInsert> = [];
  const newMutations: Array<typeof pettyCashMutations.$inferInsert> = [];

  if (pettyCashChanged && oldHasPettyCashImpact) {
    // Reverse the original impact
    const origDirection = spending.paymentSource === "project_petty_cash" ? "out" : "in";
    const origAmount =
      spending.paymentSource === "project_petty_cash"
        ? spending.amountIdr
        : spending.pettyCashCutIdr;

    const rev = await buildReversalMutations(db, {
      projectId: spending.projectId,
      spendingId: id,
      originalDirection: origDirection,
      originalAmount: origAmount,
      note: `Reversal for spending edit (${id})`,
      createdBy: actor.id,
    });
    reversals.push(...rev);
  }

  if (pettyCashChanged && newHasPettyCashImpact) {
    // Apply new impact (after reversals are "logically applied")
    const newMuts = await computeSpendingMutations(db, {
      projectId,
      spendingId: id,
      paymentSource: newPaymentSource,
      amountIdr: newAmountIdr,
      pettyCashCutIdr: newPettyCashCutIdr,
      createdBy: actor.id,
    });
    newMutations.push(...newMuts);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await db.batch([
    db.update(spendings).set(updates).where(eq(spendings.id, id)),
    ...reversals.map((m) => db.insert(pettyCashMutations).values(m)),
    ...newMutations.map((m) => db.insert(pettyCashMutations).values(m)),
  ] as any);

  await writeAuditLog(db, {
    actorUserId: actor.id,
    action: "spending.update",
    entityType: "spending",
    entityId: id,
    before: spending,
    after: updates,
  });

  return c.json({ data: { ok: true } });
});

// POST /spendings/:id/void — admin only
spendingsRouter.post("/:id/void", adminMiddleware, zValidator("json", voidSpendingSchema), async (c) => {
  const db = c.get("db");
  const actor = c.get("user");
  const { id } = c.req.param();
  const { voidReason } = c.req.valid("json");

  const spending = await db.select().from(spendings).where(eq(spendings.id, id)).get();
  if (!spending) return c.json({ error: "Spending not found" }, 404);
  if (spending.voidedAt) return c.json({ error: "Spending already voided" }, 409);

  const now = new Date().toISOString();

  // Determine if spending had petty cash impact and build reversal
  const hasPettyCashImpact =
    spending.paymentSource === "project_petty_cash" ||
    (spending.paymentSource === "external" && spending.pettyCashCutIdr > 0);

  const reversals: Array<typeof pettyCashMutations.$inferInsert> = [];
  if (hasPettyCashImpact) {
    const origDirection = spending.paymentSource === "project_petty_cash" ? "out" : "in";
    const origAmount =
      spending.paymentSource === "project_petty_cash"
        ? spending.amountIdr
        : spending.pettyCashCutIdr;

    const rev = await buildReversalMutations(db, {
      projectId: spending.projectId,
      spendingId: id,
      originalDirection: origDirection,
      originalAmount: origAmount,
      note: `Void reversal: ${voidReason}`,
      createdBy: actor.id,
    });
    reversals.push(...rev);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await db.batch([
    db
      .update(spendings)
      .set({ voidedAt: now, voidedBy: actor.id, voidReason, updatedAt: now })
      .where(eq(spendings.id, id)),
    ...reversals.map((m) => db.insert(pettyCashMutations).values(m)),
  ] as any);

  await writeAuditLog(db, {
    actorUserId: actor.id,
    action: "spending.void",
    entityType: "spending",
    entityId: id,
    before: spending,
    after: { voidedAt: now, voidedBy: actor.id, voidReason },
  });

  return c.json({ data: { ok: true } });
});
