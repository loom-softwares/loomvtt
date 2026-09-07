import type { Knex } from 'knex';
import { randomUUID } from 'crypto';
import logger from '../../utils/logger.js';

/**
 * Levels Architecture (breaking change).
 *
 * Antes: `stages` carregava `backgroundUrl` e `backgroundColor` diretamente.
 * Agora: uma Stage é um container de múltiplos `levels` (andares) e o fundo
 * passa a viver nos levels. Esta migração:
 *   1. Cria a tabela `levels` (id, stageId, name, bottom/topElevation, fundo, flags).
 *   2. Backfills um level "Térreo" por stage existente, movendo o fundo pra lá.
 *   3. Remove as colunas legadas `backgroundUrl`/`backgroundColor` de `stages`
 *      (SQLite >= 3.35 suporta DROP COLUMN — melhor-sqlite3 bundle é >= 3.45).
 */
export async function up(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasTable('levels'))) {
    await knex.schema.createTable('levels', (t) => {
      t.string('id').primary();
      t.string('stageId').notNullable();
      t.string('name').notNullable().defaultTo('Térreo');
      t.float('bottomElevation').notNullable().defaultTo(0);
      t.float('topElevation').notNullable().defaultTo(20);
      t.string('backgroundUrl').defaultTo('');
      t.string('backgroundColor').defaultTo('#0d0d0f');
      t.text('flags').defaultTo('{}');
      t.string('createdAt');
      t.string('updatedAt');
      t.index(['stageId'], 'idx_levels_stageId');
    });
  }

  if (!(await knex.schema.hasTable('stages'))) return;

  const hasBgUrl = await knex.schema.hasColumn('stages', 'backgroundUrl');
  const hasBgColor = await knex.schema.hasColumn('stages', 'backgroundColor');

  // O select tem que acompanhar o que a tabela realmente tem: bancos que já
  // passaram por esta migração (ou nasceram depois dela) não têm as colunas
  // legadas, e pedir por elas quebra com "no such column".
  const columns = ['id', ...(hasBgUrl ? ['backgroundUrl'] : []), ...(hasBgColor ? ['backgroundColor'] : [])];
  const stages = await knex('stages').select(columns);
  let created = 0;
  for (const stage of stages) {
    const existing = await knex('levels').where({ stageId: stage.id }).first();
    if (existing) continue;
    const now = new Date().toISOString();
    await knex('levels').insert({
      id: randomUUID(),
      stageId: stage.id,
      name: 'Térreo',
      bottomElevation: 0,
      topElevation: 20,
      backgroundUrl: hasBgUrl ? (stage.backgroundUrl ?? '') : '',
      backgroundColor: hasBgColor ? (stage.backgroundColor ?? '#0d0d0f') : '#0d0d0f',
      flags: '{}',
      createdAt: now,
      updatedAt: now,
    });
    created++;
  }
  if (created > 0) {
    logger.info(`[Migration] 031_levels_architecture: created ${created} default level(s) from existing stages`);
  }

  if (hasBgUrl) await dropStageColumn(knex, 'backgroundUrl');
  if (hasBgColor) await dropStageColumn(knex, 'backgroundColor');
}

/**
 * No SQLite, `knex.schema.dropColumn` reconstrói a tabela inteira
 * (CREATE temp → COPY → DROP stages → RENAME). Como várias tabelas têm FK
 * apontando pra `stages` e o servidor liga `PRAGMA foreign_keys = ON`, o
 * `DROP TABLE "stages"` falha com "FOREIGN KEY constraint failed".
 *
 * O SQLite embarcado no better-sqlite3 (>= 3.45) suporta `ALTER TABLE ...
 * DROP COLUMN` nativo, que não reconstrói a tabela e não toca nas FKs.
 */
async function dropStageColumn(knex: Knex, column: string): Promise<void> {
  const client = String((knex.client as any)?.config?.client ?? '');
  if (client.includes('sqlite')) {
    await knex.raw(`ALTER TABLE "stages" DROP COLUMN "${column}"`);
    return;
  }
  await knex.schema.alterTable('stages', (t) => {
    t.dropColumn(column);
  });
}

export async function down(knex: Knex): Promise<void> {
  if (await knex.schema.hasTable('levels')) {
    await knex.schema.dropTable('levels');
  }
  if (await knex.schema.hasTable('stages')) {
    if (!(await knex.schema.hasColumn('stages', 'backgroundUrl'))) {
      await knex.schema.alterTable('stages', (t) => {
        t.string('backgroundUrl').defaultTo('');
      });
    }
    if (!(await knex.schema.hasColumn('stages', 'backgroundColor'))) {
      await knex.schema.alterTable('stages', (t) => {
        t.text('backgroundColor').defaultTo('#0d0d0f');
      });
    }
  }
}
