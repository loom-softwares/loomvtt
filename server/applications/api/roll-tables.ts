import { Router } from 'express';
import { randomUUID } from 'crypto';
import logger from '../utils/logger.js';
import { Roll_tablesDocument } from '../schemas/roll_tables.schema.js';
import { Roll_table_entriesDocument } from '../schemas/roll_table_entries.schema.js';
import { Signal } from '../signals/index.js';
import { requireAuth, requireWorldMatch } from '../middleware/auth.js';
import { requireGM, getUserId } from '../middleware/permissions.js';
import { db } from '../database/db.js';
import { broadcastToWorld } from '../ws/channels.js';
import { sanitizeRichText } from '../lib/sanitize-html.js';
import { roll as rollFormula } from '../dice/roller.js';
import { ActorsDocument } from '../schemas/actors.schema.js';
import { ItemsDocument } from '../schemas/items.schema.js';
import { StagesDocument } from '../schemas/stages.schema.js';
import { JournalsDocument } from '../schemas/journals.schema.js';

const DOCUMENT_COLLECTIONS: Record<string, { findById(id: string): Promise<any> }> = {
  actors: ActorsDocument,
  items: ItemsDocument,
  stages: StagesDocument,
  journals: JournalsDocument,
};


async function resolveDocumentSnapshot(collection: string, documentId: string): Promise<{ text: string; imgUrl: string } | null> {
  const model = DOCUMENT_COLLECTIONS[collection];
  if (!model || !documentId) return null;
  const doc = await model.findById(documentId);
  if (!doc) return null;
  return { text: doc.name || '', imgUrl: doc.imgUrl || doc.img || '' };
}


async function normalizeRanges(rollTableId: string): Promise<void> {
  const entries = await Roll_table_entriesDocument.find({ rollTableId, orderBy: 'createdAt', orderDir: 'asc' });
  let cursor = 1;
  for (const entry of entries) {
    const rangeMin = cursor;
    const rangeMax = cursor + Math.max(entry.weight, 0) - 1;
    cursor = rangeMax + 1;
    if (entry.rangeMin !== rangeMin || entry.rangeMax !== rangeMax) {
      await Roll_table_entriesDocument.update(entry.id, { rangeMin, rangeMax: Math.max(rangeMax, rangeMin) });
    }
  }
}

