/**
 * core/src/api/tiles.ts
 *
 * REST routes for Active Tiles CRUD operations.
 * Mounted at /api/tiles in core/src/index.ts
 */

import { Router } from 'express';
import { TilesDocument } from '../schemas/tiles.schema.js';
import { Signal } from '../signals/index.js';
import logger from '../utils/logger.js';
import { requireAuth, requireWorldMatch } from '../middleware/auth.js';

export const tilesRouter = Router();
tilesRouter.use(requireAuth, requireWorldMatch);

// Helper: parse JSON fields from DB row safely
function parseTile(row: any) {
  if (!row) return null;
  return {
    ...row,
    isActive: Boolean(row.isActive),
    isOverhead: Boolean(row.isOverhead),
    isRoof: Boolean(row.isRoof),
    locked: Boolean(row.locked),
    videoLoop: Boolean(row.videoLoop),
    videoAutoplay: Boolean(row.videoAutoplay),
    opacity: row.opacity ?? 1,
    rotation: row.rotation ?? 0,
    videoVolume: row.videoVolume ?? 1,
    anchorX: row.anchorX ?? 0.5,
    anchorY: row.anchorY ?? 0.5,
    floors: typeof row.floors === 'string' ? JSON.parse(row.floors) : (row.floors ?? []),
    occlusion: typeof row.occlusion === 'string' ? JSON.parse(row.occlusion) : (row.occlusion ?? { mode: 'fade', radius: 100, alpha: 0 }),
    triggers: typeof row.triggers === 'string' ? JSON.parse(row.triggers) : (row.triggers ?? []),
    conditions: typeof row.conditions === 'string' ? JSON.parse(row.conditions) : (row.conditions ?? []),
    actions: typeof row.actions === 'string' ? JSON.parse(row.actions) : (row.actions ?? []),
  };
}

// ---------------------------------------------------------------------------
// GET /api/tiles — list all active tiles for active stage
// ---------------------------------------------------------------------------
tilesRouter.get('/', async (req, res) => {
  const { stageId } = req.query;
  try {
    const filter: Record<string, any> = {};
    if (stageId) filter.stageId = String(stageId);
    filter.orderBy = 'createdAt';
    filter.orderDir = 'asc';
    const rows = await TilesDocument.find(filter);
    res.json(rows.map(parseTile));
  } catch (err: any) {
    logger.error('GET /api/tiles failed', { error: err.message });
    res.status(500).json({ error: 'Failed to retrieve tiles' });
  }
});

