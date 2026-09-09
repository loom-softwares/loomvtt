/**
 * core/src/api/worlds.ts
 * REST routes for World and User management.
 * Mounted at /api/worlds in core/src/index.ts
 */

import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import os from 'os';
import bcrypt from 'bcryptjs';
import path from 'path';
import fs from 'fs';
import { db, getDataRoot } from '../database/db.js';
import { setActiveWorldDb, clearActiveWorldDb, saveWorldManifest, getWorldDb, closeWorldDb } from '../database/world-db.js';
import { WorldsDocument } from '../schemas/worlds.schema.js';
import { UsersDocument } from '../schemas/users.schema.js';
import logger from '../utils/logger.js';
import { requireAdminSession } from './setup.js';
import { Signal } from '../signals/index.js';
import { signToken, verifyToken, extractToken, WORLD_COOKIE, ADMIN_COOKIE, requireAuth, requireWorldMatch, sessionCookieOptions, worldCookieOptions, rotateWorldBootId } from '../middleware/auth.js';
import { requireGM, isGM } from '../middleware/permissions.js';
import { connectedUsers } from '../../index.js';
import { syncPackagesTable, getRulesetBackgroundUrl } from './marketplace.js';

export const worldsRouter = Router();

// Mesma politica do admin (setup.ts:84). Esta rota faz bcrypt.compare contra a
// senha do mundo E a do jogador — exposta pelo tunnel, era forca bruta sem
// freio. So funciona por origem porque `trust proxy` esta ligado (Tarefa 1).
const joinLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts, please try again later.' },
});

// ─── ROLE LABELS ─────────────────────────────────────────────────────────────
export const ROLES = ['None', 'Player', 'Trusted Player', 'Assistant GM', 'Gamemaster'];

// ─── WORLDS ───────────────────────────────────────────────────────────────────

/**
 * Remove campos sensiveis antes de devolver um registro de mundo ao cliente.
 *
 * Estas duas rotas sao consumidas pela tela de login SEM sessao (seletor de
 * mundo e de usuario), entao nao da pra simplesmente exigir auth aqui sem
 * quebrar o login. `adminPassword` (hash bcrypt) sempre sai — sem isso
 * qualquer anonimo conseguia crackar a senha do GM offline.
 *
 * `dataPath` (caminho de pasta no disco do host) e `permissions` tambem nao
 * tem por que ir pro seletor de mundo anonimo — so quem ja tem sessao de
 * admin do Setup Hub (que edita essas coisas de verdade em
 * `EditWorldWindow`) precisa deles. `isAdmin` decide se essa segunda camada
 * sai ou fica.
 */
function toClientWorld(world: any, isAdmin: boolean = false): any {
  if (!world) return world;
  const safe = { ...world };
  delete safe.adminPassword;
  if (!isAdmin) {
    delete safe.dataPath;
    delete safe.permissions;
  }
  return safe;
}

/** Sessao admin (cookie do Setup Hub) sem exigir — as rotas de listagem de
 * mundo tem que continuar respondendo pro seletor anonimo. So usa isso pra
 * decidir quanto de dado extra incluir na resposta. */
async function hasAdminSession(req: any): Promise<boolean> {
  const token = extractToken(req, ADMIN_COOKIE);
  if (!token) return false;
  const payload = await verifyToken(token);
  return !!payload?.admin;
}

/** Preenche `backgroundUrl` com a arte do ruleset (`ruleset.json`) quando o mundo
 * ainda não tem capa/fundo próprios — sem isso, todo mundo novo caía na tela de
 * login sem nenhum fundo até o GM escolher um manualmente. */
async function withSystemBackgroundFallback(world: any): Promise<any> {
  if (world.backgroundUrl || world.coverUrl || !world.system) return world;
  const fallback = await getRulesetBackgroundUrl(world.system);
  return fallback ? { ...world, backgroundUrl: fallback } : world;
}

/** GET /api/worlds — list all worlds */
worldsRouter.get('/', async (req, res) => {
  try {
    const isAdmin = await hasAdminSession(req);
    const worlds = await WorldsDocument.find({ orderBy: 'createdAt', orderDir: 'asc' });
    const clientWorlds = await Promise.all(
      worlds.map((w) => withSystemBackgroundFallback(toClientWorld(w, isAdmin))),
    );
    res.json(clientWorlds);
  } catch (err: any) {
    logger.error('GET /api/worlds failed', { error: err.message });
    res.status(500).json({ error: 'Failed to retrieve worlds' });
  }
});

