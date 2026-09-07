import { Router } from 'express';
import { DrawingsDocument } from '../schemas/drawings.schema.js';
import { Signal } from '../signals/index.js';
import logger from '../utils/logger.js';
import { requireAuth, requireWorldMatch } from '../middleware/auth.js';

export const drawingsRouter = Router();
drawingsRouter.use(requireAuth, requireWorldMatch);

drawingsRouter.get('/stage/:stageId', async (req, res) => {
  try {
    const drawings = await DrawingsDocument.find({
      stageId: req.params.stageId,
      orderBy: [{ column: 'z', dir: 'asc' }, { column: 'createdAt', dir: 'asc' }],
    });
    res.json(drawings);
  } catch (err: any) {
    logger.error('GET /drawings/stage/:stageId failed', { error: err.message });
    res.status(500).json({ error: 'Failed to list drawings.' });
  }
});

drawingsRouter.get('/:id', async (req, res) => {
  try {
    const drawing = await DrawingsDocument.findById(req.params.id);
    if (!drawing) return res.status(404).json({ error: 'Drawing not found.' });
    res.json(drawing);
  } catch (err: any) {
    logger.error('GET /drawings/:id failed', { error: err.message });
    res.status(500).json({ error: 'Failed to retrieve drawing.' });
  }
});

drawingsRouter.post('/', async (req, res) => {
  try {
    const {
      stageId, type, x, y, width, height, rotation, points,
      fillColor, fillOpacity, strokeColor, strokeWidth,
      text, fontFamily, fontSize,
      z, isHidden, isLocked, levelId
    } = req.body;

    const result = await DrawingsDocument.create({
      stageId,
      type: type ?? 'rectangle',
      x, y,
      width: width ?? 100, height: height ?? 100,
      rotation: rotation ?? 0,
      points: points ?? [],
      fillColor: fillColor ?? '#ffffff', fillOpacity: fillOpacity ?? 0.5,
      strokeColor: strokeColor ?? '#000000', strokeWidth: strokeWidth ?? 1,
      text: text ?? '', fontFamily: fontFamily ?? 'Signika', fontSize: fontSize ?? 32,
      z: z ?? 0, isHidden: isHidden ?? false, isLocked: isLocked ?? false,
      levelId: levelId ?? ''
    });
    if (result.error) return res.status(400).json({ error: result.error });
    logger.info('Drawing created', { id: result.data.id, stageId, type });
    Signal.broadcast('drawing.created', result.data);
    res.status(201).json(result.data);
  } catch (err: any) {
    logger.error('POST /drawings failed', { error: err.message, stack: err.stack, body: req.body });
    res.status(500).json({ error: 'Failed to create drawing.', details: err.message });
  }
});

drawingsRouter.put('/:id', async (req, res) => {
  try {
    const updatableFields = ['type', 'x', 'y', 'width', 'height', 'rotation', 'points',
      'fillColor', 'fillOpacity', 'strokeColor', 'strokeWidth',
      'text', 'fontFamily', 'fontSize',
      'z', 'isHidden', 'isLocked', 'levelId'
    ];
    const updates: Record<string, any> = {};
    for (const key of updatableFields) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    const result = await DrawingsDocument.update(req.params.id, updates);
    if (result.error) return res.status(404).json({ error: result.error });
    Signal.broadcast('drawing.updated', result.data);
    res.json({ success: true });
  } catch (err: any) {
    logger.error('PUT /drawings/:id failed', { error: err.message });
    res.status(500).json({ error: 'Failed to update drawing.' });
  }
});

drawingsRouter.delete('/:id', async (req, res) => {
  try {
    const result = await DrawingsDocument.delete(req.params.id);
    if (result.error) return res.status(404).json({ error: result.error });
    Signal.broadcast('drawing.deleted', { id: req.params.id });
    res.json({ success: true });
  } catch (err: any) {
    logger.error('DELETE /drawings/:id failed', { error: err.message });
    res.status(500).json({ error: 'Failed to delete drawing.' });
  }
});

drawingsRouter.delete('/stage/:stageId', async (req, res) => {
  try {
    const result = await DrawingsDocument.bulkDelete({ stageId: req.params.stageId });
    if (result.error) return res.status(500).json({ error: result.error });
    Signal.broadcast('drawing.cleared', { stageId: req.params.stageId });
    res.json({ success: true, count: result.count });
  } catch (err: any) {
    logger.error('DELETE /drawings/stage/:stageId failed', { error: err.message });
    res.status(500).json({ error: 'Failed to delete drawings.' });
  }
});
