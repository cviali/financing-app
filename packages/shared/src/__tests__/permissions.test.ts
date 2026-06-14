import { describe, it, expect } from "vitest";
import {
  canCreateProject,
  canEditSpending,
  canVoidSpending,
  canManageUsers,
  canExport,
  requireAdmin,
  PermissionError,
} from "../permissions.js";
import type { UserContext } from "../permissions.js";

const admin: UserContext = { id: "u1", role: "admin", status: "active" };
const staff: UserContext = { id: "u2", role: "staff", status: "active" };
const disabledAdmin: UserContext = { id: "u3", role: "admin", status: "disabled" };

describe("Project permissions", () => {
  it("admin can create projects", () => expect(canCreateProject(admin)).toBe(true));
  it("staff cannot create projects", () => expect(canCreateProject(staff)).toBe(false));
});

describe("Spending permissions", () => {
  it("admin can edit any spending", () => expect(canEditSpending(admin, "u99")).toBe(true));
  it("staff can edit own spending", () => expect(canEditSpending(staff, "u2")).toBe(true));
  it("staff cannot edit another user's spending", () => expect(canEditSpending(staff, "u99")).toBe(false));
  it("only admin can void spending", () => {
    expect(canVoidSpending(admin)).toBe(true);
    expect(canVoidSpending(staff)).toBe(false);
  });
});

describe("User management permissions", () => {
  it("admin can manage users", () => expect(canManageUsers(admin)).toBe(true));
  it("staff cannot manage users", () => expect(canManageUsers(staff)).toBe(false));
});

describe("Export permissions", () => {
  it("admin can export", () => expect(canExport(admin)).toBe(true));
  it("staff can export", () => expect(canExport(staff)).toBe(true));
});

describe("requireAdmin", () => {
  it("does not throw for admin", () => expect(() => requireAdmin(admin)).not.toThrow());
  it("throws PermissionError for staff", () =>
    expect(() => requireAdmin(staff)).toThrow(PermissionError));
});
