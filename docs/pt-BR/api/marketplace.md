# Marketplace

## Endpoints

**Base:** `/api/marketplace`

---

### GET `/packages`

Lista pacotes disponíveis (addons + rulesets).

**Response `200`:** `{ "packages": [...] }`

---

### POST `/:type/:name/activate`

Ativa pacote. `requireAdminSession`

---

### POST `/:type/:name/deactivate`

Desativa pacote. `requireAdminSession`

---

### POST `/install`

Instala pacote de URL. `requireAdminSession`

**Request body:** `{ "manifestUrl": "...", "type": "addon|ruleset" }`

**Evento WS:** `addon.installed`

---

### DELETE `/:type/:name`

Desinstala pacote. `requireAdminSession`

**Evento WS:** `addon.uninstalled`

---

### GET `/:type/:name/update-check`

Verifica atualização. `requireAdminSession`

---

### POST `/fetch-manifest`

Busca manifesto remoto. `requireAdminSession`

**Request body:** `{ "manifestUrl": "..." }`

---

### GET `/catalog`

Busca no catálogo comunitário do Loom Hub (índice remoto via Supabase — não hospeda
download, só busca). Sem auth.

**Query:** `?type=`, `?category=`, `?q=` (busca por título/descrição)

**Response `200`:** `{ "packages": [...] }`
**Response `502`:** `{ "error": "Não foi possível carregar o catálogo do Loom Hub." }`

---

### GET `/updates`

Verifica atualização de todos os packages instalados (addons + rulesets) de uma vez —
usado pelo sino de notificações do Setup Hub. **Auth:** `requireAdminSession`

**Response `200`:** `{ "updates": [{ type, name, title, hasUpdate: true, ... }] }` — já
filtrado, só traz os que têm atualização disponível
