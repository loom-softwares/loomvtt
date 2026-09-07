import type { Knex } from 'knex';

const columns: Array<{ name: string; add: (t: Knex.AlterTableBuilder) => void }> = [
  { name: 'isOverhead', add: (t) => t.boolean('isOverhead').defaultTo(false) },
  { name: 'isRoof', add: (t) => t.boolean('isRoof').defaultTo(false) },
  { name: 'occlusion', add: (t) => t.string('occlusion').defaultTo('{}') },
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
