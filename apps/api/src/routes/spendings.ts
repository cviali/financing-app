import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { eq, and, isNull, desc } from "drizzle-orm";
import { spendings, projectBalanceMutations, projects, categories, users } from "@repo/db/schema";
import {
  createSpendingSchema,
  updateSpendingSchema,
  voidSpendingSchema,
} from "@repo/shared/schemas/spendings";
import { canEditSpending, canVoidSpending } from "@repo/shared";
import { writeAuditLog } from "../lib/audit.js";
import { dbMiddleware, authMiddleware, adminMiddleware } from "../middleware/auth.js";
import { computeSpendingMutation, buildReversalMutation } from "../services/projectBalance.js";
import type { AppContext } from "../types/context.js";

export const spendingsRouter = new Hono<AppContext>();

spendingsRouter.use("*", dbMiddleware, authMiddleware);

// GET /spendings  (with optional filters via query params)
spendingsRouter.get("/", async (c) => {
  const db = c.get("db");
  // Intentionally load all non-voided by default; callers can filter
  const all = await db
    .select({
      id: spendings.id,
      projectId: spendings.projectId,
      categoryId: spendings.categoryId,
      amountIdr: spendings.amountIdr,
      description: spendings.description,
      spendingDate: spendings.spendingDate,
      receiptObjectKey: spendings.receiptObjectKey,
      receiptFileName: spendings.receiptFileName,
      receiptContentType: spendings.receiptContentType,
      receiptSizeBytes: spendings.receiptSizeBytes,
      createdBy: spendings.createdBy,
      createdByUsername: users.username,
      updatedBy: spendings.updatedBy,
      createdAt: spendings.createdAt,
      updatedAt: spendings.updatedAt,
      voidedAt: spendings.voidedAt,
      voidedBy: spendings.voidedBy,
      voidReason: spendings.voidReason,
    })
    .from(spendings)
    .leftJoin(users, eq(spendings.createdBy, users.id))
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

  const category = await db
    .select()
    .from(categories)
    .where(eq(categories.id, body.categoryId))
    .get();
  if (!category) return c.json({ error: "Category not found" }, 404);
  if (category.status === "archived") return c.json({ error: "Category is archived" }, 422);

  const now = new Date().toISOString();
  const spendingId = crypto.randomUUID();

  const newSpending: typeof spendings.$inferInsert = {
    id: spendingId,
    projectId: body.projectId,
    categoryId: body.categoryId,
    amountIdr: body.amountIdr,
    description: body.description ?? null,
    spendingDate: body.spendingDate,
    receiptObjectKey: body.receiptObjectKey ?? null,
    receiptFileName: body.receiptFileName ?? null,
    receiptContentType: body.receiptContentType ?? null,
    receiptSizeBytes: body.receiptSizeBytes ?? null,
    createdBy: actor.id,
    createdAt: now,
    updatedAt: now,
  };

  // Compute the project balance mutation (may throw 422 for insufficient balance)
  const mutation = await computeSpendingMutation(db, {
    projectId: body.projectId,
    spendingId,
    amountIdr: body.amountIdr,
    createdBy: actor.id,
  });

  // Atomic batch: spending insert + balance mutation
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await db.batch([
    db.insert(spendings).values(newSpending),
    db.insert(projectBalanceMutations).values(mutation),
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

  if (
    !canEditSpending({ id: actor.id, role: actor.role, status: actor.status }, spending.createdBy)
  ) {
    return c.json({ error: "Forbidden: you can only edit your own spendings" }, 403);
  }

  const now = new Date().toISOString();
  const updates = { ...body, updatedBy: actor.id, updatedAt: now };

  // Balance impact only changes when amount or project changes
  const newAmountIdr = body.amountIdr ?? spending.amountIdr;
  const projectId = body.projectId ?? spending.projectId;

  // Validate a newly-targeted project/category exists and is not archived
  // (create does this; edit must too, or a spending can be moved onto an
  // archived/nonexistent project and silently bypass those guards).
  if (body.projectId && body.projectId !== spending.projectId) {
    const nextProject = await db
      .select()
      .from(projects)
      .where(eq(projects.id, body.projectId))
      .get();
    if (!nextProject) return c.json({ error: "Project not found" }, 404);
    if (nextProject.status === "archived") return c.json({ error: "Project is archived" }, 422);
  }
  if (body.categoryId && body.categoryId !== spending.categoryId) {
    const nextCategory = await db
      .select()
      .from(categories)
      .where(eq(categories.id, body.categoryId))
      .get();
    if (!nextCategory) return c.json({ error: "Category not found" }, 404);
    if (nextCategory.status === "archived") return c.json({ error: "Category is archived" }, 422);
  }

  const impactChanged = newAmountIdr !== spending.amountIdr || projectId !== spending.projectId;

  const mutations: Array<typeof projectBalanceMutations.$inferInsert> = [];

  if (impactChanged) {
    const reversal = await buildReversalMutation(db, {
      projectId: spending.projectId,
      spendingId: id,
      amountIdr: spending.amountIdr,
      note: `Reversal for spending edit (${id})`,
      createdBy: actor.id,
    });
    mutations.push(reversal);

    // When the deduction stays on the same project, the reversal above (not yet
    // committed) has already credited the old amount back. Chain off its
    // balanceAfterIdr so the new "out" row and its 422 check reflect the credit;
    // a fresh getProjectBalance read here would miss it. A different project
    // reads its own balance normally.
    const sameProject = projectId === spending.projectId;
    const newMutation = await computeSpendingMutation(db, {
      projectId,
      spendingId: id,
      amountIdr: newAmountIdr,
      createdBy: actor.id,
      ...(sameProject ? { knownBalanceIdr: reversal.balanceAfterIdr } : {}),
    });
    mutations.push(newMutation);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await db.batch([
    db.update(spendings).set(updates).where(eq(spendings.id, id)),
    ...mutations.map((m) => db.insert(projectBalanceMutations).values(m)),
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
spendingsRouter.post(
  "/:id/void",
  adminMiddleware,
  zValidator("json", voidSpendingSchema),
  async (c) => {
    const db = c.get("db");
    const actor = c.get("user");
    const { id } = c.req.param();
    const { voidReason } = c.req.valid("json");

    const spending = await db.select().from(spendings).where(eq(spendings.id, id)).get();
    if (!spending) return c.json({ error: "Spending not found" }, 404);
    if (spending.voidedAt) return c.json({ error: "Spending already voided" }, 409);

    const now = new Date().toISOString();

    const reversal = await buildReversalMutation(db, {
      projectId: spending.projectId,
      spendingId: id,
      amountIdr: spending.amountIdr,
      note: `Void reversal: ${voidReason}`,
      createdBy: actor.id,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await db.batch([
      db
        .update(spendings)
        .set({ voidedAt: now, voidedBy: actor.id, voidReason, updatedAt: now })
        .where(eq(spendings.id, id)),
      db.insert(projectBalanceMutations).values(reversal),
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
  },
);
