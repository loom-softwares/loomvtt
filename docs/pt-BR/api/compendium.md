# Compendium

## Endpoints

**Base:** `/api/compendium`
**Auth:** `requireAuth, requireWorldMatch`. Criar/alterar/remover pack, import/export, as rotas de adventure e as escritas de entries exigem a permissão `compendiumEdit` (`requirePermission`). A trava da fonte, as escritas de entries e pastas de fonte e o PUT do `entries-sheet` exigem GM (`requireGM`). As rotas de pack verificam se o pack pertence ao mundo logado (sessões admin à parte).

**Nomes WebSocket:** os sinais internos `compendium_packs.*` chegam aos clientes como `compendium.created|updated|deleted`.

---

### GET `/`

Lista os packs do mundo, do mais novo para o mais antigo. O mundo vem da sessão; `?worldId=` só vale para sessões admin.

**Response `200`:** `[{ id, worldId, name, type, folderId, entryCount, createdAt, updatedAt }]`

---

### POST `/`

Cria pack. O mundo vem da sessão (sessões admin usam o `worldId` do body). `type` tem default `'Actor'`.

**Request body:** `{ id?, name, type? }`

**Response `201`:** o pack criado com `entries: []`
**Response `400`:** `{ "error": "..." }` vindo da camada Document
**Evento WS:** `compendium.created` (Signal `compendium_packs.created`)

---

### GET `/resolve-uuid?uuid=Compendium.<package>.<pack>[.<docType>].<entryId>`

Resolve um UUID de Compendium para o pack e a entry. Procura primeiro nas fontes vivas de addon/ruleset do mundo, depois nos packs próprios do mundo.

**Response `200`:** `{ found: true, kind: 'source' | 'world', pack: { id, type, name, worldId, apiRoute }, entry: { id, name, type } }`
**Response `400`:** `{ "error": "uuid is required." }` / `{ "error": "Only Compendium UUIDs supported." }` / `{ "error": "Invalid Compendium UUID format." }`
**Response `404`:** `{ "found": false, "error": "Entry not found in compendium." }`

---

### GET `/:id`

Busca pack com entries e pastas.

**Response `200`:** o pack, com `entries` e `folders`
**Response `403`:** `{ "error": "Compendium pack belongs to a different world." }`
**Response `404`:** `{ "error": "Compendium pack not found." }`

---

### PUT `/:id`

Atualiza o `name` e/ou `folderId` do pack, e/ou substitui as entries (replace total: as entries antigas são apagadas e a lista nova é inserida).

**Request body:** `{ name?, folderId?, entries?: [] }`

**Response `200`:** `{ "success": true, "count": 12 }` (`count` só quando `entries` foi enviado)
**Response `400`:** `{ "error": "entries must be an array." }` / `{ "error": "No valid fields provided for update." }`
**Evento WS:** `compendium.updated` (Signal `compendium_packs.updated`, enviado na atualização dos metadados do pack)

---

### DELETE `/:id`

Remove o pack e suas entries.

**Response `200`:** `{ "success": true }`
**Evento WS:** `compendium.deleted` (Signal `compendium_packs.deleted`)

---

### POST `/:id/import`

Restaura entries de um arquivo JSON: um backup gerado por `/export` (array de entries), não um formato de ruleset/addon. O arquivo precisa estar dentro de `worlds/<worldId>/packs/`. As entries são acrescentadas após as existentes.

**Request body:** `{ "filePath": "backup.json" }` (relativo à pasta `packs` do pack)

**Response `200`:** `{ "success": true, "importedCount": 5, "totalCount": 17 }`
**Response `400`:** `{ "error": "filePath required." }`
**Response `403`:** `{ "error": "Access denied." }` (caminho fora da pasta)
**Response `404`:** `{ "error": "File not found." }`

---

### POST `/:id/export`

Grava todas as entries do pack em um arquivo JSON em `worlds/<worldId>/packs/`. O nome do arquivo é sanitizado para letras, dígitos, `_`, `-` e `.`.

**Request body:** `{ "fileName": "backup.json" }`

**Response `200`:** `{ "success": true, "path": "backup.json" }`
**Response `400`:** `{ "error": "fileName required." }`

---

### GET `/:packId/entries/:entryId`

