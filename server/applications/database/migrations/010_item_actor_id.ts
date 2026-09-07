import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable('items');
  if (hasTable) {
    const hasCol = await knex.schema.hasColumn('items', 'actorId');
    if (!hasCol) {
      await knex.schema.alterTable('items', (t) => {
        t.string('actorId').defaultTo('');
        t.index('actorId');
      });
    }
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable('items');
  if (hasTable) {
    const hasCol = await knex.schema.hasColumn('items', 'actorId');
    if (hasCol) {
      await knex.schema.alterTable('items', (t) => {
        t.dropColumn('actorId');
      });
    }
  }
}
