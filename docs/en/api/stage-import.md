# Stage import (Universal VTT)

Imports a map exported in the Universal VTT format (`.dd2vtt`, `.df2vtt`, `.uvtt`, for example from Dungeon Alchemist)
as a new stage or as a new level of an existing stage: the map image, walls, doors and lights.

## Endpoints

**Base:** `/api/stage-import`
**Auth:** `requireAuth, requireWorldMatch, requireGM`

---

### POST `/uvtt`

Multipart upload, field `file` (up to 60 MB, extension `.dd2vtt`, `.df2vtt` or `.uvtt`). With `?preview=1` the file is only
validated and summarised; nothing is written. Send the same file again without `preview` to import it.

**Import form fields:**

| Field | Type | Description |
|-------|------|-------------|
| `name` | `string` | Stage name (default: the file name) |
| `target` | `"stage" \| "level"` | `stage` creates a new stage; `level` adds a level above an existing stage |
| `stageId` | `string` | Stage that receives the level (required when `target` is `level`) |
| `levelName` | `string` | Level name (default: `Térreo` for a new stage, the stage name for a level) |
| `importLights` | `"0" \| "1"` | `0` skips the lights of the file |
| `folderId` | `string` | Folder of the new stage |

**What is imported:**

| In the file | In Loom |
|-------------|---------|
| `image` (PNG, JPEG or WEBP, base64) | Saved in `worlds/<id>/assets/maps`, used as the level background |
| `resolution.pixels_per_grid`, `map_size` | `gridSize`, `width`, `height` of a new stage (padding and offset 0) |
| `line_of_sight` | Walls (block sight, light and movement) |
| `objects_line_of_sight` | Walls that block sight and light but not movement |
| `portals` | Door walls between `bounds[0]` and `bounds[1]`; `closed` gives a closed door |
| `lights` | Ambient lights (`range` × `pixels_per_grid` is the dim radius, half of it is bright); imported hidden when `environment.baked_lighting` is `true` |

Coordinates in the file are in grid squares and are converted to pixels. Collinear pieces are merged and duplicate segments dropped.
A new stage gets global illumination on when the file has no lights (the lighting is in the image); with lights it stays off.

**Limits:** up to 200 wall and door segments import silently; from 201 to 1000 they import with a warning (vision gets slower,
its cost grows with the square of the segment count); above 1000 the file is refused. The limit is per file, and one file is one level.

**Response `200` (preview):**
```json
{ "gridSize": 70, "width": 2100, "height": 1400, "walls": 120, "doors": 6, "lights": 0, "warnLimit": 200, "maxLimit": 1000, "warnings": [] }
```

**Response `201` (import):** the same summary plus `{ "stageId": "...", "levelId": "...", "created": "stage" | "level" }`

**Errors:** `400` with `{ "error", "code" }` where `code` is `no_file`, `invalid` (not a Universal VTT file), `image`
(missing or unsupported image) or `too_many_segments` (with `detail: { segments, limit }`); `404` when `stageId` does not exist in the world;
`413` when the file is over 60 MB.

**WS Events:** `stage.created` (new stage) and `levels.changed` `{ stageId }`. The walls and lights are read when the stage is opened.
