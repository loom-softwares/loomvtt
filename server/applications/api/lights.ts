import { Router } from 'express';
import { Ambient_lightsDocument } from '../schemas/ambient_lights.schema.js';
import { Signal } from '../signals/index.js';
import logger from '../utils/logger.js';
import { requireAuth, requireWorldMatch } from '../middleware/auth.js';

export const lightsRouter = Router();
lightsRouter.use(requireAuth, requireWorldMatch);

lightsRouter.get('/:stageId/lights', async (req, res) => {
  try {
    const rows = await Ambient_lightsDocument.find({ stageId: req.params.stageId, orderBy: 'createdAt', orderDir: 'asc' });
    res.json(rows);
  } catch (err: any) {
    logger.error('GET /api/stages/:stageId/lights failed', { error: err.message });
    res.status(500).json({ error: 'Failed to retrieve lights' });
  }
});

lightsRouter.post('/:stageId/lights', async (req, res) => {
  try {
    const { x, y, radius, color, intensity, rotation, bright, dim, angle, walls, vision, animationSpeed, animationIntensity, animation, isHidden, darknessMin, darknessMax, levelId } = req.body;
    const result = await Ambient_lightsDocument.create({
      stageId: req.params.stageId,
      x: x ?? 0,
      y: y ?? 0,
      radius: radius ?? 200,
      color: color ?? '#ffdd88',
      intensity: intensity ?? 0.5,
      rotation: rotation ?? 0,
      bright: bright ?? 100,
      dim: dim ?? radius ?? 200,
      angle: angle ?? 360,
      walls: walls ?? true,
      vision: vision ?? false,
      animationSpeed: animationSpeed ?? 5,
      animationIntensity: animationIntensity ?? 5,
      animation: animation ?? 'none',
      isHidden: isHidden ?? false,
      darknessMin: darknessMin ?? 0,
      darknessMax: darknessMax ?? 1,
      levelId: levelId ?? '',
    });
    if (result.error) return res.status(400).json({ error: result.error });
    Signal.broadcast('light.created', result.data);
    logger.info('Ambient light created', { id: result.data.id, stageId: req.params.stageId });
    res.status(201).json(result.data);
  } catch (err: any) {
    logger.error('POST /api/stages/:stageId/lights failed', { error: err.message });
    res.status(500).json({ error: 'Failed to create light' });
  }
});

lightsRouter.put('/:stageId/lights/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const { x, y, radius, color, intensity, rotation, bright, dim, angle, walls, vision, animationSpeed, animationIntensity, animation, isHidden, darknessMin, darknessMax, levelId } = req.body;
    const updates: Record<string, any> = {};
    if (x !== undefined) updates.x = x;
    if (y !== undefined) updates.y = y;
    if (radius !== undefined) updates.radius = radius;
    if (color !== undefined) updates.color = color;
    if (intensity !== undefined) updates.intensity = intensity;
    if (rotation !== undefined) updates.rotation = rotation;
    if (bright !== undefined) updates.bright = bright;
    if (dim !== undefined) updates.dim = dim;
    if (angle !== undefined) updates.angle = angle;
    if (walls !== undefined) updates.walls = !!walls;
    if (vision !== undefined) updates.vision = !!vision;
    if (animationSpeed !== undefined) updates.animationSpeed = animationSpeed;
    if (animationIntensity !== undefined) updates.animationIntensity = animationIntensity;
    if (animation !== undefined) updates.animation = animation;
    if (isHidden !== undefined) updates.isHidden = !!isHidden;
    if (darknessMin !== undefined) updates.darknessMin = darknessMin;
    if (darknessMax !== undefined) updates.darknessMax = darknessMax;
    if (levelId !== undefined) updates.levelId = levelId;
    
    const result = await Ambient_lightsDocument.update(id, updates);
    if (result.error) return res.status(404).json({ error: result.error });
    Signal.broadcast('light.updated', result.data);
    res.json(result.data);
  } catch (err: any) {
    logger.error('PUT /api/stages/:stageId/lights/:id failed', { error: err.message, id });
    res.status(500).json({ error: 'Failed to update light' });
  }
});

lightsRouter.delete('/:stageId/lights/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await Ambient_lightsDocument.delete(id);
    if (result.error) return res.status(404).json({ error: result.error });
    Signal.broadcast('light.deleted', { id, stageId: req.params.stageId });
    res.json({ success: true, id });
  } catch (err: any) {
    logger.error('DELETE /api/stages/:stageId/lights/:id failed', { error: err.message, id });
    res.status(500).json({ error: 'Failed to delete light' });
  }
});
