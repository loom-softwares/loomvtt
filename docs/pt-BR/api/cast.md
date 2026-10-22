# Cast (Tokens)

Membros do elenco — personagens, NPCs, monstros no cenário.

## Schema

| Campo | Tipo | Default | Descrição |
|-------|------|---------|-----------|
| `id` | `string` | UUID (`member-<uuid>`) | Identificador único |
| `worldId` | `string` | `'world-1'` | Mundo: vem da sessão, ou do body quando a sessão não tem mundo. O default do schema só se aplica quando nenhum dos dois é informado |
| `stageId` | `string` | id da stage ativa, ou `'stage-1'` | Stage (cenário) atual |
| `levelId` | `string` | `''` | Level dentro da stage |
| `name` | `string` | — | Nome (**obrigatório**) |
| `kind` | `string` | `'adventurer'` | Tipo (`adventurer`, `monster`, `npc`, etc.) |
| `traits` | `object` | `{}` | Atributos do sistema (ex: `{ hp: { value: 10 } }`) |
| `x` | `number` | `100` | Posição X no grid |
| `y` | `number` | `100` | Posição Y no grid |
| `colorHex` | `string` | cor hex aleatória | Cor do token |
| `avatarUrl` | `string` | `''` | URL do avatar |
| `ringColor` | `string` | `colorHex` quando informado, senão `'#e74c3c'` | Cor do anel |
| `ringUrl` | `string` | `''` | URL da imagem do anel |
| `ringEffect` | `string` | `'none'` | Efeito do anel |
| `ringScale` | `number` | `1.6` | Escala do anel |
| `shape` | `string` | `'circle'` | Forma (`circle`, `square`, etc.) |
| `effects` | `array` | `[]` | Efeitos visuais ativos |
| `statusMarkers` | `array` | `[]` | Marcadores de status |
| `systemData` | `object` | `{}` | Dados do sistema (ruleset) |
| `actorId` | `string` | `''` | ID do actor vinculado |
| `isLinked` | `boolean` | `false` | Vinculado ao actor? |
| `ownership` | `object` | só o criador (e os donos do actor vinculado com nível de edição, na criação) | Permissões de dono |
| `folderId` | `string` | `''` | Pasta |
| `elevation` | `number` | `0` | Elevação |
| `locked` | `boolean` | `false` | Bloqueado? |
| `hidden` | `boolean` | `false` | Escondido? |
| `movementAction` | `string` | `'walk'` | Tipo de movimento |
| `targetedBy` | `array` | `[]` | Quem está mirando |
| `tintColor` | `string` | `'#ffffff'` | Cor de matiz |
| `opacity` | `number` | `1` | Opacidade |
| `rotation` | `number` | `0` | Rotação (graus) |
| `scale` | `number` | `1` | Escala |
| `sightEnabled` | `boolean` | `true` | Visão habilitada? |
| `sightRange` | `number` | `0` | Alcance da visão |
| `sightAngle` | `number` | `360` | Ângulo da visão |
| `sightMode` | `string` | `'basic'` | Modo de visão |
| `detectionModes` | `array` | `[]` | Modos de detecção |
| `lightDimRange` | `number` | `0` | Alcance da luz (dim) |
| `lightBrightRange` | `number` | `0` | Alcance da luz (bright) |
| `lightColor` | `string` | `'#ffffff'` | Cor da luz |
| `lightAnimation` | `string` | `'none'` | Animação da luz |
| `barGridSize` | `number` | `1` | Grid size da barra |
| `bar1` | `object` | `{"attribute":"attributes.hp","color":"dynamic"}` | Configuração da barra 1 (inferior - vida) |
| `bar2` | `object` | `{"attribute":"","color":"#3498db"}` | Configuração da barra 2 (superior - mana/recurso) |
| `displayBars` | `number` | `20` | Visibilidade das barras (`0` Nunca, `10` Control, `20` Hover Dono/GM, `30` Hover Todos, `40` Sempre Dono/GM, `50` Sempre Todos) |
| `createdAt` | `string` | — | Timestamp de criação |
| `updatedAt` | `string` | — | Timestamp de atualização |

---

## Endpoints

**Base:** `/api/cast`
**Auth:** `requireAuth, requireWorldMatch` (JWT via cookie)

---

### GET `/`

Lista todos os membros do elenco, ordenados por `createdAt` ascendente.

