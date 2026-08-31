# NexusFlow OS database

The canonical schema is defined by the Sequelize models in `../models`. The executable initial migration is `20260830000000-create-nexusflow-os-schema.js`.

For a brand-new local PostgreSQL database:

1. Create a database named `nexusflow_os`.
2. Copy `.env.example` to `.env` and update the credentials.
3. Run the migration using Sequelize CLI, or set `DB_SYNC=true` only for quick local prototyping.
4. Keep `DB_SYNC=false` in shared and cproduction environments.

Every tenant-owned table carries `organization_id`. Auto-incrementing integer primary keys, timestamps and soft deletes are standardized by `BaseModel`. Join and audit tables intentionally retain their history.
