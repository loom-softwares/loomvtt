import type { Knex } from 'knex';

const columns: Array<{ name: string; add: (t: Knex.AlterTableBuilder) => void }> = [
  { name: 'floors', add: (t) => t.integer('floors').defaultTo(0) },
  { name: 'visibleGlobally', add: (t) => t.boolean('visibleGlobally').defaultTo(false) },
  { name: 'iconEntry', add: (t) => t.string('iconEntry').defaultTo('bookmark') },
  { name: 'iconFontSize', add: (t) => t.integer('iconFontSize').defaultTo(40) },
  { name: 'iconTint', add: (t) => t.string('iconTint').defaultTo('#ffffff') },
  { name: 'textLabel', add: (t) => t.string('textLabel').defaultTo('') },
  { name: 'fontFamily', add: (t) => t.string('fontFamily').defaultTo('Padrão') },
  { name: 'fontSize', add: (t) => t.integer('fontSize').defaultTo(32) },
  { name: 'textColor', add: (t) => t.string('textColor').defaultTo('#ffffff') },
  { name: 'textAnchor', add: (t) => t.string('textAnchor').defaultTo('center') },
];

export async function up(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable('notes');
  if (!hasTable) return;

  for (const col of columns) {
    const hasCol = await knex.schema.hasColumn('notes', col.name);
    if (!hasCol) {
      await knex.schema.alterTable('notes', col.add);
    }
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable('notes');
  if (!hasTable) return;

  for (const col of columns) {
    const hasCol = await knex.schema.hasColumn('notes', col.name);
    if (hasCol) {
      await knex.schema.alterTable('notes', (t) => t.dropColumn(col.name));
    }
  }
}