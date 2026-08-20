-- Remove tabelas usadas apenas pela sincronização offline (app agora é online-first).
-- server_meta guardava instance_id/schema_version; sync_deletes, tombstones de exclusão.
-- Apply to an existing database; for a fresh database run database.sql.

DROP TABLE IF EXISTS sync_deletes;
DROP TABLE IF EXISTS server_meta;