/** GET /api/worlds/:id — get single world */
worldsRouter.get('/:id', async (req, res) => {
  try {
    const isAdmin = await hasAdminSession(req);
    const world = await WorldsDocument.findById(req.params.id);
    if (!world) return res.status(404).json({ error: 'World not found' });
    res.json(await withSystemBackgroundFallback(toClientWorld(world, isAdmin)));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/** GET /api/worlds/:id/migration-status — check if world needs migration */
worldsRouter.get('/:id/migration-status', requireAdminSession, async (req, res) => {
  try {
    const { getWorldDb } = await import('../database/world-db.js');
    const status = await getWorldDb(req.params.id, { checkOnly: true });
    res.json(status);
  } catch (err: any) {
    logger.error('Failed to check migration status', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

/** POST /api/worlds/:id/backup — create universal JSON backup of the world */
worldsRouter.post('/:id/backup', requireAdminSession, async (req, res) => {
  try {
    const { backupWorldDb } = await import('../database/world-db.js');
    await backupWorldDb(req.params.id);
    res.json({ success: true });
  } catch (err: any) {
    logger.error('Failed to backup world', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

/** POST /api/worlds — create new world */
// Deriva um id legível do nome do mundo ('Wod5e Épico' -> 'wod5e-epico'), com
// sufixo numérico em colisão ('wod5e-epico-1', '-2', ...) — esse id também
// vira o nome da pasta em Data/worlds/ (ver saveWorldManifest/getWorldDb),
// então sem isso todo mundo criado ganhava uma pasta UUID ilegível no disco.
function slugifyWorldName(name: string): string {
  const base = name
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base || 'world';
}

async function uniqueWorldId(name: string): Promise<string> {
  const base = slugifyWorldName(name);
  let candidate = base;
  let n = 1;
  while (await db('worlds').where({ id: candidate }).first()) {
    candidate = `${base}-${n}`;
    n++;
  }
  return candidate;
}

worldsRouter.post('/', requireAdminSession, async (req, res) => {
  try {
    const { name, system = 'generic', description = '', coverUrl = '', language = 'en', adminPassword = '' } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });
    const hashedPassword = adminPassword ? await bcrypt.hash(adminPassword, 10) : '';
    const id = await uniqueWorldId(name);

    const result = await WorldsDocument.create({ id, name, system, description, coverUrl, language, adminPassword: hashedPassword, isActive: false });
    if (result.error) return res.status(400).json({ error: result.error });
    const world = result.data;

    // Create world's asset directory on disk
    try {
      const worldAssetsDir = path.join(getDataRoot(), 'worlds', world.id, 'assets');
      fs.mkdirSync(worldAssetsDir, { recursive: true });
    } catch (mkdirErr: any) {
      logger.warn('Could not create world assets directory, uploads will fall back to global', { worldId: world.id, error: mkdirErr.message });
    }

    // Initialize world database schema and save manifest
    await getWorldDb(world.id);
    await saveWorldManifest(world);

    // Auto-create a GM user for the world
    await UsersDocument.create({ worldId: world.id, name: 'Gamemaster', role: 4, color: '#e74c3c' });

    // Limpa qualquer cookie de mundo anterior para que o novo mundo inicie limpo
    res.clearCookie(WORLD_COOKIE);

    logger.info('World created', { id: world.id, name });
    res.status(201).json(world);
  } catch (err: any) {
    logger.error('POST /api/worlds failed', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

/** PUT /api/worlds/:id — update world */
/** PUT /api/worlds/:id/permissions — GM (in-game session) tunes world.permissions thresholds */
worldsRouter.put('/:id/permissions', requireAuth, requireGM, async (req, res) => {
  try {
    const { permissions } = req.body;
    if (!permissions || typeof permissions !== 'object') {
      return res.status(400).json({ error: 'permissions object is required.' });
    }
    const result = await WorldsDocument.update(req.params.id, { permissions });
    if (result.error) return res.status(404).json({ error: result.error });
    res.json({ permissions: result.data.permissions });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/** GET /api/worlds/:id/time — get current world time */
worldsRouter.get('/:id/time', async (req, res) => {
  try {
    const world = await WorldsDocument.findById(req.params.id);
    if (!world) return res.status(404).json({ error: 'World not found' });
    res.json({ worldTime: world.worldTime || 0 });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/** PUT /api/worlds/:id/time — update world time */
worldsRouter.put('/:id/time', requireAuth, requireGM, async (req, res) => {
  try {
    const world = await WorldsDocument.findById(req.params.id);
    if (!world) return res.status(404).json({ error: 'World not found' });

    let newTime = world.worldTime || 0;
    if (typeof req.body.advance === 'number') {
      newTime += req.body.advance;
    } else if (typeof req.body.worldTime === 'number') {
      newTime = req.body.worldTime;
    } else {
      return res.status(400).json({ error: 'Must provide advance or worldTime number' });
    }

    const result = await WorldsDocument.update(req.params.id, { worldTime: newTime });
    if (result.error) return res.status(400).json({ error: result.error });

    Signal.broadcast('time.updated', { worldTime: newTime, worldId: req.params.id });
    res.json({ worldTime: newTime });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/** PUT /api/worlds/:id/basic-info — GM (in-game session) edits superficial world info.
 *  Nunca aceita system/dataPath/adminPassword — esses continuam exclusivos da rota admin. */
worldsRouter.put('/:id/basic-info', requireAuth, requireGM, async (req, res) => {
  try {
    const { name, backgroundUrl, theme, nextSession, description } = req.body;
    const update: Record<string, any> = {};
    if (name !== undefined) update.name = name;
    if (backgroundUrl !== undefined) update.backgroundUrl = backgroundUrl;
    if (theme !== undefined) update.theme = theme;
    if (nextSession !== undefined) update.nextSession = nextSession;
    if (description !== undefined) update.description = description;

    const result = await WorldsDocument.update(req.params.id, update);
    if (result.error) return res.status(404).json({ error: result.error });
    res.json(toClientWorld(result.data));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/worlds/:worldId/invite-links — LAN address for players to join this world
worldsRouter.get('/:worldId/invite-links', async (req, res) => {
  try {
    const isAdmin = await hasAdminSession(req);
    if (!isAdmin) {
      const token = extractToken(req, WORLD_COOKIE);
      if (!token) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      const payload = (await verifyToken(token)) as any;
      if (!payload || !isGM({ auth: payload })) {
        return res.status(403).json({ error: 'GM privileges required' });
      }
    }

    const world = await WorldsDocument.findById(req.params.worldId);
    if (!world) return res.status(404).json({ error: 'World not found' });

    let lanIp = 'localhost';
    for (const addrs of Object.values(os.networkInterfaces())) {
      const found = addrs?.find((a) => a.family === 'IPv4' && !a.internal);
      if (found) { lanIp = found.address; break; }
    }
    const port = req.socket.localPort || 3000;

    res.json({ localLink: `http://${lanIp}:${port}` });
  } catch (err: any) {
    logger.error('GET /worlds/:worldId/invite-links failed', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

worldsRouter.put('/:id', requireAdminSession, async (req, res) => {
  try {
    const {
      name, system, description, coverUrl, language, adminPassword,
      dataPath, backgroundUrl, theme, nextSession, safeMode, resetPasswords,
    } = req.body;
    const existingWorld = await WorldsDocument.findById(req.params.id);
    if (!existingWorld) return res.status(404).json({ error: 'World not found' });

    if (system && existingWorld.system && system !== existingWorld.system) {
      return res.status(400).json({ error: 'Cannot change the ruleset (system) of an existing world.' });
    }

    const updates: Record<string, any> = { name, system: existingWorld.system || system, description, coverUrl, language };
    if (dataPath !== undefined) updates.dataPath = dataPath;
    if (backgroundUrl !== undefined) updates.backgroundUrl = backgroundUrl;
    if (theme !== undefined) updates.theme = theme;
    if (nextSession !== undefined) updates.nextSession = nextSession;
    if (safeMode !== undefined) updates.safeMode = safeMode;
    if (adminPassword !== undefined) {
      updates.adminPassword = adminPassword ? await bcrypt.hash(adminPassword, 10) : '';
    }
    const result = await WorldsDocument.update(req.params.id, updates);
    if (result.error) return res.status(404).json({ error: result.error });

    await saveWorldManifest(result.data);

    if (resetPasswords) {
      await db('users').where({ worldId: req.params.id }).update({ password: '' });
      Signal.broadcast('users.updated', { worldId: req.params.id });
      logger.info('World users passwords reset', { worldId: req.params.id });
    }

    // requireAdminSession ja garantiu que quem chamou essa rota tem sessao de
    // admin — response tem que devolver dataPath de volta (EditWorldWindow
    // le isso do retorno do save).
    res.json(toClientWorld(result.data, true));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/** DELETE /api/worlds/:id — delete world and all its data */
worldsRouter.delete('/:id', requireAdminSession, async (req, res) => {
  try {
    const { id } = req.params;

    // Close database connection
    await closeWorldDb(id);

    // Delete world directory on disk (contains world.sqlite and world.json).
    // `maxRetries`/`retryDelay` cobrem o caso comum no Windows de o arquivo
    // .sqlite ainda estar com lock por um instante logo após closeWorldDb —
    // sem isso o rm falhava calado (catch vazio) e a pasta sobrevivia, aí
    // syncWorldsOnDisk() recriava o mundo "deletado" no próximo boot.
    const worldDir = path.resolve(getDataRoot(), 'worlds', id);
    if (fs.existsSync(worldDir)) {
      try {
        await fs.promises.rm(worldDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
      } catch (rmErr: any) {
        logger.error(`Failed to delete world directory on disk: ${worldDir}`, { worldId: id, error: rmErr.message });
      }
    }

    // Clean up central database tables
    await db('world_packages').where({ worldId: id }).delete().catch(() => {});
    await db('users').where({ worldId: id }).delete().catch(() => {});
    await db('worlds').where({ id }).delete();
    Signal.broadcast('worlds.deleted', { worldId: id });
    Signal.broadcast('users.deleted', { worldId: id });

    // Limpa o cookie se pertencia a esse mundo deletado
    const worldToken = extractToken(req, WORLD_COOKIE);
    if (worldToken) {
      const payload = await verifyToken(worldToken);
      if (payload?.worldId === id) {
        res.clearCookie(WORLD_COOKIE);
      }
    }

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/** POST /api/worlds/:id/launch — set world as active */
worldsRouter.post('/:id/launch', requireAdminSession, async (req, res) => {
  try {
    const world = await WorldsDocument.findById<any>(req.params.id);
    if (!world) return res.status(404).json({ error: 'World not found' });

    await db('worlds').update({ isActive: false });
    await db('worlds').where({ id: req.params.id }).update({ isActive: true });
    Signal.broadcast('worlds.updated', { worldId: req.params.id, isActive: true });

    await setActiveWorldDb(req.params.id);
    await saveWorldManifest(world);

    res.json({ success: true, worldId: req.params.id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/** POST /api/worlds/:id/pause — GM pauses the world (blocks player interaction) */
worldsRouter.post('/:id/pause', requireAuth, requireGM, async (req, res) => {
  try {
    const result = await WorldsDocument.update(req.params.id, { isPaused: true });
    if (result.error) return res.status(404).json({ error: result.error });
    Signal.broadcast('world.paused', { worldId: req.params.id });
    res.json({ isPaused: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/** POST /api/worlds/:id/resume — GM resumes the world */
worldsRouter.post('/:id/resume', requireAuth, requireGM, async (req, res) => {
  try {
    const result = await WorldsDocument.update(req.params.id, { isPaused: false });
    if (result.error) return res.status(404).json({ error: result.error });
    Signal.broadcast('world.resumed', { worldId: req.params.id });
    res.json({ isPaused: false });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/** POST /api/worlds/:id/activate — activate world for player login (no GM session created) */
worldsRouter.post('/:id/activate', requireAdminSession, async (req, res) => {
  try {
    const world = await WorldsDocument.findById<any>(req.params.id);
    if (!world) return res.status(404).json({ error: 'World not found' });

    await db('worlds').update({ isActive: false });
    await db('worlds').where({ id: req.params.id }).update({ isActive: true });
    Signal.broadcast('worlds.updated', { worldId: req.params.id, isActive: true });

    await setActiveWorldDb(req.params.id);
    await saveWorldManifest(world);

    logger.info('World activated', { worldId: req.params.id, name: world.name });
    res.json({ success: true, worldId: req.params.id, name: world.name });
  } catch (err: any) {
    logger.error('POST /api/worlds/:id/activate failed', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

/** POST /api/worlds/:id/launch-gm — activate world and return GM session */
worldsRouter.post('/:id/launch-gm', requireAdminSession, async (req, res) => {
  try {
    logger.info('Launching GM session for world', { worldId: req.params.id });
    
    const world = await WorldsDocument.findById<any>(req.params.id);
    if (!world) {
      logger.warn('World not found for launch-gm', { worldId: req.params.id });
      return res.status(404).json({ error: 'World not found' });
    }
    if (!world.system || world.system === 'generic') {
      return res.status(400).json({ error: 'Este mundo não tem um sistema de RPG ativo. Configure um sistema antes de entrar.' });
    }

    logger.info('Deactivating all worlds and activating', { worldName: world.name, worldId: req.params.id });
    await db('worlds').update({ isActive: false });
    await db('worlds').where({ id: req.params.id }).update({ isActive: true });
    Signal.broadcast('worlds.updated', { worldId: req.params.id, isActive: true });

    await setActiveWorldDb(req.params.id);
    await saveWorldManifest(world);

    // Find existing GM user or create one
    let gm = await UsersDocument.findOne<any>({ worldId: req.params.id, role: 4 });
    if (!gm) {
      logger.info('Creating new GM user', { worldId: req.params.id });
      const result = await UsersDocument.create<any>({ worldId: req.params.id, name: 'Gamemaster', role: 4, color: '#e74c3c' });
      gm = result.data;
    }

    const { password: _, ...safe } = gm;
    logger.info('GM session created', { userName: safe.name, worldId: req.params.id });

    const token = await signToken({
      userId: safe.id,
      userName: safe.name,
      userRole: safe.role ?? 4,
      userColor: safe.color || '#e74c3c',
      worldId: req.params.id,
    }, '24h');

    res.cookie(WORLD_COOKIE, token, worldCookieOptions(req));

    res.json({
      token,
      session: {
        worldId: req.params.id,
        worldName: world.name,
        userId: safe.id,
        userName: safe.name,
        userColor: safe.color || '#e74c3c',
        userRole: safe.role ?? 4,
      }
    });
    console.log(`[LaunchGM] Successfully launched world: ${req.params.id}`);
  } catch (err: any) {
    logger.error('Error launching GM session', { worldId: req.params.id, error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// ─── DEACTIVATE WORLD ─────────────────────────────────────────────────────────
worldsRouter.post('/deactivate', requireAuth, requireGM, async (_req, res) => {
  try {
    await db('worlds').update({ isActive: false });
    clearActiveWorldDb();
    rotateWorldBootId();
    Signal.broadcast('world.deactivated');
    res.clearCookie(WORLD_COOKIE);
    logger.info('Active world deactivated');
    res.json({ success: true });
  } catch (err: any) {
    logger.error('POST /api/worlds/deactivate failed', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// ─── USERS (per world) ────────────────────────────────────────────────────────

/** GET /api/worlds/:worldId/users — list users of a world.
 * Consumida sem sessao pelo seletor de usuario do login. Pra quem nao tem
 * sessao nenhuma (nem mundo, nem admin), corta `role` — anonimo nao precisa
 * saber quem e GM pra escolher um nome na tela, e isso tira o passo de
 * reconhecimento que viabilizava mirar direto no usuario GM no /join. */
worldsRouter.get('/:worldId/users', async (req, res) => {
  try {
    const worldToken = extractToken(req, WORLD_COOKIE);
    const adminToken = extractToken(req, ADMIN_COOKIE);
    let isGMUser = false;
    if (adminToken) {
      const payload = await verifyToken(adminToken);
      if (payload?.admin) isGMUser = true;
    }
    if (!isGMUser && worldToken) {
      const payload = await verifyToken(worldToken);
      if (payload && ((payload.userRole ?? 0) >= 4 || payload.admin)) isGMUser = true;
    }
    const hasSession = isGMUser || !!(worldToken && await verifyToken(worldToken));
    let users = await UsersDocument.find<any>({ worldId: req.params.worldId });
    if (!isGMUser) {
      users = users.filter((u: any) => !u.pendingApproval);
    }
    res.json(users.map((u: any) => {
      const { password, ...rest } = u;
      if (!hasSession) delete rest.role;
      return rest;
    }));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/** GET /api/worlds/:worldId/online-users — userIds currently connected via WebSocket
 * (used to grey out already-active users, e.g. the GM, on the world-login screen). */
worldsRouter.get('/:worldId/online-users', async (req, res) => {
  const online = Array.from(connectedUsers.values())
    .filter((u: any) => u.worldId === req.params.worldId)
    .map((u: any) => u.userId);
  res.json(online);
});

/** POST /api/worlds/:worldId/users — create user */
worldsRouter.post('/:worldId/users', requireAuth, requireWorldMatch, requireGM, async (req, res) => {
  try {
    const { name, role = 1, password = '', color = '#4f46e5', avatarUrl = '' } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });

    const hashed = password ? await bcrypt.hash(password, 10) : '';
    const result = await UsersDocument.create<any>({ worldId: req.params.worldId, name, role, password: hashed, color, avatarUrl });
    if (result.error) return res.status(400).json({ error: result.error });
    const { password: _, ...safe } = result.data;
    res.status(201).json(safe);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/** PUT /api/worlds/:worldId/users/:id — update user */
worldsRouter.put('/:worldId/users/:id', requireAuth, requireWorldMatch, async (req: any, res) => {
  try {
    const isSelf = req.auth?.userId === req.params.id;
    const isGM = (req.auth?.userRole ?? 0) >= 4 || !!req.auth?.admin;
    if (!isSelf && !isGM) {
      return res.status(403).json({ error: 'Only a Gamemaster or the user themselves can update this profile' });
    }
    const { name, role, password, color, avatarUrl, pronouns, actorId } = req.body;
    const update: any = { name, color, avatarUrl, pronouns, actorId };
    if (role !== undefined) {
      if (!isGM) {
        return res.status(403).json({ error: 'Only a Gamemaster can change user roles' });
      }
      update.role = role;
    }
    if (password !== undefined && password !== '••••') {
      update.password = password ? await bcrypt.hash(password, 10) : '';
    }
    const result = await UsersDocument.update<any>(req.params.id, update);
    if (result.error) return res.status(404).json({ error: result.error });
    const { password: _, ...safe } = result.data;
    
    Signal.broadcast('user.updated', safe);
    
    res.json(safe);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/** DELETE /api/worlds/:worldId/users/:id — delete user */
worldsRouter.delete('/:worldId/users/:id', requireAuth, requireWorldMatch, requireGM, async (req, res) => {
  try {
    await UsersDocument.delete(req.params.id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/** POST /api/worlds/:worldId/users/:id/approve — approve a pending user link and assign role */
worldsRouter.post('/:worldId/users/:id/approve', requireAuth, requireWorldMatch, requireGM, async (req, res) => {
  try {
    const user = await UsersDocument.findOne<any>({ id: req.params.id, worldId: req.params.worldId });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const { role = 1 } = req.body;
    const numRole = Number(role) || 1;
    const safeRole = Math.min(Math.max(numRole, 1), 4);

    const updateRes = await UsersDocument.update<any>(req.params.id, {
      pendingApproval: false,
      role: safeRole,
    });
    if (updateRes.error) return res.status(400).json({ error: updateRes.error });

    const { password: _, ...safe } = updateRes.data;
    Signal.broadcast('user.updated', safe);
    res.json(safe);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/** POST /api/worlds/:worldId/users/:id/reject — reject a pending user (strictly pendingApproval === true) */
worldsRouter.post('/:worldId/users/:id/reject', requireAuth, requireWorldMatch, requireGM, async (req, res) => {
  try {
    const user = await UsersDocument.findOne<any>({ id: req.params.id, worldId: req.params.worldId });
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (!user.pendingApproval) {
      return res.status(400).json({ error: 'Apenas usuários com vínculo pendente podem ser rejeitados.' });
    }

    await UsersDocument.delete(req.params.id);
    Signal.broadcast('user.deleted', { id: req.params.id, worldId: req.params.worldId });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/** GET /api/worlds/:worldId/packages — full addon catalog + enabled state for this world */
worldsRouter.get('/:worldId/packages', async (req, res) => {
  try {
    const { worldId } = req.params;

    await syncPackagesTable();

    const allAddons = await db('packages').where({ type: 'addon' });
    const associations = await db('world_packages').where({ worldId });
    const enabledSet = new Set(associations.filter((a: any) => a.enabled).map((a: any) => a.packageId));

    const result = allAddons.map((pkg: any) => ({
      id: pkg.id,
      name: pkg.name,
      version: pkg.version,
      description: pkg.description,
      enabled: enabledSet.has(pkg.id),
    }));

    res.json(result);
  } catch (err: any) {
    logger.error('GET /api/worlds/:worldId/packages failed', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

/** POST /api/worlds/:worldId/packages — update modules enabled */
worldsRouter.post('/:worldId/packages', requireAdminSession, async (req, res) => {
  try {
    const { worldId } = req.params;
    const { enabledModules = [], config = {} } = req.body;

    await syncPackagesTable();

    // Validate world exists
    const world = await db('worlds').where({ id: worldId }).first();
    if (!world) return res.status(404).json({ error: 'World not found' });
    
    // Update world-level package configuration
    await db('worlds').where({ id: worldId }).update({ 
      packageConfig: JSON.stringify(config)
    });
    Signal.broadcast('worlds.updated', { worldId, packageConfig: config });
    
    // Get all existing package associations
    const existingAssociations = await db('world_packages')
      .where({ worldId })
      .select('packageId', 'enabled');
    
    // Update existing associations and create new ones
    for (const packageName of enabledModules) {
      const existing = existingAssociations.find(a => a.packageId === packageName);
      
      if (existing) {
        // Update existing association
        await db('world_packages')
          .where({ worldId, packageId: packageName })
          .update({ 
            enabled: true,
            updatedAt: new Date().toISOString()
          });
      } else {
        // Create new association (package should exist in packages table)
        const packageExists = await db('packages').where({ id: packageName }).first();
        if (packageExists) {
          await db('world_packages').insert({
            id: `wp-${worldId}-${packageName}`,
            worldId,
            packageId: packageName,
            enabled: true,
            loadOrder: 0,
            config: '{}',
            installedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
        }
      }
    }
    
    // Disable every known addon NOT in enabledModules — not just the ones
    // that already had a world_packages row (same fix as the /gm route
    // below: an addon never toggled before has no row at all, so only
    // updating existing rows silently did nothing the first time it's unchecked).
    const allAddonPackagesAdmin = await db('packages').where({ type: 'addon' }).select('id');
    for (const { id: packageId } of allAddonPackagesAdmin) {
      if (enabledModules.includes(packageId)) continue;
      const existing = existingAssociations.find(a => a.packageId === packageId);
      if (existing) {
        await db('world_packages')
          .where({ worldId, packageId })
          .update({ enabled: false, updatedAt: new Date().toISOString() });
      } else {
        await db('world_packages').insert({
          id: `wp-${worldId}-${packageId}`,
          worldId,
          packageId,
          enabled: false,
          loadOrder: 0,
          config: '{}',
          installedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
    }

    logger.info('World modules updated', { worldId, enabledModules });
    res.json({ 
      success: true, 
      enabledModules,
      worldId 
    });
  } catch (err: any) {
    logger.error('POST /api/worlds/:worldId/packages failed', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

/** POST /api/worlds/:worldId/packages/gm — GM (in-game session) updates enabled modules */
worldsRouter.post('/:worldId/packages/gm', requireAuth, requireGM, async (req, res) => {
  try {
    const { worldId } = req.params;
    const { enabledModules = [], config = {} } = req.body;

    await syncPackagesTable();

    const world = await db('worlds').where({ id: worldId }).first();
    if (!world) return res.status(404).json({ error: 'World not found' });

    await db('worlds').where({ id: worldId }).update({
      packageConfig: JSON.stringify(config)
    });
    Signal.broadcast('worlds.updated', { worldId, packageConfig: config });

    const existingAssociations = await db('world_packages')
      .where({ worldId })
      .select('packageId', 'enabled');

    for (const packageName of enabledModules) {
      const existing = existingAssociations.find(a => a.packageId === packageName);

      if (existing) {
        await db('world_packages')
          .where({ worldId, packageId: packageName })
          .update({ enabled: true, updatedAt: new Date().toISOString() });
      } else {
        const packageExists = await db('packages').where({ id: packageName }).first();
        if (packageExists) {
          await db('world_packages').insert({
            id: `wp-${worldId}-${packageName}`,
            worldId,
            packageId: packageName,
            enabled: true,
            loadOrder: 0,
            config: '{}',
            installedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
        }
      }
    }

    // Disable every known addon NOT in enabledModules — not just the ones
    // that already had a world_packages row. An addon that was always
    // "implicitly enabled" (never toggled before, no row at all) would
    // otherwise never actually get disabled: this loop used to only UPDATE
    // existing rows, so unchecking it for the first time silently did
    // nothing (no row to flip to enabled:false, none created either).
    const allAddonPackages = await db('packages').where({ type: 'addon' }).select('id');
    for (const { id: packageId } of allAddonPackages) {
      if (enabledModules.includes(packageId)) continue;
      const existing = existingAssociations.find(a => a.packageId === packageId);
      if (existing) {
        await db('world_packages')
          .where({ worldId, packageId })
          .update({ enabled: false, updatedAt: new Date().toISOString() });
      } else {
        await db('world_packages').insert({
          id: `wp-${worldId}-${packageId}`,
          worldId,
          packageId,
          enabled: false,
          loadOrder: 0,
          config: '{}',
          installedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
    }

    logger.info('World modules updated by GM', { worldId, enabledModules });
    res.json({ success: true, enabledModules, worldId });
  } catch (err: any) {
    logger.error('POST /api/worlds/:worldId/packages/gm failed', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

/** POST /api/worlds/:worldId/join — authenticate user, return session info */
worldsRouter.post('/:worldId/join', joinLimiter, async (req, res) => {
  try {
    const { userId, password = '' } = req.body;
    const world = await WorldsDocument.findById<any>(req.params.worldId);
    if (!world) return res.status(404).json({ error: 'World not found' });
    if (!world.system || world.system === 'generic') {
      return res.status(400).json({ error: 'Este mundo não tem um sistema de RPG ativo. Configure um sistema antes de entrar.' });
    }

    const user = await UsersDocument.findOne<any>({ id: userId, worldId: req.params.worldId });
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (user.pendingApproval) {
      return res.status(403).json({ error: 'Usuário aguardando aprovação do Mestre.' });
    }

    if (user.authProvider === 'loom_site' && !user.password) {
      return res.status(401).json({ error: 'Esta conta é vinculada ao Google. Entre usando o botão "Entrar com Google".' });
    }

    let passwordValid = false;

    if (world.adminPassword) {
      passwordValid = await bcrypt.compare(password, world.adminPassword);
    }

    if (!passwordValid && user.password) {
      passwordValid = await bcrypt.compare(password, user.password);
    }

    if (!passwordValid && (world.adminPassword || user.password)) {
      return res.status(401).json({ error: 'Incorrect password' });
    }

    // GM/Assistant GM nunca loga sem senha, mesmo se o mundo/usuario nao tiverem
    // uma cadastrada — senao um anonimo vira GM so sabendo o worldId + userId
    // (ambos visiveis no seletor de login sem sessao nenhuma).
    if (!passwordValid && user.role >= 3) {
      return res.status(401).json({ error: 'GM/Assistant GM requires a password' });
    }

    // Update lastLogin
    await UsersDocument.update(userId, { lastLogin: new Date().toISOString() });

    const token = await signToken({
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      userColor: user.color,
      worldId: req.params.worldId,
    }, '24h');

    res.cookie(WORLD_COOKIE, token, worldCookieOptions(req));

    // Sessão vive só no cookie HttpOnly — client (world-login.ts) descarta o
    // body inteiro e só confia no cookie, então não duplicar o JWT aqui.
    res.json({
      session: {
        userId: user.id,
        userName: user.name,
        userColor: user.color,
        userRole: user.role,
        worldId: req.params.worldId,
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/** POST /api/worlds/:worldId/oauth-join — exchange single-use OAuth code with LOOMSITE and log in or queue pending approval */
worldsRouter.post('/:worldId/oauth-join', joinLimiter, async (req, res) => {
  try {
    const { exchangeCode } = req.body;
    if (!exchangeCode || typeof exchangeCode !== 'string') {
      return res.status(400).json({ error: 'exchangeCode é obrigatório.' });
    }

    const world = await WorldsDocument.findById<any>(req.params.worldId);
    if (!world) return res.status(404).json({ error: 'World not found' });
    if (!world.system || world.system === 'generic') {
      return res.status(400).json({ error: 'Este mundo não tem um sistema de RPG ativo. Configure um sistema antes de entrar.' });
    }

    const LOOMSITE = process.env.LOOM_SITE_URL || 'https://loomsite.vercel.app';
    const siteRes = await fetch(`${LOOMSITE}/api/oauth/exchange`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ exchangeCode: exchangeCode.trim() }),
    });

    if (!siteRes.ok) {
      const errBody = await siteRes.json().catch(() => ({}) as any);
      return res.status(400).json({ error: errBody.error || 'Código OAuth inválido ou expirado.' });
    }

    const siteData = await siteRes.json();
    const { accountId, displayName, avatarUrl } = siteData;
    if (!accountId || !displayName) {
      return res.status(400).json({ error: 'Resposta inválida do servidor de autenticação.' });
    }

    let user = await UsersDocument.findOne<any>({
      worldId: req.params.worldId,
      siteAccountId: accountId,
    });

    if (!user) {
      // Quem já é Admin desta instalação (sessão do Setup Hub aberta no mesmo
      // navegador) não precisa esperar aprovação de ninguém — ele já é o dono.
      // Nasce direto como Gamemaster. Qualquer outra pessoa nasce Player
      // pendente, esperando o GM aprovar (fluxo normal).
      const adminToken = extractToken(req, ADMIN_COOKIE);
      const adminPayload = adminToken ? await verifyToken(adminToken) : null;
      const isRequesterAdmin = !!adminPayload?.admin;

      const createRes = await UsersDocument.create<any>({
        worldId: req.params.worldId,
        name: displayName,
        role: isRequesterAdmin ? 4 : 1,
        password: '',
        color: '#4f46e5',
        avatarUrl: avatarUrl || '',
        siteAccountId: accountId,
        authProvider: 'loom_site',
        pendingApproval: !isRequesterAdmin,
      });

      if (createRes.error) {
        return res.status(400).json({ error: createRes.error });
      }
      user = createRes.data;

      const { password: _, ...safe } = user;
      Signal.broadcast('user.created', safe);

      if (isRequesterAdmin) {
        const token = await signToken({
          userId: user.id,
          userName: user.name,
          userRole: user.role,
          userColor: user.color,
          worldId: req.params.worldId,
        }, '24h');
        res.cookie(WORLD_COOKIE, token, worldCookieOptions(req));
        return res.json({
          pending: false,
          token,
          session: { userId: user.id, userName: user.name, userColor: user.color, userRole: user.role, worldId: req.params.worldId },
        });
      }

      return res.status(202).json({
        pending: true,
        message: 'Solicitação de entrada enviada. Aguardando aprovação do Mestre.',
      });
    }

    if (user.pendingApproval) {
      return res.status(202).json({
        pending: true,
        message: 'Aguardando aprovação do Mestre.',
      });
    }

    await UsersDocument.update(user.id, {
      name: displayName,
      avatarUrl: avatarUrl || user.avatarUrl || '',
      lastLogin: new Date().toISOString(),
    });

    const token = await signToken({
      userId: user.id,
      userName: displayName,
      userRole: user.role,
      userColor: user.color,
      worldId: req.params.worldId,
    }, '24h');

    res.cookie(WORLD_COOKIE, token, worldCookieOptions(req));

    res.json({
      pending: false,
      token,
      session: {
        userId: user.id,
        userName: displayName,
        userColor: user.color,
        userRole: user.role,
        worldId: req.params.worldId,
      },
    });
  } catch (err: any) {
    logger.error('POST /oauth-join failed', { error: err.message });
    res.status(500).json({ error: 'Falha ao autenticar com Google.' });
  }
});

/** POST /api/worlds/session/logout — log the current user out of the game (world
 * stays active for everyone else, unlike /deactivate which stops it for all). */
worldsRouter.post('/session/logout', (_req, res) => {
  res.clearCookie(WORLD_COOKIE);
  res.json({ success: true });
});

/** GET /api/worlds/session/verify — resume an already-active world/game session
 * (e.g. after F5). Independent from the admin session (separate cookie) so a
 * player/GM mid-game never gets bounced to the admin login screen on reload. */
worldsRouter.get('/session/verify', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  const token = extractToken(req, WORLD_COOKIE);
  if (!token) return res.json({ valid: false });

  const payload = await verifyToken(token);
  if (!payload || !payload.userId || !payload.worldId) return res.json({ valid: false });

  const world = await WorldsDocument.findById<any>(payload.worldId);
  if (!world || !world.isActive) return res.json({ valid: false });

  res.json({
    valid: true,
    session: {
      userId: payload.userId,
      userName: payload.userName,
      userColor: payload.userColor,
      userRole: payload.userRole,
      worldId: payload.worldId,
    },
  });
});
