# AGENTS.md

PharmaFlow is an offline-first desktop app (Electron + Vite + React 19 + Tailwind CSS v4) for pharmacy compounding workflow. The UI and code comments are in Brazilian Portuguese.

## Architecture & data flow

- The renderer (`src/`) never touches the database. All data access flows through Electron IPC; adding a data feature requires touching all three layers:
  1. `electron/main.ts` — IPC handlers (`ipcMain.handle`)
  2. `electron/preload.ts` — bridge exposed as `window.electronAPI`
  3. `src/services/lanDatabase.ts` — typed client (`db.*`) plus the `Window.electronAPI` type declaration
- The renderer UI is split into small files under `src/`: `App.tsx` holds only login, layout, routing and global state; feature screens live in `src/components/` (`Dashboard`, `RecipeForm`, `FormulaList`, `CustomerManager`, `MaterialManager`, `UserManager`/`AdminPanel`, `AdminUserManager`, `SettingsManager`); shared UI in `src/components/` (`SyncIndicator`, `Logo`, `NavItem`, `Feedback`, `HighlightMatch`); business types in `src/types.ts`, formatting helpers in `src/utils/format.ts`, and the data-loading hook in `src/hooks/useData.ts`.
- The `@/*` alias resolves to the repo **root**, not `src/` (`tsconfig.json` + `vite.config.ts`).

## Database schema changes

- `database.sql` is the single source of truth for the server schema. **Always** update it so it stays current for a future full implementation and fresh installs.
- Existing production databases are already created, so each change also needs a numbered migration under `migrations/` (e.g. `0003_*.sql`) to update the running DB. Always do **both**: update `database.sql` AND create the migration.
- The app additionally auto-migrates the server schema at runtime in `CacheManager.migrateServer()` (`electron/cache.ts`): it ensures `updated_at`/`created_at` columns, `server_meta`/`instance_id`, `formulas.customer_phone`/`pharmacist_name`, and `formula_items.unit`. Any new column existing installs need must be added there too.
- The SQLite cache schema lives in `CacheManager.initSchema()` (`electron/cache.ts`) with ad-hoc `ALTER TABLE` migrations. Quirk: sql.js `run()` cannot execute multiple statements in one call — use `db.exec()`.
- Passwords are SHA-256 hex (`hash()` in `electron/cache.ts`) on both server and cache. Roles are `admin` / `employee`.

## Setup & dev commands

- No `.env` needed: the MariaDB connection is configured in the app's Settings screen — reachable only via the setup login `admin` / `admin123` (hardcoded in `electron/main.ts`) — and persisted to `userData/config.json`. MariaDB Windows/GSSAPI auth (`auth_gssapi_client`) is unsupported.
- `npm run dev` starts Vite on port 3000 bound to `0.0.0.0` (for Electron). Production loads `dist/index.html` (`base: './'`); `package.json` `main` points to `dist-electron/main.js`.
- `npm run build` = `vite build --configLoader native && electron-builder`. On Windows it produces a `dir` package (no NSIS installer) and uses local `node_modules/electron/dist`.
- `npm run lint` = `tsc --noEmit`. There is no test framework; lint is the only verification.
- `npm run clean` removes `dist/`, `dist-electron/`, `release/`.

## Conventions

- Keep UI strings and new code comments in Brazilian Portuguese.
- Never commit `dist/`, `dist-electron/`, `release/`, or the local `att.txt` / `db.txt` files.
