import type { Knex } from 'knex';

const columns: Array<{ name: string; add: (t: Knex.AlterTableBuilder) => void }> = [
  { name: 'rotation', add: (t) => t.float('rotation').defaultTo(0) },
  { name: 'tintColor', add: (t) => t.string('tintColor').defaultTo('') },
  { name: 'opacity', add: (t) => t.float('opacity').defaultTo(1) },
  { name: 'locked', add: (t) => t.boolean('locked').defaultTo(false) },
  { name: 'videoLoop', add: (t) => t.boolean('videoLoop').defaultTo(true) },
  { name: 'videoAutoplay', add: (t) => t.boolean('videoAutoplay').defaultTo(true) },
  { name: 'videoVolume', add: (t) => t.float('videoVolume').defaultTo(1) },
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