**Query:** `?stageId=` (só os tokens dessa stage), `?limit=`, `?offset=`

**Response `200`:**
```json
[
  {
    "id": "member-abc123",
    "name": "Aragorn",
    "kind": "adventurer",
    "x": 500, "y": 300,
    "colorHex": "#e74c3c",
    "shape": "circle",
    "traits": { "hp": { "value": 25, "max": 25 }, "ac": 15 },
    "effects": [],
    "statusMarkers": [],
    "systemData": {},
    "stageId": "stage-1",
    "locked": false, "hidden": false,
    "sightEnabled": true, "sightRange": 30
  }
]
```

**Response `500`:**
```json
{ "error": "Failed to retrieve cast members" }
```

---

### GET `/:id`

Busca um membro por ID.

**Parâmetros:** `id` (path)

**Response `200`:** Objeto do cast member
**Response `404`:** `{ "error": "Cast member not found" }`

---

### GET `/by-actor/:actorId`

Retorna todos os tokens vinculados a um actor.

**Parâmetros:** `actorId` (path)

**Response `200`:** `Cast[]`
**Response `500`:** `{ "error": "Failed to retrieve linked tokens." }`

---

### POST `/:actorId/propagate`

Propaga alterações do actor para todos os tokens vinculados (`isLinked: true`). `avatarUrl` usa o do token quando o actor não tem um. Cada atualização de token também emite `cast.updated`. Não há verificação de GM nem de propriedade.

**Parâmetros:** `actorId` (path)

**Response `200`:**
```json
{ "success": true, "propagatedCount": 3 }
```
**Response `404`:** `{ "error": "Actor not found." }`
**Response `500`:** `{ "error": "Failed to propagate actor changes." }`

---

### POST `/`

Cria um novo token.

**Request body:**

| Campo | Tipo | Obrigatório | Default |
|-------|------|-------------|---------|
| `name` | `string` | **sim** | — |
| `kind` | `string` | não | `'adventurer'` |
| `traits` | `object` | não | `{}` |
| `colorHex` | `string` | não | aleatório |
| `x` | `number` | não | `100` |
| `y` | `number` | não | `100` |
| `avatarUrl` | `string` | não | `''` |
| `ringColor` | `string` | não | `colorHex` |
| `shape` | `string` | não | `'circle'` |
| `effects` | `array` | não | `[]` |
| `statusMarkers` | `array` | não | `[]` |
| `systemData` | `object` | não | `{}` |
| `actorId` | `string` | não | `''` |
| `isLinked` | `boolean` | não | `false` |
| `folderId` | `string` | não | `''` |
| `stageId` | `string` | não | stage ativo ou `'stage-1'` |
| `levelId` | `string` | não | `''` |

Se `actorId` for informado:
- `isLinked: true` → `name`, `kind`, `avatarUrl` e `systemData` são copiados do actor
  (sincronização completa).
- `isLinked: false` → `systemData` é copiado como um snapshot independente, e se `traits`
  não foi informado, `traits.hp` é semeado a partir de `systemData.hp.value` do actor (ou `10`).
  O snapshot não é sincronizado depois. Clicar no token ainda abre a ficha do actor, não este snapshot.

Os donos do actor vinculado com nível de edição (3) também ganham edição no token, e o criador sempre ganha. Qualquer sessão logada pode criar um token; não há verificação de GM.

**Response `201`:** Objeto do cast criado
**Response `400`:** `{ "error": "Field \"name\" is required and must be a non-empty string." }`
**Response `500`:** `{ "error": "Failed to create cast member" }`

**Evento WS:** `cast.created`

---

### PUT `/:id`

Atualiza campos do token. Atualização parcial (só envia o que quer mudar). Campos aceitos: `name`, `kind`, `traits`, `colorHex`, `x`, `y`, `avatarUrl`, `ringColor`, `shape`, `effects`, `statusMarkers`, `systemData`, `folderId`, `stageId`, `elevation`, `levelId`, `locked`, `hidden`, `movementAction`, `targetedBy`, `tintColor`, `opacity`, `rotation`, `scale`, `sightEnabled`, `sightRange`, `sightAngle`, `sightMode`, `detectionModes`, `lightDimRange`, `lightBrightRange`, `lightColor`, `lightAnimation`, `barGridSize`, `bar1`, `bar2`, `displayBars`. Os campos de anel `ringUrl`, `ringEffect` e `ringScale` são ignorados aqui (use `PUT /:id/token`). `id`, `worldId`, `actorId`, `isLinked`, `ownership` e os timestamps também são ignorados.

