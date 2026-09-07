import { Router } from 'express';
import { randomUUID } from 'crypto';
import { ActorsDocument } from '../schemas/actors.schema.js';
import { ItemsDocument } from '../schemas/items.schema.js';
import { SystemRegistry } from '../systems/system-registry.js';
import { getUserId, isGM, getPermLevel } from '../middleware/permissions.js';
import logger from '../utils/logger.js';
import { requireAuth, requireWorldMatch } from '../middleware/auth.js';
import { populateChildren, deleteChildren } from '../lib/embedded-docs.js';
import { prepareActor, redactActorForLimited } from '../lib/actor-prepare.js';
import { Signal } from '../signals/index.js';
import { WorldsDocument } from '../schemas/worlds.schema.js';
import { getDataRoot } from '../database/db.js';
import path from 'path';
import fs from 'fs';

export const actorsRouter = Router();
actorsRouter.use(requireAuth, requireWorldMatch);

// Tipos nativos sempre aceitos (fallback do rpg-generic).
const BASE_ACTOR_TYPES = ['character', 'npc'];

// Rulesets não rodam código no servidor (ver addons/loader.ts) — por isso a lista de tipos
// extras do sistema vem do `ruleset.json` (JSON estático, "actorTypes": [...]), nunca de
// `client.js`/`defineSystem()`. Mesmo padrão de `getRulesetItemTypes()` em items.ts.
function getRulesetActorTypes(systemId: string): string[] {
  try {
    const manifestPath = path.join(getDataRoot(), 'marketplace', 'rulesets', systemId, 'ruleset.json');
    if (!fs.existsSync(manifestPath)) return [];
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    return Array.isArray(manifest.actorTypes) ? manifest.actorTypes : [];
  } catch {
    return [];
  }
}

// Mesmo padrao de getRulesetActorTypes acima — campo opcional "limitedFields"
// (array de chaves top-level de systemData) que o ruleset declara pra
// aparecer na visao Limitado (nivel 1). Sem manifesto ou sem o campo, nivel
// 1 nao ve nada de systemData, so nome/retrato/tipo.
export function getRulesetLimitedFields(systemId: string): string[] {
  try {
    const manifestPath = path.join(getDataRoot(), 'marketplace', 'rulesets', systemId, 'ruleset.json');
    if (!fs.existsSync(manifestPath)) return [];
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    return Array.isArray(manifest.limitedFields) ? manifest.limitedFields : [];
  } catch {
    return [];
  }
}

async function isValidActorType(type: string, worldId: string): Promise<boolean> {
  if (BASE_ACTOR_TYPES.includes(type)) return true;
  const world = await WorldsDocument.findById<any>(worldId);
  if (!world?.system) return false;
  return getRulesetActorTypes(world.system).includes(type);
}

/** Tipo default de ator novo: o primeiro que o ruleset declara; `character` só quando o
 *  mundo não tem ruleset com `actorTypes`. Antes era `character` fixo, o que criava ator de
 *  um tipo que o sistema não conhece e, por tabela, sem os dados de sistema corretos. */
async function defaultActorType(worldId: string): Promise<string> {
  const world = await WorldsDocument.findById<any>(worldId);
  if (!world?.system) return 'character';
  return getRulesetActorTypes(world.system)[0] ?? 'character';
}

