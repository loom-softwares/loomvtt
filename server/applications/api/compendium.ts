import { Router } from 'express';
import { randomUUID } from 'crypto';
import { Signal } from '../signals/index.js';
import { getDataRoot } from '../database/db.js';
import { Compendium_packsDocument } from '../schemas/compendium_packs.schema.js';
import logger from '../utils/logger.js';
import path from 'path';
import fs from 'fs';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/permissions.js';
import { WorldsDocument } from '../schemas/worlds.schema.js';
import { ActorsDocument } from '../schemas/actors.schema.js';
import { ItemsDocument } from '../schemas/items.schema.js';
import { StagesDocument } from '../schemas/stages.schema.js';
import { JournalsDocument } from '../schemas/journals.schema.js';
import { MacrosDocument } from '../schemas/macros.schema.js';
import { PlaylistsDocument } from '../schemas/playlists.schema.js';
import { Playlist_soundsDocument } from '../schemas/playlist_sounds.schema.js';

export const compendiumRouter = Router();
compendiumRouter.use(requireAuth);

/** Rotas por :id não recebem worldId no path/query — `requireWorldMatch` sozinho não
 * pega nada aqui. Sem checar `pack.worldId` contra o token, qualquer usuário
 * autenticado de QUALQUER mundo lê/edita pack de outro mundo só sabendo o id. */
function packBelongsToAuthWorld(req: any, pack: { worldId: string }): boolean {
  return !!req.auth?.admin || pack.worldId === req.auth?.worldId;
}

// GET /api/compendium — list all packs for a world
compendiumRouter.get('/', async (req, res) => {
  try {
    const { worldId } = req.query;
    const filter: Record<string, any> = {};
    if (worldId) filter.worldId = worldId;
    const packs = await Compendium_packsDocument.find({ ...filter, orderBy: 'createdAt', orderDir: 'desc' });
    // Return entries count without the full payload
    const result = packs.map((p: any) => ({
      id: p.id, worldId: p.worldId, name: p.name, type: p.type,
      entryCount: p.entries.length,
      createdAt: p.createdAt, updatedAt: p.updatedAt
    }));
    res.json(result);
  } catch (err: any) {
    logger.error('GET /compendium failed', { error: err.message });
    res.status(500).json({ error: 'Failed to list compendium packs.' });
  }
});

// POST /api/compendium — create a new compendium pack
compendiumRouter.post('/', requirePermission('compendiumEdit'), async (req, res) => {
  try {
    const { id, worldId, name, type } = req.body;
    const result = await Compendium_packsDocument.create({ id, worldId, name, type: type || 'Actor', entries: [] });
    if (result.error) return res.status(400).json({ error: result.error });
    logger.info('Compendium pack created', { id: result.data.id, worldId, name });
    res.status(201).json(result.data);
  } catch (err: any) {
    logger.error('POST /compendium failed', { error: err.message });
    res.status(500).json({ error: 'Failed to create compendium pack.' });
  }
});

// GET /api/compendium/:id — get pack entries
compendiumRouter.get('/:id', async (req, res) => {
  try {
    const pack = await Compendium_packsDocument.findById<any>(req.params.id);
    if (!pack) return res.status(404).json({ error: 'Compendium pack not found.' });
    if (!packBelongsToAuthWorld(req, pack)) return res.status(403).json({ error: 'Compendium pack belongs to a different world.' });
    res.json(pack);
  } catch (err: any) {
    logger.error('GET /compendium/:id failed', { error: err.message });
    res.status(500).json({ error: 'Failed to retrieve compendium entries.' });
  }
});

