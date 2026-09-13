import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  if (await knex.schema.hasTable('stages')) {
    if (!(await knex.schema.hasColumn('stages', 'parentStageId'))) {
      await knex.schema.alterTable('stages', (t) => {
        t.string('parentStageId').defaultTo('');
      });
    }
  }
}

export async function down(knex: Knex): Promise<void> {
  if (await knex.schema.hasTable('stages')) {
    await knex.schema.alterTable('stages', (t) => {
      t.dropColumn('parentStageId');
    });
  }
}
