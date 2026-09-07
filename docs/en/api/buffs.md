# Buffs (Effects)

## Endpoints

**Base:** `/api/buffs`
**Auth:** `requireAuth, requireWorldMatch`

---

### GET `/actor/:actorId`

List of an actor's buffs, ordered by `createdAt` ascending.

---

### GET `/item/:itemId`

List of an item's buffs, ordered by `createdAt` ascending.

---

### POST `/`

Create buff.

| Field | Type | Required |
|-------|------|----------|
| `name` | `string` | **yes** |
| `actorId` | `string` | yes (if no `itemId`) |
| `itemId` | `string` | yes (if no `actorId`) |
| `worldId` | `string` | yes (if no `itemId`) |
| `icon` | `string` | no (default `''`) |
| `origin` | `string` | no (default `''`) |
| `duration` | `number` | no (default `-1`) |
| `disabled` | `boolean` | no (default `false`) |
| `changes` | `array` | no (default `[]`) |

**Response `400`:** `{ "error": "name is required" }` / `{ "error": "actorId or itemId is required" }` / `{ "error": "worldId or itemId is required" }`
**Internal event:** Signal `buff.created` (server-side, **not relayed** to WebSocket)

---

### PUT `/:id`

Update buff. Body: any of `name`, `icon`, `origin`, `duration`, `disabled`, `changes`.

**Response `404`:** returned on any error from the update (not just "not found")
**Internal event:** Signal `buff.updated` (server-side, **not relayed** to WebSocket)

---

### DELETE `/:id`

Remove buff.

**Response `200`:** `{ "success": true }`
**Response `404`:** returned on any error from the delete
**Internal event:** Signal `buff.deleted` (server-side, **not relayed** to WebSocket)
