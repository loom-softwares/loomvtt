# Lights (Luzes)

Luzes ambiente de uma stage.

## Schema

| Campo | Tipo | Default | Descrição |
|-------|------|---------|-----------|
| `x` | `number` | `0` | Posição X |
| `y` | `number` | `0` | Posição Y |
| `radius` | `number` | `200` | Raio |
| `color` | `string` | `'#ffdd88'` | Cor |
| `intensity` | `number` | `0.05` | Intensidade |
| `rotation` | `number` | `0` | Rotação |
| `levelId` | `string` | `''` | ID do Andar (nível) |
| `allLevels` | `boolean` | `false` | Compartilhada por todos os andares da cena (desligado: a luz brilha só no próprio andar) |
| `animation` | `string` | `'none'` | Animação |
| `darknessMin` | `number` | `0` | Escuridão mínima |
| `darknessMax` | `number` | `1` | Escuridão máxima |
| `isHidden` | `boolean` | `false` | Oculta? |
| `bright` | `number` | `100` | Raio bright |
| `dim` | `number` | `200` | Raio dim |
| `angle` | `number` | `360` | Ângulo |
| `walls` | `boolean` | `true` | Afetada por paredes? |
| `vision` | `boolean` | `false` | Visão? |
| `animationSpeed` | `number` | `5` | Velocidade da animação |
| `animationIntensity` | `number` | `5` | Intensidade da animação |

## Endpoints

**Base:** `/api/stages/:stageId/lights`
**Auth:** `requireAuth, requireWorldMatch`

---

### GET `/:stageId/lights`

Lista luzes de uma stage.

**Response `200`:** `AmbientLightsDocument[]`

---

### POST `/:stageId/lights`

Cria luz. O `stageId` vem da URL. Todos os campos do body são opcionais; os defaults são os do
schema acima, exceto `intensity` (`0.05`) e `dim`, que usa `radius` como default (`200` se nenhum
dos dois for informado). `allLevels` só é salvo como `true` quando enviado como `true`.

**Request body:** `x`, `y`, `radius`, `color`, `intensity`, `rotation`, `bright`, `dim`, `angle`,
`walls`, `vision`, `animationSpeed`, `animationIntensity`, `animation`, `isHidden`, `darknessMin`,
`darknessMax`, `levelId`, `allLevels`.

**Response `201`:** Light criada
**Response `400`:** `{ "error": "..." }` (erro do Document)
**Response `500`:** `{ "error": "Failed to create light" }`
**Evento WS:** `light.created` (payload: a linha criada, repassada a todos os clientes)

---

### PUT `/:stageId/lights/:id`

Atualiza luz. Só os campos abaixo são copiados; os demais (incluindo `rotation`) são ignorados.
`walls`, `vision`, `isHidden` e `allLevels` são convertidos para boolean.

**Request body:** `x`, `y`, `radius`, `color`, `intensity`, `bright`, `dim`, `angle`, `walls`,
`vision`, `animationSpeed`, `animationIntensity`, `animation`, `isHidden`, `darknessMin`,
`darknessMax`, `levelId`, `allLevels`.

> **CODE ISSUE:** `rotation` é aceito pelo POST e salvo, mas o handler de PUT não o copia, então a
> rotação de uma luz não pode ser alterada por esta rota.

**Response `200`:** Light atualizada
**Response `404`:** `{ "error": "..." }` (erro do Document)
**Evento WS:** `light.updated` (payload: a linha atualizada, repassada a todos os clientes)

---

### DELETE `/:stageId/lights/:id`

Remove luz.

**Response `200`:** `{ "success": true, "id": "..." }`
**Response `404`:** `{ "error": "..." }` (erro do Document)
**Evento WS:** `light.deleted` (payload: `{ "id", "stageId" }`, repassado a todos os clientes)
