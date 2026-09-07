# Lights (Luzes)

Luzes ambiente de uma stage.

## Schema

| Campo | Tipo | Default | Descrição |
|-------|------|---------|-----------|
| `x` | `number` | `0` | Posição X |
| `y` | `number` | `0` | Posição Y |
| `radius` | `number` | `200` | Raio |
| `color` | `string` | `'#ffdd88'` | Cor |
| `intensity` | `number` | `0.5` | Intensidade |
| `levelId` | `string` | `''` | ID do Andar (nível) |
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

Cria luz.

**Response `201`:** Light criada
**Evento WS:** `light.created`

---

### PUT `/:stageId/lights/:id`

Atualiza luz.

**Evento WS:** `light.updated`

---

### DELETE `/:stageId/lights/:id`

Remove luz.

**Response `200`:** `{ "success": true, "id": "..." }`
**Evento WS:** `light.deleted`
