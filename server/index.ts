// Precisa ser o primeiro import — outros modulos leem process.env.LOOM_SITE_URL
// (etc) no proprio module-load, entao o .env tem que estar carregado antes
// deles. Nunca comitado (.gitignore); em producao/instalador essas vars vem
// do ambiente real, o .env e' so' conveniencia de dev local.
//
// Caminho explicito (nao so' `dotenv/config`, que resolve pelo cwd do
// processo) — quando o server e' lancado por um launcher/instalador com cwd
// diferente da raiz do repo, `dotenv/config` sozinho nao acha o arquivo e
// falha calado.
import dotenv from 'dotenv';
import pathForEnv from 'path';
import { fileURLToPath as fileURLToPathForEnv } from 'url';
const dotenvResult = dotenv.config({
  path: pathForEnv.join(pathForEnv.dirname(fileURLToPathForEnv(import.meta.url)), '..', '.env'),
  // Sem isso, uma env var do SO com o mesmo nome (ex: setada numa sessao de
  // terminal anterior) vence o .env silenciosamente — .env deve sempre ganhar
  // em dev local, que e' o unico lugar onde ele existe.
  override: true,
});
console.log('[dotenv] path:', dotenvResult.error ? `ERRO: ${dotenvResult.error.message}` : 'carregado ok', '| LOOM_SITE_URL =', process.env.LOOM_SITE_URL);

import express from 'express';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { db, initializeDatabase, getDataRoot, config } from './applications/database/db.js';
import { syncWorldsOnDisk, setActiveWorldDb, clearActiveWorldDb, cleanupEmptyCentralTables, activeWorldId } from './applications/database/world-db.js';
import { Signal } from './applications/signals/index.js';
import logger from './applications/utils/logger.js';
import { expandObject } from './applications/utils/helpers.js';
import { mutationLoopGuard } from './applications/middleware/mutation-loop-guard.js';
import { canEdit } from './applications/middleware/permissions.js';
import { castRouter } from './applications/api/cast.js';
import { stagesRouter } from './applications/api/stages.js';
import { levelsRouter, stageLevelsRouter } from './applications/api/levels.js';
import { actorsRouter, getRulesetLimitedFields } from './applications/api/actors.js';
import { redactActorForLimited } from './applications/lib/actor-prepare.js';
import { WorldsDocument } from './applications/schemas/worlds.schema.js';
import { assetsRouter } from './applications/api/assets.js';
import { fontsRouter } from './applications/api/fonts.js';
import { tilesRouter } from './applications/api/tiles.js';
import { exportRouter } from './applications/api/export.js';
import { tunnelRouter } from './applications/api/tunnel.js';
import { docsRouter } from './applications/api/docs.js';
import { worldsRouter } from './applications/api/worlds.js';
import { combatRouter } from './applications/api/combat.js';
import { wallsRouter } from './applications/api/walls.js';
import { notesRouter } from './applications/api/notes.js';
import { settingsRouter } from './applications/api/settings.js';
import { usersRouter } from './applications/api/users.js';
import { moduleSettingsRouter } from './applications/api/module-settings.js';
import { verifyToken, type JwtPayload } from './applications/middleware/auth.js';
import { rollTablesRouter } from './applications/api/roll-tables.js';
import { drawingsRouter } from './applications/api/drawings.js';
import { compendiumRouter } from './applications/api/compendium.js';
import { macrosRouter } from './applications/api/macros.js';
import { chatMessagesRouter } from './applications/api/chat-messages.js';
import { itemsRouter } from './applications/api/items.js';
import { journalsRouter } from './applications/api/journals.js';
import { foldersRouter } from './applications/api/folders.js';
import { lightsRouter } from './applications/api/lights.js';
import { playlistsRouter } from './applications/api/playlists.js';
import { setupRouter } from './applications/api/setup.js';
import { systemsRouter } from './applications/api/systems.js';
import { marketplaceRouter } from './applications/api/marketplace.js';
import { addonsRouter } from './applications/addons/addon-api.js';
import { systemApiRouter } from './applications/api/system.js';
import { buffsRouter } from './applications/api/buffs.js';
import { zonesRouter } from './applications/api/zones.js';
import { noisesRouter } from './applications/api/noises.js';
import { templatesRouter } from './applications/api/templates.js';
import { campaignsRouter } from './applications/api/campaigns.js';
import { decksRouter } from './applications/api/decks.js';
import { fogRevealsRouter } from './applications/api/fog-reveals.js';
import { languagesRouter } from './applications/api/languages.js';
import { bugReportsRouter } from './applications/api/bug-reports.js';
import packageRouter from './applications/routes/package-routes.js';
import { loadAllAddons, getLoadedAddons } from './applications/addons/loader.js';
import { discordRouter } from './applications/api/discord.js';
import { randomUUID } from 'crypto';
import { roll } from './applications/dice/roller.js';
import { joinWorld, leaveWorld, joinStage, leaveAllRooms, leaveAllStageRooms, broadcastToWorld, broadcastToWorldOwned, broadcastToStage, broadcastToAllSockets, setIo, worldRoom, stageRoom, WORLD_ROOM_PREFIX } from './applications/ws/channels.js';
import { SystemRegistry } from './applications/systems/system-registry.js';
import { getLoadedAddons as getServerAddons } from './applications/addons/loader.js';
import { resolveAppRoot } from './applications/utils/app-root.js';
import { LicenseManager } from './applications/licensing/license-manager.js';
import { loomAccountRouter } from './applications/api/loom-account.js';
import { backgroundRenewAccount } from './applications/licensing/loom-account.js';

interface ConnectedUser {
  clientId: string;
  worldId: string;
  userId: string;
  userName: string;
  userColor: string;
  userRole: number;
  socketId: string;
  /** Stage que esse socket tá sincronizado agora — atualizado no handler de
   * `context.update` (mesmo sinal que já existia pra entrar/sair de sala de WS por
   * stage). Usado pra mostrar quem tá em cada cena no StageNav (badge colorido). */
  currentStageId?: string | null;
}

// Track connected users { socketId -> ConnectedUser }
export const connectedUsers: Map<string, ConnectedUser> = new Map();

// Rate limiting for WebSocket messages
const messageRateLimit = new Map<string, number[]>();
const RATE_LIMIT_WINDOW = 1000; // 1 second window
const RATE_LIMIT_MAX = 10; // max 10 messages per second per client

function isRateLimited(clientId: string): boolean {
  const now = Date.now();
  const timestamps = messageRateLimit.get(clientId) || [];
  
  // Clean old timestamps
  const recentTimestamps = timestamps.filter(timestamp => now - timestamp < RATE_LIMIT_WINDOW);
  messageRateLimit.set(clientId, recentTimestamps);
  
  if (recentTimestamps.length >= RATE_LIMIT_MAX) {
    return true;
  }
  
  recentTimestamps.push(now);
  messageRateLimit.set(clientId, recentTimestamps);
  return false;
}

// Periodic cleanup for rate limiting (every minute)
setInterval(() => {
  const now = Date.now();
  for (const [clientId, timestamps] of messageRateLimit.entries()) {
    const recent = timestamps.filter(t => now - t < RATE_LIMIT_WINDOW);
    if (recent.length === 0) {
      messageRateLimit.delete(clientId);
    } else {
      messageRateLimit.set(clientId, recent);
    }
  }
}, 60000);

/** connectedUsers é indexado por conexão (clientId), não por usuário — o mesmo usuário pode ter
 * mais de um socket aberto (reload antes do disconnect, múltiplas abas). Dedupe por userId antes
 * de listar, senão ele aparece duplicado pra outros clientes (ex: GM duplicado na lista de jogadores). */
function getOnlineUsersForWorld(worldId: string): ConnectedUser[] {
  const seen = new Map<string, ConnectedUser>();
  for (const u of connectedUsers.values()) {
    if (u.worldId === worldId) seen.set(u.userId, u);
  }
  return Array.from(seen.values());
}

import fs from 'fs';
import path from 'path';

// Global error handlers
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception occurred', { message: error.message, stack: error.stack });
  try {
    const isElectron = !!process.versions.electron;
    let logDir = '';
    if (isElectron) {
      const appData = process.env.LOCALAPPDATA || (process.platform === 'darwin' ? path.join(process.env.HOME || '', 'Library/Application Support') : path.join(process.env.HOME || '', '.config'));
      logDir = path.join(appData, 'LoomVTT', 'Logs');
    } else {
      logDir = path.join(process.cwd(), 'Logs');
    }
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
    fs.writeFileSync(path.join(logDir, 'error.txt'), `UNCAUGHT EXCEPTION:\n${error.stack || error.message}`, 'utf8');
  } catch (e) { }
  process.exit(1);
});

process.on('unhandledRejection', (reason: any) => {
  logger.error('Unhandled Rejection occurred', { reason: reason?.message || reason });
  try {
    const isElectron = !!process.versions.electron;
    let logDir = '';
    if (isElectron) {
      const appData = process.env.LOCALAPPDATA || (process.platform === 'darwin' ? path.join(process.env.HOME || '', 'Library/Application Support') : path.join(process.env.HOME || '', '.config'));
      logDir = path.join(appData, 'LoomVTT', 'Logs');
    } else {
      logDir = path.join(process.cwd(), 'Logs');
    }
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
    fs.writeFileSync(path.join(logDir, 'error.txt'), `UNHANDLED REJECTION:\n${reason?.stack || reason?.message || String(reason)}`, 'utf8');
  } catch (e) { }
});


