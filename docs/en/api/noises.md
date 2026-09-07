# Noises (Ambient Sounds)

## Endpoints

**Base:** `/api/noises`
**Auth:** `requireAuth, requireWorldMatch`

---

### GET `/stage/:stageId`

Lists ambient sounds of a stage.

---

### POST `/`

Creates ambient sound.

| Field | Type | Required | Default |
|-------|------|-------------|---------|
| `stageId` | `string` | **yes** | - |
| `src` | `string` | no | - |
| `levelId` | `string` | no | - |
| `x` | `number` | no | `0` |
| `y` | `number` | no | `0` |
| `radius` | `number` | no | `100` |
| `volume` | `number` | no | `1.0` |
| `easing` | `boolean` | no | `true` |
| `hidden` | `boolean` | no | `false` |
| `darknessMin` | `number` | no | `0` |
| `darknessMax` | `number` | no | `1` |
| `wallsBlock` | `boolean` | no | `false` |

Spatial audio fields:
- `hidden` - sound only plays for GM
- `darknessMin`/`darknessMax` - darkness range (0.0-1.0) in which the sound is audible
- `wallsBlock` - walls block the sound (uses `raySegmentIntersection`)

**WS Event:** `noise.created`

---

### PUT `/:id`

Updates sound. Accepts all creation fields (including `hidden`, `darknessMin`, `darknessMax`, `wallsBlock`).

**WS Event:** `noise.updated`

---

### DELETE `/:id`

Removes sound.

**WS Event:** `noise.deleted`

---

## Spatial Audio (Client-Side)

The `SoundManager` (`client/canvas/sound-manager.ts`) uses `AudioContext` + `PannerNode` with HRTF and inverse distance:

- **Attenuation:** volume decreases with distance to the sound center (150ms threshold)
- **Stereo panning:** relative position to the listener
- **Walls:** if `wallsBlock=true`, raycasts from listener to sound - wall intersection silences the sound
- **Darkness:** `darknessMin`/`darknessMax` control in which illumination range the sound is audible
- **Hidden:** hidden sounds are only audible to the GM

The listener is synchronized with the controlled token via `CanvasManager.updateControlledTokens()`.
