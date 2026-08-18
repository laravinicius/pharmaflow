-- Fórmulas "salvas" agora são "pendentes": o status 'saved' foi unificado em
-- 'pending' (ambos já eram exibidos juntos na fila). Aplicar em banco existente;
-- para um banco novo, basta rodar database.sql.

UPDATE formulas SET status = 'pending' WHERE status = 'saved';

ALTER TABLE formulas
  MODIFY COLUMN status ENUM('pending','completed','confirmed','cancelled','delivered') NOT NULL DEFAULT 'pending';