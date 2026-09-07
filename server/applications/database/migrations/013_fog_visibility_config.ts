import type { Knex } from 'knex';

const columns: Array<{ name: string; add: (t: Knex.AlterTableBuilder) => void }> = [
  { name: 'tokenVision', add: (t) => t.boolean('tokenVision').defaultTo(true) },
  { name: 'fogExplorationMode', add: (t) => t.string('fogExplorationMode').defaultTo('individual') },
  { name: 'fogExploredColor', add: (t) => t.string('fogExploredColor').defaultTo('#000000') },
  { name: 'fogUnexploredColor', add: (t) => t.string('fogUnexploredColor').defaultTo('#000000') },
  { name: 'fogImage', add: (t) => t.string('fogImage').defaultTo('') },
  { name: 'globalLight', add: (t) => t.boolean('globalLight').defaultTo(false) },
  { name: 'globalLightThreshold', add: (t) => t.float('globalLightThreshold').defaultTo(1) },
];

export async function up(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable('stages');
  if (!hasTable) return;

  for (const col of columns) {
    const hasCol = await knex.schema.hasColumn('stages', col.name);
    if (!hasCol) {
      await knex.schema.alterTable('stages', col.add);
    }
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable('stages');
  if (!hasTable) return;

  for (const col of columns) {
    const hasCol = await knex.schema.hasColumn('stages', col.name);
    if (hasCol) {
      await knex.schema.alterTable('stages', (t) => t.dropColumn(col.name));
    }
  }
}
