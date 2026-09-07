# Export

## Endpoints

**Base:** `/api/export`
**Auth:** None — no middleware is applied to this router.

---

### GET `/offline`

Generates a single self-contained HTML page listing every cast member (name, kind, avatar,
`traits`) across **all worlds** — there is no `worldId` filter.

**Response `200`:** HTML file (`Content-Disposition: attachment; filename=offline-guild-log.html`)
**Response `500`:** `{ "error": "Failed to generate offline export package" }`
