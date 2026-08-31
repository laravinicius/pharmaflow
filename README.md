# PharmaFlow (PIX Farma)

![Version](https://img.shields.io/badge/version-0.0.1-blue)
![Node](https://img.shields.io/badge/Node-20%2B-green)
![Electron](https://img.shields.io/badge/Electron-33-blue)
![React](https://img.shields.io/badge/React-19-61dafb)
![Vite](https://img.shields.io/badge/Vite-6-646cff)
![Tailwind](https://img.shields.io/badge/Tailwind_CSS-v4-06b6d4)
![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue)
![MariaDB](https://img.shields.io/badge/MariaDB-10%2B-0064a5)
![License](https://img.shields.io/badge/License-MIT-yellow)

Aplicação desktop online-first para gerenciamento de fluxo de manipulação farmacêutica. Construída com Electron, Vite, React 19 e Tailwind CSS v4, com persistência de dados em MariaDB/MySQL — sem cache local ou sincronização offline.

> **Nome do produto:** PIX Farma (exibido na barra de título e instalador)  
> **Nome do repositório:** PharmaFlow

---

## Capturas de Tela

As capturas de tela da aplicação podem ser adicionadas ao diretório `docs/screenshots/`:

- `dashboard.png` — Dashboard com estatísticas
- `recipe.png` — Tela Nova Fórmula
- `admin.png` — Painel Administração
- `customers.png` — Gestão de Clientes
- `insumos.png` — Gestão de Insumos
- `saved-formulas.png` — Fórmulas Salvas
- `settings.png` — Configurações de conexão DB
- `login.png` — Tela de login

Tamanho recomendado: 1280x800 (resolução padrão da janela). Formato: PNG ou WebP.

---

## Principais Funcionalidades

| Módulo | Descrição |
|--------|-----------|
| Dashboard | Visão geral com estatísticas em tempo real (fórmulas totais, pendentes, confirmadas, clientes, insumos) e ações rápidas |
| Nova Fórmula | Criação de fórmulas com cliente, atendente, orçamento, insumos (quantidade + unidade), itens de orçamento (cápsulas/ml/g + valor), data de entrega, pagamento |
| Pendentes | Lista de fórmulas aguardando confirmação; confirmação exige preenchimento de campos obrigatórios |
| Confirmadas | Fórmulas confirmadas para manipulação (status confirmed / completed); controle de andamento: em_producao, aguardando_retirada, aguardando_envio, entregue |
| Histórico | Fórmulas canceladas e entregues; filtro por status; ação Repetir para criar nova fórmula baseada em anterior |
| Clientes | CRUD completo com telefone único; busca e paginação |
| Insumos | CRUD de insumos (matérias-primas) com nome único |
| Fórmulas Salvas | Templates reutilizáveis (nome, número orçamento, insumos, itens de orçamento) |
| Administração (admin) | Gestão de usuários (admin/employee), troca de senha, exclusão com confirmação de credenciais admin |
| Configurações | Conexão MariaDB (host, porta, usuário, senha, database) salva em userData/config.json; teste de conexão |
| Autenticação | Login com detecção de sessão ativa em outro dispositivo (force login); logout por inatividade (5 min); heartbeat 30s |

---

## Stack Tecnológico

| Camada | Tecnologia | Versão |
|--------|------------|--------|
| Runtime | Electron | 33.x |
| Frontend | React | 19.x |
| Build Tool | Vite | 6.x |
| Estilização | Tailwind CSS | v4 (via @tailwindcss/vite) |
| Linguagem | TypeScript | 5.8.x |
| Banco de Dados | MariaDB / MySQL | 10+ / 8+ |
| Driver DB | mysql2 | 3.18.x |
| Animações | motion (framer-motion) | 12.x |
| Ícones | lucide-react | 0.546.x |
| Empacotamento | electron-builder | 25.x |
| Lint/Typecheck | tsc --noEmit | — |

---

## Arquitetura

### Fluxo de Dados (3 Camadas — Renderer nunca acessa o DB diretamente)

```
┌──────────────────┐     IPC      ┌──────────────────┐     Pool MySQL     ┌─────────────┐
│  React (Renderer) │ ◄──────────► │ electron/main.ts  │ ◄───────────────► │  MariaDB    │
│  src/services/   │              │  ipcMain.handle  │                    │  (pharmaflow)│
│  lanDatabase.ts  │              │  electron/preload │                    │             │
└──────────────────┘   contextBridge ┴──────────────────┘                    └─────────────┘
       │
       ▼
┌──────────────────┐
│   useData Hook   │  ← Polling 10s + Evento 'data:changed' broadcast
└──────────────────┘
```

1. **electron/main.ts** — Handlers ipcMain.handle para cada operação (auth, users, customers, insumos, formulas, savedFormulas, config)
2. **electron/preload.ts** — contextBridge.exposeInMainWorld('electronAPI', {...}) expõe API tipada para o renderer
3. **src/services/lanDatabase.ts** — Camada tipada db.* (db.auth.login, db.formulas.list, etc.) consumida pelos componentes React

### Path Alias
- @/* resolve para raiz do repositório (não src/)

---

## Banco de Dados

### Schema (database.sql — Single Source of Truth)

```sql
-- Tabelas principais
users              -- id, name, username, password (SHA-256 hex), role (admin/employee)
customers          -- id, name, phone (UNIQUE)
insumos            -- id, name (UNIQUE)
formulas           -- id, customer_id, customer_phone, attendant_name, budget_number,
                   -- delivery_date, payment_status, payment_method, delivery_status,
                   -- cancel_reason, status (pending/completed/confirmed/cancelled/delivered)
formula_items      -- id, formula_id, insumo_id, quantity (DECIMAL 10,3), unit (g/mcg/ui/mg)
formula_budget_items -- id, formula_id, quantity, unit (caps/ml/g), value, is_selected
saved_formulas     -- id, name (UNIQUE), budget_number
saved_formula_items -- id, saved_formula_id, insumo_id, quantity, unit
saved_formula_budget_items -- id, saved_formula_id, quantity, unit, value
sessions           -- id, user_id, token (UNIQUE), last_seen
```

> **Regra:** Toda alteração de schema → atualize apenas database.sql. Não há arquivos de migração versionados; o banco é recriado do zero a partir desse arquivo.

### Credenciais Iniciais (Setup Mode)
- **Usuário:** admin / admin123 (apenas para primeira configuração do banco)
- Ao logar com essas credenciais → setupMode: true → apenas a tela Configurações fica visível
- Configure a conexão MariaDB, teste, salve → reinicie o app → login normal

---

## Autenticação e Sessão

| Recurso | Detalhes |
|---------|----------|
| Hash de senha | SHA-256 hex (função hash() em electron/db.ts) |
| Roles | admin (acesso total + admin panel) / employee (operações padrão) |
| Heartbeat | Cliente envia a cada 30s (db.auth.heartbeat); servidor valida token |
| Limpeza servidor | Job a cada 60s remove sessões com last_seen > 120s (TTL 2 min) |
| Force Login | Se usuário já logado em outro dispositivo → retorna conflict: true; passe force: true para derrubar sessão anterior |
| Inatividade | Sem interação (mouse/teclado/click/touch) por 5 min → logout automático |
| Sessão única | Apenas 1 sessão ativa por usuário (exceto force login) |

---

## Modo Setup (Primeira Execução)

1. Abra o app → tela de login
2. Entre com admin / admin123
3. App entra em Setup Mode (indicador visual "Modo Configuração" na sidebar)
4. Apenas Configurações acessível → preencha host/porta/usuário/senha/database do MariaDB
5. Clique Testar Conexão → Salvar
6. Reinicie o app → login normal com usuários criados no painel Admin

---

## Confirmação de Saída

- Fechar janela ou Sair da conta → modal nativo Electron bloqueia a ação
- Usuário deve confirmar no modal (Sim, sair / Cancelar)
- IPC: app:confirm-exit (main → renderer) / app:exit-confirmed (renderer → main)
- Previne fechamento acidental com trabalho não salvo

---

## Paleta de Cores (Valores Exatos)

Definidos em src/components/Logo.tsx — use hex ou constantes, NÃO red-500/blue-500 do Tailwind.

| Constante | Hex | Uso |
|-----------|-----|-----|
| PRIMARY (vermelho) | #C5243E | Botões primários, destaque, links, badges ativos |
| PRIMARY_DARK | #9B1A2E | Fim do gradiente botões vermelhos |
| SECONDARY (azul) | #243465 | Sidebar, botões secundários, navegação |
| SECONDARY_DARK | #1A2850 | Fim do gradiente botões azuis |
| FARMA_COLOR (azul claro) | #4A90D9 | Logo "Farma", elementos informativos |

### Gradientes (usar inline style={{}})

```css
/* Botão vermelho */
background: linear-gradient(135deg, #C5243E, #9B1A2E);

/* Botão azul */
background: linear-gradient(135deg, #243465, #1A2850);
```

### Cores de Apoio

| Contexto | Background | Border | Texto |
|----------|------------|--------|-------|
| Vermelho claro | #FEF0F2 | #FED7DB | #C5243E |
| Azul claro | #EFF2FA | #D0DCE8 | #243465 |
| Seleção (::selection) | #FED7DB | — | #8C1A3D |
| Nav item ativo | — | — | text-amber-400 (#FBBF24) |

---

## Estrutura do Projeto

```
pharmaflow/
├── electron/              # Processo principal Electron
│   ├── main.ts           # IPC handlers, DB pool, window management
│   ├── preload.ts        # contextBridge → window.electronAPI
│   ├── db.ts             # Classe Db (queries SQL + hash)
│   └── dbError.ts        # Formatação de erros MySQL
├── src/
│   ├── components/       # Componentes React (UI)
│   │   ├── Logo.tsx      # Logo + constantes de cor
│   │   ├── NavItem.tsx   # Item de navegação (sidebar)
│   │   ├── Dashboard.tsx
│   │   ├── RecipeForm.tsx
│   │   ├── FormulaList.tsx
│   │   ├── CustomerManager.tsx
│   │   ├── InsumoManager.tsx
│   │   ├── SavedFormulaManager.tsx
│   │   ├── UserManager.tsx (AdminPanel)
│   │   ├── SettingsManager.tsx
│   │   └── ...
│   ├── context/
│   │   └── AuthContext.tsx  # Provider de autenticação
│   ├── hooks/
│   │   └── useData.ts       # Hook de dados (polling + data:changed)
│   ├── services/
│   │   └── lanDatabase.ts   # API tipada db.* → electronAPI
│   ├── types.ts            # Interfaces TypeScript (User, Formula, etc.)
│   ├── utils/
│   │   ├── format.ts       # Formatação de moeda, data, telefone
│   │   └── perf.ts         # Utilitários de performance
│   ├── App.tsx             # App principal (roteamento, layout, auth)
│   ├── main.tsx            # Entry point React
│   └── index.css           # Tailwind v4 + ::selection + globals
├── migrations/             # Histórico legado (não usado no fluxo oficial)
├── public/                 # Assets estáticos (ícones, logos)
├── scripts/
│   ├── patch-icon.js       # Patch do ícone no build
│   └── compress-images.ts  # Otimização de imagens
├── database.sql            # Único script SQL do schema (source of truth)
├── index.html
├── vite.config.ts
├── tsconfig.json
├── package.json
├── electron-builder.env
└── README.md
```

### Arquivos Não Versionados (.gitignore)
- dist/ dist-electron/ release/ — artefatos de build
- att.txt db.txt — arquivos locais de apoio
- node_modules/ .env*

---

## Comandos

| Comando | Descrição |
|---------|-----------|
| npm install | Instala dependências |
| npm run dev | Inicia servidor de desenvolvimento Vite na porta 3000 (0.0.0.0) + Electron em modo desenvolvimento |
| npm run build | vite build --configLoader native + electron-builder --win → gera pacote dir em release/<version>/ (Windows: sem NSIS para evitar download de binários externos) |
| npm run preview | Preview do build Vite (sem Electron) |
| npm run lint | tsc --noEmit — apenas verificação de tipos (sem framework de teste) |
| npm run clean | Remove dist/, dist-electron/, release/ |

---

## Desenvolvimento

### Pré-requisitos
- Node.js 20+
- MariaDB/MySQL acessível (local ou remoto)

### Primeira Execução
```bash
npm install
npm run dev
# 1. Login: admin / admin123
# 2. Configure conexão DB em Configurações
# 3. Reinicie app
# 4. Crie usuários no painel Admin
```

### Adicionar Nova Feature de Dados (Checklist)

1. Atualize database.sql se houver mudança de schema
2. Adicione handler IPC em electron/main.ts (ipcMain.handle)
3. Exponha em electron/preload.ts (contextBridge)
4. Adicione método tipado em src/services/lanDatabase.ts (db.*)
5. Use db.* nos componentes React via hook useData

### Convenções
- UI e comentários novos: Português Brasileiro
- Commits: Conventional Commits (feat:, fix:, chore:, refactor:)
- Branch: feature/nome, fix/nome, chore/nome
- PR: Descreva o que muda, por que, e como testar

---

## Build de Produção (Windows)

```bash
npm run build
```

Gera em release/<version>/win-unpacked/:
- PIX Farma.exe — executável standalone (pacote dir)
- resources/app.asar — código da aplicação empacotado

> **Nota:** Configurado target: ["dir", "nsis"] no package.json, mas no Windows o dir é priorizado para build offline-friendly.

---

## Contribuindo

1. Fork o repositório
2. Crie branch: git checkout -b feature/minha-feature
3. Commit: git commit -m "feat: descrição clara da mudança"
4. Push: git push origin feature/minha-feature
5. Abra Pull Request com:
   - O que foi alterado
   - Por que (motivação)
   - Como testar localmente
   - Screenshots se houver mudança visual

### Padrões de Código
- npm run lint deve passar (TypeScript strict)
- Sem console.log em produção
- Componentes pequenos, responsabilidade única
- Tipagem explícita em props e retornos de API

---

## Licença

**MIT License** — veja arquivo LICENSE para detalhes.

> **Resumo:** Uso livre, modificação, distribuição, uso comercial permitido. Inclua aviso de copyright e licença. Sem garantia.

---

## Autor

**Vinicius Lara**  
GitHub: https://github.com/ViniciusLara  
LinkedIn: https://linkedin.com/in/viniciuslara

---

## Dependências Principais

Este projeto utiliza as seguintes tecnologias de código aberto:

- [Electron](https://electronjs.org/) — Runtime para aplicações desktop multiplataforma
- [Vite](https://vitejs.dev/) — Ferramenta de build e servidor de desenvolvimento de alta performance
- [React](https://react.dev/) — Biblioteca para construção de interfaces de usuário
- [Tailwind CSS](https://tailwindcss.com/) — Framework CSS utility-first
- [MariaDB](https://mariadb.org/) — Sistema de gerenciamento de banco de dados relacional
- [lucide-react](https://lucide.dev/) — Biblioteca de ícones
- [motion](https://motion.dev/) — Biblioteca de animações

A lista completa de dependências está disponível em package.json.