import type { Knex } from 'knex';

// `users` é tabela CENTRAL (rpg-core.sqlite) — ficou de fora da migration 007 (que só cobre
// actors/items/stages/journals/roll_tables). Loom gera sistemas que
// chamam `Loom.users.current.getFlag/setFlag` (ex: wod5e guarda estado de UI de roll ali).
// `chat_messages` é tabela POR-MUNDO — a coluna equivalente foi adicionada direto em
// `ensureWorldSchema()` (world-db.ts), não aqui.

export async function up(knex: Knex): Promise<void> {
  const hasUsers = await knex.schema.hasTable('users');
  if (hasUsers) {
    const hasFlags = await knex.schema.hasColumn('users', 'flags');
    if (!hasFlags) {
      await knex.schema.alterTable('users', (t) => {
        t.text('flags').defaultTo('{}');
      });
    }
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasUsers = await knex.schema.hasTable('users');
  if (hasUsers) {
    const hasFlags = await knex.schema.hasColumn('users', 'flags');
    if (hasFlags) {
      await knex.schema.alterTable('users', (t) => t.dropColumn('flags'));
    }
  }
}
