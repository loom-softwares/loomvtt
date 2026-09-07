import type { Knex } from 'knex';

const TABLES = [
  {
    name: 'worlds',
    columns: (t: Knex.CreateTableBuilder) => {
      t.string('id').primary();
      t.string('name').notNullable();
      t.string('system').defaultTo('generic');
      t.text('description').defaultTo('');
      t.string('coverUrl').defaultTo('');
      t.string('language').defaultTo('en');
      t.string('adminPassword').defaultTo('');
      t.boolean('isActive').defaultTo(false);
      t.text('packageIds').defaultTo('[]');
      t.text('packageConfig').defaultTo('{}');
      t.timestamps(true, true, true);
    }
  },
  {
    name: 'users',
    columns: (t: Knex.CreateTableBuilder) => {
      t.string('id').primary();
      t.string('worldId').notNullable().references('id').inTable('worlds');
      t.string('name').notNullable();
      t.integer('role').defaultTo(1);
      t.string('password').defaultTo('');
      t.string('color').defaultTo('#4f46e5');
      t.string('colorHex').defaultTo('#4f46e5');
      t.string('avatarUrl').defaultTo('');
      t.string('pronouns').defaultTo('');
      t.string('actorId').defaultTo('');
      t.string('lastLogin').defaultTo('');
      t.timestamps(true, true, true);
    }
  },
  {
    name: 'cast',
    columns: (t: Knex.CreateTableBuilder) => {
      t.string('id').primary();
      t.string('worldId').defaultTo('world-1');
      t.string('name').notNullable();
      t.string('kind').defaultTo('adventurer');
      t.text('traits').defaultTo('{}');
      t.integer('x').defaultTo(100);
      t.integer('y').defaultTo(100);
      t.string('colorHex').defaultTo('#e74c3c');
      t.string('avatarUrl').defaultTo('');
      t.string('ringColor').defaultTo('#e74c3c');
      t.string('shape').defaultTo('circle');
      t.text('effects').defaultTo('[]');
      t.text('statusMarkers').defaultTo('[]');
      t.text('systemData').defaultTo('{}');
      t.string('actorId').defaultTo('');
      t.boolean('isLinked').defaultTo(false);
      t.text('ownership').defaultTo('{}');
      t.string('folderId').defaultTo('');
      t.timestamps(true, true, true);
    }
  },
  {
    name: 'stages',
    columns: (t: Knex.CreateTableBuilder) => {
      t.string('id').primary();
      t.string('worldId').defaultTo('world-1');
      t.string('name').notNullable();
      t.string('backgroundUrl').defaultTo('');
      t.integer('gridSize').defaultTo(50);
      t.string('gridColor').defaultTo('#ffffff');
      t.string('navigationName').defaultTo('');
      t.boolean('showInNavigation').defaultTo(false);
      t.float('darknessLevel').defaultTo(0);
      t.string('weatherEffect').defaultTo('none');
      t.float('gridDistance').defaultTo(5);
      t.string('gridUnit').defaultTo('ft');
      t.string('gridStyle').defaultTo('solid');
      t.float('gridOpacity').defaultTo(0.2);
      t.integer('padding').defaultTo(0);
      t.integer('offsetX').defaultTo(0);
      t.integer('offsetY').defaultTo(0);
      t.boolean('isActive').defaultTo(false);
      t.integer('width').defaultTo(3000);
      t.integer('height').defaultTo(2000);
      t.string('ambientPlaylistId').defaultTo('');
      t.text('ownership').defaultTo('{}');
      t.string('folderId').defaultTo('');
      t.timestamps(true, true, true);
    }
  },
  {
    name: 'actors',
    columns: (t: Knex.CreateTableBuilder) => {
      t.string('id').primary();
      t.string('worldId').notNullable().references('id').inTable('worlds');
      t.string('name').notNullable();
      t.string('type').defaultTo('character');
      t.string('avatarUrl').defaultTo('');
      t.text('systemData').defaultTo('{}');
      t.text('ownership').defaultTo('{}');
      t.string('folderId').defaultTo('');
      t.timestamps(true, true, true);
    }
  },
  {
    name: 'tiles',
    columns: (t: Knex.CreateTableBuilder) => {
      t.string('id').primary();
      t.string('stageId').notNullable();
      t.string('name').notNullable();
      t.integer('x').defaultTo(0);
      t.integer('y').defaultTo(0);
      t.integer('width').defaultTo(100);
      t.integer('height').defaultTo(100);
      t.string('imgUrl').defaultTo('');
      t.boolean('isActive').defaultTo(true);
      t.text('triggers').defaultTo('[]');
      t.text('conditions').defaultTo('[]');
      t.text('actions').defaultTo('[]');
      t.timestamps(true, true, true);
    }
  },
  {
    name: 'journals',
    columns: (t: Knex.CreateTableBuilder) => {
      t.string('id').primary();
      t.string('worldId').notNullable();
      t.string('name').notNullable();
      t.text('content').defaultTo('');
      t.string('folderId').defaultTo('');
      t.boolean('isPinned').defaultTo(false);
      t.integer('pinX').defaultTo(0);
      t.integer('pinY').defaultTo(0);
      t.text('ownership').defaultTo('{}');
      t.timestamps(true, true, true);
    }
  },
  {
    name: 'items',
    columns: (t: Knex.CreateTableBuilder) => {
      t.string('id').primary();
      t.string('worldId').notNullable();
      t.string('name').notNullable();
      t.string('type').defaultTo('equipment');
      t.text('data').defaultTo('{}');
      t.string('imgUrl').defaultTo('');
      t.text('ownership').defaultTo('{}');
      t.string('folderId').defaultTo('');
      t.timestamps(true, true, true);
    }
  },
  {
    name: 'combats',
    columns: (t: Knex.CreateTableBuilder) => {
      t.string('id').primary();
      t.string('worldId').notNullable();
      t.integer('round').defaultTo(1);
      t.integer('currentTurn').defaultTo(0);
      t.text('combatants').defaultTo('[]');
      t.boolean('isActive').defaultTo(false);
      t.timestamps(true, true, true);
    }
  },
  {
    name: 'chat_messages',
    columns: (t: Knex.CreateTableBuilder) => {
      t.string('id').primary();
      t.string('worldId').notNullable();
      t.string('userId').defaultTo('system');
      t.string('userName').defaultTo('System');
      t.string('userColor').defaultTo('#888');
      t.string('type').defaultTo('chat');
      t.text('content').notNullable();
      t.text('rollData').defaultTo('null');
      t.timestamps(true, true, true);
    }
  },
  {
    name: 'macros',
    columns: (t: Knex.CreateTableBuilder) => {
      t.string('id').primary();
      t.string('worldId').notNullable();
      t.string('name').notNullable();
      t.string('type').defaultTo('chat');
      t.text('command').defaultTo('');
      t.string('imgUrl').defaultTo('');
      t.integer('slot').defaultTo(-1);
      t.text('ownership').defaultTo('{}');
      t.string('folderId').defaultTo('');
      t.timestamps(true, true, true);
    }
  },
  {
    name: 'walls',
    columns: (t: Knex.CreateTableBuilder) => {
      t.string('id').primary();
      t.string('stageId').notNullable().references('id').inTable('stages');
      t.float('x1').defaultTo(0);
      t.float('y1').defaultTo(0);
      t.float('x2').defaultTo(0);
      t.float('y2').defaultTo(0);
      t.boolean('sight').defaultTo(true);
      t.boolean('light').defaultTo(true);
      t.boolean('movement').defaultTo(true);
      t.boolean('sound').defaultTo(true);
      t.integer('direction').defaultTo(0);
      t.integer('door').defaultTo(0);
      t.integer('doorState').defaultTo(0);
      t.timestamps(true, true, true);
    }
  },
  {
    name: 'notes',
    columns: (t: Knex.CreateTableBuilder) => {
      t.string('id').primary();
      t.string('stageId').notNullable().references('id').inTable('stages');
      t.string('journalId').defaultTo('');
      t.float('x').defaultTo(0);
      t.float('y').defaultTo(0);
      t.boolean('visibleToPlayers').defaultTo(false);
      t.timestamps(true, true, true);
    }
  },
  {
    name: 'settings',
    columns: (t: Knex.CreateTableBuilder) => {
      t.string('key').primary();
      t.text('value').defaultTo('{}');
      t.timestamps(true, true, true);
    }
  },
  {
    name: 'roll_tables',
    columns: (t: Knex.CreateTableBuilder) => {
      t.string('id').primary();
      t.string('worldId').notNullable().references('id').inTable('worlds');
      t.string('name').notNullable();
      t.text('description').defaultTo('');
      t.string('formula').defaultTo('1d20');
      t.integer('sortMode').defaultTo(0);
      t.string('imgUrl').defaultTo('');
      t.integer('replacement').defaultTo(1);
      t.text('ownership').defaultTo('{}');
      t.string('folderId').defaultTo('');
      t.timestamps(true, true, true);
    }
  },
  {
    name: 'roll_table_entries',
    columns: (t: Knex.CreateTableBuilder) => {
      t.string('id').primary();
      t.string('rollTableId').notNullable().references('id').inTable('roll_tables');
      t.text('text').defaultTo('');
      t.text('imgUrl').defaultTo('');
      t.integer('weight').defaultTo(1);
      t.string('collectionId').defaultTo('');
      t.string('drawn').defaultTo('NONE');
      t.timestamps(true, true, true);
    }
  },
  {
    name: 'drawings',
    columns: (t: Knex.CreateTableBuilder) => {
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
    }
  },
  {
    name: 'compendium_packs',
    columns: (t: Knex.CreateTableBuilder) => {
      t.string('id').primary();
      t.string('worldId').notNullable();
      t.string('name').notNullable();
      t.string('type').defaultTo('Actor');
      t.text('entries').defaultTo('[]');
      t.text('ownership').defaultTo('{}');
      t.string('folderId').defaultTo('');
      t.timestamps(true, true, true);
    }
  },
  {
    name: 'folders',
    columns: (t: Knex.CreateTableBuilder) => {
      t.string('id').primary();
      t.string('worldId').notNullable().references('id').inTable('worlds');
      t.string('name').notNullable();
      t.string('type').notNullable();
      t.string('parent').defaultTo('');
      t.string('sorting').defaultTo('m');
      t.string('color').defaultTo('');
      t.timestamps(true, true, true);
    }
  },
  {
    name: 'ambient_lights',
    columns: (t: Knex.CreateTableBuilder) => {
      t.string('id').primary();
      t.string('stageId').notNullable().references('id').inTable('stages');
      t.float('x').defaultTo(0);
      t.float('y').defaultTo(0);
      t.float('radius').defaultTo(200);
      t.string('color').defaultTo('#ffdd88');
      t.float('intensity').defaultTo(0.5);
      t.float('rotation').defaultTo(0);
      t.string('animation').defaultTo('none');
      t.float('darknessMin').defaultTo(0);
      t.float('darknessMax').defaultTo(1);
      t.boolean('isHidden').defaultTo(false);
      t.float('bright').defaultTo(100);
      t.float('dim').defaultTo(200);
      t.float('angle').defaultTo(360);
      t.boolean('walls').defaultTo(true);
      t.boolean('vision').defaultTo(false);
      t.float('animationSpeed').defaultTo(5);
      t.float('animationIntensity').defaultTo(5);
      t.timestamps(true, true, true);
    }
  },
  {
    name: 'playlists',
    columns: (t: Knex.CreateTableBuilder) => {
      t.string('id').primary();
      t.string('worldId').notNullable().references('id').inTable('worlds');
      t.string('name').notNullable();
      t.text('description').defaultTo('');
      t.string('imgUrl').defaultTo('');
      t.string('mode').defaultTo('sequential');
      t.float('volume').defaultTo(0.5);
      t.boolean('loop').defaultTo(false);
      t.float('fadeDuration').defaultTo(2);
      t.string('folderId').defaultTo('');
      t.text('ownership').defaultTo('{}');
      t.timestamps(true, true, true);
    }
  },
  {
    name: 'playlist_sounds',
    columns: (t: Knex.CreateTableBuilder) => {
      t.string('id').primary();
      t.string('playlistId').notNullable().references('id').inTable('playlists');
      t.string('name').notNullable();
      t.string('path').notNullable();
      t.float('volume').defaultTo(0.5);
      t.boolean('loop').defaultTo(false);
      t.float('fadeIn').defaultTo(0);
      t.float('fadeOut').defaultTo(0);
      t.integer('sortOrder').defaultTo(0);
      t.timestamps(true, true, true);
    }
  },
  {
    name: 'packages',
    columns: (t: Knex.CreateTableBuilder, knex: any) => {
      t.string('id').primary();
      t.string('name').notNullable();
      t.string('type').notNullable().defaultTo('module');
      t.string('version').notNullable().defaultTo('1.0.0');
      t.text('description').defaultTo('');
      t.text('manifest').defaultTo('{}');
      t.string('author').defaultTo('');
      t.string('authorUrl').defaultTo('');
      t.string('license').defaultTo('');
      t.string('url').defaultTo('');
      t.string('downloadUrl').defaultTo('');
      t.integer('downloadCount').defaultTo(0);
      t.boolean('isCompatible').defaultTo(true);
      t.string('minVersion').defaultTo('0.0.0');
      t.string('maxVersion').defaultTo('999.999.999');
      t.string('compatibility').defaultTo('1.0.0');
      t.boolean('isActive').defaultTo(false);
      t.timestamp('installedAt').defaultTo(knex.fn.now());
      t.timestamps(true, true, true);
    }
  },
  {
    name: 'world_packages',
    columns: (t: Knex.CreateTableBuilder, knex: any) => {
      t.string('id').primary();
      t.string('worldId').notNullable().references('id').inTable('worlds');
      t.string('packageId').notNullable().references('id').inTable('packages');
      t.boolean('enabled').defaultTo(true);
      t.integer('loadOrder').defaultTo(0);
      t.text('config').defaultTo('{}');
      t.timestamp('installedAt').defaultTo(knex.fn.now());
      t.unique(['worldId', 'packageId']);
      t.timestamps(true, true, true);
    }
  }
];

