# Importação de cena (Universal VTT)

Importa um mapa exportado no formato Universal VTT (`.dd2vtt`, `.df2vtt`, `.uvtt`, por exemplo do Dungeon Alchemist)
como uma cena nova ou como um andar novo de uma cena existente: a imagem do mapa, paredes, portas e luzes.

## Endpoints

**Base:** `/api/stage-import`
**Auth:** `requireAuth, requireWorldMatch, requireGM`

---

### POST `/uvtt`

Upload multipart, campo `file` (até 60 MB, extensão `.dd2vtt`, `.df2vtt` ou `.uvtt`). Com `?preview=1` o arquivo só é
validado e resumido; nada é gravado. Envie o mesmo arquivo de novo, sem `preview`, para importar.

**Campos do formulário de importação:**

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `name` | `string` | Nome da cena (padrão: o nome do arquivo) |
| `target` | `"stage" \| "level"` | `stage` cria uma cena nova; `level` adiciona um andar acima de uma cena existente |
| `stageId` | `string` | Cena que recebe o andar (obrigatório quando `target` é `level`) |
| `levelName` | `string` | Nome do andar (padrão: `Térreo` em cena nova, o nome da cena num andar) |
| `importLights` | `"0" \| "1"` | `0` ignora as luzes do arquivo |
| `folderId` | `string` | Pasta da cena nova |

**O que é importado:**

| No arquivo | No Loom |
|------------|---------|
| `image` (PNG, JPEG ou WEBP, base64) | Salva em `worlds/<id>/assets/maps`, usada como fundo do andar |
| `resolution.pixels_per_grid`, `map_size` | `gridSize`, `width`, `height` de uma cena nova (padding e offset 0) |
| `line_of_sight` | Paredes (bloqueiam visão, luz e movimento) |
| `objects_line_of_sight` | Paredes que bloqueiam visão e luz, mas não o movimento |
| `portals` | Paredes de porta entre `bounds[0]` e `bounds[1]`; `closed` gera porta fechada |
| `lights` | Luzes ambientes (`range` × `pixels_per_grid` é o raio fraco, metade dele é o forte); importadas ocultas quando `environment.baked_lighting` é `true` |

As coordenadas do arquivo estão em quadrados da grade e são convertidas para pixels. Trechos alinhados são unidos e segmentos duplicados descartados.
Uma cena nova recebe iluminação global ligada quando o arquivo não tem luzes (a iluminação está na imagem); com luzes, ela fica desligada.

**Limites:** até 200 segmentos de parede e porta importam sem aviso; de 201 a 1000 importam com aviso (a visão fica mais lenta,
o custo cresce com o quadrado do número de segmentos); acima de 1000 o arquivo é recusado. O limite é por arquivo, e um arquivo é um andar.

**Response `200` (prévia):**
```json
{ "gridSize": 70, "width": 2100, "height": 1400, "walls": 120, "doors": 6, "lights": 0, "warnLimit": 200, "maxLimit": 1000, "warnings": [] }
```

**Response `201` (importação):** o mesmo resumo mais `{ "stageId": "...", "levelId": "...", "created": "stage" | "level" }`

**Erros:** `400` com `{ "error", "code" }` em que `code` é `no_file`, `invalid` (não é um arquivo Universal VTT), `image`
(imagem ausente ou não suportada) ou `too_many_segments` (com `detail: { segments, limit }`); `404` quando o `stageId` não existe no mundo;
`413` quando o arquivo passa de 60 MB.

**WS Events:** `stage.created` (cena nova) e `levels.changed` `{ stageId }`. As paredes e luzes são lidas quando a cena é aberta.
