-- Sessões de login único: garante que um usuário só fica logado em uma máquina.
-- O app mantém a sessão viva com heartbeat (30s); sessões inativas expiram.
-- Apply to an existing database; for a fresh database run database.sql.

CREATE TABLE IF NOT EXISTS sessions (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  user_id    INT          NOT NULL,
  token      VARCHAR(64)  NOT NULL UNIQUE,
  last_seen  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_sessions_last_seen ON sessions(last_seen);