import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Atras do cloudflared (ou qualquer reverse proxy) o Express so enxerga o IP
// local do tunel. Sem isto, `req.ip` e igual pra todo mundo e os rate limits
// viram um balde unico compartilhado — um atacante consome a cota dos jogadores
// legitimos e bloquear ele bloqueia o GM junto. Tambem e o que faz
// `req.protocol` refletir o https real da borda, usado pelo cookie na Tarefa 2.
//
// `1` = confia num unico hop (o cloudflared roda na mesma maquina). NAO use
// `true`: confiar na cadeia inteira permite forjar X-Forwarded-For e escapar
// do rate limit.
app.set('trust proxy', 1);

const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173';
app.use(cors({
  origin: CORS_ORIGIN,
  credentials: true,
}));

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: {
    useDefaults: false,
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com', 'https://cdnjs.cloudflare.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com', 'https://cdnjs.cloudflare.com'],
      connectSrc: ["'self'", 'ws:', 'wss:', 'data:'],
      imgSrc: ["'self'", 'data:', 'blob:'],
      mediaSrc: ["'self'", 'data:', 'blob:'],
      frameSrc: ["'self'"],
      workerSrc: ["'self'", 'blob:'],
      baseUri: ["'self'"],
      formAction: ["'self'"],
    },
  },
}));

app.use(express.json({ limit: '1mb' }));
app.use((req, res, next) => {
  if (req.body && typeof req.body === 'object' && !Array.isArray(req.body)) {
    req.body = expandObject(req.body);
    // `system` aqui significa o blob de dados do sistema de RPG (legado de
    // sistemas convertidos) → vira `systemData`. Mas em /api/worlds, `system`
    // é a string do ruleset escolhido pro mundo ('wod5e' etc) — sentido
    // completamente diferente. Sem essa exclusão, esse middleware global
    // apagava o campo antes da rota de criação de mundo receber, e todo
    // mundo criado caía no default 'generic' independente do que a tela de
    // criação mandava.
    if ('system' in req.body && !req.path.startsWith('/api/worlds')) {
      req.body.systemData = req.body.system;
      delete req.body.system;
    }
  }
  next();
});
app.use(cookieParser());

// Rate limiting for API routes (elevated for fast VTT drag-and-drop operations)
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 2000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});
app.use('/api', apiLimiter);

// Disjuntor por recurso: corta qualquer rota de mutação (PUT/PATCH/DELETE) que martele o
// MESMO documento repetidamente em pouco tempo — independe de achar a causa de um loop
// específico de render/WS em algum sistema convertido, bloqueia na origem, no servidor.
app.use('/api', (req, res, next) => {
  if (req.method === 'PUT' || req.method === 'PATCH' || req.method === 'DELETE') {
    return mutationLoopGuard(req, res, next);
  }
  next();
});

// Endpoints de validação e ativação de licença (públicos)
app.get('/api/license/status', (_req, res) => {
  const isValid = LicenseManager.isLicenseValid();
  const isDevEnv = LicenseManager.isDevEnvironment();
  res.json({
    valid: isValid,
    isDev: config?.license?.isDev ?? false,
    isDevEnvironment: isDevEnv,
    plan: config?.license?.plan || null,
    validUntil: config?.license?.validUntil || null,
  });
});

app.post('/api/license/activate', async (req, res) => {
  const { key } = req.body || {};
  if (!key || typeof key !== 'string') {
    return res.status(400).json({ error: 'Chave de licença não fornecida.' });
  }
  const result = await LicenseManager.activateLicense(key);
  if (!result.success) {
    return res.status(400).json({ error: result.message });
  }
  res.json({ success: true, message: result.message });
});

// Interceptador Global de Licença (DRM Amigável com Allowlist)
app.use((req, res, next) => {
  const reqPath = req.path;
  const isAllowed =
    reqPath.startsWith('/api/license/') ||
    reqPath === '/api/health' ||
    reqPath.startsWith('/css/') ||
    reqPath.startsWith('/js/') ||
    reqPath.startsWith('/styles/') ||
    reqPath.startsWith('/fonts/') ||
    reqPath.startsWith('/images/') ||
    reqPath.startsWith('/icons/') ||
    reqPath.startsWith('/locales/') ||
    reqPath === '/favicon.ico' ||
    reqPath.startsWith('/@') ||
    reqPath.startsWith('/src/') ||
    reqPath.startsWith('/lib/') ||
    reqPath.startsWith('/client/') ||
    reqPath.startsWith('/node_modules/');

  if (isAllowed) {
    return next();
  }

  // Se a licença não for válida, bloqueia todas as rotas da API com 403
  if (!LicenseManager.isLicenseValid()) {
    if (reqPath.startsWith('/api/')) {
      return res.status(403).json({
        error: 'LoomVTT não ativado. Uma licença válida é necessária para acessar o servidor.',
        code: 'LICENSE_REQUIRED',
      });
    }
  }

  next();
});

// Express HTTP request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.debug('HTTP Request processed', {
      method: req.method,
      url: req.url,
      status: res.statusCode,
      durationMs: duration,
    });
  });
  next();
});

// Serve client folder statically with caching headers.
// Candidates cover: packaged release (index.js + client/ as siblings),
// raw `node dist/server/index.js` before packaging (dist/server + dist/client
// as siblings), dev fallback to the static `public/` folder.
const publicPathCandidates = [
  path.resolve(__dirname, 'client'),
  path.resolve(__dirname, '../dist/client'),
  path.resolve(__dirname, '../client'),
];
let publicPath = publicPathCandidates.find((p) => fs.existsSync(p) && fs.existsSync(path.join(p, 'index.html')));

if (!publicPath) {
  // Fallback for dev mode where the client is not built/packaged yet
  const devStaticCandidates = [
    path.resolve(__dirname, 'public'),
    path.resolve(__dirname, '../public'),
  ];
  publicPath = devStaticCandidates.find((p) => fs.existsSync(p)) ?? devStaticCandidates[devStaticCandidates.length - 1];
}

app.use(express.static(publicPath, {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.woff2')) {
      res.setHeader('Cache-Control', 'public, max-age=2592000'); // 30 days
    } else if (filePath.endsWith('.mp3')) {
      res.setHeader('Cache-Control', 'public, max-age=604800');  // 7 days
    } else if (filePath.endsWith('.webp') || filePath.endsWith('.png')) {
      res.setHeader('Cache-Control', 'public, max-age=86400');   // 1 day
    }
  }
}));

// Serve Electron frontend (built by Vite) - only in production/Electron mode
const electronFrontendPath = path.resolve(__dirname, '../dist/electron-desktop');
if (fs.existsSync(electronFrontendPath)) {
  app.use(express.static(electronFrontendPath, {
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.js')) {
        res.setHeader('Cache-Control', 'no-cache');
      } else if (filePath.endsWith('.woff2')) {
        res.setHeader('Cache-Control', 'public, max-age=2592000'); // 30 days
      } else if (filePath.endsWith('.mp3')) {
        res.setHeader('Cache-Control', 'public, max-age=604800');  // 7 days
      } else if (filePath.endsWith('.webp') || filePath.endsWith('.png')) {
        res.setHeader('Cache-Control', 'public, max-age=86400');   // 1 day
      }
    }
  }));
}

const server = createServer(app);
const io = new Server(server, {
  path: '/ws',
  cors: {
    origin: CORS_ORIGIN,
    credentials: true,
  },
   transports: ['websocket', 'polling'],
});

// Register io with channels module
setIo(io);

// Conta Loom central — fail-open (ver loom-account.ts).
setInterval(() => { backgroundRenewAccount().catch(() => {}); }, 6 * 60 * 60 * 1000);
backgroundRenewAccount().catch(() => {});

// Socket.IO license middleware — garante que o servidor esteja licenciado
io.use((socket: any, next: any) => {
  if (!LicenseManager.isLicenseValid()) {
    return next(new Error('LICENSE_REQUIRED: Servidor não possui uma licença ativa.'));
  }
  next();
});

// Socket.IO auth middleware — extracts JWT from cookie, attaches to socket.data
io.use(async (socket: any, next: any) => {
  const cookieHeader = socket.handshake.headers?.cookie;
  let token: string | null = null;
  if (cookieHeader) {
    const match = /(?:^|;\s*)loom_world_token=([^;]+)/.exec(cookieHeader);
    token = match ? decodeURIComponent(match[1]) : null;
  }
  const auth = token ? await verifyToken(token) : null;
  if (!auth) {
    return next(new Error('Authentication error'));
  }
  (socket as any).data.auth = auth;
  next();
});

// Handle Express endpoints
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', engine: 'LoomVTT' });
});

