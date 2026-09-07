import type { Knex } from 'knex';

/**
 * `levelId` em `tiles` e `cast`.
 *
 * Modelo: a Stage e um GRUPO; quem e a cena de verdade e o Level. Tudo que se
 * ve na tela pertence a um andar — nao so as estruturas fixas.
 *
 * A 035_hybrid_levels deu `levelId` a walls, ambient_lights, noises, drawings e
 * notes, mas deixou tiles e cast de fora: eles ficaram sendo filtrados por
 * `elevation` (Z). Na pratica isso nunca separou andar nenhum, porque exige que
 * alguem mantenha o numero de elevacao de cada tile e token na mao. O resultado
 * era token aparecendo em todos os andares e tile vazando de uma subcena pra
 * outra.
 *
 * `elevation` continua existindo e nao e tocado aqui — ele segue servindo para
 * ordenacao e para o teleporte. So deixa de mandar em quem aparece.
 */

const TABLES = ['tiles', 'cast'] as const;

export async function up(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasTable('levels'))) return;

  // 1. Coluna, se ainda nao existir.
  for (const table of TABLES) {
    if (!(await knex.schema.hasTable(table))) continue;
    if (await knex.schema.hasColumn(table, 'levelId')) continue;
    await knex.schema.alterTable(table, (t) => {
      t.string('levelId').notNullable().defaultTo('');
    });
  }

  // 2. Backfill: cada registro orfao e adotado pelo andar base da sua stage.
  const stages = await knex('levels')
    .select('stageId')
    .min({ bottom: 'bottomElevation' })
    .groupBy('stageId');

  for (const { stageId, bottom } of stages as Array<{ stageId: string; bottom: number }>) {
    const baseLevel = await knex('levels')
      .where({ stageId, bottomElevation: bottom })
      .first();
    if (!baseLevel) continue;

    for (const table of TABLES) {
      if (!(await knex.schema.hasTable(table))) continue;
      if (!(await knex.schema.hasColumn(table, 'levelId'))) continue;
      if (!(await knex.schema.hasColumn(table, 'stageId'))) continue;

      // So adota orfao. Quem ja tem andar (criado depois, ou movido pelo GM)
      // nao pode ser puxado de volta pro terreo.
      await knex(table)
        .where({ stageId })
        .where((qb) => qb.whereNull('levelId').orWhere('levelId', ''))
        .update({ levelId: baseLevel.id });
    }
  }
}

export async function down(knex: Knex): Promise<void> {
  // Remove a coluna inteira: ela nasceu nesta migration, entao nao ha estado
  // anterior a preservar (diferente da 036, que so preenchia coluna existente).
  for (const table of TABLES) {
    if (!(await knex.schema.hasTable(table))) continue;
    if (!(await knex.schema.hasColumn(table, 'levelId'))) continue;
    await knex.schema.alterTable(table, (t) => {
      t.dropColumn('levelId');
    });
  }
}
