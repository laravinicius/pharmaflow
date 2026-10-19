# Banco de dados

MariaDB é acessado por `mysql2/promise` através de `Db` em `electron/db.ts`. `database.sql` cria banco, tabelas, índices e seed usados pelo `docker-compose.yml`.

`migrations/` contém o histórico que originou o schema consolidado, mas não há executor no runtime ou nos scripts. O fluxo atual usa `database.sql`; não criar migrations novas sem uma decisão arquitetural explícita.

## Entidades

- `users`: usuários e roles `employee`, `pharmacist`, `manager` e `admin`, nessa ordem de acesso.
- `customers`: clientes, com telefone único.
- `insumos`: matérias-primas.
- `formulas`: cliente, orçamento, pagamento, entrega e status.
- `formula_items` e `formula_budget_items`: composição e opções de orçamento.
- `saved_formulas`, `saved_formula_items`, `saved_formula_budget_items`: modelos reutilizáveis.
- `sessions`: token e `last_seen`.
- `action_logs`: auditoria.

Fórmulas pertencem a clientes; seus itens referenciam insumos; modelos salvos também referenciam insumos. Itens dependentes usam cascata, enquanto insumos em uso são protegidos por `RESTRICT` e validação da aplicação.

Uma mudança de schema normalmente exige revisar `database.sql`, `src/types.ts`, queries/payloads em `db.ts`, bridge/service e endpoint web. Consulte `database.sql` para tipos e constraints, sem duplicá-lo aqui.

## Entrega efetiva e total mensal

`formulas.delivery_date` é a previsão preenchida no formulário. `formulas.delivered_at` registra automaticamente a entrega efetiva pelo backend como `DATETIME` no fuso `America/Sao_Paulo`. O histórico usa o mês e o ano de `delivered_at` para somar os orçamentos selecionados das fórmulas pagas e entregues. Edições e operações repetidas preservam essa data; sair do andamento `entregue` limpa o registro, e uma nova entrega registra uma nova data.

Fórmulas antigas sem `delivered_at` continuam no histórico, mas não entram no total mensal. Não há recuperação automática pelos logs nem uso da previsão como aproximação. Para um banco de teste já inicializado, adicionar a coluna com `ALTER TABLE formulas ADD COLUMN IF NOT EXISTS delivered_at DATETIME NULL COMMENT 'Entrega efetiva no fuso America/Sao_Paulo, registrada pelo backend';`. Antes da implantação em produção, validar a atualização do schema e definir o tratamento das entregas antigas, preservando os dados existentes.

## Funcionário que criou a fórmula

`formulas.created_by_name` e `saved_formulas.created_by_name` guardam o nome do usuário autenticado no primeiro salvamento. O backend valida a sessão e grava o nome na mesma transação da criação, sem aceitar autoria do renderer. Edições e mudanças de status preservam esse nome, inclusive após renomear ou excluir o usuário. Repetir uma fórmula ou aplicar um modelo cria um novo registro com o funcionário que o salvar. O campo de atendente permanece independente.

As listas e os detalhes usam a autoria persistida; registros sem autoria conhecida mostram `Não identificado`. Para bancos existentes, executar o SQL abaixo antes de usar a nova versão do aplicativo. `database.sql` continua sendo a fonte do schema para instalações novas; não há atualização automática no runtime nem nova migration. Não é necessário recriar o banco ou remover volumes.

A recuperação usa o nome histórico da auditoria, sem depender de o usuário ainda existir. Só aceita exatamente um log de criação por entidade e ID, com nome preenchido e diferente de `Configuração`. Logs de edição e nomes da sessão atual não servem como evidência. O SQL pode ser repetido: só preenche autorias ausentes e preserva as datas de atualização dos registros.

```sql
USE pharmaflow;

ALTER TABLE formulas
  ADD COLUMN IF NOT EXISTS created_by_name VARCHAR(255) NULL
  COMMENT 'Nome do funcionário no momento da criação';
ALTER TABLE saved_formulas
  ADD COLUMN IF NOT EXISTS created_by_name VARCHAR(255) NULL
  COMMENT 'Nome do funcionário no momento da criação';

START TRANSACTION;

UPDATE formulas AS f
JOIN (
  SELECT entity_id, MAX(user_name) AS creator_name
  FROM action_logs
  WHERE action = 'add' AND entity = 'formulas'
  GROUP BY entity_id
  HAVING COUNT(*) = 1
     AND NULLIF(TRIM(MAX(user_name)), '') IS NOT NULL
     AND TRIM(MAX(user_name)) <> 'Configuração'
) AS creation ON creation.entity_id = f.id
SET f.created_by_name = creation.creator_name, f.updated_at = f.updated_at
WHERE NULLIF(TRIM(f.created_by_name), '') IS NULL;

UPDATE saved_formulas AS f
JOIN (
  SELECT entity_id, MAX(user_name) AS creator_name
  FROM action_logs
  WHERE action = 'add' AND entity = 'saved_formulas'
  GROUP BY entity_id
  HAVING COUNT(*) = 1
     AND NULLIF(TRIM(MAX(user_name)), '') IS NOT NULL
     AND TRIM(MAX(user_name)) <> 'Configuração'
) AS creation ON creation.entity_id = f.id
SET f.created_by_name = creation.creator_name, f.updated_at = f.updated_at
WHERE NULLIF(TRIM(f.created_by_name), '') IS NULL;

COMMIT;

SELECT 'formulas' AS tabela, COUNT(*) AS total,
       SUM(NULLIF(TRIM(created_by_name), '') IS NOT NULL) AS identificadas,
       SUM(NULLIF(TRIM(created_by_name), '') IS NULL) AS nao_identificadas
FROM formulas
UNION ALL
SELECT 'saved_formulas', COUNT(*),
       SUM(NULLIF(TRIM(created_by_name), '') IS NOT NULL),
       SUM(NULLIF(TRIM(created_by_name), '') IS NULL)
FROM saved_formulas;
```

> SECURITY: senhas atualmente usam SHA-256 sem salt. Não copie credenciais, hashes ou valores de configuração sensíveis para documentação.
