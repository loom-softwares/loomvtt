import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { UsersDocument } from '../schemas/users.schema.js';
import logger from '../utils/logger.js';
import { requireAuth, requireWorldMatch } from '../middleware/auth.js';

export const usersRouter = Router();
usersRouter.use(requireAuth, requireWorldMatch);

const GM_ROLE = 4;

usersRouter.put('/:id', async (req: any, res) => {
  try {
    const target = await UsersDocument.findById(req.params.id);
    if (!target) return res.status(404).json({ error: 'User not found' });

    const isAdmin = !!req.auth?.admin;
    const isSelf = req.auth?.userId === req.params.id;
    const isSameWorldGm = !isAdmin && req.auth?.worldId === target.worldId && (req.auth?.userRole ?? 0) >= GM_ROLE;
    if (!isAdmin && !isSelf && !isSameWorldGm) {
      return res.status(403).json({ error: 'Not authorized to edit this user' });
    }

    const { name, role, password, color, colorHex, avatarUrl, pronouns, actorId } = req.body;
    if (role !== undefined && !isAdmin && !isSameWorldGm) {
      return res.status(403).json({ error: 'Only a Gamemaster can change roles' });
    }
    const updates: Record<string, any> = {};
    if (name !== undefined) updates.name = name;
    if (role !== undefined) updates.role = role;
    if (color !== undefined) updates.color = color;
    if (colorHex !== undefined) updates.colorHex = colorHex;
    if (avatarUrl !== undefined) updates.avatarUrl = avatarUrl;
    if (pronouns !== undefined) updates.pronouns = pronouns;
    if (actorId !== undefined) updates.actorId = actorId;
    if (password !== undefined && password !== '••••') {
      updates.password = password ? await bcrypt.hash(password, 10) : '';
    }
    const result = await UsersDocument.update(req.params.id, updates);
    if (result.error) return res.status(404).json({ error: result.error });
    const { password: _, ...safe } = result.data;
    logger.info('User preferences updated', { id: req.params.id });
    res.json(safe);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/** PUT /api/users/:id/flags — merge-patch de um flag.
 * Body: { scope, key, value }. Só o próprio usuário ou um GM do mesmo mundo pode alterar. */
usersRouter.put('/:id/flags', async (req: any, res) => {
  try {
    const target = await UsersDocument.findById(req.params.id);
    if (!target) return res.status(404).json({ error: 'User not found' });

    const isAdmin = !!req.auth?.admin;
    const isSelf = req.auth?.userId === req.params.id;
    const isSameWorldGm = !isAdmin && req.auth?.worldId === target.worldId && (req.auth?.userRole ?? 0) >= GM_ROLE;
    if (!isAdmin && !isSelf && !isSameWorldGm) {
      return res.status(403).json({ error: 'Not authorized to set flags on this user' });
    }

    const { scope, key, value } = req.body;
    if (!scope || !key) return res.status(400).json({ error: 'scope and key are required' });

    const flags = { ...(target.flags || {}) };
    flags[scope] = { ...(flags[scope] || {}), [key]: value };

    const result = await UsersDocument.update(req.params.id, { flags });
    if (result.error) return res.status(404).json({ error: result.error });
    res.json({ flags: result.data.flags });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