// Addon registry endpoint
app.get('/api/addons', (_req, res) => {
  const current = getLoadedAddons();
  const rulesets = current.filter((a: any) => a.type === 'ruleset' && a.loaded);
  res.json({
    addons: current,
    hasRulesets: rulesets.length > 0,
    rulesetCount: rulesets.length,
  });
});

// Mount Cast CRUD router
app.use('/api/cast', castRouter);
app.use('/api/fonts', fontsRouter);

// Mount Stages router
app.use('/api/stages', stagesRouter);

// Mount Levels router (flat CRUD + stage sub-resource)
app.use('/api/levels', levelsRouter);
app.use('/api/stages', stageLevelsRouter);

// Mount Actors router
app.use('/api/actors', actorsRouter);

// Mount Assets router
app.use('/api/assets', assetsRouter);

// Mount Tiles router
app.use('/api/tiles', tilesRouter);

// Mount Export router
app.use('/api/export', exportRouter);
app.use('/api/tunnel', tunnelRouter);

// Mount Worlds + Users router
app.use('/api/worlds', worldsRouter);

// Mount Combat router
app.use('/api/combat', combatRouter);

// Mount Lights router (stage sub-resource)
app.use('/api/stages', lightsRouter);

// Mount Templates router (stage sub-resource)
app.use('/api/stages', templatesRouter);

// Mount Walls router
app.use('/api/walls', wallsRouter);

// Mount Notes router
app.use('/api/notes', notesRouter);

// Mount Settings router
app.use('/api/settings', settingsRouter);

// Mount Module Settings router
app.use('/api/module-settings', moduleSettingsRouter);

// Mount Users router (standalone profile updates)
app.use('/api/users', usersRouter);

// Mount Roll Tables router
app.use('/api/roll-tables', rollTablesRouter);

// Mount Drawings router
app.use('/api/drawings', drawingsRouter);

// Mount Compendium router
app.use('/api/compendium', compendiumRouter);

// Mount Macros router
app.use('/api/macros', macrosRouter);
app.use('/api/chat-messages', chatMessagesRouter);

// Mount Items router
app.use('/api/items', itemsRouter);

// Mount Journals router
app.use('/api/journals', journalsRouter);

// Mount Folders router
app.use('/api/folders', foldersRouter);
app.use('/api/playlists', playlistsRouter);

// Mount Discord router (sub-routes under /api/worlds/:worldId/discord)
app.use('/api/worlds', discordRouter);

// Mount Setup router
app.use('/api/setup', setupRouter);

// New VTT API routers
app.use('/api/buffs', buffsRouter);
app.use('/api/zones', zonesRouter);
app.use('/api/noises', noisesRouter);
app.use('/api/campaigns', campaignsRouter);
app.use('/api/decks', decksRouter);
app.use('/api/fog-reveals', fogRevealsRouter);
app.use('/api/languages', languagesRouter);
app.use('/api/bug-reports', bugReportsRouter);

// Mount per-addon routes — namespace addons register into via
// registerAddonRoutes() in their core.js (loadAllAddons() runs later, at
// boot, but this mount point needs to exist BEFORE the SPA catch-all below,
// not before that call).
app.use('/api/addons', addonsRouter);

// Mount Marketplace router
app.use('/api/marketplace', marketplaceRouter);
app.use('/api/loom-account', loomAccountRouter);
app.use('/api/system', systemApiRouter);

// Mount Systems router
app.use('/api/systems', systemsRouter);

// Mount Packages and World-Packages router
app.use('/api', packageRouter);

// Mount Docs router at /docs/api
app.use('/docs/api', docsRouter);

// Serve docs assets statically (allows openapi.yaml downloads)
const docsStaticPath = path.resolve(resolveAppRoot(), 'client', 'public', 'docs');
app.use('/docs', express.static(docsStaticPath));

// Serve uploads statically
const uploadsStaticPath = path.resolve(getDataRoot(), 'uploads');
app.use('/uploads', express.static(uploadsStaticPath));

// Serve world-scoped assets statically (Data/worlds/<id>/assets/)
//
// O mount NAO pode apontar para Data/worlds: a raiz do mundo guarda
// `world.sqlite` e `world.json`, e o express.static os entregava sem
// autenticacao nenhuma (id de mundo e sequencial, entao a URL era trivial de
// chutar). Blocklist de extensao nao resolve — o proximo arquivo que cair na
// pasta (backup, export, log) volta a vazar por padrao. Em vez disso o root do
// static passa a ser a subpasta `assets` de cada mundo, que e a unica coisa
// que o app publica ali (assets.ts monta a URL como
// /worlds/<id>/assets/<arquivo>). Assim a protecao de traversal que o proprio
// express.static ja tem passa a ter a fronteira certa.
const WORLD_ID_RE = /^[\w-]+$/;
const worldAssetHandlers = new Map<string, ReturnType<typeof express.static>>();
app.use('/worlds/:worldId/assets', (req, res, next) => {
  const { worldId } = req.params;
  // `worldId` chega decodificado pelo Express — sem esta guarda um `%2e%2e`
  // viraria `..` e escaparia do getDataRoot() no path.join abaixo.
  if (!WORLD_ID_RE.test(worldId)) return res.sendStatus(404);
  let handler = worldAssetHandlers.get(worldId);
  if (!handler) {
    handler = express.static(path.join(getDataRoot(), 'worlds', worldId, 'assets'));
    worldAssetHandlers.set(worldId, handler);
  }
  return handler(req, res, next);
});

// Serve marketplace addons and rulesets statically
app.use('/marketplace', express.static(path.join(getDataRoot(), 'marketplace')));

// Serve LoomVTT SDK for addon/system developers
app.use('/_loom/sdk', express.static(path.resolve(__dirname, '..', 'packages', 'sdk', 'dist'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.js')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
  }
}));

// SPA fallback — serve index.html for any non-API route
app.use((req, res) => {
  if (req.path.startsWith('/api')) {
    res.status(404).json({ error: 'API route not found' });
    return;
  }
  const indexPath = path.join(publicPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(503).send('Frontend not built. Run: npm run build');
  }
});

// Broadcast helper - resolves worldId from message and broadcasts only to that world room
// Agora emite eventos tipados (Socket.IO emit) ao invés de eventos 'message' JSON.
// Tambem suporta broadcast para stage rooms (stage:ID) quando o payload tem stageId.
async function broadcastToAll(type: string, data: any, excludeSocketId?: string) {
  let worldId = data?.worldId || data?.data?.worldId;
  const stageId = data?.stageId;

  // Resolve worldId from stageId if missing
  if (!worldId && stageId) {
    try {
      const stage = await db('stages').where({ id: stageId }).first();
      if (stage) worldId = stage.worldId;
    } catch { }
  }

  // Resolve worldId from castId for token movements if missing
  if (!worldId && data?.castId) {
    try {
      const castMember = await db('cast').where({ id: data.castId }).first();
      if (castMember) worldId = castMember.worldId;
    } catch { }
  }

  if (worldId) {
    broadcastToWorld(type, worldId, data, excludeSocketId);
    // Se o evento tambem tem stageId, broadcast para a stage room
    if (stageId) {
      broadcastToStage(type, stageId, data, excludeSocketId);
    }
  } else {
    // System-wide broadcast fallback
    broadcastToAllSockets(type, data, excludeSocketId);
  }
}

Signal.listen('world.deactivated', () => {
  logger.info('Broadcasting world.deactivated event to all clients');
  io.emit('world.deactivated', {});
  // Disconnect all clients since the world is being deactivated
  for (const [socketId, user] of connectedUsers.entries()) {
    const socket = io.sockets.sockets.get(socketId);
    if (socket) {
      socket.disconnect(true);
    }
  }
  connectedUsers.clear();
});

Signal.listen('world.paused', (payload) => {
  broadcastToAll('world.paused', payload);
  logger.debug('Signal world.paused relayed to WS clients', { worldId: payload.worldId });
});

Signal.listen('world.resumed', (payload) => {
  broadcastToAll('world.resumed', payload);
  logger.debug('Signal world.resumed relayed to WS clients', { worldId: payload.worldId });
});

Signal.listen('time.updated', (payload) => {
  broadcastToAll('time.updated', payload);
});

// Wire Signal → WebSocket relay
//
// Sempre filtrado por mundo (broadcastToWorldOwned) — nunca broadcastToAll,
// senao um jogador em outro mundo no mesmo servidor recebe/renderiza token de
// mundo alheio (era exatamente isso que acontecia antes desta correcao).
// `hidden: true` (token de mapa escondido do GM, ex: emboscada) some tambem
// controla VISIBILIDADE DENTRO do mundo: defaultPerm=0 = so GM da sala recebe;
// token normal usa defaultPerm=1 = qualquer um autenticado naquele mundo.
Signal.listen('cast.created', (payload) => {
  const data = payload.data ?? payload;
  const defaultPerm = data?.hidden ? 0 : 1;
  void broadcastToWorldOwned('cast.created', data.worldId, data, {}, defaultPerm);
  logger.debug('Signal cast.created relayed to WS clients', { id: data?.id });
});

