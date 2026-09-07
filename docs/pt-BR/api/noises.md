# Noises (Sons Ambiente)

## Endpoints

**Base:** `/api/noises`
**Auth:** `requireAuth, requireWorldMatch`

---

### GET `/stage/:stageId`

Lista sons ambiente de uma stage.

---

### POST `/`

Cria som ambiente.

| Campo | Tipo | Obrigatório | Default |
|-------|------|-------------|---------|
| `stageId` | `string` | **sim** | — |
| `src` | `string` | não | — |
| `levelId` | `string` | não | — |
| `x` | `number` | não | `0` |
| `y` | `number` | não | `0` |
| `radius` | `number` | não | `100` |
| `volume` | `number` | não | `1.0` |
| `easing` | `boolean` | não | `true` |
| `hidden` | `boolean` | não | `false` |
| `darknessMin` | `number` | não | `0` |
| `darknessMax` | `number` | não | `1` |
| `wallsBlock` | `boolean` | não | `false` |

Campos de áudio espacial:
- `hidden` — som só toca para o GM
- `darknessMin`/`darknessMax` — faixa de escuridão (0.0–1.0) em que o som é audível
- `wallsBlock` — paredes bloqueiam o som (usa `raySegmentIntersection`)

**Evento WS:** `noise.created`

---

### PUT `/:id`

Atualiza som. Aceita todos os campos da criação (inclusive `hidden`, `darknessMin`, `darknessMax`, `wallsBlock`).

**Evento WS:** `noise.updated`

---

### DELETE `/:id`

Remove som.

**Evento WS:** `noise.deleted`

---

## Áudio Espacial (Client-Side)

O `SoundManager` (`client/canvas/sound-manager.ts`) usa `AudioContext` + `PannerNode` com HRTF e distância inversa:

- **Atenuação:** volume diminui com a distância ao centro do som (threshold de 150ms)
- **Panning estéreo:** posição relativa ao ouvinte
- **Paredes:** se `wallsBlock=true`, faz raycast do ouvinte até o som — interseção com parede silencia o som
- **Escuridão:** `darknessMin`/`darknessMax` controlam em que faixa de iluminação o som é audível
- **Hidden:** sons ocultos só são audíveis pelo GM

O ouvinte é sincronizado com o token controlado via `CanvasManager.updateControlledTokens()`.
