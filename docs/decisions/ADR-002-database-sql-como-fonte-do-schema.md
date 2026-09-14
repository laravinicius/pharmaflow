# ADR-002 — `database.sql` como fonte do schema

## Contexto

Existe histórico em `migrations/`, mas o banco é recriado a partir de um schema consolidado.

## Decisão

`database.sql` é a única fonte versionada do estado atual; não criar migrations novas.

## Motivo

Mantém o provisionamento reproduzível no fluxo atual e evita divergência com o histórico legado.

## Consequências

Alterações de schema devem atualizar o script completo e todos os consumidores SQL relacionados.

## Status

Accepted
