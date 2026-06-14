import { createMiddleware } from "hono/factory";
import { getCookie } from "hono/cookie";
import { createDb } from "@repo/db/client";
import { users } from "@repo/db/schema";
import { eq } from "drizzle-orm";
import { verifyJwt } from "../lib/jwt.js";
import { verifyCsrfToken } from "../lib/csrf.js";
import type { AppContext } from "../types/context.js";

// Attaches DB to context
export const dbMiddleware = createMiddleware<AppContext>(async (c, next) => {
  c.set("db", createDb(c.env.DB));
  await next();
});

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

// Authenticates request; re-fetches user from DB on every request for
// immediate role/status change propagation.
export const authMiddleware = createMiddleware<AppContext>(async (c, next) => {
  const token = getCookie(c, "session");
  if (!token) return c.json({ error: "Unauthorized" }, 401);

  const payload = await verifyJwt(token, c.env.JWT_SECRET);
  if (!payload) return c.json({ error: "Unauthorized" }, 401);

  // CSRF check for state-changing methods
  if (!SAFE_METHODS.has(c.req.method)) {
    const csrfHeader = c.req.header("x-csrf-token");
    if (!csrfHeader) return c.json({ error: "Missing CSRF token" }, 403);
    const valid = await verifyCsrfToken(token, csrfHeader, c.env.CSRF_SECRET);
    if (!valid) return c.json({ error: "Invalid CSRF token" }, 403);
  }

  const db = c.get("db");
  const user = await db.select().from(users).where(eq(users.id, payload.sub)).get();
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  if (user.status === "disabled") return c.json({ error: "Account disabled" }, 403);

  const { passwordHash: _ph, ...safeUser } = user;
  c.set("user", safeUser);
  await next();
});

// Admin-only guard (use after authMiddleware)
export const adminMiddleware = createMiddleware<AppContext>(async (c, next) => {
  const user = c.get("user");
  if (user.role !== "admin") return c.json({ error: "Admin access required" }, 403);
  await next();
});
