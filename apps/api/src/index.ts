import { Hono } from "hono";
import { cors } from "hono/cors";
import { errorMiddleware } from "./middleware/error.js";
import { authRouter } from "./routes/auth.js";
import { usersRouter } from "./routes/users.js";
import { projectsRouter } from "./routes/projects.js";
import { categoriesRouter } from "./routes/categories.js";
import { spendingsRouter } from "./routes/spendings.js";
import { receiptsRouter } from "./routes/receipts.js";
import { exportsRouter } from "./routes/exports.js";
import { pettyCashRouter } from "./routes/petty-cash.js";
import { seedAdmin } from "@repo/db/seed";
import type { Env } from "./types/env.js";

const app = new Hono<{ Bindings: Env }>();

app.use("*", errorMiddleware);

app.use(
  "*",
  cors({
    origin: (origin, c) => c.env.CORS_ORIGIN || origin,
    allowHeaders: ["Content-Type", "X-CSRF-Token"],
    allowMethods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
  }),
);

app.route("/auth", authRouter);
app.route("/users", usersRouter);
app.route("/projects", projectsRouter);
app.route("/categories", categoriesRouter);
app.route("/spendings", spendingsRouter);
app.route("/receipts", receiptsRouter);
app.route("/exports", exportsRouter);
app.route("/petty-cash", pettyCashRouter);

// Health check
app.get("/health", (c) => c.json({ status: "ok", ts: new Date().toISOString() }));

// Seed endpoint (only in dev — protected by a shared secret header)
app.post("/admin/seed", async (c) => {
  if (c.env.ENVIRONMENT !== "development") {
    return c.json({ error: "Not available in production" }, 403);
  }
  await seedAdmin(c.env.DB);
  return c.json({ data: { ok: true } });
});

export default app;
