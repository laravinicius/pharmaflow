-- Fórmulas salvas: templates prontos de matérias-primas com quantidade e unidade.
-- Apply to an existing database; for a fresh database run database.sql.

CREATE TABLE IF NOT EXISTS saved_formulas (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(255) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS saved_formula_items (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  saved_formula_id INT           NOT NULL,
  material_id      INT           NOT NULL,
  quantity         DECIMAL(10,3) NOT NULL COMMENT 'quantidade',
  unit             VARCHAR(5)    NOT NULL DEFAULT 'mg' COMMENT 'g, mcg, ui, mg',
  FOREIGN KEY (saved_formula_id) REFERENCES saved_formulas(id) ON DELETE CASCADE,
  FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE INDEX idx_saved_formulas_updated ON saved_formulas(updated_at);