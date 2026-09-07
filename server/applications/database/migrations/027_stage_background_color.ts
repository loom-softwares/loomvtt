import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const hasStages = await knex.schema.hasTable('stages');
  if (hasStages) {
    const hasBgColor = await knex.schema.hasColumn('stages', 'backgroundColor');
    if (!hasBgColor) {
      await knex.schema.alterTable('stages', (t) => {
        t.text('backgroundColor').defaultTo('#0d0d0f');
      });
    }
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasStages = await knex.schema.hasTable('stages');
  if (hasStages) {
    const hasBgColor = await knex.schema.hasColumn('stages', 'backgroundColor');
    if (hasBgColor) {
      await knex.schema.alterTable('stages', (t) => {
        t.dropColumn('backgroundColor');
      });
    }
  }
}
