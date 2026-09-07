# Discord

Optional integration for the GM to create campaign voice rooms straight from LoomVTT. The bot runs on the GM's own Discord account/server — it is not multi-tenant, it doesn't stay connected 24/7 (connects on-demand to create a room, then disconnects) and doesn't talk to any Discord server other than the one configured by the GM.

> ⚠️ **`botToken` is never returned by the server on any route**, including `GET /config`. It is write-only: enters via `PUT /config`, is saved in `discord_configs`, and never appears back in an API response, log, or error. The UI only knows if it "is configured" via the boolean field `configured`.

## Endpoints

**Base:** `/api/worlds/:worldId/discord`
**Auth:** `requireAuth, requireWorldMatch, requireGM`

---

### GET `/config`

Current Discord config (without the token).

**Response `200`:** `{ configured: boolean, guildId: string | null, categoryId: string | null }`

---

### PUT `/config`

Saves or updates the world's Discord config (1 config per world — `worldId` is unique). On update, `botToken` is optional (omitting it keeps the saved token); `guildId` is always required.

**Request body:** `{ "botToken": string (required on creation), "guildId": string (required), "categoryId"?: string | null }`

**Response `200`/`201`:** `{ configured: true, guildId, categoryId }`

**Errors:**
- `400` — `botToken`/`guildId` missing

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

## Setup (done by the GM, outside LoomVTT)

1. Create an Application + Bot in the [Discord Developer Portal](https://discord.com/developers/applications).
2. Invite the bot to the server with the **Manage Channels** permission.
3. Copy the bot token and the Guild ID (numeric server ID) and save via `PUT /config` — in the UI, this is under **⚙️ Game Settings → Discord**.

## Out of scope (design decision)

- No automatic channel deletion (the GM deletes manually via Discord if they want).
- No multiple bots/servers per world — always 1 config per world.
- No OAuth2 automatic bot invite — the GM manually invites via the Developer Portal.
