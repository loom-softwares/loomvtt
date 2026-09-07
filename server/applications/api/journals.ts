import { Router } from 'express';
import { randomUUID } from 'crypto';
import { JournalsDocument, type JournalPage, type JournalCategory } from '../schemas/journals.schema.js';
import { Signal } from '../signals/index.js';
import logger from '../utils/logger.js';
import { getUserId, isGM, canView, canEdit } from '../middleware/permissions.js';
import { requireAuth, requireWorldMatch } from '../middleware/auth.js';
import { sanitizeRichText } from '../lib/sanitize-html.js';

export const journalsRouter = Router();
journalsRouter.use(requireAuth, requireWorldMatch);

journalsRouter.get('/', async (req, res) => {
  try {
    const filter: Record<string, any> = {};
    if (req.query.worldId) filter.worldId = req.query.worldId as string;
    const rows = await JournalsDocument.find(filter);

    const userId = getUserId(req);
    if (!isGM(req) && userId) {
      const filtered = rows.filter(r => canView(r.ownership, 1, userId));
      return res.json(filtered);
    }

    res.json(rows);
  } catch (err: any) {
    logger.error('GET /api/journals failed', { error: err.message });
    res.status(500).json({ error: 'Failed to retrieve journal entries' });
  }
});

journalsRouter.get('/:id', async (req, res) => {
  try {
    const row = await JournalsDocument.findById(req.params.id);
    if (!row) return res.status(404).json({ error: 'Journal entry not found' });

    const userId = getUserId(req);
    if (!isGM(req) && !canView(row.ownership, 1, userId)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(row);
  } catch (err: any) {
    logger.error('GET /api/journals/:id failed', { error: err.message, id: req.params.id });
    res.status(500).json({ error: 'Failed to retrieve journal entry' });
  }
});

journalsRouter.post('/', async (req, res) => {
  const { worldId = 'world-1', name, content = '', folderId = '', isPinned = false, pinX = 0, pinY = 0 } = req.body;

  if (!name || typeof name !== 'string' || name.trim() === '') {
    return res.status(400).json({ error: 'Field "name" is required and must be a non-empty string.' });
  }

  const sanitizedContent = sanitizeRichText(content);
  const initialPage: JournalPage = {
    id: randomUUID(),
    name: name.trim(),
    content: sanitizedContent,
    sort: 0,
  };

  try {
    const result = await JournalsDocument.create({
      worldId, name: name.trim(), content: sanitizedContent, pages: [initialPage], folderId,
      isPinned: !!isPinned, pinX, pinY,
    }, { req });
    if (result.error) return res.status(400).json({ error: result.error });
    const newEntry = result.data;
    Signal.broadcast('journal.created', newEntry);
    logger.info('Journal entry created', { id: newEntry.id, name: newEntry.name });
    res.status(201).json(newEntry);
  } catch (err: any) {
    logger.error('POST /api/journals failed', { error: err.message, name });
    res.status(500).json({ error: 'Failed to create journal entry' });
  }
});

journalsRouter.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { name, content, pages, categories, folderId, isPinned, pinX, pinY } = req.body;

  try {
    const existing = await JournalsDocument.findById<Record<string, any>>(id);
    if (!existing) return res.status(404).json({ error: 'Journal entry not found' });

    const userId = getUserId(req);
    if (!isGM(req) && !canEdit(existing.ownership, userId)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const updates: Record<string, any> = {};
    if (name     !== undefined) updates.name     = String(name).trim();
    if (content  !== undefined) updates.content   = sanitizeRichText(content);
    if (pages    !== undefined) {
      updates.pages = (pages as JournalPage[]).map(p => ({
        ...p,
        content: p.content !== undefined ? sanitizeRichText(p.content) : p.content,
      }));
    }
    if (categories !== undefined) updates.categories = categories as JournalCategory[];
    if (folderId !== undefined) updates.folderId  = folderId;
    if (isPinned !== undefined) updates.isPinned  = !!isPinned;
    if (pinX     !== undefined) updates.pinX      = pinX;
    if (pinY     !== undefined) updates.pinY      = pinY;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields provided for update.' });
    }

    const result = await JournalsDocument.update(id, updates, { req });
    if (result.error) return res.status(400).json({ error: result.error });
    const updated = result.data;

    Signal.broadcast('journal.updated', updated);
    logger.info('Journal entry updated', { id, updates });

    res.json(updated);
  } catch (err: any) {
    logger.error('PUT /api/journals/:id failed', { error: err.message, id });
    res.status(500).json({ error: 'Failed to update journal entry' });
  }
});

