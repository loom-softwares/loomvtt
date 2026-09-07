import { Router } from 'express';
import { MacrosDocument } from '../schemas/macros.schema.js';
import { requireAuth, requireWorldMatch } from '../middleware/auth.js';
import { getUserId, isGM, canEdit } from '../middleware/permissions.js';

export const macrosRouter = Router();
macrosRouter.use(requireAuth, requireWorldMatch);

// Macros do tipo 'script' executam JS (sandboxado no client, mas mesmo assim
// só GM/Assistant GM podem autorar — hotbar é compartilhado no mundo inteiro,
// então qualquer Player poderia plantar um macro que outros acabam clicando).
const GM_MIN_ROLE = 3;
function rejectScriptTypeIfNotGm(req: any, res: any): boolean {
  if (req.body?.type === 'script' && (req.auth?.userRole ?? 0) < GM_MIN_ROLE) {
    res.status(403).json({ error: 'Apenas GM/Assistant GM podem criar macros do tipo script' });
    return true;
  }
  return false;
}

macrosRouter.get('/', async (req, res) => {
  try {
    const filter: Record<string, any> = {};
    if (req.query.worldId) filter.worldId = req.query.worldId;
    const macros = await MacrosDocument.find(filter);
    res.json(macros);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

macrosRouter.post('/', async (req, res) => {
  try {
    if (rejectScriptTypeIfNotGm(req, res)) return;
    const { worldId, name, type, command, imgUrl, slot } = req.body;
    const result = await MacrosDocument.create({
      worldId, name, type: type || 'chat',
      command: command || '', imgUrl: imgUrl || '', slot: slot ?? -1,
    }, { req });
    if (result.error) return res.status(400).json({ error: result.error });
    res.status(201).json(result.data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

macrosRouter.put('/:id', async (req, res) => {
  try {
    if (rejectScriptTypeIfNotGm(req, res)) return;
    const existing = await MacrosDocument.findById<any>(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Macro not found' });
    if (existing.type === 'script' && ((req as any).auth?.userRole ?? 0) < GM_MIN_ROLE) {
      return res.status(403).json({ error: 'Apenas GM/Assistant GM podem editar macros do tipo script' });
    }
    if (!isGM(req) && !canEdit(existing.ownership, getUserId(req))) {
      return res.status(403).json({ error: 'Access denied' });
    }
    const result = await MacrosDocument.update(req.params.id, {
      name: req.body.name, type: req.body.type, command: req.body.command,
      imgUrl: req.body.imgUrl, slot: req.body.slot,
    });
    if (result.error) return res.status(400).json({ error: result.error });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

macrosRouter.delete('/:id', async (req, res) => {
  try {
    const existing = await MacrosDocument.findById<any>(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Macro not found' });
    if (!isGM(req) && !canEdit(existing.ownership, getUserId(req))) {
      return res.status(403).json({ error: 'Access denied' });
    }
    const result = await MacrosDocument.delete(req.params.id);
    if (result.error) return res.status(400).json({ error: result.error });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
