import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Empty migration to prevent premature table dropping before data migration runs.
  // The tables are now dropped dynamically in migrateCentralWorldData() after migration is complete.
}

export async function down(knex: Knex): Promise<void> {
  // Empty rollback
}
