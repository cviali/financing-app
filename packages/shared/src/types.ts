// Core types used across apps
export interface User {
  id: string;
  username: string;
  displayName: string;
  role: "admin" | "staff";
  status: "active" | "disabled";
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: string;
  name: string;
  code: string;
  description: string | null;
  status: "active" | "archived";
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  name: string;
  status: "active" | "archived";
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface Spending {
  id: string;
  projectId: string;
  categoryId: string;
  amountIdr: number;
  paymentSource: "external" | "project_petty_cash";
  pettyCashCutIdr: number;
  description: string | null;
  spendingDate: string;
  receiptObjectKey: string | null;
  receiptFileName: string | null;
  receiptContentType: string | null;
  receiptSizeBytes: number | null;
  createdBy: string;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
  voidedAt: string | null;
  voidedBy: string | null;
  voidReason: string | null;
}

export interface PettyCashMutation {
  id: string;
  projectId: string;
  spendingId: string | null;
  direction: "in" | "out";
  amountIdr: number;
  balanceAfterIdr: number;
  note: string | null;
  createdBy: string;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  actorUserId: string;
  action: string;
  entityType: string;
  entityId: string;
  beforeJson: string | null;
  afterJson: string | null;
  createdAt: string;
}

export interface ApiResponse<T> {
  data: T;
}

export interface ApiError {
  error: string;
  details?: unknown;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}
