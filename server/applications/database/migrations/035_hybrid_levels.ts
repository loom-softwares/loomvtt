import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const tablesWithElevation = ['ambient_lights', 'noises', 'drawings', 'notes'];
  
  // Update Walls
  if (await knex.schema.hasTable('walls')) {
    await knex.schema.alterTable('walls', (t) => {
      t.string('levelId').defaultTo('');
    });
    if (await knex.schema.hasColumn('walls', 'bottomElevation')) {
      await knex.schema.alterTable('walls', (t) => t.dropColumn('bottomElevation'));
    }
    if (await knex.schema.hasColumn('walls', 'topElevation')) {
      await knex.schema.alterTable('walls', (t) => t.dropColumn('topElevation'));
    }
  }

  // Update Others
  for (const table of tablesWithElevation) {
    if (await knex.schema.hasTable(table)) {
      await knex.schema.alterTable(table, (t) => {
        t.string('levelId').defaultTo('');
      });
      if (await knex.schema.hasColumn(table, 'elevation')) {
        await knex.schema.alterTable(table, (t) => t.dropColumn('elevation'));
      }
    }
  }
}

export async function down(knex: Knex): Promise<void> {
  // Downgrade Walls
  if (await knex.schema.hasTable('walls')) {
    await knex.schema.alterTable('walls', (t) => {
      t.float('bottomElevation').defaultTo(-1000);
      t.float('topElevation').defaultTo(1000);
    });
    if (await knex.schema.hasColumn('walls', 'levelId')) {
      await knex.schema.alterTable('walls', (t) => t.dropColumn('levelId'));
    }
  }

  // Downgrade Others
  const tablesWithElevation = ['ambient_lights', 'noises', 'drawings', 'notes'];
  for (const table of tablesWithElevation) {
    if (await knex.schema.hasTable(table)) {
      await knex.schema.alterTable(table, (t) => {
        t.float('elevation').defaultTo(0);
      });
      if (await knex.schema.hasColumn(table, 'levelId')) {
        await knex.schema.alterTable(table, (t) => t.dropColumn('levelId'));
      }
    }
  }
}
