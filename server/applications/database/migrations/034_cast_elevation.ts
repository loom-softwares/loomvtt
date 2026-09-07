import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  if (await knex.schema.hasTable('cast')) {
    if (!(await knex.schema.hasColumn('cast', 'elevation'))) {
      await knex.schema.alterTable('cast', (t) => {
        t.float('elevation').defaultTo(0);
      });
    }
  }
}

export async function down(knex: Knex): Promise<void> {
  if (await knex.schema.hasTable('cast')) {
    if (await knex.schema.hasColumn('cast', 'elevation')) {
      await knex.schema.alterTable('cast', (t) => t.dropColumn('elevation'));
    }
  }
}