function escapeHtml(text: string): string {
  return String(text ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export const rollTablesRouter = Router();
rollTablesRouter.use(requireAuth, requireWorldMatch);

// GET /api/roll-tables?worldId= — list all roll tables for a world
rollTablesRouter.get('/', async (req, res) => {
  try {
    const { worldId } = req.query;
    const filter: Record<string, any> = { orderBy: 'createdAt', orderDir: 'desc' };
    if (worldId) filter.worldId = worldId as string;
    const tables = await Roll_tablesDocument.find(filter);
    res.json(tables);
  } catch (err: any) {
    logger.error('GET /roll-tables failed', { error: err.message });
    res.status(500).json({ error: 'Failed to list roll tables.' });
  }
});

// POST /api/roll-tables — create a new roll table
rollTablesRouter.post('/', requireGM, async (req, res) => {
  try {
    const { id, worldId, name, description, formula, sortMode, imgUrl, replacement, displayRollFormula } = req.body;
    const result = await Roll_tablesDocument.create({
      id, worldId, name,
      description: sanitizeRichText(description || ''),
      formula: formula || '1d20',
      sortMode: sortMode || 0,
      imgUrl: imgUrl || '',
      replacement: replacement ?? 1,
      displayRollFormula: displayRollFormula ?? 1,
    });
    if (result.error) return res.status(400).json({ error: result.error });
    logger.info('Roll table created', { id: result.data.id, worldId, name });
    res.status(201).json(result.data);
  } catch (err: any) {
    logger.error('POST /roll-tables failed', { error: err.message });
    res.status(500).json({ error: 'Failed to create roll table.' });
  }
});

// GET /api/roll-tables/:id — get a roll table with its entries
rollTablesRouter.get('/:id', async (req, res) => {
  try {
    const table = await Roll_tablesDocument.findById(req.params.id);
    if (!table) return res.status(404).json({ error: 'Roll table not found.' });
    const entries = await Roll_table_entriesDocument.find({ rollTableId: req.params.id, orderBy: 'createdAt', orderDir: 'asc' });
    res.json({ ...table, entries });
  } catch (err: any) {
    logger.error('GET /roll-tables/:id failed', { error: err.message });
    res.status(500).json({ error: 'Failed to get roll table.' });
  }
});

// PUT /api/roll-tables/:id — update a roll table
rollTablesRouter.put('/:id', requireGM, async (req, res) => {
  try {
    const { name, description, formula, sortMode, imgUrl, replacement, displayRollFormula } = req.body;
    const result = await Roll_tablesDocument.update(req.params.id, {
      name, formula, sortMode, imgUrl, replacement, displayRollFormula,
      description: description !== undefined ? sanitizeRichText(description) : undefined,
    });
    if (result.error) return res.status(400).json({ error: result.error });
    res.json({ success: true });
  } catch (err: any) {
    logger.error('PUT /roll-tables/:id failed', { error: err.message });
    res.status(500).json({ error: 'Failed to update roll table.' });
  }
});

// DELETE /api/roll-tables/:id — delete a roll table and its entries
rollTablesRouter.delete('/:id', requireGM, async (req, res) => {
  try {
    const entries = await Roll_table_entriesDocument.find({ rollTableId: req.params.id });
    for (const entry of entries) {
      await Roll_table_entriesDocument.delete(entry.id);
    }
    const result = await Roll_tablesDocument.delete(req.params.id);
    if (result.error) return res.status(400).json({ error: result.error });
    res.json({ success: true });
  } catch (err: any) {
    logger.error('DELETE /roll-tables/:id failed', { error: err.message });
    res.status(500).json({ error: 'Failed to delete roll table.' });
  }
});

// --- Roll Table Entries ---

// POST /api/roll-tables/:id/entries — add a single entry
rollTablesRouter.post('/:id/entries', requireGM, async (req, res) => {
  try {
    const { id, text, imgUrl, weight, collectionId, drawn, type, documentCollection, documentId, description } = req.body;
    const w = weight || 1;
    const existing = await Roll_table_entriesDocument.find({ rollTableId: req.params.id });
    const cursor = existing.reduce((max, e) => Math.max(max, e.rangeMax || 0), 0) + 1;

    let finalText = text || '';
    let finalImgUrl = imgUrl || '';
    if (type === 'document' && documentCollection && documentId) {
      const snapshot = await resolveDocumentSnapshot(documentCollection, documentId);
      if (snapshot) { finalText = finalText || snapshot.text; finalImgUrl = finalImgUrl || snapshot.imgUrl; }
    }

    const result = await Roll_table_entriesDocument.create({
      id,
      rollTableId: req.params.id,
      text: finalText,
      imgUrl: finalImgUrl,
      weight: w,
      collectionId: collectionId || '',
      drawn: drawn || 'NONE',
      type: type || 'text',
      documentCollection: documentCollection || '',
      documentId: documentId || '',
      description: description || '',
      rangeMin: cursor,
      rangeMax: cursor + w - 1,
    });
    if (result.error) return res.status(400).json({ error: result.error });
    res.status(201).json(result.data);
  } catch (err: any) {
    logger.error('POST /roll-tables/:id/entries failed', { error: err.message });
    res.status(500).json({ error: 'Failed to add entry.' });
  }
});

// PUT /api/roll-tables/entries/:entryId — update an entry
rollTablesRouter.put('/entries/:entryId', requireGM, async (req, res) => {
  try {
    const { text, imgUrl, weight, drawn, type, documentCollection, documentId, description, rangeMin, rangeMax } = req.body;
    let finalText = text;
    let finalImgUrl = imgUrl;
    if (type === 'document' && documentCollection && documentId) {
      const snapshot = await resolveDocumentSnapshot(documentCollection, documentId);
      if (snapshot) { finalText = finalText || snapshot.text; finalImgUrl = finalImgUrl || snapshot.imgUrl; }
    }
    const result = await Roll_table_entriesDocument.update(req.params.entryId, {
      text: finalText, imgUrl: finalImgUrl, weight, drawn, type, documentCollection, documentId, description, rangeMin, rangeMax,
    });
    if (result.error) return res.status(400).json({ error: result.error });
    res.json({ success: true });
  } catch (err: any) {
    logger.error('PUT /roll-tables/entries/:entryId failed', { error: err.message });
    res.status(500).json({ error: 'Failed to update entry.' });
  }
});

// DELETE /api/roll-tables/entries/:entryId — delete an entry
rollTablesRouter.delete('/entries/:entryId', requireGM, async (req, res) => {
  try {
    const result = await Roll_table_entriesDocument.delete(req.params.entryId);
    if (result.error) return res.status(400).json({ error: result.error });
    res.json({ success: true });
  } catch (err: any) {
    logger.error('DELETE /roll-tables/entries/:entryId failed', { error: err.message });
    res.status(500).json({ error: 'Failed to delete entry.' });
  }
});

// --- Roll ---

// POST /api/roll-tables/:id/roll — roll on the table and return result
rollTablesRouter.post('/:id/roll', async (req, res) => {
  try {
    const table = await Roll_tablesDocument.findById(req.params.id);
    if (!table) return res.status(404).json({ error: 'Roll table not found.' });
    const allEntries = await Roll_table_entriesDocument.find({ rollTableId: req.params.id });
    if (allEntries.length === 0) return res.status(400).json({ error: 'Roll table has no entries.' });
    const hasRanges = allEntries.some((e) => e.rangeMax > 0);
    if (!hasRanges) {
      return res.status(400).json({ error: 'Intervalos não configurados. Use "Normalizar Intervalos" antes de sortear.' });
    }

    let result: (typeof allEntries)[number] | undefined;
    let rollTotal = 0;
    for (let attempt = 0; attempt < 25 && !result; attempt++) {
      rollTotal = rollFormula(table.formula).total;
      result = allEntries.find((e) =>
        rollTotal >= e.rangeMin && rollTotal <= e.rangeMax &&
        (table.replacement !== 0 || e.drawn !== 'true')
      );
    }
    if (!result) {
      return res.status(400).json({ error: 'Nenhum resultado disponível no intervalo sorteado. Normalize os intervalos ou resete a tabela.' });
    }

    // Handle replacement — mark drawn instead of destroying the weight, so Reset Results can restore it
    if (table.replacement === 0) {
      await Roll_table_entriesDocument.update(result.id, { drawn: 'true' });
    }

    const formulaDisplay = table.formula;
    const label = result.text || result.id;

    Signal.broadcast('roll-table.rolled', {
      tableId: req.params.id,
      result: { ...result },
      formula: formulaDisplay,
      total: rollTotal,
      label,
    });

    const auth = (req as any).auth || {};
    const msgId = `msg-${randomUUID()}`;
    const content = table.displayRollFormula
      ? `[icon:fa-sharp fa-regular fa-dice] **${table.name}** [${formulaDisplay}: ${rollTotal}]: ${label}`
      : `[icon:fa-sharp fa-regular fa-dice] **${table.name}**: ${label}`;
    await db('chat_messages').insert({
      id: msgId,
      worldId: table.worldId,
      userId: auth.userId || 'anon',
      userName: auth.userName || 'Anonymous',
      userColor: auth.userColor || '#888',
      type: 'chat',
      content,
      speaker: '{}',
    });
    broadcastToWorld('chat.message', table.worldId, {
      id: msgId, userId: auth.userId, userName: auth.userName, userColor: auth.userColor,
      type: 'chat', content, speaker: {}, createdAt: new Date().toISOString(), worldId: table.worldId,
    });

    res.json({
      result: { ...result },
      formula: formulaDisplay,
      total: rollTotal,
      label
    });
  } catch (err: any) {
    logger.error('POST /roll-tables/:id/roll failed', { error: err.message });
    res.status(500).json({ error: 'Failed to roll on table.' });
  }
});

// POST /api/roll-tables/:id/reset-results — clear the `drawn` mark on every entry
rollTablesRouter.post('/:id/reset-results', requireGM, async (req, res) => {
  try {
    const table = await Roll_tablesDocument.findById(req.params.id);
    if (!table) return res.status(404).json({ error: 'Roll table not found.' });
    const entries = await Roll_table_entriesDocument.find({ rollTableId: req.params.id });
    for (const entry of entries) {
      if (entry.drawn !== 'NONE') {
        await Roll_table_entriesDocument.update(entry.id, { drawn: 'NONE' });
      }
    }
    res.json({ success: true });
  } catch (err: any) {
    logger.error('POST /roll-tables/:id/reset-results failed', { error: err.message });
    res.status(500).json({ error: 'Failed to reset roll table results.' });
  }
});

// POST /api/roll-tables/:id/normalize-results — recompute contiguous rangeMin/rangeMax from weight
rollTablesRouter.post('/:id/normalize-results', requireGM, async (req, res) => {
  try {
    const table = await Roll_tablesDocument.findById(req.params.id);
    if (!table) return res.status(404).json({ error: 'Roll table not found.' });
    await normalizeRanges(req.params.id);
    res.json({ success: true });
  } catch (err: any) {
    logger.error('POST /roll-tables/:id/normalize-results failed', { error: err.message });
    res.status(500).json({ error: 'Failed to normalize roll table ranges.' });
  }
});
