import { Router } from 'express';
import { randomUUID } from 'crypto';
import { CastsDocument } from '../schemas/cast.schema.js';
import { ActorsDocument } from '../schemas/actors.schema.js';
import { Signal } from '../signals/index.js';
import logger from '../utils/logger.js';
import { getUserId, buildOwnership } from '../middleware/permissions.js';
import { requireAuth, requireWorldMatch } from '../middleware/auth.js';
import { db } from '../database/db.js';

export const castRouter = Router();
castRouter.use(requireAuth, requireWorldMatch);

function statusFor(error: string): number {
  if (error === 'Not found') return 404;
  return 403;
}

castRouter.get('/', async (req, res) => {
  try {
    const filter: Record<string, any> = { orderBy: 'createdAt', orderDir: 'asc' };
    if (req.query.limit) filter.limit = req.query.limit;
    if (req.query.offset) filter.offset = req.query.offset;
    const rows = await CastsDocument.find(filter);
    res.json(rows);
  } catch (err: any) {
    logger.error('GET /api/cast failed', { error: err.message });
    res.status(500).json({ error: 'Failed to retrieve cast members' });
  }
});

castRouter.get('/:id', async (req, res) => {
  try {
    const row = await CastsDocument.findById(req.params.id);
    if (!row) return res.status(404).json({ error: 'Cast member not found' });
    res.json(row);
  } catch (err: any) {
    logger.error('GET /api/cast/:id failed', { error: err.message, id: req.params.id });
    res.status(500).json({ error: 'Failed to retrieve cast member' });
  }
});

castRouter.post('/', async (req, res) => {
  const {
    name,
    kind = 'adventurer',
    traits = {},
    colorHex,
    x = 100,
    y = 100,
    avatarUrl = '',
    ringColor = colorHex ?? '#e74c3c',
    ringUrl = '',
    ringEffect = 'none',
    ringScale = 1.6,
    shape = 'circle',
    effects = [],
    statusMarkers = [],
    systemData = {},
    actorId = '',
    isLinked = false,
    folderId = '',
    elevation = 0,
    levelId = '',
    bar1,
    bar2,
    displayBars = 20,
  } = req.body;
  let stageId = req.body.stageId;
  const worldId = (req as any).auth?.worldId || req.body.worldId;

  if (!name || typeof name !== 'string' || name.trim() === '') {
    return res.status(400).json({ error: 'Field "name" is required and must be a non-empty string.' });
  }

  if (!stageId) {
    const activeStage = worldId ? await db('stages').where({ worldId, isActive: true }).first() : null;
    stageId = activeStage?.id || 'stage-1';
  }

  const color = colorHex ?? `#${Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0')}`;
  const userId = getUserId(req);
  const ownership = userId ? buildOwnership(userId) : {};

  let finalSystemData = systemData;
  let finalTraits = traits;
  let finalKind = kind;
  let finalName = name.trim();
  let finalAvatarUrl = avatarUrl;
  let finalRingUrl = ringUrl;
  let finalRingEffect = ringEffect;
  let finalRingScale = ringScale;
  let finalRingColor = ringColor;
  let finalShape = shape;

  if (actorId) {
    const actor = await ActorsDocument.findById<any>(actorId);
    if (actor) {
      const actorData = actor.systemData || {};
      const proto = actorData.prototypeToken || {};
      if (isLinked) {
        finalSystemData = actorData;
        finalName = actor.name;
        finalKind = actor.type;
        finalAvatarUrl = actor.avatarUrl || avatarUrl;
      } else {
        finalSystemData = { ...actorData };
        if (Object.keys(traits).length === 0) {
          finalTraits = { hp: actorData.hp?.value ?? 10 };
        }
      }
      if (proto.ringUrl && !req.body.ringUrl) finalRingUrl = proto.ringUrl;
      if (proto.ringEffect && !req.body.ringEffect) finalRingEffect = proto.ringEffect;
      if (proto.ringScale && !req.body.ringScale) finalRingScale = proto.ringScale;
      if (proto.ringColor && !req.body.ringColor) finalRingColor = proto.ringColor;
      if (proto.shape && !req.body.shape) finalShape = proto.shape;
    }
  }

  try {
    const result = await CastsDocument.create({
      id: `member-${randomUUID()}`,
      name: finalName,
      kind: String(finalKind).trim(),
      traits: finalTraits,
      x, y,
      colorHex: color,
      avatarUrl: finalAvatarUrl,
      ringColor: finalRingColor ?? color,
      ringUrl: finalRingUrl,
      ringEffect: finalRingEffect,
      ringScale: finalRingScale,
      shape: finalShape,
      effects,
      statusMarkers,
      systemData: finalSystemData,
      actorId,
      isLinked,
      folderId,
      ownership,
      stageId,
      worldId,
      elevation,
      levelId,
      bar1,
      bar2,
      displayBars,
    });
    if (result.error) return res.status(400).json({ error: result.error });
    const created = result.data;

    logger.info('Cast member created', { id: created.id, name: created.name, kind: created.kind, actorId, isLinked });

    res.status(201).json(created);
  } catch (err: any) {
    logger.error('POST /api/cast failed', { error: err.message, name });
    res.status(500).json({ error: 'Failed to create cast member' });
  }
});

