# Campaigns

## Endpoints

**Base:** `/api/campaigns`
**Auth:** `requireAuth, requireWorldMatch`

---

### GET `/`

Lists campaigns.

---

### GET `/:id`

Fetches campaign by ID.

---

### POST `/`

Creates campaign.

| Field | Type | Required |
|-------|------|-------------|
| `name` | `string` | **yes** |
| `description` | `string` | no |
| `manifest` | `object` | no |

**Internal event:** Signal `campaign.created` (server-side, **not relayed** to WebSocket — see [websocket/events.md](../websocket/events.md))

---

### PUT `/:id`

Updates campaign.

**Internal event:** Signal `campaign.updated` (server-side, **not relayed** to WebSocket — see [websocket/events.md](../websocket/events.md))

---

### DELETE `/:id`

Removes campaign.

**Internal event:** Signal `campaign.deleted` (server-side, **not relayed** to WebSocket — see [websocket/events.md](../websocket/events.md))