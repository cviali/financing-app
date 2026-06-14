import type { Role } from "./constants.js";

export interface UserContext {
  id: string;
  role: Role;
  status: "active" | "disabled";
}

// Projects
export const canCreateProject = (user: UserContext) => user.role === "admin";
export const canEditProject = (user: UserContext) => user.role === "admin";
export const canArchiveProject = (user: UserContext) => user.role === "admin";
export const canViewProject = (_user: UserContext) => true; // all authenticated users

// Categories
export const canCreateCategory = (user: UserContext) => user.role === "admin";
export const canEditCategory = (user: UserContext) => user.role === "admin";
export const canArchiveCategory = (user: UserContext) => user.role === "admin";

// Spendings
export const canCreateSpending = (_user: UserContext) => true; // admin + staff
export const canEditSpending = (user: UserContext, spendingCreatedBy: string) =>
  user.role === "admin" || user.id === spendingCreatedBy;
export const canVoidSpending = (user: UserContext) => user.role === "admin";
export const canViewAllSpendings = (_user: UserContext) => true;

// Users
export const canManageUsers = (user: UserContext) => user.role === "admin";
export const canCreateUser = (user: UserContext) => user.role === "admin";
export const canResetPassword = (user: UserContext) => user.role === "admin";
export const canChangeUserRole = (user: UserContext) => user.role === "admin";
export const canDisableUser = (user: UserContext) => user.role === "admin";

// Exports
export const canExport = (_user: UserContext) => true; // admin + staff

// Convenience check used in handlers
export function requireAdmin(user: UserContext): void {
  if (user.role !== "admin") {
    throw new PermissionError("Admin access required");
  }
}

export class PermissionError extends Error {
  constructor(message = "Forbidden") {
    super(message);
    this.name = "PermissionError";
  }
}
