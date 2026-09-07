import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Walls
  if (await knex.schema.hasTable('walls')) {
    if (!(await knex.schema.hasColumn('walls', 'bottomElevation'))) {
      await knex.schema.alterTable('walls', (t) => {
        t.float('bottomElevation').defaultTo(-1000);
      });
    }
    if (!(await knex.schema.hasColumn('walls', 'topElevation'))) {
      await knex.schema.alterTable('walls', (t) => {
        t.float('topElevation').defaultTo(1000);
      });
    }
  }

  // Others
  const tables = ['ambient_lights', 'noises', 'drawings', 'notes', 'tiles'];
  for (const table of tables) {
    if (await knex.schema.hasTable(table)) {
      if (!(await knex.schema.hasColumn(table, 'elevation'))) {
        await knex.schema.alterTable(table, (t) => {
          t.float('elevation').defaultTo(0);
        });
      }
    }
  }
}

export async function down(knex: Knex): Promise<void> {
  if (await knex.schema.hasTable('walls')) {
    if (await knex.schema.hasColumn('walls', 'bottomElevation')) {
      await knex.schema.alterTable('walls', (t) => t.dropColumn('bottomElevation'));
    }
    if (await knex.schema.hasColumn('walls', 'topElevation')) {
      await knex.schema.alterTable('walls', (t) => t.dropColumn('topElevation'));
    }
  }

  const tables = ['ambient_lights', 'noises', 'drawings', 'notes', 'tiles'];
  for (const table of tables) {
    if (await knex.schema.hasTable(table)) {
      if (await knex.schema.hasColumn(table, 'elevation')) {
        await knex.schema.alterTable(table, (t) => t.dropColumn('elevation'));
      }
    }
  }
}
