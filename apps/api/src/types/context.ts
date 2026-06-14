import type { User } from "@repo/db";
import type { Env } from "./env.js";

export interface AppContext {
  Bindings: Env;
  Variables: {
    user: Omit<User, "passwordHash">;
    db: import("@repo/db").DrizzleD1Database;
  };
}
