# Configurações de Addon

## Endpoints

**Base:** `/api/module-settings`
**Auth:** `requireAuth, requireWorldMatch`

---

### GET `/:worldId/:moduleId`

Lista todas as settings de um addon num mundo, como objeto chave-valor.

**Response `200`:** `{ "data": { "chave1": valor1, ... }, "error": null }`

---

### PUT `/:worldId/:moduleId/:key`

Cria ou atualiza (upsert) uma setting específica.

**Request body:**

| Campo | Tipo | Obrigatório | Default |
|-------|------|-------------|---------|
| `value` | `any` | **sim** | — |
| `scope` | `string` | não | `'world'` (`'world'` ou `'client'`) |

**Response `200`:** setting atualizada (se já existia) — `{ "data": {...}, "error": null }`
**Response `201`:** setting criada (se não existia)
**Response `400`:** `value` ausente, ou `scope` fora de `'world'`/`'client'`

---

### DELETE `/:worldId/:moduleId/:key`

Remove uma setting específica.

**Response `200`:** `{ "data": { "deleted": true }, "error": null }`
**Response `404`:** `{ "data": null, "error": "Setting not found" }`
