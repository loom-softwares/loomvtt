# Noises (Sons Ambiente)

## Endpoints

**Base:** `/api/noises`
**Auth:** `requireAuth, requireWorldMatch`

---

### GET `/stage/:stageId`

Lista sons ambiente de uma stage, ordenados por `createdAt`.

**Response `200`:** `NoisesDocument[]`
**Response `500`:** `{ "error": "..." }`

---

### POST `/`

Cria som ambiente. O id é gerado pelo servidor como `noise-<uuid>`.

| Campo | Tipo | Obrigatório | Default |
|-------|------|-------------|---------|
| `stageId` | `string` | **sim** | — |
| `src` | `string` | não | — |
| `levelId` | `string` | não | `''` |
| `x` | `number` | não | `0` |
| `y` | `number` | não | `0` |
| `radius` | `number` | não | `300` (o default do schema é `100`, mas a rota aplica `300`) |
| `volume` | `number` | não | `1.0` |
| `easing` | `boolean` | não | `true` |
| `hidden` | `boolean` | não | `false` |
| `darknessMin` | `number` | não | `0` |
| `darknessMax` | `number` | não | `1` |
| `wallsBlock` | `boolean` | não | `false` |

Campos de áudio espacial:
- `hidden` — o gerenciador de som do cliente ignora sons ocultos (`client/canvas/sound-manager.ts:161`, `:229`). Se o GM ainda os ouve é UNVERIFIED
- `darknessMin`/`darknessMax` — faixa de escuridão (0.0–1.0) em que o som é audível
- `wallsBlock` — paredes bloqueiam o som (usa `raySegmentIntersection`)

**Response `201`:** Som criado
**Response `400`:** `{ "error": "stageId is required" }` ou o erro do Document
**Evento WS:** `noise.created` (payload: a linha criada, repassada a todos os clientes)

---

### PUT `/:id`

Atualiza som. Aceita os campos `src`, `x`, `y`, `radius`, `volume`, `easing`, `hidden`,
`darknessMin`, `darknessMax`, `wallsBlock` e `levelId`; os demais campos são ignorados.

**Response `200`:** Som atualizado
**Response `404`:** `{ "error": "..." }` (erro do Document)
**Evento WS:** `noise.updated` (payload: a linha atualizada, repassada a todos os clientes)

---

### DELETE `/:id`

Remove som.

**Response `200`:** `{ "success": true }`
**Response `404`:** `{ "error": "..." }` (erro do Document)
**Evento WS:** `noise.deleted` (payload: `{ "id" }`, repassado a todos os clientes)

---

## Áudio Espacial (Client-Side)

O `SoundManager` (`client/canvas/sound-manager.ts`) usa `AudioContext` + `PannerNode` com HRTF e distância inversa:

- **Atenuação:** volume diminui com a distância ao centro do som (threshold de 150ms)
- **Panning estéreo:** posição relativa ao ouvinte
- **Paredes:** se `wallsBlock=true`, faz raycast do ouvinte até o som — interseção com parede silencia o som
- **Escuridão:** `darknessMin`/`darknessMax` controlam em que faixa de iluminação o som é audível
- **Hidden:** sons ocultos só são audíveis pelo GM

O ouvinte é sincronizado com o token controlado via `CanvasManager.updateControlledTokens()`.