const ADD_COLUMN_MIGRATIONS: { table: string; column: string; type: string; default: any }[] = [
  { table: 'cast', column: 'ownership', type: 'text', default: '{}' },
  { table: 'cast', column: 'folderId', type: 'string', default: '' },
  { table: 'actors', column: 'ownership', type: 'text', default: '{}' },
  { table: 'actors', column: 'folderId', type: 'string', default: '' },
  { table: 'items', column: 'ownership', type: 'text', default: '{}' },
  { table: 'items', column: 'folderId', type: 'string', default: '' },
  { table: 'stages', column: 'ownership', type: 'text', default: '{}' },
  { table: 'stages', column: 'folderId', type: 'string', default: '' },
  { table: 'journals', column: 'ownership', type: 'text', default: '{}' },
  { table: 'roll_tables', column: 'ownership', type: 'text', default: '{}' },
  { table: 'roll_tables', column: 'folderId', type: 'string', default: '' },
  { table: 'macros', column: 'ownership', type: 'text', default: '{}' },
  { table: 'macros', column: 'folderId', type: 'string', default: '' },
  { table: 'compendium_packs', column: 'ownership', type: 'text', default: '{}' },
  { table: 'compendium_packs', column: 'folderId', type: 'string', default: '' },
  { table: 'cast', column: 'stageId', type: 'string', default: 'stage-1' },
  { table: 'cast', column: 'actorId', type: 'string', default: '' },
  { table: 'cast', column: 'isLinked', type: 'boolean', default: false },
  { table: 'cast', column: 'worldId', type: 'string', default: 'world-1' },
  { table: 'cast', column: 'kind', type: 'string', default: 'adventurer' },
  { table: 'cast', column: 'traits', type: 'text', default: '{}' },
  { table: 'cast', column: 'avatarUrl', type: 'string', default: '' },
  { table: 'cast', column: 'ringColor', type: 'string', default: '#e74c3c' },
  { table: 'cast', column: 'shape', type: 'string', default: 'circle' },
  { table: 'cast', column: 'effects', type: 'text', default: '[]' },
  { table: 'cast', column: 'statusMarkers', type: 'text', default: '[]' },
  { table: 'cast', column: 'systemData', type: 'text', default: '{}' },
  { table: 'users', column: 'colorHex', type: 'string', default: '#4f46e5' },
  { table: 'users', column: 'pronouns', type: 'string', default: '' },
  { table: 'users', column: 'actorId', type: 'string', default: '' },
  { table: 'stages', column: 'worldId', type: 'string', default: 'world-1' },
  { table: 'stages', column: 'gridColor', type: 'string', default: '#ffffff' },
  { table: 'stages', column: 'navigationName', type: 'string', default: '' },
  { table: 'stages', column: 'showInNavigation', type: 'boolean', default: false },
  { table: 'stages', column: 'darknessLevel', type: 'float', default: 0 },
  { table: 'stages', column: 'weatherEffect', type: 'string', default: 'none' },
  { table: 'stages', column: 'gridDistance', type: 'float', default: 5 },
  { table: 'stages', column: 'gridUnit', type: 'string', default: 'ft' },
  { table: 'stages', column: 'gridStyle', type: 'string', default: 'solid' },
  { table: 'stages', column: 'gridOpacity', type: 'float', default: 0.2 },
  { table: 'stages', column: 'padding', type: 'integer', default: 0 },
  { table: 'stages', column: 'offsetX', type: 'integer', default: 0 },
  { table: 'stages', column: 'offsetY', type: 'integer', default: 0 },
  { table: 'ambient_lights', column: 'bright', type: 'float', default: 100 },
  { table: 'ambient_lights', column: 'dim', type: 'float', default: 200 },
  { table: 'ambient_lights', column: 'angle', type: 'float', default: 360 },
  { table: 'ambient_lights', column: 'walls', type: 'boolean', default: true },
  { table: 'ambient_lights', column: 'vision', type: 'boolean', default: false },
  { table: 'ambient_lights', column: 'animationSpeed', type: 'float', default: 5 },
  { table: 'ambient_lights', column: 'animationIntensity', type: 'float', default: 5 },
  { table: 'journals', column: 'folderId', type: 'string', default: '' },
];

