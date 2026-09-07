/**
 * core/src/api/levels.ts
 * REST routes for Level management (Andares de uma Stage).
 * Mounted at /api/levels (flat CRUD) and /api/stages (sub-resource).
 */

import { Router } from 'express';

import { LevelsDocument } from '../schemas/levels.schema.js';
import logger from '../utils/logger.js';
import { requireAuth, requireWorldMatch } from '../middleware/auth.js';
import { requireGM } from '../middleware/permissions.js';
import { Signal } from '../signals/index.js';

const LEVEL_FIELDS = ['name', 'bottomElevation', 'topElevation', 'backgroundUrl', 'backgroundColor', 'flags'];

/**
 * Avisa os clientes que a lista de andares desta cena mudou.
 *
 * O CRUD do Document ja emite `levels.created` / `.updated` / `.deleted`, mas
 * Signal e interno ao servidor: virar WebSocket exige um relay explicito no
 * `index.ts`, e nenhum foi criado quando os andares entraram. Resultado: o
 * andar novo so aparecia na barra de cenas depois de recarregar a pagina, e
 * jogador nenhum via a mudanca.
 *
 * Emitimos daqui, e nao do Document, porque so aqui o `stageId` esta garantido
 * — no delete o payload do Document traz so o id da linha apagada.
 */
function broadcastLevelsChanged(stageId: string): void {
  Signal.broadcast('levels.changed', { stageId });
}

// ── Flat CRUD — /api/levels ──────────────────────────────────────────────────

export const levelsRouter = Router();
levelsRouter.use(requireAuth, requireWorldMatch);

// GET /api/levels — list all levels (optional ?stageId=)
levelsRouter.get('/', async (req: any, res) => {
  try {
    const filter: Record<string, any> = { orderBy: 'bottomElevation', orderDir: 'asc' };
    if (req.query.stageId !== undefined) filter.stageId = req.query.stageId;
    const levels = await LevelsDocument.find(filter);
    res.json(levels);
  } catch (err: any) {
    logger.error('GET /api/levels failed', { error: err.message });
    res.status(500).json({ error: 'Failed to retrieve levels' });
  }
});

// GET /api/levels/:id — get a single level
levelsRouter.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const level = await LevelsDocument.findById(id);
    if (!level) return res.status(404).json({ error: 'Level not found' });
    res.json(level);
  } catch (err: any) {
    logger.error('GET /api/levels/:id failed', { error: err.message, id });
    res.status(500).json({ error: 'Failed to retrieve level' });
  }
});

/**
 * Faixa de elevacao para um andar novo, empilhando sobre o mais alto da cena.
 *
 * Sem isto todo andar nascia 0..20 — identico ao Terreo. Tokens e tiles sao
 * filtrados por elevacao (Z), nao por levelId, entao andares com a MESMA faixa
 * sao indistinguiveis: um token em elevation 0 aparecia simultaneamente em
 * todos, "onipresente".
 */
async function nextElevationRange(stageId: string): Promise<{ bottom: number; top: number }> {
  const existing = await LevelsDocument.find({ stageId, orderBy: 'topElevation', orderDir: 'desc' }) as any[];
  const highest = existing?.[0];
  const bottom = highest ? Number(highest.topElevation ?? 0) : 0;
  return { bottom, top: bottom + 20 };
}

// POST /api/levels — create a new level
levelsRouter.post('/', requireGM, async (req, res) => {
  const { stageId, name, bottomElevation, topElevation, backgroundUrl, backgroundColor, flags } = req.body;
  if (!stageId) {
    return res.status(400).json({ error: 'stageId is required' });
  }
  try {
    const range = await nextElevationRange(stageId);
    const result = await LevelsDocument.create({
      stageId,
      name: name ?? 'Térreo',
      bottomElevation: bottomElevation ?? range.bottom,
      topElevation: topElevation ?? range.top,
      backgroundUrl: backgroundUrl ?? '',
      backgroundColor: backgroundColor ?? '#0d0d0f',
      flags: flags ?? {},
    });
    if (result.error) return res.status(400).json({ error: result.error });
    logger.info('Level created', { id: result.data.id, stageId, name: result.data.name });
    res.status(201).json(result.data);
  } catch (err: any) {
    logger.error('POST /api/levels failed', { error: err.message });
    res.status(500).json({ error: 'Failed to create level' });
  }
});

