import { Router } from 'express';
import { DiscordConfigDocument } from '../schemas/discord-config.schema.js';
import { createCampaignRoom } from '../services/discord-bot-service.js';
import { requireAuth, requireWorldMatch } from '../middleware/auth.js';
import { requireGM } from '../middleware/permissions.js';
import logger from '../utils/logger.js';

export const discordRouter = Router();
discordRouter.use(requireAuth, requireWorldMatch);

discordRouter.get('/:worldId/discord/config', requireGM, async (req, res) => {
  try {
    const worldId = req.params.worldId;
    const config = await DiscordConfigDocument.findOne({ worldId });
    if (!config) {
      return res.json({ configured: false, guildId: null, categoryId: null });
    }
    return res.json({
      configured: true,
      guildId: (config as any).guildId,
      categoryId: (config as any).categoryId,
    });
  } catch (err: any) {
    logger.error('GET /discord/config failed', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

discordRouter.put('/:worldId/discord/config', requireGM, async (req, res) => {
  try {
    const worldId = req.params.worldId;
    const { botToken, guildId, categoryId } = req.body;

    if (!botToken || !guildId) {
      return res.status(400).json({ error: 'botToken e guildId são obrigatórios.' });
    }

    const existing = await DiscordConfigDocument.findOne({ worldId });

    if (existing) {
      const updates: Record<string, any> = { guildId };
      if (botToken) updates.botToken = botToken;
      if (categoryId !== undefined) updates.categoryId = categoryId || null;

      const result = await DiscordConfigDocument.update((existing as any).id, updates);
      if (result.error) return res.status(500).json({ error: result.error });

      return res.json({ configured: true, guildId, categoryId: categoryId || null });
    }

    const result = await DiscordConfigDocument.create({
      worldId,
      botToken,
      guildId,
      categoryId: categoryId || null,
    });
    if (result.error) return res.status(500).json({ error: result.error });

    res.status(201).json({ configured: true, guildId, categoryId: categoryId || null });
  } catch (err: any) {
    logger.error('PUT /discord/config failed', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

discordRouter.post('/:worldId/discord/room', requireGM, async (req, res) => {
  try {
    const worldId = req.params.worldId;
    const { roomName } = req.body;

    if (!roomName || !roomName.trim()) {
      return res.status(400).json({ error: 'Nome da sala é obrigatório.' });
    }

    const result = await createCampaignRoom(worldId, roomName.trim());
    res.json(result);
  } catch (err: any) {
    logger.error('POST /discord/room failed', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});
