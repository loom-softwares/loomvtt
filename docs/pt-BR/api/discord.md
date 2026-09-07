# Discord

Integração opcional para o GM criar salas de voz de campanha direto do LoomVTT. O bot roda na conta/servidor Discord do próprio GM — não é multi-tenant, não fica conectado 24/7 (conecta sob demanda ao criar sala, desconecta em seguida) e não fala com nenhum servidor Discord além do configurado pelo GM.

> ⚠️ **`botToken` nunca é retornado pelo servidor em nenhuma rota**, inclusive `GET /config`. É write-only: entra via `PUT /config`, fica salvo em `discord_configs`, e nunca aparece de volta em resposta de API, log ou erro. A UI só sabe se "está configurado" via o campo booleano `configured`.

## Endpoints

**Base:** `/api/worlds/:worldId/discord`
**Auth:** `requireAuth, requireWorldMatch, requireGM`

---

### GET `/config`

Configuração atual do Discord (sem o token).

**Response `200`:** `{ configured: boolean, guildId: string | null, categoryId: string | null }`

---

### PUT `/config`

Salva ou atualiza a configuração Discord do mundo (1 config por mundo — `worldId` é único). Numa atualização, `botToken` é opcional (omitir mantém o token já salvo); `guildId` é sempre obrigatório.

**Request body:** `{ "botToken": string (obrigatório na criação), "guildId": string (obrigatório), "categoryId"?: string | null }`

**Response `200`/`201`:** `{ configured: true, guildId, categoryId }`

**Erros:**
- `400` — `botToken`/`guildId` ausentes

---

### POST `/room`

Cria uma sala de campanha (canal de **voz**, `ChannelType.GuildVoice`, dentro de `categoryId` se configurado) no servidor Discord do GM e retorna um convite permanente.

**Request body:** `{ "roomName": string (obrigatório) }`

**Response `200`:** `{ channelId: string, inviteUrl: string }`

**Erros:**
- `400` — `roomName` ausente/vazio
- `500` — Discord não configurado para o mundo (nenhum `PUT /config` feito ainda)
- `500` — Guild não encontrada (`guildId` errado ou bot não foi convidado para o servidor)
- `500` — Permissão insuficiente (bot sem "Gerenciar Canais" na guild — código Discord `50013`)

## Setup (feito pelo GM, fora do LoomVTT)

1. Criar uma Application + Bot no [Discord Developer Portal](https://discord.com/developers/applications).
2. Convidar o bot para o servidor com a permissão **Gerenciar Canais**.
3. Copiar o bot token e o Guild ID (ID numérico do servidor) e salvar via `PUT /config` — na UI, isso fica em **⚙️ Configurações do Jogo → Discord**.

## Fora de escopo (decisão de projeto)

- Sem exclusão automática de canal (o GM apaga manualmente pelo Discord se quiser).
- Sem múltiplos bots/servidores por mundo — sempre 1 config por mundo.
- Sem OAuth2 de convite automático do bot — o GM convida manualmente pelo Developer Portal.
