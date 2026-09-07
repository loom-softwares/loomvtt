import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable('module_settings');
  if (!hasTable) {
    await knex.schema.createTable('module_settings', (t) => {
      t.string('id').primary();
      t.string('worldId').notNullable();
      t.string('moduleId').notNullable();
      t.string('key').notNullable();
      t.string('scope').notNullable().defaultTo('world');
      t.text('value');
      t.string('createdAt');
      t.string('updatedAt');
      t.unique(['worldId', 'moduleId', 'key']);
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable('module_settings');
  if (hasTable) {
    await knex.schema.dropTable('module_settings');
  }
}
