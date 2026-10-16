# Configurações de Addon

## Endpoints

**Base:** `/api/module-settings`
**Auth:** `requireAuth, requireWorldMatch` (+ `requireGM` em PUT e DELETE)

---

### GET `/:worldId/:moduleId`

Lista todas as settings de um addon num mundo, como objeto chave-valor. Valores de settings com
escopo `secret` não são retornados: cada um aparece como `{ "configured": true }`.

**Response `200`:** `{ "data": { "chave1": valor1, "chave2": { "configured": true }, ... }, "error": null }`
**Response `500`:** `{ "data": null, "error": "..." }`

---

### PUT `/:worldId/:moduleId/:key`

Cria ou atualiza (upsert) uma setting específica. `requireGM`.

**Request body:**

| Campo | Tipo | Obrigatório | Default |
|-------|------|-------------|---------|
| `value` | `any` | **sim** | — |
| `scope` | `string` | não | `'world'` (`'world'`, `'secret'` ou `'client'`) |

`value` pode ser qualquer valor JSON: ele é guardado em uma coluna JSON, então uma string volta como string, um número como número,
e assim por diante. O corpo inteiro da requisição é limitado a 1 MB pelo parser JSON global. Um corpo maior recebe `413` antes de a rota rodar.

**Response `200`:** setting atualizada (se já existia) — `{ "data": {...}, "error": null }`
**Response `201`:** setting criada (se não existia) — `{ "data": {...}, "error": null }`
**Response `400`:** `{ "data": null, "error": "Value is required" }` quando `value` está ausente, ou `{ "data": null, "error": "Scope must be \"world\", \"secret\", or \"client\"" }` para qualquer outro `scope`
**Response `500`:** `{ "data": null, "error": "..." }` em caso de erro no banco

---

### DELETE `/:worldId/:moduleId/:key`

Remove uma setting específica. `requireGM`.

**Response `200`:** `{ "data": { "deleted": true }, "error": null }`
**Response `404`:** `{ "data": null, "error": "Setting not found" }`
**Response `500`:** `{ "data": null, "error": "..." }` em caso de erro no banco
