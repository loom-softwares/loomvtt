# Playlists

## Endpoints

**Base:** `/api/playlists`
**Auth:** `requireAuth, requireWorldMatch`

---

### GET `/`

Lists world playlists. Returns array with `{ ...playlist, soundCount }`. Supports `?worldId=`.

---

### GET `/:id`

Fetches complete playlist with `sounds[]` and `soundCount`.

---

### POST `/`

Creates playlist. Returns `201` with the playlist and `soundCount: 0`. `400` when `name` is missing or empty.

| Field | Type | Default |
|-------|------|---------|
| `name` | `string` | **(required)** |
| `worldId` | `string` | `'world-1'` |
| `description` | `string` | `''` |
| `imgUrl` | `string` | `''` |
| `mode` | `string` | `'sequential'` |
| `volume` | `number` | `0.5` |
| `loop` | `boolean` | `false` |
| `fadeDuration` | `number` | `2` |
| `folderId` | `string` | `''` |

**WS Event:** `playlist.created`

---

### PUT `/:id`

Updates playlist. Only the sent fields change (`name`, `description`, `imgUrl`, `mode`, `volume`, `loop`, `fadeDuration`, `folderId`).
Changing `mode`, `loop`, `volume` or `fadeDuration` requires the `controlPlaylist` permission; without it, `403` with `{ "error": "Permission \"controlPlaylist\" required." }`.
Returns the playlist with `soundCount`. `404` when the playlist does not exist; `403` when the Document layer denies the edit (ownership).

**WS Event:** `playlist.updated`

---

### DELETE `/:id`

Removes playlist and its sounds. Returns `{ "success": true, "id" }`. `404` when the playlist does not exist; `403` when access is denied.

**WS Event:** `playlist.deleted`

---

### GET `/:playlistId/sounds`

Lists playlist sounds.

---

### POST `/:playlistId/sounds`

Adds sound. Returns `201` with the sound. `400` when `name` or `path` is missing; `404` when the playlist does not exist; `403` when the caller is neither GM nor an editor of the playlist.

| Field | Type | Required | Default |
|-------|------|-------------|---------|
| `name` | `string` | **yes** | — |
| `path` | `string` | **yes** | — |
| `volume` | `number` | no | `0.5` |
| `loop` | `boolean` | no | `false` |
| `fadeIn` | `number` | no | `0` |
| `fadeOut` | `number` | no | `0` |
| `sortOrder` | `number` | no | the end of the list (highest `sortOrder` + 1) |

**WS Event:** `playlist.sound.created` (payload is the sound plus `soundCount`)

---

### PUT `/:playlistId/sounds-order`

Sets the play order. Body: `{ "ids": [soundId, ...] }`; the array position becomes each sound's `sortOrder`. Unknown ids are ignored.
Returns the sounds of the playlist in play order. `400` when `ids` is not an array of strings; `404` when the playlist does not exist; `403` for callers who may not edit it.

**WS Event:** `playlist.updated` (payload is the playlist with `soundCount`)

---

### PUT `/:playlistId/sounds/:id`

Updates sound. Accepts `name`, `path`, `volume`, `loop`, `fadeIn`, `fadeOut`, `sortOrder`. Returns the updated sound.
`404` `{ "error": "Sound not found" }` when the sound is not in that playlist; `403` for callers who may not edit the playlist.

**WS Event:** `playlist.sound.updated`

---

### DELETE `/:playlistId/sounds/:id`

Removes sound. Returns `{ "success": true, "id" }`. `404` when the sound is not in that playlist; `403` for callers who may not edit the playlist.

**WS Event:** `playlist.sound.deleted` (payload is `{ id, playlistId, soundCount }`)
