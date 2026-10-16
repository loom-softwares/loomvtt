# Export

## Endpoints

**Base:** `/api/export`
**Auth:** `requireAuth, requireWorldMatch` (somente GM)

---

### GET `/offline`

Gera uma única página HTML auto-contida listando todo membro do elenco (nome, tipo, avatar,
`traits`) do mundo do usuário. O mundo vem da sessão autenticada (`req.auth.worldId`); não há query parameter para ele.

**Response `200`:** arquivo HTML (`Content-Disposition: attachment; filename=offline-guild-log.html`)
**Response `400`:** `{ "error": "worldId required" }` (sessão sem mundo)
**Response `403`:** `{ "error": "Only a Gamemaster can export offline data." }` (usuário não é GM)
**Response `500`:** `{ "error": "Failed to generate offline export package" }`
