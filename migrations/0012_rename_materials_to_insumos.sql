-- Renomeia materiais para insumos (tabela, colunas e índice).
-- Apply to an existing database; for a fresh database run database.sql.

RENAME TABLE materials TO insumos;

ALTER TABLE formula_items CHANGE material_id insumo_id INT NOT NULL;

ALTER TABLE saved_formula_items CHANGE material_id insumo_id INT NOT NULL;

ALTER TABLE insumos RENAME INDEX idx_materials_updated TO idx_insumos_updated;