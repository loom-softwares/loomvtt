# Systems (Sistemas/Rulesets)

## Endpoints

**Base:** `/api/systems`
**Auth:** Nenhum

---

### GET `/`

Lista sistemas registrados.

**Response `200`:** `[{ id, title, version, backgroundUrl, author, repository }]`

---

### GET `/active`

Sistema ativo com default data.

**Response `200`:** `{ id, title, version, actorTypes, itemTypes, defaultData }`

---

### GET `/active/sheet`

Schema de ficha do sistema ativo. `?type=character`

**Response `200`:** `{ tabs: [{ id, label, fields }] }`

---

### GET `/active/item-sheet`

Schema de item do sistema ativo. `?type=equipment`

---

## Self-update do servidor (`/api/system`)

> Base diferente das rotas acima — mesmo nome parecido, router à parte
> (`server/applications/api/system.ts`), montado em `/api/system` (singular), não
> `/api/systems`.

**Auth:** `requireAdminSession` nas duas rotas.

### GET `/api/system/update-check`

Compara a versão local (`package.json`) contra a última release no GitHub.

**Query:** `?channel=stable|preview` (default `stable`)

**Response `200`:** `{ currentVersion, latestVersion, hasUpdate, changelog, publishedAt, channel, error? }`
— em erro de rede/GitHub, ainda responde `200` com `hasUpdate: false` e `error` preenchido
(nunca deixa a tela travada num "?").

---

### POST `/api/system/update`

Roda `git pull && npm install && npm run build` no diretório da aplicação.

**Response `200`:** `{ "success": boolean, "log": "..." }` (stdout/stderr combinados,
mesmo em falha)
