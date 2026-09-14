#!/usr/bin/env node
// Converte um pack de compêndio legado (JSON: { name, type, entries: [...] }) num
// arquivo `.sqlite` normalizado — 1 linha por entry, nunca um blob com o pack
// inteiro. É o formato que addons/rulesets devem distribuir a partir de agora
// (ver memory: project_compendio_arquitetura_2026_09_08). JSON nunca é lido em
// runtime pelo servidor — só aqui, uma vez, na autoria/conversão.
//
// Uso:
//   node scripts/build-compendium-pack.mjs <entrada.json> [saida.sqlite]
//   node scripts/build-compendium-pack.mjs --dir <pasta com *.json>
import knex from 'knex';
import { readFileSync, existsSync, unlinkSync, readdirSync } from 'node:fs';
import path from 'node:path';

async function convertOne(jsonPath, sqlitePath) {
  const raw = JSON.parse(readFileSync(jsonPath, 'utf-8'));
  if (!raw.name || !Array.isArray(raw.entries)) {
    throw new Error(`Formato inválido em ${jsonPath} — esperado { name, type, entries: [] }`);
  }

  const out = sqlitePath || jsonPath.replace(/\.json$/i, '.sqlite');
  if (existsSync(out)) unlinkSync(out);

  const db = knex({ client: 'better-sqlite3', connection: { filename: out }, useNullAsDefault: true });

  await db.schema.createTable('pack_meta', (t) => {
    t.string('name').notNullable();
    t.string('type').notNullable();
    // Trava por padrão — o GM destrava explicitamente pra editar (self-heal em
    // packs mais antigos feito por compendium-source.ts::ensureLockColumn).
    t.boolean('locked').notNullable().defaultTo(true);
  });
  await db.schema.createTable('entries', (t) => {
    t.string('id').primary();
    t.string('name').notNullable();
    t.string('type').defaultTo('');
    t.integer('sortOrder').defaultTo(0);
    t.string('imgUrl').defaultTo('');
    t.text('data').defaultTo('{}');
    // Solta ('') por padrão — organizar em pastas é opt-in via UI depois da
    // conversão (self-heal pra packs mais antigos em
    // compendium-source.ts::ensureFolderSchema).
    t.string('folderId').notNullable().defaultTo('');
  });
  await db.schema.createTable('folders', (t) => {
    t.string('id').primary();
    t.string('name').notNullable();
    t.string('parent').notNullable().defaultTo('');
    t.string('color').notNullable().defaultTo('');
    t.string('sorting').notNullable().defaultTo('m');
  });

  await db('pack_meta').insert({ name: raw.name, type: raw.type || 'Item' });

  let sortOrder = 0;
  for (const entry of raw.entries) {
    await db('entries').insert({
      id: entry.id || crypto.randomUUID(),
      name: entry.name || 'Entry',
      type: entry.type || '',
      sortOrder: sortOrder++,
      imgUrl: entry.imgUrl || '',
      data: JSON.stringify(entry.data ?? {}),
    });
  }

  await db.destroy();
  console.log(`[build-compendium-pack] ${path.basename(jsonPath)} -> ${path.basename(out)} (${raw.entries.length} entries)`);
}

async function main() {
  const args = process.argv.slice(2);
  if (args[0] === '--dir') {
    const dir = args[1];
    const files = readdirSync(dir).filter(f => f.endsWith('.json'));
    for (const f of files) {
      await convertOne(path.join(dir, f));
    }
    return;
  }

  const [jsonPath, sqlitePath] = args;
  if (!jsonPath) {
    console.error('Uso: node scripts/build-compendium-pack.mjs <entrada.json> [saida.sqlite]');
    console.error('     node scripts/build-compendium-pack.mjs --dir <pasta com *.json>');
    process.exit(1);
  }
  await convertOne(jsonPath, sqlitePath);
}

main().catch((err) => {
  console.error('[build-compendium-pack] Falhou:', err.message);
  process.exit(1);
});
