# Fog Reveals

## Endpoints

**Base:** `/api/fog-reveals`
**Auth:** `requireAuth, requireWorldMatch` (+ `requireGM` on `DELETE /stage/:stageId`)

---

### GET `/stage/:stageId/user/:userId`

Fetches explored areas of a user in a stage.

**Response `200`:** Fog reveal record or `{ "explored": [] }`

---

### POST `/`

Creates or updates the authenticated user's explored areas for a stage (upsert, keyed on
`stageId` + the caller's own user ID).

| Field | Type | Required | Notes |
|-------|------|-------------|-------|
| `stageId` | `string` | **yes** | |
| `explored` | `array` | no (default `[]`) | |
| `userId` | — | ignored | Taken from the auth token instead — a client-supplied `userId` would let a player overwrite another player's fog, so the body value is never used. |

**Response `201`:** Created record (first reveal for this user/stage)
**Response `200`:** Updated record (existing user/stage)
**Response `400`:** `{ "error": "stageId and authenticated user are required" }`
**Internal event:** Signal `fog.created` (first time) or `fog.updated` (subsequent) — server-side, **not relayed** to WebSocket (see [websocket/events.md](../websocket/events.md))

---

### DELETE `/stage/:stageId`

Clears exploration for every user in a stage. **GM only.**

**Internal event:** Signal `fog.reset` (server-side, **not relayed** to WebSocket — see [websocket/events.md](../websocket/events.md))
