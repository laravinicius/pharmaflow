-- PharmaFlow
-- Single source of truth for the server database schema.
-- Reconstructed from migrations 0001-0020 (migration_final.sql) — reflects
-- the actual final state of the schema, not a hand-maintained snapshot.
--
-- SECURITY: the seeded admin credential below is a REAL password that has
-- been exposed in plaintext in migration history. Rotate it immediately
-- after first login regardless of running this script. Long-term: stop
-- hardcoding real credentials in versioned SQL; generate a random
-- one-time password at provisioning and force a change on first login.
-- Also consider migrating password storage from plain SHA-256 to
-- bcrypt/argon2id (salted, slow hash) — see review notes.

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
  phone      VARCHAR(20)  NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_customers_phone (phone)
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
  attendant_name  VARCHAR(255) NOT NULL DEFAULT '',
  budget_number   VARCHAR(6)   NOT NULL DEFAULT '',
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
  FOREIGN KEY (formula_id) REFERENCES formulas(id) ON DELETE CASCADE,
  FOREIGN KEY (insumo_id)  REFERENCES insumos(id)  ON DELETE RESTRICT
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
  id            INT AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(255) NOT NULL UNIQUE,
  budget_number VARCHAR(6)   NULL,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
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

CREATE TABLE IF NOT EXISTS saved_formula_budget_items (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  saved_formula_id INT            NOT NULL,
  quantity         DECIMAL(10,3)  NOT NULL COMMENT 'quantidade',
  unit             VARCHAR(5)     NOT NULL DEFAULT 'caps' COMMENT 'caps, dose, g, ml',
  value            DECIMAL(10,2)  NOT NULL DEFAULT 0 COMMENT 'valor em R$',
  FOREIGN KEY (saved_formula_id) REFERENCES saved_formulas(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS sessions (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  user_id    INT          NOT NULL,
  token      VARCHAR(64)  NOT NULL UNIQUE,
  last_seen  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Indexes
CREATE INDEX idx_users_updated     ON users(updated_at);
CREATE INDEX idx_customers_updated ON customers(updated_at);
CREATE INDEX idx_insumos_updated   ON insumos(updated_at);
CREATE INDEX idx_formulas_updated  ON formulas(updated_at);
CREATE INDEX idx_saved_formulas_updated ON saved_formulas(updated_at);

CREATE INDEX idx_formula_items_formula_id ON formula_items(formula_id);
CREATE INDEX idx_formula_items_insumo_id  ON formula_items(insumo_id);
CREATE INDEX idx_formula_budget_items_formula_id ON formula_budget_items(formula_id);
CREATE INDEX idx_saved_formula_items_saved_formula_id ON saved_formula_items(saved_formula_id);
CREATE INDEX idx_saved_formula_items_insumo_id ON saved_formula_items(insumo_id);
CREATE INDEX idx_saved_formula_budget_items_saved_formula_id ON saved_formula_budget_items(saved_formula_id);

CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_sessions_last_seen ON sessions(last_seen);

-- Seed admin user (matches migration 0001_create_admin_user.sql)
-- ROTATE THIS PASSWORD after first deployment — see security note at top of file.
INSERT IGNORE INTO users (name, username, password, role)
VALUES (
  'Administrador',
  'administrador',
  '131e106e665d164d6ad066cde74382bcf304667766eba93562128dc4da1a4ec4',
  'admin'
);