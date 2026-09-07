import { Router } from 'express';
import { TemplatesDocument } from '../schemas/templates.schema.js';
import { Signal } from '../signals/index.js';
import logger from '../utils/logger.js';
import { requireAuth, requireWorldMatch } from '../middleware/auth.js';

export const templatesRouter = Router();
templatesRouter.use(requireAuth, requireWorldMatch);

templatesRouter.get('/:stageId/templates', async (req: any, res) => {
  try {
    const rows = await TemplatesDocument.find({ stageId: req.params.stageId, orderBy: 'createdAt', orderDir: 'asc' });
    res.json(rows);
  } catch (err: any) {
    logger.error('GET /api/stages/:stageId/templates failed', { error: err.message });
    res.status(500).json({ error: 'Failed to retrieve templates' });
  }
});

templatesRouter.post('/:stageId/templates', async (req: any, res) => {
  const {
    type = 'cone', x = 0, y = 0, rotation = 0,
    radius = 100, width = 100, height = 100, angle = 90, distance = 100,
    fillColor = '#6366f1', strokeColor = '#6366f1', opacity = 0.3,
    locked = false, hidden = false, flags = '{}',
  } = req.body;
  try {
    const result = await TemplatesDocument.create({
      stageId: req.params.stageId,
      userId: req.auth?.userId ?? '',
      type, x, y, rotation, radius, width, height, angle, distance,
      fillColor, strokeColor, opacity, locked: !!locked, hidden: !!hidden, flags,
    });
    if (result.error) return res.status(400).json({ error: result.error });
    Signal.broadcast('template.created', result.data);
    logger.info('Template created', { id: result.data.id, stageId: req.params.stageId, type });
    res.status(201).json(result.data);
  } catch (err: any) {
    logger.error('POST /api/stages/:stageId/templates failed', { error: err.message });
    res.status(500).json({ error: 'Failed to create template' });
  }
});

templatesRouter.put('/:stageId/templates/:id', async (req: any, res) => {
  const { id } = req.params;
  const {
    type, x, y, rotation, radius, width, height, angle, distance,
    fillColor, strokeColor, opacity, locked, hidden, flags,
  } = req.body;
  try {
    const updates: Record<string, any> = {};
    if (type       !== undefined) updates.type       = type;
    if (x          !== undefined) updates.x          = x;
    if (y          !== undefined) updates.y          = y;
    if (rotation   !== undefined) updates.rotation   = rotation;
    if (radius     !== undefined) updates.radius     = radius;
    if (width      !== undefined) updates.width      = width;
    if (height     !== undefined) updates.height     = height;
    if (angle      !== undefined) updates.angle      = angle;
    if (distance   !== undefined) updates.distance   = distance;
    if (fillColor  !== undefined) updates.fillColor  = fillColor;
    if (strokeColor!== undefined) updates.strokeColor = strokeColor;
    if (opacity    !== undefined) updates.opacity    = opacity;
    if (locked     !== undefined) updates.locked     = !!locked;
    if (hidden     !== undefined) updates.hidden     = !!hidden;
    if (flags      !== undefined) updates.flags      = flags;
    const result = await TemplatesDocument.update(id, updates);
    if (result.error) return res.status(404).json({ error: result.error });
    Signal.broadcast('template.updated', result.data);
    res.json(result.data);
  } catch (err: any) {
    logger.error('PUT /api/stages/:stageId/templates/:id failed', { error: err.message, id });
    res.status(500).json({ error: 'Failed to update template' });
  }
});

templatesRouter.delete('/:stageId/templates/:id', async (req: any, res) => {
  const { id } = req.params;
  try {
    const result = await TemplatesDocument.delete(id);
    if (result.error) return res.status(404).json({ error: result.error });
    Signal.broadcast('template.deleted', { id, stageId: req.params.stageId });
    res.json({ success: true, id });
  } catch (err: any) {
    logger.error('DELETE /api/stages/:stageId/templates/:id failed', { error: err.message, id });
    res.status(500).json({ error: 'Failed to delete template' });
  }
});
