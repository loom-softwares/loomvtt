import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Add hidden field to tiles table
  if (await knex.schema.hasTable('tiles')) {
    const hasHidden = await knex.schema.hasColumn('tiles', 'hidden');
    if (!hasHidden) {
      await knex.schema.alterTable('tiles', (table) => {
        table.boolean('hidden').notNullable().defaultTo(false);
      });
    }
  }
}

export async function down(knex: Knex): Promise<void> {
  if (await knex.schema.hasTable('tiles')) {
    const hasHidden = await knex.schema.hasColumn('tiles', 'hidden');
    if (hasHidden) {
      await knex.schema.alterTable('tiles', (table) => {
        table.dropColumn('hidden');
      });
    }
  }
}
