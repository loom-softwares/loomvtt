# Chat Messages

## Endpoints

**Base:** `/api/chat-messages`
**Auth:** `requireAuth, requireWorldMatch`

---

### PUT `/:id/flags`

Merge-patch of flags in a chat message.

**Query:** `?worldId=` (required if the session is admin without worldId in the token)

**Request body:**

| Field | Type | Required | Description |
|-------|------|-------------|-----------|
| `scope` | `string` | **yes** | Flag scope (e.g. `'my-addon'`) |
| `key` | `string` | **yes** | Flag name |
| `value` | `any` | **yes** | Value to be set |

**Response `200`:** `{ "flags": { ... } }`
**Response `400`:** `{ "error": "worldId is required" }` / `{ "error": "scope and key are required" }`
**Response `403`:** `{ "error": "Message belongs to a different world" }`
**Response `404`:** `{ "error": "Message not found" }`

---

### DELETE `/:id`

Removes a message. Message owner or GM.

**Query:** `?worldId=` (required if the session is admin without worldId in the token)

**Response `200`:** `{ "success": true, "id": "..." }`
**Response `400`:** `{ "error": "worldId is required" }`
**Response `403`:** `{ "error": "Message belongs to a different world" }` / `{ "error": "Access denied" }` (not owner nor GM)
**Response `404`:** `{ "error": "Message not found" }`
**WS Event:** `chat.messageDeleted`

---

### DELETE `/`

Clears the entire world's chat history. GM only.

**Query:** `?worldId=` (required)

**Response `200`:** `{ "success": true, "count": number }`
**Response `403`:** `{ "error": "Only the GM can clear the whole chat" }`
**WS Event:** `chat.cleared`

---

## Schema

| Field | Type | Description |
|-------|------|-----------|
| `id` | `string` | Unique identifier |
| `worldId` | `string` | World |
| `userId` | `string` | Sender |
| `userName` | `string` | Sender name |
| `userColor` | `string` | Sender color |
| `type` | `string` | Type (`chat`, `roll`, etc.) |
| `content` | `string` | Message content |
| `rollData` | `object` | Roll data (if type=roll) |
| `flags` | `object` | Arbitrary flags (scope → key → value) |
| `speaker` | `object` | Speaker data |
| `createdAt` | `string` | Timestamp |
| `updatedAt` | `string` | Timestamp |

---

## Message creation

There is no REST creation endpoint (`POST`). Creation is 100% via WebSocket:

```typescript
wsClient.send('chat.message', {
  worldId,
  userId,
  content,
  speaker, // optional
});
```

The server inserts the row and calls `broadcastToWorld('chat.message', worldId, {...})`.

On the client, `ChatMessage.create(data)` (`client/main.ts`) encapsulates this dispatch — fire-and-forget, it doesn't wait for a round-trip before resolving.
