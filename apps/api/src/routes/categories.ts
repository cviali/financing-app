import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { eq } from "drizzle-orm";
import { categories } from "@repo/db/schema";
import { createCategorySchema, updateCategorySchema } from "@repo/shared/schemas/projects";
import { writeAuditLog } from "../lib/audit.js";
import { dbMiddleware, authMiddleware, adminMiddleware } from "../middleware/auth.js";
import type { AppContext } from "../types/context.js";

export const categoriesRouter = new Hono<AppContext>();

categoriesRouter.use("*", dbMiddleware, authMiddleware);

// GET /categories
categoriesRouter.get("/", async (c) => {
  const db = c.get("db");
  const all = await db.select().from(categories).all();
  return c.json({ data: all });
});

// POST /categories — admin only
categoriesRouter.post("/", adminMiddleware, zValidator("json", createCategorySchema), async (c) => {
  const body = c.req.valid("json");
  const db = c.get("db");
  const actor = c.get("user");

  const existing = await db.select({ id: categories.id }).from(categories).where(eq(categories.name, body.name)).get();
  if (existing) return c.json({ error: "Category name already exists" }, 409);

  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  await db.insert(categories).values({
    id,
    name: body.name,
    status: "active",
    createdBy: actor.id,
    createdAt: now,
    updatedAt: now,
  });

  await writeAuditLog(db, {
    actorUserId: actor.id,
    action: "category.create",
    entityType: "category",
    entityId: id,
    after: body,
  });

  return c.json({ data: { id, name: body.name, status: "active", createdBy: actor.id, createdAt: now, updatedAt: now } }, 201);
});

// PATCH /categories/:id — admin only
categoriesRouter.patch("/:id", adminMiddleware, zValidator("json", updateCategorySchema), async (c) => {
  const db = c.get("db");
  const actor = c.get("user");
  const { id } = c.req.param();
  const body = c.req.valid("json");

  const category = await db.select().from(categories).where(eq(categories.id, id)).get();
  if (!category) return c.json({ error: "Category not found" }, 404);

  if (body.name) {
    const existing = await db.select({ id: categories.id }).from(categories).where(eq(categories.name, body.name)).get();
    if (existing && existing.id !== id) return c.json({ error: "Category name already exists" }, 409);
  }

  const now = new Date().toISOString();
  const updates = { ...body, updatedAt: now };
  await db.update(categories).set(updates).where(eq(categories.id, id));

  await writeAuditLog(db, {
    actorUserId: actor.id,
    action: "category.update",
    entityType: "category",
    entityId: id,
    before: { name: category.name },
    after: updates,
  });

  return c.json({ data: { ok: true } });
});

// POST /categories/:id/archive — admin only
categoriesRouter.post("/:id/archive", adminMiddleware, async (c) => {
  const db = c.get("db");
  const actor = c.get("user");
  const { id } = c.req.param();

  const category = await db.select().from(categories).where(eq(categories.id, id)).get();
  if (!category) return c.json({ error: "Category not found" }, 404);
  if (category.status === "archived") return c.json({ error: "Category already archived" }, 409);

  const now = new Date().toISOString();
  await db.update(categories).set({ status: "archived", updatedAt: now }).where(eq(categories.id, id));

  await writeAuditLog(db, {
    actorUserId: actor.id,
    action: "category.archive",
    entityType: "category",
    entityId: id,
    before: { status: "active" },
    after: { status: "archived" },
  });

  return c.json({ data: { ok: true } });
});
