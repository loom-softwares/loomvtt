# Export

## Endpoints

**Base:** `/api/export`
**Auth:** `requireAuth, requireWorldMatch` (GM only)

---

### GET `/offline`

Generates a single self-contained HTML page listing every cast member (name, kind, avatar,
`traits`) of the caller's world. The world comes from the authenticated session (`req.auth.worldId`); there is no query parameter for it.

**Response `200`:** HTML file (`Content-Disposition: attachment; filename=offline-guild-log.html`)
**Response `400`:** `{ "error": "worldId required" }` (session without a world)
**Response `403`:** `{ "error": "Only a Gamemaster can export offline data." }` (caller is not GM)
**Response `500`:** `{ "error": "Failed to generate offline export package" }`
