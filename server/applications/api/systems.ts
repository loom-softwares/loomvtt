import { Router } from 'express';
import { SystemRegistry } from '../systems/system-registry.js';
import { WorldsDocument } from '../schemas/worlds.schema.js';
import { getLoadedAddons } from '../addons/loader.js';
import logger from '../utils/logger.js';

export const systemsRouter = Router();

// GET /api/systems - List installed rulesets (from disk manifest scan).
// Não usa SystemRegistry.getAll() aqui: rulesets rodam 100% client-side por
// decisão de segurança (loader.ts nunca importa o "core" de um ruleset no
// processo do servidor), então SystemRegistry fica sempre vazio pra eles —
// consultar ele faria essa lista nunca mostrar nada instalado.
systemsRouter.get('/', (_req, res) => {
  try {
    const list = getLoadedAddons()
      .filter(a => a.type === 'ruleset' && a.loaded)
      .map(a => ({
        id: a.manifest.name,
        title: a.manifest.title || a.manifest.name,
        version: a.manifest.version || '1.0.0',
        backgroundUrl: a.manifest.backgroundUrl || a.manifest.coverUrl,
        author: a.manifest.author,
        repository: a.manifest.repository,
        description: (a.manifest as any).description,
      }));
    res.json(list);
  } catch (err: any) {
    logger.error('GET /api/systems failed', { error: err.message });
    res.status(500).json({ error: 'Failed to retrieve systems.' });
  }
});

// GET /api/systems/active - Get active system schema
systemsRouter.get('/active', async (_req, res) => {
  try {
    // Check if active world defines active system
    const activeWorld = await WorldsDocument.findOne({ isActive: true });
    const sysId = activeWorld?.system || null;
    if (sysId) SystemRegistry.setActive(sysId);

    const active = SystemRegistry.getActive();
    if (!active) {
      return res.status(404).json({ error: 'No active system registered.' });
    }

    res.json({
      id: active.id,
      title: active.title,
      version: active.version,
      actorTypes: active.actorTypes,
      itemTypes: active.itemTypes,
      defaultData: {
        character: active.getDefaultData('character'),
        npc: active.getDefaultData('npc')
      }
    });
  } catch (err: any) {
    logger.error('GET /api/systems/active failed', { error: err.message });
    res.status(500).json({ error: 'Failed to retrieve active system.' });
  }
});

// GET /api/systems/active/sheet?type=character - actor sheet layout provided by the active system, if any
systemsRouter.get('/active/sheet', async (req, res) => {
  try {
    const activeWorld = await WorldsDocument.findOne({ isActive: true });
    const sysId = activeWorld?.system || null;
    if (sysId) SystemRegistry.setActive(sysId);

    const active = SystemRegistry.getActive();
    const type = (req.query.type as string) || 'character';
    const schema = active?.getSheetSchema?.(type);

    if (!schema) {
      return res.json(null);
    }
    res.json(schema);
  } catch (err: any) {
    logger.error('GET /api/systems/active/sheet failed', { error: err.message });
    res.status(500).json({ error: 'Failed to retrieve sheet schema.' });
  }
});

// GET /api/systems/active/item-sheet?type=equipment - item sheet layout provided by the active system, if any
systemsRouter.get('/active/item-sheet', async (req, res) => {
  try {
    const activeWorld = await WorldsDocument.findOne({ isActive: true });
    const sysId = activeWorld?.system || null;
    if (sysId) SystemRegistry.setActive(sysId);

    const active = SystemRegistry.getActive();
    const type = (req.query.type as string) || 'equipment';
    const schema = active?.getItemSheetSchema?.(type);

    if (!schema) {
      return res.json(null);
    }
    res.json(schema);
  } catch (err: any) {
    logger.error('GET /api/systems/active/item-sheet failed', { error: err.message });
    res.status(500).json({ error: 'Failed to retrieve item sheet schema.' });
  }
});
