import { Hono } from "hono";
import { desc, eq } from "drizzle-orm";
import { pettyCashMutations, projects, users } from "@repo/db/schema";
import { getGlobalBalance } from "../services/pettyCash.js";
import { dbMiddleware, authMiddleware } from "../middleware/auth.js";
import type { AppContext } from "../types/context.js";

export const pettyCashRouter = new Hono<AppContext>();

pettyCashRouter.use("*", dbMiddleware, authMiddleware);

// GET /petty-cash — global balance + recent mutations
pettyCashRouter.get("/", async (c) => {
  const db = c.get("db");

  const [balance, recent] = await Promise.all([
    getGlobalBalance(db),
    db
      .select({
        id: pettyCashMutations.id,
        projectId: pettyCashMutations.projectId,
        projectName: projects.name,
        projectCode: projects.code,
        spendingId: pettyCashMutations.spendingId,
        direction: pettyCashMutations.direction,
        amountIdr: pettyCashMutations.amountIdr,
        balanceAfterIdr: pettyCashMutations.balanceAfterIdr,
        note: pettyCashMutations.note,
        createdByUsername: users.username,
        createdAt: pettyCashMutations.createdAt,
      })
      .from(pettyCashMutations)
      .leftJoin(projects, eq(pettyCashMutations.projectId, projects.id))
      .leftJoin(users, eq(pettyCashMutations.createdBy, users.id))
      .orderBy(desc(pettyCashMutations.createdAt))
      .limit(10)
      .all(),
  ]);

  return c.json({ data: { balance, recentMutations: recent } });
});

// GET /petty-cash/mutations — all mutations with project/user info
pettyCashRouter.get("/mutations", async (c) => {
  const db = c.get("db");

  const [balance, mutations] = await Promise.all([
    getGlobalBalance(db),
    db
      .select({
        id: pettyCashMutations.id,
        projectId: pettyCashMutations.projectId,
        projectName: projects.name,
        projectCode: projects.code,
        spendingId: pettyCashMutations.spendingId,
        direction: pettyCashMutations.direction,
        amountIdr: pettyCashMutations.amountIdr,
        balanceAfterIdr: pettyCashMutations.balanceAfterIdr,
        note: pettyCashMutations.note,
        createdByUsername: users.username,
        createdAt: pettyCashMutations.createdAt,
      })
      .from(pettyCashMutations)
      .leftJoin(projects, eq(pettyCashMutations.projectId, projects.id))
      .leftJoin(users, eq(pettyCashMutations.createdBy, users.id))
      .orderBy(desc(pettyCashMutations.createdAt))
      .all(),
  ]);

  return c.json({ data: { balance, mutations } });
});
