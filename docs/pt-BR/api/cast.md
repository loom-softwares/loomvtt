# Cast (Tokens)

Membros do elenco — personagens, NPCs, monstros no cenário.

## Schema

| Campo | Tipo | Default | Descrição |
|-------|------|---------|-----------|
| `id` | `string` | UUID | Identificador único |
| `worldId` | `string` | — | Mundo (do contexto de auth ou do body; sem fallback) |
| `stageId` | `string` | id da stage ativa, ou `'stage-1'` | Stage (cenário) atual |
| `levelId` | `string` | `''` | Level dentro da stage |
| `name` | `string` | — | Nome (**obrigatório**) |
| `kind` | `string` | `'adventurer'` | Tipo (`adventurer`, `monster`, `npc`, etc.) |
| `traits` | `object` | `{}` | Atributos do sistema (ex: `{ hp: { value: 10 } }`) |
| `x` | `number` | `100` | Posição X no grid |
| `y` | `number` | `100` | Posição Y no grid |
| `colorHex` | `string` | `'#e74c3c'` | Cor do token |
| `avatarUrl` | `string` | `''` | URL do avatar |
| `ringColor` | `string` | `'#e74c3c'` | Cor do anel |
| `shape` | `string` | `'circle'` | Forma (`circle`, `square`, etc.) |
| `effects` | `array` | `[]` | Efeitos visuais ativos |
| `statusMarkers` | `array` | `[]` | Marcadores de status |
| `systemData` | `object` | `{}` | Dados do sistema (ruleset) |
| `actorId` | `string` | `''` | ID do actor vinculado |
| `isLinked` | `boolean` | `false` | Vinculado ao actor? |
| `ownership` | `object` | `{}` | Permissões de dono |
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
| `createdAt` | `string` | — | Timestamp de criação |
| `updatedAt` | `string` | — | Timestamp de atualização |

---

## Endpoints

**Base:** `/api/cast`
**Auth:** `requireAuth, requireWorldMatch` (JWT via cookie)

---

### GET `/`

Lista todos os membros do elenco, ordenados por `createdAt` ascendente.

**Query:** `?limit=`, `?offset=`

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

---

### POST `/:actorId/propagate`

Propaga alterações do actor para todos os tokens vinculados (`isLinked: true`).

**Parâmetros:** `actorId` (path)

**Response `200`:**
```json
{ "success": true, "propagatedCount": 3 }
```

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

**Response `201`:** Objeto do cast criado
**Response `400`:** `{ "error": "Field \"name\" is required and must be a non-empty string." }`

**Evento WS:** `cast.created`

---

### PUT `/:id`

Atualiza campos do token. Atualização parcial (só envia o que quer mudar).

**Parâmetros:** `id` (path)

**Request body:** qualquer campo do schema acima, exceto `id`/`worldId`/`actorId`/`isLinked`/`ownership`/`createdAt`/`updatedAt`.

**Response `200`:** Objeto atualizado
**Response `400`:** `{ "error": "No valid fields provided for update." }`

**Evento WS:** `cast.updated`

---

### PUT `/:id/token`

Atualiza apenas propriedades visuais/config do token (mesmo que PUT /:id, mas sem `name`, `kind`, `colorHex`, `x`, `y`).

**Parâmetros:** `id` (path)

**Request body:** `avatarUrl`, `ringColor`, `shape`, `effects`, `statusMarkers`, `systemData`, `elevation`, `levelId`, `locked`, `hidden`, `movementAction`, `targetedBy`, `tintColor`, `opacity`, `rotation`, `scale`, `sightEnabled`, `sightRange`, `sightAngle`, `sightMode`, `detectionModes`, `lightDimRange`, `lightBrightRange`, `lightColor`, `lightAnimation`, `barGridSize`

**Response `200`:** Objeto atualizado

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

**Evento WS:** `token.target` (não `cast.updated`)

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

**Evento WS:** `cast.updated`

---

### DELETE `/:id`

Remove um token.

**Parâmetros:** `id` (path)

**Response `200`:**
```json
{ "success": true, "id": "member-abc123" }
```

**Response `404`:** `{ "error": "Cast member not found" }`

**Evento WS:** `cast.deleted`
