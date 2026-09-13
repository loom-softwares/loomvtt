import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  if (await knex.schema.hasTable('stages')) {
    if (!(await knex.schema.hasColumn('stages', 'sceneType'))) {
      await knex.schema.alterTable('stages', (t) => {
        t.string('sceneType').defaultTo('tactical');
      });
    }
  }

  if (await knex.schema.hasTable('notes')) {
    if (!(await knex.schema.hasColumn('notes', 'targetStageId'))) {
      await knex.schema.alterTable('notes', (t) => {
        t.string('targetStageId').defaultTo('');
      });
    }
  }
}

export async function down(knex: Knex): Promise<void> {
  if (await knex.schema.hasTable('stages')) {
    await knex.schema.alterTable('stages', (t) => {
      t.dropColumn('sceneType');
    });
  }
  if (await knex.schema.hasTable('notes')) {
    await knex.schema.alterTable('notes', (t) => {
      t.dropColumn('targetStageId');
    });
  }
}
