import { createMiddleware } from "hono/factory";
import type { AppContext } from "../types/context.js";

export const errorMiddleware = createMiddleware<AppContext>(async (c, next) => {
  try {
    await next();
  } catch (err) {
    if (err instanceof Response) throw err; // hono internal
    const message = err instanceof Error ? err.message : "Internal server error";
    const statusCode = (err as { status?: number }).status ?? 500;
    console.error(err);
    return c.json({ error: message }, statusCode as 500);
  }
});