/* ---- Journal Pages (multi-page support) ---- */

/** POST /api/journals/:id/pages — add a new page */
journalsRouter.post('/:id/pages', async (req, res) => {
  const { id } = req.params;
  const { name, content = '', type = 'text', src = '', categoryId = '' } = req.body;
  if (!name || typeof name !== 'string' || name.trim() === '') {
    return res.status(400).json({ error: 'Field "name" is required.' });
  }
  try {
    const entry = await JournalsDocument.findById<Record<string, any>>(id);
    if (!entry) return res.status(404).json({ error: 'Journal entry not found' });

    const userId = getUserId(req);
    if (!isGM(req) && !canEdit(entry.ownership, userId)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const pages: JournalPage[] = entry.pages || [];
    const newPage: JournalPage = {
      id: randomUUID(),
      name: name.trim(),
      content: sanitizeRichText(content),
      type: type as 'text' | 'image' | 'pdf',
      src,
      sort: pages.length,
      ...(categoryId ? { categoryId } : {}),
    };
    pages.push(newPage);

    const result = await JournalsDocument.update(id, { pages }, { req });
    if (result.error) return res.status(400).json({ error: result.error });
    const updated = result.data;
    Signal.broadcast('journal.updated', updated);
    res.status(201).json(newPage);
  } catch (err: any) {
    logger.error('POST /api/journals/:id/pages failed', { error: err.message, id });
    res.status(500).json({ error: 'Failed to create page' });
  }
});

/** PUT /api/journals/:id/pages/:pageId — update a page */
journalsRouter.put('/:id/pages/:pageId', async (req, res) => {
  const { id, pageId } = req.params;
  const { name, content, categoryId } = req.body;
  try {
    const entry = await JournalsDocument.findById<Record<string, any>>(id);
    if (!entry) return res.status(404).json({ error: 'Journal entry not found' });

    const userId = getUserId(req);
    if (!isGM(req) && !canEdit(entry.ownership, userId)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const pages: JournalPage[] = entry.pages || [];
    const idx = pages.findIndex((p: JournalPage) => p.id === pageId);
    if (idx === -1) return res.status(404).json({ error: 'Page not found' });

    if (name       !== undefined) pages[idx].name       = String(name).trim();
    if (content    !== undefined) pages[idx].content    = sanitizeRichText(content);
    if (categoryId !== undefined) pages[idx].categoryId = categoryId || undefined;

    const result = await JournalsDocument.update(id, { pages }, { req });
    if (result.error) return res.status(400).json({ error: result.error });
    const updated = result.data;
    Signal.broadcast('journal.updated', updated);
    res.json(pages[idx]);
  } catch (err: any) {
    logger.error('PUT /api/journals/:id/pages/:pageId failed', { error: err.message, id, pageId });
    res.status(500).json({ error: 'Failed to update page' });
  }
});

/** DELETE /api/journals/:id/pages/:pageId — remove a page */
journalsRouter.delete('/:id/pages/:pageId', async (req, res) => {
  const { id, pageId } = req.params;
  try {
    const entry = await JournalsDocument.findById<Record<string, any>>(id);
    if (!entry) return res.status(404).json({ error: 'Journal entry not found' });

    const userId = getUserId(req);
    if (!isGM(req) && !canEdit(entry.ownership, userId)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    let pages: JournalPage[] = entry.pages || [];
    pages = pages.filter((p: JournalPage) => p.id !== pageId);
    pages.forEach((p: JournalPage, i: number) => { p.sort = i; });

    const result = await JournalsDocument.update(id, { pages }, { req });
    if (result.error) return res.status(400).json({ error: result.error });
    const updated = result.data;
    Signal.broadcast('journal.updated', updated);
    res.json({ success: true });
  } catch (err: any) {
    logger.error('DELETE /api/journals/:id/pages/:pageId failed', { error: err.message, id, pageId });
    res.status(500).json({ error: 'Failed to delete page' });
  }
});

/** POST /api/journals/:id/categories — add a new category */
journalsRouter.post('/:id/categories', async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;
  if (!name || typeof name !== 'string' || name.trim() === '') {
    return res.status(400).json({ error: 'Field "name" is required.' });
  }
  try {
    const entry = await JournalsDocument.findById<Record<string, any>>(id);
    if (!entry) return res.status(404).json({ error: 'Journal entry not found' });

    const userId = getUserId(req);
    if (!isGM(req) && !canEdit(entry.ownership, userId)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const categories: JournalCategory[] = entry.categories || [];
    const newCategory: JournalCategory = {
      id: randomUUID(),
      name: name.trim(),
      sort: categories.length,
    };
    categories.push(newCategory);

    const result = await JournalsDocument.update(id, { categories }, { req });
    if (result.error) return res.status(400).json({ error: result.error });
    Signal.broadcast('journal.updated', result.data);
    res.status(201).json(newCategory);
  } catch (err: any) {
    logger.error('POST /api/journals/:id/categories failed', { error: err.message, id });
    res.status(500).json({ error: 'Failed to create category' });
  }
});

/** PUT /api/journals/:id/categories/:categoryId — rename/reorder a category */
journalsRouter.put('/:id/categories/:categoryId', async (req, res) => {
  const { id, categoryId } = req.params;
  const { name, sort } = req.body;
  try {
    const entry = await JournalsDocument.findById<Record<string, any>>(id);
    if (!entry) return res.status(404).json({ error: 'Journal entry not found' });

    const userId = getUserId(req);
    if (!isGM(req) && !canEdit(entry.ownership, userId)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const categories: JournalCategory[] = entry.categories || [];
    const idx = categories.findIndex((c: JournalCategory) => c.id === categoryId);
    if (idx === -1) return res.status(404).json({ error: 'Category not found' });

    if (name !== undefined) categories[idx].name = String(name).trim();
    if (sort !== undefined) categories[idx].sort = Number(sort);

    const result = await JournalsDocument.update(id, { categories }, { req });
    if (result.error) return res.status(400).json({ error: result.error });
    Signal.broadcast('journal.updated', result.data);
    res.json(categories[idx]);
  } catch (err: any) {
    logger.error('PUT /api/journals/:id/categories/:categoryId failed', { error: err.message, id, categoryId });
    res.status(500).json({ error: 'Failed to update category' });
  }
});

/** DELETE /api/journals/:id/categories/:categoryId — remove a category; member pages fall back to uncategorized */
journalsRouter.delete('/:id/categories/:categoryId', async (req, res) => {
  const { id, categoryId } = req.params;
  try {
    const entry = await JournalsDocument.findById<Record<string, any>>(id);
    if (!entry) return res.status(404).json({ error: 'Journal entry not found' });

    const userId = getUserId(req);
    if (!isGM(req) && !canEdit(entry.ownership, userId)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const categories: JournalCategory[] = (entry.categories || []).filter((c: JournalCategory) => c.id !== categoryId);
    const pages: JournalPage[] = entry.pages || [];
    for (const page of pages) {
      if (page.categoryId === categoryId) page.categoryId = undefined;
    }

    const result = await JournalsDocument.update(id, { categories, pages }, { req });
    if (result.error) return res.status(400).json({ error: result.error });
    Signal.broadcast('journal.updated', result.data);
    res.json({ success: true, id: categoryId });
  } catch (err: any) {
    logger.error('DELETE /api/journals/:id/categories/:categoryId failed', { error: err.message, id, categoryId });
    res.status(500).json({ error: 'Failed to delete category' });
  }
});

journalsRouter.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const existing = await JournalsDocument.findById(id);
    if (!existing) return res.status(404).json({ error: 'Journal entry not found' });

    const userId = getUserId(req);
    if (!isGM(req) && !canEdit(existing.ownership, userId)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const result = await JournalsDocument.delete(id, { req });
    if (result.error) return res.status(400).json({ error: result.error });

    Signal.broadcast('journal.deleted', { id });
    logger.info('Journal entry deleted', { id, name: existing.name });

    res.json({ success: true, id });
  } catch (err: any) {
    logger.error('DELETE /api/journals/:id failed', { error: err.message, id });
    res.status(500).json({ error: 'Failed to delete journal entry' });
  }
});
