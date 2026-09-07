import { Router } from 'express';
import { FoldersDocument } from '../schemas/folders.schema.js';
import { db } from '../database/db.js';
import { Signal } from '../signals/index.js';
import logger from '../utils/logger.js';
import { requireAuth, requireWorldMatch } from '../middleware/auth.js';

export const foldersRouter = Router();
foldersRouter.use(requireAuth, requireWorldMatch);

const FOLDER_TYPES = ['actor', 'item', 'scene', 'journal', 'roll-table', 'macro', 'deck', 'playlist', 'compendium'];

// GET /api/folders?worldId= — list folders
foldersRouter.get('/', async (req, res) => {
  try {
    const filter: Record<string, any> = {};
    if (req.query.worldId) filter.worldId = req.query.worldId as string;
    if (req.query.type) filter.type = req.query.type as string;
    filter.orderBy = 'createdAt';
    filter.orderDir = 'asc';
    const folders = await FoldersDocument.find(filter);
    res.json(folders);
  } catch (err: any) {
    logger.error('GET /api/folders failed', { error: err.message });
    res.status(500).json({ error: 'Failed to retrieve folders' });
  }
});

// GET /api/folders/:id
foldersRouter.get('/:id', async (req, res) => {
  try {
    const row = await FoldersDocument.findById(req.params.id);
    if (!row) return res.status(404).json({ error: 'Folder not found' });
    res.json(row);
  } catch (err: any) {
    logger.error('GET /api/folders/:id failed', { error: err.message, id: req.params.id });
    res.status(500).json({ error: 'Failed to retrieve folder' });
  }
});

// POST /api/folders — create
foldersRouter.post('/', async (req, res) => {
  const { worldId = 'world-1', name, type, parent = '', sorting = 'm', color = '' } = req.body;

  if (!name || typeof name !== 'string' || name.trim() === '') {
    return res.status(400).json({ error: 'Field "name" is required.' });
  }
  if (!FOLDER_TYPES.includes(type)) {
    return res.status(400).json({ error: `Field "type" must be one of: ${FOLDER_TYPES.join(', ')}` });
  }

  // Validate parent exists if provided
  if (parent) {
    const parentFolder = await FoldersDocument.findById(parent);
    if (!parentFolder) return res.status(400).json({ error: 'Parent folder not found' });
    if (parentFolder.type !== type) return res.status(400).json({ error: 'Parent folder type mismatch' });
  }

  const newFolder = { worldId, name: name.trim(), type, parent, sorting, color };

  try {
    const result = await FoldersDocument.create(newFolder);
    if (result.error) return res.status(400).json({ error: result.error });
    const created = result.data;
    Signal.broadcast('folder.created', created);
    logger.info('Folder created', { id: created.id, name: created.name, type, parent });
    res.status(201).json(created);
  } catch (err: any) {
    logger.error('POST /api/folders failed', { error: err.message, name });
    res.status(500).json({ error: 'Failed to create folder' });
  }
});

// PUT /api/folders/:id — update
foldersRouter.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { name, parent, sorting, color } = req.body;

  try {
    const existing = await FoldersDocument.findById(id);
    if (!existing) return res.status(404).json({ error: 'Folder not found' });

    const updates: Record<string, any> = {};
    if (name    !== undefined) updates.name    = String(name).trim();
    if (parent  !== undefined) updates.parent   = parent;
    if (sorting !== undefined) updates.sorting  = sorting;
    if (color   !== undefined) updates.color    = color;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields provided.' });
    }

    // Prevent circular parent ref
    if (updates.parent === id || updates.parent === existing.parent) {
      delete updates.parent;
    }
    if (updates.parent) {
      const parentFolder = await FoldersDocument.findById(updates.parent);
      if (!parentFolder) return res.status(400).json({ error: 'Parent folder not found' });
      if (parentFolder.type !== existing.type) return res.status(400).json({ error: 'Parent folder type mismatch' });
    }

    await FoldersDocument.update(id, updates);
    const updated = await FoldersDocument.findById(id);

    Signal.broadcast('folder.updated', updated);
    logger.info('Folder updated', { id, updates });

    res.json(updated);
  } catch (err: any) {
    logger.error('PUT /api/folders/:id failed', { error: err.message, id });
    res.status(500).json({ error: 'Failed to update folder' });
  }
});

// DELETE /api/folders/:id — delete (no cascade, child folders + docs become root)
foldersRouter.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const existing = await FoldersDocument.findById(id);
    if (!existing) return res.status(404).json({ error: 'Folder not found' });

    // Reparent child folders to grandparent
    await db('folders').where({ parent: id }).update({ parent: existing.parent });

    // Unset folderId on documents
    const tableMap: Record<string, string> = {
      actor: 'cast', item: 'items', scene: 'stages',
      journal: 'journals', 'roll-table': 'roll_tables', macro: 'macros',
    };
    const docTable = tableMap[existing.type];
    if (docTable && await db.schema.hasTable(docTable)) {
      await db(docTable).where({ folderId: id }).update({ folderId: '' });
    }

    await FoldersDocument.delete(id);

    Signal.broadcast('folder.deleted', { id });
    logger.info('Folder deleted', { id, name: existing.name });

    res.json({ success: true, id });
  } catch (err: any) {
    logger.error('DELETE /api/folders/:id failed', { error: err.message, id });
    res.status(500).json({ error: 'Failed to delete folder' });
  }
});
