import { describe, it, expect } from "vitest";
import { usernameSchema, passwordSchema, createSpendingSchema } from "../index.js";

describe("usernameSchema", () => {
  it("accepts valid usernames", () => {
    expect(usernameSchema.parse("admin")).toBe("admin");
    expect(usernameSchema.parse("john.doe_123")).toBe("john.doe_123");
    expect(usernameSchema.parse("a-b")).toBe("a-b");
  });

  it("rejects uppercase", () => expect(() => usernameSchema.parse("Admin")).toThrow());
  it("rejects too short", () => expect(() => usernameSchema.parse("ab")).toThrow());
  it("rejects too long", () => expect(() => usernameSchema.parse("a".repeat(33))).toThrow());
  it("rejects spaces", () => expect(() => usernameSchema.parse("john doe")).toThrow());
  it("rejects special chars", () => expect(() => usernameSchema.parse("john@doe")).toThrow());
});

describe("passwordSchema", () => {
  it("accepts 10+ char password", () =>
    expect(passwordSchema.parse("abcde12345")).toBe("abcde12345"));
  it("rejects short password", () => expect(() => passwordSchema.parse("short")).toThrow());
});

describe("createSpendingSchema", () => {
  const base = {
    projectId: "p1",
    categoryId: "c1",
    amountIdr: 100000,
    spendingDate: "2026-06-14",
  };

  it("accepts a valid spending", () =>
    expect(() => createSpendingSchema.parse(base)).not.toThrow());

  it("rejects negative amount", () =>
    expect(() => createSpendingSchema.parse({ ...base, amountIdr: -1 })).toThrow());

  it("rejects float amount", () =>
    expect(() => createSpendingSchema.parse({ ...base, amountIdr: 100.5 })).toThrow());

  it("rejects missing projectId", () =>
    expect(() => createSpendingSchema.parse({ ...base, projectId: "" })).toThrow());
});
