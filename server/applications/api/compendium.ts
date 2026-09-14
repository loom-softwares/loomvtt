import { Router } from 'express';
import { randomUUID } from 'crypto';
import path from 'path';
import fs from 'fs';
import { Signal } from '../signals/index.js';
import { getDataRoot } from '../database/db.js';
import { Compendium_packsDocument } from '../schemas/compendium_packs.schema.js';
import { Compendium_entriesDocument } from '../schemas/compendium_entries.schema.js';
import { FoldersDocument } from '../schemas/folders.schema.js';
import logger from '../utils/logger.js';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission, requireGM } from '../middleware/permissions.js';
import { ActorsDocument } from '../schemas/actors.schema.js';
import { ItemsDocument } from '../schemas/items.schema.js';
import { StagesDocument } from '../schemas/stages.schema.js';
import { JournalsDocument } from '../schemas/journals.schema.js';
import { MacrosDocument } from '../schemas/macros.schema.js';
import { PlaylistsDocument } from '../schemas/playlists.schema.js';
import { Playlist_soundsDocument } from '../schemas/playlist_sounds.schema.js';
import { listSourcePacks, getSourcePackMeta, querySourceEntries, getSourceEntry, setSourceLock, updateSourceEntry, listSourceFolders, createSourceFolder, updateSourceFolder, deleteSourceFolder } from '../addons/compendium-source.js';

export const compendiumRouter = Router();
compendiumRouter.use(requireAuth);

/** Rotas por :id não recebem worldId no path/query — `requireWorldMatch` sozinho não
 * pega nada aqui. Sem checar `pack.worldId` contra o token, qualquer usuário
 * autenticado de QUALQUER mundo lê/edita pack de outro mundo só sabendo o id. */
function packBelongsToAuthWorld(req: any, pack: { worldId: string }): boolean {
  return !!req.auth?.admin || pack.worldId === req.auth?.worldId;
}

/** Carrega um pack + suas entries (join manual, já que moram em tabelas
 * separadas — ver project_compendio_arquitetura_2026_09_08). Mantém o mesmo
 * formato de resposta que o client já espera (`pack.entries` como array). */
async function loadPackWithEntries(packId: string): Promise<any | null> {
  const pack = await Compendium_packsDocument.findById<any>(packId);
  if (!pack) return null;
  const entries = await Compendium_entriesDocument.find<any>({ packId, orderBy: 'sortOrder' });
  const folders = await FoldersDocument.find<any>({ type: 'compendium-entry', packId, orderBy: 'createdAt', orderDir: 'asc' });
  return { ...pack, entries, folders };
}

// GET /api/compendium — list all packs for a world
compendiumRouter.get('/', async (req, res) => {
  try {
    const { worldId } = req.query;
    const filter: Record<string, any> = {};
    if (worldId) filter.worldId = worldId;
    const packs = await Compendium_packsDocument.find({ ...filter, orderBy: 'createdAt', orderDir: 'desc' });
    const result = await Promise.all(packs.map(async (p: any) => ({
      id: p.id, worldId: p.worldId, name: p.name, type: p.type,
      entryCount: await Compendium_entriesDocument.count({ packId: p.id }),
      createdAt: p.createdAt, updatedAt: p.updatedAt
    })));
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
    const result = await Compendium_packsDocument.create({ id, worldId, name, type: type || 'Actor' });
    if (result.error) return res.status(400).json({ error: result.error });
    logger.info('Compendium pack created', { id: result.data.id, worldId, name });
    res.status(201).json({ ...result.data, entries: [] });
  } catch (err: any) {
    logger.error('POST /compendium failed', { error: err.message });
    res.status(500).json({ error: 'Failed to create compendium pack.' });
  }
});

// ── Fontes de addon/ruleset (leitura direta, sem copiar pro mundo) ─────────────
// Ver project_compendio_arquitetura_2026_09_08: navegar um compêndio de addon
// nunca duplica o conteúdo no banco do mundo. Só "sources/.../import" materializa
// UMA entry específica (o GM usando algo em jogo), nunca o pack inteiro.
// Precisa vir ANTES de "/:id" — senão o Express trata "sources" como um :id.

