-- Migration: 0001_initial_schema
-- Finance Yanti – initial database schema

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('admin', 'staff')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  must_change_password INTEGER NOT NULL DEFAULT 1,
  last_login_at TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS users_username_idx ON users (username);

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS projects_code_idx ON projects (code);
CREATE INDEX IF NOT EXISTS projects_status_idx ON projects (status);

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS categories_name_idx ON categories (name);

CREATE TABLE IF NOT EXISTS spendings (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  category_id TEXT NOT NULL REFERENCES categories(id),
  amount_idr INTEGER NOT NULL,
  payment_source TEXT NOT NULL CHECK (payment_source IN ('external', 'project_petty_cash')),
  petty_cash_cut_idr INTEGER NOT NULL DEFAULT 0,
  description TEXT,
  spending_date TEXT NOT NULL,
  receipt_object_key TEXT,
  receipt_file_name TEXT,
  receipt_content_type TEXT,
  receipt_size_bytes INTEGER,
  created_by TEXT NOT NULL REFERENCES users(id),
  updated_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  voided_at TEXT,
  voided_by TEXT REFERENCES users(id),
  void_reason TEXT
);

CREATE INDEX IF NOT EXISTS spendings_project_idx ON spendings (project_id);
CREATE INDEX IF NOT EXISTS spendings_category_idx ON spendings (category_id);
CREATE INDEX IF NOT EXISTS spendings_date_idx ON spendings (spending_date);
CREATE INDEX IF NOT EXISTS spendings_created_by_idx ON spendings (created_by);
CREATE INDEX IF NOT EXISTS spendings_voided_idx ON spendings (voided_at);

CREATE TABLE IF NOT EXISTS petty_cash_mutations (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  spending_id TEXT REFERENCES spendings(id),
  direction TEXT NOT NULL CHECK (direction IN ('in', 'out')),
  amount_idr INTEGER NOT NULL,
  balance_after_idr INTEGER NOT NULL,
  note TEXT,
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS pcm_project_idx ON petty_cash_mutations (project_id);
CREATE INDEX IF NOT EXISTS pcm_spending_idx ON petty_cash_mutations (spending_id);
CREATE INDEX IF NOT EXISTS pcm_created_at_idx ON petty_cash_mutations (created_at);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  actor_user_id TEXT NOT NULL REFERENCES users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  before_json TEXT,
  after_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS audit_actor_idx ON audit_logs (actor_user_id);
CREATE INDEX IF NOT EXISTS audit_entity_idx ON audit_logs (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS audit_created_at_idx ON audit_logs (created_at);
