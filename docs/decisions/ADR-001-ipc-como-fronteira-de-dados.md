# ADR-001 — IPC como fronteira de acesso ao banco

## Contexto

O renderer executa a interface e não deve carregar credenciais nem acessar MariaDB diretamente.

## Decisão

Todo acesso passa por `lanDatabase.ts`, `preload.ts` e handlers IPC em `main.ts`; queries ficam em `electron/db.ts`.

## Motivo

Centraliza credenciais, autorização, transações e efeitos de mutação no processo principal, mantendo uma API explícita para a UI.

## Consequências

Novas operações exigem alterações coordenadas nas camadas e manutenção do contrato IPC.

## Status

Accepted
