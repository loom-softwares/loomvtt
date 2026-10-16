# Discord

Optional integration for the GM to create campaign voice rooms straight from LoomVTT. The bot runs on the GM's own Discord account/server — it is not multi-tenant, it doesn't stay connected 24/7 (connects on-demand to create a room, then disconnects) and doesn't talk to any Discord server other than the one configured by the GM.

> ⚠️ **`botToken` is never returned by the server on any route**, including `GET /config`. It is write-only: enters via `PUT /config`, is saved in `discord_configs`, and never appears back in an API response, log, or error. The UI only knows if it "is configured" via the boolean field `configured`.

## Endpoints

**Base:** `/api/worlds/:worldId/discord`
**Auth:** `requireAuth, requireWorldMatch, requireGM`

---

### GET `/config`

Current Discord config (without the token). Without a saved config it returns `{ configured: false, guildId: null, categoryId: null }`.

**Response `200`:** `{ configured: boolean, guildId: string | null, categoryId: string | null }`

---

### PUT `/config`

Saves or updates the world's Discord config (1 config per world — `worldId` is unique). `botToken` and `guildId` are both required on every call, including updates; the update branch has a branch for an optional token that is never reached (see CODE ISSUE below). `categoryId` is optional; an empty value stores `null`.

**Request body:** `{ "botToken": string (required), "guildId": string (required), "categoryId"?: string | null }`

**Response `201`** when the config is created, **`200`** when it is updated: `{ configured: true, guildId, categoryId }`

**Errors:**
- `400` — `botToken`/`guildId` missing
- `500` — database error while saving

> CODE ISSUE: `server/applications/api/discord.ts` (`PUT /config`) rejects a missing `botToken` with `400` before reaching the update branch, so the "omit `botToken` to keep the saved token" behavior does not exist. The doc describes the actual behavior until the code is fixed.

---

### POST `/room`

Creates a campaign room (**voice** channel, `ChannelType.GuildVoice`, inside `categoryId` if configured) on the GM's Discord server and returns a permanent invite.

**Request body:** `{ "roomName": string (required) }`

**Response `200`:** `{ channelId: string, inviteUrl: string }`

**Errors:**
- `400` — `roomName` missing/empty
- `500` — Discord not configured for the world (no `PUT /config` done yet)
- `500` — Guild not found (wrong `guildId` or bot wasn't invited to the server)
- `500` — Insufficient permission (bot lacks "Manage Channels" on the guild — Discord code `50013`)
- `500` — any other Discord failure (`{ "error": "Erro ao criar sala Discord: <message>" }`)

Error messages from this route are in Portuguese (for example `"Discord não configurado para este mundo..."`).

## Setup (done by the GM, outside LoomVTT)

1. Create an Application + Bot in the [Discord Developer Portal](https://discord.com/developers/applications).
2. Invite the bot to the server with the **Manage Channels** permission.
3. Copy the bot token and the Guild ID (numeric server ID) and save via `PUT /config` — in the UI, this is under **⚙️ Game Settings → Discord**.

## Out of scope (design decision)

- No automatic channel deletion (the GM deletes manually via Discord if they want).
- No multiple bots/servers per world — always 1 config per world.
- No OAuth2 automatic bot invite — the GM manually invites via the Developer Portal.
