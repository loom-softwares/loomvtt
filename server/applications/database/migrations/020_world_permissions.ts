import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable('worlds');
  if (!hasTable) return;
  const hasCol = await knex.schema.hasColumn('worlds', 'permissions');
  if (!hasCol) {
    await knex.schema.alterTable('worlds', (t) => t.text('permissions').defaultTo('{"compendiumEdit":[],"viewStages":[]}'));
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable('worlds');
  if (!hasTable) return;
  const hasCol = await knex.schema.hasColumn('worlds', 'permissions');
  if (hasCol) {
    await knex.schema.alterTable('worlds', (t) => t.dropColumn('permissions'));
  }
}
