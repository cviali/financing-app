import { describe, it, expect } from "vitest";
import {
  computeSpendingMutation,
  buildReversalMutation,
  getProjectBalance,
} from "../../src/services/projectBalance.js";

// ── Minimal DrizzleD1Database mock ──────────────────────────────────────────
// getProjectBalance reads balance_after_idr from the project's last row ordered by (created_at, id).
// computeSpendingMutation/buildReversalMutation call getProjectBalance which uses the same chain.

function makeMockDb(rows: Array<{ balanceAfterIdr: number }>) {
  return {
    select: () => ({
      from: () => ({
        where: () => ({
          // getProjectBalance chain: .where().orderBy().all()
          orderBy: () => ({
            all: async () => rows,
          }),
        }),
      }),
    }),
  } as unknown as import("@repo/db").DrizzleD1Database;
}

// Helper: build a ledger of balance_after_idr rows from simple in/out pairs
function buildLedger(
  ops: Array<{ direction: "in" | "out"; amount: number }>,
): Array<{ balanceAfterIdr: number }> {
  let balance = 0;
  return ops.map((op) => {
    balance = op.direction === "in" ? balance + op.amount : balance - op.amount;
    return { balanceAfterIdr: balance };
  });
}

describe("getProjectBalance", () => {
  it("returns 0 when the project has no mutations", async () => {
    const db = makeMockDb([]);
    expect(await getProjectBalance(db, "p1")).toBe(0);
  });

  it("returns the last balance_after_idr in the ledger", async () => {
    const ledger = buildLedger([
      { direction: "in", amount: 50000 },
      { direction: "in", amount: 30000 },
    ]); // last balanceAfterIdr = 80000
    const db = makeMockDb(ledger);
    expect(await getProjectBalance(db, "p1")).toBe(80000);
  });

  it("reflects OUT mutations correctly", async () => {
    const ledger = buildLedger([
      { direction: "in", amount: 100000 },
      { direction: "out", amount: 40000 },
    ]); // last balanceAfterIdr = 60000
    const db = makeMockDb(ledger);
    expect(await getProjectBalance(db, "p1")).toBe(60000);
  });
});

describe("computeSpendingMutation", () => {
  it("creates an OUT mutation deducting from the project balance", async () => {
    const db = makeMockDb(buildLedger([{ direction: "in", amount: 300000 }])); // balance = 300000
    const mutation = await computeSpendingMutation(db, {
      projectId: "p1",
      spendingId: "s2",
      amountIdr: 100000,
      createdBy: "u1",
    });
    expect(mutation.direction).toBe("out");
    expect(mutation.amountIdr).toBe(100000);
    expect(mutation.balanceAfterIdr).toBe(200000); // 300000 - 100000
    expect(mutation.projectId).toBe("p1");
  });

  it("throws 422 when the project balance is insufficient", async () => {
    const db = makeMockDb(buildLedger([{ direction: "in", amount: 50000 }])); // balance = 50000
    await expect(
      computeSpendingMutation(db, {
        projectId: "p1",
        spendingId: "s3",
        amountIdr: 100000,
        createdBy: "u1",
      }),
    ).rejects.toMatchObject({ status: 422 });
  });

  it("rejects when the project balance is zero", async () => {
    const db = makeMockDb([]);
    await expect(
      computeSpendingMutation(db, {
        projectId: "p1",
        spendingId: "s4",
        amountIdr: 1000,
        createdBy: "u1",
      }),
    ).rejects.toMatchObject({ status: 422 });
  });
});

describe("buildReversalMutation", () => {
  it("creates an IN mutation adding back the original amount", async () => {
    // Ledger: 200000 in, 100000 out → balance = 100000
    const db = makeMockDb(
      buildLedger([
        { direction: "in", amount: 200000 },
        { direction: "out", amount: 100000 },
      ]),
    );
    const reversal = await buildReversalMutation(db, {
      projectId: "p1",
      spendingId: "s1",
      amountIdr: 100000,
      note: "Void reversal",
      createdBy: "u1",
    });
    expect(reversal.direction).toBe("in");
    expect(reversal.amountIdr).toBe(100000);
    expect(reversal.balanceAfterIdr).toBe(200000); // 100000 + 100000
  });
});
