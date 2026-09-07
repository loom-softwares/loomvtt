import type { Knex } from 'knex';

const TABLES = ['actors', 'items', 'stages', 'journals', 'roll_tables'];

export async function up(knex: Knex): Promise<void> {
  for (const table of TABLES) {
    const hasTable = await knex.schema.hasTable(table);
    if (hasTable) {
      const hasCol = await knex.schema.hasColumn(table, 'flags');
      if (!hasCol) {
        await knex.schema.alterTable(table, (t) => {
          t.text('flags').defaultTo('{}');
        });
      }
    }
  }
}

export async function down(knex: Knex): Promise<void> {
  for (const table of TABLES) {
    const hasTable = await knex.schema.hasTable(table);
    if (hasTable) {
      const hasCol = await knex.schema.hasColumn(table, 'flags');
      if (hasCol) {
        await knex.schema.alterTable(table, (t) => {
          t.dropColumn('flags');
        });
      }
    }
  }
}
