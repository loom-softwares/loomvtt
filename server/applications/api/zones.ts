import { Router } from 'express';
import { randomUUID } from 'crypto';
import { ZonesDocument } from '../schemas/zones.schema.js';
import { Signal } from '../signals/index.js';
import logger from '../utils/logger.js';
import { requireAuth, requireWorldMatch } from '../middleware/auth.js';

export const zonesRouter = Router();
zonesRouter.use(requireAuth, requireWorldMatch);

// GET /api/zones/stage/:stageId — List trigger zones for a stage
zonesRouter.get('/stage/:stageId', async (req, res) => {
  try {
    const zones = await ZonesDocument.find({
      stageId: req.params.stageId,
      orderBy: [{ column: 'createdAt', dir: 'asc' }],
    });
    res.json(zones);
  } catch (err: any) {
    logger.error('GET /zones/stage/:stageId failed', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// POST /api/zones — Create a trigger zone
zonesRouter.post('/', async (req, res) => {
  try {
    const { stageId, name, shape, x, y, width, height, points, handlers } = req.body;
    if (!stageId || !name) {
      return res.status(400).json({ error: 'stageId and name are required' });
    }
    const id = `zone-${randomUUID()}`;
    const result = await ZonesDocument.create({
      id,
      stageId,
      name,
      shape: shape ?? 'rect',
      x: x ?? 0,
      y: y ?? 0,
      width: width ?? 100,
      height: height ?? 100,
      points: points ?? [],
      handlers: handlers ?? [],
    });
    if (result.error) return res.status(400).json({ error: result.error });
    Signal.broadcast('zone.created', result.data);
    res.status(201).json(result.data);
  } catch (err: any) {
    logger.error('POST /zones failed', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/zones/:id — Update a trigger zone
zonesRouter.put('/:id', async (req, res) => {
  try {
    const { name, shape, x, y, width, height, points, handlers } = req.body;
    const updates: Record<string, any> = {};
    if (name !== undefined) updates.name = name;
    if (shape !== undefined) updates.shape = shape;
    if (x !== undefined) updates.x = x;
    if (y !== undefined) updates.y = y;
    if (width !== undefined) updates.width = width;
    if (height !== undefined) updates.height = height;
    if (points !== undefined) updates.points = points;
    if (handlers !== undefined) updates.handlers = handlers;

    const result = await ZonesDocument.update(req.params.id, updates);
    if (result.error) return res.status(404).json({ error: result.error });
    Signal.broadcast('zone.updated', result.data);
    res.json(result.data);
  } catch (err: any) {
    logger.error('PUT /zones/:id failed', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/zones/:id — Delete a trigger zone
zonesRouter.delete('/:id', async (req, res) => {
  try {
    const result = await ZonesDocument.delete(req.params.id);
    if (result.error) return res.status(404).json({ error: result.error });
    Signal.broadcast('zone.deleted', { id: req.params.id });
    res.json({ success: true });
  } catch (err: any) {
    logger.error('DELETE /zones/:id failed', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});
