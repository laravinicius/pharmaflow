# Repository Guidelines

## Project Structure & Module Organization
- `src/` contains the React frontend (`App.tsx`, `main.tsx`, shared styles, and client-side services).
- `electron/` contains the Electron main process, preload bridge, and desktop-specific helpers.
- `migrations/` stores incremental SQL migrations; `migrations/0001_initial_schema.sql` is the baseline.
- `database.sql` is the full current schema snapshot. Keep it in sync with new migrations.
- `database/` holds database notes and operational documentation.

## Build, Test, and Development Commands
- `npm install` installs dependencies.
- `npm run dev` starts the Vite dev server on port `3000` and binds to `0.0.0.0` for Electron/local testing.
- `npm run build` builds the web app and packages the Electron app with `electron-builder`.
- `npm run preview` serves the production Vite build locally.
- `npm run lint` runs TypeScript type-checking with `tsc --noEmit`.

## Coding Style & Naming Conventions
- Use TypeScript and React function components.
- Keep formatting consistent with the existing codebase: ASCII text, short functions, and minimal abstraction.
- Use `PascalCase` for React components, `camelCase` for variables/functions, and `UPPER_SNAKE_CASE` only for true constants.
- Name migration files with zero-padded prefixes, for example `0002_add_patient_table.sql`.

## Testing Guidelines
- There is no automated test framework currently configured.
- Use `npm run lint` as the primary verification step for code changes.
- If you add tests later, place them near the code they cover or in a dedicated `tests/` directory, and document the command in `package.json`.

## Commit & Pull Request Guidelines
- The Git history currently shows only `initial commit`, so there is no established commit-message convention yet.
- Use short, imperative commit messages, for example `add patient search filter`.
- Pull requests should describe the change, mention database updates when applicable, and include screenshots for UI changes.

## Security & Configuration Tips
- Copy `.env.example` to `.env` and set the required setup credentials before running locally.
- Do not commit generated artifacts such as `dist/`, `dist-electron/`, or `release/`.
- Keep `database.sql` and the migration files aligned whenever schema changes are made.
