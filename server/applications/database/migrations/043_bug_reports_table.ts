import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const exists = await knex.schema.hasTable('bug_reports');
  if (!exists) {
    await knex.schema.createTable('bug_reports', (t) => {
      t.string('id').primary();
      t.string('worldId').notNullable().references('id').inTable('worlds');
      t.string('title').notNullable();
      t.text('description').defaultTo('');
      t.string('severity').defaultTo('medium');
      t.string('category').defaultTo('other');
      t.string('status').defaultTo('open');
      t.string('reporterId').notNullable();
      t.text('metadata').defaultTo('{}');
      t.string('createdAt');
      t.string('updatedAt');
    });
    await knex.schema.alterTable('bug_reports', (t) => {
      t.index(['worldId'], 'idx_bug_reports_worldId');
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('bug_reports');
}