castRouter.get('/by-actor/:actorId', async (req, res) => {
  try {
    const tokens = await CastsDocument.find({ actorId: req.params.actorId });
    res.json(tokens);
  } catch (err: any) {
    logger.error('GET /api/cast/by-actor/:actorId failed', { error: err.message });
    res.status(500).json({ error: 'Failed to retrieve linked tokens.' });
  }
});

castRouter.post('/:actorId/propagate', async (req, res) => {
  try {
    const actor = await ActorsDocument.findById<any>(req.params.actorId);
    if (!actor) return res.status(404).json({ error: 'Actor not found.' });
    const tokens = await CastsDocument.find({ actorId: req.params.actorId, isLinked: true });
    for (const token of tokens) {
      // Signal.broadcast('cast.updated', ...) já sai de dentro de CastsDocument.update()
      // (LoomDocument.update() genérico) — não duplicar aqui.
      await CastsDocument.update(token.id, {
        name: actor.name,
        systemData: actor.systemData,
        avatarUrl: actor.avatarUrl || token.avatarUrl,
      });
    }
    res.json({ success: true, propagatedCount: tokens.length });
  } catch (err: any) {
    logger.error('POST /api/cast/:actorId/propagate failed', { error: err.message });
    res.status(500).json({ error: 'Failed to propagate actor changes.' });
  }
});