Signal.listen('cast.updated', (payload) => {
  const data = payload.data ?? payload;
  const excludeSocketId = data._socketId;
  const clean = { ...data };
  delete clean._socketId;
  const defaultPerm = clean?.hidden ? 0 : 1;
  void broadcastToWorldOwned('cast.updated', clean.worldId, clean, {}, defaultPerm, excludeSocketId);
  logger.debug('Signal cast.updated relayed to WS clients', { data: clean });
});

Signal.listen('cast.deleted', (payload) => {
  // LoomDocument.delete() genérico dispara { id } plano; a rota /api/cast/:id
  // dispara { data: { id } } aninhado — aceitar os dois formatos.
  const data = payload.data ?? payload;
  void broadcastToWorldOwned('cast.deleted', data.worldId, data, {}, 1);
  logger.debug('Signal cast.deleted relayed to WS clients', { id: data?.id });
});

Signal.listen('token.moved', (payload: any) => {
  const excludeSocketId = payload._socketId;
  const clean = { ...payload };
  delete clean._socketId;
  void broadcastToWorldOwned('token.moved', clean.worldId, clean, {}, 1, excludeSocketId);
});

// Wire Tile Signals → WebSocket relay
//
// Tile não tem worldId (só stageId) — broadcastToWorldOwned não serve aqui,
// era isso que fazia o broadcast morrer silenciosamente (worldId sempre
// undefined). broadcastToStage é o escopo certo: mais preciso ainda que
// mundo inteiro, porque só quem está olhando aquela stage específica recebe.
//
// Signal.listen escuta no PLURAL ('tiles.*') porque é isso que o Document
// genérico dispara de verdade (`${schema.tableName}.created`, e tableName da
// tiles.schema é 'tiles'). O nome emitido pro WS continua singular
// ('tile.created' etc.) porque é isso que o client (game-hud.ts) já escuta —
// só o Signal interno estava com a chave errada, então esse relay inteiro
// nunca disparava (tiles nunca sincronizavam em tempo real entre clients).
Signal.listen('tiles.created', (payload: any) => {
  const tile = payload.data ?? payload;
  broadcastToStage('tile.created', tile.stageId, tile);
});

Signal.listen('tiles.updated', (payload: any) => {
  const tile = payload.data ?? payload;
  broadcastToStage('tile.updated', tile.stageId, tile);
});

Signal.listen('tiles.deleted', (payload: any) => {
  const data = payload.data ?? payload;
  broadcastToStage('tile.deleted', data.stageId, data);
});

// Wire Deck Signals → WebSocket relay.
// Faltava este relay inteiro — server/applications/api/decks.ts sempre chamou
// Signal.broadcast('deck.created'/'deck.updated'/'deck.deleted', ...), mas sem
// Signal.listen() correspondente aqui o evento nunca saía do processo do servidor.
// PUT/POST/DELETE sempre respondiam 200 normalmente, só que nenhum client (nem o
// que fez a própria request) jamais recebia o update de volta — criar/puxar/remover
// carta parecia não fazer nada na tela, mesmo com o banco mudando de verdade.
Signal.listen('deck.created', (deck: any) => {
  void broadcastToWorldOwned('deck.created', deck.worldId, deck, {}, 0);
});

Signal.listen('deck.updated', (deck: any) => {
  void broadcastToWorldOwned('deck.updated', deck.worldId, deck, {}, 0);
});

// Mesmo bug de nome que tiles: decks.schema tableName é 'decks' (plural), o
// Document.delete() genérico dispara 'decks.deleted', mas o listener escutava
// singular — nunca disparava. Payload já bate ({ id, worldId, stageId } flat,
// sem wrapper .data), só a chave do Signal.listen estava errada.
Signal.listen('decks.deleted', (payload: any) => {
  void broadcastToWorldOwned('deck.deleted', payload.worldId, payload, {}, 0);
});

// Wire Level Signals → WebSocket relay.
// Faltava este relay desde que os andares entraram: sem ele o Signal ficava
// preso no servidor e o andar novo so aparecia na barra de cenas apos um F5.
Signal.listen('levels.changed', (payload: any) => {
  broadcastToAll('levels.changed', payload);
});

// Wire Stage Signals → WebSocket relay
Signal.listen('stages.created', (payload) => {
  broadcastToAll('stage.created', payload.data ?? payload);
});

Signal.listen('stage.activated', (payload) => {
  broadcastToAll('stage.activated', payload);
  logger.debug('Signal stage.activated relayed to WS clients', { stageId: payload.stageId });
});

Signal.listen('stages.updated', (payload) => {
  broadcastToAll('stage.updated', payload.data ?? payload);
});

Signal.listen('stages.deleted', (payload) => {
  broadcastToAll('stage.deleted', payload.data ?? payload);
});

// Wire Level Signals → WebSocket relay (LoomDocument broadcasts levels.*)
Signal.listen('levels.created', (payload) => {
  broadcastToAll('level.created', payload.data ?? payload);
});

Signal.listen('levels.updated', (payload) => {
  broadcastToAll('level.updated', payload.data ?? payload);
});

Signal.listen('levels.deleted', (payload) => {
  broadcastToAll('level.deleted', payload.data ?? payload);
});

Signal.listen('stage.darkness', (payload) => {
  broadcastToAll('stage.darkness', payload);
  logger.debug('Signal stage.darkness relayed to WS clients', { stageId: payload.stageId });
});

// Wire Wall Signals → WebSocket relay
Signal.listen('wall.updated', (wall) => {
  broadcastToAll('wall.updated', wall);
});

Signal.listen('wall.created', (wall) => {
  broadcastToAll('wall.created', wall);
});

Signal.listen('wall.deleted', (payload) => {
  broadcastToAll('wall.deleted', payload);
});

Signal.listen('door.state', (payload) => {
  broadcastToAll('door.state', payload);
  logger.debug('Signal door.state relayed to WS clients', { wallId: payload.wallId, doorState: payload.doorState });
});

// Wire Token target → WebSocket relay
Signal.listen('token.target', (payload) => {
  broadcastToAll('token.target', payload);
});

// Wire Drawing Signals → WebSocket relay
Signal.listen('drawing.created', (drawing) => {
  broadcastToAll('drawing.created', drawing);
});

Signal.listen('drawing.updated', (drawing) => {
  broadcastToAll('drawing.updated', drawing);
});

Signal.listen('drawing.deleted', (payload) => {
  broadcastToAll('drawing.deleted', payload);
});

Signal.listen('drawing.cleared', (payload) => {
  broadcastToAll('drawing.cleared', payload);
});

// Wire Roll Table Signals → WebSocket relay
Signal.listen('roll-table.rolled', (payload) => {
  broadcastToAll('roll-table.rolled', payload);
});

// Wire Compendium Pack Signals → WebSocket relay (via LoomDocument auto-broadcast)
Signal.listen('compendium_packs.created', (payload) => {
  broadcastToAll('compendium.created', payload.data ?? payload);
});
Signal.listen('compendium_packs.updated', (payload) => {
  broadcastToAll('compendium.updated', payload.data ?? payload);
});
Signal.listen('compendium_packs.deleted', (payload) => {
  broadcastToAll('compendium.deleted', payload);
});

// Wire Compendium Entry Signals → WebSocket relay
Signal.listen('compendium.entry.updated', (payload) => {
  broadcastToAll('compendium.entry.updated', payload);
});

// Wire Addon Install/Uninstall Signals → WebSocket relay
Signal.listen('addon.installed', (payload) => {
  broadcastToAll('addon.installed', payload);
  logger.info('Signal addon.installed relayed to WS clients', { name: payload.name, type: payload.type });
});

Signal.listen('addon.uninstalled', (payload) => {
  broadcastToAll('addon.uninstalled', payload);
  logger.info('Signal addon.uninstalled relayed to WS clients', { name: payload.name, type: payload.type });
});

// Wire Actor Signals → WebSocket relay
// LoomDocument.create/update/delete broadcast `${tableName}.<action>` — actors table is plural.
// Nivel 1 (Limitado) recebe uma versao recortada do actor no push ao vivo,
// nao o systemData inteiro — mesma regra da rota GET (actors.ts). O lookup
// do world.system e assincrono, entao o recorte e computado uma vez aqui e
// passado pronto (funcao sincrona) pro broadcastToWorldOwned.
async function broadcastActorFiltered(type: string, actor: any): Promise<void> {
  const world = await WorldsDocument.findById<any>(actor.worldId);
  const limitedFields = world?.system ? getRulesetLimitedFields(world.system) : [];
  const redacted = redactActorForLimited(actor, limitedFields);
  void broadcastToWorldOwned(type, actor.worldId, actor, actor.ownership, 0, undefined, () => redacted);
}

Signal.listen('actors.created', (payload) => {
  const actor = payload.data ?? payload;
  void broadcastActorFiltered('actor.created', actor);
  logger.debug('Signal actors.created relayed to WS clients', { id: actor.id });
});

Signal.listen('actors.updated', (payload) => {
  const actor = payload.data ?? payload;
  void broadcastActorFiltered('actor.updated', actor);
  logger.debug('Signal actors.updated relayed to WS clients', { id: actor.id });
});

