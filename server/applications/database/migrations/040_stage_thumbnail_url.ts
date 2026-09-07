import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  if (await knex.schema.hasTable('stages')) {
    const hasThumbnail = await knex.schema.hasColumn('stages', 'thumbnailUrl');
    if (!hasThumbnail) {
      await knex.schema.alterTable('stages', (table) => {
        table.string('thumbnailUrl').nullable().defaultTo('');
      });
    }
  }
}

export async function down(knex: Knex): Promise<void> {
  if (await knex.schema.hasTable('stages')) {
    const hasThumbnail = await knex.schema.hasColumn('stages', 'thumbnailUrl');
    if (hasThumbnail) {
      await knex.schema.alterTable('stages', (table) => {
        table.dropColumn('thumbnailUrl');
      });
    }
  }
}
