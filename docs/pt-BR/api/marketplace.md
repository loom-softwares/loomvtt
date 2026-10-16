# Marketplace

## Endpoints

**Base:** `/api/marketplace`

---

### GET `/packages`

Lista pacotes disponíveis (addons + rulesets). Sem guarda de auth nesta rota.

**Query:** `?worldId=`. Com `worldId`, um addon fica `active` só se esse mundo tiver uma linha habilitada explícita em `world_packages`; sem ele, `active` vem do manifesto.

**Response `200`:** `{ "packages": [{ "type", "name", ...manifesto, "active" }] }`
**Response `500`:** `{ "error": "..." }`

---

### POST `/:type/:name/activate`

Ativa pacote (grava `active: true` no manifesto). `type` `ruleset` seleciona um ruleset; qualquer outro valor significa addon. `requireAdminSession`

**Response `200`:** `{ "success": true, "type", "name", "active": true }`
**Response `500`:** `{ "error": "..." }`

---

### POST `/:type/:name/deactivate`

Desativa pacote (grava `active: false` no manifesto). Mesma regra de `type` do activate. `requireAdminSession`

**Response `200`:** `{ "success": true, "type", "name", "active": false }`
**Response `500`:** `{ "error": "..." }`

---

### POST `/install`

Instala pacote de URL. `requireAdminSession`

**Request body:** `{ "manifestUrl": "...", "type": "addon|ruleset", "operationId"?, "expectedSha256"?, "entitlementVisa"? }`. `type` diferente de `ruleset` significa addon. `operationId` tem como default o `manifestUrl`.

**Response `200`:** o resultado de `installFromUrl` (flag `success` e detalhes)
**Response `400`:** `{ "error": "manifestUrl is required" }`
**Response `500`:** `{ "error": "..." }`
**Evento WS:** `addon.installed` com `{ type, name, version }` (só quando a instalação deu certo). Durante a instalação a rota também emite `operation.progress` com `{ operationId, percent, phase, label }`; veja a nota abaixo.

---

### POST `/:type/:name/update`

Reinstala o pacote a partir da release mais recente. `requireAdminSession`

**Request body (opcional):** `{ "operationId"? }`

**Response `200`:** o resultado de `updatePackage` (`success`, `alreadyUpToDate`, ...)
**Response `500`:** `{ "error": "..." }`
**Evento WS:** `addon.installed` com `{ type, name, version }` quando a atualização deu certo e não estava já atualizada

---

### DELETE `/:type/:name`

Desinstala pacote (addon ou ruleset). `type` `ruleset` seleciona um ruleset; qualquer outro valor significa addon. `requireAdminSession`

**Response `200`:** o resultado de `uninstallPackage`
**Response `500`:** `{ "error": "..." }`
**Evento WS:** `addon.uninstalled` (payload `{ type, name }`, só quando a desinstalação deu certo)

> **Nota:** `operation.progress` é emitido com `Signal.broadcast` pelas rotas de instalação e atualização. Esta página não confirma o nome que os clientes recebem para ele: UNVERIFIED (nenhum relay `Signal.listen` foi encontrado em `server/index.ts`).

---

### GET `/:type/:name/packs`

Lista os packs de compêndio declarados no manifesto do pacote (`compendiums`). Usado pela aba
Compêndios de `ModuleManifestWindow`. `requireAdminSession`

**Response `200`:** uma entrada por compêndio declarado. Um pack local com caminho inválido ou sem linha em `pack_meta` tem `name`/`packType`/`entryCount` como `null` e um campo `error` (`"invalid path"` ou `"pack_meta not found"`).
```json
[
  { "file": "packs/items.sqlite", "type": "local", "name": "Itens", "packType": "Item", "entryCount": 42 },
  { "file": null, "type": "remote", "apiUrl": "https://...", "name": null, "packType": null, "entryCount": null }
]
```
**Response `500`:** `{ "error": "..." }`

---

### PUT `/:type/:name/packs/rename`

Renomeia um pack local de compêndio (`.sqlite`) alterando o metadado na tabela `pack_meta`. `requireAdminSession`

**Request body:** `{ "file": "packs/items.sqlite", "name": "Novo Nome" }`

`file` precisa ser uma entrada literal da lista `compendiums` do manifesto; qualquer outro caminho é rejeitado.

**Response `200`:** `{ "success": true, "file": "packs/items.sqlite", "name": "Novo Nome" }`
**Response `400`:** `{ "error": "file is required." }`, `{ "error": "name is required." }` ou `{ "error": "Invalid pack path." }`
**Response `404`:** `{ "error": "Pack not declared in this manifest." }` ou `{ "error": "Pack file has no pack_meta row." }`
**Response `500`:** `{ "error": "..." }`

---

### GET `/:type/:name/update-check`

Verifica atualização. `requireAdminSession`

**Response `200`:** o resultado de `checkForUpdate`
**Response `500`:** `{ "error": "..." }`

---

### POST `/fetch-manifest`

Busca o manifesto remoto, a prévia antes de instalar. O manifesto precisa passar pelo mesmo gate Loom do instalador (`validateLoomManifest`). `requireAdminSession`