tilesRouter.get('/:id', async (req, res) => {
  try {
    const tile = await TilesDocument.findById(req.params.id);
    if (!tile) return res.status(404).json({ error: 'Tile not found' });
    res.json(parseTile(tile));
  } catch (err: any) {
    logger.error('GET /api/tiles/:id failed', { error: err.message });
    res.status(500).json({ error: 'Failed to retrieve tile' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/tiles — create a new active tile
// ---------------------------------------------------------------------------
tilesRouter.post('/', async (req, res) => {
  try {
    const { stageId, name, x = 0, y = 0, width = 100, height = 100, imgUrl = '', isActive = true, rotation, tintColor, opacity, locked, videoLoop, videoAutoplay, videoVolume, anchorX, anchorY, floors = [], triggers = [], conditions = [], actions = [], elevation, levelId } = req.body;

    if (!stageId || !name) {
      return res.status(400).json({ error: 'Fields "stageId" and "name" are required.' });
    }

    const result = await TilesDocument.create({
      stageId,
      name: name.trim(),
      x,
      y,
      width,
      height,
      imgUrl,
      isActive,
      rotation: rotation ?? 0,
      tintColor: tintColor ?? '#ffffff',
      opacity: opacity ?? 1,
      locked: locked ?? false,
      videoLoop: videoLoop ?? true,
      videoAutoplay: videoAutoplay ?? true,
      videoVolume: videoVolume ?? 0,
      anchorX: anchorX ?? 0.5,
      anchorY: anchorY ?? 0.5,
      floors: JSON.stringify(floors),
      triggers: JSON.stringify(triggers),
      conditions: JSON.stringify(conditions),
      actions: JSON.stringify(actions),
      elevation: elevation ?? 0,
      levelId: levelId ?? ''
    });

    if (result.error) return res.status(400).json({ error: result.error });
    const created = result.data;

    // Signal.broadcast('tile.created', ...) já sai de dentro de TilesDocument.create()
    // (LoomDocument.create() genérico) — não duplicar aqui.
    logger.info('Active tile created', { id: created.id, name: created.name, stageId });

    res.status(201).json(created);
  } catch (err: any) {
    logger.error('POST /api/tiles failed', { error: err.message });
    res.status(500).json({ error: 'Failed to create tile' });
  }
});

// ---------------------------------------------------------------------------
// PUT /api/tiles/:id — update a tile
// ---------------------------------------------------------------------------
tilesRouter.put('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const { name, x, y, width, height, imgUrl, isActive, rotation, tintColor, opacity, locked, videoLoop, videoAutoplay, videoVolume, anchorX, anchorY, floors, triggers, conditions, actions, elevation, levelId } = req.body;

    const existing = await TilesDocument.findById(id);
    if (!existing) return res.status(404).json({ error: 'Tile not found' });

    const updates: Record<string, any> = {};
    if (levelId !== undefined) updates.levelId = levelId;
    if (name !== undefined) updates.name = String(name).trim();
    if (x !== undefined) updates.x = x;
    if (y !== undefined) updates.y = y;
    if (width !== undefined) updates.width = width;
    if (height !== undefined) updates.height = height;
    if (imgUrl !== undefined) updates.imgUrl = imgUrl;
    if (isActive !== undefined) updates.isActive = isActive;
    if (rotation !== undefined) updates.rotation = rotation;
    if (tintColor !== undefined) updates.tintColor = tintColor;
    if (opacity !== undefined) updates.opacity = opacity;
    if (locked !== undefined) updates.locked = locked;
    if (videoLoop !== undefined) updates.videoLoop = videoLoop;
    if (videoAutoplay !== undefined) updates.videoAutoplay = videoAutoplay;
    if (videoVolume !== undefined) updates.videoVolume = videoVolume;
    if (anchorX !== undefined) updates.anchorX = anchorX;
    if (anchorY !== undefined) updates.anchorY = anchorY;
    if (floors !== undefined) updates.floors = JSON.stringify(floors);
    if (triggers !== undefined) updates.triggers = JSON.stringify(triggers);
    if (conditions !== undefined) updates.conditions = JSON.stringify(conditions);
    if (actions !== undefined) updates.actions = JSON.stringify(actions);
    if (elevation !== undefined) updates.elevation = elevation;

    const result = await TilesDocument.update(id, updates);
    if (result.error) return res.status(400).json({ error: result.error });
    const updated = result.data;

    // Signal.broadcast('tile.updated', ...) já sai de dentro de TilesDocument.update()
    // (LoomDocument.update() genérico) — não duplicar aqui.
    logger.info('Active tile updated', { id, name: updated.name });

    res.json(updated);
  } catch (err: any) {
    logger.error('PUT /api/tiles/:id failed', { error: err.message, id });
    res.status(500).json({ error: 'Failed to update tile' });
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/tiles/:id — remove a tile
// ---------------------------------------------------------------------------
tilesRouter.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const existing = await TilesDocument.findById(id);
    if (!existing) return res.status(404).json({ error: 'Tile not found' });

    const result = await TilesDocument.delete(id);
    if (result.error) return res.status(400).json({ error: result.error });

    // Signal.broadcast('tile.deleted', ...) já sai de dentro de TilesDocument.delete()
    // (LoomDocument.delete() genérico) — não duplicar aqui.
    logger.info('Active tile deleted', { id, name: existing.name });

    res.json({ success: true, id });
  } catch (err: any) {
    logger.error('DELETE /api/tiles/:id failed', { error: err.message, id });
    res.status(500).json({ error: 'Failed to delete tile' });
  }
});
