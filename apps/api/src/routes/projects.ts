import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { eq } from "drizzle-orm";
import { projects, pettyCashMutations } from "@repo/db/schema";
import { createProjectSchema, updateProjectSchema } from "@repo/shared/schemas/projects";
import { writeAuditLog } from "../lib/audit.js";
import { dbMiddleware, authMiddleware, adminMiddleware } from "../middleware/auth.js";
import { getGlobalBalance } from "../services/pettyCash.js";
import type { AppContext } from "../types/context.js";

export const projectsRouter = new Hono<AppContext>();

projectsRouter.use("*", dbMiddleware, authMiddleware);

// GET /projects
projectsRouter.get("/", async (c) => {
  const db = c.get("db");
  const all = await db.select().from(projects).all();
  return c.json({ data: all });
});

// POST /projects — admin only
projectsRouter.post("/", adminMiddleware, zValidator("json", createProjectSchema), async (c) => {
  const body = c.req.valid("json");
  const db = c.get("db");
  const actor = c.get("user");

  const existing = await db.select({ id: projects.id }).from(projects).where(eq(projects.code, body.code)).get();
  if (existing) return c.json({ error: "Project code already exists" }, 409);

  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  await db.insert(projects).values({
    id,
    name: body.name,
    code: body.code,
    description: body.description ?? null,
    status: "active",
    createdBy: actor.id,
    createdAt: now,
    updatedAt: now,
  });

  await writeAuditLog(db, {
    actorUserId: actor.id,
    action: "project.create",
    entityType: "project",
    entityId: id,
    after: body,
  });

  return c.json({ data: { id, ...body, status: "active", createdBy: actor.id, createdAt: now, updatedAt: now } }, 201);
});

// GET /projects/:id
projectsRouter.get("/:id", async (c) => {
  const db = c.get("db");
  const { id } = c.req.param();
  const project = await db.select().from(projects).where(eq(projects.id, id)).get();
  if (!project) return c.json({ error: "Project not found" }, 404);

  // Global shared petty cash balance
  const pettyCashBalance = await getGlobalBalance(db);

  return c.json({ data: { ...project, pettyCashBalance } });
});

// PATCH /projects/:id — admin only
projectsRouter.patch("/:id", adminMiddleware, zValidator("json", updateProjectSchema), async (c) => {
  const db = c.get("db");
  const actor = c.get("user");
  const { id } = c.req.param();
  const body = c.req.valid("json");

  const project = await db.select().from(projects).where(eq(projects.id, id)).get();
  if (!project) return c.json({ error: "Project not found" }, 404);

  const now = new Date().toISOString();
  const updates = { ...body, updatedAt: now };
  await db.update(projects).set(updates).where(eq(projects.id, id));

  await writeAuditLog(db, {
    actorUserId: actor.id,
    action: "project.update",
    entityType: "project",
    entityId: id,
    before: { name: project.name, description: project.description },
    after: updates,
  });

  return c.json({ data: { ok: true } });
});

// POST /projects/:id/archive — admin only
projectsRouter.post("/:id/archive", adminMiddleware, async (c) => {
  const db = c.get("db");
  const actor = c.get("user");
  const { id } = c.req.param();

  const project = await db.select().from(projects).where(eq(projects.id, id)).get();
  if (!project) return c.json({ error: "Project not found" }, 404);
  if (project.status === "archived") return c.json({ error: "Project already archived" }, 409);

  const now = new Date().toISOString();
  await db.update(projects).set({ status: "archived", updatedAt: now }).where(eq(projects.id, id));

  await writeAuditLog(db, {
    actorUserId: actor.id,
    action: "project.archive",
    entityType: "project",
    entityId: id,
    before: { status: "active" },
    after: { status: "archived" },
  });

  return c.json({ data: { ok: true } });
});

// GET /projects/:id/petty-cash — project-scoped mutations + global balance
projectsRouter.get("/:id/petty-cash", async (c) => {
  const db = c.get("db");
  const { id } = c.req.param();

  const project = await db.select().from(projects).where(eq(projects.id, id)).get();
  if (!project) return c.json({ error: "Project not found" }, 404);

  const [balance, mutations] = await Promise.all([
    getGlobalBalance(db),
    db
      .select()
      .from(pettyCashMutations)
      .where(eq(pettyCashMutations.projectId, id))
      .orderBy(pettyCashMutations.createdAt)
      .all(),
  ]);

  return c.json({ data: { balance, mutations } });
});

// GET /projects/:id/petty-cash/mutations
projectsRouter.get("/:id/petty-cash/mutations", async (c) => {
  const db = c.get("db");
  const { id } = c.req.param();

  const mutations = await db
    .select()
    .from(pettyCashMutations)
    .where(eq(pettyCashMutations.projectId, id))
    .orderBy(pettyCashMutations.createdAt)
    .all();

  return c.json({ data: mutations });
});