**Request body:** `{ "manifestUrl": "...", "type"?: "addon|ruleset" }`

**Response `200`:** `{ "manifest": {...}, "warning": ... }`
**Response `400`:** `{ "error": "manifestUrl is required" }`, ou o erro do gate quando o manifesto não é um pacote Loom
**Response `500`:** `{ "error": "..." }`

---

### GET `/catalog`

Busca no catálogo comunitário do Loom Hub (índice remoto via Supabase — não hospeda
download, só busca). Sem auth.

**Query:** `?type=`, `?category=`, `?q=` (busca por título/descrição)

O `banner_url` de cada linha é reescrito para o proxy do servidor `/api/marketplace/catalog/banner/:id` (ou `null`), então o navegador nunca busca imagens remotas diretamente.

**Response `200`:** `{ "packages": [...] }`
**Response `502`:** `{ "error": "Não foi possível carregar o catálogo do Loom Hub." }`

---

### GET `/catalog/banner/:id`

Faz proxy da imagem de banner de um pacote do catálogo. Só são servidos os ids retornados pela última chamada bem-sucedida a `/catalog`. Sem auth.

**Response `200`:** bytes da imagem (`Cache-Control: public, max-age=1800`)
**Response `404`:** corpo vazio quando o id é desconhecido, a origem não é imagem ou tem mais de 5 MB

---

### GET `/site-feed`

Lista até 12 artigos publicados do site do Loom para os cards do Setup Hub (índice somente leitura no Supabase, com cache de 30 minutos). Sem auth. Usa o último cache, ou uma lista vazia, quando a origem falha.

**Response `200`:** `{ "siteUrl": "...", "articles": [{ slug, title, summary, category, createdAt, coverUrl, link }] }`

---

### GET `/site-feed/cover/:slug`

Faz proxy da imagem de capa de um artigo. Só são servidos os slugs da última busca do feed. Sem auth.

**Response `200`:** bytes da imagem (`Cache-Control: public, max-age=1800`)
**Response `404`:** corpo vazio

---

### GET `/updates`

Verifica atualização de todos os packages instalados (addons + rulesets) de uma vez —
usado pelo sino de notificações do Setup Hub. **Auth:** `requireAdminSession`

**Response `200`:** `{ "updates": [{ type, name, title, hasUpdate: true, ... }] }` — já
filtrado, só traz os que têm atualização disponível

---

### PUT `/:type/:name/manifest`

Edita metadado do pacote instalado direto no `addon.json`/`ruleset.json` em disco
(usado pela tela "Editar Addon" e "Configurar Sistema" via `ModuleManifestWindow` do Setup Hub). **Auth:** `requireAdminSession`

**Request body (todos opcionais):** `{ title?, version?, author?, repository?, description?, dependencies?: string[], conflicts?: string[], systems?: string[] }`

Só esses oito campos são lidos. Outras chaves (`core`, `client`, `name`, `settings`, `compendiums`, `requiresApiKey`, ...) são ignoradas. `dependencies`, `conflicts` e `systems` precisam ser arrays (itens não-string são descartados), senão `400`.

**Response `400`:** `{ "error": "dependencies must be an array." }` (o mesmo para `conflicts` e `systems`)
**Response `500`:** `{ "error": "..." }`

**Comportamento de UI (`ModuleManifestWindow`):**
- A aba **Compêndios** só é exibida se o manifesto declarar `compendiums` com ao menos 1 item.
- A aba/campo de **Licença** só é exibida se o manifesto declarar `"requiresApiKey": true` (pacotes comerciais). Para pacotes comunitários/gratuitos, a interface permanece limpa.

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

**Response `200`:** `{ "codes": ["LOOM-XXXX-XXXX-XXXX", ...] }` (os códigos em texto puro voltam só aqui; o banco guarda um HMAC)
**Response `400`:** `{ "error": "packageName is required" }`
**Response `500`:** `{ "error": "..." }`

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
  **Response `400`:** `{ "error": "code is required" }` ou `{ "error": "worldId is required" }`
  **Response `500`:** `{ "error": "..." }`

### GET `/entitlements`

Lista as entitlements de pacote guardadas neste servidor (licenças sincronizadas da conta Loom). `requireAdminSession`

**Response `200`:** `{ "entitlements": [{ id, productId, packageName, packageType, tier, validUntil, status, isActive, expiresInDays, createdAt }] }`. `status` é `active` ou `expired`, a partir do visa assinado.
**Response `500`:** `{ "error": "..." }`

---

### POST `/entitlements/sync`

Busca agora as entitlements da conta Loom. `requireAdminSession`

**Response `200`:** o resultado de `syncAccountEntitlements`
**Response `500`:** `{ "error": "..." }`

---

### Erros de sessão admin

Toda rota marcada com `requireAdminSession` (`server/applications/api/setup.ts`) responde `401` com `{ "error": "Admin session required" }` quando não há cookie de admin, `401` com `{ "error": "Invalid or expired token" }` para token inválido, e `403` com `{ "error": "Admin access required" }` para token sem perfil admin.
