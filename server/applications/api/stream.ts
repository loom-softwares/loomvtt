/*******************************************************************************
 * LoomVTT
 * server/applications/api/stream.ts
 *
 *
 * View-only session bootstrap for OBS Browser Source capture views
 * (/?capture=canvas / /?capture=chat, see client/main.ts). OBS's embedded
 * browser can't go through the normal login form, and putting a long-lived
 * token straight in the URL was ruled out on purpose (see auth.ts's
 * extractToken comment) — so this trades a short-lived, single-use setup
 * code for a normal HttpOnly session cookie, exactly like any other login.
 ******************************************************************************/

import { Router } from 'express';
import { UsersDocument } from '../schemas/users.schema.js';
import { WorldsDocument } from '../schemas/worlds.schema.js';
import { signToken, WORLD_COOKIE, worldCookieOptions, requireAuth } from '../middleware/auth.js';
import { requireGM } from '../middleware/permissions.js';
import logger from '../utils/logger.js';

export const streamRouter = Router();

interface PendingCode {
  worldId: string;
  expiresAt: number;
}

const pendingCodes = new Map<string, PendingCode>();
const CODE_TTL_MS = 5 * 60 * 1000;

function randomCode(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function issueCode(worldId: string): string {
  let code = randomCode();
  while (pendingCodes.has(code)) code = randomCode();
  pendingCodes.set(code, { worldId, expiresAt: Date.now() + CODE_TTL_MS });
  return code;
}

/** POST /api/stream/link — GM generates two one-time setup codes (canvas + chat views
 * are separate Browser Sources in OBS, each needs its own cookie exchange — sharing one
 * code between them would burn it on whichever loads first). Paste each resulting URL
 * into its own OBS Browser Source once; each exchanges its code for a session cookie on
 * first load and never needs it again. */
streamRouter.post('/link', requireAuth, requireGM, async (req, res) => {
  try {
    const worldId = (req as any).auth?.worldId;
    if (!worldId) return res.status(400).json({ error: 'No active world session' });

    res.json({
      canvasCode: issueCode(worldId),
      chatCode: issueCode(worldId),
      expiresInSeconds: CODE_TTL_MS / 1000,
    });
  } catch (err: any) {
    logger.error('POST /api/stream/link failed', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

/** POST /api/stream/exchange — burns a one-time code, sets a long-lived view-only
 * session cookie. Public on purpose (that's the whole point — OBS never logs in);
 * the code is single-use and expires in 5 minutes, so a leaked URL is only a risk
 * for that window. */
streamRouter.post('/exchange', async (req, res) => {
  try {
    const { code } = req.body;
    const entry = code ? pendingCodes.get(code) : null;
    if (!entry || entry.expiresAt < Date.now()) {
      if (code) pendingCodes.delete(code);
      return res.status(400).json({ error: 'Código inválido ou expirado.' });
    }
    pendingCodes.delete(code);

    const world = await WorldsDocument.findById<any>(entry.worldId);
    if (!world) return res.status(404).json({ error: 'Mundo não encontrado.' });

    // Reuses a single "Streamer" user per world instead of a synthetic id — keeps
    // every downstream lookup that expects a real `users` row (whoami, cast
    // ownership, etc.) working without special-casing a fake user everywhere.
    let user = await UsersDocument.findOne<any>({ worldId: entry.worldId, name: 'Streamer' });
    if (!user) {
      const created = await UsersDocument.create({ worldId: entry.worldId, name: 'Streamer', role: 1, color: '#888888' });
      if (created.error) return res.status(500).json({ error: created.error });
      user = created.data;
    }

    const token = await signToken({
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      userColor: user.color,
      worldId: entry.worldId,
    }, '90d');

    res.cookie(WORLD_COOKIE, token, worldCookieOptions(req));
    res.json({ ok: true });
  } catch (err: any) {
    logger.error('POST /api/stream/exchange failed', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});
