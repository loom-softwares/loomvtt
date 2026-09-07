import type { Knex } from 'knex';

const columns: Array<{ name: string; add: (t: Knex.AlterTableBuilder) => void }> = [
  { name: 'tintColor', add: (t) => t.string('tintColor').defaultTo('#ffffff') },
  { name: 'opacity', add: (t) => t.float('opacity').defaultTo(1) },
  { name: 'rotation', add: (t) => t.float('rotation').defaultTo(0) },
  { name: 'scale', add: (t) => t.float('scale').defaultTo(1) },
  { name: 'sightEnabled', add: (t) => t.boolean('sightEnabled').defaultTo(true) },
  { name: 'sightRange', add: (t) => t.float('sightRange').defaultTo(0) },
  { name: 'sightAngle', add: (t) => t.float('sightAngle').defaultTo(360) },
  { name: 'detectionModes', add: (t) => t.text('detectionModes').defaultTo('[]') },
  { name: 'lightDimRange', add: (t) => t.float('lightDimRange').defaultTo(0) },
  { name: 'lightBrightRange', add: (t) => t.float('lightBrightRange').defaultTo(0) },
  { name: 'lightColor', add: (t) => t.string('lightColor').defaultTo('#ffffff') },
  { name: 'lightAnimation', add: (t) => t.string('lightAnimation').defaultTo('none') },
  { name: 'barGridSize', add: (t) => t.integer('barGridSize').defaultTo(1) },
];

export async function up(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable('cast');
  if (!hasTable) return;

  for (const col of columns) {
    const hasCol = await knex.schema.hasColumn('cast', col.name);
    if (!hasCol) {
      await knex.schema.alterTable('cast', col.add);
    }
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable('cast');
  if (!hasTable) return;

  for (const col of columns) {
    const hasCol = await knex.schema.hasColumn('cast', col.name);
    if (hasCol) {
      await knex.schema.alterTable('cast', (t) => t.dropColumn(col.name));
    }
  }
}