// GET /api/compendium/sources — list live compendium sources from active addons/rulesets
// Requer compendiumEdit: fontes remotas (Postgres/Supabase de terceiro) fazem proxy com
// a apiKey do servidor — sem essa checagem, qualquer jogador logado consegue usar essas
// rotas em loop pra fazer nosso servidor dumpar o pack pago inteiro, não só o GM.
compendiumRouter.get('/sources', requirePermission('compendiumEdit'), async (req, res) => {
  try {
    const sources = await listSourcePacks();
    res.json(sources.map(s => ({ sourceId: s.sourceId, name: s.name, type: s.type, ownerName: s.ownerName, ownerType: s.ownerType, locked: s.locked })));
  } catch (err: any) {
    logger.error('GET /compendium/sources failed', { error: err.message });
    res.status(500).json({ error: 'Failed to list compendium sources.' });
  }
});

// GET /api/compendium/sources/:sourceId/entries — lightweight entry list (no `data`) + folders
compendiumRouter.get('/sources/:sourceId/entries', requirePermission('compendiumEdit'), async (req, res) => {
  try {
    const meta = await getSourcePackMeta(req.params.sourceId);
    if (!meta) return res.status(404).json({ error: 'Compendium source not found.' });
    const [entries, folders] = await Promise.all([
      querySourceEntries(req.params.sourceId, { search: req.query.search as string | undefined }),
      listSourceFolders(req.params.sourceId),
    ]);
    res.json({ sourceId: meta.sourceId, name: meta.name, type: meta.type, locked: meta.locked, entries, folders });
  } catch (err: any) {
    logger.error('GET /compendium/sources/:sourceId/entries failed', { error: err.message });
    res.status(500).json({ error: 'Failed to read compendium source.' });
  }
});

// GET /api/compendium/sources/:sourceId/entries/:entryId — full entry (with `data`)
// Formato "cru" (id/name/type/sortOrder/imgUrl/folderId/data) — usado pelo
// payload de drag-and-drop (`buildDragPayload` em compendium-source-window.ts),
// que já funciona hoje pra arrastar Actor/Item pro canvas/ficha. NÃO
// reformatar por tipo aqui — quem precisa do formato de documento real
// (systemData pra Actor, pages pra Journal) usa a rota `entries-sheet`
// abaixo, dedicada a isso.
compendiumRouter.get('/sources/:sourceId/entries/:entryId', requirePermission('compendiumEdit'), async (req, res) => {
  try {
    const entry = await getSourceEntry(req.params.sourceId, req.params.entryId);
    if (!entry) return res.status(404).json({ error: 'Entry not found.' });
    res.json(entry);
  } catch (err: any) {
    logger.error('GET /compendium/sources/:sourceId/entries/:entryId failed', { error: err.message });
    res.status(500).json({ error: 'Failed to read compendium entry.' });
  }
});

// POST /api/compendium/sources/:sourceId/entries/:entryId/import — materialize ONE entry
// into a world compendium pack. Creates the destination pack on first use (1 per
// source per world), then inserts a single row — never the rest of the source pack.
compendiumRouter.post('/sources/:sourceId/entries/:entryId/import', requirePermission('compendiumEdit'), async (req, res) => {
  try {
    const { worldId } = req.body;
    if (!worldId) return res.status(400).json({ error: 'worldId is required.' });
    if (!req.auth?.admin && worldId !== req.auth?.worldId) return res.status(403).json({ error: 'Access denied.' });

    const meta = await getSourcePackMeta(req.params.sourceId);
    if (!meta) return res.status(404).json({ error: 'Compendium source not found.' });
    const entry = await getSourceEntry(req.params.sourceId, req.params.entryId);
    if (!entry) return res.status(404).json({ error: 'Entry not found.' });

    let pack = (await Compendium_packsDocument.find<any>({ worldId, name: meta.name }))[0];
    if (!pack) {
      const created = await Compendium_packsDocument.create({ worldId, name: meta.name, type: meta.type });
      if (created.error) return res.status(400).json({ error: created.error });
      pack = created.data;
    }

    const result = await Compendium_entriesDocument.create({
      packId: pack.id,
      worldId,
      name: entry.name,
      type: entry.type,
      sortOrder: entry.sortOrder,
      imgUrl: entry.imgUrl,
      data: entry.data,
    });
    if (result.error) return res.status(400).json({ error: result.error });

    logger.info('Compendium entry materialized from source', { sourceId: req.params.sourceId, entryId: req.params.entryId, packId: pack.id, worldId });
    res.status(201).json({ packId: pack.id, entry: result.data });
  } catch (err: any) {
    logger.error('POST /compendium/sources/:sourceId/entries/:entryId/import failed', { error: err.message });
    res.status(500).json({ error: 'Failed to import compendium entry.' });
  }
});

