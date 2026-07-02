import type { ErrorHandler } from "hono";
import type { Env } from "../types/env.js";

// Registered via `app.onError()`, NOT `app.use()`.
//
// Hono's `compose()` wraps every middleware/route layer in its OWN try/catch
// and, on a thrown Error, immediately invokes `this.errorHandler` (the
// top-level app's registered error handler) at that innermost layer — it does
// NOT let the exception propagate as a rejected promise up through outer
// `app.use("*", mw)` middleware. A plain middleware doing
// `try { await next() } catch {}` therefore NEVER sees exceptions thrown by
// routes/services (e.g. `throw Object.assign(new Error(...), { status: 422 })`
// in computeSpendingMutation): Hono's *default* errorHandler (console.error +
// plain-text "Internal Server Error", 500) already resolved them first. Routes
// that `return c.json({ error }, code)` directly (never throw) were unaffected,
// which is why this was invisible outside the throw-based validation paths.
export const errorHandler: ErrorHandler<{ Bindings: Env }> = (err, c) => {
  const message = err instanceof Error ? err.message : "Internal server error";
  const statusCode = (err as { status?: number }).status ?? 500;
  console.error(err);
  return c.json({ error: message }, statusCode as 500);
};
