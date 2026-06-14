import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { eq, ne } from "drizzle-orm";
import { users } from "@repo/db/schema";
import {
  createUserSchema,
  updateUserSchema,
  updateUserRoleSchema,
  updateUserStatusSchema,
  resetPasswordSchema,
} from "@repo/shared/schemas/auth";
import { hashPassword } from "../lib/crypto.js";
import { writeAuditLog } from "../lib/audit.js";
import { dbMiddleware, authMiddleware, adminMiddleware } from "../middleware/auth.js";
import type { AppContext } from "../types/context.js";

export const usersRouter = new Hono<AppContext>();

usersRouter.use("*", dbMiddleware, authMiddleware, adminMiddleware);

// GET /users
usersRouter.get("/", async (c) => {
  const db = c.get("db");
  const all = await db
    .select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      role: users.role,
      status: users.status,
      mustChangePassword: users.mustChangePassword,
      lastLoginAt: users.lastLoginAt,
      createdBy: users.createdBy,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
    })
    .from(users)
    .all();
  return c.json({ data: all });
});

// POST /users
usersRouter.post("/", zValidator("json", createUserSchema), async (c) => {
  const body = c.req.valid("json");
  const db = c.get("db");
  const actor = c.get("user");

  // Check username uniqueness
  const existing = await db.select({ id: users.id }).from(users).where(eq(users.username, body.username)).get();
  if (existing) return c.json({ error: "Username already taken" }, 409);

  const hash = await hashPassword(body.password);
  const now = new Date().toISOString();
  const id = crypto.randomUUID();

  await db.insert(users).values({
    id,
    username: body.username,
    displayName: body.displayName,
    passwordHash: hash,
    role: body.role,
    status: body.status,
    mustChangePassword: body.mustChangePassword,
    createdBy: actor.id,
    createdAt: now,
    updatedAt: now,
  });

  await writeAuditLog(db, {
    actorUserId: actor.id,
    action: "user.create",
    entityType: "user",
    entityId: id,
    after: { username: body.username, role: body.role, status: body.status },
  });

  return c.json(
    {
      data: {
        id,
        username: body.username,
        displayName: body.displayName,
        role: body.role,
        status: body.status,
        mustChangePassword: body.mustChangePassword,
        createdBy: actor.id,
        createdAt: now,
        updatedAt: now,
      },
    },
    201,
  );
});

// PATCH /users/:id
usersRouter.patch("/:id", zValidator("json", updateUserSchema), async (c) => {
  const db = c.get("db");
  const actor = c.get("user");
  const { id } = c.req.param();
  const body = c.req.valid("json");

  const target = await db.select().from(users).where(eq(users.id, id)).get();
  if (!target) return c.json({ error: "User not found" }, 404);

  const now = new Date().toISOString();
  const updates: Partial<typeof target> = { updatedAt: now };
  if (body.displayName !== undefined) updates.displayName = body.displayName;
  if (body.status !== undefined) updates.status = body.status;

  await db.update(users).set(updates).where(eq(users.id, id));

  await writeAuditLog(db, {
    actorUserId: actor.id,
    action: "user.update",
    entityType: "user",
    entityId: id,
    before: { displayName: target.displayName, status: target.status },
    after: updates,
  });

  if (body.status === "disabled") {
    await writeAuditLog(db, {
      actorUserId: actor.id,
      action: "user.disable",
      entityType: "user",
      entityId: id,
    });
  }

  return c.json({ data: { ok: true } });
});

// PATCH /users/:id/role
usersRouter.patch("/:id/role", zValidator("json", updateUserRoleSchema), async (c) => {
  const db = c.get("db");
  const actor = c.get("user");
  const { id } = c.req.param();
  const { role } = c.req.valid("json");

  const target = await db.select().from(users).where(eq(users.id, id)).get();
  if (!target) return c.json({ error: "User not found" }, 404);

  const now = new Date().toISOString();
  await db.update(users).set({ role, updatedAt: now }).where(eq(users.id, id));

  await writeAuditLog(db, {
    actorUserId: actor.id,
    action: "user.change_role",
    entityType: "user",
    entityId: id,
    before: { role: target.role },
    after: { role },
  });

  return c.json({ data: { ok: true } });
});

// PATCH /users/:id/status
usersRouter.patch("/:id/status", zValidator("json", updateUserStatusSchema), async (c) => {
  const db = c.get("db");
  const actor = c.get("user");
  const { id } = c.req.param();
  const { status } = c.req.valid("json");

  const target = await db.select().from(users).where(eq(users.id, id)).get();
  if (!target) return c.json({ error: "User not found" }, 404);

  const now = new Date().toISOString();
  await db.update(users).set({ status, updatedAt: now }).where(eq(users.id, id));

  await writeAuditLog(db, {
    actorUserId: actor.id,
    action: status === "disabled" ? "user.disable" : "user.update",
    entityType: "user",
    entityId: id,
    before: { status: target.status },
    after: { status },
  });

  return c.json({ data: { ok: true } });
});

// POST /users/:id/reset-password
usersRouter.post("/:id/reset-password", zValidator("json", resetPasswordSchema), async (c) => {
  const db = c.get("db");
  const actor = c.get("user");
  const { id } = c.req.param();
  const { newPassword } = c.req.valid("json");

  const target = await db.select().from(users).where(eq(users.id, id)).get();
  if (!target) return c.json({ error: "User not found" }, 404);

  const hash = await hashPassword(newPassword);
  const now = new Date().toISOString();
  await db
    .update(users)
    .set({ passwordHash: hash, mustChangePassword: true, updatedAt: now })
    .where(eq(users.id, id));

  await writeAuditLog(db, {
    actorUserId: actor.id,
    action: "user.reset_password",
    entityType: "user",
    entityId: id,
  });

  return c.json({ data: { ok: true } });
});
