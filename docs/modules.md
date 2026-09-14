# Mapa de módulos

| Módulo | Responsabilidade | Revisar junto |
|---|---|---|
| `src/App.tsx`, `src/components/` | UI, navegação e telas de negócio | contextos, hooks, tipos e `db.*` |
| `src/context/` | autenticação e rascunhos transversais | `App.tsx` e consumidores |
| `src/hooks/useData.ts` | polling e reação a `data:changed` | `main.ts` e telas dependentes |
| `src/services/lanDatabase.ts` | cliente tipado e contrato `window.electronAPI` | preload e IPC |
| `electron/main.ts` | entrypoint Electron e handlers IPC | preload e `db.ts` |
| `electron/preload.ts` | ponte segura do renderer | `lanDatabase.ts` e nomes dos canais |
| `electron/db.ts` | SQL, transações, autorização, sessões e auditoria | `database.sql` e handlers |
| `database.sql` | schema recreável | todos os métodos SQL afetados |
| `web-server/index.ts` | API HTTP auxiliar de desenvolvimento | `electron/db.ts` e clientes web |
| `config/branding.ts` | identidade visual e tokens de cor | CSS e componentes |

## Domínios e impacto

- Usuários/sessões/auditoria: `users`, `sessions`, `action_logs`.
- Clientes e insumos: `customers`, `insumos`; fórmulas dependem deles.
- Fórmulas: `formulas`, `formula_items`, `formula_budget_items`.
- Templates: `saved_formulas`, `saved_formula_items`, `saved_formula_budget_items`.

Para uma operação de dados, siga componente → `lanDatabase.ts` → preload → handler → `Db` → schema e verifique `useData`/`data:changed`. Não há testes automatizados identificados; a verificação disponível é `npm run lint`.
