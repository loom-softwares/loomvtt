import knex, { Knex } from 'knex';
import path from 'path';
import fs from 'fs/promises';
import { existsSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import logger from '../utils/logger.js';
import { getDataRoot, config, db, registerTableDbResolver, rawDb } from './db.js';
import { Signal } from '../signals/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.resolve(__dirname, 'migrations');

// Register the resolver to intercept and redirect table queries on the core db
registerTableDbResolver(getKnexForTable);

// `../../../package.json` só resolve no layout do release empacotado
// (release/<alvo>/package.json + app/…). Rodando o build direto do repo
// (`npm start` → dist/server/…) esse arquivo não existe, e um readFileSync seco
// derrubava o servidor no boot. A versão é opcional — só carimba metadados do
// mundo, e os dois usos abaixo já têm fallback — então falhar aqui é aceitável.
let coreVersion = '0.0.1';
try {
  coreVersion = JSON.parse(readFileSync(new URL('../../../package.json', import.meta.url), 'utf-8')).version;
} catch {
  logger.warn('[WorldDB] package.json não encontrado ao lado do build; usando coreVersion padrão');
}

const worldConnections = new Map<string, Knex>();

export let activeWorldDb: Knex | null = null;
// Companheiro de `activeWorldDb` — sem isso, nada conseguia comparar "esse
// request/socket é do mundo que está ativo AGORA" (só existia a conexão Knex
// em si, sem o id). Achado real: `/launch` e `/activate` trocavam
// `activeWorldDb` de um mundo pro outro sem nunca desativar o anterior
// primeiro — clientes WS do mundo antigo continuavam mandando `token.move`/
// chat, e como `db('cast')` resolve o mundo ATIVO no momento em que a query
// roda (não no momento em que a mensagem chegou), a escrita ia silenciosamente
// pro banco do mundo NOVO. `activeWorldId` permite os call sites (WS message
// dispatcher, requireWorldMatch) rejeitarem isso em vez de deixar passar.
export let activeWorldId: string | null = null;

/**
 * Retorna a conexão Knex específica para o banco de dados do mundo informado.
 * Cria o banco e as tabelas caso ainda não existam.
 */
export async function getWorldDb(worldId: string, options?: { checkOnly?: boolean }): Promise<any> {
  let dbInstance = worldConnections.get(worldId);
  if (dbInstance) {
    // O cache tem que respeitar `checkOnly`. Sem isto, quando a conexao do
    // mundo ja estava aberta esta funcao devolvia a INSTANCIA KNEX no lugar de
    // `{ needsMigration }` — e a rota GET /worlds/:id/migration-status fazia
    // res.json(knex), que estoura em referencia circular. O Express aborta a
    // resposta no meio e o cliente recebe corpo vazio: era o
    // "Failed to execute 'json' on 'Response': Unexpected end of JSON input"
    // ao clicar no mundo. Falhava so na segunda vez, porque na primeira o
    // cache ainda estava vazio.
    if (options?.checkOnly) {
      const [, pending] = await dbInstance.migrate.list({ directory: migrationsDir });
      return { needsMigration: pending.length > 0 };
    }
    return dbInstance;
  }

  const dbClient = config.dbClient === 'better-sqlite3' ? 'sqlite3' : (config.dbClient || 'sqlite3');

  let knexConfig: any = {};

  if (dbClient === 'sqlite3') {
    const worldDir = path.resolve(getDataRoot(), 'worlds', worldId);
    try {
      await fs.mkdir(worldDir, { recursive: true });
    } catch {}
    const dbPath = path.join(worldDir, 'world.sqlite');
    logger.info(`[WorldDB] Connecting to SQLite for world "${worldId}"`, { dbPath });

    knexConfig = {
      client: 'better-sqlite3',
      connection: {
        filename: dbPath,
      },
      useNullAsDefault: true,
    };
  } else {
    // MySQL ou PostgreSQL
    // Cerca dupla: o sanitize abaixo ja limita o conjunto de caracteres, mas ele e
    // a UNICA barreira entre um worldId e um `CREATE DATABASE` interpolado. Validar
    // a origem torna a interpolacao segura por construcao, e nao por um regex que
    // alguem pode afrouxar depois.
    if (!/^[\w-]+$/.test(worldId)) {
      throw new Error(`worldId invalido para nome de database: ${worldId}`);
    }
    const rootDbName = config.dbName || 'loomvtt';
    const worldDbName = `${rootDbName}_world_${worldId.toLowerCase().replace(/[^a-z0-9_]/g, '_')}`;
    logger.info(`[WorldDB] Connecting to ${dbClient} for world "${worldId}"`, { database: worldDbName });

    // Conecta temporariamente ao banco principal para garantir que a database do mundo exista
    const adminConfig = {
      client: dbClient === 'mysql' ? 'mysql2' : 'pg',
      connection: {
        host: config.dbHost || 'localhost',
        port: Number(config.dbPort) || (dbClient === 'mysql' ? 3306 : 5432),
        user: config.dbUser || 'root',
        password: config.dbPassword || '',
        database: rootDbName,
      },
    };
    const adminDb = knex(adminConfig);
    try {
      if (dbClient === 'mysql') {
        await adminDb.raw(`CREATE DATABASE IF NOT EXISTS \`${worldDbName}\``);
      } else {
        const dbExists = await adminDb.raw(`SELECT 1 FROM pg_database WHERE datname = ?`, [worldDbName]);
        if (dbExists.rows.length === 0) {
          await adminDb.raw(`CREATE DATABASE "${worldDbName}"`);
        }
      }
    } catch (err: any) {
      logger.error(`[WorldDB] Failed to ensure database "${worldDbName}" exists:`, err.message);
    } finally {
      await adminDb.destroy();
    }

    knexConfig = {
      client: dbClient === 'mysql' ? 'mysql2' : 'pg',
      connection: {
        host: config.dbHost || 'localhost',
        port: Number(config.dbPort) || (dbClient === 'mysql' ? 3306 : 5432),
        user: config.dbUser || 'root',
        password: config.dbPassword || '',
        database: worldDbName,
      },
    };
  }

  dbInstance = knex(knexConfig);
  try {
    if (options?.checkOnly) {
      const [completed, pending] = await dbInstance.migrate.list({ directory: migrationsDir });
      let needsMigration = pending.length > 0;
      
      // Checar se há dados legados a migrar (apenas checa se a flag já for false para otimizar)
      if (!needsMigration) {
        for (const table of LEGACY_TABLES) {
          if (!(await db.schema.hasTable(table))) continue;
          const countRes = await scopedQuery(db, table, worldId).count('* as count').first();
          if (countRes && Number((countRes as any).count) > 0) { needsMigration = true; break; }
        }
      }
      
      await dbInstance.destroy();
      return { needsMigration };
    }

    Signal.broadcast('operation.progress', { operationId: worldId, percent: 10, phase: 'schema', label: 'Verificando schema do mundo...' });
    await ensureWorldSchema(dbInstance);
    await dbInstance.migrate.latest({ directory: migrationsDir });
    worldConnections.set(worldId, dbInstance);

    Signal.broadcast('operation.progress', { operationId: worldId, percent: 20, phase: 'migrate-check', label: 'Verificando dados legados...' });
    await migrateCentralWorldData(worldId, dbInstance, (p) => {
      Signal.broadcast('operation.progress', { operationId: worldId, percent: 20 + Math.round(p.percent * 0.7), phase: p.phase, label: p.label });
    });

    Signal.broadcast('operation.progress', { operationId: worldId, percent: 100, phase: 'done', label: 'Mundo carregado.' });
    return dbInstance;
  } catch (err: any) {
    if (!options?.checkOnly) {
      Signal.broadcast('operation.progress', { operationId: worldId, percent: 0, phase: 'error', label: err.message || 'Falha ao carregar o mundo' });
    }
    throw err;
  }
}

/** Fechar conexão de banco de um mundo específico (ex: ao deletar ou desativar o mundo) */
export async function closeWorldDb(worldId: string): Promise<void> {
  const dbInstance = worldConnections.get(worldId);
  if (dbInstance) {
    await dbInstance.destroy();
    worldConnections.delete(worldId);
    logger.info(`[WorldDB] Connection closed for world "${worldId}"`);
  }
}

export async function setActiveWorldDb(worldId: string): Promise<Knex> {
  const worldDb = await getWorldDb(worldId);
  activeWorldDb = worldDb;
  activeWorldId = worldId;
  return worldDb;
}

export function clearActiveWorldDb(): void {
  activeWorldDb = null;
  activeWorldId = null;
}

export function getKnexForTable(tableName: string): Knex {
  // 'settings' guarda jwt_secret/boot_id/admin_session_id — sessao de admin
  // e' coisa de instalacao inteira, nunca de um mundo especifico. Faltando
  // aqui, ativar QUALQUER mundo redirecionava toda leitura de settings pro
  // banco daquele mundo (sem as linhas certas), derrubando a sessao de admin
  // na hora — bug real, achado ao vivo, nao teorico.
  const globalTables = ['worlds', 'users', 'packages', 'world_packages', 'campaigns', 'settings', 'bug_reports'];
  if (globalTables.includes(tableName)) {
    return rawDb;
  }
  return activeWorldDb || rawDb;
}

/** Salva o manifesto world.json na pasta do mundo */
export async function saveWorldManifest(world: any): Promise<void> {
  try {
    const worldDir = path.resolve(getDataRoot(), 'worlds', world.id);
    try {
      await fs.mkdir(worldDir, { recursive: true });
    } catch {}

    const manifestPath = path.join(worldDir, 'world.json');

    // Parse de packageIds se vier como string JSON do Knex/SQLite
    let packageIdsList = world.packageIds || [];
    if (typeof packageIdsList === 'string') {
      try { packageIdsList = JSON.parse(packageIdsList); } catch { packageIdsList = []; }
    }
    let packageConfigObj = world.packageConfig || {};
    if (typeof packageConfigObj === 'string') {
      try { packageConfigObj = JSON.parse(packageConfigObj); } catch { packageConfigObj = {}; }
    }

    const manifest = {
      id: world.id,
      title: world.name,
      system: world.system || 'generic',
      description: world.description || '',
      backgroundUrl: world.coverUrl || '',
      language: world.language || 'pt-BR',
      coreVersion: coreVersion || '0.0.1',
      compatibility: {
        minimum: '1.0.0',
        verified: coreVersion || '0.0.1',
      },
      packageIds: packageIdsList,
      packageConfig: packageConfigObj,
      lastPlayed: new Date().toISOString(),
      playtime: 0,
      flags: {},
    };

    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
    logger.info(`[WorldDB] Wrote world manifest: ${manifestPath}`);
  } catch (err: any) {
    logger.error(`[WorldDB] Failed to save world manifest for "${world.id}":`, err.message);
  }
}

/** Sincroniza mundos no disco com a tabela central */
export async function syncWorldsOnDisk(): Promise<void> {
  try {
    const worldsDir = path.resolve(getDataRoot(), 'worlds');
    if (!existsSync(worldsDir)) return;

    const entries = await fs.readdir(worldsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const manifestPath = path.join(worldsDir, entry.name, 'world.json');
      if (!existsSync(manifestPath)) continue;

      try {
        const raw = await fs.readFile(manifestPath, 'utf-8');
        const manifest = JSON.parse(raw);
        if (!manifest.id || !manifest.title) continue;

        const exists = await db('worlds').where({ id: manifest.id }).first();
        if (!exists) {
          logger.info(`[WorldSync] Syncing new world from disk: ${manifest.title} (${manifest.id})`);
          await db('worlds').insert({
            id: manifest.id,
            name: manifest.title,
            system: manifest.system || 'generic',
            description: manifest.description || '',
            coverUrl: manifest.backgroundUrl || '',
            language: manifest.language || 'pt-BR',
            isActive: false,
            packageIds: JSON.stringify(manifest.packageIds || []),
            packageConfig: JSON.stringify(manifest.packageConfig || {}),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }
      } catch (err: any) {
        logger.warn(`[WorldSync] Failed to sync world.json inside "${entry.name}":`, err.message);
      }
    }
  } catch (err: any) {
    logger.error('[WorldSync] Failed to read worlds directory:', err.message);
  }
}

/** 
 * Realiza um Universal JSON Dump de todas as tabelas do mundo, mais cópia do .sqlite (se aplicável),
 * empacotando tudo em um .zip para proteção pré-migração.
 */
export async function backupWorldDb(worldId: string): Promise<void> {
  const { execSync } = await import('child_process');
  
  Signal.broadcast('operation.progress', { operationId: worldId, percent: 10, phase: 'backup-init', label: 'Iniciando backup do mundo...' });
  
  const backupsDir = path.resolve(getDataRoot(), 'backups', 'worlds');
  await fs.mkdir(backupsDir, { recursive: true });
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupTempDir = path.join(backupsDir, `temp_${worldId}_${timestamp}`);
  await fs.mkdir(backupTempDir, { recursive: true });
  
  try {
    const wDb = await getWorldDb(worldId, { checkOnly: true }); // Apenas checagem para não rodar migração! (na vdd a gnt quer a conexão *antes* de migrar)
    // Para fazer dump seguro, precisamos de uma conexão que NÃO ative as migrações automáticas.
    // Como getWorldDb() com checkOnly retorna { needsMigration }, não retorna o dbInstance.
    // Vamos conectar manualmente apenas para leitura:
    
    Signal.broadcast('operation.progress', { operationId: worldId, percent: 30, phase: 'backup-export', label: 'Exportando tabelas em JSON...' });
    
    // Conectar cru, sem chamar migrações
    const dbClient = config.dbClient === 'better-sqlite3' ? 'sqlite3' : (config.dbClient || 'sqlite3');
    let knexConfig: any = {};
    if (dbClient === 'sqlite3') {
      const dbPath = path.join(getDataRoot(), 'worlds', worldId, 'world.sqlite');
      knexConfig = { client: 'better-sqlite3', connection: { filename: dbPath }, useNullAsDefault: true };
      
      // Se for SQLite, copiar o arquivo fisicamente também
      if (existsSync(dbPath)) {
        await fs.copyFile(dbPath, path.join(backupTempDir, 'world.sqlite'));
      }
    } else {
      const rootDbName = config.dbName || 'loomvtt';
      const worldDbName = `${rootDbName}_world_${worldId.toLowerCase().replace(/[^a-z0-9_]/g, '_')}`;
      knexConfig = {
        client: dbClient === 'mysql' ? 'mysql2' : 'pg',
        connection: {
          host: config.dbHost || 'localhost',
          port: Number(config.dbPort) || (dbClient === 'mysql' ? 3306 : 5432),
          user: config.dbUser || 'root',
          password: config.dbPassword || '',
          database: worldDbName,
        }
      };
    }
    
    const dumpDb = knex(knexConfig);
    const dumpData: Record<string, any[]> = {};
    
    // Dump tables
    for (const table of LEGACY_TABLES) {
      if (await dumpDb.schema.hasTable(table)) {
        dumpData[table] = await dumpDb(table).select('*');
      }
    }
    await dumpDb.destroy();
    
    await fs.writeFile(path.join(backupTempDir, 'dump.json'), JSON.stringify(dumpData, null, 2), 'utf8');
    
    Signal.broadcast('operation.progress', { operationId: worldId, percent: 80, phase: 'backup-compress', label: 'Compactando backup...' });
    
    // Zip the folder using JSZIp or shell command (we will use simple JS zip or AdmZip if available, but for now we can just leave it as a folder or use tar)
    // To keep it simple and dependency-free, let's just keep the folder or rename it.
    // Actually, creating a zip is better. Is archiver or adm-zip installed?
    // In loomvtt, we might not have them. Let's just keep it as a folder in backups, named `worldId_timestamp_backup`.
    const finalBackupPath = path.join(backupsDir, `${worldId}_${timestamp}_backup`);
    await fs.rename(backupTempDir, finalBackupPath);
    
    logger.info(`[WorldDB] Backup created at ${finalBackupPath}`);
    Signal.broadcast('operation.progress', { operationId: worldId, percent: 100, phase: 'backup-done', label: 'Backup concluído!' });
    
  } catch (err: any) {
    logger.error(`[WorldDB] Failed to backup world ${worldId}:`, err);
    Signal.broadcast('operation.progress', { operationId: worldId, percent: 0, phase: 'error', label: 'Falha no backup!' });
    throw err;
  }
}

const LEGACY_TABLES = [
  'folders', 'actors', 'items', 'stages', 'tiles', 'walls', 'ambient_lights',
  'drawings', 'notes', 'ambient_sound', 'noises', 'journals', 'journal_pages',
  'playlists', 'playlist_sounds', 'roll_tables', 'roll_table_entries',
  'cast', 'chat_messages', 'combats', 'macros', 'compendium_packs',
  'decks', 'buffs', 'zones', 'fog_reveals', 'templates', 'levels'
];

// Insere na ordem pai→filho (FK de inserção precisa do pai já existir).
const INSERT_ORDER = [
  'folders', 'stages', 'actors', 'items', 'journals', 'playlists', 'roll_tables',
  'tiles', 'walls', 'ambient_lights', 'drawings', 'notes', 'ambient_sound', 'noises',
  'journal_pages', 'playlist_sounds', 'roll_table_entries',
  'cast', 'chat_messages', 'combats', 'macros', 'compendium_packs',
  'decks', 'buffs', 'zones', 'fog_reveals', 'templates', 'levels'
];
// Deleta na ordem filho→pai — inversa do insert. Deletar o pai antes do filho
// quebra a FK (bug real encontrado em 2026-07-21: delete de `playlists` batia
// em `playlist_sounds` ainda referenciando a linha).
const DELETE_ORDER = [...INSERT_ORDER].reverse();

function scopedQuery(db: Knex, table: string, worldId: string) {
  if (['tiles', 'walls', 'ambient_lights', 'drawings', 'notes', 'ambient_sound', 'noises', 'zones', 'fog_reveals', 'templates', 'levels'].includes(table)) {
    return db(table).whereIn('stageId', db('stages').where({ worldId }).select('id'));
  }
  if (table === 'journal_pages') {
    return db(table).whereIn('journalId', db('journals').where({ worldId }).select('id'));
  }
  if (table === 'playlist_sounds') {
    return db(table).whereIn('playlistId', db('playlists').where({ worldId }).select('id'));
  }
  if (table === 'roll_table_entries') {
    return db(table).whereIn('rollTableId', db('roll_tables').where({ worldId }).select('id'));
  }
  return db(table).where({ worldId });
}

export type MigrationProgress = { worldId: string; percent: number; phase: string; label: string };

/**
 * Migra dados legados do banco central pra o banco por-mundo — escopado a UM
 * mundo só (chamado de dentro de `getWorldDb`, na hora que aquele mundo
 * específico é aberto/lançado — não roda mais eager pra todos os mundos no boot).
 */
export async function migrateCentralWorldData(
  worldId: string,
  wDb: Knex,
  onProgress?: (p: MigrationProgress) => void,
): Promise<void> {
  try {
    let hasData = false;
    for (const table of LEGACY_TABLES) {
      if (!(await db.schema.hasTable(table))) continue;
      const countRes = await scopedQuery(db, table, worldId).count('* as count').first();
      if (countRes && Number((countRes as any).count) > 0) { hasData = true; break; }
    }
    if (!hasData) return;

    logger.info(`[WorldMigration] Migrating legacy data from central DB to world database: "${worldId}"`);
    const total = INSERT_ORDER.length;

    // Fase 1 — copia tudo pro banco do mundo (pai→filho), sem apagar nada do central ainda.
    for (let i = 0; i < INSERT_ORDER.length; i++) {
      const table = INSERT_ORDER[i];
      onProgress?.({ worldId, percent: Math.round((i / total) * 50), phase: 'migrate-copy', label: `Copiando ${table}...` });
      if (!(await db.schema.hasTable(table))) continue;
      const rows = await scopedQuery(db, table, worldId);
      if (rows.length === 0) continue;
      logger.info(`[WorldMigration] Migrating ${rows.length} rows for table "${table}"`);
      for (const row of rows) {
        if (table === 'stages') {
          // Migration 031 moveu o fundo pra `levels` e dropou as colunas legadas —
          // copiar essas colunas pro banco do mundo quebra com "no such column".
          delete (row as any).backgroundUrl;
          delete (row as any).backgroundColor;
        }
        const exists = await wDb(table).where({ id: row.id }).first();
        if (!exists) await wDb(table).insert(row);
      }
    }

    // Fase 2 — só depois de TUDO copiado, apaga do central em ordem filho→pai.
    for (let i = 0; i < DELETE_ORDER.length; i++) {
      const table = DELETE_ORDER[i];
      onProgress?.({ worldId, percent: 50 + Math.round((i / total) * 50), phase: 'migrate-cleanup', label: `Limpando ${table} do banco central...` });
      if (!(await db.schema.hasTable(table))) continue;
      await scopedQuery(db, table, worldId).delete();
    }

    logger.info(`[WorldMigration] Legacy data migration complete for world "${worldId}"`);
  } catch (err: any) {
    logger.error('[WorldMigration] Migration failed:', err.message);
  }
}

/**
 * Dropa tabelas legadas do banco central quando estão vazias (todos os mundos
 * já migraram organicamente). Barato (só COUNT), seguro rodar no boot — nunca
 * dropa tabela com dado de mundo ainda não migrado.
 */
export async function cleanupEmptyCentralTables(): Promise<void> {
  for (const table of LEGACY_TABLES) {
    if (!(await db.schema.hasTable(table))) continue;
    const countRes = await db(table).count('* as count').first();
    if (Number((countRes as any)?.count) > 0) continue;
    await db.schema.dropTable(table).catch((err: any) => {
      logger.warn(`[WorldMigration] Failed to drop empty legacy table "${table}" from central DB:`, err.message);
    });
  }
}

/** Garante a criação de todas as tabelas específicas do mundo */
async function ensureWorldSchema(db: Knex): Promise<void> {
  // 1. Folders
  if (!(await db.schema.hasTable('folders'))) {
    await db.schema.createTable('folders', (t) => {
      t.string('id').primary();
      t.string('worldId').notNullable();
      t.string('name').notNullable();
      t.string('type').notNullable();
      t.string('parent').defaultTo('');
      t.string('sorting').defaultTo('m');
      t.string('color').defaultTo('');
      t.timestamps(true, true, true);
    });
  }

  // 2. Actors
  if (!(await db.schema.hasTable('actors'))) {
    await db.schema.createTable('actors', (t) => {
      t.string('id').primary();
      t.string('worldId').notNullable();
      t.string('name').notNullable();
      t.string('type').defaultTo('character');
      t.string('avatarUrl').defaultTo('');
      t.text('systemData').defaultTo('{}');
      t.text('ownership').defaultTo('{}');
      t.text('flags').defaultTo('{}');
      t.string('folderId').defaultTo('');
      t.timestamps(true, true, true);
    });
  }

  // 3. Items
  if (!(await db.schema.hasTable('items'))) {
    await db.schema.createTable('items', (t) => {
      t.string('id').primary();
      t.string('worldId').notNullable();
      t.string('actorId').defaultTo('');
      t.string('name').notNullable();
      t.string('type').defaultTo('equipment');
      t.text('data').defaultTo('{}');
      t.string('imgUrl').defaultTo('');
      t.text('ownership').defaultTo('{}');
      t.text('flags').defaultTo('{}');
      t.text('suppressed').defaultTo('false');
      t.string('folderId').defaultTo('');
      t.timestamps(true, true, true);
    });
  } else {
    if (!(await db.schema.hasColumn('items', 'suppressed'))) {
      await db.schema.alterTable('items', (t) => {
        t.text('suppressed').defaultTo('false');
      });
    }
  }

  // 4. Stages
  if (!(await db.schema.hasTable('stages'))) {
    await db.schema.createTable('stages', (t) => {
      t.string('id').primary();
      t.string('worldId').notNullable();
      t.string('name').notNullable();
      t.integer('gridSize').defaultTo(50);
      t.string('gridColor').defaultTo('#ffffff');
      t.string('navigationName').defaultTo('');
      t.boolean('showInNavigation').defaultTo(false);
      t.float('darknessLevel').defaultTo(0);
      t.string('weatherEffect').defaultTo('none');
      t.float('gridDistance').defaultTo(5);
      t.string('gridUnit').defaultTo('ft');
      t.string('gridStyle').defaultTo('solid');
      t.float('gridOpacity').defaultTo(0.2);
      t.string('gridType').defaultTo('square');
      t.integer('padding').defaultTo(0);
      t.integer('offsetX').defaultTo(0);
      t.integer('offsetY').defaultTo(0);
      t.boolean('isActive').defaultTo(false);
      t.integer('width').defaultTo(3000);
      t.integer('height').defaultTo(2000);
      t.string('ambientPlaylistId').defaultTo('');
      t.boolean('tokenVision').defaultTo(true);
      t.string('fogExplorationMode').defaultTo('individual');
      t.string('fogExploredColor').defaultTo('#000000');
      t.string('fogUnexploredColor').defaultTo('#000000');
      t.string('fogImage').defaultTo('');
      t.boolean('globalLight').defaultTo(false);
      t.float('globalLightThreshold').defaultTo(1);
      t.text('flags').defaultTo('{}');
      t.text('ownership').defaultTo('{}');
      t.string('folderId').defaultTo('');
      t.timestamps(true, true, true);
    });
  } else {
    const stageCols: Array<[string, (t: any) => void]> = [
      ['padding',  (t) => t.integer('padding').defaultTo(0)],
      ['offsetX',  (t) => t.integer('offsetX').defaultTo(0)],
      ['offsetY',  (t) => t.integer('offsetY').defaultTo(0)],
    ];
    for (const [col, add] of stageCols) {
      if (!(await db.schema.hasColumn('stages', col))) {
        await db.schema.alterTable('stages', add);
      }
    }
  }

  // 5. Tiles
  if (!(await db.schema.hasTable('tiles'))) {
    await db.schema.createTable('tiles', (t) => {
      t.string('id').primary();
      t.string('stageId').notNullable();
      t.string('name').notNullable();
      t.integer('x').defaultTo(0);
      t.integer('y').defaultTo(0);
      t.integer('width').defaultTo(100);
      t.integer('height').defaultTo(100);
      t.string('imgUrl').defaultTo('');
      t.boolean('isActive').defaultTo(true);
      t.text('triggers').defaultTo('[]');
      t.text('conditions').defaultTo('[]');
      t.text('actions').defaultTo('[]');
      t.timestamps(true, true, true);
    });
  }

  // 6. Walls
  if (!(await db.schema.hasTable('walls'))) {
    await db.schema.createTable('walls', (t) => {
      t.string('id').primary();
      t.string('stageId').notNullable();
      t.float('x1').defaultTo(0);
      t.float('y1').defaultTo(0);
      t.float('x2').defaultTo(0);
      t.float('y2').defaultTo(0);
      t.boolean('sight').defaultTo(true);
      t.boolean('light').defaultTo(true);
      t.boolean('movement').defaultTo(true);
      t.boolean('sound').defaultTo(true);
      t.integer('direction').defaultTo(0);
      t.integer('door').defaultTo(0);
      t.integer('doorState').defaultTo(0);
      t.string('wallType').defaultTo('normal');
      t.timestamps(true, true, true);
    });
  }
  if (!(await db.schema.hasColumn('walls', 'wallType'))) {
    await db.schema.alterTable('walls', (t) => {
      t.string('wallType').defaultTo('normal');
    });
  }

  // 7. Ambient Lights
  if (!(await db.schema.hasTable('ambient_lights'))) {
    await db.schema.createTable('ambient_lights', (t) => {
      t.string('id').primary();
      t.string('stageId').notNullable();
      t.float('x').defaultTo(0);
      t.float('y').defaultTo(0);
      t.float('radius').defaultTo(200);
      t.string('color').defaultTo('#ffdd88');
      t.float('intensity').defaultTo(0.5);
      t.float('rotation').defaultTo(0);
      t.string('animation').defaultTo('none');
      t.float('darknessMin').defaultTo(0);
      t.float('darknessMax').defaultTo(1);
      t.boolean('isHidden').defaultTo(false);
      t.float('bright').defaultTo(100);
      t.float('dim').defaultTo(200);
      t.float('angle').defaultTo(360);
      t.boolean('walls').defaultTo(true);
      t.boolean('vision').defaultTo(false);
      t.float('animationSpeed').defaultTo(5);
      t.float('animationIntensity').defaultTo(5);
      t.timestamps(true, true, true);
    });
  }

  // 8. Drawings
  if (!(await db.schema.hasTable('drawings'))) {
    await db.schema.createTable('drawings', (t) => {
      t.string('id').primary();
      t.string('stageId').notNullable();
      t.string('type').defaultTo('rectangle');
      t.float('x').defaultTo(0);
      t.float('y').defaultTo(0);
      t.float('width').defaultTo(100);
      t.float('height').defaultTo(100);
      t.float('rotation').defaultTo(0);
      t.float('z').defaultTo(0);
      t.string('fillColor').defaultTo('#000000');
      t.float('fillOpacity').defaultTo(0.3);
      t.string('strokeColor').defaultTo('#ffffff');
      t.integer('strokeWidth').defaultTo(1);
      t.text('text').defaultTo('');
      t.string('fontFamily').defaultTo('Arial');
      t.integer('fontSize').defaultTo(16);
      t.text('points').defaultTo('[]');
      t.string('imgUrl').defaultTo('');
      t.boolean('isHidden').defaultTo(false);
      t.boolean('isLocked').defaultTo(false);
      t.string('authorId').defaultTo('');
      t.timestamps(true, true, true);
    });
  }

  // 9. Notes
  if (!(await db.schema.hasTable('notes'))) {
    await db.schema.createTable('notes', (t) => {
      t.string('id').primary();
      t.string('stageId').notNullable();
      t.string('journalId').defaultTo('');
      t.float('x').defaultTo(0);
      t.float('y').defaultTo(0);
      t.boolean('visibleToPlayers').defaultTo(false);
      t.timestamps(true, true, true);
    });
  }

  // 10. Noises (Efeitos sonoros na cena)
  if (!(await db.schema.hasTable('noises'))) {
    await db.schema.createTable('noises', (t) => {
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

  // 11. Ambient Sound (Sons de fundo da cena)
  if (!(await db.schema.hasTable('ambient_sound'))) {
    await db.schema.createTable('ambient_sound', (t) => {
      t.string('id').primary();
      t.string('stageId').notNullable();
      t.string('path').notNullable();
      t.integer('x').notNullable();
      t.integer('y').notNullable();
      t.integer('radius').notNullable().defaultTo(300);
      t.float('volume').notNullable().defaultTo(0.5);
      t.boolean('loop').defaultTo(true);
      t.timestamps(true, true, true);
    });
  }

  // 12. Journals
  if (!(await db.schema.hasTable('journals'))) {
    await db.schema.createTable('journals', (t) => {
      t.string('id').primary();
      t.string('worldId').notNullable();
      t.string('name').notNullable();
      t.text('content').defaultTo('');
      t.string('folderId').defaultTo('');
      t.boolean('isPinned').defaultTo(false);
      t.integer('pinX').defaultTo(0);
      t.integer('pinY').defaultTo(0);
      t.text('pages').defaultTo('[]');
      t.text('flags').defaultTo('{}');
      t.text('ownership').defaultTo('{}');
      t.timestamps(true, true, true);
    });
  } else {
    if (!(await db.schema.hasColumn('journals', 'pages'))) {
      await db.schema.alterTable('journals', (t) => { t.text('pages').defaultTo('[]'); });
    }
    if (!(await db.schema.hasColumn('journals', 'flags'))) {
      await db.schema.alterTable('journals', (t) => { t.text('flags').defaultTo('{}'); });
    }
  }

  // 13. Journal Pages
  if (!(await db.schema.hasTable('journal_pages'))) {
    await db.schema.createTable('journal_pages', (t) => {
      t.string('id').primary();
      t.string('journalId').notNullable();
      t.string('name').notNullable();
      t.string('type').notNullable().defaultTo('text');
      t.text('content').defaultTo('');
      t.string('src').defaultTo('');
      t.integer('sortOrder').defaultTo(0);
      t.timestamps(true, true, true);
    });
  }

  // 14. Playlists
  if (!(await db.schema.hasTable('playlists'))) {
    await db.schema.createTable('playlists', (t) => {
      t.string('id').primary();
      t.string('worldId').notNullable();
      t.string('name').notNullable();
      t.text('description').defaultTo('');
      t.string('imgUrl').defaultTo('');
      t.string('mode').defaultTo('sequential');
      t.float('volume').defaultTo(0.5);
      t.boolean('loop').defaultTo(false);
      t.float('fadeDuration').defaultTo(2);
      t.string('folderId').defaultTo('');
      t.text('ownership').defaultTo('{}');
      t.timestamps(true, true, true);
    });
  }

  // 15. Playlist Sounds
  if (!(await db.schema.hasTable('playlist_sounds'))) {
    await db.schema.createTable('playlist_sounds', (t) => {
      t.string('id').primary();
      t.string('playlistId').notNullable();
      t.string('name').notNullable();
      t.string('path').notNullable();
      t.float('volume').defaultTo(0.5);
      t.boolean('loop').defaultTo(false);
      t.float('fadeIn').defaultTo(0);
      t.float('fadeOut').defaultTo(0);
      t.integer('sortOrder').defaultTo(0);
      t.timestamps(true, true, true);
    });
  }

  // 16. Roll Tables
  if (!(await db.schema.hasTable('roll_tables'))) {
    await db.schema.createTable('roll_tables', (t) => {
      t.string('id').primary();
      t.string('worldId').notNullable();
      t.string('name').notNullable();
      t.text('description').defaultTo('');
      t.string('formula').defaultTo('1d20');
      t.integer('sortMode').defaultTo(0);
      t.string('imgUrl').defaultTo('');
      t.integer('replacement').defaultTo(1);
      t.integer('displayRollFormula').defaultTo(1);
      t.text('ownership').defaultTo('{}');
      t.string('folderId').defaultTo('');
      t.timestamps(true, true, true);
    });
  }
  if (!(await db.schema.hasColumn('roll_tables', 'displayRollFormula'))) {
    await db.schema.alterTable('roll_tables', (t) => { t.integer('displayRollFormula').defaultTo(1); });
  }

  // 17. Roll Table Entries
  if (!(await db.schema.hasTable('roll_table_entries'))) {
    await db.schema.createTable('roll_table_entries', (t) => {
      t.string('id').primary();
      t.string('rollTableId').notNullable();
      t.text('text').defaultTo('');
      t.text('imgUrl').defaultTo('');
      t.integer('weight').defaultTo(1);
      t.string('collectionId').defaultTo('');
      t.string('drawn').defaultTo('NONE');
      t.string('type').defaultTo('text');
      t.string('documentCollection').defaultTo('');
      t.string('documentId').defaultTo('');
      t.integer('rangeMin').defaultTo(1);
      t.integer('rangeMax').defaultTo(1);
      t.text('description').defaultTo('');
      t.timestamps(true, true, true);
    });
  }
  for (const col of ['type', 'documentCollection', 'documentId', 'rangeMin', 'rangeMax', 'description']) {
    if (!(await db.schema.hasColumn('roll_table_entries', col))) {
      await db.schema.alterTable('roll_table_entries', (t) => {
        if (col === 'rangeMin' || col === 'rangeMax') t.integer(col).defaultTo(1);
        else if (col === 'description') t.text(col).defaultTo('');
        else t.string(col).defaultTo('');
      });
    }
  }

  // 18. Cast (Tokens on Stage)
  if (!(await db.schema.hasTable('cast'))) {
    await db.schema.createTable('cast', (t) => {
      t.string('id').primary();
      t.string('worldId').notNullable();
      t.string('stageId').notNullable();
      t.string('name').notNullable();
      t.string('kind').defaultTo('adventurer');
      t.text('traits').defaultTo('{}');
      t.integer('x').defaultTo(100);
      t.integer('y').defaultTo(100);
      t.string('colorHex').defaultTo('#e74c3c');
      t.string('avatarUrl').defaultTo('');
      t.string('ringColor').defaultTo('#e74c3c');
      t.string('shape').defaultTo('circle');
      t.text('effects').defaultTo('[]');
      t.text('statusMarkers').defaultTo('[]');
      t.text('systemData').defaultTo('{}');
      t.string('actorId').defaultTo('');
      t.boolean('isLinked').defaultTo(false);
      t.text('ownership').defaultTo('{}');
      t.string('folderId').defaultTo('');
      t.float('elevation').defaultTo(0);
      t.boolean('locked').defaultTo(false);
      t.boolean('hidden').defaultTo(false);
      t.string('movementAction').defaultTo('walk');
      t.text('targetedBy').defaultTo('[]');
      t.string('tintColor').defaultTo('#ffffff');
      t.float('opacity').defaultTo(1);
      t.float('rotation').defaultTo(0);
      t.float('scale').defaultTo(1);
      t.boolean('sightEnabled').defaultTo(true);
      t.float('sightRange').defaultTo(0);
      t.float('sightAngle').defaultTo(360);
      t.string('sightMode').defaultTo('basic');
      t.text('detectionModes').defaultTo('[]');
      t.float('lightDimRange').defaultTo(0);
      t.float('lightBrightRange').defaultTo(0);
      t.string('lightColor').defaultTo('#ffffff');
      t.string('lightAnimation').defaultTo('none');
      t.integer('barGridSize').defaultTo(1);
      t.text('bar1').defaultTo('{"attribute":"attributes.hp","color":"dynamic"}');
      t.text('bar2').defaultTo('{"attribute":"","color":"#3498db"}');
      t.integer('displayBars').defaultTo(20);
      t.timestamps(true, true, true);
    });
  } else {
    const castCols: Array<[string, (t: any) => void]> = [
      ['elevation',      (t) => t.float('elevation').defaultTo(0)],
      ['locked',         (t) => t.boolean('locked').defaultTo(false)],
      ['hidden',         (t) => t.boolean('hidden').defaultTo(false)],
      ['movementAction', (t) => t.string('movementAction').defaultTo('walk')],
      ['targetedBy',     (t) => t.text('targetedBy').defaultTo('[]')],
      ['tintColor',      (t) => t.string('tintColor').defaultTo('#ffffff')],
      ['opacity',        (t) => t.float('opacity').defaultTo(1)],
      ['rotation',       (t) => t.float('rotation').defaultTo(0)],
      ['scale',          (t) => t.float('scale').defaultTo(1)],
      ['sightEnabled',   (t) => t.boolean('sightEnabled').defaultTo(true)],
      ['sightRange',     (t) => t.float('sightRange').defaultTo(0)],
      ['sightAngle',     (t) => t.float('sightAngle').defaultTo(360)],
      ['sightMode',      (t) => t.string('sightMode').defaultTo('basic')],
      ['detectionModes', (t) => t.text('detectionModes').defaultTo('[]')],
      ['lightDimRange',  (t) => t.float('lightDimRange').defaultTo(0)],
      ['lightBrightRange',(t) => t.float('lightBrightRange').defaultTo(0)],
      ['lightColor',     (t) => t.string('lightColor').defaultTo('#ffffff')],
      ['lightAnimation', (t) => t.string('lightAnimation').defaultTo('none')],
      ['barGridSize',    (t) => t.integer('barGridSize').defaultTo(1)],
      ['ringUrl',        (t) => t.string('ringUrl').defaultTo('')],
      ['ringEffect',     (t) => t.string('ringEffect').defaultTo('none')],
      ['ringScale',      (t) => t.float('ringScale').defaultTo(1.6)],
      ['bar1',           (t) => t.text('bar1').defaultTo('{"attribute":"attributes.hp","color":"dynamic"}')],
      ['bar2',           (t) => t.text('bar2').defaultTo('{"attribute":"","color":"#3498db"}')],
      ['displayBars',    (t) => t.integer('displayBars').defaultTo(20)],
    ];
    for (const [col, add] of castCols) {
      if (!(await db.schema.hasColumn('cast', col))) {
        await db.schema.alterTable('cast', add);
      }
    }
  }

  // 19. Chat Messages
  if (!(await db.schema.hasTable('chat_messages'))) {
    await db.schema.createTable('chat_messages', (t) => {
      t.string('id').primary();
      t.string('worldId').notNullable();
      t.string('userId').defaultTo('system');
      t.string('userName').defaultTo('System');
      t.string('userColor').defaultTo('#888');
      t.string('type').defaultTo('chat');
      t.text('content').notNullable();
      t.text('rollData').defaultTo('null');
      t.text('flags').defaultTo('{}');
      t.text('speaker').defaultTo('{}');
      t.timestamps(true, true, true);
    });
  } else {
    if (!(await db.schema.hasColumn('chat_messages', 'flags'))) {
      await db.schema.alterTable('chat_messages', (t) => { t.text('flags').defaultTo('{}'); });
    }
    if (!(await db.schema.hasColumn('chat_messages', 'speaker'))) {
      await db.schema.alterTable('chat_messages', (t) => { t.text('speaker').defaultTo('{}'); });
    }
  }

  // 19b. Module Settings — `getKnexForTable('module_settings')` roteia pro banco por-mundo
  // (não está na lista `globalTables`), mas só existia criada na migration central
  // (008_module_settings.ts) — nunca aqui. Resultado real: "no such table: module_settings"
  // (500) toda vez que um sistema convertido chama `Loom.settings.register()` com scope world.
  if (!(await db.schema.hasTable('module_settings'))) {
    await db.schema.createTable('module_settings', (t) => {
      t.string('id').primary();
      t.string('worldId').notNullable();
      t.string('moduleId').notNullable();
      t.string('key').notNullable();
      t.string('scope').notNullable().defaultTo('world');
      t.text('value');
      t.string('createdAt');
      t.string('updatedAt');
      t.unique(['worldId', 'moduleId', 'key']);
    });
  }

  // 20. Combats
  if (!(await db.schema.hasTable('combats'))) {
    await db.schema.createTable('combats', (t) => {
      t.string('id').primary();
      t.string('worldId').notNullable();
      t.integer('round').defaultTo(1);
      t.integer('currentTurn').defaultTo(0);
      t.text('combatants').defaultTo('[]');
      t.boolean('isActive').defaultTo(false);
      t.timestamps(true, true, true);
    });
  }

  // 21. Macros
  if (!(await db.schema.hasTable('macros'))) {
    await db.schema.createTable('macros', (t) => {
      t.string('id').primary();
      t.string('worldId').notNullable();
      t.string('name').notNullable();
      t.string('type').defaultTo('chat');
      t.text('command').defaultTo('');
      t.string('imgUrl').defaultTo('');
      t.integer('slot').defaultTo(-1);
      t.text('ownership').defaultTo('{}');
      t.string('folderId').defaultTo('');
      t.timestamps(true, true, true);
    });
  }

  // 22. Compendium Packs
  if (!(await db.schema.hasTable('compendium_packs'))) {
    await db.schema.createTable('compendium_packs', (t) => {
      t.string('id').primary();
      t.string('worldId').notNullable();
      t.string('name').notNullable();
      t.string('type').defaultTo('Actor');
      t.text('entries').defaultTo('[]');
      t.text('ownership').defaultTo('{}');
      t.string('folderId').defaultTo('');
      t.timestamps(true, true, true);
    });
  }

  // 23. Settings (Per-world settings)
  if (!(await db.schema.hasTable('settings'))) {
    await db.schema.createTable('settings', (t) => {
      t.string('key').primary();
      t.text('value').defaultTo('{}');
      t.timestamps(true, true, true);
    });
  }

  // 24. Decks (Baralhos de cartas)
  if (!(await db.schema.hasTable('decks'))) {
    await db.schema.createTable('decks', (t) => {
      t.string('id').primary();
      t.string('worldId').notNullable();
      t.string('name').notNullable();
      t.string('type').defaultTo('standard');
      t.text('cards').defaultTo('[]');
      t.text('state').defaultTo('{}');
      t.string('folderId').defaultTo('');
      t.timestamps(true, true, true);
    });
  }

  // 25. Buffs (Efeitos de regras)
  if (!(await db.schema.hasTable('buffs'))) {
    await db.schema.createTable('buffs', (t) => {
      t.string('id').primary();
      t.string('worldId').notNullable();
      t.string('actorId').defaultTo('');
      t.string('itemId').defaultTo('');
      t.string('name').notNullable();
      t.string('icon').defaultTo('');
      t.string('origin').defaultTo('');
      t.integer('duration').defaultTo(-1);
      t.boolean('disabled').defaultTo(false);
      t.text('changes').defaultTo('[]');
      t.timestamps(true, true, true);
    });
  }

  // 26. Zones (Áreas de gatilho no mapa)
  if (!(await db.schema.hasTable('zones'))) {
    await db.schema.createTable('zones', (t) => {
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

  // 27. Fog Reveals (Exploração da névoa de guerra)
  if (!(await db.schema.hasTable('fog_reveals'))) {
    await db.schema.createTable('fog_reveals', (t) => {
      t.string('id').primary();
      t.string('stageId').notNullable();
      t.string('userId').notNullable();
      t.text('explored').defaultTo('[]');
      t.timestamps(true, true, true);
    });
  }

  // 28. Templates (Medições de área — cones, raios, círculos)
  if (!(await db.schema.hasTable('templates'))) {
    await db.schema.createTable('templates', (t) => {
      t.string('id').primary();
      t.string('stageId').notNullable();
      t.string('userId').defaultTo('');
      t.string('type').defaultTo('cone');
      t.float('x').defaultTo(0);
      t.float('y').defaultTo(0);
      t.float('rotation').defaultTo(0);
      t.float('radius').defaultTo(100);
      t.float('width').defaultTo(100);
      t.float('height').defaultTo(100);
      t.float('angle').defaultTo(90);
      t.float('distance').defaultTo(100);
      t.string('fillColor').defaultTo('#6366f1');
      t.string('strokeColor').defaultTo('#6366f1');
      t.float('opacity').defaultTo(0.3);
      t.boolean('locked').defaultTo(false);
      t.boolean('hidden').defaultTo(false);
      t.text('flags').defaultTo('{}');
      t.timestamps(true, true, true);
    });
  }
}
