import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { eq } from "drizzle-orm";
import { projects, projectBalanceMutations } from "@repo/db/schema";
import {
  createProjectSchema,
  updateProjectSchema,
  topupProjectSchema,
} from "@repo/shared/schemas/projects";
import { writeAuditLog } from "../lib/audit.js";
import { dbMiddleware, authMiddleware, adminMiddleware } from "../middleware/auth.js";
import { getProjectBalance, buildTopupMutation } from "../services/projectBalance.js";
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

  const existing = await db
    .select({ id: projects.id })
    .from(projects)
    .where(eq(projects.code, body.code))
    .get();
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

  return c.json(
    {
      data: { id, ...body, status: "active", createdBy: actor.id, createdAt: now, updatedAt: now },
    },
    201,
  );
});

// GET /projects/:id
projectsRouter.get("/:id", async (c) => {
  const db = c.get("db");
  const { id } = c.req.param();
  const project = await db.select().from(projects).where(eq(projects.id, id)).get();
  if (!project) return c.json({ error: "Project not found" }, 404);

  const balanceIdr = await getProjectBalance(db, id);

  return c.json({ data: { ...project, balanceIdr } });
});

// PATCH /projects/:id — admin only
projectsRouter.patch(
  "/:id",
  adminMiddleware,
  zValidator("json", updateProjectSchema),
  async (c) => {
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
  },
);

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

// GET /projects/:id/balance — project balance + its mutations
projectsRouter.get("/:id/balance", async (c) => {
  const db = c.get("db");
  const { id } = c.req.param();

  const project = await db.select().from(projects).where(eq(projects.id, id)).get();
  if (!project) return c.json({ error: "Project not found" }, 404);

  const [balance, mutations] = await Promise.all([
    getProjectBalance(db, id),
    db
      .select()
      .from(projectBalanceMutations)
      .where(eq(projectBalanceMutations.projectId, id))
      .orderBy(projectBalanceMutations.createdAt)
      .all(),
  ]);

  return c.json({ data: { balance, mutations } });
});

// GET /projects/:id/balance/mutations
projectsRouter.get("/:id/balance/mutations", async (c) => {
  const db = c.get("db");
  const { id } = c.req.param();

  const mutations = await db
    .select()
    .from(projectBalanceMutations)
    .where(eq(projectBalanceMutations.projectId, id))
    .orderBy(projectBalanceMutations.createdAt)
    .all();

  return c.json({ data: mutations });
});

// POST /projects/:id/topup — admin only
projectsRouter.post(
  "/:id/topup",
  adminMiddleware,
  zValidator("json", topupProjectSchema),
  async (c) => {
    const db = c.get("db");
    const actor = c.get("user");
    const { id } = c.req.param();
    const body = c.req.valid("json");

    const project = await db.select().from(projects).where(eq(projects.id, id)).get();
    if (!project) return c.json({ error: "Project not found" }, 404);
    if (project.status === "archived") return c.json({ error: "Project is archived" }, 422);

    const mutation = await buildTopupMutation(db, {
      projectId: id,
      amountIdr: body.amountIdr,
      note: body.note,
      createdBy: actor.id,
    });

    await db.insert(projectBalanceMutations).values(mutation);

    await writeAuditLog(db, {
      actorUserId: actor.id,
      action: "project.topup",
      entityType: "project",
      entityId: id,
      after: { amountIdr: body.amountIdr, note: body.note },
    });

    return c.json({ data: { ok: true, balance: mutation.balanceAfterIdr } });
  },
);
