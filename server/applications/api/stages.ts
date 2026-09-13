/**
 * core/src/api/stages.ts
 * REST routes for Stage management.
 * Mounted at /api/stages in core/src/index.ts
 */

import { Router } from 'express';

import { StagesDocument } from '../schemas/stages.schema.js';
import { CastsDocument } from '../schemas/cast.schema.js';
import { LevelsDocument } from '../schemas/levels.schema.js';
import { Signal } from '../signals/index.js';
import logger from '../utils/logger.js';
import { requireAuth, requireWorldMatch } from '../middleware/auth.js';
import { requireGM } from '../middleware/permissions.js';

export const stagesRouter = Router();
stagesRouter.use(requireAuth, requireWorldMatch);

/** Custom miniatures (`stage.thumbnailUrl`) */
function resolveThumbUrl(stage: any, levels: any[]): string {
  if (stage.thumbnailUrl) return stage.thumbnailUrl;
  const initialLevelId = stage.flags?.initialLevel;
  const initialLevel = initialLevelId && levels.find((l: any) => l.id === initialLevelId);
  return (initialLevel || levels[0])?.backgroundUrl || '';
}

// GET /api/stages — list all stages
stagesRouter.get('/', async (_req, res) => {
  try {
    const stages = await StagesDocument.find({ orderBy: 'createdAt', orderDir: 'asc' });

    const enrichedStages = await Promise.all(stages.map(async (stage) => {
      const levels = await LevelsDocument.find({ stageId: stage.id, orderBy: 'bottomElevation', orderDir: 'asc' });
      const thumbUrl = resolveThumbUrl(stage, levels);
      return {
        ...stage,
        levels,
        thumbUrl,
        bgUrl: thumbUrl
      };
    }));

    res.json(enrichedStages);
  } catch (err: any) {
    logger.error('GET /api/stages failed', { error: err.message });
    res.status(500).json({ error: 'Failed to retrieve stages' });
  }
});

// GET /api/stages/active — returns the currently active stage
stagesRouter.get('/active', async (_req, res) => {
  try {
    const stage = await StagesDocument.findOne<any>({ isActive: true });
    if (!stage) return res.status(404).json({ error: 'No active stage found' });

    // Include cast members placed on this stage
    // Include cast members placed on this stage
    const tokens = await CastsDocument.find({ stageId: stage.id, columns: ['id', 'name', 'x', 'y', 'colorHex', 'kind'] });

    const levels = await LevelsDocument.find({ stageId: stage.id, orderBy: 'bottomElevation', orderDir: 'asc' });
    const thumbUrl = resolveThumbUrl(stage, levels);

    res.json({ ...stage, tokens, levels, thumbUrl, bgUrl: thumbUrl });
  } catch (err: any) {
    logger.error('GET /api/stages/active failed', { error: err.message });
    res.status(500).json({ error: 'Failed to retrieve active stage' });
  }
});

// GET /api/stages/:id — get a single stage
stagesRouter.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const stage = await StagesDocument.findById(id);
    if (!stage) return res.status(404).json({ error: 'Stage not found' });

    const levels = await LevelsDocument.find({ stageId: stage.id, orderBy: 'bottomElevation', orderDir: 'asc' });
    const thumbUrl = resolveThumbUrl(stage, levels);

    res.json({ ...stage, levels, thumbUrl, bgUrl: thumbUrl });
  } catch (err: any) {
    logger.error('GET /api/stages/:id failed', { error: err.message, id });
    res.status(500).json({ error: 'Failed to retrieve stage' });
  }
});

// POST /api/stages — create a new stage
stagesRouter.post('/', requireGM, async (req, res) => {
  const { worldId, name, bgUrl, backgroundColor, gridSize, gridColor, navigationName, showInNavigation, darknessLevel, weatherEffect, gridDistance, gridUnit, gridStyle, gridOpacity, gridType, padding, offsetX, offsetY, ambientPlaylistId, width, height } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Name is required' });
  }
  try {
    const newStage: Record<string, any> = {
      name: name.trim(), isActive: false,
      gridSize: gridSize ?? 50,
      gridColor: gridColor ?? '#ffffff',
    };
    if (worldId !== undefined) newStage.worldId = worldId;
    if (navigationName !== undefined) newStage.navigationName = navigationName;
    if (showInNavigation !== undefined) newStage.showInNavigation = showInNavigation;
    if (darknessLevel !== undefined) newStage.darknessLevel = darknessLevel;
    if (weatherEffect !== undefined) newStage.weatherEffect = weatherEffect;
    if (gridDistance !== undefined) newStage.gridDistance = gridDistance;
    if (gridUnit !== undefined) newStage.gridUnit = gridUnit;
    if (gridStyle !== undefined) newStage.gridStyle = gridStyle;
    if (gridOpacity !== undefined) newStage.gridOpacity = gridOpacity;
    if (gridType !== undefined) newStage.gridType = gridType;
    if (padding !== undefined) newStage.padding = padding;
    if (offsetX !== undefined) newStage.offsetX = offsetX;
    if (offsetY !== undefined) newStage.offsetY = offsetY;
    if (ambientPlaylistId !== undefined) newStage.ambientPlaylistId = ambientPlaylistId;
    if (width !== undefined) newStage.width = width;
    if (height !== undefined) newStage.height = height;

    const result = await StagesDocument.create(newStage);
    if (result.error) return res.status(400).json({ error: result.error });

    const levelResult = await LevelsDocument.create({
      stageId: result.data.id,
      name: 'Térreo',
      bottomElevation: 0,
      topElevation: 20,
      backgroundUrl: bgUrl ?? '',
      backgroundColor: backgroundColor ?? '#0d0d0f',
    });
    if (levelResult.error) {
      logger.warn('POST /api/stages — default level creation failed', { error: levelResult.error, stageId: result.data.id });
    }

    res.status(201).json({ ...result.data, levels: levelResult.data ? [levelResult.data] : [] });
  } catch (err: any) {
    logger.error('POST /api/stages failed', { error: err.message });
    res.status(500).json({ error: 'Failed to create stage' });
  }
});

