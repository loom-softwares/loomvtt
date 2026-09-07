import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Add drawings and macros tables if they don't exist
  const drawingsExists = await knex.schema.hasTable('drawings');
  if (!drawingsExists) {
    await knex.schema.createTable('drawings', (t) => {
      t.string('id').primary();
      t.string('stageId').notNullable().references('id').inTable('stages');
      t.string('type').defaultTo('rectangle');
      t.float('x').defaultTo(0);
      t.float('y').defaultTo(0);
      t.float('width').defaultTo(100);
      t.float('height').defaultTo(100);
      t.float('rotation').defaultTo(0);
      t.float('z').defaultTo(0);
      t.string('fillColor').defaultTo('#000000');
      t.float('fillOpacity').defaultTo(0.3);
      t.string('strokeColor').defaultTo('#ffffff');
      t.integer('strokeWidth').defaultTo(1);
      t.text('text').defaultTo('');
      t.string('fontFamily').defaultTo('Arial');
      t.integer('fontSize').defaultTo(16);
      t.text('points').defaultTo('[]');
      t.string('imgUrl').defaultTo('');
      t.boolean('isHidden').defaultTo(false);
      t.boolean('isLocked').defaultTo(false);
      t.string('authorId').defaultTo('');
      t.timestamps(true, true, true);
    });
  }

  const macrosExists = await knex.schema.hasTable('macros');
  if (!macrosExists) {
    await knex.schema.createTable('macros', (t) => {
      t.string('id').primary();
      t.string('worldId').notNullable().references('id').inTable('worlds');
      t.string('name').notNullable();
      t.string('type').defaultTo('chat');
      t.text('command').defaultTo('');
      t.string('imgUrl').defaultTo('');
      t.integer('slot').defaultTo(-1);
      t.text('ownership').defaultTo('{}');
      t.string('folderId').defaultTo('');
      t.timestamps(true, true, true);
    });
  }

  // Add indexes for new tables
  if (knex.client.config.client === 'sqlite3') {
    if (drawingsExists) {
      const drawingIndexes = await knex.raw(`PRAGMA index_list('drawings')`);
      if (!drawingIndexes.some((r: any) => r.name === 'idx_drawings_stageId')) {
        await knex.schema.alterTable('drawings', (t) => {
          t.index(['stageId'], 'idx_drawings_stageId');
        });
      }
    }

    if (macrosExists) {
      const macroIndexes = await knex.raw(`PRAGMA index_list('macros')`);
      if (!macroIndexes.some((r: any) => r.name === 'idx_macros_worldId')) {
        await knex.schema.alterTable('macros', (t) => {
          t.index(['worldId'], 'idx_macros_worldId');
        });
      }
    }
  }
}

export async function down(knex: Knex): Promise<void> {
  // Drop indexes
  if (knex.client.config.client === 'sqlite3') {
    try {
      await knex.raw('DROP INDEX IF EXISTS idx_drawings_stageId');
      await knex.raw('DROP INDEX IF EXISTS idx_macros_worldId');
    } catch (error) {
      // Ignore errors when dropping indexes
    }
  }

  // Drop tables
  await knex.schema.dropTableIfExists('macros');
  await knex.schema.dropTableIfExists('drawings');
}