import { Router } from 'express';
import { NotesDocument } from '../schemas/notes.schema.js';
import { Signal } from '../signals/index.js';
import { requireAuth, requireWorldMatch } from '../middleware/auth.js';

export const notesRouter = Router();
notesRouter.use(requireAuth, requireWorldMatch);

notesRouter.get('/stage/:stageId', async (req, res) => {
  try {
    const notes = await NotesDocument.find({ stageId: req.params.stageId, orderBy: 'createdAt', orderDir: 'asc' });
    res.json(notes);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

notesRouter.post('/', async (req, res) => {
  try {
    const { stageId, journalId, x, y, visibleToPlayers, levelId } = req.body;
    if (!stageId) return res.status(400).json({ error: 'stageId is required' });
    const result = await NotesDocument.create({ 
      stageId, 
      journalId: journalId ?? '', 
      x: x ?? 0, 
      y: y ?? 0, 
      visibleToPlayers: visibleToPlayers ?? false,
      levelId: levelId ?? '' 
    });
    if (result.error) return res.status(400).json({ error: result.error });
    const note = result.data;
    Signal.broadcast('note.created', note);
    res.status(201).json(note);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

notesRouter.put('/:id', async (req, res) => {
  try {
    const { journalId, x, y, visibleToPlayers, levelId } = req.body;
    const updates: Record<string, any> = {};
    if (journalId !== undefined) updates.journalId = journalId;
    if (x !== undefined) updates.x = x;
    if (y !== undefined) updates.y = y;
    if (visibleToPlayers !== undefined) updates.visibleToPlayers = visibleToPlayers;
    if (levelId !== undefined) updates.levelId = levelId;
    const result = await NotesDocument.update(req.params.id, updates);
    if (result.error) return res.status(400).json({ error: result.error });
    const note = result.data;
    Signal.broadcast('note.updated', note);
    res.json(note);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

notesRouter.delete('/:id', async (req, res) => {
  try {
    const result = await NotesDocument.delete(req.params.id);
    if (result.error) return res.status(400).json({ error: result.error });
    Signal.broadcast('note.deleted', { id: req.params.id });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
