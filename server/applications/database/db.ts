import knex from 'knex';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import logger from '../utils/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Resolve the OS-standard per-user app data folder. Used both under Electron
// and plain Node — user data (db, config, logs) must never live inside the
// install/checkout folder itself.
export function getAppDataPath(): string {
  const appData = process.env.LOCALAPPDATA || (process.platform === 'darwin' ? path.join(process.env.HOME || '', 'Library/Application Support') : path.join(process.env.HOME || '', '.config'));
  // Dev (tsx, migrations .ts) and packaged/built runs (migrations .js compiladas)
  // gravam nomes de migration diferentes na mesma tabela de controle do Knex se
  // compartilharem a pasta — o Knex acusa "migration directory is corrupt" ao
  // alternar entre eles. `npm_lifecycle_event` é setado automaticamente pelo npm
  // (sem custo, sem dependência nova) só quando rodando via `npm run dev*`.
  const isDev = process.env.npm_lifecycle_event?.startsWith('dev') ?? false;
  return path.join(appData, isDev ? 'LoomVTT-Dev' : 'LoomVTT');
}

const appDataDir = getAppDataPath();

// Ensure the sub-directory structure inside the AppData path
export function ensureDirectoryStructure(root: string) {
  const dirs = [
    path.join(root, 'Config'),
    path.join(root, 'Data'),
    path.join(root, 'Data', 'worlds'),
    path.join(root, 'Data', 'assets'),
    path.join(root, 'Logs')
  ];
  for (const d of dirs) {
    if (!fs.existsSync(d)) {
      try {
        fs.mkdirSync(d, { recursive: true });
      } catch { }
    }
  }
}

export function getConfigPath(): string {
  return path.join(appDataDir, 'Config', 'loom.config.json');
}

// Load configuration file
export let config: any = {};
try {
  ensureDirectoryStructure(appDataDir);
  const configPath = getConfigPath();
  const defaultConfig = {
    dataPath: "",
    dbClient: "better-sqlite3",
    port: 3000,
    language: "pt-BR",
    compressStatic: true,
    fullscreen: false,
    upnp: true,
    tunnelMode: "off",
    tunnelName: ""
  };

  if (fs.existsSync(configPath)) {
    const loadedConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    config = { ...defaultConfig, ...loadedConfig };
  } else {
    // Write default loom.config.json if it doesn't exist
    fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2), 'utf8');
    config = defaultConfig;
  }
} catch (err: any) {
  logger.error('Failed to read or write loom.config.json', { error: err.message });
}

export function getDataRoot(): string {
  const resolvedPath = config.dataPath || config.dataRoot;
  if (resolvedPath && resolvedPath.trim()) {
    const resolved = path.resolve(resolvedPath.trim());
    if (!fs.existsSync(resolved)) {
      try {
        fs.mkdirSync(resolved, { recursive: true });
      } catch { }
    }
    return resolved;
  }
  return path.join(appDataDir, 'Data');
}

const dbClient = config.dbClient === 'better-sqlite3' ? 'sqlite3' : (config.dbClient || 'sqlite3');
const dbPath = path.resolve(getDataRoot(), 'rpg-core.sqlite');

const migrationsDir = path.resolve(__dirname, 'migrations');
const seedsDir = path.resolve(__dirname, 'seeds');

let knexConfig: any = {};

