import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Add ambient playlist reference to stages table
  const stagesTableExists = await knex.schema.hasTable('stages');
  if (stagesTableExists) {
    const ambientPlaylistColumnExists = await knex.schema.hasColumn('stages', 'ambientPlaylistId');
    if (!ambientPlaylistColumnExists) {
      await knex.schema.alterTable('stages', (t) => {
        t.string('ambientPlaylistId').defaultTo('').after('height');
      });
    }
  }
}

export async function down(knex: Knex): Promise<void> {
  const stagesTableExists = await knex.schema.hasTable('stages');
  if (stagesTableExists) {
    try {
      await knex.schema.alterTable('stages', (t) => {
        t.dropColumn('ambientPlaylistId');
      });
    } catch (error) {
      // Ignore errors if column doesn't exist
    }
  }
}