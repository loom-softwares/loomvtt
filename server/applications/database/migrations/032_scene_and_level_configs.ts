import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Update stages table
  if (await knex.schema.hasTable('stages')) {
    await knex.schema.alterTable('stages', (t) => {
      t.string('journalId').defaultTo('');
      t.string('journalPageId').defaultTo('');
      t.string('transitionType').defaultTo('fade');
      t.integer('transitionDuration').defaultTo(1500);
    });
  }

  // Update levels table
  if (await knex.schema.hasTable('levels')) {
    await knex.schema.alterTable('levels', (t) => {
      t.string('backgroundTint').defaultTo('#ffffff');
      t.float('alphaThreshold').defaultTo(0.75);
      t.string('foregroundUrl').defaultTo('');
      t.string('foregroundTint').defaultTo('#ffffff');
      t.string('fogExplorationUrl').defaultTo('');
      t.float('anchorX').defaultTo(0.5);
      t.float('anchorY').defaultTo(0.5);
      t.float('offsetX').defaultTo(0);
      t.float('offsetY').defaultTo(0);
      t.float('scaleX').defaultTo(1);
      t.float('scaleY').defaultTo(1);
      t.string('fitMode').defaultTo('fill');
      t.float('rotation').defaultTo(0);
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  if (await knex.schema.hasTable('stages')) {
    await knex.schema.alterTable('stages', (t) => {
      t.dropColumn('journalId');
      t.dropColumn('journalPageId');
      t.dropColumn('transitionType');
      t.dropColumn('transitionDuration');
    });
  }

  if (await knex.schema.hasTable('levels')) {
    await knex.schema.alterTable('levels', (t) => {
      t.dropColumns(
        'backgroundTint',
        'alphaThreshold',
        'foregroundUrl',
        'foregroundTint',
        'fogExplorationUrl',
        'anchorX',
        'anchorY',
        'offsetX',
        'offsetY',
        'scaleX',
        'scaleY',
        'fitMode',
        'rotation'
      );
    });
  }
}
