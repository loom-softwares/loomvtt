import type { Knex } from 'knex';

const COLUMNS: Array<[string, (t: Knex.AlterTableBuilder) => void]> = [
  ['dataPath', (t) => t.string('dataPath').defaultTo('')],
  ['backgroundUrl', (t) => t.string('backgroundUrl').defaultTo('')],
  ['theme', (t) => t.string('theme').defaultTo('')],
  ['nextSession', (t) => t.string('nextSession').defaultTo('')],
  ['safeMode', (t) => t.boolean('safeMode').defaultTo(false)],
];

export async function up(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable('worlds');
  if (!hasTable) return;

  for (const [name, addColumn] of COLUMNS) {
    const hasCol = await knex.schema.hasColumn('worlds', name);
    if (!hasCol) {
      await knex.schema.alterTable('worlds', addColumn);
    }
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable('worlds');
  if (!hasTable) return;

  for (const [name] of COLUMNS) {
    const hasCol = await knex.schema.hasColumn('worlds', name);
    if (hasCol) {
      await knex.schema.alterTable('worlds', (t) => t.dropColumn(name));
    }
  }
}
