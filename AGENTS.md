# AGENTS.md

PharmaFlow is an online-first desktop app (Electron + Vite + React 19 + Tailwind CSS v4) for pharmacy compounding workflow. The app always talks to the MariaDB server — there is no local cache or offline sync. The UI and code comments are in Brazilian Portuguese.

## Architecture & data flow

- The renderer (`src/`) never touches the database. All data access flows through Electron IPC; adding a data feature requires touching all three layers:
  1. `electron/main.ts` — IPC handlers (`ipcMain.handle`)
  2. `electron/preload.ts` — bridge exposed as `window.electronAPI`
  3. `src/services/lanDatabase.ts` — typed client (`db.*`) plus the `Window.electronAPI` type declaration
- All reads/writes go straight to MariaDB via `Db` (`electron/db.ts`), which holds the pool configured in Settings. After each successful mutation `main.ts` emits `data:changed` to every window; `src/hooks/useData.ts` also silently reloads every 10s to pick up changes from other machines.
- The renderer UI is split into small files under `src/`: `App.tsx` holds only login, layout, routing and global state; feature screens live in `src/components/` (`Dashboard`, `RecipeForm`, `FormulaList`, `CustomerManager`, `InsumoManager`, `UserManager`/`AdminPanel`, `AdminUserManager`, `SettingsManager`); shared UI in `src/components/` (`Logo`, `NavItem`, `Feedback`, `HighlightMatch`); business types in `src/types.ts`, formatting helpers in `src/utils/format.ts`, and the data-loading hook in `src/hooks/useData.ts`.
- The `@/*` alias resolves to the repo **root**, not `src/` (`tsconfig.json` + `vite.config.ts`).

## Database schema changes

- `database.sql` is the single source of truth for the server schema. **Always** update it so it stays current for a future full implementation and fresh installs.
- **Do NOT create migration files** — the `migrations/` directory is legacy history only. The official schema flow only uses `database.sql` (per README.md). Production databases are updated manually or via external tooling.
- Passwords are SHA-256 hex (`hash()` in `electron/db.ts`). Roles are `admin` / `employee`.

## Setup & dev commands

- No `.env` needed: the MariaDB connection is configured in the app's Settings screen — reachable only via the setup login `admin` / `admin123` (hardcoded in `electron/main.ts`) — and persisted to `userData/config.json`. MariaDB Windows/GSSAPI auth (`auth_gssapi_client`) is unsupported.
- `npm run dev` starts Vite on port 3000 bound to `0.0.0.0` (for Electron). Production loads `dist/index.html` (`base: './'`); `package.json` `main` points to `dist-electron/main.js`.
- `npm run build` = `vite build --configLoader native && electron-builder`. On Windows it produces a `dir` package (no NSIS installer) and uses local `node_modules/electron/dist`.
- `npm run lint` = `tsc --noEmit`. There is no test framework; lint is the only verification.
- `npm run clean` removes `dist/`, `dist-electron/`, `release/`.

## Key implementation details

- **Session handling**: Single active session per user (enforced in `db.ts` login). Heartbeat runs every 2s client-side; stale sessions cleaned up every 60s server-side (TTL 120s).
- **Force login**: If user already logged in elsewhere, login returns `conflict: true`; pass `force: true` to override.
- **Setup mode**: Login with `admin`/`admin123` grants `setupMode: true` and shows only Settings screen (no data access).
- **Live reload**: `useData` hook subscribes to `data:changed` IPC event AND polls every 10s.
- **Exit confirmation**: App blocks close/logout until user confirms via modal (`app:confirm-exit` / `app:exit-confirmed`).

## Conventions

- Keep UI strings and new code comments in Brazilian Portuguese.
- Never commit `dist/`, `dist-electron/`, `release/`, or the local `att.txt` / `db.txt` files.

## Visual / Cores

- **Paleta oficial** (definida em `src/components/Logo.tsx`):
  - `PRIMARY` (vermelho): `#C5243E` — botões primários, ações destrutivas/confirmatórias, badges ativos, links.
  - `SECONDARY` (azul): `#243465` — sidebar, navegação, botões secundários ("Editar", "Salvar alterações").
  - `FARMA_COLOR` (azul claro): `#4A90D9` — texto "Farma" no logo, elementos informativos.
- **Gradientes padrão** (usar estes valores exatos em `style={{}}`):
  - Botão vermelho: `linear-gradient(135deg, #C5243E, #9B1A2E)`
  - Botão azul: `linear-gradient(135deg, #243465, #1A2850)`
- **Cores de apoio** (backgrounds sutis, bordas, texto):
  - Light red bg: `#FEF0F2` | Light red border: `#FED7DB` | Dark red text: `#C5243E`
  - Light blue bg: `#EFF2FA` | Light blue border: `#D0DCE8` | Dark blue text: `#243465`
  - Seleção: `::selection { background: #FED7DB; color: #8C1A3D; }` (em `src/index.css`)
- **Icones de navegação ativos** recebem `text-amber-400` (`#FBBF24`) via inline style no `NavItem`.
- **Não usar** Tailwind `red-500/600/700` ou `blue-500/600/700` para as cores da marca — sempre usar os valores hex acima ou as constantes `PRIMARY`/`SECONDARY` do `Logo.tsx`.