import { Router } from 'express';
import { PlaylistsDocument } from '../schemas/playlists.schema.js';
import { Playlist_soundsDocument as PlaylistSoundsDocument } from '../schemas/playlist_sounds.schema.js';
import { Signal } from '../signals/index.js';
import logger from '../utils/logger.js';
import { getUserId, buildOwnership, isGM, canEdit } from '../middleware/permissions.js';
import { requireAuth, requireWorldMatch } from '../middleware/auth.js';

export const playlistsRouter = Router();
playlistsRouter.use(requireAuth, requireWorldMatch);

function statusFor(error: string): number {
  if (error === 'Not found') return 404;
  return 403;
}

// ─── PLAYLISTS ───────────────────────────────────────────────────────────────

playlistsRouter.get('/', async (req, res) => {
  try {
    const filter: Record<string, any> = { orderBy: 'createdAt', orderDir: 'asc' };
    if (req.query.worldId) filter.worldId = req.query.worldId as string;
    const rows = await PlaylistsDocument.find<any>(filter);
    // A lista não traz `sounds` (só GET /:id traz) — sem a contagem aqui, o
    // badge da sidebar mostrava sempre "0 sounds" quando a playlist estava
    // recolhida, já que o front usa `sounds?.length` e `sounds` só existe
    // depois de expandir pelo menos uma vez.
    const withCounts = await Promise.all(rows.map(async (row: any) => {
      const sounds = await PlaylistSoundsDocument.find({ playlistId: row.id });
      return { ...row, soundCount: sounds.length };
    }));
    res.json(withCounts);
  } catch (err: any) {
    logger.error('GET /api/playlists failed', { error: err.message });
    res.status(500).json({ error: 'Failed to retrieve playlists' });
  }
});

playlistsRouter.get('/:id', async (req, res) => {
  try {
    const row = await PlaylistsDocument.findById<any>(req.params.id);
    if (!row) return res.status(404).json({ error: 'Playlist not found' });
    const sounds = await PlaylistSoundsDocument.find({ playlistId: req.params.id, orderBy: 'sortOrder', orderDir: 'asc' });
    res.json({ ...row, sounds });
  } catch (err: any) {
    logger.error('GET /api/playlists/:id failed', { error: err.message, id: req.params.id });
    res.status(500).json({ error: 'Failed to retrieve playlist' });
  }
});

playlistsRouter.post('/', async (req, res) => {
  const {
    worldId = 'world-1', name, description = '', imgUrl = '',
    mode = 'sequential', volume = 0.5, loop = false, fadeDuration = 2, folderId = '',
  } = req.body;

  if (!name || typeof name !== 'string' || name.trim() === '') {
    return res.status(400).json({ error: 'Field "name" is required and must be a non-empty string.' });
  }

  const userId = getUserId(req);
  const ownership = userId ? buildOwnership(userId) : {};

  try {
    const result = await PlaylistsDocument.create({
      worldId, name: name.trim(), description, imgUrl,
      mode, volume, loop, fadeDuration, folderId, ownership,
    });
    if (result.error) return res.status(400).json({ error: result.error });
    Signal.broadcast('playlist.created', result.data);
    logger.info('Playlist created', { id: result.data.id, name: result.data.name });
    res.status(201).json(result.data);
  } catch (err: any) {
    logger.error('POST /api/playlists failed', { error: err.message, name });
    res.status(500).json({ error: 'Failed to create playlist' });
  }
});

playlistsRouter.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { name, description, imgUrl, mode, volume, loop, fadeDuration, folderId } = req.body;

  const updates: Record<string, any> = {};
  if (name        !== undefined) updates.name        = String(name).trim();
  if (description !== undefined) updates.description  = description;
  if (imgUrl      !== undefined) updates.imgUrl       = imgUrl;
  if (mode        !== undefined) updates.mode         = mode;
  if (volume      !== undefined) updates.volume       = volume;
  if (loop        !== undefined) updates.loop         = !!loop;
  if (fadeDuration !== undefined) updates.fadeDuration = fadeDuration;
  if (folderId    !== undefined) updates.folderId     = folderId;

  try {
    const result = await PlaylistsDocument.update(id, updates, { req });
    if (result.error) return res.status(statusFor(result.error)).json({ error: result.error });

    Signal.broadcast('playlist.updated', result.data);
    logger.info('Playlist updated', { id, updates });
    res.json(result.data);
  } catch (err: any) {
    logger.error('PUT /api/playlists/:id failed', { error: err.message, id });
    res.status(500).json({ error: 'Failed to update playlist' });
  }
});

