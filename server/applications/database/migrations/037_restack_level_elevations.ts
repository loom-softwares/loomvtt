import type { Knex } from 'knex';

/**
 * Reempilha as faixas de elevacao dos andares existentes.
 *
 * A criacao de andar usava `bottomElevation ?? 0` / `topElevation ?? 20` fixos,
 * entao TODO andar nascia ocupando exatamente 0..20 — a mesma faixa do Terreo.
 *
 * Tokens e tiles nao sao filtrados por `levelId`; eles usam a coordenada Z
 * (`elevation`), de proposito, pra poderem transitar entre andares. Mas isso so
 * distingue andares se as faixas nao se sobrepuserem. Com todas iguais, um
 * token em elevation 0 satisfazia o teste de todos os andares ao mesmo tempo e
 * aparecia em todos ("onipresente").
 *
 * Aqui cada stage tem seus andares empilhados na ordem em que ja estavam
 * (bottomElevation, depois rowid como desempate): 0..20, 20..40, 40..60...
 * A altura de cada andar e preservada quando ja era diferente de 20.
 */
export async function up(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasTable('levels'))) return;

  const stageIds: Array<{ stageId: string }> = await knex('levels')
    .distinct('stageId')
    .select('stageId');

  for (const { stageId } of stageIds) {
    const levels = await knex('levels')
      .where({ stageId })
      .orderBy([{ column: 'bottomElevation', order: 'asc' }, { column: 'id', order: 'asc' }]);

    // Uma stage com um unico andar ja esta correta — nao ha o que desempilhar.
    if (levels.length < 2) continue;

    let cursor = 0;
    for (const level of levels) {
      const height = Math.max(1, Number(level.topElevation ?? 20) - Number(level.bottomElevation ?? 0));
      await knex('levels')
        .where({ id: level.id })
        .update({ bottomElevation: cursor, topElevation: cursor + height });
      cursor += height;
    }
  }
}

export async function down(knex: Knex): Promise<void> {
  // Sem reversao: o estado anterior (todos os andares empilhados em 0..20) era
  // justamente o bug, e nao ha registro de qual faixa cada andar tinha antes.
  // Reverter recriaria a sobreposicao.
}