const INDEXES = [
  { table: 'cast', columns: ['worldId'] },
  { table: 'stages', columns: ['worldId'] },
  { table: 'actors', columns: ['worldId'] },
  { table: 'users', columns: ['worldId'] },
  { table: 'tiles', columns: ['stageId'] },
  { table: 'combats', columns: ['worldId'] },
  { table: 'chat_messages', columns: ['worldId'] },
  { table: 'journals', columns: ['worldId'] },
  { table: 'items', columns: ['worldId'] },
  { table: 'macros', columns: ['worldId'] },
  { table: 'compendium_packs', columns: ['worldId'] },
  { table: 'folders', columns: ['worldId'] },
  { table: 'walls', columns: ['stageId'] },
  { table: 'notes', columns: ['stageId'] },
  { table: 'roll_tables', columns: ['worldId'] },
  { table: 'roll_table_entries', columns: ['rollTableId'] },
  { table: 'drawings', columns: ['stageId'] },
  { table: 'packages', columns: ['name'] },
  { table: 'packages', columns: ['type'] },
  { table: 'packages', columns: ['version'] },
  { table: 'packages', columns: ['isCompatible'] },
  { table: 'world_packages', columns: ['worldId'] },
  { table: 'world_packages', columns: ['packageId'] },
  { table: 'world_packages', columns: ['enabled'] },
  { table: 'world_packages', columns: ['loadOrder'] },
  { table: 'stages', columns: ['width'] },
  { table: 'stages', columns: ['height'] },
];

