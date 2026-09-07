import { Router } from 'express';
import { randomUUID } from 'crypto';
import { NoisesDocument } from '../schemas/noises.schema.js';
import { Signal } from '../signals/index.js';
import logger from '../utils/logger.js';
import { requireAuth, requireWorldMatch } from '../middleware/auth.js';

export const noisesRouter = Router();
noisesRouter.use(requireAuth, requireWorldMatch);

// GET /api/noises/stage/:stageId — List ambient noises on a stage
noisesRouter.get('/stage/:stageId', async (req, res) => {
  try {
    const noises = await NoisesDocument.find({
      stageId: req.params.stageId,
      orderBy: [{ column: 'createdAt', dir: 'asc' }],
    });
    res.json(noises);
  } catch (err: any) {
    logger.error('GET /noises/stage/:stageId failed', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// POST /api/noises — Create an ambient noise source
noisesRouter.post('/', async (req, res) => {
  try {
    const { stageId, src, x, y, radius, volume, easing, hidden, darknessMin, darknessMax, wallsBlock, levelId } = req.body;
    if (!stageId) {
      return res.status(400).json({ error: 'stageId is required' });
    }
    const id = `noise-${randomUUID()}`;
    const result = await NoisesDocument.create({
      id,
      stageId,
      src,
      x: x ?? 0,
      y: y ?? 0,
      radius: radius ?? 300,
      volume: volume ?? 1,
      easing: easing ?? true,
      hidden: hidden ?? false,
      darknessMin: darknessMin ?? 0,
      darknessMax: darknessMax ?? 1,
      wallsBlock: wallsBlock ?? false,
      levelId: levelId ?? '',
    });
    if (result.error) return res.status(400).json({ error: result.error });
    Signal.broadcast('noise.created', result.data);
    res.status(201).json(result.data);
  } catch (err: any) {
    logger.error('POST /noises failed', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/noises/:id — Update an ambient noise source
noisesRouter.put('/:id', async (req, res) => {
  try {
    const { src, x, y, radius, volume, easing, hidden, darknessMin, darknessMax, wallsBlock, levelId } = req.body;
    const updates: Record<string, any> = {};
    if (src !== undefined) updates.src = src;
    if (x !== undefined) updates.x = x;
    if (y !== undefined) updates.y = y;
    if (radius !== undefined) updates.radius = radius;
    if (volume !== undefined) updates.volume = volume;
    if (easing !== undefined) updates.easing = easing;
    if (hidden !== undefined) updates.hidden = hidden;
    if (darknessMin !== undefined) updates.darknessMin = darknessMin;
    if (darknessMax !== undefined) updates.darknessMax = darknessMax;
    if (wallsBlock !== undefined) updates.wallsBlock = wallsBlock;
    if (levelId !== undefined) updates.levelId = levelId;

    const result = await NoisesDocument.update(req.params.id, updates);
    if (result.error) return res.status(404).json({ error: result.error });
    Signal.broadcast('noise.updated', result.data);
    res.json(result.data);
  } catch (err: any) {
    logger.error('PUT /noises/:id failed', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/noises/:id — Delete an ambient noise source
noisesRouter.delete('/:id', async (req, res) => {
  try {
    const result = await NoisesDocument.delete(req.params.id);
    if (result.error) return res.status(404).json({ error: result.error });
    Signal.broadcast('noise.deleted', { id: req.params.id });
    res.json({ success: true });
  } catch (err: any) {
    logger.error('DELETE /noises/:id failed', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});
