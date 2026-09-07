import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable('decks');
  if (!hasTable) return;
  const hasCol = await knex.schema.hasColumn('decks', 'folderId');
  if (hasCol) return;
  await knex.schema.alterTable('decks', (t) => {
    t.string('folderId').defaultTo('');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('decks', (t) => {
    t.dropColumn('folderId');
  });
}
