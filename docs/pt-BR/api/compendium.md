# Compendium

## Endpoints

**Base:** `/api/compendium`
**Auth:** `requireAuth` (+ `requirePermission('compendiumEdit')` em POST/PUT/DELETE/import/export)

---

### GET `/`

Lista packs. `?worldId=`

**Response `200`:** `[{ id, name, type, entryCount }]`

---

### POST `/`

Cria pack.

**Request body:** `{ id, worldId, name, type }`

---

### GET `/:id`

Busca pack com entries.

---

### PUT `/:id`

Substitui entries (replace total).

**Request body:** `{ entries[] }`

---

### DELETE `/:id`

Remove pack.

---

### POST `/:id/import`

Importa entries de arquivo JSON.

**Request body:** `{ filePath }`

---

### POST `/:id/export`

Exporta entries para JSON.

**Request body:** `{ fileName }`

---

### GET `/:packId/entries/:entryId`

Endpoint virtual que simula a API de documento real (`Actor`/`Item`/`JournalEntry`) pra
uma entry de compêndio — usado pra abrir a entry direto numa sheet normal.

**Response `200`:** formato varia pelo `pack.type`:
- `Actor`: `{ id, name, type, systemData, imgUrl, ownership, worldId }`
- `Item`: `{ id, name, type, data, imgUrl, ownership, worldId }`
- `JournalEntry`/`Journal`: `{ id, name, type, pages, ownership, worldId }`
- outros: `{ id, name, type, data, imgUrl, ownership, worldId }`

**Response `404`:** pack ou entry não encontrado

---

### PUT `/:packId/entries/:entryId`

Endpoint virtual que salva edições feitas numa sheet real de volta pra entry do
compêndio. **Auth:** `requirePermission('compendiumEdit')`

**Request body:** campos da entry a atualizar (varia por tipo)
**Response `404`:** pack ou entry não encontrado

---

### POST `/:id/adventure-entry`

Empacota actors (com os itens deles), items, stages, journals, macros e playlists (com sons)
numa única entry "Adventure" auto-contida guardada no pack — só pra packs de `type:
'Adventure'`. Ownership e IDs são removidos; reimportar cria cópias novas.

**Request body:** `{ "name": "...", "actorIds"?: [], "itemIds"?: [], "stageIds"?: [], "journalIds"?: [], "macroIds"?: [], "playlistIds"?: [] }`

**Response `201`:** Entry criada (`{ id, name, type: 'Adventure', data }`)
**Response `400`:** `{ "error": "Field \"name\" is required." }` / `{ "error": "Pack is not an Adventure pack." }`
**Response `404`:** `{ "error": "Compendium pack not found." }`

---

### POST `/:id/adventure-entry/:entryId/import`

Recria todo documento empacotado numa entry Adventure como documento novo no mundo do pack
(IDs novos — referências cruzadas dentro de `systemData`/`data` não são remapeadas).

**Response `200`:** `{ "success": true, "created": { actors, items, stages, journals, macros, playlists } }`
**Response `400`:** `{ "error": "Pack is not an Adventure pack." }`
**Response `404`:** `{ "error": "Compendium pack not found." }` / `{ "error": "Entry not found." }`

---

### POST `/restore-from-system`

Restaura manualmente os compêndios que vêm com o sistema (ruleset) ativo do mundo — o
mesmo processo rodado automaticamente ao ativar um mundo. **Auth:**
`requirePermission('compendiumEdit')`

**Request body:** `{ "worldId": "..." }`

**Response `200`:** `{ "success": true, "count": number }`
**Response `400`:** `worldId` ausente