castRouter.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { name, kind, traits, colorHex, x, y, avatarUrl, ringColor, shape, effects, statusMarkers, systemData, folderId, stageId, elevation, levelId, locked, hidden, movementAction, targetedBy, tintColor, opacity, rotation, scale, sightEnabled, sightRange, sightAngle, sightMode, detectionModes, lightDimRange, lightBrightRange, lightColor, lightAnimation, barGridSize } = req.body;

  const updates: Record<string, any> = {};
  if (name     !== undefined) updates.name     = String(name).trim();
  if (kind     !== undefined) updates.kind     = String(kind).trim();
  if (traits   !== undefined) updates.traits   = traits;
  if (colorHex !== undefined) updates.colorHex = colorHex;
  if (x        !== undefined) updates.x        = x;
  if (y        !== undefined) updates.y        = y;
  if (avatarUrl !== undefined) updates.avatarUrl = avatarUrl;
  if (ringColor !== undefined) updates.ringColor = ringColor;
  if (shape     !== undefined) updates.shape     = shape;
  if (effects   !== undefined) updates.effects   = effects;
  if (statusMarkers !== undefined) updates.statusMarkers = statusMarkers;
  if (systemData    !== undefined) updates.systemData    = systemData;
  if (folderId      !== undefined) updates.folderId      = folderId;
  if (stageId       !== undefined) updates.stageId       = stageId;
  if (elevation      !== undefined) updates.elevation      = elevation;
  if (levelId        !== undefined) updates.levelId        = levelId;
  if (locked         !== undefined) updates.locked         = !!locked;
  if (hidden         !== undefined) updates.hidden         = !!hidden;
  if (movementAction !== undefined) updates.movementAction = movementAction;
  if (targetedBy     !== undefined) updates.targetedBy     = targetedBy;
  if (tintColor      !== undefined) updates.tintColor      = tintColor;
  if (opacity        !== undefined) updates.opacity        = Number(opacity);
  if (rotation       !== undefined) updates.rotation       = Number(rotation);
  if (scale          !== undefined) updates.scale          = Number(scale);
  if (sightEnabled   !== undefined) updates.sightEnabled   = !!sightEnabled;
  if (sightRange     !== undefined) updates.sightRange     = Number(sightRange);
  if (sightAngle     !== undefined) updates.sightAngle     = Number(sightAngle);
  if (sightMode      !== undefined) updates.sightMode      = String(sightMode);
  if (detectionModes !== undefined) updates.detectionModes = detectionModes;
  if (lightDimRange  !== undefined) updates.lightDimRange  = Number(lightDimRange);
  if (lightBrightRange !== undefined) updates.lightBrightRange = Number(lightBrightRange);
  if (lightColor     !== undefined) updates.lightColor     = lightColor;
  if (lightAnimation !== undefined) updates.lightAnimation = lightAnimation;
  if (barGridSize    !== undefined) updates.barGridSize    = Number(barGridSize);
  if (req.body.bar1  !== undefined) updates.bar1           = req.body.bar1;
  if (req.body.bar2  !== undefined) updates.bar2           = req.body.bar2;
  if (req.body.displayBars !== undefined) updates.displayBars = Number(req.body.displayBars);

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'No valid fields provided for update.' });
  }

  try {
    const result = await CastsDocument.update(id, updates, { req });
    if (result.error) return res.status(statusFor(result.error)).json({ error: result.error });

    // Signal.broadcast('cast.updated', ...) já sai de dentro de CastsDocument.update()
    // (LoomDocument.update() genérico) — não duplicar aqui.
    logger.info('Cast member updated', { id, updates });

    res.json(result.data);
  } catch (err: any) {
    logger.error('PUT /api/cast/:id failed', { error: err.message, id });
    res.status(500).json({ error: 'Failed to update cast member' });
  }
});

castRouter.put('/:id/token', async (req, res) => {
  const { id } = req.params;
  const { avatarUrl, ringColor, ringUrl, ringEffect, ringScale, shape, effects, statusMarkers, systemData, elevation, levelId, locked, hidden, movementAction, targetedBy, tintColor, opacity, rotation, scale, sightEnabled, sightRange, sightAngle, sightMode, detectionModes, lightDimRange, lightBrightRange, lightColor, lightAnimation, barGridSize, bar1, bar2, displayBars } = req.body;

  const updates: Record<string, any> = {};
  if (avatarUrl !== undefined) updates.avatarUrl = avatarUrl;
  if (ringColor !== undefined) updates.ringColor = ringColor;
  if (ringUrl   !== undefined) updates.ringUrl   = ringUrl;
  if (ringEffect !== undefined) updates.ringEffect = ringEffect;
  if (ringScale !== undefined) updates.ringScale = Number(ringScale);
  if (shape     !== undefined) updates.shape     = shape;
  if (effects   !== undefined) updates.effects   = effects;
  if (statusMarkers !== undefined) updates.statusMarkers = statusMarkers;
  if (systemData !== undefined) updates.systemData = systemData;
  if (elevation      !== undefined) updates.elevation      = elevation;
  if (levelId        !== undefined) updates.levelId        = levelId;
  if (locked         !== undefined) updates.locked         = !!locked;
  if (hidden         !== undefined) updates.hidden         = !!hidden;
  if (movementAction !== undefined) updates.movementAction = movementAction;
  if (targetedBy     !== undefined) updates.targetedBy     = targetedBy;
  if (tintColor      !== undefined) updates.tintColor      = tintColor;
  if (opacity        !== undefined) updates.opacity        = Number(opacity);
  if (rotation       !== undefined) updates.rotation       = Number(rotation);
  if (scale          !== undefined) updates.scale          = Number(scale);
  if (sightEnabled   !== undefined) updates.sightEnabled   = !!sightEnabled;
  if (sightRange     !== undefined) updates.sightRange     = Number(sightRange);
  if (sightAngle     !== undefined) updates.sightAngle     = Number(sightAngle);
  if (sightMode      !== undefined) updates.sightMode      = String(sightMode);
  if (detectionModes !== undefined) updates.detectionModes = detectionModes;
  if (lightDimRange  !== undefined) updates.lightDimRange  = Number(lightDimRange);
  if (lightBrightRange !== undefined) updates.lightBrightRange = Number(lightBrightRange);
  if (lightColor     !== undefined) updates.lightColor     = lightColor;
  if (lightAnimation !== undefined) updates.lightAnimation = lightAnimation;
  if (barGridSize    !== undefined) updates.barGridSize    = Number(barGridSize);
  if (bar1           !== undefined) updates.bar1           = bar1;
  if (bar2           !== undefined) updates.bar2           = bar2;
  if (displayBars    !== undefined) updates.displayBars    = Number(displayBars);

  try {
    const result = await CastsDocument.update(id, updates, { req });
    if (result.error) return res.status(statusFor(result.error)).json({ error: result.error });

    // Signal.broadcast('cast.updated', ...) já sai de dentro de CastsDocument.update()
    // (LoomDocument.update() genérico) — não duplicar aqui.
    logger.info('Cast token properties updated', { id, updates });

    res.json(result.data);
  } catch (err: any) {
    logger.error('PUT /api/cast/:id/token failed', { error: err.message, id });
    res.status(500).json({ error: 'Failed to update cast token properties' });
  }
});

