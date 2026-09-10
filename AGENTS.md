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
- **Do NOT create migration files** — the database will be recreated from `database.sql` on every change.
- Passwords = SHA-256 hex (`hash()` in `electron/db.ts`). Roles: `admin` / `employee`.

---

## Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Vite on port 3000 bound to `0.0.0.0` (for Electron) |
| `npm run build` | `vite build --configLoader native && electron-builder` (Windows: `dir` package, no NSIS) |
| `npm run lint` | `tsc --noEmit` (only verification; no test framework) |
| `npm run clean` | Removes `dist/`, `dist-electron/`, `release/`, `../pharmaflow-release/` |

---

## Key Implementation Details

- **Session**: Single active session/user. Heartbeat every 2s client-side; stale cleanup every 60s server-side (TTL 120s).
- **Force login**: Returns `conflict: true` if logged in elsewhere; pass `force: true` to override.
- **Setup mode**: Login `admin`/`admin123` → `setupMode: true`, shows only Settings screen.
- **Exit confirmation**: Blocks close/logout until modal confirmed (`app:confirm-exit` / `app:exit-confirmed`).

---

## Conventions

- UI strings and new comments: **Brazilian Portuguese**.
- Never commit: `dist/`, `dist-electron/`, `release/`, `../pharmaflow-release/`, `att.txt`, `db.txt`.

---

## Visual / Colors

The generic `main` uses black, white and gray. Client-specific colors are defined in `config/branding.ts` on the client's branch.

**Gradients**: use `GRADIENTS.primary` and `GRADIENTS.secondary` from `config/branding.ts` in inline styles.

**Support colors**:
- Light primary background/border: `COLORS.lightRedBg` / `COLORS.lightRedBorder`
- Light secondary background/border: `COLORS.lightBlueBg` / `COLORS.lightBlueBorder`
- Selection: `COLORS.selectionBg` / `COLORS.selectionColor` (in `src/index.css`)
- Active navigation icon/background: `COLORS.navActive` / `COLORS.navActiveBg`

**Do NOT use** Tailwind `red-500/600/700` or `blue-500/600/700` for brand colors — use `COLORS` or `GRADIENTS` from `config/branding.ts`.

---

## Adding a Data Feature (Checklist)

1. Update `database.sql` if schema changes
2. Add IPC handler in `electron/main.ts`
3. Expose in `electron/preload.ts`
4. Add typed method in `src/services/lanDatabase.ts`
5. Use `db.*` in React components via `useData` hook
