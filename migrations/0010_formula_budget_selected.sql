-- Marks which budget item was chosen in a pending formula, so the selection
-- survives reopen and server sync. Apply to an existing database; for a fresh
-- database run database.sql.

ALTER TABLE formula_budget_items ADD COLUMN is_selected TINYINT(1) NOT NULL DEFAULT 0;