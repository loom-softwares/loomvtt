import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // 1. Create packages table for module manifests
  const packagesExists = await knex.schema.hasTable('packages');
  if (!packagesExists) {
    await knex.schema.createTable('packages', (t) => {
      t.string('id').primary();
      t.string('name').notNullable();
      t.string('type').notNullable().defaultTo('module'); // 'module', 'system', 'world'
      t.string('version').notNullable().defaultTo('1.0.0');
      t.text('description').defaultTo('');
      t.text('manifest').defaultTo('{}'); // JSON manifest data
      t.string('author').defaultTo('');
      t.string('authorUrl').defaultTo('');
      t.string('license').defaultTo('');
      t.string('url').defaultTo('');
      t.string('downloadUrl').defaultTo('');
      t.integer('downloadCount').defaultTo(0);
      t.boolean('isCompatible').defaultTo(true);
      t.string('minVersion').defaultTo('0.0.0');
      t.string('maxVersion').defaultTo('999.999.999');
      t.string('compatibility').defaultTo('1.0.0'); // JSON compatibility info
      t.boolean('isActive').defaultTo(false);
      t.timestamp('installedAt').defaultTo(knex.fn.now());
      t.timestamp('updatedAt').defaultTo(knex.fn.now());
      t.timestamps(true, true, true);
    });
  }

  // 2. Create world_packages table for world-package associations
  const worldPackagesExists = await knex.schema.hasTable('world_packages');
  if (!worldPackagesExists) {
    await knex.schema.createTable('world_packages', (t) => {
      t.string('id').primary();
      t.string('worldId').notNullable().references('id').inTable('worlds');
      t.string('packageId').notNullable().references('id').inTable('packages');
      t.boolean('enabled').defaultTo(true);
      t.integer('loadOrder').defaultTo(0);
      t.text('config').defaultTo('{}'); // World-specific package configuration
      t.timestamp('installedAt').defaultTo(knex.fn.now());
      t.timestamp('updatedAt').defaultTo(knex.fn.now());
      t.unique(['worldId', 'packageId']); // Ensure unique world-package relationship
    });
  }

  // 3. Create indexes for performance
  if (knex.client.config.client === 'sqlite3') {
    // Index for packages table
    const packagesTableExists = await knex.schema.hasTable('packages');
    if (packagesTableExists) {
      const packagesIndexExists = await knex.raw(`PRAGMA index_list('packages')`);
      if (!packagesIndexExists.some((r: any) => r.name === 'idx_packages_name')) {
        await knex.schema.alterTable('packages', (t) => {
          t.index(['name'], 'idx_packages_name');
          t.index(['type'], 'idx_packages_type');
          t.index(['version'], 'idx_packages_version');
          t.index(['isCompatible'], 'idx_packages_isCompatible');
        });
      }
    }

    // Index for world_packages table
    const worldPackagesTableExists = await knex.schema.hasTable('world_packages');
    if (worldPackagesTableExists) {
      const worldPackagesIndexExists = await knex.raw(`PRAGMA index_list('world_packages')`);
      if (!worldPackagesIndexExists.some((r: any) => r.name === 'idx_world_packages_worldId')) {
        await knex.schema.alterTable('world_packages', (t) => {
          t.index(['worldId'], 'idx_world_packages_worldId');
          t.index(['packageId'], 'idx_world_packages_packageId');
          t.index(['enabled'], 'idx_world_packages_enabled');
          t.index(['loadOrder'], 'idx_world_packages_loadOrder');
        });
      }
    }
  }

  // 4. Add package management columns to existing worlds table
  const worldsTableExists = await knex.schema.hasTable('worlds');
  if (worldsTableExists) {
    const packagesColumnExists = await knex.schema.hasColumn('worlds', 'packageIds');
    if (!packagesColumnExists) {
      await knex.schema.alterTable('worlds', (t) => {
        t.text('packageIds').defaultTo('[]'); // JSON array of enabled package IDs
        t.text('packageConfig').defaultTo('{}'); // JSON world-level package configuration
      });
    }
  }

  // 5. Migrate existing data to new structure (if needed)
  try {
    // Get all existing worlds
    const worlds = await knex('worlds').select('id', 'name');
    
    for (const world of worlds) {
      // Create a default package for the world itself
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

      // Associate world with its package
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
    }
  } catch (error) {
    console.warn('Data migration warning:', error);
    // Continue even if migration fails - it's not critical
  }
}

export async function down(knex: Knex): Promise<void> {
  // Drop indexes first
  if (knex.client.config.client === 'sqlite3') {
    try {
      await knex.raw('DROP INDEX IF EXISTS idx_packages_name');
      await knex.raw('DROP INDEX IF EXISTS idx_packages_type');
      await knex.raw('DROP INDEX IF EXISTS idx_packages_version');
      await knex.raw('DROP INDEX IF EXISTS idx_packages_isCompatible');
      await knex.raw('DROP INDEX IF EXISTS idx_world_packages_worldId');
      await knex.raw('DROP INDEX IF EXISTS idx_world_packages_packageId');
      await knex.raw('DROP INDEX IF EXISTS idx_world_packages_enabled');
      await knex.raw('DROP INDEX IF EXISTS idx_world_packages_loadOrder');
    } catch (error) {
      // Ignore errors when dropping indexes
    }
  }

  // Drop tables in reverse order
  await knex.schema.dropTableIfExists('world_packages');
  await knex.schema.dropTableIfExists('packages');
  
  // Remove added columns from worlds table
  const worldsTableExists = await knex.schema.hasTable('worlds');
  if (worldsTableExists) {
    try {
      await knex.schema.alterTable('worlds', (t) => {
        t.dropColumn('packageIds');
        t.dropColumn('packageConfig');
      });
    } catch (error) {
      // Ignore errors if columns don't exist
    }
  }
}
