# Chat Messages

## Endpoints

**Base:** `/api/chat-messages`
**Auth:** `requireAuth, requireWorldMatch`

---

### GET `/`

Recent chat history of the world, oldest first. Used on reconnect to catch up on missed messages.

**Query:** `?worldId=` (required if the session is admin without worldId in the token), `?limit=` (default `50`, clamped to `1`–`100`)

**Response `200`:** array of messages (the same fields as the Schema below), passed through `projectChatHistory` for the viewer's role
**Response `400`:** `{ "error": "worldId is required" }`
**Response `500`:** `{ "error": "..." }`

---

### PUT `/:id/roll`

Replaces the `roll` of an already posted message (used by mechanics that edit a card in place). Message owner or GM only.

**Query:** `?worldId=` (same rule as above)

**Request body:** `{ "roll": { ... } }` (required)

**Response `200`:** `{ "success": true }`
**Response `400`:** `{ "error": "worldId is required" }` / `{ "error": "roll is required" }`
**Response `403`:** `{ "error": "Message belongs to a different world" }` / `{ "error": "Access denied" }`
**Response `404`:** `{ "error": "Message not found" }`
**WS Event:** `chat.messageUpdated` (payload: `{ id, worldId, roll, userId }`)

---

### PUT `/:id/flags`

Merge-patch of flags in a chat message.

**Query:** `?worldId=` (required if the session is admin without worldId in the token)

**Request body:**

| Field | Type | Required | Description |
|-------|------|-------------|-----------|
| `scope` | `string` | **yes** | Flag scope (e.g. `'my-addon'`) |
| `key` | `string` | **yes** | Flag name |
| `value` | `any` | no (not validated) | Value to be set |

**Response `200`:** `{ "flags": { ... } }`
**Response `400`:** `{ "error": "worldId is required" }` / `{ "error": "scope and key are required" }`
**Response `403`:** `{ "error": "Message belongs to a different world" }`
**Response `404`:** `{ "error": "Message not found" }`
**Note:** there is no owner or GM check: any signed-in user of the world can change the flags of any message. No WS event is sent.

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

There is no REST creation endpoint (`POST`). Creation is 100% via WebSocket. The client sends a `message` event with `{ type: 'chat.message', data }`:

```typescript
wsClient.send('chat.message', {
  content,
  speaker, // optional
  flags,   // optional
});
```

The server takes `worldId` and the sender (`userId`, `userName`, `userColor`) from the socket's token, not from the payload, and rate-limits the sender. It inserts the row and broadcasts `chat.message` to the world with `{ id, userId, userName, userColor, type, content, speaker, flags, createdAt, worldId }`. Dice rolls use the separate `chat.roll` message type.

On the client, `ChatMessage.create(data)` (`client/main.ts`) encapsulates this dispatch — fire-and-forget, it doesn't wait for a round-trip before resolving.
