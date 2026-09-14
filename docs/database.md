# Banco de dados

O acesso usa `mysql2/promise` e pool no processo principal. `database.sql` é a fonte da verdade e recria o banco. `migrations/` é histórico legado; não criar migrations novas.

## Entidades

`users` (`admin`/`employee`), `customers`, `insumos`, `formulas` e seus itens, `saved_formulas` e seus itens, `sessions` e `action_logs`.

Fórmulas referenciam clientes; seus itens referenciam insumos. Itens são removidos em cascata com a fórmula, enquanto insumos referenciados usam restrição. O mesmo padrão vale para templates salvos. Clientes e insumos têm unicidade operacional.

## Regras de impacto

- Alterações de tabelas, enums, índices ou foreign keys exigem atualizar `database.sql` e revisar `electron/db.ts`, tipos, IPC e consumidores.
- Mutations devem preservar autorização de sessão/administrador e auditoria quando aplicável.
- Senhas atualmente usam SHA-256 hex em `electron/db.ts`; isso é uma limitação existente, não um padrão recomendado para novos sistemas.
- O schema contém provisionamento inicial administrativo: não reproduzir credenciais ou hashes em documentação e rotacionar no provisionamento.
