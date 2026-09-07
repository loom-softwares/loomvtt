import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable('stages');
  if (hasTable) {
    const hasCol = await knex.schema.hasColumn('stages', 'gridType');
    if (!hasCol) {
      await knex.schema.alterTable('stages', (t) => {
        t.string('gridType').defaultTo('square');
      });
    }
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable('stages');
  if (hasTable) {
    const hasCol = await knex.schema.hasColumn('stages', 'gridType');
    if (hasCol) {
      await knex.schema.alterTable('stages', (t) => {
        t.dropColumn('gridType');
      });
    }
  }
}
