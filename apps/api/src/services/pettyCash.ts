import type { DrizzleD1Database } from "@repo/db";
import { pettyCashMutations } from "@repo/db/schema";
import { eq } from "drizzle-orm";

export type MutationDirection = "in" | "out";

type MutationRow = typeof pettyCashMutations.$inferInsert;

interface CreateMutationOpts {
  db: DrizzleD1Database;
  projectId: string;
  spendingId: string | null;
  direction: MutationDirection;
  amountIdr: number;
  note?: string;
  createdBy: string;
}

/**
 * Returns the current petty cash balance for a project by reading the latest
 * mutation row ordered by (created_at, id).  Returns 0 if no mutations exist.
 */
export async function getProjectBalance(db: DrizzleD1Database, projectId: string): Promise<number> {
  const rows = await db
    .select({ balanceAfterIdr: pettyCashMutations.balanceAfterIdr })
    .from(pettyCashMutations)
    .where(eq(pettyCashMutations.projectId, projectId))
    .orderBy(pettyCashMutations.createdAt, pettyCashMutations.id)
    .all();
  return rows.length > 0 ? rows[rows.length - 1]!.balanceAfterIdr : 0;
}

/**
 * Creates a single petty cash mutation row.  The caller is responsible for
 * wrapping in a db.batch() alongside any related spending insert/update so
 * both succeed or fail atomically.
 *
 * Note: this function computes balance_after_idr synchronously from the
 * current balance provided by the caller to avoid a second DB round-trip
 * inside a batch.
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
 * Validates and computes petty cash effect of a new spending.
 * Returns the mutation rows to insert (may be empty for external with no cut).
 * Throws if balance is insufficient for project_petty_cash.
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
  const balance = await getProjectBalance(db, projectId);
  const mutations: MutationRow[] = [];

  if (paymentSource === "project_petty_cash") {
    if (balance < amountIdr) {
      throw Object.assign(
        new Error(`Insufficient petty cash balance. Available: ${balance} IDR, required: ${amountIdr} IDR`),
        { status: 422 },
      );
    }
    mutations.push(
      buildMutationRow(projectId, spendingId, "out", amountIdr, balance, "Project petty cash spending", createdBy),
    );
  } else if (paymentSource === "external" && pettyCashCutIdr > 0) {
    // External spending with petty cash reimbursement (incoming mutation)
    const newBalance = balance + pettyCashCutIdr;
    mutations.push({
      id: crypto.randomUUID(),
      projectId,
      spendingId,
      direction: "in",
      amountIdr: pettyCashCutIdr,
      balanceAfterIdr: newBalance,
      note: "Petty cash reimbursement for external spending",
      createdBy,
      createdAt: new Date().toISOString(),
    });
  }

  return mutations;
}

/**
 * Creates reversal mutations when a spending is voided or its petty cash
 * impact changes.  Returns the new mutation rows to insert.
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
  const balance = await getProjectBalance(db, projectId);
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
