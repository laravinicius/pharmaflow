# Migrations

This folder stores incremental SQL migrations.

Current baseline:
- `0001_initial_schema.sql`

When changing the DB:
1. Add a new numbered migration file.
2. Keep migration idempotent when possible.
3. Update root `database.sql` with the complete latest schema.
