import { Client, ChannelType, GatewayIntentBits, type Guild } from 'discord.js';
import { DiscordConfigDocument } from '../schemas/discord-config.schema.js';
import logger from '../utils/logger.js';

export async function createCampaignRoom(
  worldId: string,
  roomName: string,
): Promise<{ channelId: string; inviteUrl: string }> {
  const config = await DiscordConfigDocument.findOne({ worldId });
  if (!config) {
    throw new Error('Discord não configurado para este mundo. Configure o token e guild ID primeiro.');
  }

  const token = (config as any).botToken;
  const guildId = (config as any).guildId;
  const categoryId = (config as any).categoryId;

  if (!token || !guildId) {
    throw new Error('Token do bot ou Guild ID não configurado.');
  }

  const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
  });

  try {
    await client.login(token);

    const guild: Guild | null = await client.guilds.fetch(guildId).catch(() => null);
    if (!guild) {
      throw new Error(
        'Não foi possível encontrar o servidor Discord. Verifique se o Guild ID está correto e se o bot foi convidado para o servidor.',
      );
    }

    const channel = await guild.channels.create({
      name: roomName,
      type: ChannelType.GuildVoice,
      parent: categoryId || undefined,
    });

    const invite = await channel.createInvite({ maxAge: 0 });
    const inviteUrl = invite.url;

    logger.info('Sala Discord criada com sucesso', {
      worldId,
      channelId: channel.id,
      guildId,
    });

    return { channelId: channel.id, inviteUrl };
  } catch (err: any) {
    if (err.code === 50013) {
      throw new Error(
        'Permissão insuficiente. Certifique-se de que o bot tem a permissão "Gerenciar Canais" no servidor Discord.',
      );
    }
    logger.error('Falha ao criar sala Discord', {
      worldId,
      error: err.message,
      code: err.code,
    });
    throw new Error(`Erro ao criar sala Discord: ${err.message}`);
  } finally {
    try {
      client.destroy();
    } catch (destroyErr: any) {
      logger.warn('Erro ao desconectar cliente Discord', { error: destroyErr.message });
    }
  }
}
