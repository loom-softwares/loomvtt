/**
 * core/src/api/combat.ts
 * REST routes for Combat Tracker.
 * Mounted at /api/combat in core/src/index.ts
 */

import { Router } from 'express';
import { randomUUID } from 'crypto';
import { CombatsDocument, type CombatantGroup } from '../schemas/combats.schema.js';
import { CastsDocument } from '../schemas/cast.schema.js';
import { BuffsDocument } from '../schemas/buffs.schema.js';
import { Signal } from '../signals/index.js';
import logger from '../utils/logger.js';
import { requireAuth, requireWorldMatch } from '../middleware/auth.js';
import { requireGM } from '../middleware/permissions.js';
import { roll } from '../dice/roller.js';

/** Decrementa `duration` (rodadas restantes) de todo buff ativo do mundo em 1,
 * apagando os que chegarem a 0. `-1` (default do schema) é permanente — nunca
 * decrementa. Chamado só quando uma RODADA completa (não a cada turno — ver
 * `/next` abaixo), porque é o ponto de sincronia que faz sentido pra "efeito
 * dura N rodadas" independente de quantos combatentes existem. Buffs são
 * `worldId`-scoped, não presos a um combatente específico da lista de
 * iniciativa (que nem sempre mapeia 1:1 pra actorId) — qualquer buff ativo
 * no mundo com duração numérica é afetado, combatente ou não (ex: perigo
 * ambiental, efeito numa cena compartilhada). */
async function tickBuffDurations(worldId: string): Promise<void> {
  const buffs = await BuffsDocument.find<{ id: string; duration: number; disabled?: boolean }>({ worldId, disabled: false });
  for (const buff of buffs) {
    if (buff.duration < 0) continue; // permanente
    const next = buff.duration - 1;
    if (next <= 0) await BuffsDocument.delete(buff.id);
    else await BuffsDocument.update(buff.id, { duration: next });
  }
}

export const combatRouter = Router();

/** Achata objeto aninhado em chaves tipo "attributes.dex.mod" pra resolver @variables na fórmula. */
function flatten(obj: Record<string, any>, prefix = '', out: Record<string, number> = {}): Record<string, number> {
  for (const [k, v] of Object.entries(obj || {})) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) flatten(v, key, out);
    else if (typeof v === 'number') out[key] = v;
  }
  return out;
}
combatRouter.use(requireAuth, requireWorldMatch);