actorsRouter.get('/', async (req, res) => {
  try {
    const filter: Record<string, any> = {};
    if (req.query.worldId) filter.worldId = req.query.worldId;
    if (req.query.limit) filter.limit = req.query.limit;
    if (req.query.offset) filter.offset = req.query.offset;
    let rows = await ActorsDocument.find(filter);
    const userId = getUserId(req);
    const gm = isGM(req);
    if (!gm && userId) {
      rows = rows.filter(r => getPermLevel(r.ownership, 0, userId) >= 1);
    }
    const populated = req.query.populate === 'true'
      ? await Promise.all(rows.map(r => populateChildren(r, ActorsDocument.schema)))
      : rows;
    const prepared = await Promise.all(populated.map(prepareActor));
    if (gm) return res.json(prepared);
    const world = filter.worldId ? await WorldsDocument.findById<any>(filter.worldId) : null;
    const limitedFields = world?.system ? getRulesetLimitedFields(world.system) : [];
    res.json(prepared.map(a => getPermLevel(a.ownership, 0, userId) === 1 ? redactActorForLimited(a, limitedFields) : a));
  } catch (err: any) {
    logger.error('GET /api/actors failed', { error: err.message });
    res.status(500).json({ error: 'Failed to retrieve actors' });
  }
});

actorsRouter.get('/:id', async (req, res) => {
  try {
    let row = await ActorsDocument.findById<any>(req.params.id);
    if (!row) return res.status(404).json({ error: 'Actor not found' });
    const userId = getUserId(req);
    const gm = isGM(req);
    const level = gm ? 3 : getPermLevel(row.ownership, 0, userId);
    if (level < 1) return res.status(403).json({ error: 'Access denied' });
    if (req.query.populate === 'true') {
      row = await populateChildren(row, ActorsDocument.schema);
    }
    const prepared = await prepareActor(row);
    if (level > 1) return res.json(prepared);
    const world = await WorldsDocument.findById<any>(prepared.worldId);
    const limitedFields = world?.system ? getRulesetLimitedFields(world.system) : [];
    res.json(redactActorForLimited(prepared, limitedFields));
  } catch (err: any) {
    logger.error('GET /api/actors/:id failed', { error: err.message, id: req.params.id });
    res.status(500).json({ error: 'Failed to retrieve actor' });
  }
});

actorsRouter.post('/', async (req, res) => {
  try {
    const { worldId = 'world-1', name, type: rawType, avatarUrl, systemData, folderId } = req.body;
    if (!name || typeof name !== 'string' || name.trim() === '') {
      return res.status(400).json({ error: 'Field "name" is required and must be a non-empty string.' });
    }
    const type = rawType ?? await defaultActorType(worldId);
    if (!(await isValidActorType(type, worldId))) {
      return res.status(400).json({ error: `Invalid actor type "${type}" for this world.` });
    }
    let finalSystemData = systemData;
    const activeSystem = SystemRegistry.getActive();
    if (activeSystem && (!systemData || Object.keys(systemData).length === 0)) {
      finalSystemData = activeSystem.getDefaultData(type);
    }
    const result = await ActorsDocument.create({
      name: name.trim(), type, worldId: worldId,
      avatarUrl: avatarUrl ?? '', systemData: finalSystemData ?? {}, folderId: folderId ?? '',
    }, { req });
    if (result.error) return res.status(400).json({ error: result.error });
    res.status(201).json(await prepareActor(result.data));
  } catch (err: any) {
    logger.error('POST /api/actors failed', { error: err.message, name: req.body?.name });
    res.status(500).json({ error: 'Failed to create actor' });
  }
});