// PUT /api/compendium/:id — update entries (full replace or append)
compendiumRouter.put('/:id', requirePermission('compendiumEdit'), async (req, res) => {
  try {
    const existing = await Compendium_packsDocument.findById<any>(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Compendium pack not found.' });
    if (!packBelongsToAuthWorld(req, existing)) return res.status(403).json({ error: 'Compendium pack belongs to a different world.' });

    const { entries, folderId, name } = req.body;
    const updates: Record<string, any> = {};
    if (entries !== undefined) {
      if (!Array.isArray(entries)) return res.status(400).json({ error: 'entries must be an array.' });
      updates.entries = entries;
    }
    if (folderId !== undefined) updates.folderId = folderId;
    if (name !== undefined) updates.name = String(name).trim();

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields provided for update.' });
    }

    const result = await Compendium_packsDocument.update(req.params.id, updates);
    if (result.error) return res.status(404).json({ error: result.error });
    res.json({ success: true, count: Array.isArray(entries) ? entries.length : undefined });
  } catch (err: any) {
    logger.error('PUT /compendium/:id failed', { error: err.message });
    res.status(500).json({ error: 'Failed to update compendium pack.' });
  }
});

// DELETE /api/compendium/:id — delete a pack
compendiumRouter.delete('/:id', requirePermission('compendiumEdit'), async (req, res) => {
  try {
    const existing = await Compendium_packsDocument.findById<any>(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Compendium pack not found.' });
    if (!packBelongsToAuthWorld(req, existing)) return res.status(403).json({ error: 'Compendium pack belongs to a different world.' });
    await Compendium_packsDocument.delete(req.params.id);
    res.json({ success: true });
  } catch (err: any) {
    logger.error('DELETE /compendium/:id failed', { error: err.message });
    res.status(500).json({ error: 'Failed to delete compendium pack.' });
  }
});

// GET /api/compendium/:packId/entries/:entryId — Virtual entry endpoint to simulate real document API
compendiumRouter.get('/:packId/entries/:entryId', async (req, res) => {
  try {
    const pack = await Compendium_packsDocument.findById<any>(req.params.packId);
    if (!pack) return res.status(404).json({ error: 'Compendium pack not found.' });
    if (!packBelongsToAuthWorld(req, pack)) return res.status(403).json({ error: 'Compendium pack belongs to a different world.' });

    const entry = pack.entries.find((e: any) => e.id === req.params.entryId);
    if (!entry) return res.status(404).json({ error: 'Entry not found.' });

    if (pack.type === 'Actor') {
      return res.json({ id: entry.id, name: entry.name, type: entry.type, systemData: entry.data || {}, imgUrl: entry.imgUrl, ownership: entry.ownership, worldId: pack.worldId });
    } else if (pack.type === 'Item') {
      return res.json({ id: entry.id, name: entry.name, type: entry.type, data: entry.data || {}, imgUrl: entry.imgUrl, ownership: entry.ownership, worldId: pack.worldId });
    } else if (pack.type === 'JournalEntry' || pack.type === 'Journal') {
      return res.json({ id: entry.id, name: entry.name, type: entry.type, pages: entry.data?.pages || [], ownership: entry.ownership, worldId: pack.worldId });
    } else {
      return res.json({ id: entry.id, name: entry.name, type: entry.type, data: entry.data || {}, imgUrl: entry.imgUrl, ownership: entry.ownership, worldId: pack.worldId });
    }
  } catch (err: any) {
    logger.error('GET /compendium/entries failed', { error: err.message });
    res.status(500).json({ error: 'Failed to retrieve entry.' });
  }
});

// PUT /api/compendium/:packId/entries/:entryId — Virtual entry endpoint to save from real document sheets
compendiumRouter.put('/:packId/entries/:entryId', requirePermission('compendiumEdit'), async (req, res) => {
  try {
    const pack = await Compendium_packsDocument.findById<any>(req.params.packId);
    if (!pack) return res.status(404).json({ error: 'Compendium pack not found.' });
    if (!packBelongsToAuthWorld(req, pack)) return res.status(403).json({ error: 'Compendium pack belongs to a different world.' });

    const entryIndex = pack.entries.findIndex((e: any) => e.id === req.params.entryId);
    if (entryIndex === -1) return res.status(404).json({ error: 'Entry not found.' });

    const entry = pack.entries[entryIndex];
    const updatePayload = req.body;

    if (updatePayload.name !== undefined) entry.name = updatePayload.name;
    
    // Extract data depending on pack type
    entry.data = entry.data || {};
    if (pack.type === 'Actor' && updatePayload.systemData !== undefined) {
      entry.data = updatePayload.systemData; // LoomDocumentSheet sends the whole systemData object
    } else if (pack.type === 'Item' && updatePayload.data !== undefined) {
      entry.data = updatePayload.data;
    } else if ((pack.type === 'JournalEntry' || pack.type === 'Journal') && updatePayload.pages !== undefined) {
      entry.data.pages = updatePayload.pages;
    } else if (updatePayload.data !== undefined) {
      entry.data = updatePayload.data;
    }

    if (updatePayload.imgUrl !== undefined) entry.imgUrl = updatePayload.imgUrl;

    pack.entries[entryIndex] = entry;

    const result = await Compendium_packsDocument.update(req.params.packId, { entries: pack.entries });
    if (result.error) return res.status(500).json({ error: result.error });

    let responsePayload;
    if (pack.type === 'Actor') {
      responsePayload = { id: entry.id, name: entry.name, type: entry.type, systemData: entry.data, imgUrl: entry.imgUrl, ownership: entry.ownership, worldId: pack.worldId };
    } else if (pack.type === 'Item') {
      responsePayload = { id: entry.id, name: entry.name, type: entry.type, data: entry.data, imgUrl: entry.imgUrl, ownership: entry.ownership, worldId: pack.worldId };
    } else if (pack.type === 'JournalEntry' || pack.type === 'Journal') {
      responsePayload = { id: entry.id, name: entry.name, type: entry.type, pages: entry.data?.pages || [], ownership: entry.ownership, worldId: pack.worldId };
    } else {
      responsePayload = { id: entry.id, name: entry.name, type: entry.type, data: entry.data, imgUrl: entry.imgUrl, ownership: entry.ownership, worldId: pack.worldId };
    }
    
    // Transmitir WebSocket de atualização de entrada para os clients
    Signal.broadcast('compendium.entry.updated', { packId: pack.id, entry: responsePayload });
    
    return res.json(responsePayload);
  } catch (err: any) {
    logger.error('PUT /compendium/entries failed', { error: err.message });
    res.status(500).json({ error: 'Failed to update entry.' });
  }
});

// POST /api/compendium/:id/import — import entries from a JSON file on disk
compendiumRouter.post('/:id/import', requirePermission('compendiumEdit'), async (req, res) => {
  try {
    const { filePath: importPath } = req.body;
    if (!importPath) return res.status(400).json({ error: 'filePath required.' });

    const pack = await Compendium_packsDocument.findById<any>(req.params.id);
    if (!pack) return res.status(404).json({ error: 'Compendium pack not found.' });
    if (!packBelongsToAuthWorld(req, pack)) return res.status(403).json({ error: 'Compendium pack belongs to a different world.' });

    const worldCompendiumDir = path.resolve(getDataRoot(), 'worlds', pack.worldId, 'packs');
    if (!fs.existsSync(worldCompendiumDir)) {
      fs.mkdirSync(worldCompendiumDir, { recursive: true });
    }

    const fullPath = path.resolve(worldCompendiumDir, importPath);
    if (!fullPath.startsWith(worldCompendiumDir)) return res.status(403).json({ error: 'Access denied.' });
    if (!fs.existsSync(fullPath)) return res.status(404).json({ error: 'File not found.' });

    const content = fs.readFileSync(fullPath, 'utf-8');
    const imported = JSON.parse(content);
    const entries = Array.isArray(imported) ? imported : [imported];
    const existing = pack.entries as any[];
    existing.push(...entries);
    await Compendium_packsDocument.update(req.params.id, { entries: existing });
    res.json({ success: true, importedCount: entries.length, totalCount: existing.length });
  } catch (err: any) {
    logger.error('POST /compendium/:id/import failed', { error: err.message });
    res.status(500).json({ error: 'Failed to import compendium entries.' });
  }
});

// POST /api/compendium/:id/export — export pack entries to a JSON file on disk
compendiumRouter.post('/:id/export', requirePermission('compendiumEdit'), async (req, res) => {
  try {
    const { fileName } = req.body;
    if (!fileName) return res.status(400).json({ error: 'fileName required.' });
    const safeName = path.basename(fileName).replace(/[^a-zA-Z0-9_\-\.]/g, '');

    const pack = await Compendium_packsDocument.findById<any>(req.params.id);
    if (!pack) return res.status(404).json({ error: 'Compendium pack not found.' });
    if (!packBelongsToAuthWorld(req, pack)) return res.status(403).json({ error: 'Compendium pack belongs to a different world.' });

    const worldCompendiumDir = path.resolve(getDataRoot(), 'worlds', pack.worldId, 'packs');
    if (!fs.existsSync(worldCompendiumDir)) {
      fs.mkdirSync(worldCompendiumDir, { recursive: true });
    }

    const outPath = path.resolve(worldCompendiumDir, safeName);
    if (!outPath.startsWith(worldCompendiumDir)) return res.status(403).json({ error: 'Access denied.' });
    fs.writeFileSync(outPath, JSON.stringify(pack.entries, null, 2), 'utf-8');
    res.json({ success: true, path: safeName });
  } catch (err: any) {
    logger.error('POST /compendium/:id/export failed', { error: err.message });
    res.status(500).json({ error: 'Failed to export compendium entries.' });
  }
});

// Helper: Seed compendiums from system ruleset.json
/** POST /api/compendium/:id/adventure-entry — snapshots selected world documents into one
 * bundled entry (Adventure pack type). Actors carry their owned items along; playlists carry
 * their sounds. Stages are captured WITHOUT their placeables (cast/walls/lights/tiles/notes/
 * drawings) — those reference other documents by id and would need full remapping on import,
 * which this pass doesn't do. Stages import as blank maps; content is added back manually. */
compendiumRouter.post('/:id/adventure-entry', requirePermission('compendiumEdit'), async (req, res) => {
  try {
    const pack = await Compendium_packsDocument.findById<any>(req.params.id);
    if (!pack) return res.status(404).json({ error: 'Compendium pack not found.' });
    if (!packBelongsToAuthWorld(req, pack)) return res.status(403).json({ error: 'Compendium pack belongs to a different world.' });
    if (pack.type !== 'Adventure') return res.status(400).json({ error: 'Pack is not an Adventure pack.' });

    const { name, actorIds = [], itemIds = [], stageIds = [], journalIds = [], macroIds = [], playlistIds = [] } = req.body;
    if (!name || typeof name !== 'string' || name.trim() === '') {
      return res.status(400).json({ error: 'Field "name" is required.' });
    }

    const worldId = pack.worldId;
    // `ownership` não viaja no bundle — quem reimportar deve ficar dono de uma cópia nova,
    // não herdar a permissão de quem empacotou (também evita propagar um valor já
    // double-encoded, se a linha de origem tiver esse bug de dado antigo).
    const strip = (doc: Record<string, any>) => {
      const { id, createdAt, updatedAt, worldId: _w, ownership: _o, ...rest } = doc;
      return rest;
    };

    const actors: any[] = [];
    for (const actorId of actorIds) {
      const actor = await ActorsDocument.findById<any>(actorId);
      if (!actor || actor.worldId !== worldId) continue;
      const ownedItems = await ItemsDocument.find<any>({ worldId, actorId });
      const { items: _items, ...actorFields } = strip(actor);
      actors.push({ ...actorFields, _embeddedItems: ownedItems.map((i: any) => { const { effects: _e, ...rest } = strip(i); return rest; }) });
    }

    const items: any[] = [];
    for (const itemId of itemIds) {
      const item = await ItemsDocument.findById<any>(itemId);
      if (!item || item.worldId !== worldId) continue;
      if (actorIds.includes(item.actorId)) continue; // já vai embutido no bundle do ator dono
      const { effects: _effects, ...itemFields } = strip(item);
      items.push(itemFields);
    }

    const stages: any[] = [];
    for (const stageId of stageIds) {
      const stage = await StagesDocument.findById<any>(stageId);
      if (!stage || stage.worldId !== worldId) continue;
      const { tokens: _tokens, isActive: _active, ...stageFields } = strip(stage);
      stages.push(stageFields);
    }

    const journals: any[] = [];
    for (const journalId of journalIds) {
      const journal = await JournalsDocument.findById<any>(journalId);
      if (!journal || journal.worldId !== worldId) continue;
      journals.push(strip(journal));
    }

    const macros: any[] = [];
    for (const macroId of macroIds) {
      const macro = await MacrosDocument.findById<any>(macroId);
      if (!macro || macro.worldId !== worldId) continue;
      macros.push(strip(macro));
    }

    const playlists: any[] = [];
    for (const playlistId of playlistIds) {
      const playlist = await PlaylistsDocument.findById<any>(playlistId);
      if (!playlist || playlist.worldId !== worldId) continue;
      const sounds = await Playlist_soundsDocument.find<any>({ playlistId });
      const strippedSounds = sounds.map((s: any) => {
        const { id, playlistId: _p, createdAt, updatedAt, ...rest } = s;
        return rest;
      });
      const { sounds: _sounds, ...playlistFields } = strip(playlist);
      playlists.push({ ...playlistFields, _embeddedSounds: strippedSounds });
    }

    const entry = {
      id: randomUUID(),
      name: name.trim(),
      type: 'Adventure',
      data: { actors, items, stages, journals, macros, playlists },
    };

    const entries = [...(pack.entries || []), entry];
    const result = await Compendium_packsDocument.update(pack.id, { entries });
    if (result.error) return res.status(400).json({ error: result.error });

    logger.info('Adventure entry bundled', {
      packId: pack.id, entryId: entry.id,
      counts: { actors: actors.length, items: items.length, stages: stages.length, journals: journals.length, macros: macros.length, playlists: playlists.length },
    });
    res.status(201).json(entry);
  } catch (err: any) {
    logger.error('POST /compendium/:id/adventure-entry failed', { error: err.message });
    res.status(500).json({ error: 'Failed to bundle adventure entry.' });
  }
});

/** POST /api/compendium/:id/adventure-entry/:entryId/import — recreates the bundled documents
 * in the pack's world as fresh documents (new ids — no cross-reference remapping inside
 * systemData/data, same simplification as the bundling route above). */
compendiumRouter.post('/:id/adventure-entry/:entryId/import', requirePermission('compendiumEdit'), async (req, res) => {
  try {
    const pack = await Compendium_packsDocument.findById<any>(req.params.id);
    if (!pack) return res.status(404).json({ error: 'Compendium pack not found.' });
    if (!packBelongsToAuthWorld(req, pack)) return res.status(403).json({ error: 'Compendium pack belongs to a different world.' });
    if (pack.type !== 'Adventure') return res.status(400).json({ error: 'Pack is not an Adventure pack.' });

    const entry = (pack.entries || []).find((e: any) => e.id === req.params.entryId);
    if (!entry) return res.status(404).json({ error: 'Entry not found.' });

    const worldId = pack.worldId;
    const bundle = entry.data || {};
    const created = { actors: 0, items: 0, stages: 0, journals: 0, macros: 0, playlists: 0 };

    for (const actorData of bundle.actors || []) {
      const { _embeddedItems, ...actorFields } = actorData;
      const result = await ActorsDocument.create({ ...actorFields, worldId });
      if (result.error) continue;
      created.actors++;
      for (const itemData of _embeddedItems || []) {
        const itemResult = await ItemsDocument.create({ ...itemData, worldId, actorId: result.data.id });
        if (!itemResult.error) { created.items++; Signal.broadcast('item.created', itemResult.data); }
      }
    }

    for (const itemData of bundle.items || []) {
      const result = await ItemsDocument.create({ ...itemData, worldId, actorId: '' });
      if (!result.error) { created.items++; Signal.broadcast('item.created', result.data); }
    }

    for (const stageData of bundle.stages || []) {
      const result = await StagesDocument.create({ ...stageData, worldId, isActive: false });
      if (!result.error) created.stages++;
    }

    for (const journalData of bundle.journals || []) {
      const result = await JournalsDocument.create({ ...journalData, worldId });
      if (!result.error) { created.journals++; Signal.broadcast('journal.created', result.data); }
    }

    for (const macroData of bundle.macros || []) {
      const result = await MacrosDocument.create({ ...macroData, worldId, slot: -1 });
      if (!result.error) created.macros++;
    }

    for (const playlistData of bundle.playlists || []) {
      const { _embeddedSounds, ...playlistFields } = playlistData;
      const result = await PlaylistsDocument.create({ ...playlistFields, worldId });
      if (result.error) continue;
      created.playlists++;
      Signal.broadcast('playlist.created', result.data);
      for (const soundData of _embeddedSounds || []) {
        await Playlist_soundsDocument.create({ ...soundData, playlistId: result.data.id });
      }
    }

    logger.info('Adventure entry imported', { packId: pack.id, entryId: entry.id, created });
    res.json({ success: true, created });
  } catch (err: any) {
    logger.error('POST /compendium/:id/adventure-entry/:entryId/import failed', { error: err.message });
    res.status(500).json({ error: 'Failed to import adventure entry.' });
  }
});

export async function seedSystemCompendiums(worldId: string): Promise<number> {
  let count = 0;
  try {
    const world = await WorldsDocument.findById<any>(worldId);
    if (!world || !world.system || world.system === 'generic') return 0;
    
    const marketplaceRoot = path.join(getDataRoot(), 'marketplace');
    const rulesetDir = path.join(marketplaceRoot, 'rulesets', world.system);
    const manifestPath = path.join(rulesetDir, 'ruleset.json');
    
    if (!fs.existsSync(manifestPath)) return 0;
    
    const manifestRaw = fs.readFileSync(manifestPath, 'utf-8');
    const manifest = JSON.parse(manifestRaw);
    
    if (!manifest.compendiums || !Array.isArray(manifest.compendiums)) return 0;
    
    for (const relPath of manifest.compendiums) {
      try {
        const packPath = path.resolve(rulesetDir, relPath);
        if (!packPath.startsWith(rulesetDir) || !fs.existsSync(packPath)) {
          logger.warn(`Compendium pack not found: ${relPath}`);
          continue;
        }
        
        const packDataRaw = fs.readFileSync(packPath, 'utf-8');
        const packData = JSON.parse(packDataRaw);
        
        if (!packData.name || !packData.entries) {
          logger.warn(`Invalid compendium pack format in ${relPath}`);
          continue;
        }
        
        const existing = await Compendium_packsDocument.find({ worldId, name: packData.name });
        if (existing.length > 0) continue; 
        
        const result = await Compendium_packsDocument.create({
          worldId,
          name: packData.name,
          type: packData.type || 'Item',
          entries: packData.entries
        });
        
        if (!result.error) {
          logger.info(`Seeded system compendium "${packData.name}"`, { worldId, system: world.system });
          count++;
        } else {
          logger.error(`Error saving compendium ${packData.name}`, { error: result.error });
        }
      } catch (packErr: any) {
        logger.error(`Error processing compendium pack ${relPath}`, { error: packErr.message });
      }
    }
  } catch (err: any) {
    logger.error('Failed to seed system compendiums', { worldId, error: err.message });
  }
  return count;
}

// POST /api/compendium/restore-from-system — GM manual restore
compendiumRouter.post('/restore-from-system', requirePermission('compendiumEdit'), async (req, res) => {
  try {
    const { worldId } = req.body;
    if (!worldId) return res.status(400).json({ error: 'worldId is required' });
    
    const count = await seedSystemCompendiums(worldId);
    res.json({ success: true, count });
  } catch (err: any) {
    logger.error('POST /compendium/restore-from-system failed', { error: err.message });
    res.status(500).json({ error: 'Failed to restore system compendiums.' });
  }
});

