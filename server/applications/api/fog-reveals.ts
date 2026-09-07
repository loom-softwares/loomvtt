import { Router } from 'express';
import { randomUUID } from 'crypto';
import { FogRevealsDocument } from '../schemas/fog-reveals.schema.js';
import { Signal } from '../signals/index.js';
import logger from '../utils/logger.js';
import { requireAuth, requireWorldMatch } from '../middleware/auth.js';
import { requireGM, getUserId, isGM } from '../middleware/permissions.js';

export const fogRevealsRouter = Router();
fogRevealsRouter.use(requireAuth, requireWorldMatch);

// GET /api/fog-reveals/stage/:stageId/user/:userId — Get fog reveal data for stage/user
fogRevealsRouter.get('/stage/:stageId/user/:userId', async (req, res) => {
  try {
    // O userId vem do token, nao da URL: sem isto qualquer jogador lia o mapa
    // explorado de qualquer outro trocando o segmento da rota. GM pode ler o de
    // qualquer um (precisa, pra montar a visao da mesa).
    const requesterId = getUserId(req);
    const targetUserId = isGM(req) ? req.params.userId : requesterId;
    const record = await FogRevealsDocument.findOne({
      stageId: req.params.stageId,
      userId: targetUserId,
    });
    if (!record) {
      return res.json({ explored: [] });
    }
    res.json(record);
  } catch (err: any) {
    logger.error('GET /fog-reveals/stage/:stageId/user/:userId failed', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// POST /api/fog-reveals — Update/Save fog reveal data
fogRevealsRouter.post('/', async (req, res) => {
  try {
    const { stageId, explored } = req.body;
    // `userId` do body e IGNORADO de proposito — vinha do cliente e permitia
    // sobrescrever o fog de outro jogador. Passa a sair do token.
    const userId = getUserId(req);
    if (!stageId || !userId) {
      return res.status(400).json({ error: 'stageId and authenticated user are required' });
    }

    // Check if existing record
    const existing = await FogRevealsDocument.findOne({ stageId, userId });

    if (existing) {
      const result = await FogRevealsDocument.update(existing.id, {
        explored: explored ?? [],
      });
      if (result.error) return res.status(400).json({ error: result.error });
      Signal.broadcast('fog.updated', result.data);
      return res.json(result.data);
    } else {
      const id = `fog-${randomUUID()}`;
      const result = await FogRevealsDocument.create({
        id,
        stageId,
        userId,
        explored: explored ?? [],
      });
      if (result.error) return res.status(400).json({ error: result.error });
      Signal.broadcast('fog.created', result.data);
      return res.status(201).json(result.data);
    }
  } catch (err: any) {
    logger.error('POST /fog-reveals failed', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/fog-reveals/stage/:stageId — Reset/Delete fog reveal data for all users in a stage
// Apagar o fog da stage inteira e acao de mesa — so GM.
fogRevealsRouter.delete('/stage/:stageId', requireGM, async (req, res) => {
  try {
    const result = await FogRevealsDocument.bulkDelete({ stageId: req.params.stageId });
    if (result.error) return res.status(500).json({ error: result.error });
    Signal.broadcast('fog.reset', { stageId: req.params.stageId });
    res.json({ success: true });
  } catch (err: any) {
    logger.error('DELETE /fog-reveals/stage/:stageId failed', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});
