import type { DrizzleD1Database } from "@repo/db";
import { pettyCashMutations } from "@repo/db/schema";
import { eq } from "drizzle-orm";

export type MutationDirection = "in" | "out";

type MutationRow = typeof pettyCashMutations.$inferInsert;

/**
 * Returns the current GLOBAL petty cash balance by reading `balance_after_idr`
 * from the most recent mutation row (ordered by created_at, id).
 *
 * Every insert writes `balance_after_idr` using the pre-insert global balance,
 * so the latest row's value IS the current balance — O(1) instead of O(n) SUM.
 * Returns 0 if no mutations exist yet.
 */
export async function getGlobalBalance(db: DrizzleD1Database): Promise<number> {
  const rows = await db
    .select({ balanceAfterIdr: pettyCashMutations.balanceAfterIdr })
    .from(pettyCashMutations)
    .orderBy(pettyCashMutations.createdAt, pettyCashMutations.id)
    .all();
  return rows.length > 0 ? rows[rows.length - 1]!.balanceAfterIdr : 0;
}

/**
 * @deprecated Use getGlobalBalance — petty cash is now a shared pool.
 * Kept for backward compatibility; returns the global balance, ignoring projectId.
 */
export async function getProjectBalance(db: DrizzleD1Database, _projectId: string): Promise<number> {
  return getGlobalBalance(db);
}

/**
 * Builds a single petty cash mutation row.
 * `projectId` is kept for attribution (showing which project used petty cash)
 * but does NOT scope the balance — all mutations share one global pool.
 */
export function buildMutationRow(
  projectId: string,
  spendingId: string | null,
  direction: MutationDirection,
  amountIdr: number,
  currentBalance: number,
  note: string | null,
  createdBy: string,
): MutationRow {
  const balanceAfterIdr =
    direction === "in" ? currentBalance + amountIdr : currentBalance - amountIdr;
  return {
    id: crypto.randomUUID(),
    projectId,
    spendingId,
    direction,
    amountIdr,
    balanceAfterIdr,
    note: note ?? null,
    createdBy,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Validates and computes petty cash effect of a new spending against the
 * GLOBAL balance. Returns mutation rows to insert (may be empty).
 * Throws 422 if global balance is insufficient for project_petty_cash.
 */
export async function computeSpendingMutations(
  db: DrizzleD1Database,
  opts: {
    projectId: string;
    spendingId: string;
    paymentSource: "external" | "project_petty_cash";
    amountIdr: number;
    pettyCashCutIdr: number;
    createdBy: string;
  },
): Promise<MutationRow[]> {
  const { projectId, spendingId, paymentSource, amountIdr, pettyCashCutIdr, createdBy } = opts;
  const balance = await getGlobalBalance(db);
  const mutations: MutationRow[] = [];

  if (paymentSource === "project_petty_cash") {
    if (balance < amountIdr) {
      throw Object.assign(
        new Error(
          `Insufficient shared petty cash balance. Available: ${balance.toLocaleString("id-ID")} IDR, required: ${amountIdr.toLocaleString("id-ID")} IDR`,
        ),
        { status: 422 },
      );
    }
    mutations.push(
      buildMutationRow(projectId, spendingId, "out", amountIdr, balance, "Petty cash spending", createdBy),
    );
  } else if (paymentSource === "external" && pettyCashCutIdr > 0) {
    mutations.push(
      buildMutationRow(projectId, spendingId, "in", pettyCashCutIdr, balance, "Petty cash reimbursement for external spending", createdBy),
    );
  }

  return mutations;
}

/**
 * Creates reversal mutations against the GLOBAL balance.
 */
export async function buildReversalMutations(
  db: DrizzleD1Database,
  opts: {
    projectId: string;
    spendingId: string;
    originalDirection: MutationDirection;
    originalAmount: number;
    note: string;
    createdBy: string;
  },
): Promise<MutationRow[]> {
  const { projectId, spendingId, originalDirection, originalAmount, note, createdBy } = opts;
  const balance = await getGlobalBalance(db);
  const reversalDirection: MutationDirection = originalDirection === "in" ? "out" : "in";
  const balanceAfterIdr =
    reversalDirection === "in" ? balance + originalAmount : balance - originalAmount;

  return [
    {
      id: crypto.randomUUID(),
      projectId,
      spendingId,
      direction: reversalDirection,
      amountIdr: originalAmount,
      balanceAfterIdr,
      note,
      createdBy,
      createdAt: new Date().toISOString(),
    },
  ];
}
