import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('worlds', (t) => {
    t.boolean('isPaused').defaultTo(false);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('worlds', (t) => {
    t.dropColumn('isPaused');
  });
}
