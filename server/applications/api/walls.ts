import { Router } from 'express';
import { WallsDocument } from '../schemas/walls.schema.js';
import { Signal } from '../signals/index.js';
import logger from '../utils/logger.js';
import { requireAuth, requireWorldMatch } from '../middleware/auth.js';

export const wallsRouter = Router();
wallsRouter.use(requireAuth, requireWorldMatch);

wallsRouter.get('/stage/:stageId', async (req, res) => {
  try {
    const walls = await WallsDocument.find({ stageId: req.params.stageId, orderBy: 'createdAt', orderDir: 'asc' });
    res.json(walls);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

wallsRouter.post('/stage/:stageId', async (req, res) => {
  try {
    const { x1, y1, x2, y2, sight, light, movement, sound, direction, wallType, door, doorState, levelId } = req.body;
    const result = await WallsDocument.create({
      stageId: req.params.stageId,
      x1, y1, x2, y2,
      sight: sight ?? true, light: light ?? true, movement: movement ?? true, sound: sound ?? true,
      direction: direction ?? 0, wallType: wallType ?? 'normal', door: door ?? 0, doorState: doorState ?? 0,
      levelId: levelId ?? '',
    });
    if (result.error) return res.status(400).json({ error: result.error });
    const wall = result.data;
    Signal.broadcast('wall.created', wall);
    res.status(201).json(wall);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

wallsRouter.put('/:id', async (req, res) => {
  try {
    const { x1, y1, x2, y2, sight, light, movement, sound, direction, wallType, door, doorState, levelId } = req.body;
    const updates: Record<string, any> = {};
    if (x1 !== undefined) updates.x1 = x1;
    if (y1 !== undefined) updates.y1 = y1;
    if (x2 !== undefined) updates.x2 = x2;
    if (y2 !== undefined) updates.y2 = y2;
    if (sight !== undefined) updates.sight = sight;
    if (light !== undefined) updates.light = light;
    if (movement !== undefined) updates.movement = movement;
    if (sound !== undefined) updates.sound = sound;
    if (direction !== undefined) updates.direction = direction;
    if (wallType !== undefined) updates.wallType = wallType;
    if (door !== undefined) updates.door = door;
    if (doorState !== undefined) updates.doorState = doorState;
    if (levelId !== undefined) updates.levelId = levelId;

    const result = await WallsDocument.update(req.params.id, updates);
    if (result.error) return res.status(404).json({ error: result.error });
    const wall = result.data;

    Signal.broadcast('wall.updated', wall);
    logger.info('Wall updated', { id: req.params.id });
    res.json(wall);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

wallsRouter.put('/:id/state', async (req, res) => {
  try {
    const { doorState } = req.body;
    const result = await WallsDocument.update(req.params.id, { doorState });
    if (result.error) return res.status(404).json({ error: result.error });
    const wall = result.data;
    Signal.broadcast('door.state', { wallId: wall.id, door: wall.door, doorState });
    logger.info('Wall door state updated', { id: req.params.id, doorState });
    res.json(wall);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

wallsRouter.delete('/:id', async (req, res) => {
  try {
    const result = await WallsDocument.delete(req.params.id);
    if (result.error) return res.status(400).json({ error: result.error });
    Signal.broadcast('wall.deleted', { id: req.params.id });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
