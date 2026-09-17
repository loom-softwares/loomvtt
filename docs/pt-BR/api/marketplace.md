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

---

### PUT `/:type/:name/manifest`

Edita metadado do pacote instalado direto no `addon.json`/`ruleset.json` em disco
(usado pela tela "Editar Addon" do Setup Hub). **Auth:** `requireAdminSession`

**Request body (todos opcionais):** `{ title?, version?, author?, repository?, description?, dependencies?: string[], conflicts?: string[], systems?: string[] }`

Nunca aceita `core`/`client`/`name`/`settings`/`compendiums`/`requiresApiKey` — isso é
código/estrutura do pacote, não metadado editável por aqui.

**Response `200`:** `{ success, type, name, manifest }`

---

### GET `/:name/license`

Lê a licença resgatada pra um addon remoto pago — **por instalação do servidor, não por
mundo** (ver [Fontes remotas de compêndio](../guide/system-creation.md#fontes-remotas-de-compendio-modelo-de-seguranca)).
**Auth:** `requireAdminSession`

**Response `200`:** `{ code, used }` — `code` vem vazio se nenhuma licença foi resgatada ainda

---

### POST `/codes/generate`

Gera códigos de ativação pra um pacote **local** vendido pelo próprio Loom (Fase 1 do
marketplace pago — venda ainda é manual, fora do app). **Auth:** `requireAdminSession`

**Request body:** `{ "packageName": "...", "quantity"?: número (1-100, default 1) }`

**Response `200`:** `{ "codes": ["LOOM-XXXX-XXXX-XXXX", ...] }`

---

### POST `/redeem`

Resgata um código/licença. Comportamento ramifica pela presença de `packageName` no
body: **Auth:** `requireAdminSession`

- **Com `packageName`** (addon remoto, `requiresApiKey: true`): licença **por instalação**,
  não por mundo — não exige `worldId`. A key nunca foi gerada por nós (vem do vendedor
  terceiro), então não há nada pra validar aqui: só grava o que foi colado
  (`worldId: ''`, server-wide). Se a key for inválida, o erro aparece na primeira
  requisição remota real, não neste endpoint.
  **Request body:** `{ "code": "...", "packageName": "..." }`
  **Response `200`:** `{ success: true, packageName, remote: true }`
  **Response `404`:** addon não instalado neste servidor
  **Response `400`:** addon não declara `requiresApiKey`

- **Sem `packageName`** (addon **local** vendido por nós, comportamento original,
  por-mundo): código precisa ter sido gerado via `/codes/generate`, uso único.
  **Request body:** `{ "code": "...", "worldId": "..." }`
  **Response `200`:** `{ success: true, packageName, worldId }`
  **Response `404`:** código não encontrado / pacote não instalado
  **Response `409`:** código já foi usado