const STAGE_FIELDS = ['name', 'gridSize', 'gridColor',
  'navigationName', 'showInNavigation', 'darknessLevel', 'weatherEffect',
  'gridDistance', 'gridUnit', 'gridStyle', 'gridOpacity', 'gridType', 'padding', 'offsetX', 'offsetY',
  'ambientPlaylistId', 'width', 'height', 'flags', 'folderId', 'thumbnailUrl',
  'transitionType', 'transitionDuration', 'sceneType', 'parentStageId', 'journalId', 'journalPageId',
  'tokenVision', 'fogExplorationMode', 'fogExploredColor', 'fogUnexploredColor', 'fogImage',
  'globalLight', 'globalLightThreshold'];

// PUT /api/stages/:id — update stage configuration
stagesRouter.put('/:id', requireGM, async (req, res) => {
  const { id } = req.params;

  try {
    const updates: Record<string, any> = {};
    for (const field of STAGE_FIELDS) {
      if (req.body[field] !== undefined) {
        if (field === 'name') updates.name = String(req.body.name).trim();
        else if (field === 'showInNavigation') updates.showInNavigation = req.body.showInNavigation;
        else if (field === 'darknessLevel') updates.darknessLevel = req.body.darknessLevel;
        else updates[field] = req.body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields provided for update.' });
    }

    const result = await StagesDocument.update(id, updates);
    if (result.error) return res.status(result.error === 'Not found' ? 404 : 400).json({ error: result.error });
    const updated = result.data;

    if (updates.darknessLevel !== undefined) {
      Signal.broadcast('stage.darkness', { stageId: id, darknessLevel: (updated as any).darknessLevel, duration: 1000 });
    }
    logger.info('Stage updated', { id, updates });

    res.json(updated);
  } catch (err: any) {
    logger.error('PUT /api/stages/:id failed', { error: err.message, id });
    res.status(500).json({ error: 'Failed to update stage' });
  }
});

// DELETE /api/stages/:id — delete a stage
stagesRouter.delete('/:id', requireGM, async (req, res) => {
  const { id } = req.params;
  try {
    const existing = await StagesDocument.findById<any>(id);
    if (!existing) return res.status(404).json({ error: 'Stage not found' });

    await StagesDocument.delete(id);

    logger.info('Stage deleted', { id, name: existing.name });

    res.json({ success: true, id });
  } catch (err: any) {
    logger.error('DELETE /api/stages/:id failed', { error: err.message, id });
    res.status(500).json({ error: 'Failed to delete stage' });
  }
});

// POST /api/stages/:id/activate — switch the active stage + WS broadcast
stagesRouter.post('/:id/activate', requireGM, async (req, res) => {
  const { id } = req.params;
  const { worldId } = req.body;
  try {
    // Deactivate all active stages via LoomDocument to trigger broadcast
    const query = worldId ? { worldId, isActive: true } : { isActive: true };
    const activeStages = await StagesDocument.find(query);
    for (const activeStage of activeStages) {
      if (activeStage.id !== id) {
        await StagesDocument.update(activeStage.id, { isActive: false });
      }
    }
    const result = await StagesDocument.update(id, { isActive: true });
    if (result.error) return res.status(404).json({ error: result.error });
    const stage = result.data as any;

    const levels = await LevelsDocument.find({ stageId: stage.id, orderBy: 'bottomElevation', orderDir: 'asc' });
    const initialLevelId = stage.flags?.initialLevel;
    const defaultLevel = (initialLevelId && levels.find((l: any) => l.id === initialLevelId)) || levels[0];
    const activationPayload = {
      stageId: stage.id,
      id: stage.id,
      // Without this, `CanvasManager.applyStage()` does not swap `this.levels` (it only swaps
      // when the payload brings a non-empty array) and continues with the levels of the
      // PREVIOUS scene — the logic of "preserve active level if belongs to this scene"
      // then finds the old currentLevelId in this   old list and re-applies the
      // backgroundUrl of the previous scene, locking the wrong map on screen.
      levels,
      levelId: defaultLevel?.id,
      bgUrl: defaultLevel?.backgroundUrl || '',
      backgroundColor: defaultLevel?.backgroundColor || '#0d0d0f',
      gridSize: stage.gridSize || 64,
      gridColor: stage.gridColor || '#ffffff',
      width: stage.width || 3000,
      height: stage.height || 3000,
      ambientPlaylistId: stage.ambientPlaylistId || '',
      darknessLevel: stage.darknessLevel ?? 0,
      weatherEffect: stage.weatherEffect || 'none',
      transitionType: stage.transitionType || 'none',
      transitionDuration: stage.transitionDuration ?? 1500,
      flags: stage.flags || {},
    };

    Signal.broadcast('stage.activated', activationPayload);
    logger.info('Stage activated', activationPayload);

    res.json(stage);
  } catch (err: any) {
    logger.error('POST /api/stages/:id/activate failed', { error: err.message, id });
    res.status(500).json({ error: 'Failed to activate stage' });
  }
});
