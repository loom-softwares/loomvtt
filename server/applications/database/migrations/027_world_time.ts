import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const hasWorlds = await knex.schema.hasTable('worlds');
  if (hasWorlds) {
    const hasWorldTime = await knex.schema.hasColumn('worlds', 'worldTime');
    if (!hasWorldTime) {
      await knex.schema.alterTable('worlds', (t) => {
        t.integer('worldTime').defaultTo(0);
      });
    }
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasWorlds = await knex.schema.hasTable('worlds');
  if (hasWorlds) {
    const hasWorldTime = await knex.schema.hasColumn('worlds', 'worldTime');
    if (hasWorldTime) {
      await knex.schema.alterTable('worlds', (t) => t.dropColumn('worldTime'));
    }
  }
}