A regra de donos do actor de `POST /` também roda aqui, antes da atualização. Quem não tem edição recebe `403`.

`systemData` é mesclado em profundidade ao JSON guardado, como nos actors: objetos simples mesclam chave por chave, arrays e escalares substituem o valor antigo, e uma chave escrita como `"-=chave"` apaga essa chave. Um `systemData` parcial só altera as chaves que você envia.

Clicar em um token não edita este snapshot. O client abre a ficha do actor para qualquer token com `actorId`, vinculado ou não, e essa ficha grava no actor (veja `sdk/sheets.md`).

**Parâmetros:** `id` (path)

**Response `200`:** Objeto atualizado
**Response `400`:** `{ "error": "No valid fields provided for update." }`
**Response `403`:** `{ "error": "Access denied" }`
**Response `404`:** `{ "error": "Not found" }`

**Evento WS:** `cast.updated`

---

### PUT `/:id/token`

Atualiza apenas propriedades visuais/config do token (mesmo formato de `PUT /:id`, mas sem `name`, `kind`, `colorHex`, `x`, `y`, `folderId`, `stageId`).

**Parâmetros:** `id` (path)

**Request body:** `avatarUrl`, `ringColor`, `ringUrl`, `ringEffect`, `ringScale`, `shape`, `effects`, `statusMarkers`, `systemData`, `elevation`, `levelId`, `locked`, `hidden`, `movementAction`, `targetedBy`, `tintColor`, `opacity`, `rotation`, `scale`, `sightEnabled`, `sightRange`, `sightAngle`, `sightMode`, `detectionModes`, `lightDimRange`, `lightBrightRange`, `lightColor`, `lightAnimation`, `barGridSize`, `bar1`, `bar2`, `displayBars`

**Response `200`:** Objeto atualizado
**Response `403`:** `{ "error": "Access denied" }`
**Response `404`:** `{ "error": "Not found" }`

**Evento WS:** `cast.updated`

---

### PUT `/:id/target`

Marca/desmarca alvos no token. Qualquer usuário autenticado no mundo pode usar.

**Parâmetros:** `id` (path)

**Request body:**
```json
{ "targetedBy": ["user-id-1", "user-id-2"] }
```

**Response `200`:** Objeto atualizado
**Response `400`:** `{ "error": "targetedBy must be an array" }`
**Response `404`:** `{ "error": "Not found" }`

**Evento WS:** `token.target` (enviado a todos os clientes conectados, de todos os mundos). A atualização em si também emite `cast.updated`.

---

### POST `/:id/position`

Atualiza só a posição do token (usado em drag em tempo real — mais leve que `PUT /:id`).

**Parâmetros:** `id` (path)

**Request body:**
```json
{ "x": 500, "y": 300 }
```

**Response `200`:** `{ "success": true }`
**Response `404`:** `{ "error": "Cast member not found" }`
**Nota:** o resultado da atualização não é verificado. Uma sessão sem permissão de edição recebe `200` e nada muda.

**Evento WS:** `cast.updated`

---

### POST `/:actorId/apply-token-image`

Só o mestre. Copia a arte de token do ator (a imagem do token protótipo, senão o retrato da ficha) para **todos** os casts desse
ator em todas as cenas, vinculados ou não, e define o formato deles como `none` (arte livre). Só `avatarUrl` e `shape` são alterados; o restante dos dados de cada cast continua.

**Response `200`:** `{ "success": true, "count": 3, "image": "/worlds/my-world/assets/tokens/hero-1a2b3c4d.Token.webp" }`
**Response `400`:** `{ "error": "The actor has no image to apply." }`
**Response `403`:** `{ "error": "Only the GM can apply the token image to the stages." }`
**Response `404`:** `{ "error": "Actor not found." }`
**Response `500`:** `{ "error": "Failed to apply the token image." }`
**Evento WS:** `cast.updated` para cada cast

---

### DELETE `/:id`

Remove um token.

**Parâmetros:** `id` (path)

**Response `200`:**
```json
{ "success": true, "id": "member-abc123" }
```

**Response `403`:** `{ "error": "Access denied" }`
**Response `404`:** `{ "error": "Cast member not found" }`

**Evento WS:** `cast.deleted`