if (dbClient === 'sqlite3') {
  knexConfig = {
    client: 'better-sqlite3',
    connection: {
      filename: dbPath,
    },
    useNullAsDefault: true,
    migrations: { directory: migrationsDir },
    seeds: { directory: seedsDir },
  };
} else if (dbClient === 'mysql') {
  knexConfig = {
    client: 'mysql2',
    connection: {
      host: config.dbHost || 'localhost',
      port: Number(config.dbPort) || 3306,
      user: config.dbUser || 'root',
      password: config.dbPassword || '',
      database: config.dbName || 'loomvtt',
    },
    migrations: { directory: migrationsDir },
    seeds: { directory: seedsDir },
  };
} else if (dbClient === 'pg' || dbClient === 'supabase') {
  // 'supabase' é um valor de dbClient próprio, separado de 'pg' — mesmo driver
  // Knex (é Postgres por baixo), mas SSL é sempre obrigatório lá (conexão
  // externa gerenciada), então força `ssl: true` mesmo se o usuário esquecer
  // de marcar o checkbox, em vez de deixar a conexão falhar silenciosamente.
  const forceSsl = dbClient === 'supabase';
  knexConfig = {
    client: 'pg',
    connection: {
      host: config.dbHost || 'localhost',
      port: Number(config.dbPort) || 5432,
      user: config.dbUser || '',
      password: config.dbPassword || '',
      database: config.dbName || 'loomvtt',
      // Provedores gerenciados (Supabase, Neon, RDS, etc) exigem SSL na conexão
      // externa — sem isso a conexão é recusada. `rejectUnauthorized: false`
      // porque a autenticação real aqui é usuário/senha, não o certificado.
      ssl: (forceSsl || config.dbSsl) ? { rejectUnauthorized: false } : undefined,
    },
    // Isola as tabelas do LoomVTT num schema próprio ('loomvtt', não 'public')
    // quando o banco é compartilhado com outra aplicação (ex: um site que já
    // usa o mesmo projeto Supabase). Evita colisão de nome de tabela e não
    // encosta no schema 'auth' que o Supabase usa pra login/OAuth próprio.
    // No SQLite/MySQL locais isso não se aplica — searchPath é conceito só de Postgres.
    searchPath: dbClient === 'supabase' ? [config.dbSchema || 'loomvtt', 'public'] : undefined,
    migrations: { directory: migrationsDir },
    seeds: { directory: seedsDir },
  };
}

let tableDbResolver: ((tableName: string) => any) | null = null;
export function registerTableDbResolver(resolver: (tableName: string) => any) {
  tableDbResolver = resolver;
}

export const rawDb = knex(knexConfig);
const knexInstance = rawDb;

// Testa a conexão real assim que o server sobe — sem isso, um host/senha/porta
// errados só apareciam como erro genérico do driver na primeira query feita,
// em qualquer lugar do código, sem dizer que o problema é a conexão de banco.
if (dbClient === 'pg' || dbClient === 'supabase' || dbClient === 'mysql') {
  rawDb.raw('SELECT 1')
    .then(() => {
      logger.info(`Conexão com o banco (${dbClient}) confirmada com sucesso`, { host: config.dbHost, database: config.dbName });
    })
    .catch((err: any) => {
      logger.error(
        `[DATABASE] Falha ao conectar em "${config.dbHost}:${config.dbPort}" (${dbClient}). ` +
        `Verifique host/porta/usuário/senha/nome do banco (NÃO é apikey do Supabase — essa conexão usa a senha real do banco, achada em "Database Settings > Connection String" no painel do provedor). Erro original: ${err?.message || String(err)}`
      );
    });
}

export const db = new Proxy(knexInstance, {
  apply(target, thisArg, argArray) {
    const tableName = argArray[0];
    if (tableName && tableDbResolver) {
      const resolvedKnex = tableDbResolver(tableName);
      if (resolvedKnex !== target) {
        return resolvedKnex(tableName);
      }
    }
    return Reflect.apply(target, thisArg, argArray);
  }
});

export async function initializeDatabase() {
  logger.info('Initializing relational database', { dbPath: dbClient === 'sqlite3' ? dbPath : undefined, client: dbClient });

  // Log the exact path resolved for diagnostic purposes
  try {
    const appData = process.env.APPDATA || (process.platform === 'darwin' ? path.join(process.env.HOME || '', 'Library/Application Support') : path.join(process.env.HOME || '', '.config'));
    const logDir = path.join(appData, 'LoomVTT');
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
    fs.writeFileSync(path.join(logDir, 'dbPath.txt'), `dbClient: ${dbClient}\ndbPath: ${dbPath}\n`, 'utf8');
  } catch (e) { }

  try {
    if (dbClient === 'sqlite3') {
      await db.raw('PRAGMA journal_mode=WAL');
      await db.raw('PRAGMA foreign_keys = ON');
    }

    // Definir searchPath (dbClient==='supabase') não cria o schema sozinho — sem
    // isso, a primeira migration falharia com "schema does not exist" num banco
    // Supabase novo. Cria o schema (idempotente) antes de qualquer migration rodar.
    if (dbClient === 'supabase') {
      const schemaName = config.dbSchema || 'loomvtt';
      await db.raw(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);
      logger.info(`Schema "${schemaName}" garantido no Postgres (Supabase)`);
    }

    await db.migrate.latest();
    await db.seed.run();

    logger.info('Database migrations and seeds completed successfully');
  } catch (error: any) {
    logger.error('Database initialization error occurred', {
      message: error.message,
      stack: error.stack,
    });
    throw error;
  }
}
