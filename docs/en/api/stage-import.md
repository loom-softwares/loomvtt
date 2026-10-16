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
| `name` | `string` | Stage name, or the import name when `target` is `level` (default: the file name without its extension) |
| `target` | `"stage" \| "level"` | `stage` creates a new stage; `level` adds a level above an existing stage |
| `stageId` | `string` | Stage that receives the level (required when `target` is `level`) |
| `levelName` | `string` | Level name (default: `Térreo` for a new stage; the import name, i.e. `name` or the file name, for a level) |
| `importLights` | `"0" \| "1"` | `0` skips the lights of the file |
| `folderId` | `string` | Folder of the new stage |
| `openPortalsAs` | `"door" \| "window"` | How open portals (`closed: false`) are imported. Default `door`; any other value is treated as `door`. See below |

The preview (`?preview=1`) accepts the same `openPortalsAs`, in the form body or the query string, so the counts match the choice.

**What is imported:**

| In the file | In Loom |
|-------------|---------|
| `image` (PNG, JPEG or WEBP, base64) | Saved in `worlds/<id>/assets/maps`, used as the level background |
| `resolution.pixels_per_grid`, `map_size` | `gridSize`, `width`, `height` of a new stage (padding and offset 0) |
| `line_of_sight` | Walls (block sight, light and movement) |
| `objects_line_of_sight` | Walls that block sight and light but not movement |
| `portals` | Door walls between `bounds[0]` and `bounds[1]`; `closed` gives a closed door (or a window, see below) |
| `lights` | Ambient lights (`range` × `pixels_per_grid` is the dim radius, half of it is bright); imported hidden when `environment.baked_lighting` is `true` |

**Open portals (`openPortalsAs`):** the Universal VTT format uses `closed: false` both for open doors and for the windows that
Dungeon Alchemist exports (there is no field that tells them apart), so the mapping is an option that is **off by default**:
the default behaviour is unchanged and every portal becomes a door (`door: 1`, open when `closed` is `false`).

| `openPortalsAs` | Portal with `closed: false` | Portal with any other `closed` value |
|-----------------|-----------------------------|--------------------------------------|
| `"door"` (default) | Open door (`door: 1`, `doorState: 1`) | Closed door (`door: 1`, `doorState: 0`) |
| `"window"` | Closed window (`door: 3`, `doorState: 0`; `sight: false`, `light: true`, `movement: true`, `sound: true`) | Closed door, as in the default |

The window starts closed because in these files `closed: false` means "see-through, but not passable".

Coordinates in the file are in grid squares and are converted to pixels. Collinear pieces are merged and duplicate segments dropped.
A new stage gets global illumination on when the file has no lights (the lighting is in the image), and also when `importLights` is `0`; it stays off only when lights are imported.

**Limits:** up to 200 wall and door segments import silently; from 201 to 1000 they import with a warning (vision gets slower,
its cost grows with the square of the segment count); above 1000 the file is refused. The limit is per file, and one file is one level.

**Response `200` (preview):**
```json
{ "gridSize": 70, "width": 2100, "height": 1400, "walls": 120, "doors": 6, "windows": 0, "lights": 0, "warnLimit": 200, "maxLimit": 1000, "warnings": [] }
```

The summary gives `walls` (plain walls), `doors` (doors, secret doors included, `door` 1 and 2) and `windows` (`door` 3). The three add up to the number of imported segments; `doors` counts doors only.

**Response `201` (import):** the same summary plus `{ "stageId": "...", "levelId": "...", "created": "stage" | "level", "warnings": [] }`

**Errors:** `400` with `{ "error", "code" }` where `code` is `no_file` (also when the extension is not `.dd2vtt`, `.df2vtt` or `.uvtt`), `invalid` (not a Universal VTT file, or no valid `pixels_per_grid` / `map_size`), `image`
(missing or unsupported image) or `too_many_segments` (with `detail: { segments, limit }`); `404` when `stageId` does not exist in the world;
`413` with `code: "too_large"` when the file is over 60 MB; `500` with `{ "error": "Failed to import the map" }` for other failures (the image written so far is removed, and a stage created by the request is deleted).

**WS Events:** `stage.created` (new stage, relayed from the `stages.created` Signal), `level.created` (relayed from `levels.created`) and `levels.changed` `{ stageId }`. The walls and lights are not pushed over WS (their Signals are not relayed); they are read when the stage is opened.
