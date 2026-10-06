# Arquitetura

## Visão geral

PharmaFlow é uma aplicação desktop Electron/React conectada online a MariaDB. Não há cache local ou sincronização offline documentada.

```text
React (src/) → lanDatabase.ts
    ├─ Electron → preload.ts → IPC → electron/main.ts
                              └→ electron/db.ts → MariaDB
```

`main.ts` cria a janela, registra IPC, persiste a configuração desktop e emite `data:changed` após mutações.

## Entry points

- `src/main.tsx`: montagem React.
- `src/App.tsx`: autenticação, navegação, modo configuração e telas.
- `electron/main.ts`: processo principal e handlers IPC.
- `electron/preload.ts`: bridge com `contextIsolation` e sem `nodeIntegration`.
- `database.sql`: schema usado pelo Docker e referência operacional.

`useData` compartilha carregamentos, escuta `data:changed` no Electron e faz polling a cada 10 segundos. O build/lint está em `package.json`; não há suíte de testes configurada.

## Limites

- O renderer não importa `mysql2` ou `electron/db.ts`.
- Novo acesso de dados no Electron atravessa `main.ts` → `preload.ts` → `lanDatabase.ts`.
- Alterações de schema atualizam `database.sql`; as migrations existentes são históricas.
- Configuração desktop fica em `app.getPath('userData')/config.json`.
- Mutations preservam auditoria e a notificação `data:changed`.

> UNKNOWN: não foi encontrado CI/CD ou teste automatizado no repositório.
