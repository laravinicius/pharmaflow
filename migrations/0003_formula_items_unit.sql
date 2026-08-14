-- Ingredient rows now carry a unit of measure (g, mcg, ui, mg).
-- Apply to an existing database; for a fresh database run database.sql.

ALTER TABLE formula_items ADD COLUMN unit VARCHAR(5) NOT NULL DEFAULT 'mg' COMMENT 'g, mcg, ui, mg';