export async function up(knex: Knex): Promise<void> {
  for (const { name, columns } of TABLES) {
    const exists = await knex.schema.hasTable(name);
    if (!exists) {
      await knex.schema.createTable(name, (t) => columns(t, knex));
    }
  }

  for (const { table, column, type, default: def } of ADD_COLUMN_MIGRATIONS) {
    const tableExists = await knex.schema.hasTable(table);
    if (tableExists) {
      const colExists = await knex.schema.hasColumn(table, column);
      if (!colExists) {
        await knex.schema.alterTable(table, (t) => {
          switch (type) {
            case 'string': t.string(column).defaultTo(def as string); break;
            case 'text': t.text(column).defaultTo(def as string); break;
            case 'integer': t.integer(column).defaultTo(def as number); break;
            case 'float': t.float(column).defaultTo(def as number); break;
            case 'boolean': t.boolean(column).defaultTo(def as boolean); break;
          }
        });
      }
    }
  }

  if (knex.client.config.client === 'sqlite3') {
    for (const { table, columns } of INDEXES) {
      const tableExists = await knex.schema.hasTable(table);
      if (!tableExists) continue;
      for (const col of columns) {
        const indexName = `idx_${table}_${col}`;
        const existing = await knex.raw(`PRAGMA index_list(??)`, [table]);
        if (!existing.some((r: any) => r.name === indexName)) {
          await knex.schema.alterTable(table, (t) => t.index([col], indexName));
        }
      }
    }
  }

  try {
    const worlds = await knex('worlds').select('id', 'name');

    for (const world of worlds) {
      const worldPackageId = `world-${world.id}`;
      const worldPackageExists = await knex('packages').where('id', worldPackageId).first();

      if (!worldPackageExists) {
        await knex('packages').insert({
          id: worldPackageId,
          name: `${world.name} (World Package)`,
          type: 'world',
          version: '1.0.0',
          description: `World package for ${world.name}`,
          manifest: '{}',
          isActive: true,
          installedAt: knex.fn.now(),
          updatedAt: knex.fn.now()
        });
      }

      const worldPackageAssociationExists = await knex('world_packages').where('worldId', world.id).where('packageId', worldPackageId).first();
      if (!worldPackageAssociationExists) {
        await knex('world_packages').insert({
          id: `wp-${world.id}-${worldPackageId}`,
          worldId: world.id,
          packageId: worldPackageId,
          enabled: true,
          loadOrder: 0,
          installedAt: knex.fn.now(),
          updatedAt: knex.fn.now()
        });
      }

      const packageIds = JSON.stringify([worldPackageId]);
      await knex('worlds').where('id', world.id).update({
        packageIds: packageIds,
        packageConfig: '{}',
        updatedAt: knex.fn.now()
      });
    }
  } catch (error) {
    console.warn('Data migration warning:', error);
  }
}

export async function down(knex: Knex): Promise<void> {
  if (knex.client.config.client === 'sqlite3') {
    try {
      for (const { table, columns } of INDEXES) {
        const tableExists = await knex.schema.hasTable(table);
        if (!tableExists) continue;
        for (const col of columns) {
          const indexName = `idx_${table}_${col}`;
          await knex.raw(`DROP INDEX IF EXISTS ${indexName}`);
        }
      }
    } catch (error) {
      // Ignore errors when dropping indexes
    }
  }

  for (const { name } of TABLES.reverse()) {
    await knex.schema.dropTableIfExists(name);
  }
}