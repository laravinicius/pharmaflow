-- PharmaFlow
-- Single source of truth for the server database schema.
-- Default admin password: admin123

CREATE DATABASE IF NOT EXISTS pharmaflow
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE pharmaflow;

CREATE TABLE IF NOT EXISTS users (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(255) NOT NULL,
  username   VARCHAR(50)  NOT NULL UNIQUE,
  password   VARCHAR(64)  NOT NULL COMMENT 'SHA-256 hex',
  role       ENUM('admin','employee') NOT NULL DEFAULT 'employee',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS customers (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(255) NOT NULL,
  phone      VARCHAR(20)  NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS insumos (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(255) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS formulas (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  customer_id     INT NOT NULL,
  customer_phone  VARCHAR(20)  NOT NULL DEFAULT '',
  pharmacist_name VARCHAR(255) NOT NULL DEFAULT '',
  budget_number   VARCHAR(6)   NOT NULL DEFAULT '',
  attendant_name  VARCHAR(255) NOT NULL DEFAULT '',
  delivery_date   DATE         NULL,
  payment_status  VARCHAR(20)  NOT NULL DEFAULT '',
  payment_method  VARCHAR(20)  NULL,
  delivery_status VARCHAR(20)  NOT NULL DEFAULT '',
  cancel_reason   TEXT         NULL,
  status          ENUM('pending','completed','confirmed','cancelled','delivered') NOT NULL DEFAULT 'pending',
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS formula_items (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  formula_id  INT           NOT NULL,
  insumo_id   INT           NOT NULL,
  quantity    DECIMAL(10,3) NOT NULL COMMENT 'quantidade',
  unit        VARCHAR(5)    NOT NULL DEFAULT 'mg' COMMENT 'g, mcg, ui, mg',
  FOREIGN KEY (formula_id)  REFERENCES formulas(id)  ON DELETE CASCADE,
  FOREIGN KEY (insumo_id)   REFERENCES insumos(id)   ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS formula_budget_items (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  formula_id  INT            NOT NULL,
  quantity    DECIMAL(10,3)  NOT NULL COMMENT 'quantidade',
  unit        VARCHAR(5)     NOT NULL DEFAULT 'caps' COMMENT 'caps, ml, g',
  value       DECIMAL(10,2)  NOT NULL DEFAULT 0 COMMENT 'valor em R$',
  is_selected TINYINT(1)     NOT NULL DEFAULT 0 COMMENT 'orçamento escolhido',
  FOREIGN KEY (formula_id) REFERENCES formulas(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS saved_formulas (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(255) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS saved_formula_items (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  saved_formula_id INT           NOT NULL,
  insumo_id        INT           NOT NULL,
  quantity         DECIMAL(10,3) NOT NULL COMMENT 'quantidade',
  unit             VARCHAR(5)    NOT NULL DEFAULT 'mg' COMMENT 'g, mcg, ui, mg',
  FOREIGN KEY (saved_formula_id) REFERENCES saved_formulas(id) ON DELETE CASCADE,
  FOREIGN KEY (insumo_id)        REFERENCES insumos(id)        ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS server_meta (
  key_name VARCHAR(64) PRIMARY KEY,
  value    VARCHAR(255) NOT NULL
) ENGINE=InnoDB;

-- Tombstones de exclusões: propaga deleções feitas em um computador para os demais
CREATE TABLE IF NOT EXISTS sync_deletes (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  table_name  VARCHAR(30) NOT NULL,
  server_id   INT         NOT NULL,
  deleted_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_sync_deletes (table_name, server_id)
) ENGINE=InnoDB;

CREATE INDEX idx_users_updated     ON users(updated_at);
CREATE INDEX idx_customers_updated ON customers(updated_at);
CREATE INDEX idx_insumos_updated ON insumos(updated_at);
CREATE INDEX idx_formulas_updated  ON formulas(updated_at);
CREATE INDEX idx_saved_formulas_updated ON saved_formulas(updated_at);
CREATE INDEX idx_sync_deletes_deleted ON sync_deletes(deleted_at);

-- Default admin user (password: admin123)
INSERT IGNORE INTO users (name, username, password, role)
VALUES ('Administrador', 'admin', '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9', 'admin');
