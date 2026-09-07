import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasColumn('buffs', 'itemId'))) {
    await knex.schema.alterTable('buffs', (t) => {
      t.string('itemId').defaultTo(null);
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  if (await knex.schema.hasColumn('buffs', 'itemId')) {
    await knex.schema.alterTable('buffs', (t) => {
      t.dropColumn('itemId');
    });
  }
}
