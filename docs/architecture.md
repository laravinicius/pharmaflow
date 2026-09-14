# Arquitetura

## Visão geral

Aplicação Electron desktop online-first para manipulação farmacêutica. O estado persistente fica em MariaDB/MySQL; não há cache local ou sincronização offline.

```text
React (src/) → lanDatabase.ts → preload/contextBridge → main.ts (IPC) → db.ts → MariaDB
                                                        └→ data:changed para as janelas
```

O renderer concentra UI e estado de tela. O processo principal concentra banco, autorização, IPC e ciclo de vida da janela.

## Entrypoints e responsabilidades

- `src/main.tsx`: inicialização React.
- `src/App.tsx`: autenticação, layout, navegação e sessão.
- `electron/main.ts`: pool MariaDB, handlers IPC, janela, heartbeat e saída.
- `electron/preload.ts`: única ponte `window.electronAPI`.
- `electron/db.ts`: queries, transações, hash, sessões e auditoria.
- `web-server/index.ts`: servidor Express auxiliar para desenvolvimento web; não é o caminho do build Electron.

## Fluxo e infraestrutura

Componentes/hooks usam `db.*` em `src/services/lanDatabase.ts`. O preload encaminha IPC, `main.ts` chama `Db` e mutações emitem `data:changed`; `src/hooks/useData.ts` também faz polling. Configuração de conexão é salva pelo processo principal em `userData/config.json`.

`vite.config.ts` integra Vite/Electron e `electron-builder` empacota Windows. `docker-compose.yml` apoia infraestrutura local.

> TODO: não foi localizado workflow de CI/CD versionado; confirmar o processo oficial se necessário.