actorsRouter.put('/:id', async (req, res) => {
  try {
    const { name, type, avatarUrl, systemData, folderId, ownership, flags } = req.body;
    const updates: Record<string, any> = {};
    if (name !== undefined) updates.name = String(name).trim();
    if (type !== undefined) {
      // Precisa do worldId do próprio ator: a rota de update não recebe worldId no body, e
      // os tipos válidos dependem do ruleset daquele mundo.
      const current = await ActorsDocument.findById<any>(req.params.id);
      if (!current) return res.status(404).json({ error: 'Actor not found' });
      if (!(await isValidActorType(type, current.worldId))) {
        return res.status(400).json({ error: `Invalid actor type "${type}" for this world.` });
      }
      updates.type = type;
    }
    if (avatarUrl !== undefined) updates.avatarUrl = avatarUrl;
    if (systemData !== undefined) updates.systemData = systemData;
    if (folderId !== undefined) updates.folderId = folderId;
    if (ownership !== undefined) {
      if (!isGM(req)) return res.status(403).json({ error: 'Only the Gamemaster can change ownership.' });
      updates.ownership = ownership;
    }
    // `ClientDocument.setFlag()` manda só `{ flags }` — sem isto a rota nunca reconhecia
    // esse caso como campo válido e devolvia 400 "No valid fields provided for update."
    // (mesma causa raiz encontrada e corrigida na rota de itens).
    if (flags !== undefined) updates.flags = flags;
    if (Object.keys(updates).length === 0) {
      logger.error('[DEBUG-temp] PUT /api/actors/:id body recebido sem campos válidos', { body: req.body });
      return res.status(400).json({ error: 'No valid fields provided for update.' });
    }
    const result = await ActorsDocument.update(req.params.id, updates, { req });
    if (result.error) {
      const status = result.error === 'Not found' ? 404 : result.error === 'Access denied' ? 403 : 400;
      return res.status(status).json({ error: result.error });
    }
    // populateChildren antes do prepareActor: update() devolve o row cru, sem os
    // ChildrenField. Sem isto o broadcast vai sem `items` e apaga a lista nos clientes.
    const prepared = await prepareActor(await populateChildren(result.data, ActorsDocument.schema));
    Signal.broadcast('actor.updated', prepared);
    res.json(prepared);
  } catch (err: any) {
    logger.error('PUT /api/actors/:id failed', { error: err.message, id: req.params.id });
    res.status(500).json({ error: 'Failed to update actor' });
  }
});

actorsRouter.delete('/:id', async (req, res) => {
  try {
    const cascade = req.query.cascade !== 'false';
    if (cascade) {
      await deleteChildren(req.params.id, ActorsDocument.schema);
    }
    const result = await ActorsDocument.delete(req.params.id, { req });
    if (result.error) {
      const status = result.error === 'Not found' ? 404 : 403;
      return res.status(status).json({ error: result.error });
    }
    res.json({ success: true, id: req.params.id });
  } catch (err: any) {
    logger.error('DELETE /api/actors/:id failed', { error: err.message, id: req.params.id });
    res.status(500).json({ error: 'Failed to delete actor' });
  }
});

/* ── Embedded: Items do Actor ────────────────────────────────── */

actorsRouter.get('/:actorId/items', async (req, res) => {
  try {
    const actor = await ActorsDocument.findById<any>(req.params.actorId);
    if (!actor) return res.status(404).json({ error: 'Actor not found' });
    const userId = getUserId(req);
    const level = isGM(req) ? 3 : getPermLevel(actor.ownership, 0, userId);
    if (level < 1) return res.status(403).json({ error: 'Access denied' });
    // Nivel 1 (Limitado) nao mostra itens vinculados (equipamento/clan/disciplinas
    // etc.) — mesmo criterio de visao recortada da ficha em si.
    if (level === 1) return res.json([]);
    const items = await ItemsDocument.find({ actorId: req.params.actorId });
    res.json(items);
  } catch (err: any) {
    logger.error('GET /api/actors/:id/items failed', { error: err.message });
    res.status(500).json({ error: 'Failed to retrieve items' });
  }
});

