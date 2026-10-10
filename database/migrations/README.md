# Migrations

Version 1 is the canonical database/schema.sql. The migration runner obtains a MySQL advisory lock and records version 1 only after successful execution. DDL is idempotent to recover an interrupted first initialization. Future schema changes must be added as versioned SQL migrations with a corresponding runner update; do not alter schema.sql to upgrade an existing installation.