Endpoint virtual que simula a API de documento real (`Actor`/`Item`/`JournalEntry`) pra
uma entry de compêndio — usado pra abrir a entry direto numa sheet normal.

**Response `200`:** formato varia pelo `pack.type`:
- `Actor`: `{ id, name, type, systemData, imgUrl, ownership, worldId }`
- `Item`: `{ id, name, type, data, imgUrl, ownership, worldId }`
- `JournalEntry`/`Journal`: `{ id, name, type, pages, ownership, worldId }`
- outros: `{ id, name, type, data, imgUrl, ownership, worldId }`

**Response `404`:** pack ou entry não encontrado

---

### PUT `/:packId/entries/:entryId`

Endpoint virtual que salva edições feitas numa sheet real de volta pra entry do
compêndio. **Auth:** `requirePermission('compendiumEdit')`

**Request body:** `name`, `imgUrl` e o dado do documento: `systemData` (Actor), `data` (Item e outros) ou os campos de página do journal (Journal)
**Response `200`:** a entry no mesmo formato do GET acima
**Response `403`:** pack pertence a outro mundo
**Response `404`:** pack ou entry não encontrado
**Response `500`:** `{ "error": "Failed to update entry." }`
**Evento WS:** `compendium.entry.updated` (`{ packId, entry }`)

---

### POST `/:id/adventure-entry`

Empacota actors (com os itens deles), items, stages, journals, macros e playlists (com sons)
numa única entry "Adventure" auto-contida guardada no pack — só pra packs de `type:
'Adventure'`. Ownership e IDs são removidos; reimportar cria cópias novas.

**Request body:** `{ "name": "...", "actorIds"?: [], "itemIds"?: [], "stageIds"?: [], "journalIds"?: [], "macroIds"?: [], "playlistIds"?: [] }`

Só documentos do mundo do pack são empacotados. Stages são salvos sem seus placeables (cast, walls, lights, tiles, notes, drawings).

**Response `201`:** Entry criada (`{ id, name, type: 'Adventure', data }`)
**Response `400`:** `{ "error": "Field \"name\" is required." }` / `{ "error": "Pack is not an Adventure pack." }`
**Response `404`:** `{ "error": "Compendium pack not found." }`

---

### POST `/:id/adventure-entry/:entryId/import`

Recria todo documento empacotado numa entry Adventure como documento novo no mundo do pack
(IDs novos — referências cruzadas dentro de `systemData`/`data` não são remapeadas). Stages voltam inativos, como mapas em branco.

**Response `200`:** `{ "success": true, "created": { actors, items, stages, journals, macros, playlists } }`
**Response `400`:** `{ "error": "Pack is not an Adventure pack." }`
**Response `404`:** `{ "error": "Compendium pack not found." }` / `{ "error": "Entry not found." }`

---

## Fontes de addon/ruleset (só leitura, nunca copiado pro mundo)

