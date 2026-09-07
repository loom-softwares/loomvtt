import { Router } from 'express';
import { requireAuth, requireWorldMatch } from '../middleware/auth.js';
import { getUserId, isGM } from '../middleware/permissions.js';
import { getWorldDb } from '../database/world-db.js';
import { Signal } from '../signals/index.js';
import logger from '../utils/logger.js';

export const chatMessagesRouter = Router();
chatMessagesRouter.use(requireAuth, requireWorldMatch);

/** Chat_messagesDocument.db resolve pela global `activeWorldDb` (world-db.ts),
 * que só é setada quando o mundo é ativado via POST /api/worlds/:id/activate.
 * Depois de um restart do server ela volta null até o mundo ser reativado, e
 * nesse meio tempo `getKnexForTable` cai no banco core (rpg-core.sqlite), que
 * nunca tem `chat_messages` — daí "no such table" sem log nenhum no handler.
 * Buscar a conexão certa direto pelo worldId do request evita depender dessa
 * global. */
/** Sessão admin (Setup Hub) não carrega worldId no token — requireAuth prefere
 * o cookie admin sempre que ele existe, então `req.auth.worldId` fica undefined
 * pra um GM que também passou pelo Setup Hub. O cliente manda ?worldId= e o
 * requireWorldMatch já valida a claim contra o token quando não é admin. */
function worldIdFor(req: any): string | undefined {
  return req.query?.worldId || req.auth?.worldId;
}

async function worldDbFor(req: any) {
  return getWorldDb(worldIdFor(req)!);
}

/** DELETE /api/chat-messages/:id — dono da mensagem ou GM. Antes disso "limpar
 * chat" só apagava `this.messages` no cliente (toast dizia "localmente" mas
 * ninguém lia isso como "não apaga de verdade") — reload sempre trazia tudo
 * de volta porque nunca existiu delete real no servidor. */
chatMessagesRouter.delete('/:id', async (req: any, res) => {
  try {
    const worldId = worldIdFor(req);
    if (!worldId) return res.status(400).json({ error: 'worldId is required' });
    const worldDb = await worldDbFor(req);
    const target = await worldDb('chat_messages').where({ id: req.params.id }).first();
    if (!target) return res.status(404).json({ error: 'Message not found' });
    if (target.worldId !== worldId) {
      return res.status(403).json({ error: 'Message belongs to a different world' });
    }
    const userId = getUserId(req);
    if (!isGM(req) && target.userId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await worldDb('chat_messages').where({ id: req.params.id }).delete();

    Signal.broadcast('chat.messageDeleted', { id: req.params.id, worldId: target.worldId });
    res.json({ success: true, id: req.params.id });
  } catch (err: any) {
    logger.error('DELETE /api/chat-messages/:id failed', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

/** DELETE /api/chat-messages — limpa o histórico do mundo inteiro. GM only
 * (é destrutivo e afeta todo mundo, não só quem clicou). */
chatMessagesRouter.delete('/', async (req: any, res) => {
  try {
    if (!isGM(req)) return res.status(403).json({ error: 'Only the GM can clear the whole chat' });
    const worldId = worldIdFor(req);
    if (!worldId) return res.status(400).json({ error: 'worldId is required' });

    const worldDb = await worldDbFor(req);
    const count = await worldDb('chat_messages').where({ worldId }).delete();

    Signal.broadcast('chat.cleared', { worldId });
    res.json({ success: true, count });
  } catch (err: any) {
    logger.error('DELETE /api/chat-messages failed', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

/** PUT /api/chat-messages/:id/roll — substitui o `roll` (dados + meta) de uma
 * mensagem já postada e avisa todo mundo. Usado por mecânicas que editam o
 * card no lugar em vez de postar um novo (ex: reroll de Força de Vontade do
 * wod5e, que marca dados descartados e injeta os novos resultados no MESMO
 * card). Sem broadcast aqui, só quem editou veria a mudança — os outros só
 * atualizariam ao recarregar. */
chatMessagesRouter.put('/:id/roll', async (req: any, res) => {
  try {
    const worldId = worldIdFor(req);
    if (!worldId) return res.status(400).json({ error: 'worldId is required' });
    const worldDb = await worldDbFor(req);
    const target = await worldDb('chat_messages').where({ id: req.params.id }).first();
    if (!target) return res.status(404).json({ error: 'Message not found' });
    if (target.worldId !== worldId) {
      return res.status(403).json({ error: 'Message belongs to a different world' });
    }
    const userId = getUserId(req);
    if (!isGM(req) && target.userId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { roll } = req.body;
    if (!roll) return res.status(400).json({ error: 'roll is required' });

    await worldDb('chat_messages').where({ id: req.params.id }).update({ rollData: JSON.stringify(roll) });

    Signal.broadcast('chat.messageUpdated', { id: req.params.id, worldId, roll });
    res.json({ success: true });
  } catch (err: any) {
    logger.error('PUT /api/chat-messages/:id/roll failed', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

/** PUT /api/chat-messages/:id/flags — merge-patch de um flag. Body: { scope, key, value }. */
chatMessagesRouter.put('/:id/flags', async (req: any, res) => {
  try {
    const worldId = worldIdFor(req);
    if (!worldId) return res.status(400).json({ error: 'worldId is required' });
    const worldDb = await worldDbFor(req);
    const target = await worldDb('chat_messages').where({ id: req.params.id }).first();
    if (!target) return res.status(404).json({ error: 'Message not found' });
    if (target.worldId !== worldId) {
      return res.status(403).json({ error: 'Message belongs to a different world' });
    }

    const { scope, key, value } = req.body;
    if (!scope || !key) return res.status(400).json({ error: 'scope and key are required' });

    const flags = { ...(typeof target.flags === 'string' ? JSON.parse(target.flags || '{}') : target.flags || {}) };
    flags[scope] = { ...(flags[scope] || {}), [key]: value };

    await worldDb('chat_messages').where({ id: req.params.id }).update({ flags: JSON.stringify(flags) });
    res.json({ flags });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
