import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const exists = await knex.schema.hasTable('chat_messages');
  if (!exists) {
    await knex.schema.createTable('chat_messages', (t) => {
      t.string('id').primary();
      t.string('worldId').notNullable().references('id').inTable('worlds');
      t.string('userId').defaultTo('system');
      t.string('userName').defaultTo('System');
      t.string('userColor').defaultTo('#888');
      t.string('type').defaultTo('chat');
      t.text('content').notNullable();
      t.text('rollData').defaultTo('null');
      t.text('flags').defaultTo('{}');
      t.text('speaker').defaultTo('{}');
      t.string('createdAt');
      t.string('updatedAt');
    });
    await knex.schema.alterTable('chat_messages', (t) => {
      t.index(['worldId'], 'idx_chat_messages_worldId');
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('chat_messages');
}
