-- Tombstones de exclusões: registra deleções para propagá-las aos outros computadores.
-- O push continua apagando fisicamente no servidor, mas antes grava o tombstone aqui;
-- o pull dos demais clientes consulta esta tabela e remove o registro localmente.
-- Apply to an existing database; for a fresh database run database.sql.

CREATE TABLE IF NOT EXISTS sync_deletes (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  table_name  VARCHAR(30) NOT NULL,
  server_id   INT         NOT NULL,
  deleted_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_sync_deletes (table_name, server_id)
) ENGINE=InnoDB;

CREATE INDEX idx_sync_deletes_deleted ON sync_deletes(deleted_at);