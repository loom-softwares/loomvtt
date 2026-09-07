import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const stagesTableExists = await knex.schema.hasTable('stages');
  if (stagesTableExists) {
    const cols = ['padding', 'offsetX', 'offsetY'];
    for (const col of cols) {
      const hasCol = await knex.schema.hasColumn('stages', col);
      if (!hasCol) {
        await knex.schema.alterTable('stages', (t) => {
          t.integer(col).defaultTo(0);
        });
      }
    }
  }
}

export async function down(knex: Knex): Promise<void> {
  const stagesTableExists = await knex.schema.hasTable('stages');
  if (stagesTableExists) {
    const cols = ['padding', 'offsetX', 'offsetY'];
    for (const col of cols) {
      const hasCol = await knex.schema.hasColumn('stages', col);
      if (hasCol) {
        try {
          await knex.schema.alterTable('stages', (t) => {
            t.dropColumn(col);
          });
        } catch {
          // ignore
        }
      }
    }
  }
}