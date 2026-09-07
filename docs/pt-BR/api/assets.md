# Assets (Arquivos)

Upload e gerenciamento de arquivos.

## Endpoints

**Base:** `/api/assets`
**Auth:** `requireAuth, requireWorldMatch`

---

### POST `/upload`

Upload de arquivo. Multipart form-data com campo `file`.

- Limite: **100MB**
- Validação: magic bytes (rejeita um arquivo cujo conteúdo não bate com o tipo declarado — ex: SVG, HTML, exe renomeado pra `.png`)
- Tipos permitidos: `jpeg, jpg, png, webp, gif, mp3, ogg, wav, mp4, webm, mov`

**Query:**
- `?worldId=`: se presente e válido, salva em `/worlds/<worldId>/assets/`; senão vai pra `/uploads/`
- `?dir=`: sobrescreve o destino — **só em sessão admin** (Setup Hub), ignorado em auth normal

**Response `200`:** `{ success: true, path, name, size }`
**Response `400`:** `{ "error": "No file provided." }` / `{ "error": "File content does not match its declared type." }` / mensagem de erro do Multer (ex: limite de tamanho excedido)

---

### GET `/list`

Lista arquivos e subpastas.

**Query:** `?dir=` (default `'uploads/'`) — path traversal é bloqueado. Sessões não-admin só
podem listar `uploads/` ou o próprio `worlds/<worldId>/...`; sessões admin navegam livre.

**Response `200`:** `{ directories: string[], files: { name, path, type, size }[] }` — `type` é
`image`/`audio`/`video`/`unknown` baseado na extensão
**Response `403`:** `{ "error": "Access denied." }`
**Response `500`:** `{ "error": "Failed to list assets." }`
