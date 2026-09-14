# Autenticação e autorização

`src/App.tsx` coleta login e chama `db.auth.login`; a chamada passa por `lanDatabase.ts`, preload e `auth:login` em `electron/main.ts`, que delega o login normal a `Db.login`.

O login normal cria token em `sessions`. `AuthContext` mantém usuário/token; o renderer envia heartbeat, pode solicitar force login em caso de conflito e revoga a sessão no logout. O servidor limpa sessões antigas e a UI também encerra por inatividade.

Os papéis são `admin` e `employee`. Operações administrativas e exclusões sensíveis validam sessão ou credenciais administrativas no processo principal/DB; o renderer não é fronteira de segurança.

O login-mestre de primeira configuração ativa `setupMode` e restringe a UI a Settings. Fechamento e logout passam por confirmação IPC (`app:confirm-exit` / `app:exit-confirmed`). Não registrar os valores das credenciais na documentação.

Ao alterar autenticação, revisar `App.tsx`, `AuthContext.tsx`, `electron/main.ts`, `electron/db.ts`, `preload.ts` e `lanDatabase.ts`.
