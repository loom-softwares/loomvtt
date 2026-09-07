import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const exists = await knex.schema.hasTable('activation_codes');
  if (!exists) {
    await knex.schema.createTable('activation_codes', (t) => {
      t.string('id').primary();
      t.string('code').notNullable().unique();
      t.string('packageName').notNullable();
      t.boolean('used').notNullable().defaultTo(false);
      t.string('worldId').nullable();
      t.string('redeemedAt').nullable();
      t.string('createdAt').notNullable();
    });
    await knex.schema.alterTable('activation_codes', (t) => {
      t.index(['packageName'], 'idx_activation_codes_packageName');
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('activation_codes');
}