playlistsRouter.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const existing = await PlaylistsDocument.findById<any>(id);
    if (!existing) return res.status(404).json({ error: 'Playlist not found' });

    const result = await PlaylistsDocument.delete(id, { req });
    if (result.error) return res.status(statusFor(result.error)).json({ error: result.error });

    await PlaylistSoundsDocument.bulkDelete({ playlistId: id });

    Signal.broadcast('playlist.deleted', { id });
    logger.info('Playlist deleted', { id, name: existing.name });
    res.json({ success: true, id });
  } catch (err: any) {
    logger.error('DELETE /api/playlists/:id failed', { error: err.message, id });
    res.status(500).json({ error: 'Failed to delete playlist' });
  }
});

// ─── PLAYLIST SOUNDS ─────────────────────────────────────────────────────────

playlistsRouter.get('/:playlistId/sounds', async (req, res) => {
  try {
    const sounds = await PlaylistSoundsDocument.find({ playlistId: req.params.playlistId, orderBy: 'sortOrder', orderDir: 'asc' });
    res.json(sounds);
  } catch (err: any) {
    logger.error('GET /api/playlists/:playlistId/sounds failed', { error: err.message });
    res.status(500).json({ error: 'Failed to retrieve sounds' });
  }
});

playlistsRouter.post('/:playlistId/sounds', async (req, res) => {
  const { name, path: soundPath, volume = 0.5, loop = false, fadeIn = 0, fadeOut = 0, sortOrder = 0 } = req.body;

  if (!name || typeof name !== 'string' || name.trim() === '') {
    return res.status(400).json({ error: 'Field "name" is required.' });
  }
  if (!soundPath) {
    return res.status(400).json({ error: 'Field "path" is required.' });
  }

  try {
    const playlist = await PlaylistsDocument.findById<any>(req.params.playlistId);
    if (!playlist) return res.status(404).json({ error: 'Playlist not found' });
    if (!isGM(req) && !canEdit(playlist.ownership, getUserId(req))) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const result = await PlaylistSoundsDocument.create({
      playlistId: req.params.playlistId, name: name.trim(), path: soundPath,
      volume, loop: !!loop, fadeIn, fadeOut, sortOrder,
    });
    if (result.error) return res.status(400).json({ error: result.error });
    Signal.broadcast('playlist.sound.created', result.data);
    logger.info('Playlist sound created', { id: result.data.id, playlistId: req.params.playlistId, name: result.data.name });
    res.status(201).json(result.data);
  } catch (err: any) {
    logger.error('POST /api/playlists/:playlistId/sounds failed', { error: err.message, name });
    res.status(500).json({ error: 'Failed to create sound' });
  }
});

playlistsRouter.put('/:playlistId/sounds/:id', async (req, res) => {
  const { playlistId, id } = req.params;
  const { name, path: soundPath, volume, loop, fadeIn, fadeOut, sortOrder } = req.body;

  try {
    const existing = await PlaylistSoundsDocument.findOne<any>({ id, playlistId });
    if (!existing) return res.status(404).json({ error: 'Sound not found' });

    const playlist = await PlaylistsDocument.findById<any>(playlistId);
    if (!playlist) return res.status(404).json({ error: 'Playlist not found' });
    if (!isGM(req) && !canEdit(playlist.ownership, getUserId(req))) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const updates: Record<string, any> = {};
    if (name      !== undefined) updates.name      = String(name).trim();
    if (soundPath !== undefined) updates.path      = soundPath;
    if (volume    !== undefined) updates.volume    = volume;
    if (loop      !== undefined) updates.loop      = !!loop;
    if (fadeIn    !== undefined) updates.fadeIn    = fadeIn;
    if (fadeOut   !== undefined) updates.fadeOut   = fadeOut;
    if (sortOrder !== undefined) updates.sortOrder = sortOrder;

    const result = await PlaylistSoundsDocument.update(id, updates);
    if (result.error) return res.status(statusFor(result.error)).json({ error: result.error });

    Signal.broadcast('playlist.sound.updated', result.data);
    logger.info('Playlist sound updated', { id, playlistId });
    res.json(result.data);
  } catch (err: any) {
    logger.error('PUT /api/playlists/:playlistId/sounds/:id failed', { error: err.message, id });
    res.status(500).json({ error: 'Failed to update sound' });
  }
});

playlistsRouter.delete('/:playlistId/sounds/:id', async (req, res) => {
  const { playlistId, id } = req.params;
  try {
    const existing = await PlaylistSoundsDocument.findOne<any>({ id, playlistId });
    if (!existing) return res.status(404).json({ error: 'Sound not found' });

    const playlist = await PlaylistsDocument.findById<any>(playlistId);
    if (!playlist) return res.status(404).json({ error: 'Playlist not found' });
    if (!isGM(req) && !canEdit(playlist.ownership, getUserId(req))) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await PlaylistSoundsDocument.delete(id);

    Signal.broadcast('playlist.sound.deleted', { id, playlistId });
    logger.info('Playlist sound deleted', { id, playlistId });
    res.json({ success: true, id });
  } catch (err: any) {
    logger.error('DELETE /api/playlists/:playlistId/sounds/:id failed', { error: err.message, id });
    res.status(500).json({ error: 'Failed to delete sound' });
  }
});
