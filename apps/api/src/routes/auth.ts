import { Hono } from "hono";
import { setCookie, deleteCookie, getCookie } from "hono/cookie";
import { zValidator } from "@hono/zod-validator";
import { eq } from "drizzle-orm";
import { users } from "@repo/db/schema";
import { loginSchema, changePasswordSchema } from "@repo/shared/schemas/auth";
import { signJwt, verifyJwt } from "../lib/jwt.js";
import { verifyPassword, hashPassword } from "../lib/crypto.js";
import { generateCsrfToken } from "../lib/csrf.js";
import { writeAuditLog } from "../lib/audit.js";
import { authMiddleware, dbMiddleware } from "../middleware/auth.js";
import type { AppContext } from "../types/context.js";

export const authRouter = new Hono<AppContext>();

const COOKIE_OPTS = {
  httpOnly: true,
  secure: true,
  sameSite: "Lax" as const,
  path: "/",
  domain: ".christianviali0.workers.dev", // shared across api + web subdomains
  maxAge: 60 * 60 * 24 * 7, // 7 days
};

authRouter.use("*", dbMiddleware);

// POST /auth/login
authRouter.post("/login", zValidator("json", loginSchema), async (c) => {
  const { username, password } = c.req.valid("json");
  const db = c.get("db");

  const user = await db.select().from(users).where(eq(users.username, username)).get();
  if (!user) return c.json({ error: "Invalid username or password" }, 401);
  if (user.status === "disabled") return c.json({ error: "Account disabled" }, 403);

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) return c.json({ error: "Invalid username or password" }, 401);

  // Update last_login_at
  const now = new Date().toISOString();
  await db.update(users).set({ lastLoginAt: now, updatedAt: now }).where(eq(users.id, user.id));

  const token = await signJwt({ sub: user.id }, c.env.JWT_SECRET);
  const csrfToken = await generateCsrfToken(token, c.env.CSRF_SECRET);

  setCookie(c, "session", token, COOKIE_OPTS);
  setCookie(c, "csrf_token", csrfToken, { ...COOKIE_OPTS, httpOnly: false });

  return c.json({
    data: {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
      mustChangePassword: user.mustChangePassword,
      csrfToken, // included in body so web app can cache it without reading cookie
    },
  });
});

// POST /auth/logout
authRouter.post("/logout", async (c) => {
  deleteCookie(c, "session", { path: "/" });
  deleteCookie(c, "csrf_token", { path: "/" });
  return c.json({ data: { ok: true } });
});

// GET /auth/me
authRouter.get("/me", authMiddleware, async (c) => {
  const user = c.get("user");
  const sessionToken = getCookie(c, "session") ?? "";
  const csrfToken = sessionToken
    ? await generateCsrfToken(sessionToken, c.env.CSRF_SECRET)
    : "";
  return c.json({ data: { ...user, csrfToken } });
});

// POST /auth/change-password
authRouter.post("/change-password", authMiddleware, zValidator("json", changePasswordSchema), async (c) => {
  const { currentPassword, newPassword } = c.req.valid("json");
  const db = c.get("db");
  const user = c.get("user");

  const fullUser = await db.select().from(users).where(eq(users.id, user.id)).get();
  if (!fullUser) return c.json({ error: "User not found" }, 404);

  const valid = await verifyPassword(currentPassword, fullUser.passwordHash);
  if (!valid) return c.json({ error: "Current password is incorrect" }, 400);

  const newHash = await hashPassword(newPassword);
  const now = new Date().toISOString();
  await db
    .update(users)
    .set({ passwordHash: newHash, mustChangePassword: false, updatedAt: now })
    .where(eq(users.id, user.id));

  await writeAuditLog(db, {
    actorUserId: user.id,
    action: "auth.change_password",
    entityType: "user",
    entityId: user.id,
  });

  // Re-issue token after password change
  const token = await signJwt({ sub: user.id }, c.env.JWT_SECRET);
  const csrfToken = await generateCsrfToken(token, c.env.CSRF_SECRET);
  setCookie(c, "session", token, COOKIE_OPTS);
  setCookie(c, "csrf_token", csrfToken, { ...COOKIE_OPTS, httpOnly: false });

  return c.json({ data: { ok: true, csrfToken } });
});