// ── Cadeado + edição direta do pack de fonte (destrava a base compartilhada) ──
// `pack_meta.locked` vive no PRÓPRIO .sqlite (ver compendium-source.ts) — não é um
// registro por mundo. `requireGM` (não `requirePermission`) de propósito: destravar
// afeta TODO mundo que usa este addon/ruleset instalado, então isso não é delegável
// pra um role configurável — só quem já é GM de verdade.

// POST /api/compendium/sources/:sourceId/lock — trava/destrava o pack inteiro
compendiumRouter.post('/sources/:sourceId/lock', requireGM, async (req, res) => {
  try {
    const { locked } = req.body;
    if (typeof locked !== 'boolean') return res.status(400).json({ error: '"locked" (boolean) is required.' });

    const ok = await setSourceLock(req.params.sourceId, locked);
    if (!ok) return res.status(404).json({ error: 'Compendium source not found or not editable.' });

    Signal.broadcast('compendium.sourceLockChanged', { sourceId: req.params.sourceId, locked });
    logger.info('Compendium source lock changed', { sourceId: req.params.sourceId, locked, userId: req.auth?.userId });
    res.json({ sourceId: req.params.sourceId, locked });
  } catch (err: any) {
    logger.error('POST /compendium/sources/:sourceId/lock failed', { error: err.message });
    res.status(500).json({ error: 'Failed to change compendium source lock.' });
  }
});

// GET/PUT /api/compendium/sources/:sourceId/entries-sheet/:entryId — the same entry,
// through the generic document contract a real sheet reads/writes (`apiRoute` +
// `/${id}` for BOTH verbs — that's why this needs its own path segment
// ("entries-sheet", not "entries"): a sheet can't ask GET and PUT to hit two
// differently-shaped routes under the same base. Kept fully separate from
// `/entries/:entryId` above (raw shape, used by the drag-and-drop payload) so
// this reshape can never ripple into that already-working path.
//
// GET mirrors GET /:packId/entries/:entryId (world-materialized packs, line
// ~352) field-for-field: Actor gets `systemData`, Item/others get `data`,
// Journal gets `pages`. PUT mirrors PUT /:packId/entries/:entryId (~377) the
// same way, so `LoomDocumentSheet`'s save (whichever shape it sends per
// document type) lands correctly, and is gated by `pack_meta.locked` — every
// world using this addon/ruleset shares the same write, so only a real GM
// (`requireGM`, not the delegable `compendiumEdit`) may trigger it.
compendiumRouter.get('/sources/:sourceId/entries-sheet/:entryId', requirePermission('compendiumEdit'), async (req, res) => {
  try {
    const meta = await getSourcePackMeta(req.params.sourceId);
    if (!meta) return res.status(404).json({ error: 'Compendium source not found.' });
    const entry = await getSourceEntry(req.params.sourceId, req.params.entryId);
    if (!entry) return res.status(404).json({ error: 'Entry not found.' });

    const base = { id: entry.id, name: entry.name, type: entry.type, imgUrl: entry.imgUrl, ownership: {}, worldId: req.query.worldId ?? '' };
    if (meta.type === 'Actor') {
      return res.json({ ...base, systemData: entry.data || {} });
    } else if (meta.type === 'JournalEntry' || meta.type === 'Journal') {
      return res.json({ ...base, pages: entry.data?.pages || [] });
    }
    res.json({ ...base, data: entry.data || {} });
  } catch (err: any) {
    logger.error('GET /compendium/sources/:sourceId/entries-sheet/:entryId failed', { error: err.message });
    res.status(500).json({ error: 'Failed to read compendium entry.' });
  }
});

