import type { Knex } from 'knex';

const COLUMNS: Array<{ name: string; build: (t: Knex.AlterTableBuilder) => void }> = [
  { name: 'type', build: (t) => { t.string('type').defaultTo('text'); } },
  { name: 'documentCollection', build: (t) => { t.string('documentCollection').defaultTo(''); } },
  { name: 'documentId', build: (t) => { t.string('documentId').defaultTo(''); } },
  { name: 'rangeMin', build: (t) => { t.integer('rangeMin').defaultTo(1); } },
  { name: 'rangeMax', build: (t) => { t.integer('rangeMax').defaultTo(1); } },
  { name: 'description', build: (t) => { t.text('description').defaultTo(''); } },
];

export async function up(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasTable('roll_table_entries'))) return;
  for (const col of COLUMNS) {
    if (!(await knex.schema.hasColumn('roll_table_entries', col.name))) {
      await knex.schema.alterTable('roll_table_entries', col.build);
    }
  }
}

export async function down(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasTable('roll_table_entries'))) return;
  for (const col of COLUMNS) {
    if (await knex.schema.hasColumn('roll_table_entries', col.name)) {
      await knex.schema.alterTable('roll_table_entries', (t) => { t.dropColumn(col.name); });
    }
  }
}
