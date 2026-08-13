-- Customers are now identified by phone (unique) instead of CPF.
-- Apply to an existing database; for a fresh database run database.sql.

ALTER TABLE customers DROP COLUMN cpf;
ALTER TABLE customers MODIFY phone VARCHAR(20) NOT NULL;
ALTER TABLE customers ADD UNIQUE INDEX uq_customers_phone (phone);