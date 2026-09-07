import type { Knex } from 'knex';

const columns: Array<{ name: string; add: (t: Knex.AlterTableBuilder) => void }> = [
  { name: 'elevation', add: (t) => t.float('elevation').defaultTo(0) },
  { name: 'locked', add: (t) => t.boolean('locked').defaultTo(false) },
  { name: 'hidden', add: (t) => t.boolean('hidden').defaultTo(false) },
  { name: 'movementAction', add: (t) => t.string('movementAction').defaultTo('walk') },
  { name: 'targetedBy', add: (t) => t.text('targetedBy').defaultTo('[]') },
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