Essas rotas navegam fontes de compêndio vivas declaradas por addons/rulesets ativos
(`manifest.compendiums` — arquivos `.sqlite` locais ou APIs remotas, ver
[system-creation.md](../guide/system-creation.md#fontes-remotas-de-compendio-modelo-de-seguranca)
pro modelo de segurança da fonte remota). Navegar nunca escreve nada no banco do
mundo — só `.../import` materializa uma entry específica.

Toda listagem é escopada pelo mundo autenticado da request: só aparecem o ruleset do
próprio `world.system`, addons habilitados pra aquele mundo (`world_packages`, não a
antiga `world.packageIds` — nunca escrita por nenhum código vivo) e, dentre esses, só os
que não restringem `systems` pra outro sistema. Uma fonte `remote` com
`requiresApiKey: true` sem licença resgatada pra este servidor simplesmente não aparece
na lista — não é 403, é omitida.

**Auth em `/sources*`:** as leituras (`GET`) precisam só da sessão logada, igual a `/browse/*`. O import exige `compendiumEdit`. A trava, as escritas de entries e pastas e o PUT do `entries-sheet` exigem GM (`requireGM`), porque alteram o arquivo da fonte compartilhado por todo mundo que a usa.

**CODE ISSUE:** as leituras `GET /sources*` não têm restrição de papel. Qualquer jogador consegue ler os dados completos de todas as entries de uma fonte (inclusive o `data` de `GET .../entries/:entryId`), e não só o que o GM importou. Fontes remotas são usadas por proxy com credencial guardada pelo servidor, então esse acesso de leitura não se limita ao que o GM licenciou.

### GET `/sources`

Lista toda fonte viva escopada pro mundo do request (ver nota de escopo acima).

**Response `200`:** `[{ sourceId, name, type, ownerName, ownerType, locked }]`

---

### GET `/sources/:sourceId/entries`

Listagem leve de entries de uma fonte (sem payload `data`), mais as pastas. `?search=`

**Response `200`:** `{ sourceId, name, type, locked, entries: [{ id, name, type, sortOrder, imgUrl }], folders }`
**Response `404`:** `{ "error": "Compendium source not found." }`

---

### GET `/sources/:sourceId/entries/:entryId`

Entry completa, incluindo `data` (o formato bruto usado no drag-and-drop).

**Response `404`:** `{ "error": "Entry not found." }`

---

### Sheets de entries de fonte

`/entries/:entryId` devolve o formato bruto usado por drag-and-drop. Uma sheet de
Actor, Item ou Journal usa o contrato separado `entries-sheet`, que adapta os dados ao
mesmo formato de um documento do mundo.

### GET `/sources/:sourceId/entries-sheet/:entryId`

Lê uma entry no formato da sheet. Para `Journal`/`JournalEntry`, a resposta contém
`pages`, `categories`, `flags` e `locked`; para Actor, `systemData`; para os demais
tipos, `data`.

### PUT `/sources/:sourceId/entries-sheet/:entryId`

Atualiza a entry no formato da sheet. Exige GM e a fonte deve estar desbloqueada. Em
journals, aceita nome, imagem, páginas, categorias e flags/tema; as partes não enviadas
são preservadas.

**Evento WS:** `compendium.sourceEntryUpdated` com `{ sourceId, entryId }`.

### CRUD de páginas e categorias de Journal

Para entries `Journal`/`JournalEntry`, as mesmas operações de páginas e categorias de
um journal do mundo estão disponíveis em:

`/sources/:sourceId/entries-sheet/:entryId/:collection/:childId?`

`collection` é `pages` ou `categories`. Use `POST` sem `childId` para criar, `PUT` com
`childId` para atualizar e `DELETE` com `childId` para remover. `DELETE` em categoria zera o `categoryId` das páginas dela. Outros métodos devolvem `405`.

- Entries de fonte (`/sources/...`): só GM, fonte destravada, tipo do pack `Journal`/`JournalEntry`. Emite `compendium.sourceEntryUpdated`.
- Packs do mundo (`/:packId/...`): exige `compendiumEdit`, o pack precisa pertencer ao mundo logado, e o tipo precisa ser `Journal`/`JournalEntry`. Emite `compendium.entry.updated`.

**Response `200`:** a linha criada ou atualizada (`{ ok: true }` no `DELETE`)
**Response `400`:** o pack não é um journal (ou a atualização da entry falhou)
**Response `403`:** `{ "error": "Desbloqueie o compêndio antes de editar." }` para fonte travada; `403` puro (sem corpo JSON) quando quem chama não é GM ou o pack é de outro mundo
**Response `404`:** pack, entry ou child não encontrado (`404` puro, sem corpo JSON)

---

### POST `/sources/:sourceId/entries/:entryId/import`

Materializa UMA entry no compêndio do próprio mundo (cria o pack de destino no primeiro
uso, nomeado a partir da fonte). Nunca copia o resto do pack de origem.

**Request body:** `{ "worldId": "..." }` (obrigatório)

**Response `201`:** `{ packId, entry }`
**Response `400`:** `{ "error": "worldId is required." }`
**Response `403`:** `{ "error": "Access denied." }` quando `worldId` não bate com o mundo autenticado de quem chamou
**Response `404`:** `{ "error": "Compendium source not found." }` / `{ "error": "Entry not found." }`

---

### POST `/sources/:sourceId/lock`

Só GM. Trava (`true`) ou destrava (`false`) o pack-fonte inteiro. A trava fica gravada no arquivo da fonte e afeta todo mundo que a usa.

**Request body:** `{ "locked": true }` (precisa ser booleano)

**Response `200`:** `{ "sourceId": "...", "locked": true }`
**Response `400`:** `{ "error": "\"locked\" (boolean) is required." }`
**Response `404`:** `{ "error": "Compendium source not found or not editable." }`
**Nota:** o sinal `compendium.sourceLockChanged` não é relayado para clientes WebSocket.

---

### GET `/sources/:sourceId/entries-sheet/:entryId`

A entry no formato que a sheet lê: `systemData` para fontes de Actor, `pages`/`categories` para fontes de Journal, `data` para as demais. Qualquer sessão logada.

**Response `200`:** `{ id, name, type, imgUrl, ownership: {}, worldId, ... }`
**Response `404`:** `{ "error": "Compendium source not found." }` / `{ "error": "Entry not found." }`

---

### PUT `/sources/:sourceId/entries-sheet/:entryId`

Só GM, e a fonte precisa estar destravada. Grava as edições da sheet de volta no arquivo da fonte. Aceita `name`, `imgUrl` e o campo de dados do tipo (`systemData` para Actor, os campos de journal para Journal, `data` nos demais).

**Response `200`:** a entry, no mesmo formato do GET
**Response `403`:** `{ "error": "Compendium source is locked. Unlock it first." }`
**Response `404`:** `{ "error": "Compendium source not found." }` / `{ "error": "Entry not found." }`
**Response `500`:** `{ "error": "Failed to update compendium entry." }`
**Evento WS:** `compendium.sourceEntryUpdated` (`{ sourceId, entryId }`)

---

### POST `/sources/:sourceId/entries`

Só GM, fonte destravada. Cria uma nova entry no arquivo da fonte.

**Response `201`:** a entry criada
**Response `400`:** `{ "error": "..." }` vindo do gravador da fonte
**Response `403`:** fonte travada
**Nota:** o sinal `compendium.sourceFolderChanged` não é relayado para clientes WebSocket.

---

### PUT `/sources/:sourceId/entries/:entryId/folder`

Só GM, fonte destravada. Move uma entry para outra pasta da fonte.

**Request body:** `{ "folderId": "..." }` (obrigatório)

**Response `200`:** `{ "success": true, "folderId": "..." }`
**Response `400`:** `{ "error": "folderId is required." }`
**Response `403`:** fonte travada
**Response `404`:** `{ "error": "Entry not found." }`

---

### POST / PUT / DELETE `/sources/:sourceId/folders[/:folderId]`

Só GM, fonte destravada. Cria (`POST`, `201`, devolve a pasta), renomeia ou move (`PUT`, devolve a pasta) ou remove (`DELETE`, `{ "success": true, "id": "..." }`) uma pasta da fonte.

**Response `403`:** fonte travada
**Response `404`:** `{ "error": "Compendium source not found." }` / `{ "error": "Folder not found." }`

---

## Fontes de addon/ruleset — leitura pro jogador (`/browse/*`)

Mesmo escopo/dados de `/sources*` acima, mas **sem exigir `compendiumEdit`** — só
autenticado no mundo. Existe pra seletores voltados a jogador (ex: o wizard de
personagem escolhendo raça/classe) que precisam navegar compêndio sem serem GM. Nunca
tem rota de escrita/import aqui.

### GET `/browse/sources`

Igual `/sources`, com filtro opcional `?type=`.

**Response `200`:** `[{ sourceId, name, type }]`

---

### GET `/browse/sources/:sourceId/entries`

Igual `/sources/:sourceId/entries`. `?search=`

**Response `200`:** `{ sourceId, name, type, entries: [...] }`

---

### GET `/browse/sources/:sourceId/entries/:entryId`

Igual `/sources/:sourceId/entries/:entryId`.

---

### GET `/browse/entries?entryType=X&search=Y`

Busca em TODA fonte escopada pro mundo de uma vez, filtrado pelo `type` da própria
entry (`class`/`race`/`feat`/`subclass`/`spell`/...) — não pelo `type` do pack (que é só
um balde genérico: `Actor`/`Item`/`Journal`). Deixa um seletor perguntar
"toda entry de classe chamada X, em qualquer pack" sem saber de antemão quais
`sourceId`s existem.

**Query:** `entryType` (obrigatório), `search`, `includeData` (`"true"` pra incluir o
campo `data` de cada entry — necessário quando quem chama precisa filtrar client-side
por um campo mecânico, ex: subclass picker por `classIdentifier`)

**Response `200`:** `{ entries: [{ ...entry, sourceId, sourceName }] }`
**Response `400`:** `entryType` ausente
