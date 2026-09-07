import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable('decks');
  if (!hasTable) return;
  const hasStackType = await knex.schema.hasColumn('decks', 'stackType');
  const hasOwnerId = await knex.schema.hasColumn('decks', 'ownerId');
  await knex.schema.alterTable('decks', (t) => {
    if (!hasStackType) t.string('stackType').defaultTo('deck');
    if (!hasOwnerId) t.string('ownerId').defaultTo('');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('decks', (t) => {
    t.dropColumn('stackType');
    t.dropColumn('ownerId');
  });
}
