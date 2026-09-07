import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const noisesTableExists = await knex.schema.hasTable('noises');
  if (noisesTableExists) {
    const hiddenCol = await knex.schema.hasColumn('noises', 'hidden');
    if (!hiddenCol) {
      await knex.schema.alterTable('noises', (t) => {
        t.boolean('hidden').defaultTo(false);
      });
    }
    const darknessMinCol = await knex.schema.hasColumn('noises', 'darknessMin');
    if (!darknessMinCol) {
      await knex.schema.alterTable('noises', (t) => {
        t.float('darknessMin').defaultTo(0);
      });
    }
    const darknessMaxCol = await knex.schema.hasColumn('noises', 'darknessMax');
    if (!darknessMaxCol) {
      await knex.schema.alterTable('noises', (t) => {
        t.float('darknessMax').defaultTo(1);
      });
    }
    const wallsBlockCol = await knex.schema.hasColumn('noises', 'wallsBlock');
    if (!wallsBlockCol) {
      await knex.schema.alterTable('noises', (t) => {
        t.boolean('wallsBlock').defaultTo(false);
      });
    }
  }
}

export async function down(knex: Knex): Promise<void> {
  const noisesTableExists = await knex.schema.hasTable('noises');
  if (noisesTableExists) {
    const cols = ['hidden', 'darknessMin', 'darknessMax', 'wallsBlock'];
    for (const col of cols) {
      const hasCol = await knex.schema.hasColumn('noises', col);
      if (hasCol) {
        try {
          await knex.schema.alterTable('noises', (t) => {
            t.dropColumn(col);
          });
        } catch {
          // ignore
        }
      }
    }
  }
}
