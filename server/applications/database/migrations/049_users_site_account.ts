import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const hasSiteAccountId = await knex.schema.hasColumn('users', 'siteAccountId');
  if (!hasSiteAccountId) {
    await knex.schema.alterTable('users', (t) => {
      t.string('siteAccountId').defaultTo('');
      t.string('authProvider').defaultTo('local');
      t.boolean('pendingApproval').notNullable().defaultTo(false);
    });
    await knex.schema.alterTable('users', (t) => {
      t.index(['worldId', 'siteAccountId'], 'idx_users_worldId_siteAccountId');
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('users', (t) => {
    t.dropColumn('siteAccountId');
    t.dropColumn('authProvider');
    t.dropColumn('pendingApproval');
  });
}
