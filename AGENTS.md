# PharmaFlow — Agent Instructions

PharmaFlow is an online-first desktop app (Electron + Vite + React 19 + Tailwind CSS v4) for pharmacy compounding workflow. All data flows through MariaDB — no local cache or offline sync. UI and comments are in Brazilian Portuguese.

---

## Architecture & Data Flow (Critical)

**Renderer never touches DB.** All data access requires three layers:
1. `electron/main.ts` — IPC handlers (`ipcMain.handle`)
2. `electron/preload.ts` — bridge exposed as `window.electronAPI`
3. `src/services/lanDatabase.ts` — typed client (`db.*`) + `Window.electronAPI` types

**Mutations** → `main.ts` emits `data:changed` to all windows; `useData` hook also polls every 10s.

**Path alias**: `@/*` resolves to repo **root**, not `src/`.

---

## Database Schema

- `database.sql` = single source of truth. **Always update it.**
- **Always create a migration file in `migrations/` when changing `database.sql`** — sequential naming: `NNNN_descriptive_name.sql` (e.g., `0016_saved_formulas_budget_fields.sql`). Migrations are for existing databases; `database.sql` is source of truth for fresh installs.
- Passwords = SHA-256 hex (`hash()` in `electron/db.ts`). Roles: `admin` / `employee`.

---

## Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Vite on port 3000 bound to `0.0.0.0` (for Electron) |
| `npm run build` | `vite build --configLoader native && electron-builder` (Windows: `dir` package, no NSIS) |
| `npm run lint` | `tsc --noEmit` (only verification; no test framework) |
| `npm run clean` | Removes `dist/`, `dist-electron/`, `release/` |

---

## Key Implementation Details

- **Session**: Single active session/user. Heartbeat every 2s client-side; stale cleanup every 60s server-side (TTL 120s).
- **Force login**: Returns `conflict: true` if logged in elsewhere; pass `force: true` to override.
- **Setup mode**: Login `admin`/`admin123` → `setupMode: true`, shows only Settings screen.
- **Exit confirmation**: Blocks close/logout until modal confirmed (`app:confirm-exit` / `app:exit-confirmed`).

---

## Conventions

- UI strings and new comments: **Brazilian Portuguese**.
- Never commit: `dist/`, `dist-electron/`, `release/`, `att.txt`, `db.txt`.

---

## Visual / Colors (Exact Values)

Defined in `src/components/Logo.tsx`:
- `PRIMARY` (red): `#C5243E`
- `SECONDARY` (blue): `#243465`
- `FARMA_COLOR` (light blue): `#4A90D9`

**Gradients** (use exact values in `style={{}}`):
- Red button: `linear-gradient(135deg, #C5243E, #9B1A2E)`
- Blue button: `linear-gradient(135deg, #243465, #1A2850)`

**Support colors**:
- Light red bg: `#FEF0F2` | border: `#FED7DB` | text: `#C5243E`
- Light blue bg: `#EFF2FA` | border: `#D0DCE8` | text: `#243465`
- Selection: `::selection { background: #FED7DB; color: #8C1A3D; }` (in `src/index.css`)

**Active nav icons**: `text-amber-400` (`#FBBF24`) via inline style in `NavItem`.

**Do NOT use** Tailwind `red-500/600/700` or `blue-500/600/700` for brand colors — use hex values or `PRIMARY`/`SECONDARY` constants.

---

## Adding a Data Feature (Checklist)

1. Update `database.sql` if schema changes
2. Add IPC handler in `electron/main.ts`
3. Expose in `electron/preload.ts`
4. Add typed method in `src/services/lanDatabase.ts`
5. Use `db.*` in React components via `useData` hook