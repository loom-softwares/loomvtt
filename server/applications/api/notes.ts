import { Router } from 'express';
import { NotesDocument } from '../schemas/notes.schema.js';
import { Signal } from '../signals/index.js';
import { requireAuth, requireWorldMatch } from '../middleware/auth.js';

export const notesRouter = Router();
notesRouter.use(requireAuth, requireWorldMatch);

const NOTE_FIELDS = [
  'journalId', 'targetStageId', 'x', 'y', 'visibleToPlayers', 'levelId',
  'floors', 'visibleGlobally', 'iconEntry', 'iconFontSize', 'iconTint',
  'textLabel', 'fontFamily', 'fontSize', 'textColor', 'textAnchor',
];

notesRouter.get('/stage/:stageId', async (req, res) => {
  try {
    const notes = await NotesDocument.find({ stageId: req.params.stageId, orderBy: 'createdAt', orderDir: 'asc' });
    res.json(notes);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

notesRouter.get('/:id', async (req, res) => {
  try {
    const note = await NotesDocument.findById(req.params.id);
    if (!note) return res.status(404).json({ error: 'Note not found' });
    res.json(note);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

notesRouter.post('/', async (req, res) => {
  try {
    const { stageId } = req.body;
    if (!stageId) return res.status(400).json({ error: 'stageId is required' });
    const payload: Record<string, any> = { stageId };
    for (const field of NOTE_FIELDS) {
      if (req.body[field] !== undefined) payload[field] = req.body[field];
    }
    const result = await NotesDocument.create(payload);
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
    const updates: Record<string, any> = {};
    for (const field of NOTE_FIELDS) {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    }
    // Linking a note to a scene (waypoint) and to a journal are mutually
    // exclusive — clearing whichever one the client didn't just set avoids a
    // note silently carrying a stale link from before it changed purpose.
    if (updates.targetStageId) updates.journalId = '';
    else if (updates.journalId) updates.targetStageId = '';
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
