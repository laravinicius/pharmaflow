# Banco de dados

MariaDB é acessado por `mysql2/promise` através de `Db` em `electron/db.ts`. `database.sql` cria banco, tabelas, índices e seed usados pelo `docker-compose.yml`.

`migrations/` contém o histórico que originou o schema consolidado, mas não há executor no runtime ou nos scripts. O fluxo atual usa `database.sql`; não criar migrations novas sem uma decisão arquitetural explícita.

## Entidades

- `users`: usuários e roles `admin`/`employee`.
- `customers`: clientes, com telefone único.
- `insumos`: matérias-primas.
- `formulas`: cliente, orçamento, pagamento, entrega e status.
- `formula_items` e `formula_budget_items`: composição e opções de orçamento.
- `saved_formulas`, `saved_formula_items`, `saved_formula_budget_items`: modelos reutilizáveis.
- `sessions`: token e `last_seen`.
- `action_logs`: auditoria.

Fórmulas pertencem a clientes; seus itens referenciam insumos; modelos salvos também referenciam insumos. Itens dependentes usam cascata, enquanto insumos em uso são protegidos por `RESTRICT` e validação da aplicação.

Uma mudança de schema normalmente exige revisar `database.sql`, `src/types.ts`, queries/payloads em `db.ts`, bridge/service e endpoint web. Consulte `database.sql` para tipos e constraints, sem duplicá-lo aqui.

> SECURITY: senhas atualmente usam SHA-256 sem salt. Não copie credenciais, hashes ou valores de configuração sensíveis para documentação.