// PUT /api/levels/:id — update level configuration
levelsRouter.put('/:id', requireGM, async (req, res) => {
  const { id } = req.params;
  try {
    const updates: Record<string, any> = {};
    for (const field of LEVEL_FIELDS) {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    }
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields provided for update.' });
    }

    const result = await LevelsDocument.update(id, updates);
    if (result.error) return res.status(result.error === 'Not found' ? 404 : 400).json({ error: result.error });
    logger.info('Level updated', { id, updates });
    res.json(result.data);
  } catch (err: any) {
    logger.error('PUT /api/levels/:id failed', { error: err.message, id });
    res.status(500).json({ error: 'Failed to update level' });
  }
});

// DELETE /api/levels/:id — delete a level
levelsRouter.delete('/:id', requireGM, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await LevelsDocument.delete(id);
    if (result.error) return res.status(result.error === 'Not found' ? 404 : 400).json({ error: result.error });
    logger.info('Level deleted', { id });
    res.json({ success: true, id });
  } catch (err: any) {
    logger.error('DELETE /api/levels/:id failed', { error: err.message, id });
    res.status(500).json({ error: 'Failed to delete level' });
  }
});

// ── Stage sub-resource — /api/stages/:stageId/levels ─────────────────────────

export const stageLevelsRouter = Router();
stageLevelsRouter.use(requireAuth, requireWorldMatch);

stageLevelsRouter.get('/:stageId/levels', async (req: any, res) => {
  try {
    const rows = await LevelsDocument.find({ stageId: req.params.stageId, orderBy: 'bottomElevation', orderDir: 'asc' });
    res.json(rows);
  } catch (err: any) {
    logger.error('GET /api/stages/:stageId/levels failed', { error: err.message });
    res.status(500).json({ error: 'Failed to retrieve levels' });
  }
});

stageLevelsRouter.post('/:stageId/levels', async (req: any, res) => {
  const { name, bottomElevation, topElevation, backgroundUrl, backgroundColor, flags } = req.body;
  try {
    const range = await nextElevationRange(req.params.stageId);
    const result = await LevelsDocument.create({
      stageId: req.params.stageId,
      name: name ?? 'Térreo',
      bottomElevation: bottomElevation ?? range.bottom,
      topElevation: topElevation ?? range.top,
      backgroundUrl: backgroundUrl ?? '',
      backgroundColor: backgroundColor ?? '#0d0d0f',
      flags: flags ?? {},
    });
    if (result.error) return res.status(400).json({ error: result.error });
    logger.info('Level created', { id: result.data.id, stageId: req.params.stageId, name: result.data.name });
    broadcastLevelsChanged(req.params.stageId);
    res.status(201).json(result.data);
  } catch (err: any) {
    logger.error('POST /api/stages/:stageId/levels failed', { error: err.message });
    res.status(500).json({ error: 'Failed to create level' });
  }
});

stageLevelsRouter.put('/:stageId/levels/:id', async (req: any, res) => {
  const { id } = req.params;
  try {
    const updates: Record<string, any> = {};
    for (const field of LEVEL_FIELDS) {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    }
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields provided for update.' });
    }

    const result = await LevelsDocument.update(id, updates);
    if (result.error) return res.status(404).json({ error: result.error });
    logger.info('Level updated', { id, stageId: req.params.stageId, updates });
    broadcastLevelsChanged(req.params.stageId);
    res.json(result.data);
  } catch (err: any) {
    logger.error('PUT /api/stages/:stageId/levels/:id failed', { error: err.message, id });
    res.status(500).json({ error: 'Failed to update level' });
  }
});

stageLevelsRouter.delete('/:stageId/levels/:id', async (req: any, res) => {
  const { id } = req.params;
  try {
    const result = await LevelsDocument.delete(id);
    if (result.error) return res.status(404).json({ error: result.error });
    logger.info('Level deleted', { id, stageId: req.params.stageId });
    broadcastLevelsChanged(req.params.stageId);
    res.json({ success: true, id });
  } catch (err: any) {
    logger.error('DELETE /api/stages/:stageId/levels/:id failed', { error: err.message, id });
    res.status(500).json({ error: 'Failed to delete level' });
  }
});