Signal.listen('actors.deleted', (payload) => {
  broadcastToAll('actor.deleted', payload);
  logger.debug('Signal actor.deleted relayed to WS clients', { id: payload.id });
});

// Wire Actor Signals → WebSocket relay — sem isto `document-sheet.ts` (que assina
// `${documentName}.updated` = `actor.updated`) nunca recebe nada: o sinal era disparado
// (`Signal.broadcast('actor.updated', ...)` em actors.ts/items.ts) mas nenhum listener
// aqui repassava pro socket, então a ficha só via itens/campos novos reabrindo do zero.
Signal.listen('actor.updated', (actor) => {
  void broadcastToWorldOwned('actor.updated', actor.worldId, actor, actor.ownership, 0);
  logger.debug('Signal actor.updated relayed to WS clients', { id: actor.id });
});

// Wire Item Signals → WebSocket relay
Signal.listen('item.created', (item) => {
  void broadcastToWorldOwned('item.created', item.worldId, item, item.ownership, 0);
  logger.debug('Signal item.created relayed to WS clients', { id: item.id });
});

Signal.listen('item.updated', (item) => {
  void broadcastToWorldOwned('item.updated', item.worldId, item, item.ownership, 0);
  logger.debug('Signal item.updated relayed to WS clients', { id: item.id });
});

Signal.listen('item.deleted', (payload) => {
  broadcastToAll('item.deleted', payload);
  logger.debug('Signal item.deleted relayed to WS clients', { id: payload.id });
});

// Wire Journal Signals → WebSocket relay
Signal.listen('journal.created', (entry) => {
  void broadcastToWorldOwned('journal.created', entry.worldId, entry, entry.ownership, 1);
  logger.debug('Signal journal.created relayed to WS clients', { id: entry.id });
});

Signal.listen('journal.updated', (entry) => {
  void broadcastToWorldOwned('journal.updated', entry.worldId, entry, entry.ownership, 1);
  logger.debug('Signal journal.updated relayed to WS clients', { id: entry.id });
});

Signal.listen('journal.deleted', (payload) => {
  broadcastToAll('journal.deleted', payload);
  logger.debug('Signal journal.deleted relayed to WS clients', { id: payload.id });
});

Signal.listen('chat.messageDeleted', (payload) => {
  broadcastToAll('chat.messageDeleted', payload);
});

Signal.listen('chat.messageUpdated', (payload) => {
  broadcastToWorld('chat.messageUpdated', payload.worldId, payload);
});

Signal.listen('chat.cleared', (payload) => {
  broadcastToAll('chat.cleared', payload);
});

// Wire Folder Signals → WebSocket relay
Signal.listen('folder.created', (folder) => {
  broadcastToAll('folder.created', folder);
  logger.debug('Signal folder.created relayed to WS clients', { id: folder.id });
});

Signal.listen('folder.updated', (folder) => {
  broadcastToAll('folder.updated', folder);
  logger.debug('Signal folder.updated relayed to WS clients', { id: folder.id });
});

Signal.listen('folder.deleted', (payload) => {
  broadcastToAll('folder.deleted', payload);
  logger.debug('Signal folder.deleted relayed to WS clients', { id: payload.id });
});

// Wire Playlist Signals → WebSocket relay
Signal.listen('playlist.created', (p) => {
  broadcastToAll('playlist.created', p);
  logger.debug('Signal playlist.created relayed', { id: p.id });
});
Signal.listen('playlist.updated', (p) => {
  broadcastToAll('playlist.updated', p);
  logger.debug('Signal playlist.updated relayed', { id: p.id });
});
Signal.listen('playlist.deleted', (p) => {
  broadcastToAll('playlist.deleted', p);
  logger.debug('Signal playlist.deleted relayed', { id: p.id });
});
Signal.listen('playlist.sound.created', (s) => {
  broadcastToAll('playlist.sound.created', s);
});
Signal.listen('playlist.sound.updated', (s) => {
  broadcastToAll('playlist.sound.updated', s);
});
Signal.listen('playlist.sound.deleted', (s) => {
  broadcastToAll('playlist.sound.deleted', s);
});

// Wire Light Signals → WebSocket relay
Signal.listen('light.created', (l) => {
  broadcastToAll('light.created', l);
});
Signal.listen('light.updated', (l) => {
  broadcastToAll('light.updated', l);
});
Signal.listen('light.deleted', (l) => {
  broadcastToAll('light.deleted', l);
});

// Wire Note Signals → WebSocket relay
Signal.listen('note.created', (note) => {
  broadcastToAll('note.created', note);
});
Signal.listen('note.updated', (note) => {
  broadcastToAll('note.updated', note);
});
Signal.listen('note.deleted', (payload) => {
  broadcastToAll('note.deleted', payload);
});

// Wire Noise (Sound) Signals → WebSocket relay
Signal.listen('noise.created', (n) => {
  broadcastToAll('noise.created', n);
});
Signal.listen('noise.updated', (n) => {
  broadcastToAll('noise.updated', n);
});
Signal.listen('noise.deleted', (n) => {
  broadcastToAll('noise.deleted', n);
});

// Wire Template Signals → WebSocket relay
Signal.listen('template.created', (tpl) => {
  broadcastToAll('template.created', tpl);
});
Signal.listen('template.updated', (tpl) => {
  broadcastToAll('template.updated', tpl);
});
Signal.listen('template.deleted', (payload) => {
  broadcastToAll('template.deleted', payload);
});

// Wire Combat Signals → WebSocket relay
Signal.listen('combat.started', (payload: any) => {
  void broadcastToWorldOwned('combat.started', payload.worldId, payload, {}, 0);
});
Signal.listen('combat.next', (payload: any) => {
  void broadcastToWorldOwned('combat.next', payload.worldId, payload, {}, 0);
});
Signal.listen('combat.ended', (payload: any) => {
  void broadcastToWorldOwned('combat.ended', payload.worldId, payload, {}, 0);
});
Signal.listen('combat.updated', (payload: any) => {
  void broadcastToWorldOwned('combat.updated', payload.worldId, payload, {}, 0);
});

// ── Orphan relays (LoomDocument broadcasts but relay was missing) ──

Signal.listen('macros.created', (payload) => {
  broadcastToAll('macro.created', payload.data ?? payload);
});
Signal.listen('macros.updated', (payload) => {
  broadcastToAll('macro.updated', payload.data ?? payload);
});
Signal.listen('macros.deleted', (payload) => {
  broadcastToAll('macro.deleted', payload);
});

Signal.listen('roll_tables.created', (payload) => {
  broadcastToAll('roll-table.created', payload.data ?? payload);
});
Signal.listen('roll_tables.updated', (payload) => {
  broadcastToAll('roll-table.updated', payload.data ?? payload);
});
Signal.listen('roll_tables.deleted', (payload) => {
  broadcastToAll('roll-table.deleted', payload);
});
Signal.listen('roll_table_entries.created', (payload) => {
  broadcastToAll('roll-table-entry.created', payload.data ?? payload);
});
Signal.listen('roll_table_entries.updated', (payload) => {
  broadcastToAll('roll-table-entry.updated', payload.data ?? payload);
});
Signal.listen('roll_table_entries.deleted', (payload) => {
  broadcastToAll('roll-table-entry.deleted', payload);
});

Signal.listen('users.created', (payload) => {
  broadcastToAll('user.created', payload.data ?? payload);
});
Signal.listen('users.updated', (payload) => {
  broadcastToAll('user.updated', payload.data ?? payload);
});
Signal.listen('users.deleted', (payload) => {
  broadcastToAll('user.deleted', payload);
});

Signal.listen('worlds.created', (payload) => {
  broadcastToAll('world.created', payload.data ?? payload);
});
Signal.listen('worlds.updated', (payload) => {
  broadcastToAll('world.updated', payload.data ?? payload);
});
Signal.listen('worlds.deleted', (payload) => {
  broadcastToAll('world.deleted', payload);
});

