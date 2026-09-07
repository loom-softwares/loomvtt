import { Router } from 'express';
import { randomUUID } from 'crypto';
import { BuffsDocument } from '../schemas/buffs.schema.js';
import { Signal } from '../signals/index.js';
import logger from '../utils/logger.js';
import { requireAuth, requireWorldMatch } from '../middleware/auth.js';

export const buffsRouter = Router();
buffsRouter.use(requireAuth, requireWorldMatch);

// GET /api/buffs/actor/:actorId — List buffs for actor
buffsRouter.get('/actor/:actorId', async (req, res) => {
  try {
    const buffs = await BuffsDocument.find({
      actorId: req.params.actorId,
      orderBy: [{ column: 'createdAt', dir: 'asc' }],
    });
    res.json(buffs);
  } catch (err: any) {
    logger.error('GET /buffs/actor/:actorId failed', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// GET /api/buffs/item/:itemId — List buffs for item
buffsRouter.get('/item/:itemId', async (req, res) => {
  try {
    const buffs = await BuffsDocument.find({
      itemId: req.params.itemId,
      orderBy: [{ column: 'createdAt', dir: 'asc' }],
    });
    res.json(buffs);
  } catch (err: any) {
    logger.error('GET /buffs/item/:itemId failed', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// POST /api/buffs — Create a buff
buffsRouter.post('/', async (req, res) => {
  try {
    const { worldId, actorId, itemId, name, icon, origin, duration, disabled, changes } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'name is required' });
    }
    if (!actorId && !itemId) {
      return res.status(400).json({ error: 'actorId or itemId is required' });
    }
    if (!worldId && !itemId) {
      return res.status(400).json({ error: 'worldId or itemId is required' });
    }
    const id = `buff-${randomUUID()}`;
    const result = await BuffsDocument.create({
      id,
      worldId: worldId ?? null,
      actorId: actorId ?? null,
      itemId: itemId ?? null,
      name,
      icon: icon ?? '',
      origin: origin ?? '',
      duration: duration ?? -1,
      disabled: disabled ?? false,
      changes: changes ?? [],
    });
    if (result.error) return res.status(400).json({ error: result.error });
    Signal.broadcast('buff.created', result.data);
    res.status(201).json(result.data);
  } catch (err: any) {
    logger.error('POST /buffs failed', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/buffs/:id — Update a buff
buffsRouter.put('/:id', async (req, res) => {
  try {
    const { name, icon, origin, duration, disabled, changes } = req.body;
    const updates: Record<string, any> = {};
    if (name !== undefined) updates.name = name;
    if (icon !== undefined) updates.icon = icon;
    if (origin !== undefined) updates.origin = origin;
    if (duration !== undefined) updates.duration = duration;
    if (disabled !== undefined) updates.disabled = disabled;
    if (changes !== undefined) updates.changes = changes;

    const result = await BuffsDocument.update(req.params.id, updates);
    if (result.error) return res.status(404).json({ error: result.error });
    Signal.broadcast('buff.updated', result.data);
    res.json(result.data);
  } catch (err: any) {
    logger.error('PUT /buffs/:id failed', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/buffs/:id — Delete a buff
buffsRouter.delete('/:id', async (req, res) => {
  try {
    const result = await BuffsDocument.delete(req.params.id);
    if (result.error) return res.status(404).json({ error: result.error });
    Signal.broadcast('buff.deleted', { id: req.params.id });
    res.json({ success: true });
  } catch (err: any) {
    logger.error('DELETE /buffs/:id failed', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});
