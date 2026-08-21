# PharmaFlow (Electron + Vite + React)

Aplicacao desktop para operacao de fluxo farmaceutico, com frontend em React e runtime Electron.

## Paleta de Cores

| Cor | Hex | Uso |
|-----|-----|-----|
| Vermelho (Primary) | `#C5243E` | Botões primários, destaque, links, badges ativos |
| Vermelho Escuro | `#9B1A2E` | Gradiente fim (botões vermelhos) |
| Azul (Secondary) | `#243465` | Sidebar, botões secundários, navegação |
| Azul Escuro | `#1A2850` | Gradiente fim (botões azuis) |
| Azul Claro (Farma) | `#4A90D9` | Logo "Farma", elementos informativos |
| Seleção BG | `#FED7DB` | `::selection` background |
| Seleção Texto | `#8C1A3D` | `::selection` color |

## Estrutura do Projeto

- `src/`: frontend React.
- `electron/`: processo principal e preload do Electron.
- `migrations/`: legado historico; nao faz parte do fluxo oficial de schema.
- `index.html`, `vite.config.ts`, `tsconfig.json`, `package.json`: arquivos base de build/configuracao.
- `att.txt`, `db.txt`: arquivos locais de apoio (nao versionados).
- `database.sql`: unico script SQL mantido para criacao do schema.

## Convencao da Raiz

Manter na raiz apenas arquivos de configuracao/entrada do projeto e o snapshot `database.sql`.

Arquivos locais de apoio (`att.txt` e `db.txt`) podem existir no disco, mas devem permanecer fora do versionamento.

`migrations/` fica apenas como referencia historica. O fluxo oficial de schema nao usa essa pasta.

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
