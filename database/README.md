# Database workflow

The project keeps a single SQL source of truth:

- `database.sql` (root): updated schema used for fresh setup.

## Rule for every DB update

1. Update `database.sql`.
2. Keep it aligned with the schema used by the app.

## Naming convention

- Keep the file at the repository root.
- Use clear, short SQL comments only when needed.
