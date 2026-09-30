# Notes (Notas no Mapa)

## Endpoints

**Base:** `/api/notes`
**Auth:** `requireAuth, requireWorldMatch`

---

### GET `/stage/:stageId`

Lista notas de uma stage.

---

### POST `/`

Cria nota.

| Campo | Tipo | Obrigatório |
|-------|------|-------------|
| `stageId` | `string` | **sim** |
| `journalId` | `string` | não |
| `levelId` | `string` | não |
| `x` | `number` | não |
| `y` | `number` | não |
| `visibleToPlayers` | `boolean` | não |

**Evento WS:** `note.created`

---

### PUT `/:id`

Atualiza nota.

**Evento WS:** `note.updated`

---

### DELETE `/:id`

Remove nota.

**Evento WS:** `note.deleted`