actorsRouter.post('/:actorId/items', async (req, res) => {
  try {
    const actor = await ActorsDocument.findById(req.params.actorId);
    if (!actor) return res.status(404).json({ error: 'Actor not found' });
    const { name, type = 'equipment', data = {}, imgUrl = '' } = req.body;
    if (!name) return res.status(400).json({ error: 'Field "name" is required.' });
    const result = await ItemsDocument.create({
      worldId: actor.worldId, actorId: req.params.actorId,
      name, type, data, imgUrl,
    }, { req });
    if (result.error) return res.status(400).json({ error: result.error });
    // populateChildren antes do prepareActor: findById() devolve o row cru, sem os
    // ChildrenField. Sem isto o broadcast vai sem `items` e apaga a lista nos clientes.
    const prepared = await prepareActor(await populateChildren(actor, ActorsDocument.schema));
    // Singular, igual a `item.updated`/`journal.updated` — é o nome que
    // `document-sheet.ts` (`${documentName}.updated`) escuta de verdade via WS.
    Signal.broadcast('actor.updated', prepared);
    res.status(201).json(result.data);
  } catch (err: any) {
    logger.error('POST /api/actors/:actorId/items failed', { error: err.message });
    res.status(500).json({ error: 'Failed to create item' });
  }
});

actorsRouter.put('/:actorId/items/:itemId', async (req, res) => {
  try {
    const actor = await ActorsDocument.findById(req.params.actorId);
    if (!actor) return res.status(404).json({ error: 'Actor not found' });
    
    const item = await ItemsDocument.findOne({ id: req.params.itemId, actorId: req.params.actorId });
    if (!item) return res.status(404).json({ error: 'Item not found or does not belong to this actor' });
    
    const { name, type, data, imgUrl, suppressed } = req.body;
    const updates: Record<string, any> = {};
    if (name       !== undefined) updates.name       = String(name).trim();
    if (type       !== undefined) updates.type       = type;
    if (data       !== undefined) updates.data       = data;
    if (imgUrl     !== undefined) updates.imgUrl     = imgUrl;
    if (suppressed !== undefined) updates.suppressed = suppressed;
    
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields provided for update.' });
    }
    
    const result = await ItemsDocument.update(req.params.itemId, updates, { req });
    if (result.error) {
      const status = result.error === 'Not found' ? 404 : result.error === 'Access denied' ? 403 : 400;
      return res.status(status).json({ error: result.error });
    }
    // populateChildren antes do prepareActor: findById() devolve o row cru, sem os
    // ChildrenField. Sem isto o broadcast vai sem `items` e apaga a lista nos clientes.
    const prepared = await prepareActor(await populateChildren(actor, ActorsDocument.schema));
    // Singular, igual a `item.updated`/`journal.updated` — é o nome que
    // `document-sheet.ts` (`${documentName}.updated`) escuta de verdade via WS.
    Signal.broadcast('actor.updated', prepared);
    res.json(result.data);
  } catch (err: any) {
    logger.error('PUT /api/actors/:actorId/items/:itemId failed', { error: err.message });
    res.status(500).json({ error: 'Failed to update item' });
  }
});

actorsRouter.delete('/:actorId/items/:itemId', async (req, res) => {
  try {
    const actor = await ActorsDocument.findById(req.params.actorId);
    if (!actor) return res.status(404).json({ error: 'Actor not found' });
    
    const item = await ItemsDocument.findOne({ id: req.params.itemId, actorId: req.params.actorId });
    if (!item) return res.status(404).json({ error: 'Item not found or does not belong to this actor' });
    
    const result = await ItemsDocument.delete(req.params.itemId, { req });
    if (result.error) {
      const status = result.error === 'Not found' ? 404 : 403;
      return res.status(status).json({ error: result.error });
    }
    // populateChildren antes do prepareActor: findById() devolve o row cru, sem os
    // ChildrenField. Sem isto o broadcast vai sem `items` e apaga a lista nos clientes.
    const prepared = await prepareActor(await populateChildren(actor, ActorsDocument.schema));
    // Singular, igual a `item.updated`/`journal.updated` — é o nome que
    // `document-sheet.ts` (`${documentName}.updated`) escuta de verdade via WS.
    Signal.broadcast('actor.updated', prepared);
    res.json({ success: true, id: req.params.itemId });
  } catch (err: any) {
    logger.error('DELETE /api/actors/:actorId/items/:itemId failed', { error: err.message });
    res.status(500).json({ error: 'Failed to delete item' });
  }
});