/** Achata objeto aninhado em paths `a.b.c` → número, pulando não-numéricos. */
function flattenNumeric(obj: Record<string, any>, prefix = ''): Record<string, number> {
  const result: Record<string, number> = {};
  for (const [key, val] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof val === 'number') result[path] = val;
    else if (typeof val === 'object' && val !== null && !Array.isArray(val))
      Object.assign(result, flattenNumeric(val, path));
  }
  return result;
}
// Socket.IO message router
io.on('connection', (socket: any) => {
  const socketId = socket.id;
  const auth: JwtPayload = socket.data.auth;

  socket.onAny((eventName: string, data: any) => {
    if (eventName === 'message' || eventName === 'disconnect' || eventName === 'error') return;
    if (eventName.startsWith('module.') || eventName.startsWith('system.') || eventName.startsWith('socket.')) {
        // Relay genérico pra addons/sistemas de terceiros — sem schema fixo pra validar,
        // então o único freio possível aqui é taxa. Mesmo balde compartilhado que já
        // protege token.move/chat/tile.effect (10 msg/s por socket), não um limite novo.
        if (isRateLimited(socketId)) {
          logger.warn('WS generic relay rate limited', { socketId, eventName });
          return;
        }
        if (auth?.worldId) {
          broadcastToWorld(eventName, auth.worldId, data, socketId);
        }
    }
  });

  logger.info('WebSocket client connected', { socketId, totalClients: io.engine.clientsCount });

  socket.on('message', async (message: { type: string; data?: any }) => {
    try {
      const { type, data = {} } = message;

      // O core só roda um mundo ativo por vez (`db(tableName)` sempre resolve pro
      // banco de `activeWorldId`, não pro mundo do token do socket). Se o GM trocar
      // de mundo ativo enquanto este socket ainda está conectado ao mundo antigo,
      // processar a mensagem escreveria silenciosamente no banco do mundo NOVO —
      // achado real de segurança/integridade, não hipotético. Rejeita em vez de
      // deixar passar; o client reconecta/relogar ao ver o socket cair.
      if (auth.worldId && activeWorldId && auth.worldId !== activeWorldId) {
        logger.warn('WS message rejected: socket belongs to a world that is no longer active', { socketId, socketWorldId: auth.worldId, activeWorldId, type });
        socket.disconnect(true);
        return;
      }

      logger.debug('WS message received', { type, dataSize: JSON.stringify(message).length });

      // ── User session identification & Init Sync ──────────────────────────────
      if (type === 'user.identify') {
        const worldId = auth.worldId;
        if (!worldId) {
          logger.warn('WS user.identify: token has no worldId (admin token?)');
          return;
        }

        // Register in world room — identity comes from the verified token, never from client-sent data
        joinWorld(socket, worldId);
        connectedUsers.set(socketId, {
          clientId: socketId,
          worldId,
          userId: auth.userId || 'anon',
          userName: auth.userName || 'Anonymous',
          userColor: auth.userColor || '#888',
          userRole: auth.userRole || 1,
          socketId,
        });
        logger.info('User identified and joined world room', { userName: data.userName, worldId });

        try {
          // Initial sync filtered by worldId. Cast is sent unfiltered (all stages) — the
          // client filters by active stage for rendering (see game-hud.ts handleInit /
          // stage.activated), since `stage.activated` broadcasts don't carry a cast list
          // and re-filtering client-side avoids an extra round-trip on every stage switch.
          const currentStages = await db('stages').where({ worldId }).select('*');
          const currentCast = await db('cast').where({ worldId }).select('*');
          const currentActors = await db('actors').where({ worldId }).select('*');

          const stageIds = currentStages.map((s: any) => s.id);
          const currentTiles = stageIds.length > 0 ? await db('tiles').whereIn('stageId', stageIds).select('*') : [];
          const currentDrawings = stageIds.length > 0 ? await db('drawings').whereIn('stageId', stageIds).select('*') : [];
          const currentLights = stageIds.length > 0 ? await db('ambient_lights').whereIn('stageId', stageIds).select('*') : [];
          const currentLevels = stageIds.length > 0 ? await db('levels').whereIn('stageId', stageIds).select('*') : [];

          const enrichedStages = currentStages.map((stage: any) => {
            const levels = currentLevels.filter((l: any) => l.stageId === stage.id).sort((a: any, b: any) => a.bottomElevation - b.bottomElevation);
            const thumbUrl = levels.length > 0 ? levels[0].backgroundUrl : '';
            return {
              ...stage,
              levels,
              thumbUrl,
              bgUrl: thumbUrl
            };
          });

          const activeCombat = await db('combats').where({ worldId, isActive: true }).first() || null;
          const recentChat = await db('chat_messages').where({ worldId }).orderBy('createdAt', 'desc').limit(50).select('*');
          const currentRollTables = await db('roll_tables').where({ worldId }).select('*');
          const currentItems = await db('items').where({ worldId }).select('*');
          const currentJournals = await db('journals').where({ worldId }).select('*');
          const currentFolders = await db('folders').where({ worldId }).select('*');
          const currentPlaylists = await db('playlists').where({ worldId }).select('*');

          // ── Resolve active system & loaded addons for boot log ──────────────
          const activeWorld = await db('worlds').where({ isActive: true }).first();
          const activeSysId = activeWorld?.system || null;
          if (activeSysId && !SystemRegistry.getActive()) SystemRegistry.setActive(activeSysId);
          const activeSystem = SystemRegistry.getActive();
          const loadedAddons = getServerAddons() as any[];
          // `LoadedAddon.version` nao existe — o campo fica em `.manifest.version`
          // (vem do ruleset.json/addon.json). Lendo `a.version` direto sempre dava
          // `undefined`, entao todo addon/ruleset reportava versao null/"unknown"
          // pro client, independente do manifesto real declarar uma versao.
          const moduleList = loadedAddons
            .filter((a: any) => a.type === 'addon' && a.loaded)
            .map((a: any) => ({ name: a.name, version: a.manifest?.version ?? null }));
          const rulesetList = loadedAddons
            .filter((a: any) => a.type === 'ruleset' && a.loaded && a.name === activeSysId)
            .map((a: any) => ({ name: a.name, version: a.manifest?.version ?? null }));
          // `SystemRegistry` (server-side) so tem entrada quando o ruleset chama
          // `.register()` via `globalThis.__loomSystemRegistry` — nenhum ruleset
          // faz isso hoje, entao `activeSystem` e sempre undefined e o boot manifest
          // caia SEMPRE no fallback com `version: 'unknown'` fixo, pra qualquer
          // sistema. O manifesto do addon (ruleset.json) ja tem title/version reais
          // — usa ele no fallback em vez do literal fixo.
          const activeRulesetManifest = loadedAddons.find((a: any) => a.type === 'ruleset' && a.loaded && a.name === activeSysId)?.manifest;

          // Parse JSONFields in cast (SQLite stores them as string)
          const parseJsonField = <T,>(value: unknown, fallback: T): T => {
            if (typeof value !== 'string') return (value as T) ?? fallback;
            try { return JSON.parse(value); } catch { return fallback; }
          };
          const parseCast = (rows: any[]) => rows.map((c: any) => ({
            ...c,
            statusMarkers: parseJsonField(c.statusMarkers, []),
            effects: parseJsonField(c.effects, []),
            ownership: parseJsonField(c.ownership, {}),
            traits: parseJsonField(c.traits, {}),
            systemData: parseJsonField(c.systemData, {}),
            targetedBy: parseJsonField(c.targetedBy, []),
            detectionModes: parseJsonField(c.detectionModes, []),
          }));

          socket.emit('init', {
              // ── Boot manifest (usado pelo cliente para logs de inicialização) ──
              system: activeSystem
                ? { id: activeSystem.id, title: activeSystem.title, version: activeSystem.version, changelogUrl: activeSystem.changelogUrl, wikiUrl: activeSystem.wikiUrl, bugsUrl: activeSystem.bugsUrl }
                : { id: activeSysId, title: activeRulesetManifest?.title || activeSysId, version: activeRulesetManifest?.version || 'unknown' },
              modules: moduleList,
              rulesets: rulesetList,
              permissions: parseJsonField(activeWorld?.permissions, { compendiumEdit: [], viewStages: [] }),
              isPaused: !!activeWorld?.isPaused,
              // ── Estado do mundo ────────────────────────────────────────────────
              cast: parseCast(currentCast),
              stages: enrichedStages,
              actors: currentActors.map((a: any) => ({
                ...a,
                systemData: (() => { try { return typeof a.systemData === 'string' ? JSON.parse(a.systemData) : a.systemData; } catch { return {}; } })(),
              })),
              tiles: currentTiles,
              items: currentItems.map((i: any) => ({
                ...i,
                data: (() => { try { return typeof i.data === 'string' ? JSON.parse(i.data) : i.data; } catch { return {}; } })(),
              })),
              journals: currentJournals,
              folders: currentFolders,
              playlists: currentPlaylists,
              lights: currentLights,
              drawings: currentDrawings,
              levels: currentLevels,
              rollTables: currentRollTables,
              combat: activeCombat ? { ...activeCombat, combatants: JSON.parse(activeCombat.combatants) } : null,
              chatHistory: recentChat.reverse(),
              onlineUsers: getOnlineUsersForWorld(worldId),
            });
          logger.debug('Sent initial state sync payload to WS client');
        } catch (err: any) {
          logger.error('Failed to send initial WS payload', { error: err.message });
        }

        // Notify other clients in the same world about new user
        broadcastToWorld('users.online', worldId, getOnlineUsersForWorld(worldId));
      }

      // ── Token movement ──────────────────────────────────────────────────────
      if (type === 'moveMember' || type === 'token.move') {
        if (isRateLimited(socketId)) {
          logger.warn('WS token.move rate limited', { socketId });
          return;
        }
        const { id, x, y } = data;
        const existingCast = await db('cast').where({ id, worldId: auth.worldId }).first();
        if (!existingCast) {
          logger.warn('WS token.move rejected: cast not in caller\'s world', { id, worldId: auth.worldId });
          return;
        }
        // Mesma regra do PUT /api/cast/:id (document.ts) — GM sempre pode, jogador
        // só move o que possui. Sem isso qualquer jogador arrastava token alheio.
        if (!auth.admin && (auth.userRole ?? 1) < 4 && !canEdit(existingCast.ownership, auth.userId ?? null)) {
          logger.warn('WS token.move rejected: no ownership', { id, userId: auth.userId });
          return;
        }
        // Timestamp de CHEGADA da mensagem, não de término da query — em bancos
        // remotos (Postgres) dois `token.move` seguidos podem ter suas queries
        // resolvidas fora de ordem; isso preserva a ordem real de envio pro
        // client descartar ecos desatualizados (rubber-banding).
        const movedAt = Date.now();
        const updated = await db('cast').where({ id, worldId: auth.worldId }).update({ x, y });
        if (updated === 0) {
          logger.warn('WS token.move rejected: cast not in caller\'s world', { id, worldId: auth.worldId });
          return;
        }
        const fullRow = await db('cast').where({ id }).first();
        Signal.broadcast('cast.updated', { action: 'updated', data: { ...fullRow, _socketId: socketId, movedAt } });
        Signal.broadcast('token.moved', { id, x, y, worldId: auth.worldId, _socketId: socketId, movedAt });
      }

      // ── Canvas ping/pong (latency measurement) ──────────────────────────────
      if (type === 'ping') {
        socket.emit('pong', { timestamp: Date.now(), ...data });
        // Sem worldId no token isso caía no bucket fixo 'world-1', misturando
        // eventos de mundos diferentes que batessem nesse mesmo fallback —
        // mesmo fix de user.identify: rejeita em vez de adivinhar o mundo.
        if (!auth.worldId) {
          logger.warn('WS ping: token has no worldId (admin token?)');
          return;
        }
        broadcastToWorld('ping', auth.worldId, data, socketId);
      }

      // ── Canvas ping (Ctrl+click, marcador visual compartilhado) ─────────────
      if (type === 'canvas.ping') {
        if (!auth.worldId) {
          logger.warn('WS canvas.ping: token has no worldId (admin token?)');
          return;
        }
        const userColor = auth.userColor || '#ffcc00';
        broadcastToWorld('canvas.ping', auth.worldId, { ...data, userColor }, socketId);
      }


      // ── Chat message ─────────────────────────────────────────────────────────
      if (type === 'chat.message') {
        if (isRateLimited(socketId)) {
          logger.warn('WS chat.message rate limited', { socketId });
          return;
        }
        // Sem worldId no token isso caía no bucket fixo 'world-1', misturando
        // chat de mundos diferentes que batessem nesse mesmo fallback — mesmo
        // fix de user.identify: rejeita em vez de adivinhar o mundo.
        if (!auth.worldId) {
          logger.warn('WS chat.message: token has no worldId (admin token?)');
          return;
        }
        const worldId = auth.worldId;
        const userId = auth.userId || 'anon';
        const userName = auth.userName || 'Anonymous';
        const userColor = auth.userColor || '#888';
        const { content, speaker, flags } = data;
        const speakerStr = speaker && typeof speaker === 'object' ? JSON.stringify(speaker) : '{}';
        const flagsStr = flags && typeof flags === 'object' ? JSON.stringify(flags) : '{}';
        const msgId = `msg-${randomUUID()}`;
        await db('chat_messages').insert({
          id: msgId, worldId, userId, userName, userColor, type: 'chat', content, speaker: speakerStr, flags: flagsStr,
        });
        broadcastToWorld('chat.message', worldId, { id: msgId, userId, userName, userColor, type: 'chat', content, speaker: speaker || {}, flags: flags || {}, createdAt: new Date().toISOString(), worldId });
      }

      // ── Dice roll ────────────────────────────────────────────────────────────
      if (type === 'chat.roll') {
        if (isRateLimited(socketId)) {
          logger.warn('WS chat.roll rate limited', { socketId });
          return;
        }
        // Mesmo fix de chat.message acima — rejeita em vez de cair em 'world-1'.
        if (!auth.worldId) {
          logger.warn('WS chat.roll: token has no worldId (admin token?)');
          return;
        }
        const worldId = auth.worldId;
        const userId = auth.userId || 'anon';
        const userName = auth.userName || 'Anonymous';
        const userColor = auth.userColor || '#888';
        const { formula, mode, actorId, meta } = data;
        let actorData: Record<string, number> = {};
        // `speaker` é o que o card do chat mostra como avatar/nome — sem isso a
        // rolagem sempre aparecia como o USUÁRIO conectado (ex: "Gamemaster"),
        // nunca o personagem, mesmo com "falar como" setado pro personagem no
        // chat (o actorId chegava certo, só nunca virava speaker de verdade).
        let speaker: { actorId: string; actorName: string; actorAvatar?: string } | undefined;
        if (actorId) {
          try {
            const actorRow = await db('actors').where({ id: actorId }).first();
            if (actorRow) {
              speaker = { actorId, actorName: actorRow.name, actorAvatar: actorRow.avatarUrl || undefined };
              if (actorRow.systemData) {
                const sd = typeof actorRow.systemData === 'string'
                  ? JSON.parse(actorRow.systemData)
                  : actorRow.systemData;
                actorData = flattenNumeric(sd);
              }
            }
          } catch {
            logger.warn(`[Roll] actorId ${actorId} não encontrado — roll segue sem data do ator`);
          }
        }
        const rollResult = roll(formula, actorData, { mode: mode || 'public' });
        const enrichedRoll = meta ? { ...rollResult, meta } : rollResult;
        const msgId = `msg-${randomUUID()}`;
        await db('chat_messages').insert({
          id: msgId, worldId, userId, userName, userColor,
          type: 'roll',
          content: `rolled ${formula}`,
          rollData: JSON.stringify(enrichedRoll),
          speaker: speaker ? JSON.stringify(speaker) : '{}',
        });
        broadcastToWorld('chat.roll', worldId, { id: msgId, userId, userName, userColor, formula, roll: enrichedRoll, createdAt: new Date().toISOString(), worldId, actorId, speaker: speaker || {} });
      }

      // ── Stage activate ────────────────────────────────────────────────────────
      if (type === 'stage.activate') {
        if ((auth.userRole ?? 1) < 4) return;
        const { stageId } = data;
        const worldId = auth.worldId;
        if (worldId) {
          await db('stages').where({ worldId }).update({ isActive: false });
          Signal.broadcast('stages.updated', { worldId, isActive: false });
        } else {
          await db('stages').update({ isActive: false });
          Signal.broadcast('stages.updated', { isActive: false });
        }
        await db('stages').where({ id: stageId }).update({ isActive: true });
        // Join stage room for targeted stage-level broadcasts
        joinStage(socket as any, stageId);
        const stage = await db('stages').where({ id: stageId }).first();
        if (stage) {
          // Esse handler de WS duplica a rota REST POST /stages/:id/activate
          // (server/applications/api/stages.ts) — é o que o client realmente usa
          // via `wsClient.send('stage.activate', ...)`, a rota REST fica pra quem
          // ainda chamar por fetch direto. As duas precisam do mesmo fix:
          //  1. Resolver o Andar Inicial (`stage.flags.initialLevel`) em vez de
          //     sempre cair no andar de menor elevação — `flags` aqui vem cru do
          //     Knex (coluna TEXT), precisa JSON.parse.
          //  2. Mandar a lista `levels` da cena nova no payload — sem isso o
          //     client (`CanvasManager.applyStage`) mantém os andares da cena
          //     ANTERIOR em cache e a lógica de "preservar andar ativo" reaplica
          //     o backgroundUrl de lá, travando a imagem errada na tela.
          const levels = await db('levels').where({ stageId: stage.id }).orderBy('bottomElevation', 'asc');
          let stageFlags: Record<string, any> = {};
          try { stageFlags = stage.flags ? JSON.parse(stage.flags) : {}; } catch { /* flags corrompido, ignora */ }
          const initialLevelId = stageFlags.initialLevel;
          const targetLevel = data.levelId
            ? levels.find((l: any) => l.id === data.levelId)
            : (initialLevelId && levels.find((l: any) => l.id === initialLevelId)) || levels[0];
          Signal.broadcast('stage.activated', {
            stageId: stage.id,
            id: stage.id,
            levels,
            levelId: targetLevel?.id,
            bottomElevation: targetLevel?.bottomElevation ?? 0,
            topElevation: targetLevel?.topElevation ?? 20,
            name: stage.name || '',
            bgUrl: targetLevel?.backgroundUrl || '',
            backgroundColor: targetLevel?.backgroundColor || '#0d0d0f',
            gridSize: stage.gridSize || 64,
            gridColor: stage.gridColor || '#ffffff',
            gridType: stage.gridType || 'square',
            width: stage.width || 3000,
            height: stage.height || 3000,
            ambientPlaylistId: stage.ambientPlaylistId || '',
            darknessLevel: stage.darknessLevel ?? 0,
            weatherEffect: stage.weatherEffect || 'none',
            transitionType: stage.transitionType || 'none',
            transitionDuration: stage.transitionDuration ?? 1500,
          });
        }
      }

      // ── Context update (room re-scoping) ────────────────────────────────────
      // Client notifies world + active stage so the socket can leave old stage
      // rooms and join the correct ones. Without this, non-GM clients stay in
      // the world room only and miss stage-scoped broadcasts after switching maps.
      else if (type === 'context.update') {
        const worldId = auth.worldId || data.worldId;
        if (worldId) {
          joinWorld(socket as any, worldId);
          leaveAllStageRooms(socket as any);
        }
        const stageId = data.stageId;
        if (worldId && stageId) {
          joinStage(socket as any, stageId);
        }
        logger.debug('WS context updated', { worldId, stageId, socketId });

        const presenceEntry = connectedUsers.get(socketId);
        if (presenceEntry && worldId) {
          presenceEntry.currentStageId = stageId || null;
          broadcastToWorld('users.online', worldId, getOnlineUsersForWorld(worldId));
        }
      }

      // ── Cursor de outros jogadores no canvas ─────────────────────────────────
      // Alta frequência (client já throttla antes de mandar) — não persiste em
      // DB, só repassa pra stage room, excluindo quem mandou (ninguém precisa
      // ver o próprio cursor voltando pela rede).
      else if (type === 'user.cursor') {
        const entry = connectedUsers.get(socketId);
        const stageId = data.stageId;
        if (entry && stageId && typeof data.x === 'number' && typeof data.y === 'number') {
          broadcastToStage('user.cursor', stageId, {
            userId: entry.userId,
            userName: entry.userName,
            userColor: entry.userColor,
            x: data.x,
            y: data.y,
          }, socketId);
        }
      }

      // ── Combat Animation ───────────────────────────────────────────────────────
      else if (type === 'combat.animation') {
        const worldId = auth.worldId;
        if (worldId) {
          broadcastToWorld(type, worldId, data, socketId);
        }
      }

      // ── Canvas Floating Text ───────────────────────────────────────────────────
      else if (type === 'canvas.floatingText') {
        const worldId = auth.worldId;
        if (worldId) {
          broadcastToWorld(type, worldId, data, socketId);
        }
      }

      // ── Tile Effect Broadcast ──────────────────────────────────────────────────
      else if (type === 'tile.effect') {
        if (isRateLimited(socketId)) {
          logger.warn('WS tile.effect rate limited', { socketId });
          return;
        }
        const worldId = auth.worldId;
        if (!worldId) return;
        const { tileId, actionIndex, tokenId } = data;
        if (!tileId || actionIndex === undefined) return;

        const tile = await db('tiles').where({ id: tileId, worldId }).first();
        if (!tile) return;

        const actions = typeof tile.actions === 'string' ? JSON.parse(tile.actions) : (tile.actions ?? []);
        const action = actions[actionIndex];
        if (!action) return;

        const recipient = action.config?.recipient || 'trigger';

        // Valida permissão de journal: se a ação é show-dialog com journalId,
        // só entrega a quem tem ownership de leitura naquele journal
        const actionType = action.type;
        const journalId = action.config?.journalId;
        let canReadJournal: ((user: ConnectedUser) => boolean) | null = null;
        if (actionType === 'show-dialog' && journalId) {
          const journal = await db('journals').where({ id: journalId, worldId }).first();
          if (journal) {
            const ownership = typeof journal.ownership === 'string'
              ? JSON.parse(journal.ownership)
              : (journal.ownership ?? {});
            canReadJournal = (user: ConnectedUser) => {
              // GM enxerga tudo: sem isso, journal restrito (que é justamente o caso em
              // que se restringe) filtrava o proprio GM junto com os jogadores, porque
              // `ownership.default` costuma ser 0 e GM raramente tem entrada explicita.
              // O destinatario `gm` deixava de entregar exatamente quando importava.
              if ((user.userRole ?? 1) >= 4) return true;
              const entry = ownership[user.userId] ?? ownership.default ?? 0;
              return entry >= 2; // 2+ = leitura (observer)
            };
          } else {
            canReadJournal = () => false;
          }
        }

        // Resolve target sessions and deliver via individual socket emit
        for (const [cid, user] of connectedUsers) {
          if (user.worldId !== worldId) continue;
          const targetSocketId = user.socketId;
          if (!targetSocketId || targetSocketId === socketId) continue;

          let shouldDeliver = false;
          if (recipient === 'all') {
            shouldDeliver = true;
          } else if (recipient === 'gm' || recipient === 'trigger+gm') {
            shouldDeliver = (user.userRole ?? 1) >= 4;
          }

          if (!shouldDeliver) continue;
          if (canReadJournal && !canReadJournal(user)) continue;

          const targetSocket = io.sockets.sockets.get(targetSocketId);
          if (targetSocket && targetSocket.connected) {
            targetSocket.emit('tile.triggered', { action, tokenId });
          }
        }
      }

      // ── Custom Socket Relay (Addons/Systems) ─────────────────────────────────
      else if (type.startsWith('system.') || type.startsWith('module.') || type.startsWith('socket.')) {
        const worldId = auth.worldId;
        if (worldId) {
          // Relays the custom event to all OTHER clients in the same world
          broadcastToWorld(type, worldId, data, socketId);
        }
      }

    } catch (err: any) {
      logger.error('Error handling WebSocket message', { error: err.message });
    }
  });

  socket.on('disconnect', () => {
    const user = connectedUsers.get(socketId);
    connectedUsers.delete(socketId);
    leaveAllRooms(socket as any);
    if (user?.worldId) {
      broadcastToWorld('users.online', user.worldId, getOnlineUsersForWorld(user.worldId));
    }
    logger.info('WebSocket client disconnected', { socketId, totalClients: io.engine.clientsCount });
  });

  socket.on('error', (err: Error) => {
    logger.error('WebSocket client error', { error: err.message, socketId });
  });
});

