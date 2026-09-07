import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable('journals');
  if (hasTable) {
    const hasCol = await knex.schema.hasColumn('journals', 'pages');
    if (!hasCol) {
      await knex.schema.alterTable('journals', (t) => {
        t.text('pages').defaultTo('[]');
      });
    }
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable('journals');
  if (hasTable) {
    const hasCol = await knex.schema.hasColumn('journals', 'pages');
    if (hasCol) {
      await knex.schema.alterTable('journals', (t) => {
        t.dropColumn('pages');
      });
    }
  }
}
