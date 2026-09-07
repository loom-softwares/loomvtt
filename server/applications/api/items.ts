import { Router } from 'express';
import { ItemsDocument } from '../schemas/items.schema.js';
import { ActorsDocument } from '../schemas/actors.schema.js';
import { Signal } from '../signals/index.js';
import logger from '../utils/logger.js';
import { getUserId, isGM, canView, canEdit } from '../middleware/permissions.js';
import { LoomHooks } from '../utils/hooks.js';
import { requireAuth, requireWorldMatch } from '../middleware/auth.js';
import { populateChildren, deleteChildren } from '../lib/embedded-docs.js';
import { prepareActor } from '../lib/actor-prepare.js';
import { WorldsDocument } from '../schemas/worlds.schema.js';
import { getDataRoot } from '../database/db.js';
import path from 'path';
import fs from 'fs';

export const itemsRouter = Router();
itemsRouter.use(requireAuth, requireWorldMatch);

// Tipos nativos sempre aceitos (fallback do rpg-generic).
const BASE_ITEM_TYPES = ['weapon', 'spell', 'armor', 'equipment', 'consumable', 'tool', 'treasure', 'other'];

// Rulesets não rodam código no servidor (ver addons/loader.ts) — por isso a lista de
// tipos extras do sistema vem do `ruleset.json` (JSON estático, "itemTypes": [...]),
// nunca de `client.js`/`defineSystem()`.
function getRulesetItemTypes(systemId: string): string[] {
  try {
    const manifestPath = path.join(getDataRoot(), 'marketplace', 'rulesets', systemId, 'ruleset.json');
    if (!fs.existsSync(manifestPath)) return [];
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    return Array.isArray(manifest.itemTypes) ? manifest.itemTypes : [];
  } catch {
    return [];
  }
}

async function isValidItemType(type: string, worldId: string): Promise<boolean> {
  if (BASE_ITEM_TYPES.includes(type)) return true;
  const world = await WorldsDocument.findById<any>(worldId);
  if (!world?.system) return false;
  return getRulesetItemTypes(world.system).includes(type);
}

async function cascadeItemToActor(actorId: string | undefined): Promise<void> {
  if (!actorId) return;
  try {
    const actor = await ActorsDocument.findById(actorId);
    if (!actor) return;
    // Mesmo motivo do actors.ts: sem populateChildren o broadcast vai sem `items`.
    const prepared = await prepareActor(await populateChildren(actor, ActorsDocument.schema));
    // Singular, igual a `item.updated`/`journal.updated` — é o nome que
    // `document-sheet.ts` (`${documentName}.updated`) escuta de verdade via WS.
    Signal.broadcast('actor.updated', prepared);
  } catch (err: any) {
    logger.error('cascadeItemToActor failed', { error: err.message, actorId });
  }
}

itemsRouter.get('/', async (req, res) => {
  try {
    const filter: Record<string, any> = { orderBy: 'createdAt', orderDir: 'asc' };
    if (req.query.worldId) filter.worldId = req.query.worldId as string;
    if (req.query.limit) filter.limit = req.query.limit;
    if (req.query.offset) filter.offset = req.query.offset;
    let rows = await ItemsDocument.find(filter);

    const userId = getUserId(req);
    if (!isGM(req) && userId) {
      rows = rows.filter(r => canView(r.ownership, 0, userId));
    }

    const populated = req.query.populate === 'true'
      ? await Promise.all(rows.map(r => populateChildren(r, ItemsDocument.schema)))
      : rows;
    res.json(populated);
  } catch (err: any) {
    logger.error('GET /api/items failed', { error: err.message });
    res.status(500).json({ error: 'Failed to retrieve items' });
  }
});

