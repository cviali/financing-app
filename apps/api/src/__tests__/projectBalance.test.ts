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

describe("computeSpendingMutation with knownBalanceIdr (spending edit)", () => {
  // Simulates the PATCH edit path: an in-batch reversal has credited the old
  // amount back, so the new "out" row must chain off that credited balance, not
  // a fresh DB read (which cannot see the not-yet-committed reversal).
  it("chains the new deduction off the reversal balance, not the stale DB read", async () => {
    // DB still shows the pre-edit balance (200000) because the reversal is
    // uncommitted. Old amount was 100000, so effective balance = 300000.
    const db = makeMockDb(buildLedger([{ direction: "in", amount: 200000 }])); // stale read = 200000
    const mutation = await computeSpendingMutation(db, {
      projectId: "p1",
      spendingId: "s1",
      amountIdr: 150000,
      createdBy: "u1",
      knownBalanceIdr: 300000, // reversal.balanceAfterIdr
    });
    expect(mutation.direction).toBe("out");
    expect(mutation.balanceAfterIdr).toBe(150000); // 300000 - 150000, NOT 200000 - 150000
  });

  it("validates against the known (post-reversal) balance so a legit increase is not rejected", async () => {
    // Stale DB read = 50000 would wrongly 422 a raise to 130000; effective
    // balance after reversing the old 100000 is 150000, so it must pass.
    const db = makeMockDb(buildLedger([{ direction: "in", amount: 50000 }])); // stale read = 50000
    const mutation = await computeSpendingMutation(db, {
      projectId: "p1",
      spendingId: "s1",
      amountIdr: 130000,
      createdBy: "u1",
      knownBalanceIdr: 150000,
    });
    expect(mutation.balanceAfterIdr).toBe(20000); // 150000 - 130000
  });

  it("still rejects when the known balance is insufficient", async () => {
    const db = makeMockDb(buildLedger([{ direction: "in", amount: 999999 }]));
    await expect(
      computeSpendingMutation(db, {
        projectId: "p1",
        spendingId: "s1",
        amountIdr: 200000,
        createdBy: "u1",
        knownBalanceIdr: 100000,
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
