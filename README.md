# PharmaFlow (Electron + Vite + React)

Aplicacao desktop para operacao de fluxo farmaceutico, com frontend em React e runtime Electron.

## Estrutura do Projeto

- `src/`: frontend React.
- `electron/`: processo principal e preload do Electron.
- `database/`: documentacao e convencoes do banco.
- `migrations/`: migracoes incrementais de SQL.
- `index.html`, `vite.config.ts`, `tsconfig.json`, `package.json`: arquivos base de build/configuracao.
- `att.txt`, `db.txt`: arquivos locais de apoio (nao versionados).
- `database.sql`: snapshot completo mais recente do schema.

## Convencao da Raiz

Manter na raiz apenas arquivos de configuracao/entrada do projeto e o snapshot `database.sql`.

Arquivos locais de apoio (`att.txt` e `db.txt`) podem existir no disco, mas devem permanecer fora do versionamento.

Artefatos gerados por build nao devem ser versionados:

- `dist/`
- `dist-electron/`
- `release/`

## Fluxo de Banco de Dados

Este projeto usa dois formatos em paralelo:

- `database.sql` na raiz: versao completa mais recente do schema.
- `migrations/*.sql`: alteracoes incrementais por mudanca.

Regra para toda alteracao no banco:

1. Criar uma nova migration numerada em `migrations/`.
2. Aplicar apenas o delta na migration.
3. Atualizar `database.sql` com a versao completa atualizada.

Baseline inicial:

- `migrations/0001_initial_schema.sql`

## Executar Localmente

Pre-requisito: Node.js 20+

0. Configurar variaveis de ambiente (base em `.env.example`), principalmente:
   - `SETUP_MASTER_USERNAME`
   - `SETUP_MASTER_PASSWORD`
   - A conexao com o banco nao usa `DB_*` no ambiente; ela e salva no desktop
     via tela de configuracao e persistida no `userData/config.json`.

1. Instalar dependencias:
   `npm install`
2. Subir ambiente de desenvolvimento:
   `npm run dev`

## Build

Gerar pacote de producao:

`npm run build`

Observacao: no Windows, o build gera um pacote `dir` offline-friendly em vez de
um instalador NSIS, para evitar downloads de binarios externos durante o empacotamento.
