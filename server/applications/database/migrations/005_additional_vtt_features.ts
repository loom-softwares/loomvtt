import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // 1. buffs table
  if (!(await knex.schema.hasTable('buffs'))) {
    await knex.schema.createTable('buffs', (t) => {
      t.string('id').primary();
      t.string('worldId').notNullable();
      t.string('actorId').notNullable();
      t.string('name').notNullable();
      t.string('icon').defaultTo('');
      t.string('origin').defaultTo('');
      t.integer('duration').defaultTo(-1);
      t.boolean('disabled').defaultTo(false);
      t.text('changes').defaultTo('[]');
      t.timestamps(true, true, true);
    });
  }

  // 2. zones table
  if (!(await knex.schema.hasTable('zones'))) {
    await knex.schema.createTable('zones', (t) => {
      t.string('id').primary();
      t.string('stageId').notNullable();
      t.string('name').notNullable();
      t.string('shape').defaultTo('rect');
      t.integer('x').defaultTo(0);
      t.integer('y').defaultTo(0);
      t.integer('width').defaultTo(100);
      t.integer('height').defaultTo(100);
      t.text('points').defaultTo('[]');
      t.text('handlers').defaultTo('[]');
      t.timestamps(true, true, true);
    });
  }

  // 3. noises table
  if (!(await knex.schema.hasTable('noises'))) {
    await knex.schema.createTable('noises', (t) => {
      t.string('id').primary();
      t.string('stageId').notNullable();
      t.string('src').notNullable();
      t.integer('x').defaultTo(0);
      t.integer('y').defaultTo(0);
      t.integer('radius').defaultTo(100);
      t.float('volume').defaultTo(1.0);
      t.boolean('easing').defaultTo(true);
      t.timestamps(true, true, true);
    });
  }

  // 4. campaigns table
  if (!(await knex.schema.hasTable('campaigns'))) {
    await knex.schema.createTable('campaigns', (t) => {
      t.string('id').primary();
      t.string('name').notNullable();
      t.text('description').defaultTo('');
      t.text('manifest').defaultTo('{}');
      t.timestamps(true, true, true);
    });
  }

  // 5. decks table
  if (!(await knex.schema.hasTable('decks'))) {
    await knex.schema.createTable('decks', (t) => {
      t.string('id').primary();
      t.string('worldId').notNullable();
      t.string('name').notNullable();
      t.string('type').defaultTo('standard');
      t.text('cards').defaultTo('[]');
      t.text('state').defaultTo('{}');
      t.timestamps(true, true, true);
    });
  }

  // 6. fog_reveals table
  if (!(await knex.schema.hasTable('fog_reveals'))) {
    await knex.schema.createTable('fog_reveals', (t) => {
      t.string('id').primary();
      t.string('stageId').notNullable();
      t.string('userId').notNullable();
      t.text('explored').defaultTo('[]');
      t.timestamps(true, true, true);
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('fog_reveals');
  await knex.schema.dropTableIfExists('decks');
  await knex.schema.dropTableIfExists('campaigns');
  await knex.schema.dropTableIfExists('noises');
  await knex.schema.dropTableIfExists('zones');
  await knex.schema.dropTableIfExists('buffs');
}
