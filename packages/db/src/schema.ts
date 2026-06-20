import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

// ─── Users ───────────────────────────────────────────────────────────────────

export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    username: text("username").notNull().unique(),
    displayName: text("display_name").notNull(),
    passwordHash: text("password_hash").notNull(),
    role: text("role", { enum: ["admin", "staff"] })
      .notNull()
      .default("staff"),
    status: text("status", { enum: ["active", "disabled"] })
      .notNull()
      .default("active"),
    mustChangePassword: integer("must_change_password", { mode: "boolean" })
      .notNull()
      .default(true),
    lastLoginAt: text("last_login_at"),
    createdBy: text("created_by"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (t) => [index("users_username_idx").on(t.username)],
);

// ─── Projects ────────────────────────────────────────────────────────────────

export const projects = sqliteTable(
  "projects",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    code: text("code").notNull().unique(),
    description: text("description"),
    status: text("status", { enum: ["active", "archived"] })
      .notNull()
      .default("active"),
    createdBy: text("created_by")
      .notNull()
      .references(() => users.id),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (t) => [index("projects_code_idx").on(t.code), index("projects_status_idx").on(t.status)],
);

// ─── Categories ──────────────────────────────────────────────────────────────

export const categories = sqliteTable(
  "categories",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull().unique(),
    status: text("status", { enum: ["active", "archived"] })
      .notNull()
      .default("active"),
    createdBy: text("created_by")
      .notNull()
      .references(() => users.id),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (t) => [index("categories_name_idx").on(t.name)],
);

// ─── Spendings ───────────────────────────────────────────────────────────────

export const spendings = sqliteTable(
  "spendings",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id),
    categoryId: text("category_id")
      .notNull()
      .references(() => categories.id),
    amountIdr: integer("amount_idr").notNull(),
    description: text("description"),
    spendingDate: text("spending_date").notNull(), // YYYY-MM-DD
    receiptObjectKey: text("receipt_object_key"),
    receiptFileName: text("receipt_file_name"),
    receiptContentType: text("receipt_content_type"),
    receiptSizeBytes: integer("receipt_size_bytes"),
    createdBy: text("created_by")
      .notNull()
      .references(() => users.id),
    updatedBy: text("updated_by").references(() => users.id),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(datetime('now'))`),
    voidedAt: text("voided_at"),
    voidedBy: text("voided_by").references(() => users.id),
    voidReason: text("void_reason"),
  },
  (t) => [
    index("spendings_project_idx").on(t.projectId),
    index("spendings_category_idx").on(t.categoryId),
    index("spendings_date_idx").on(t.spendingDate),
    index("spendings_created_by_idx").on(t.createdBy),
    index("spendings_voided_idx").on(t.voidedAt),
  ],
);

// ─── Project Balance Mutations ────────────────────────────────────────────────

export const projectBalanceMutations = sqliteTable(
  "project_balance_mutations",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id),
    spendingId: text("spending_id").references(() => spendings.id),
    direction: text("direction", { enum: ["in", "out"] }).notNull(),
    amountIdr: integer("amount_idr").notNull(),
    balanceAfterIdr: integer("balance_after_idr").notNull(),
    note: text("note"),
    createdBy: text("created_by")
      .notNull()
      .references(() => users.id),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (t) => [
    index("pbm_project_idx").on(t.projectId),
    index("pbm_spending_idx").on(t.spendingId),
    index("pbm_created_at_idx").on(t.createdAt),
  ],
);

// ─── Audit Logs ───────────────────────────────────────────────────────────────

export const auditLogs = sqliteTable(
  "audit_logs",
  {
    id: text("id").primaryKey(),
    actorUserId: text("actor_user_id")
      .notNull()
      .references(() => users.id),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    beforeJson: text("before_json"),
    afterJson: text("after_json"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (t) => [
    index("audit_actor_idx").on(t.actorUserId),
    index("audit_entity_idx").on(t.entityType, t.entityId),
    index("audit_created_at_idx").on(t.createdAt),
  ],
);

// ─── Inferred types ───────────────────────────────────────────────────────────

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;
export type Spending = typeof spendings.$inferSelect;
export type NewSpending = typeof spendings.$inferInsert;
export type ProjectBalanceMutation = typeof projectBalanceMutations.$inferSelect;
export type NewProjectBalanceMutation = typeof projectBalanceMutations.$inferInsert;
export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;
