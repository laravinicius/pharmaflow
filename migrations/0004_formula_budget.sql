-- Formulas now carry a budget (orçamento): a budget number and budget items
-- (quantity + unit 'caps/ml/g' + value in R$).
-- Apply to an existing database; for a fresh database run database.sql.

ALTER TABLE formulas ADD COLUMN budget_number VARCHAR(6) NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS formula_budget_items (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  formula_id INT            NOT NULL,
  quantity   DECIMAL(10,3)  NOT NULL COMMENT 'quantidade',
  unit       VARCHAR(5)     NOT NULL DEFAULT 'caps' COMMENT 'caps, ml, g',
  value      DECIMAL(10,2)  NOT NULL DEFAULT 0 COMMENT 'valor em R$',
  FOREIGN KEY (formula_id) REFERENCES formulas(id) ON DELETE CASCADE
) ENGINE=InnoDB;