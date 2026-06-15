import { describe, it, expect } from "vitest";
import { computeSpendingMutations, buildReversalMutations, getGlobalBalance } from "../../src/services/pettyCash.js";

// ── Minimal DrizzleD1Database mock ──────────────────────────────────────────
// getGlobalBalance reads balance_after_idr from the last row ordered by (created_at, id).
// computeSpendingMutations/buildReversalMutations call getGlobalBalance which uses the same chain.

function makeMockDb(rows: Array<{ balanceAfterIdr: number }>) {
  return {
    select: () => ({
      from: () => ({
        // getGlobalBalance chain: .orderBy().all()
        orderBy: () => ({
          all: async () => rows,
        }),
        // Used by computeSpendingMutations / buildReversalMutations (same getGlobalBalance)
        all: async () => rows,
      }),
    }),
  } as unknown as import("@repo/db").DrizzleD1Database;
}

// Helper: build a ledger of balance_after_idr rows from simple in/out pairs
function buildLedger(ops: Array<{ direction: "in" | "out"; amount: number }>): Array<{ balanceAfterIdr: number }> {
  let balance = 0;
  return ops.map((op) => {
    balance = op.direction === "in" ? balance + op.amount : balance - op.amount;
    return { balanceAfterIdr: balance };
  });
}

describe("getGlobalBalance", () => {
  it("returns 0 when no mutations exist", async () => {
    const db = makeMockDb([]);
    expect(await getGlobalBalance(db)).toBe(0);
  });

  it("returns the last balance_after_idr in the ledger", async () => {
    const ledger = buildLedger([
      { direction: "in", amount: 50000 },
      { direction: "in", amount: 30000 },
    ]); // last balanceAfterIdr = 80000
    const db = makeMockDb(ledger);
    expect(await getGlobalBalance(db)).toBe(80000);
  });

  it("reflects OUT mutations correctly", async () => {
    const ledger = buildLedger([
      { direction: "in", amount: 100000 },
      { direction: "out", amount: 40000 },
    ]); // last balanceAfterIdr = 60000
    const db = makeMockDb(ledger);
    expect(await getGlobalBalance(db)).toBe(60000);
  });
});

describe("computeSpendingMutations – external with petty cash cut", () => {
  it("creates an IN mutation for the cut amount", async () => {
    // Ledger: one prior IN of 100000, so current balance = 100000
    const db = makeMockDb(buildLedger([{ direction: "in", amount: 100000 }]));
    const mutations = await computeSpendingMutations(db, {
      projectId: "p1",
      spendingId: "s1",
      paymentSource: "external",
      amountIdr: 200000,
      pettyCashCutIdr: 50000,
      createdBy: "u1",
    });
    expect(mutations).toHaveLength(1);
    const m = mutations[0]!;
    expect(m.direction).toBe("in");
    expect(m.amountIdr).toBe(50000);
    expect(m.balanceAfterIdr).toBe(150000); // 100000 + 50000
  });

  it("returns no mutations for external spending with zero cut", async () => {
    const db = makeMockDb(buildLedger([{ direction: "in", amount: 100000 }]));
    const mutations = await computeSpendingMutations(db, {
      projectId: "p1",
      spendingId: "s1",
      paymentSource: "external",
      amountIdr: 200000,
      pettyCashCutIdr: 0,
      createdBy: "u1",
    });
    expect(mutations).toHaveLength(0);
  });
});

describe("computeSpendingMutations – project_petty_cash (draws from global pool)", () => {
  it("creates an OUT mutation deducting from global balance", async () => {
    const db = makeMockDb(buildLedger([{ direction: "in", amount: 300000 }])); // balance = 300000
    const mutations = await computeSpendingMutations(db, {
      projectId: "p1",
      spendingId: "s2",
      paymentSource: "project_petty_cash",
      amountIdr: 100000,
      pettyCashCutIdr: 0,
      createdBy: "u1",
    });
    expect(mutations).toHaveLength(1);
    const m = mutations[0]!;
    expect(m.direction).toBe("out");
    expect(m.amountIdr).toBe(100000);
    expect(m.balanceAfterIdr).toBe(200000); // 300000 - 100000
    expect(m.projectId).toBe("p1"); // attribution still recorded
  });

  it("throws 422 when global balance is insufficient", async () => {
    const db = makeMockDb(buildLedger([{ direction: "in", amount: 50000 }])); // balance = 50000
    await expect(
      computeSpendingMutations(db, {
        projectId: "p1",
        spendingId: "s3",
        paymentSource: "project_petty_cash",
        amountIdr: 100000,
        pettyCashCutIdr: 0,
        createdBy: "u1",
      }),
    ).rejects.toMatchObject({ status: 422 });
  });

  it("rejects when global balance is zero", async () => {
    const db = makeMockDb([]);
    await expect(
      computeSpendingMutations(db, {
        projectId: "p1",
        spendingId: "s4",
        paymentSource: "project_petty_cash",
        amountIdr: 1000,
        pettyCashCutIdr: 0,
        createdBy: "u1",
      }),
    ).rejects.toMatchObject({ status: 422 });
  });

  it("allows spending from global pool even if local project has no mutations", async () => {
    // p2 contributed the balance, p1 can still spend from the shared global pool
    const db = makeMockDb(buildLedger([{ direction: "in", amount: 200000 }]));
    const mutations = await computeSpendingMutations(db, {
      projectId: "p1",
      spendingId: "s5",
      paymentSource: "project_petty_cash",
      amountIdr: 50000,
      pettyCashCutIdr: 0,
      createdBy: "u1",
    });
    expect(mutations[0]!.balanceAfterIdr).toBe(150000);
  });
});

describe("buildReversalMutations", () => {
  it("creates opposite direction mutation for an OUT original", async () => {
    // Ledger: 200000 in, 100000 out → balance = 100000
    const db = makeMockDb(buildLedger([
      { direction: "in", amount: 200000 },
      { direction: "out", amount: 100000 },
    ]));
    const reversals = await buildReversalMutations(db, {
      projectId: "p1",
      spendingId: "s1",
      originalDirection: "out",
      originalAmount: 100000,
      note: "Void reversal",
      createdBy: "u1",
    });
    expect(reversals).toHaveLength(1);
    const r = reversals[0]!;
    expect(r.direction).toBe("in");
    expect(r.amountIdr).toBe(100000);
    expect(r.balanceAfterIdr).toBe(200000); // 100000 + 100000
  });

  it("creates opposite direction mutation for an IN original", async () => {
    // Ledger: 150000 in → balance = 150000
    const db = makeMockDb(buildLedger([{ direction: "in", amount: 150000 }]));
    const reversals = await buildReversalMutations(db, {
      projectId: "p1",
      spendingId: "s1",
      originalDirection: "in",
      originalAmount: 50000,
      note: "Reversal",
      createdBy: "u1",
    });
    expect(reversals[0]!.direction).toBe("out");
    expect(reversals[0]!.balanceAfterIdr).toBe(100000); // 150000 - 50000
  });
});