// Express global error handling middleware
app.use((err: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error('Express request encountered unhandled error', {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
  });
  res.status(500).json({ error: 'Internal Server Error' });
});

// Enforce mutually exclusive states: Setup Mode vs World Active
app.get('/setup', async (_req, res, next) => {
  try {
    const activeWorld = await db('worlds').where({ isActive: true }).first();
    if (activeWorld) {
      return res.redirect('/join');
    }
  } catch (err) { }
  next();
});

app.get('/join', async (_req, res, next) => {
  try {
    const activeWorld = await db('worlds').where({ isActive: true }).first();
    if (!activeWorld) {
      return res.redirect('/setup');
    }
  } catch (err) { }
  next();
});

app.get('/', async (_req, res, next) => {
  try {
    const activeWorld = await db('worlds').where({ isActive: true }).first();
    if (activeWorld) {
      return res.redirect('/join');
    } else {
      return res.redirect('/setup');
    }
  } catch (err) { }
  next();
});



const PORT = config.port || 3000;
initializeDatabase().then(async () => {
  // Sync any world.json on disk with the central database (leve, só metadado)
  await syncWorldsOnDisk();

  // Dropa tabelas legadas do central só se já estiverem vazias (barato, só COUNT
  // — nunca copia/apaga dado de mundo real, isso agora acontece por-mundo dentro
  // de getWorldDb/setActiveWorldDb, disparado só quando aquele mundo é aberto).
  await cleanupEmptyCentralTables();

  // Load marketplace addons/rulesets (leve, só lê manifests do disco)
  const addons = await loadAllAddons();
  logger.info(`[AddonLoader] Loaded ${addons.length} addon(s)/ruleset(s)`);

  // Setup Hub fica disponível AQUI — antes de qualquer carregamento pesado de
  // mundo específico (schema/migração por-mundo roda em background depois,
  // via Signal 'operation.progress').
  server.listen(PORT, () => {
    logger.info('RPG Core Server started', { port: PORT, env: process.env.NODE_ENV || 'development' });
    // Lets the Electron main process (which imports this module directly)
    // know when it's safe to open the BrowserWindow.
    process.emit('loom:ready' as any, PORT as any);

    // Inicia a verificação silenciosa de licença em segundo plano
    LicenseManager.startBackgroundCheck(io);
  });

  // Auto-ativação do mundo default roda DEPOIS do listen — não bloqueia o Setup
  // Hub. setActiveWorldDb() já dispara 'operation.progress' internamente.
  try {
    if (config.defaultWorldId) {
      const worldExists = await db('worlds').where({ id: config.defaultWorldId }).first();
      if (worldExists) {
        await db('worlds').update({ isActive: false });
        await db('worlds').where({ id: config.defaultWorldId }).update({ isActive: true });
        Signal.broadcast('worlds.updated', { worldId: config.defaultWorldId, isActive: true });
        await setActiveWorldDb(config.defaultWorldId);
        logger.info(`Auto-activated default world: ${config.defaultWorldId}`);
      } else {
        logger.warn(`Default world ${config.defaultWorldId} not found in database. Booting to Setup Mode.`);
        await db('worlds').update({ isActive: false });
        Signal.broadcast('worlds.updated', { isActive: false });
      }
    } else {
      logger.info('No default world configured. Deactivating all worlds — booting to Setup Mode.');
      await db('worlds').update({ isActive: false });
      Signal.broadcast('worlds.updated', { isActive: false });
      clearActiveWorldDb();
    }
  } catch (err: any) {
    logger.error('Failed to handle default world auto-activation on startup', { error: err.message });
  }
});

