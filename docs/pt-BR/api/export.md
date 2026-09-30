# Export

## Endpoints

**Base:** `/api/export`
**Auth:** Nenhum — nenhum middleware é aplicado nessa rota.

---

### GET `/offline`

Gera uma única página HTML auto-contida listando todo membro do elenco (nome, tipo, avatar,
`traits`) de **todos os mundos** — não existe filtro por `worldId`.

**Response `200`:** arquivo HTML (`Content-Disposition: attachment; filename=offline-guild-log.html`)
**Response `500`:** `{ "error": "Failed to generate offline export package" }`
