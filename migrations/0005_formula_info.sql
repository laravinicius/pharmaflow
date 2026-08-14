-- Formulas now carry delivery info: the PM attendant name and the delivery date.
-- Apply to an existing database; for a fresh database run database.sql.

ALTER TABLE formulas ADD COLUMN attendant_name VARCHAR(255) NOT NULL DEFAULT '';
ALTER TABLE formulas ADD COLUMN delivery_date DATE NULL;