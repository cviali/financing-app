import type { DrizzleD1Database } from "@repo/db";
import { projectBalanceMutations } from "@repo/db/schema";
import { eq } from "drizzle-orm";

export type MutationDirection = "in" | "out";

type MutationRow = typeof projectBalanceMutations.$inferInsert;

/**
 * Returns the current balance for a project by reading `balance_after_idr`
 * from that project's most recent mutation row (ordered by created_at, id).
 *
 * Every insert writes `balance_after_idr` using the pre-insert project balance,
 * so the latest row's value IS the current balance — O(1) instead of O(n) SUM.
 * Returns 0 if the project has no mutations yet.
 */
export async function getProjectBalance(db: DrizzleD1Database, projectId: string): Promise<number> {
  const rows = await db
    .select({ balanceAfterIdr: projectBalanceMutations.balanceAfterIdr })
    .from(projectBalanceMutations)
    .where(eq(projectBalanceMutations.projectId, projectId))
    .orderBy(projectBalanceMutations.createdAt, projectBalanceMutations.id)
    .all();
  return rows.length > 0 ? rows[rows.length - 1]!.balanceAfterIdr : 0;
}

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
 * Validates and computes the balance effect of a new spending against the
 * project's balance. Throws 422 if the project balance is insufficient.
 */
export async function computeSpendingMutation(
  db: DrizzleD1Database,
  opts: {
    projectId: string;
    spendingId: string;
    amountIdr: number;
    createdBy: string;
  },
): Promise<MutationRow> {
  const { projectId, spendingId, amountIdr, createdBy } = opts;
  const balance = await getProjectBalance(db, projectId);

  if (balance < amountIdr) {
    throw Object.assign(
      new Error(
        `Insufficient project balance. Available: ${balance.toLocaleString("id-ID")} IDR, required: ${amountIdr.toLocaleString("id-ID")} IDR`,
      ),
      { status: 422 },
    );
  }

  return buildMutationRow(projectId, spendingId, "out", amountIdr, balance, "Spending", createdBy);
}

/**
 * Creates a reversal ("in") mutation against the project's balance, used
 * when editing or voiding a spending that previously deducted `amountIdr`.
 */
export async function buildReversalMutation(
  db: DrizzleD1Database,
  opts: {
    projectId: string;
    spendingId: string;
    amountIdr: number;
    note: string;
    createdBy: string;
  },
): Promise<MutationRow> {
  const { projectId, spendingId, amountIdr, note, createdBy } = opts;
  const balance = await getProjectBalance(db, projectId);
  return buildMutationRow(projectId, spendingId, "in", amountIdr, balance, note, createdBy);
}

/**
 * Creates an admin top-up ("in") mutation for a project, not tied to any spending.
 */
export async function buildTopupMutation(
  db: DrizzleD1Database,
  opts: {
    projectId: string;
    amountIdr: number;
    note?: string | null | undefined;
    createdBy: string;
  },
): Promise<MutationRow> {
  const { projectId, amountIdr, note, createdBy } = opts;
  const balance = await getProjectBalance(db, projectId);
  return buildMutationRow(projectId, null, "in", amountIdr, balance, note ?? "Top-up", createdBy);
}
