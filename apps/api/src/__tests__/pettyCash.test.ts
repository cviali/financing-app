import { describe, it, expect, vi, beforeEach } from "vitest";
import { computeSpendingMutations, buildReversalMutations, getProjectBalance } from "../../src/services/pettyCash.js";

// ── Minimal DrizzleD1Database mock ──────────────────────────────────────────

function makeMockDb(mutations: { balanceAfterIdr: number }[]) {
  return {
    select: () => ({
      from: () => ({
        where: () => ({
          orderBy: () => ({
            all: async () => mutations,
          }),
        }),
      }),
    }),
  } as unknown as import("@repo/db").DrizzleD1Database;
}

describe("getProjectBalance", () => {
  it("returns 0 when no mutations exist", async () => {
    const db = makeMockDb([]);
    expect(await getProjectBalance(db, "p1")).toBe(0);
  });

  it("returns balance_after_idr from the last mutation", async () => {
    const db = makeMockDb([{ balanceAfterIdr: 50000 }, { balanceAfterIdr: 80000 }]);
    expect(await getProjectBalance(db, "p1")).toBe(80000);
  });
});

describe("computeSpendingMutations – external with petty cash cut", () => {
  it("creates an IN mutation for the cut amount", async () => {
    const db = makeMockDb([{ balanceAfterIdr: 100000 }]);
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
    const db = makeMockDb([{ balanceAfterIdr: 100000 }]);
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

describe("computeSpendingMutations – project_petty_cash", () => {
  it("creates an OUT mutation deducting from balance", async () => {
    const db = makeMockDb([{ balanceAfterIdr: 300000 }]);
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
  });

  it("throws 422 when balance is insufficient", async () => {
    const db = makeMockDb([{ balanceAfterIdr: 50000 }]);
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

  it("rejects when balance exactly equals 0 and amount > 0", async () => {
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
});

describe("buildReversalMutations", () => {
  it("creates opposite direction mutation for an OUT original", async () => {
    const db = makeMockDb([{ balanceAfterIdr: 200000 }]);
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
    expect(r.balanceAfterIdr).toBe(300000); // 200000 + 100000
  });

  it("creates opposite direction mutation for an IN original", async () => {
    const db = makeMockDb([{ balanceAfterIdr: 150000 }]);
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
