# Autenticação e autorização

`AuthContext` mantém usuário e token em memória. `db.auth.login` usa IPC no Electron ou `POST /api/auth/login` no web. O backend valida o usuário, cria uma linha em `sessions` e devolve um token; mutações o enviam ao backend e o frontend mantém heartbeat.

Há uma sessão ativa por usuário. Login concorrente retorna conflito; `force` encerra a sessão anterior. Sessões obsoletas são removidas periodicamente e logout revoga o token.

Roles são `admin` e `employee`. Administração é ocultada na UI para funcionários, mas operações sensíveis também são verificadas no backend por `checkAdminAccess` em `electron/db.ts`. O fluxo especial de configuração retorna `setupMode` e limita a interface a Settings; suas credenciais não devem ser documentadas.

Ao alterar autenticação, revise `AuthContext.tsx`, `App.tsx`, `electron/main.ts`, `electron/db.ts`, `preload.ts` e `lanDatabase.ts`. Mudanças de sessão precisam preservar heartbeat, TTL, login forçado e auditoria.

> UNKNOWN: não há middleware HTTP separado; as rotas delegam a validação dos tokens aos métodos de `Db`.
