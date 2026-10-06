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
- Configuração desktop fica no diretório próprio do perfil (`userData/config.json`); a PIX preserva `%APPDATA%/pharmaflow`.
- Mutations preservam auditoria e a notificação `data:changed`.

## Perfis e distribuição

`config/clients/` define os perfis tipados. `config/branding.ts` expõe a fachada da marca selecionada no build para React e Electron. Assets temporários e bundles ficam em `.client-build/<perfil>`; instaladores e metadados ficam em `release/<perfil>/<versão>`.

O CI verifica TypeScript, constrói os dois perfis e confere seus pacotes. Tags `v*` publicam exclusivamente PIX Farma; um workflow manual publica os demais perfis a partir de um SHA selecionado e para repositórios de distribuição separados. Detalhes, referências de recuperação e limites da validação: [white-label.md](white-label.md).
