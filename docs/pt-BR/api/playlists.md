# Playlists

## Endpoints

**Base:** `/api/playlists`
**Auth:** `requireAuth, requireWorldMatch`

---

### GET `/`

Lista playlists do mundo. Retorna array com `{ ...playlist, soundCount }`. Suporta `?worldId=`.

---

### GET `/:id`

Busca playlist completa contendo `sounds[]` e `soundCount`.

---

### POST `/`

Cria playlist. Retorna `201` com a playlist e `soundCount: 0`. `400` quando `name` falta ou está vazio.

| Campo | Tipo | Default |
|-------|------|---------|
| `name` | `string` | **(obrigatório)** |
| `worldId` | `string` | `'world-1'` |
| `description` | `string` | `''` |
| `imgUrl` | `string` | `''` |
| `mode` | `string` | `'sequential'` |
| `volume` | `number` | `0.5` |
| `loop` | `boolean` | `false` |
| `fadeDuration` | `number` | `2` |
| `folderId` | `string` | `''` |

**Evento WS:** `playlist.created`

---

### PUT `/:id`

Atualiza playlist. Só os campos enviados mudam (`name`, `description`, `imgUrl`, `mode`, `volume`, `loop`, `fadeDuration`, `folderId`).
Alterar `mode`, `loop`, `volume` ou `fadeDuration` exige a permissão `controlPlaylist`; sem ela, `403` com `{ "error": "Permission \"controlPlaylist\" required." }`.
Retorna a playlist com `soundCount`. `404` quando a playlist não existe; `403` quando a camada de Document nega a edição (propriedade).

**Evento WS:** `playlist.updated`

---

### DELETE `/:id`

Remove playlist e seus sons. Retorna `{ "success": true, "id" }`. `404` quando a playlist não existe; `403` quando o acesso é negado.

**Evento WS:** `playlist.deleted`

---

### GET `/:playlistId/sounds`

Lista sons da playlist.

---

### POST `/:playlistId/sounds`

Adiciona som. Retorna `201` com o som. `400` quando `name` ou `path` falta; `404` quando a playlist não existe; `403` quando quem chama não é GM nem editor da playlist.

| Campo | Tipo | Obrigatório | Default |
|-------|------|-------------|---------|
| `name` | `string` | **sim** | — |
| `path` | `string` | **sim** | — |
| `volume` | `number` | não | `0.5` |
| `loop` | `boolean` | não | `false` |
| `fadeIn` | `number` | não | `0` |
| `fadeOut` | `number` | não | `0` |
| `sortOrder` | `number` | não | o fim da lista (maior `sortOrder` + 1) |

**Evento WS:** `playlist.sound.created` (o payload é o som mais `soundCount`)

---

### PUT `/:playlistId/sounds-order`

Define a ordem de reprodução. Corpo: `{ "ids": [soundId, ...] }`; a posição no array vira o `sortOrder` de cada som. Ids desconhecidos são ignorados.
Retorna os sons da playlist na ordem de reprodução. `400` quando `ids` não é um array de strings; `404` quando a playlist não existe; `403` para quem não pode editá-la.

**Evento WS:** `playlist.updated` (o payload é a playlist com `soundCount`)

---

### PUT `/:playlistId/sounds/:id`

Atualiza som. Aceita `name`, `path`, `volume`, `loop`, `fadeIn`, `fadeOut`, `sortOrder`. Retorna o som atualizado.
`404` `{ "error": "Sound not found" }` quando o som não está nessa playlist; `403` para quem não pode editar a playlist.

**Evento WS:** `playlist.sound.updated`

---

### DELETE `/:playlistId/sounds/:id`

Remove som. Retorna `{ "success": true, "id" }`. `404` quando o som não está nessa playlist; `403` para quem não pode editar a playlist.

**Evento WS:** `playlist.sound.deleted` (o payload é `{ id, playlistId, soundCount }`)
