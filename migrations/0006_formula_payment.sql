-- Formulas now carry payment info: payment status
-- (pago, parcial, nao_pago, pagar_na_retirada) and optional payment method
-- (cartao, dinheiro, pix).
-- Apply to an existing database; for a fresh database run database.sql.

ALTER TABLE formulas ADD COLUMN payment_status VARCHAR(20) NOT NULL DEFAULT '';
ALTER TABLE formulas ADD COLUMN payment_method VARCHAR(20) NULL;