compendiumRouter.put('/sources/:sourceId/entries-sheet/:entryId', requireGM, async (req, res) => {
  try {
    const meta = await getSourcePackMeta(req.params.sourceId);
    if (!meta) return res.status(404).json({ error: 'Compendium source not found.' });
    if (meta.locked) return res.status(403).json({ error: 'Compendium source is locked. Unlock it first.' });

    const payload = req.body;
    const patch: Record<string, any> = {};
    if (payload.name !== undefined) patch.name = payload.name;
    if (payload.imgUrl !== undefined) patch.imgUrl = payload.imgUrl;
    // Mesma lógica de PUT /:packId/entries/:entryId (~394-400): cada tipo de
    // documento manda seu campo de dado com um nome diferente, mas o `.sqlite`
    // só tem UMA coluna `data` — normaliza os três pro mesmo destino.
    if (meta.type === 'Actor' && payload.systemData !== undefined) {
      patch.data = payload.systemData;
    } else if ((meta.type === 'JournalEntry' || meta.type === 'Journal') && payload.pages !== undefined) {
      patch.data = { pages: payload.pages };
    } else if (payload.data !== undefined) {
      patch.data = payload.data;
    }

    const ok = await updateSourceEntry(req.params.sourceId, req.params.entryId, patch);
    if (!ok) return res.status(404).json({ error: 'Entry not found.' });

    Signal.broadcast('compendium.sourceEntryUpdated', { sourceId: req.params.sourceId, entryId: req.params.entryId });
    logger.info('Compendium source entry edited', { sourceId: req.params.sourceId, entryId: req.params.entryId, userId: req.auth?.userId });

    // Devolve no mesmo formato do GET — o save de LoomDocumentSheet costuma
    // usar a resposta pra atualizar o documento em memória sem precisar de um
    // segundo round-trip.
    const entry = await getSourceEntry(req.params.sourceId, req.params.entryId);
    const base = { id: req.params.entryId, name: entry?.name, type: entry?.type, imgUrl: entry?.imgUrl, ownership: {}, worldId: req.query.worldId ?? '' };
    if (meta.type === 'Actor') return res.json({ ...base, systemData: entry?.data || {} });
    if (meta.type === 'JournalEntry' || meta.type === 'Journal') return res.json({ ...base, pages: entry?.data?.pages || [] });
    res.json({ ...base, data: entry?.data || {} });
  } catch (err: any) {
    logger.error('PUT /compendium/sources/:sourceId/entries-sheet/:entryId failed', { error: err.message });
    res.status(500).json({ error: 'Failed to update compendium entry.' });
  }
});

// ── Pastas dentro de um pack de fonte ─────────────────────────────────────────
// Vivem na PRÓPRIA `.sqlite` do pack (ver compendium-source.ts::ensureFolderSchema),
// não na tabela `folders` central (essa é por mundo; o pack não pertence a
// nenhum). Espelham server/applications/api/folders.ts campo a campo, menos
// worldId/type. Mesmo gate de POST /lock: requireGM (não compendiumEdit —
// reorganizar afeta todo mundo que usa este addon/ruleset) + pack destravado
// (mexer na estrutura também é escrever no arquivo compartilhado).

compendiumRouter.post('/sources/:sourceId/folders', requireGM, async (req, res) => {
  try {
    const meta = await getSourcePackMeta(req.params.sourceId);
    if (!meta) return res.status(404).json({ error: 'Compendium source not found.' });
    if (meta.locked) return res.status(403).json({ error: 'Compendium source is locked. Unlock it first.' });

    const { folder, error } = await createSourceFolder(req.params.sourceId, req.body);
    if (error) return res.status(400).json({ error });

    Signal.broadcast('compendium.sourceFolderChanged', { sourceId: req.params.sourceId });
    logger.info('Compendium source folder created', { sourceId: req.params.sourceId, folderId: folder?.id, userId: req.auth?.userId });
    res.status(201).json(folder);
  } catch (err: any) {
    logger.error('POST /compendium/sources/:sourceId/folders failed', { error: err.message });
    res.status(500).json({ error: 'Failed to create compendium folder.' });
  }
});

compendiumRouter.put('/sources/:sourceId/folders/:folderId', requireGM, async (req, res) => {
  try {
    const meta = await getSourcePackMeta(req.params.sourceId);
    if (!meta) return res.status(404).json({ error: 'Compendium source not found.' });
    if (meta.locked) return res.status(403).json({ error: 'Compendium source is locked. Unlock it first.' });

    const { folder, error } = await updateSourceFolder(req.params.sourceId, req.params.folderId, req.body);
    if (error) return res.status(error === 'Folder not found.' ? 404 : 400).json({ error });

    Signal.broadcast('compendium.sourceFolderChanged', { sourceId: req.params.sourceId });
    logger.info('Compendium source folder updated', { sourceId: req.params.sourceId, folderId: req.params.folderId, userId: req.auth?.userId });
    res.json(folder);
  } catch (err: any) {
    logger.error('PUT /compendium/sources/:sourceId/folders/:folderId failed', { error: err.message });
    res.status(500).json({ error: 'Failed to update compendium folder.' });
  }
});