/** GET /api/combat/:worldId — get active combat for world */
combatRouter.get('/:worldId', async (req, res) => {
  try {
    const combat = await CombatsDocument.findOne({ worldId: req.params.worldId, isActive: true });
    res.json(combat ?? null);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/** POST /api/combat/:worldId/start — start a new combat encounter */
combatRouter.post('/:worldId/start', requireGM, async (req, res) => {
  try {
    // End any existing active combat
    const activeCombats = await CombatsDocument.find({ worldId: req.params.worldId, isActive: true });
    for (const c of activeCombats) {
      await CombatsDocument.update((c as any).id, { isActive: false });
    }
    // Manual broadcast for special case
    Signal.broadcast('combat.ended', { worldId: req.params.worldId });

    const { combatants = [] } = req.body;

    // Roll initiative for each combatant if not provided
    const withInitiative = combatants.map((c: any) => ({
      ...c,
      initiative: c.initiative ?? Math.floor(Math.random() * 20) + 1,
    }));

    // Sort by initiative descending
    withInitiative.sort((a: any, b: any) => b.initiative - a.initiative);

    const result = await CombatsDocument.create({
      worldId: req.params.worldId,
      round: 1,
      currentTurn: 0,
      combatants: withInitiative,
      isActive: true,
    });
    if (result.error) return res.status(400).json({ error: result.error });

    // Manual broadcast for special case (new combat creation)
    Signal.broadcast('combat.started', result.data);
    logger.info('Combat started', { id: result.data.id, worldId: req.params.worldId });
    res.status(201).json(result.data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/** POST /api/combat/:worldId/dex-initiative — start combat with DEX-based initiative */
combatRouter.post('/:worldId/dex-initiative', requireGM, async (req, res) => {
  try {
    let cast = await CastsDocument.find<any>({ worldId: req.params.worldId });
    // Se o client mandar os tokens selecionados no canvas, combate entra só com eles —
    // sem isso, cai pra todo cast do world (comportamento antigo, callers sem seleção).
    const { castIds } = req.body as { castIds?: string[] };
    if (Array.isArray(castIds) && castIds.length > 0) {
      const idSet = new Set(castIds);
      cast = cast.filter((c: any) => idSet.has(c.id));
    }
    if (cast.length === 0) return res.status(400).json({ error: 'No cast members in this world.' });

    // Fórmula vem do sistema ativo (client resolve via settingsRegistry) — sem sistema
    // declarando, cai pro d20 padrão. Não fica preso a um único tipo de dado.
    const { initiativeFormula = '1d20' } = req.body as { initiativeFormula?: string };

    const combatants = cast.map((c: any) => {
      const dex = c.systemData?.attributes?.dex ?? 10;
      const dexMod = Math.floor((dex - 10) / 2);
      const data = flatten(c.systemData || {});
      const result = roll(initiativeFormula, data);
      return {
        id: c.id, name: c.name, initiative: result.total,
        hp: dex, maxHp: dex, isActive: true,
        dexMod, roll: result.total,
      };
    });

    combatants.sort((a: any, b: any) => b.initiative - a.initiative);

    // End existing combat
    const activeDexCombats = await CombatsDocument.find({ worldId: req.params.worldId, isActive: true });
    for (const c of activeDexCombats) {
      await CombatsDocument.update((c as any).id, { isActive: false });
    }

    const result = await CombatsDocument.create({
      worldId: req.params.worldId,
      round: 1, currentTurn: 0,
      combatants,
      isActive: true,
    });
    if (result.error) return res.status(400).json({ error: result.error });

    // Manual broadcast for special case (new combat creation)
    Signal.broadcast('combat.started', result.data);
    logger.info('Combat started with DEX initiative', { id: result.data.id, worldId: req.params.worldId });
    res.status(201).json(result.data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/** POST /api/combat/:worldId/next — advance to next turn */
combatRouter.post('/:worldId/next', requireGM, async (req, res) => {
  try {
    const combat = await CombatsDocument.findOne<any>({ worldId: req.params.worldId, isActive: true });
    if (!combat) return res.status(404).json({ error: 'No active combat' });

    const total = combat.combatants.length;
    let nextTurn = combat.currentTurn + 1;
    let nextRound = combat.round;

    if (nextTurn >= total) {
      nextTurn = 0;
      nextRound += 1;
    }

    const result = await CombatsDocument.update(combat.id, { currentTurn: nextTurn, round: nextRound });
    if (result.error) return res.status(404).json({ error: result.error });
    if (nextRound > combat.round) await tickBuffDurations(req.params.worldId);
    // Manual broadcast for turn advancement
    Signal.broadcast('combat.next', result.data);
    res.json(result.data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/** POST /api/combat/:worldId/end — end active combat */
combatRouter.post('/:worldId/end', requireGM, async (req, res) => {
  try {
    const activeCombatsEnd = await CombatsDocument.find({ worldId: req.params.worldId, isActive: true });
    for (const c of activeCombatsEnd) {
      await CombatsDocument.update((c as any).id, { isActive: false });
    }
    // Manual broadcast for special case
    Signal.broadcast('combat.ended', { worldId: req.params.worldId });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/** POST /api/combat/:worldId/combatant — add a single cast member to the active combat (creates one if none exists) */
combatRouter.post('/:worldId/combatant', requireGM, async (req, res) => {
  try {
    const { castId } = req.body;
    if (!castId) return res.status(400).json({ error: 'castId is required' });

    const cast = await CastsDocument.findById<any>(castId);
    if (!cast) return res.status(404).json({ error: 'Cast member not found' });

    let combat = await CombatsDocument.findOne<any>({ worldId: req.params.worldId, isActive: true });

    if (!combat) {
      const result = await CombatsDocument.create({
        worldId: req.params.worldId,
        round: 1,
        currentTurn: 0,
        combatants: [],
        isActive: true,
      });
      if (result.error) return res.status(400).json({ error: result.error });
      combat = result.data;
    }

    if (combat.combatants.some((c: any) => c.id === castId)) {
      return res.json(combat);
    }

    const combatants = [
      ...combat.combatants,
      { id: castId, name: cast.name, initiative: Math.floor(Math.random() * 20) + 1, hp: cast.systemData?.hp?.value ?? 10, maxHp: cast.systemData?.hp?.max ?? 10, isActive: true },
    ];
    combatants.sort((a: any, b: any) => b.initiative - a.initiative);

    const result = await CombatsDocument.update(combat.id, { combatants });
    if (result.error) return res.status(404).json({ error: result.error });
    // Manual broadcast for combatant changes
    Signal.broadcast('combat.updated', result.data);
    logger.info('Combatant added', { worldId: req.params.worldId, castId });
    res.json(result.data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/** DELETE /api/combat/:worldId/combatant/:castId — remove a single cast member from the active combat */
combatRouter.delete('/:worldId/combatant/:castId', requireGM, async (req, res) => {
  try {
    const combat = await CombatsDocument.findOne<any>({ worldId: req.params.worldId, isActive: true });
    if (!combat) return res.status(404).json({ error: 'No active combat' });

    const combatants = combat.combatants.filter((c: any) => c.id !== req.params.castId);
    const result = await CombatsDocument.update(combat.id, { combatants });
    if (result.error) return res.status(404).json({ error: result.error });
    // Manual broadcast for combatant changes
    Signal.broadcast('combat.updated', result.data);
    logger.info('Combatant removed', { worldId: req.params.worldId, castId: req.params.castId });
    res.json(result.data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/** PUT /api/combat/:worldId/combatant/:castId — update combatant HP/status */
combatRouter.put('/:worldId/combatant/:castId', requireGM, async (req, res) => {
  try {
    const combat = await CombatsDocument.findOne<any>({ worldId: req.params.worldId, isActive: true });
    if (!combat) return res.status(404).json({ error: 'No active combat' });

    const idx = combat.combatants.findIndex((c: any) => c.id === req.params.castId);
    if (idx === -1) return res.status(404).json({ error: 'Combatant not found' });

    const ALLOWED_FIELDS = ['hp', 'maxHp', 'initiative', 'isActive', 'name', 'groupId'];
    const updates: Record<string, any> = {};
    for (const field of ALLOWED_FIELDS) {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    }
    // `flags.<namespace>.*` — mesmo padrão de ChatMessage/User (getFlag/setFlag):
    // qualquer sistema guarda dado extra por combatente (ex: reações restantes,
    // "surprised") sem o core precisar conhecer o campo. Merge raso por namespace,
    // não overwrite total, pra dois sistemas não se pisarem.
    if (req.body.flags && typeof req.body.flags === 'object') {
      const existingFlags = combat.combatants[idx].flags || {};
      const mergedFlags = { ...existingFlags };
      for (const [ns, data] of Object.entries(req.body.flags)) {
        mergedFlags[ns] = { ...(existingFlags[ns] || {}), ...(data as object) };
      }
      updates.flags = mergedFlags;
    }
    combat.combatants[idx] = { ...combat.combatants[idx], ...updates };

    const result = await CombatsDocument.update(combat.id, { combatants: combat.combatants });
    if (result.error) return res.status(404).json({ error: result.error });
    // Manual broadcast for combatant changes
    Signal.broadcast('combat.updated', result.data);
    res.json(result.data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/** POST /api/combat/:worldId/group — add a combatant group (shared initiative row) */
combatRouter.post('/:worldId/group', requireGM, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || typeof name !== 'string' || name.trim() === '') {
      return res.status(400).json({ error: 'Field "name" is required.' });
    }
    const combat = await CombatsDocument.findOne<any>({ worldId: req.params.worldId, isActive: true });
    if (!combat) return res.status(404).json({ error: 'No active combat' });

    const groups: CombatantGroup[] = combat.groups || [];
    const newGroup: CombatantGroup = { id: randomUUID(), name: name.trim(), initiative: null };
    groups.push(newGroup);

    const result = await CombatsDocument.update(combat.id, { groups });
    if (result.error) return res.status(404).json({ error: result.error });
    Signal.broadcast('combat.updated', result.data);
    res.status(201).json(newGroup);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/** PUT /api/combat/:worldId/group/:groupId — rename a group and/or set its shared initiative */
combatRouter.put('/:worldId/group/:groupId', requireGM, async (req, res) => {
  try {
    const combat = await CombatsDocument.findOne<any>({ worldId: req.params.worldId, isActive: true });
    if (!combat) return res.status(404).json({ error: 'No active combat' });

    const groups: CombatantGroup[] = combat.groups || [];
    const idx = groups.findIndex((g) => g.id === req.params.groupId);
    if (idx === -1) return res.status(404).json({ error: 'Group not found' });

    const { name, initiative } = req.body;
    if (name !== undefined) groups[idx].name = String(name).trim();
    if (initiative !== undefined) groups[idx].initiative = initiative === null ? null : Number(initiative);

    const result = await CombatsDocument.update(combat.id, { groups });
    if (result.error) return res.status(404).json({ error: result.error });
    Signal.broadcast('combat.updated', result.data);
    res.json(groups[idx]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/** DELETE /api/combat/:worldId/group/:groupId — remove a group; members fall back to their own initiative */
combatRouter.delete('/:worldId/group/:groupId', requireGM, async (req, res) => {
  try {
    const combat = await CombatsDocument.findOne<any>({ worldId: req.params.worldId, isActive: true });
    if (!combat) return res.status(404).json({ error: 'No active combat' });

    const groups: CombatantGroup[] = (combat.groups || []).filter((g: CombatantGroup) => g.id !== req.params.groupId);
    const combatants = (combat.combatants || []).map((c: any) =>
      c.groupId === req.params.groupId ? { ...c, groupId: undefined } : c
    );

    const result = await CombatsDocument.update(combat.id, { groups, combatants });
    if (result.error) return res.status(404).json({ error: result.error });
    Signal.broadcast('combat.updated', result.data);
    res.json({ success: true, id: req.params.groupId });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
