-- Migration: 0002_remove_petty_cash_pool
-- Replace the global petty-cash pool with a per-project balance.
-- Drops paymentSource/pettyCashCutIdr from spendings; renames
-- petty_cash_mutations -> project_balance_mutations (same columns).

ALTER TABLE spendings DROP COLUMN payment_source;
--> statement-breakpoint
ALTER TABLE spendings DROP COLUMN petty_cash_cut_idr;
--> statement-breakpoint
ALTER TABLE petty_cash_mutations RENAME TO project_balance_mutations;
--> statement-breakpoint
DROP INDEX IF EXISTS pcm_project_idx;
--> statement-breakpoint
DROP INDEX IF EXISTS pcm_spending_idx;
--> statement-breakpoint
DROP INDEX IF EXISTS pcm_created_at_idx;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS pbm_project_idx ON project_balance_mutations (project_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS pbm_spending_idx ON project_balance_mutations (spending_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS pbm_created_at_idx ON project_balance_mutations (created_at);
