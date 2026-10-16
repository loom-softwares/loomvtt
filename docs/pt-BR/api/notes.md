# Notes (Notas no Mapa)

## Endpoints

**Base:** `/api/notes`
**Auth:** `requireAuth, requireWorldMatch`. O `GET` é aberto a todo usuário logado do mundo (jogadores veem os pinos e clicam neles para abrir o destino). `POST`, `PUT` e `DELETE` exigem GM (`requireGM`, 403 caso contrário).

---

### GET `/stage/:stageId`

Lista notas de uma stage.

---

### GET `/:id`

Busca uma nota. `404` com `{ "error": "Note not found" }` quando ela não existe.

---

### POST `/`

Cria nota. Retorna `201` com a nota criada. `400` com `{ "error": "stageId is required" }` quando `stageId` não é enviado.

| Campo | Tipo | Padrão |
|-------|------|-------------|
| `stageId` | `string` | **sim** |
| `journalId` | `string` | `''` |
| `targetStageId` | `string` | `''` |
| `levelId` | `string` | `''` |
| `x` | `number` | `0` |
| `y` | `number` | `0` |
| `visibleToPlayers` | `boolean` | `false` |
| `floors` | `number` | `0` |
| `visibleGlobally` | `boolean` | `false` |
| `iconEntry` | `string` | `'bookmark'` |
| `iconFontSize` | `number` | `15` |
| `iconTint` | `string` | `'#ffffff'` |
| `textLabel` | `string` | `''` |
| `fontFamily` | `string` | `'Padrão'` |
| `fontSize` | `number` | `15` |
| `textColor` | `string` | `'#ffffff'` |
| `textAnchor` | `string` | `'center'` |

**Eventos WS:** `note.created` (enviado pela rota). A camada de Document também emite `notes.created` no barramento de Signal do servidor, que não é repassado aos clientes WS.

---

### PUT `/:id`

Atualiza nota. Aceita os mesmos campos do `POST` (exceto `stageId`). Retorna `200` com a nota atualizada.

A vinculação é mutuamente exclusiva: definir `targetStageId` limpa `journalId`, e definir `journalId` limpa `targetStageId`.

**Erros:** `400` com `{ "error": "Not found" }` quando a nota não existe (a atualização informa isso como requisição inválida, não `404`).

**Evento WS:** `note.updated`

---

### DELETE `/:id`

Remove nota. Retorna `{ "success": true }`. `400` com `{ "error": "Not found" }` quando a nota não existe.

**Evento WS:** `note.deleted` com `{ id }`
