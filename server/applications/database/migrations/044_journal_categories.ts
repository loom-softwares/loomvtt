import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable('journals');
  if (!hasTable) return;
  const hasCol = await knex.schema.hasColumn('journals', 'categories');
  if (!hasCol) {
    await knex.schema.alterTable('journals', (t) => {
      t.text('categories').defaultTo('[]');
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable('journals');
  if (!hasTable) return;
  const hasCol = await knex.schema.hasColumn('journals', 'categories');
  if (hasCol) {
    await knex.schema.alterTable('journals', (t) => {
      t.dropColumn('categories');
    });
  }
}
