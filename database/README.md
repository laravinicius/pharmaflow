# Database workflow

This project keeps two SQL sources in sync:

- `database.sql` (root): full schema snapshot used for fresh setup.
- `migrations/`: incremental SQL files for each database change.

## Rule for every DB update

1. Create a new migration file in `migrations/` using sequential numbering:
   - `0002_add_orders_table.sql`
   - `0003_alter_users_add_last_login.sql`
2. Apply only the delta change in the migration file.
3. Update `database.sql` to the new full schema version.

## Naming convention

- Use 4-digit sequence prefix.
- Use snake_case description.
- Keep one logical change set per migration file.
