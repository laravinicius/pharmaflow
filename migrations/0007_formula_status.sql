-- Formulas now use two new statuses: 'saved' (fila "Salvas") and 'confirmed'
-- (fila "Confirmadas"), replacing the old pending/completed workflow.
-- Legacy test rows are converted; for a fresh database run database.sql.

ALTER TABLE formulas
  MODIFY COLUMN status ENUM('pending','completed','saved','confirmed') NOT NULL DEFAULT 'saved';

UPDATE formulas SET status = CASE
  WHEN status = 'pending'   THEN 'saved'
  WHEN status = 'completed' THEN 'confirmed'
  ELSE status END;