// Target é uma anotação por-jogador (quem tá mirando o quê), não uma edição
// do token — qualquer jogador autenticado pode marcar/desmarcar alvo em
// qualquer token visível, independente de dono/permissão de edição.
castRouter.put('/:id/target', async (req, res) => {
  const { id } = req.params;
  const { targetedBy } = req.body;
  if (!Array.isArray(targetedBy)) {
    return res.status(400).json({ error: 'targetedBy must be an array' });
  }

  try {
    const result = await CastsDocument.update(id, { targetedBy });
    if (result.error) return res.status(statusFor(result.error)).json({ error: result.error });

    // Signal.broadcast('cast.updated', ...) já sai de dentro de CastsDocument.update()
    // (LoomDocument.update() genérico) — não duplicar aqui. token.target é evento à
    // parte (anotação de "quem tá mirando", não uma mudança do documento em si).
    Signal.broadcast('token.target', { castId: id, targetedBy });
    res.json(result.data);
  } catch (err: any) {
    logger.error('PUT /api/cast/:id/target failed', { error: err.message, id });
    res.status(500).json({ error: 'Failed to update target' });
  }
});

castRouter.post('/:id/position', async (req, res) => {
  const { id } = req.params;
  const { x, y } = req.body;
  try {
    const cast = await CastsDocument.findById(id);
    if (!cast) return res.status(404).json({ error: 'Cast member not found' });
    // Signal.broadcast('cast.updated', ...) já sai de dentro de CastsDocument.update()
    // (LoomDocument.update() genérico) — não duplicar aqui.
    await CastsDocument.update(id, { x, y }, { req });
    res.json({ success: true });
  } catch (error: any) {
    logger.error('Failed to update cast member position via API', { error: error.message, id, x, y });
    res.status(500).json({ error: 'Failed to update cast member position' });
  }
});

castRouter.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const existing = await CastsDocument.findById<any>(id);
    if (!existing) return res.status(404).json({ error: 'Cast member not found' });

    const result = await CastsDocument.delete(id, { req });
    if (result.error) return res.status(statusFor(result.error)).json({ error: result.error });

    // Signal.broadcast('cast.deleted', ...) já é disparado dentro de
    // CastsDocument.delete() (LoomDocument.delete() genérico) — chamar de novo
    // aqui duplicava o evento no WS (client recebia cast.deleted 2x por delete).
    logger.info('Cast member deleted', { id, name: existing.name });

    res.json({ success: true, id });
  } catch (err: any) {
    logger.error('DELETE /api/cast/:id failed', { error: err.message, id });
    res.status(500).json({ error: 'Failed to delete cast member' });
  }
});
