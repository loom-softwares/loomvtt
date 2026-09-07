import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Tabela `walls` já foi migrada pro banco por-mundo (ver ensureWorldSchema em
  // world-db.ts) — no banco central ela pode não existir mais. Guard igual ao
  // padrão já usado em 018/019/020.
  const hasTable = await knex.schema.hasTable('walls');
  if (!hasTable) return;
  const hasColumn = await knex.schema.hasColumn('walls', 'wallType');
  if (hasColumn) return;
  await knex.schema.alterTable('walls', (t) => {
    t.string('wallType').defaultTo('normal');
  });
}

export async function down(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable('walls');
  if (!hasTable) return;
  const hasColumn = await knex.schema.hasColumn('walls', 'wallType');
  if (!hasColumn) return;
  await knex.schema.alterTable('walls', (t) => {
    t.dropColumn('wallType');
  });
}