itemsRouter.get('/:id', async (req, res) => {
  try {
    let row = await ItemsDocument.findById(req.params.id);
    if (!row) return res.status(404).json({ error: 'Item not found' });

    const userId = getUserId(req);
    if (!isGM(req) && !canView(row.ownership, 0, userId)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (req.query.populate === 'true') {
      row = await populateChildren(row, ItemsDocument.schema);
    }
    res.json(row);
  } catch (err: any) {
    logger.error('GET /api/items/:id failed', { error: err.message, id: req.params.id });
    res.status(500).json({ error: 'Failed to retrieve item' });
  }
});

itemsRouter.post('/', async (req, res) => {
  const {
    worldId = 'world-1', name, type = 'equipment',
    data = {}, imgUrl = '', folderId = '', actorId,
  } = req.body;

  if (!name || typeof name !== 'string' || name.trim() === '') {
    return res.status(400).json({ error: 'Field "name" is required and must be a non-empty string.' });
  }

  try {
    const result = await ItemsDocument.create({
      worldId,
      name: name.trim(),
      type: (await isValidItemType(type, worldId)) ? type : 'equipment',
      data,
      imgUrl,
      folderId,
      actorId,
    }, { req });
    if (result.error) return res.status(400).json({ error: result.error });
    const created = result.data;

    Signal.broadcast('item.created', created);
    logger.info('Item created', { id: created.id, name: created.name, type: created.type });
    await LoomHooks.call('onCreateItem', created);

    await cascadeItemToActor(actorId);

    res.status(201).json(created);
  } catch (err: any) {
    logger.error('POST /api/items failed', { error: err.message, name });
    res.status(500).json({ error: 'Failed to create item' });
  }
});

itemsRouter.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { name, type, data, imgUrl, folderId, suppressed, flags } = req.body;

  try {
    const existing = await ItemsDocument.findById(id);
    if (!existing) return res.status(404).json({ error: 'Item not found' });

    const userId = getUserId(req);
    if (!isGM(req) && !canEdit(existing.ownership, userId)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const updates: Record<string, any> = {};
    if (name       !== undefined) updates.name       = String(name).trim();
    if (type       !== undefined) updates.type       = (await isValidItemType(type, existing.worldId)) ? type : existing.type;
    if (data       !== undefined) updates.data       = data;
    if (imgUrl     !== undefined) updates.imgUrl     = imgUrl;
    if (folderId   !== undefined) updates.folderId   = folderId;
    if (suppressed !== undefined) updates.suppressed = suppressed;
    // `ClientDocument.setFlag()` manda só `{ flags }` — sem isto a rota nunca reconhecia
    // nenhum campo válido nesse caso e devolvia 400 "No valid fields provided for update."
    // (achado real: `_onFormatDataId` chamando `item.setFlag('wod5e', 'dataItemId', ...)`).
    if (flags      !== undefined) updates.flags      = flags;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields provided for update.' });
    }

    await LoomHooks.call('preUpdateItem', id, updates);
    const result = await ItemsDocument.update(id, updates, { req });
    if (result.error) return res.status(400).json({ error: result.error });
    const updated = result.data;

    Signal.broadcast('item.updated', updated);
    logger.info('Item updated', { id, updates });
    await LoomHooks.call('onUpdateItem', updated);

    if (existing.actorId) {
      await cascadeItemToActor(existing.actorId);
    }

    res.json(updated);
  } catch (err: any) {
    logger.error('PUT /api/items/:id failed', { error: err.message, id });
    res.status(500).json({ error: 'Failed to update item' });
  }
});

itemsRouter.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const existing = await ItemsDocument.findById(id);
    if (!existing) return res.status(404).json({ error: 'Item not found' });

    const userId = getUserId(req);
    if (!isGM(req) && !canEdit(existing.ownership, userId)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await LoomHooks.call('preDeleteItem', id);
    const cascade = req.query.cascade !== 'false';
    if (cascade) {
      await deleteChildren(id, ItemsDocument.schema);
    }
    const result = await ItemsDocument.delete(id, { req });
    if (result.error) return res.status(400).json({ error: result.error });

    Signal.broadcast('item.deleted', { id });
    logger.info('Item deleted', { id, name: existing.name });
    await LoomHooks.call('onDeleteItem', id);

    const actorId = existing.actorId;
    if (actorId) {
      await cascadeItemToActor(actorId);
    }

    res.json({ success: true, id });
  } catch (err: any) {
    logger.error('DELETE /api/items/:id failed', { error: err.message, id });
    res.status(500).json({ error: 'Failed to delete item' });
  }
});
