import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Add scene dimensions to stages table
  const stagesTableExists = await knex.schema.hasTable('stages');
  if (stagesTableExists) {
    const widthColumnExists = await knex.schema.hasColumn('stages', 'width');
    if (!widthColumnExists) {
      await knex.schema.alterTable('stages', (t) => {
        t.integer('width').defaultTo(3000).after('navigationName');
        t.integer('height').defaultTo(2000).after('width');
      });
    }
  }

  // Add ambient playlist reference to stages
  const ambientPlaylistColumnExists = await knex.schema.hasColumn('stages', 'ambientPlaylistId');
  if (!ambientPlaylistColumnExists) {
    await knex.schema.alterTable('stages', (t) => {
      t.string('ambientPlaylistId').defaultTo('').after('height');
    });
  }

  // Add indexes for new columns
  if (knex.client.config.client === 'sqlite3') {
    const stagesTableExists = await knex.schema.hasTable('stages');
    if (stagesTableExists) {
      // Check if indexes exist before creating them
      const indexes = await knex.raw(`PRAGMA index_list('stages')`);
      
      if (!indexes.some((r: any) => r.name === 'idx_stages_width')) {
        await knex.schema.alterTable('stages', (t) => {
          t.index(['width'], 'idx_stages_width');
        });
      }
      
      if (!indexes.some((r: any) => r.name === 'idx_stages_height')) {
        await knex.schema.alterTable('stages', (t) => {
          t.index(['height'], 'idx_stages_height');
        });
      }
    }
  }
}

export async function down(knex: Knex): Promise<void> {
  // Remove indexes
  if (knex.client.config.client === 'sqlite3') {
    try {
      await knex.raw('DROP INDEX IF EXISTS idx_stages_width');
      await knex.raw('DROP INDEX IF EXISTS idx_stages_height');
    } catch (error) {
      // Ignore errors when dropping indexes
    }
  }

  // Remove columns
  const stagesTableExists = await knex.schema.hasTable('stages');
  if (stagesTableExists) {
    try {
      await knex.schema.alterTable('stages', (t) => {
        t.dropColumn('width');
        t.dropColumn('height');
        t.dropColumn('ambientPlaylistId');
      });
    } catch (error) {
      // Ignore errors if columns don't exist
    }
  }
}