-- Confirmed formulas gain a delivery/production progress (delivery_status:
-- em_producao, aguardando_retirada, aguardando_envio, entregue) and an optional
-- cancellation reason. New statuses 'cancelled' and 'delivered' were added.
-- Apply to an existing database; for a fresh database run database.sql.

ALTER TABLE formulas
  MODIFY COLUMN status ENUM('pending','completed','saved','confirmed','cancelled','delivered') NOT NULL DEFAULT 'saved';

ALTER TABLE formulas ADD COLUMN delivery_status VARCHAR(20) NOT NULL DEFAULT '';
ALTER TABLE formulas ADD COLUMN cancel_reason TEXT NULL;