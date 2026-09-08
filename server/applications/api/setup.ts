import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import fs from 'fs/promises';
import { getConfigPath } from '../database/db.js';
import { WorldsDocument } from '../schemas/worlds.schema.js';
import logger from '../utils/logger.js';
import { signToken, verifyToken, extractToken, ADMIN_COOKIE, WORLD_COOKIE, sessionCookieOptions, wasAdminSessionReplaced } from '../middleware/auth.js';

export const setupRouter = Router();

const SALT_ROUNDS = 10;

// Senha de admin fica em loom.config.json (texto), não no banco,
// pra dar um jeito de recuperação simples: apagar o campo no arquivo reseta o setup,
// sem precisar mexer no SQLite.
async function readConfigFile(): Promise<any> {
  try {
    const raw = await fs.readFile(getConfigPath(), 'utf8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function writeConfigFile(patch: Record<string, any>): Promise<void> {
  const current = await readConfigFile();
  const next = { ...current, ...patch };
  await fs.writeFile(getConfigPath(), `${JSON.stringify(next, null, 2)}\n`, 'utf8');
}

export async function requireAdminSession(req: any, res: any, next: any) {
  const token = extractToken(req, ADMIN_COOKIE);
  if (!token) return res.status(401).json({ error: 'Admin session required' });

  const payload = await verifyToken(token);
  if (!payload) return res.status(401).json({ error: 'Invalid or expired token' });
  if (!payload.admin) return res.status(403).json({ error: 'Admin access required' });

  req.auth = payload;
  next();
}

/** GET /api/setup/status — check if setup has been completed */
setupRouter.get('/status', async (_req, res) => {
  res.set('Cache-Control', 'no-store');
  try {
    const fileConfig = await readConfigFile();
    const isSetup = !!fileConfig.adminPassword;
    const worlds = await WorldsDocument.find();
    const activeWorld = await WorldsDocument.findOne({ isActive: true });

    res.json({
      isSetup,
      hasWorlds: worlds.length > 0,
      activeWorldId: activeWorld ? activeWorld.id : null,
      defaultWorldId: fileConfig.defaultWorldId || null,
      // Client precisa saber pra onde abrir o popup de OAuth (client/lib/oauth-popup.ts)
      // — nunca fica hardcoded no bundle, senao dev/staging fica preso em producao.
      loomSiteUrl: process.env.LOOM_SITE_URL || 'https://loomsite.vercel.app',
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts, please try again later.' },
});

/** POST /api/setup/init — first-time setup, creates admin password */
setupRouter.post('/init', loginLimiter, async (req, res) => {
  try {
    const fileConfig = await readConfigFile();
    if (fileConfig.adminPassword) {
      return res.status(400).json({ error: 'Setup already completed' });
    }
    const { password } = req.body;
    // 4 caracteres protegiam um painel de LAN. Esta senha destranca o servidor
    // inteiro — criar e apagar mundos, ligar o tunel publico, trocar config — e
    // agora pode estar exposta na internet.
    if (!password || password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }
    const hash = await bcrypt.hash(password, SALT_ROUNDS);
    await writeConfigFile({ adminPassword: hash });
    logger.info('Admin password set up successfully');
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/** POST /api/setup/login — authenticate admin, return JWT */
setupRouter.post('/login', loginLimiter, async (req, res) => {
  try {
    const fileConfig = await readConfigFile();
    if (!fileConfig.adminPassword) {
      return res.status(400).json({ error: 'Setup not completed. Please run setup first.' });
    }
    const { password } = req.body;
    if (!password) {
      return res.status(400).json({ error: 'Password is required' });
    }
    const valid = await bcrypt.compare(password, fileConfig.adminPassword);
    if (!valid) {
      return res.status(401).json({ error: 'Incorrect password' });
    }

    const token = await signToken({ admin: true }, '24h');

    res.cookie(ADMIN_COOKIE, token, sessionCookieOptions(req));
    res.clearCookie(WORLD_COOKIE);

    // Sessão vive só no cookie HttpOnly — client não usa `token` da resposta
    // (confirmado: admin-login.ts ignora o body do POST), então não duplicar
    // em JSON/localStorage por nada.
    res.json({ admin: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/** POST /api/setup/logout — clear admin session */
setupRouter.post('/logout', (_req, res) => {
  res.clearCookie(ADMIN_COOKIE);
  res.clearCookie(WORLD_COOKIE);
  res.json({ success: true });
});

/** GET /api/setup/verify — check if a JWT is still valid */
setupRouter.get('/verify', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  const token = extractToken(req);
  if (!token) return res.json({ valid: false });
  const payload = await verifyToken(token);
  if (payload) {
    if (payload.admin) {
      // No Setup Hub, sessões antigas de mundo em cookie devem ser limpas
      res.clearCookie(WORLD_COOKIE);
    }
    return res.json({ valid: true, admin: payload.admin || false });
  }
  const replaced = await wasAdminSessionReplaced(token);
  res.json({ valid: false, admin: false, reason: replaced ? 'admin_session_replaced' : undefined });
});

/** GET /api/setup/config — get server options from loom.config.json */
setupRouter.get('/config', requireAdminSession, async (_req, res) => {
  try {
    const fileConfig = await readConfigFile();

    res.json({
      dataPath: fileConfig.dataPath || fileConfig.dataRoot || '',
      port: fileConfig.port || 3000,
      language: fileConfig.language || 'pt-BR',
      dbClient: fileConfig.dbClient || 'sqlite3',
      dbHost: fileConfig.dbHost || '',
      dbPort: fileConfig.dbPort || undefined,
      dbUser: fileConfig.dbUser || '',
      dbPassword: fileConfig.dbPassword || '',
      dbName: fileConfig.dbName || '',
      dbSsl: !!fileConfig.dbSsl,
      compressStatic: fileConfig.compressStatic !== false,
      fullscreen: !!fileConfig.fullscreen,
      upnp: fileConfig.upnp !== false,
      defaultWorldId: fileConfig.defaultWorldId || null
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/** POST /api/setup/config — save options directly to loom.config.json */
setupRouter.post('/config', requireAdminSession, async (req, res) => {
  try {
    const { dataPath, port, language, dbClient, dbHost, dbPort, dbUser, dbPassword, dbName, dbSsl, compressStatic, fullscreen, upnp, defaultWorldId } = req.body;

    const fileConfig = await readConfigFile();

    if (dataPath !== undefined) fileConfig.dataPath = dataPath.trim();
    if (port !== undefined) fileConfig.port = Number(port);
    if (language !== undefined) fileConfig.language = language.trim();
    if (dbClient !== undefined) fileConfig.dbClient = dbClient.trim();
    if (dbHost !== undefined) fileConfig.dbHost = dbHost.trim();
    if (dbPort !== undefined) fileConfig.dbPort = dbPort ? Number(dbPort) : undefined;
    if (dbUser !== undefined) fileConfig.dbUser = dbUser.trim();
    if (dbPassword !== undefined) fileConfig.dbPassword = dbPassword;
    if (dbName !== undefined) fileConfig.dbName = dbName.trim();
    if (dbSsl !== undefined) fileConfig.dbSsl = !!dbSsl;
    if (compressStatic !== undefined) fileConfig.compressStatic = !!compressStatic;
    if (fullscreen !== undefined) fileConfig.fullscreen = !!fullscreen;
    if (upnp !== undefined) fileConfig.upnp = !!upnp;
    if (defaultWorldId !== undefined) {
      fileConfig.defaultWorldId = defaultWorldId ? defaultWorldId.trim() : null;
    }

    await fs.writeFile(getConfigPath(), `${JSON.stringify(fileConfig, null, 2)}\n`, 'utf8');

    // Nunca logar o objeto de config cru: ele carrega `dbPassword` e
    // `adminPassword` em texto plano, e o log persiste em disco (CWE-532).
    const loggedConfig: Record<string, any> = { ...fileConfig };
    if (loggedConfig.dbPassword) loggedConfig.dbPassword = '***';
    if (loggedConfig.adminPassword) loggedConfig.adminPassword = '***';
    logger.info('Setup config saved to loom.config.json', loggedConfig);
    res.json({ success: true, message: 'Configuration saved. Please restart the application for changes to take effect.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
