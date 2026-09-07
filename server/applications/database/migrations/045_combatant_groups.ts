import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable('combats');
  if (!hasTable) return;
  const hasCol = await knex.schema.hasColumn('combats', 'groups');
  if (!hasCol) {
    await knex.schema.alterTable('combats', (t) => {
      t.text('groups').defaultTo('[]');
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable('combats');
  if (!hasTable) return;
  const hasCol = await knex.schema.hasColumn('combats', 'groups');
  if (hasCol) {
    await knex.schema.alterTable('combats', (t) => {
      t.dropColumn('groups');
    });
  }
}
