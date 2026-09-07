import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const exists = await knex.schema.hasTable('discord_configs');
  if (exists) return;
  await knex.schema.createTable('discord_configs', (t) => {
    t.string('id').primary();
    t.string('worldId').notNullable().unique().references('id').inTable('worlds');
    t.string('botToken').notNullable();
    t.string('guildId').notNullable();
    t.string('categoryId').defaultTo(null);
    t.timestamps(true, true, true);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('discord_configs');
}