compendiumRouter.delete('/sources/:sourceId/folders/:folderId', requireGM, async (req, res) => {
  try {
    const meta = await getSourcePackMeta(req.params.sourceId);
    if (!meta) return res.status(404).json({ error: 'Compendium source not found.' });
    if (meta.locked) return res.status(403).json({ error: 'Compendium source is locked. Unlock it first.' });

    const ok = await deleteSourceFolder(req.params.sourceId, req.params.folderId);
    if (!ok) return res.status(404).json({ error: 'Folder not found.' });

    Signal.broadcast('compendium.sourceFolderChanged', { sourceId: req.params.sourceId });
    logger.info('Compendium source folder deleted', { sourceId: req.params.sourceId, folderId: req.params.folderId, userId: req.auth?.userId });
    res.json({ success: true, id: req.params.folderId });
  } catch (err: any) {
    logger.error('DELETE /compendium/sources/:sourceId/folders/:folderId failed', { error: err.message });
    res.status(500).json({ error: 'Failed to delete compendium folder.' });
  }
});

// GET /api/compendium/:id — get pack + entries
compendiumRouter.get('/:id', async (req, res) => {
  try {
    const pack = await loadPackWithEntries(req.params.id);
    if (!pack) return res.status(404).json({ error: 'Compendium pack not found.' });
    if (!packBelongsToAuthWorld(req, pack)) return res.status(403).json({ error: 'Compendium pack belongs to a different world.' });
    res.json(pack);
  } catch (err: any) {
    logger.error('GET /compendium/:id failed', { error: err.message });
    res.status(500).json({ error: 'Failed to retrieve compendium entries.' });
  }
});

