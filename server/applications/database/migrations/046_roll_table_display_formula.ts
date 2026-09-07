import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  if (await knex.schema.hasTable('roll_tables')) {
    const hasColumn = await knex.schema.hasColumn('roll_tables', 'displayRollFormula');
    if (!hasColumn) {
      await knex.schema.alterTable('roll_tables', (table) => {
        table.integer('displayRollFormula').defaultTo(1);
      });
    }
  }
}

export async function down(knex: Knex): Promise<void> {
  if (await knex.schema.hasTable('roll_tables')) {
    const hasColumn = await knex.schema.hasColumn('roll_tables', 'displayRollFormula');
    if (hasColumn) {
      await knex.schema.alterTable('roll_tables', (table) => {
        table.dropColumn('displayRollFormula');
      });
    }
  }
}
