import type { Knex } from 'knex';

const columns: Array<{ name: string; add: (t: Knex.AlterTableBuilder) => void }> = [
  { name: 'floors', add: (t) => t.json('floors').defaultTo('[]') },
  { name: 'anchorX', add: (t) => t.float('anchorX').defaultTo(0.5) },
  { name: 'anchorY', add: (t) => t.float('anchorY').defaultTo(0.5) },
];

export async function up(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable('tiles');
  if (!hasTable) return;

  for (const col of columns) {
    const hasCol = await knex.schema.hasColumn('tiles', col.name);
    if (!hasCol) {
      await knex.schema.alterTable('tiles', col.add);
    }
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable('tiles');
  if (!hasTable) return;

  for (const col of columns) {
    const hasCol = await knex.schema.hasColumn('tiles', col.name);
    if (hasCol) {
      await knex.schema.alterTable('tiles', (t) => t.dropColumn(col.name));
    }
  }
}
