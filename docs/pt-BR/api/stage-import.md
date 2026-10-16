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
| `name` | `string` | Nome da cena, ou o nome da importação quando `target` é `level` (padrão: o nome do arquivo sem a extensão) |
| `target` | `"stage" \| "level"` | `stage` cria uma cena nova; `level` adiciona um andar acima de uma cena existente |
| `stageId` | `string` | Cena que recebe o andar (obrigatório quando `target` é `level`) |
| `levelName` | `string` | Nome do andar (padrão: `Térreo` em cena nova; o nome da importação, ou seja `name` ou o nome do arquivo, num andar) |
| `importLights` | `"0" \| "1"` | `0` ignora as luzes do arquivo |
| `folderId` | `string` | Pasta da cena nova |
| `openPortalsAs` | `"door" \| "window"` | Como tratar portais abertos (`closed: false`). Padrão `door`; qualquer outro valor também vira `door`. Veja abaixo |

A prévia (`?preview=1`) aceita o mesmo `openPortalsAs`, no corpo do formulário ou na query string, para que a contagem reflita a escolha.

**O que é importado:**

| No arquivo | No Loom |
|------------|---------|
| `image` (PNG, JPEG ou WEBP, base64) | Salva em `worlds/<id>/assets/maps`, usada como fundo do andar |
| `resolution.pixels_per_grid`, `map_size` | `gridSize`, `width`, `height` de uma cena nova (padding e offset 0) |
| `line_of_sight` | Paredes (bloqueiam visão, luz e movimento) |
| `objects_line_of_sight` | Paredes que bloqueiam visão e luz, mas não o movimento |
| `portals` | Paredes de porta entre `bounds[0]` e `bounds[1]`; `closed` gera porta fechada (ou janela, veja abaixo) |
| `lights` | Luzes ambientes (`range` × `pixels_per_grid` é o raio fraco, metade dele é o forte); importadas ocultas quando `environment.baked_lighting` é `true` |

**Portais abertos (`openPortalsAs`):** o formato Universal VTT usa `closed: false` tanto para portas abertas quanto para as janelas
que o Dungeon Alchemist exporta (sem nenhum campo que as diferencie), por isso a regra é uma opção e vem **desligada por padrão**: o comportamento
padrão não muda, todo portal vira porta (`door: 1`, aberta quando `closed` é `false`).

| `openPortalsAs` | Portal com `closed: false` | Portal com `closed` diferente de `false` |
|-----------------|----------------------------|------------------------------------------|
| `"door"` (padrão) | Porta aberta (`door: 1`, `doorState: 1`) | Porta fechada (`door: 1`, `doorState: 0`) |
| `"window"` | Janela fechada (`door: 3`, `doorState: 0`; `sight: false`, `light: true`, `movement: true`, `sound: true`) | Porta fechada, como no padrão |

A janela começa fechada porque `closed: false` nesses arquivos significa "transparente, mas não atravessável".

As coordenadas do arquivo estão em quadrados da grade e são convertidas para pixels. Trechos alinhados são unidos e segmentos duplicados descartados.
Uma cena nova recebe iluminação global ligada quando o arquivo não tem luzes (a iluminação está na imagem), e também quando `importLights` é `0`; ela só fica desligada quando as luzes são importadas.

**Limites:** até 200 segmentos de parede e porta importam sem aviso; de 201 a 1000 importam com aviso (a visão fica mais lenta,
o custo cresce com o quadrado do número de segmentos); acima de 1000 o arquivo é recusado. O limite é por arquivo, e um arquivo é um andar.

**Response `200` (prévia):**
```json
{ "gridSize": 70, "width": 2100, "height": 1400, "walls": 120, "doors": 6, "windows": 0, "lights": 0, "warnLimit": 200, "maxLimit": 1000, "warnings": [] }
```

O resumo traz `walls` (paredes comuns), `doors` (portas, inclusive secretas, `door` 1 e 2) e `windows` (janelas, `door` 3). Os três somam o total de segmentos importados. `doors` conta só portas.

**Response `201` (importação):** o mesmo resumo mais `{ "stageId": "...", "levelId": "...", "created": "stage" | "level", "warnings": [] }`

**Erros:** `400` com `{ "error", "code" }` em que `code` é `no_file` (também quando a extensão não é `.dd2vtt`, `.df2vtt` ou `.uvtt`), `invalid` (não é um arquivo Universal VTT, ou não há `pixels_per_grid` / `map_size` válidos), `image`
(imagem ausente ou não suportada) ou `too_many_segments` (com `detail: { segments, limit }`); `404` quando o `stageId` não existe no mundo;
`413` com `code: "too_large"` quando o arquivo passa de 60 MB; `500` com `{ "error": "Failed to import the map" }` para outras falhas (a imagem já gravada é removida, e uma cena criada pela requisição é apagada).

**WS Events:** `stage.created` (cena nova, repassado do Signal `stages.created`), `level.created` (repassado de `levels.created`) e `levels.changed` `{ stageId }`. As paredes e luzes não são enviadas por WS (seus Signals não são repassados); são lidas quando a cena é aberta.
