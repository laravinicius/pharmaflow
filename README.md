# PharmaFlow (Electron + Vite + React)

Aplicacao desktop para operacao de fluxo farmaceutico, com frontend em React e runtime Electron.

## Estrutura do Projeto

- `src/`: frontend React.
- `electron/`: processo principal e preload do Electron.
- `database/`: documentacao e convencoes do banco.
- `index.html`, `vite.config.ts`, `tsconfig.json`, `package.json`: arquivos base de build/configuracao.
- `att.txt`, `db.txt`: arquivos locais de apoio (nao versionados).
- `database.sql`: unico script SQL mantido para criacao do schema.

## Convencao da Raiz

Manter na raiz apenas arquivos de configuracao/entrada do projeto e o snapshot `database.sql`.

Arquivos locais de apoio (`att.txt` e `db.txt`) podem existir no disco, mas devem permanecer fora do versionamento.

Artefatos gerados por build nao devem ser versionados:

- `dist/`
- `dist-electron/`
- `release/`

## Fluxo de Banco de Dados

Este projeto usa apenas um arquivo SQL para criacao do banco:

- `database.sql` na raiz: script unico e atualizado do schema.

Regra para toda alteracao no banco:

1. Atualizar somente `database.sql`.
2. Manter o arquivo alinhado com o schema usado pelo app.

## Executar Localmente

Pre-requisito: Node.js 20+

0. A conexao com o banco nao usa `DB_*` no ambiente; ela e salva no desktop
   via tela de configuracao e persistida no `userData/config.json`.
   - O acesso especial para abrir essa tela usa o login fixo `admin / admin123`.

1. Instalar dependencias:
   `npm install`
2. Subir ambiente de desenvolvimento:
   `npm run dev`

## Build

Gerar pacote de producao:

`npm run build`

Observacao: no Windows, o build gera um pacote `dir` offline-friendly em vez de
um instalador NSIS, para evitar downloads de binarios externos durante o empacotamento.
