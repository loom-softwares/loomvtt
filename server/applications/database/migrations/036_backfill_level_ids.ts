import type { Knex } from 'knex';

/**
 * Backfill de `levelId` nos elementos de ambiente.
 *
 * A 035_hybrid_levels adicionou a coluna `levelId` com `defaultTo('')` mas nao
 * preencheu nada. Todo wall/light/noise/drawing/note que ja existia ficou com
 * string vazia, e o CanvasManager trata "sem levelId" como elemento global —
 * logo eles apareciam em TODOS os andares ao mesmo tempo, que era o bug de
 * "a subcena fica com os elementos da cena".
 *
 * Aqui cada elemento e adotado pelo andar base da sua propria stage (o de menor
 * bottomElevation, que a 031_levels_architecture criou como "Terreo").
 */

const TABLES = ['walls', 'ambient_lights', 'noises', 'drawings', 'notes'] as const;

export async function up(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasTable('levels'))) return;

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

      // So adota o que esta orfao. Elemento que ja foi atribuido a um andar
      // (criado depois dos Levels, ou movido pelo GM) nao pode ser puxado de
      // volta pro terreo.
      await knex(table)
        .where({ stageId })
        .where((qb) => qb.whereNull('levelId').orWhere('levelId', ''))
        .update({ levelId: baseLevel.id });
    }
  }
}

export async function down(knex: Knex): Promise<void> {
  // Reversao best-effort: devolve ao estado orfao apenas o que aponta pro andar
  // base. Nao da pra distinguir o que esta migration atribuiu do que o usuario
  // atribuiu manualmente depois — por isso o down e conservador e so desfaz o
  // caso exato que o up cria.
  if (!(await knex.schema.hasTable('levels'))) return;

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

      await knex(table).where({ levelId: baseLevel.id }).update({ levelId: '' });
    }
  }
}
