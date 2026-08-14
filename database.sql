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

CREATE TABLE IF NOT EXISTS materials (
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
  status          ENUM('pending','completed','saved','confirmed','cancelled','delivered') NOT NULL DEFAULT 'saved',
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS formula_items (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  formula_id  INT           NOT NULL,
  material_id INT           NOT NULL,
  quantity    DECIMAL(10,3) NOT NULL COMMENT 'quantidade',
  unit        VARCHAR(5)    NOT NULL DEFAULT 'mg' COMMENT 'g, mcg, ui, mg',
  FOREIGN KEY (formula_id)  REFERENCES formulas(id)  ON DELETE CASCADE,
  FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS formula_budget_items (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  formula_id INT            NOT NULL,
  quantity   DECIMAL(10,3)  NOT NULL COMMENT 'quantidade',
  unit       VARCHAR(5)     NOT NULL DEFAULT 'caps' COMMENT 'caps, ml, g',
  value      DECIMAL(10,2)  NOT NULL DEFAULT 0 COMMENT 'valor em R$',
  FOREIGN KEY (formula_id) REFERENCES formulas(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE INDEX idx_users_updated     ON users(updated_at);
CREATE INDEX idx_customers_updated ON customers(updated_at);
CREATE INDEX idx_materials_updated ON materials(updated_at);
CREATE INDEX idx_formulas_updated  ON formulas(updated_at);

-- Default admin user (password: admin123)
INSERT IGNORE INTO users (name, username, password, role)
VALUES ('Administrador', 'admin', '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9', 'admin');
