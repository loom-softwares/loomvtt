import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable('cast');
  if (hasTable) {
    const hasCol = await knex.schema.hasColumn('cast', 'sightMode');
    if (!hasCol) {
      await knex.schema.alterTable('cast', (t) => t.string('sightMode').defaultTo('basic'));
    }
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable('cast');
  if (hasTable) {
    const hasCol = await knex.schema.hasColumn('cast', 'sightMode');
    if (hasCol) {
      await knex.schema.alterTable('cast', (t) => t.dropColumn('sightMode'));
    }
  }
}