// PUT /api/compendium/:id — update pack metadata and/or full entry list (replace)
compendiumRouter.put('/:id', requirePermission('compendiumEdit'), async (req, res) => {
  try {
    const existing = await Compendium_packsDocument.findById<any>(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Compendium pack not found.' });
    if (!packBelongsToAuthWorld(req, existing)) return res.status(403).json({ error: 'Compendium pack belongs to a different world.' });

    const { entries, folderId, name } = req.body;
    const metaUpdates: Record<string, any> = {};
    if (folderId !== undefined) metaUpdates.folderId = folderId;
    if (name !== undefined) metaUpdates.name = String(name).trim();
    if (Object.keys(metaUpdates).length > 0) {
      const result = await Compendium_packsDocument.update(req.params.id, metaUpdates);
      if (result.error) return res.status(404).json({ error: result.error });
    }

    if (entries !== undefined) {
      if (!Array.isArray(entries)) return res.status(400).json({ error: 'entries must be an array.' });
      // Replace completo — client ainda manda a lista inteira nessas ações (add/remove/
      // drop). Cada entry agora é 1 linha, então "substituir tudo" é apagar as linhas
      // antigas do pack e inserir as novas, nunca reescrever um blob.
      await Compendium_entriesDocument.bulkDelete({ packId: req.params.id });
      let sortOrder = 0;
      for (const entry of entries) {
        await Compendium_entriesDocument.create({
          id: entry.id || randomUUID(),
          packId: req.params.id,
          worldId: existing.worldId,
          name: entry.name || 'Entry',
          type: entry.type || '',
          sortOrder: sortOrder++,
          imgUrl: entry.imgUrl || '',
          ownership: entry.ownership || {},
          data: entry.data || {},
          folderId: entry.folderId || '',
        });
      }
    }

    if (metaUpdates.name === undefined && entries === undefined && folderId === undefined) {
      return res.status(400).json({ error: 'No valid fields provided for update.' });
    }

    res.json({ success: true, count: Array.isArray(entries) ? entries.length : undefined });
  } catch (err: any) {
    logger.error('PUT /compendium/:id failed', { error: err.message });
    res.status(500).json({ error: 'Failed to update compendium pack.' });
  }
});

// DELETE /api/compendium/:id — delete a pack (+ its entries)
compendiumRouter.delete('/:id', requirePermission('compendiumEdit'), async (req, res) => {
  try {
    const existing = await Compendium_packsDocument.findById<any>(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Compendium pack not found.' });
    if (!packBelongsToAuthWorld(req, existing)) return res.status(403).json({ error: 'Compendium pack belongs to a different world.' });
    await Compendium_entriesDocument.bulkDelete({ packId: req.params.id });
    await Compendium_packsDocument.delete(req.params.id);
    res.json({ success: true });
  } catch (err: any) {
    logger.error('DELETE /compendium/:id failed', { error: err.message });
    res.status(500).json({ error: 'Failed to delete compendium pack.' });
  }
});

// POST /api/compendium/:id/import — GM manual backup restore: JSON file with an array of
// entries (produced by /export below), never a ruleset/addon distribution format.
compendiumRouter.post('/:id/import', requirePermission('compendiumEdit'), async (req, res) => {
  try {
    const { filePath: importPath } = req.body;
    if (!importPath) return res.status(400).json({ error: 'filePath required.' });

    const pack = await Compendium_packsDocument.findById<any>(req.params.id);
    if (!pack) return res.status(404).json({ error: 'Compendium pack not found.' });
    if (!packBelongsToAuthWorld(req, pack)) return res.status(403).json({ error: 'Compendium pack belongs to a different world.' });

    const worldCompendiumDir = path.resolve(getDataRoot(), 'worlds', pack.worldId, 'packs');
    if (!fs.existsSync(worldCompendiumDir)) fs.mkdirSync(worldCompendiumDir, { recursive: true });

    const fullPath = path.resolve(worldCompendiumDir, importPath);
    if (!fullPath.startsWith(worldCompendiumDir)) return res.status(403).json({ error: 'Access denied.' });
    if (!fs.existsSync(fullPath)) return res.status(404).json({ error: 'File not found.' });

    const content = fs.readFileSync(fullPath, 'utf-8');
    const imported = JSON.parse(content);
    const entries = Array.isArray(imported) ? imported : [imported];

    let sortOrder = await Compendium_entriesDocument.count({ packId: pack.id });
    for (const entry of entries) {
      await Compendium_entriesDocument.create({
        id: entry.id || randomUUID(),
        packId: pack.id,
        worldId: pack.worldId,
        name: entry.name || 'Entry',
        type: entry.type || '',
        sortOrder: sortOrder++,
        imgUrl: entry.imgUrl || '',
        data: entry.data || {},
      });
    }

    const totalCount = await Compendium_entriesDocument.count({ packId: pack.id });
    res.json({ success: true, importedCount: entries.length, totalCount });
  } catch (err: any) {
    logger.error('POST /compendium/:id/import failed', { error: err.message });
    res.status(500).json({ error: 'Failed to import compendium entries.' });
  }
});

// POST /api/compendium/:id/export — GM manual backup to a JSON file on disk
compendiumRouter.post('/:id/export', requirePermission('compendiumEdit'), async (req, res) => {
  try {
    const { fileName } = req.body;
    if (!fileName) return res.status(400).json({ error: 'fileName required.' });
    const safeName = path.basename(fileName).replace(/[^a-zA-Z0-9_\-\.]/g, '');

    const pack = await Compendium_packsDocument.findById<any>(req.params.id);
    if (!pack) return res.status(404).json({ error: 'Compendium pack not found.' });
    if (!packBelongsToAuthWorld(req, pack)) return res.status(403).json({ error: 'Compendium pack belongs to a different world.' });

    const worldCompendiumDir = path.resolve(getDataRoot(), 'worlds', pack.worldId, 'packs');
    if (!fs.existsSync(worldCompendiumDir)) fs.mkdirSync(worldCompendiumDir, { recursive: true });

    const entries = await Compendium_entriesDocument.find<any>({ packId: pack.id, orderBy: 'sortOrder' });
    const outPath = path.resolve(worldCompendiumDir, safeName);
    if (!outPath.startsWith(worldCompendiumDir)) return res.status(403).json({ error: 'Access denied.' });
    fs.writeFileSync(outPath, JSON.stringify(entries, null, 2), 'utf-8');
    res.json({ success: true, path: safeName });
  } catch (err: any) {
    logger.error('POST /compendium/:id/export failed', { error: err.message });
    res.status(500).json({ error: 'Failed to export compendium entries.' });
  }
});

// GET /api/compendium/:packId/entries/:entryId — Virtual entry endpoint to simulate real document API
compendiumRouter.get('/:packId/entries/:entryId', async (req, res) => {
  try {
    const pack = await Compendium_packsDocument.findById<any>(req.params.packId);
    if (!pack) return res.status(404).json({ error: 'Compendium pack not found.' });
    if (!packBelongsToAuthWorld(req, pack)) return res.status(403).json({ error: 'Compendium pack belongs to a different world.' });

    const entry = await Compendium_entriesDocument.findById<any>(req.params.entryId);
    if (!entry || entry.packId !== pack.id) return res.status(404).json({ error: 'Entry not found.' });

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

    const entry = await Compendium_entriesDocument.findById<any>(req.params.entryId);
    if (!entry || entry.packId !== pack.id) return res.status(404).json({ error: 'Entry not found.' });

    const updatePayload = req.body;
    const updates: Record<string, any> = {};
    if (updatePayload.name !== undefined) updates.name = updatePayload.name;
    if (updatePayload.imgUrl !== undefined) updates.imgUrl = updatePayload.imgUrl;

    let data = entry.data || {};
    if (pack.type === 'Actor' && updatePayload.systemData !== undefined) {
      data = updatePayload.systemData; // LoomDocumentSheet sends the whole systemData object
    } else if (pack.type === 'Item' && updatePayload.data !== undefined) {
      data = updatePayload.data;
    } else if ((pack.type === 'JournalEntry' || pack.type === 'Journal') && updatePayload.pages !== undefined) {
      data = { ...data, pages: updatePayload.pages };
    } else if (updatePayload.data !== undefined) {
      data = updatePayload.data;
    }
    updates.data = data;

    const result = await Compendium_entriesDocument.update(req.params.entryId, updates);
    if (result.error) return res.status(500).json({ error: result.error });
    const updated = result.data as any;

    let responsePayload;
    if (pack.type === 'Actor') {
      responsePayload = { id: updated.id, name: updated.name, type: updated.type, systemData: updated.data, imgUrl: updated.imgUrl, ownership: updated.ownership, worldId: pack.worldId };
    } else if (pack.type === 'Item') {
      responsePayload = { id: updated.id, name: updated.name, type: updated.type, data: updated.data, imgUrl: updated.imgUrl, ownership: updated.ownership, worldId: pack.worldId };
    } else if (pack.type === 'JournalEntry' || pack.type === 'Journal') {
      responsePayload = { id: updated.id, name: updated.name, type: updated.type, pages: updated.data?.pages || [], ownership: updated.ownership, worldId: pack.worldId };
    } else {
      responsePayload = { id: updated.id, name: updated.name, type: updated.type, data: updated.data, imgUrl: updated.imgUrl, ownership: updated.ownership, worldId: pack.worldId };
    }

    Signal.broadcast('compendium.entry.updated', { packId: pack.id, entry: responsePayload });
    return res.json(responsePayload);
  } catch (err: any) {
    logger.error('PUT /compendium/entries failed', { error: err.message });
    res.status(500).json({ error: 'Failed to update entry.' });
  }
});

// POST /api/compendium/:id/adventure-entry — snapshots selected world documents into one
/** bundled entry (Adventure pack type). Actors carry their owned items along; playlists carry
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

    // Adventure entry é 1 snapshot só — schemaless por natureza (bundle heterogêneo),
    // então continua sendo 1 linha com `data` carregando tudo. Isso não é o mesmo
    // problema do pack de ruleset: aqui é 1 entry, não milhares.
    const entryId = randomUUID();
    const result = await Compendium_entriesDocument.create({
      id: entryId,
      packId: pack.id,
      worldId,
      name: name.trim(),
      type: 'Adventure',
      data: { actors, items, stages, journals, macros, playlists },
    });
    if (result.error) return res.status(400).json({ error: result.error });

    logger.info('Adventure entry bundled', {
      packId: pack.id, entryId,
      counts: { actors: actors.length, items: items.length, stages: stages.length, journals: journals.length, macros: macros.length, playlists: playlists.length },
    });
    res.status(201).json(result.data);
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

    const entry = await Compendium_entriesDocument.findById<any>(req.params.entryId);
    if (!entry || entry.packId !== pack.id) return res.status(404).json({ error: 'Entry not found.' });

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
