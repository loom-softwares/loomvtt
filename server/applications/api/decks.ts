import { Router } from 'express';
import { randomUUID } from 'crypto';
import { DecksDocument } from '../schemas/decks.schema.js';
import { Signal } from '../signals/index.js';
import logger from '../utils/logger.js';
import { requireAuth, requireWorldMatch } from '../middleware/auth.js';
import { requireGM } from '../middleware/permissions.js';

export const decksRouter = Router();
decksRouter.use(requireAuth, requireWorldMatch);

// GET /api/decks/world/:worldId — List all decks in a world
decksRouter.get('/world/:worldId', async (req, res) => {
  try {
    const decks = await DecksDocument.find({
      worldId: req.params.worldId,
      orderBy: [{ column: 'createdAt', dir: 'asc' }],
    });
    res.json(decks);
  } catch (err: any) {
    logger.error('GET /decks/world/:worldId failed', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// GET /api/decks/:id — Get details of a single deck
decksRouter.get('/:id', async (req, res) => {
  try {
    const deck = await DecksDocument.findById(req.params.id);
    if (!deck) return res.status(404).json({ error: 'Deck not found' });
    res.json(deck);
  } catch (err: any) {
    logger.error('GET /decks/:id failed', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// POST /api/decks — Create a deck/hand/pile
decksRouter.post('/', requireGM, async (req, res) => {
  try {
    const { worldId, name, type, cards, state, folderId, stackType, ownerId } = req.body;
    if (!worldId || !name) {
      return res.status(400).json({ error: 'worldId and name are required' });
    }
    const id = `deck-${randomUUID()}`;
    const result = await DecksDocument.create({
      id,
      worldId,
      name,
      type: type ?? 'standard',
      stackType: stackType ?? 'deck',
      ownerId: ownerId ?? '',
      cards: cards ?? [],
      state: state ?? {},
      folderId: folderId ?? '',
    });
    if (result.error) return res.status(400).json({ error: result.error });
    Signal.broadcast('deck.created', result.data);
    res.status(201).json(result.data);
  } catch (err: any) {
    logger.error('POST /decks failed', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/decks/:id — Update deck cards or state
decksRouter.put('/:id', requireGM, async (req, res) => {
  try {
    const { name, type, cards, state, folderId, stackType, ownerId } = req.body;
    const updates: Record<string, any> = {};
    if (name !== undefined) updates.name = name;
    if (type !== undefined) updates.type = type;
    if (cards !== undefined) updates.cards = cards;
    if (state !== undefined) updates.state = state;
    if (folderId !== undefined) updates.folderId = folderId;
    if (stackType !== undefined) updates.stackType = stackType;
    if (ownerId !== undefined) updates.ownerId = ownerId;

    const result = await DecksDocument.update(req.params.id, updates);
    if (result.error) return res.status(404).json({ error: result.error });
    Signal.broadcast('deck.updated', result.data);
    res.json(result.data);
  } catch (err: any) {
    logger.error('PUT /decks/:id failed', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

/**
 * Move `number` cartas do topo de `from` pra `to`, marcando `origin` na carta
 * (pra `recall` saber de onde ela veio). Usado por draw/deal — extraido pra
 * nao duplicar a mesma logica nas duas rotas.
 */
function moveTopCards(from: { id: string; cards: any[] }, to: { cards: any[] }, count: number): any[] {
  const moved: any[] = [];
  for (let i = 0; i < count && from.cards.length > 0; i++) {
    const card = from.cards.shift();
    if (!card.origin) card.origin = from.id;
    to.cards.push(card);
    moved.push(card);
  }
  return moved;
}

// POST /api/decks/:id/draw — Puxa carta(s) do topo de :id pra outra stack (hand/pile)
decksRouter.post('/:id/draw', requireGM, async (req, res) => {
  try {
    const { toId, number } = req.body;
    if (!toId) return res.status(400).json({ error: 'toId is required' });
    const from = await DecksDocument.findById(req.params.id);
    const to = await DecksDocument.findById(toId);
    if (!from || !to) return res.status(404).json({ error: 'Deck not found' });

    const fromCards = [...(from as any).cards];
    const toCards = [...(to as any).cards];
    const moved = moveTopCards({ id: from.id, cards: fromCards }, { cards: toCards }, number ?? 1);
    if (moved.length === 0) return res.status(400).json({ error: 'Nothing to draw' });

    const fromResult = await DecksDocument.update(from.id, { cards: fromCards });
    const toResult = await DecksDocument.update(to.id, { cards: toCards });
    if (fromResult.error) return res.status(400).json({ error: fromResult.error });
    if (toResult.error) return res.status(400).json({ error: toResult.error });

    Signal.broadcast('deck.updated', fromResult.data);
    Signal.broadcast('deck.updated', toResult.data);
    res.json({ moved, from: fromResult.data, to: toResult.data });
  } catch (err: any) {
    logger.error('POST /decks/:id/draw failed', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// POST /api/decks/:id/deal — Distribui cartas ciclicamente do topo de :id pra varias stacks
decksRouter.post('/:id/deal', requireGM, async (req, res) => {
  try {
    const { toIds, number } = req.body;
    if (!Array.isArray(toIds) || toIds.length === 0) {
      return res.status(400).json({ error: 'toIds is required' });
    }
    const from = await DecksDocument.findById(req.params.id);
    if (!from) return res.status(404).json({ error: 'Deck not found' });
    const targets = await Promise.all(toIds.map((id: string) => DecksDocument.findById(id)));
    if (targets.some(t => !t)) return res.status(404).json({ error: 'Target deck not found' });

    const fromCards = [...(from as any).cards];
    const targetCardsById = new Map<string, any[]>(targets.map((t: any) => [t.id, [...t.cards]]));
    const rounds = number ?? 1;
    for (let r = 0; r < rounds; r++) {
      for (const t of targets as any[]) {
        moveTopCards({ id: from.id, cards: fromCards }, { cards: targetCardsById.get(t.id)! }, 1);
      }
    }

    const fromResult = await DecksDocument.update(from.id, { cards: fromCards });
    if (fromResult.error) return res.status(400).json({ error: fromResult.error });
    Signal.broadcast('deck.updated', fromResult.data);

    const updatedTargets = [];
    for (const t of targets as any[]) {
      const result = await DecksDocument.update(t.id, { cards: targetCardsById.get(t.id) });
      if (result.error) return res.status(400).json({ error: result.error });
      Signal.broadcast('deck.updated', result.data);
      updatedTargets.push(result.data);
    }
    res.json({ from: fromResult.data, to: updatedTargets });
  } catch (err: any) {
    logger.error('POST /decks/:id/deal failed', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// POST /api/decks/:id/pass — Passa cartas especificas de :id pra outra stack
decksRouter.post('/:id/pass', requireGM, async (req, res) => {
  try {
    const { toId, cardIds } = req.body;
    if (!toId || !Array.isArray(cardIds) || cardIds.length === 0) {
      return res.status(400).json({ error: 'toId and cardIds are required' });
    }
    const from = await DecksDocument.findById(req.params.id);
    const to = await DecksDocument.findById(toId);
    if (!from || !to) return res.status(404).json({ error: 'Deck not found' });

    const idSet = new Set(cardIds);
    const fromCards = (from as any).cards as any[];
    const passing = fromCards.filter(c => idSet.has(c.id));
    const remaining = fromCards.filter(c => !idSet.has(c.id));
    for (const card of passing) {
      if (!card.origin) card.origin = from.id;
    }
    const toCards = [...(to as any).cards, ...passing];

    const fromResult = await DecksDocument.update(from.id, { cards: remaining });
    const toResult = await DecksDocument.update(to.id, { cards: toCards });
    if (fromResult.error) return res.status(400).json({ error: fromResult.error });
    if (toResult.error) return res.status(400).json({ error: toResult.error });

    Signal.broadcast('deck.updated', fromResult.data);
    Signal.broadcast('deck.updated', toResult.data);
    res.json({ moved: passing, from: fromResult.data, to: toResult.data });
  } catch (err: any) {
    logger.error('POST /decks/:id/pass failed', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// POST /api/decks/:id/recall — Traz de volta pro deck :id toda carta cujo `origin` seja ele
decksRouter.post('/:id/recall', requireGM, async (req, res) => {
  try {
    const deck = await DecksDocument.findById(req.params.id);
    if (!deck) return res.status(404).json({ error: 'Deck not found' });

    const others = await DecksDocument.find({ worldId: (deck as any).worldId });
    const deckCards = [...(deck as any).cards];
    const touched: any[] = [];

    for (const other of others as any[]) {
      if (other.id === deck.id) continue;
      const remaining = other.cards.filter((c: any) => c.origin !== deck.id);
      if (remaining.length === other.cards.length) continue;
      const recalled = other.cards.filter((c: any) => c.origin === deck.id);
      for (const card of recalled) delete card.origin;
      deckCards.push(...recalled);
      const result = await DecksDocument.update(other.id, { cards: remaining });
      if (!result.error) {
        Signal.broadcast('deck.updated', result.data);
        touched.push(result.data);
      }
    }

    const deckResult = await DecksDocument.update(deck.id, { cards: deckCards });
    if (deckResult.error) return res.status(400).json({ error: deckResult.error });
    Signal.broadcast('deck.updated', deckResult.data);
    res.json({ deck: deckResult.data, touched });
  } catch (err: any) {
    logger.error('POST /decks/:id/recall failed', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/decks/:id — Delete a deck
decksRouter.delete('/:id', requireGM, async (req, res) => {
  try {
    const result = await DecksDocument.delete(req.params.id);
    if (result.error) return res.status(404).json({ error: result.error });
    // Signal.broadcast('deck.deleted', ...) já sai de dentro de DecksDocument.delete()
    // (LoomDocument.delete() genérico) — não duplicar aqui.
    res.json({ success: true });
  } catch (err: any) {
    logger.error('DELETE /decks/:id failed', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});
