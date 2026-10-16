# Buffs (Efeitos)

## Endpoints

**Base:** `/api/buffs`
**Auth:** `requireAuth, requireWorldMatch` (POST, PUT e DELETE também exigem a permissão abaixo)

Buffs são os registros por trás dos efeitos. Um buff com `itemId` ou `tileId` e sem alvo é um **template** de efeito. A cópia aplicada num actor ou cast é criada pelas rotas de [Effects](effects.md), que também descrevem como as durações contam.

## Permissões

| Rota | Quem pode chamar |
|------|------------------|
| `GET /actor/:actorId`, `GET /item/:itemId`, `GET /:id` | Qualquer sessão logada do mundo |
| `POST /`, `PUT /:id`, `DELETE /:id` | Assistant GM (role 3) e acima, ou a sessão admin |

Como um efeito altera os atributos do actor pelos seus `changes`, só o lado do GM pode criar, editar ou remover um. Ser dono do actor não basta. Quem não tem o papel recebe `403` `{ "error": "Assistant GM permission required" }`.

---

### GET `/:id`

Um buff pelo id. A leitura é aberta como nas listas: uma sessão logada pode ler um buff do próprio mundo. Um buff de outro mundo, ou um id desconhecido, responde `404`.

**Resposta `200`:** o buff (`BuffsDocument`)
**Resposta `404`:** `{ "error": "Buff not found" }`
**Resposta `500`:** `{ "error": "..." }` em uma falha inesperada

---

### GET `/actor/:actorId`

Lista buffs de um actor, ordenados por `createdAt` ascendente.

**Nota:** a leitura é aberta de propósito. Qualquer sessão logada pode listar os buffs de um actor pelo id, qualquer que seja o dono do actor.

---

### GET `/item/:itemId`

Lista buffs de um item, ordenados por `createdAt` ascendente. Igual ao anterior: aberta a qualquer sessão logada.

---

### POST `/`

Cria buff.

| Campo | Tipo | Obrigatório |
|-------|------|-------------|
| `name` | `string` | **sim** |
| `actorId` | `string` | sim, a menos que `itemId` ou `tileId` seja enviado |
| `itemId` | `string` | sim, a menos que `actorId` ou `tileId` seja enviado |
| `tileId` | `string` | sim, a menos que `actorId` ou `itemId` seja enviado (máximo 64 caracteres) |
| `worldId` | `string` | sim, a menos que `itemId` seja enviado |
| `icon` | `string` | não (default `''`) |
| `origin` | `string` | não (default `''`) |
| `description` | `string` | não (default `''`, máximo 2000 caracteres) |
| `durationUnit` | `string` | não (default `permanent`) |
| `duration` | `number` | não (default `-1`) |
| `expireOn` | `string` | não (default `turn-end`) |
| `tags` | `array` | não (default `[]`) |
| `conditionId` | `string` | não (default `''`, máximo 64 caracteres) |
| `removeOnCombatEnd` | `boolean` | não (default `false`) |
| `transfer` | `boolean` | não (default `false`) |
| `repeatWhileInside` | `boolean` | não (default `false`) |
| `disabled` | `boolean` | não (default `false`) |
| `changes` | `array` | não (default `[]`) |

**Campos de duração:** `durationUnit` é um de `permanent`, `rounds`, `turns`, `seconds`, `minutes`, `hours`, `days`, `weeks`, `months` ou `years`. Quando `durationUnit` é omitido, o buff é `permanent`, e qualquer `duration` enviado é ignorado e guardado como `-1`. Para as demais unidades, `duration` precisa ser um número inteiro de pelo menos 1. Uma unidade sem `duration` é, portanto, recusada, porque o padrão `-1` não é válido para uma unidade contada. Ver [Effects](effects.md#unidades-de-duração).

**Outros campos:** `expireOn` é `turn-start` ou `turn-end`. `visual` é a aparência que o token desenha para o efeito: um objeto com `kind` opcional (`aura`, `tint`, `glow`, `icon` ou `particles`), `color` (`#rrggbb`), `intensity` (0 a 1), `speed` (0 a 3), `size` (0,5 a 3) e `style`, a forma de um visual `particles` (`smoke`, `embers`, `bubbles`, `sparkles`, `hearts`, `drops` ou `zzz`; padrão `smoke`). Os outros tipos aceitam `style` mas não o desenham. O objeto inteiro tem no máximo 200 caracteres de JSON. `{}` (o padrão) significa o preset da condição. Um visual inválido responde `400` `{ "error": "..." }`. `tags` é um array de no máximo 20 strings, cada uma com no máximo 40 caracteres. `conditionId` é usado na regra de sem empilhamento descrita em [Effects](effects.md#sem-empilhamento). `removeOnCombatEnd` remove o efeito quando o combate termina. `transfer` e `repeatWhileInside` são guardados como booleanos; o servidor ainda não lhes dá nenhum comportamento.

**Campos ignorados:** o servidor define sozinho `startedAt`, `expiresAt`, `templateId`, `castId`, `appliedBy`, `sourceType` e `sourceId`, então valores enviados para eles no body são ignorados. `tileId` é lido somente em POST.

**As verificações rodam nesta ordem:** `name`, depois o alvo (`actorId`, `itemId` ou `tileId`), depois `worldId`, depois a permissão (403), depois a validação dos campos (400).

**Response `201`:** o buff criado (`BuffsDocument`)
**Response `400`:** `{ "error": "name is required" }` / `{ "error": "actorId or itemId is required" }` / `{ "error": "worldId or itemId is required" }`, ou uma mensagem de validação da lista abaixo
**Response `403`:** `{ "error": "Assistant GM permission required" }` quando quem chama está abaixo de Assistant GM
**Response `500`:** `{ "error": "..." }` em falha inesperada
**Nota:** o `worldId` é lido do corpo. A rota não compara com o mundo da sessão.
**Eventos internos:** Signal `buff.created`, e o genérico `buffs.created` da camada Document (server-side, **não relayados** para WebSocket)

**Mensagens de validação (400):**

- `description must be a string of at most 2000 characters`
- `unknown duration unit "<unit>"`
- `duration must be a whole number of at least 1 for the unit "<unit>"`
- `expireOn must be turn-start or turn-end`
- `tags must be an array of at most 20 strings of at most 40 characters`
- `conditionId must be a string of at most 64 characters`
- `tileId must be a string of at most 64 characters`

---

### PUT `/:id`

Atualiza buff. Body: qualquer um de `name`, `icon`, `origin`, `description`, `durationUnit`, `duration`, `expireOn`, `tags`, `conditionId`, `removeOnCombatEnd`, `transfer`, `repeatWhileInside`, `disabled`, `changes` ou `visual`. A mesma validação do POST vale para os campos enviados. A verificação de duração usa a unidade e a duração guardadas para qualquer valor que o body não envie. Definir `durationUnit` como `permanent` guarda `duration` como `-1`.

`actorId`, `itemId`, `tileId` e os campos gerenciados pelo servidor não são aceitos aqui. Um body vazio devolve o buff guardado, sem gravar nada.

**Response `200`:** o buff atualizado
**Response `400`:** uma mensagem de validação da lista acima
**Response `403`:** `{ "error": "Assistant GM permission required" }` (mesma regra do POST)
**Response `404`:** `{ "error": "Buff not found" }` quando o id não existe; também retornado quando a própria atualização falha
**Eventos internos:** Signal `buff.updated`, e o genérico `buffs.updated` (server-side, **não relayados** para WebSocket)

---

### DELETE `/:id`

Remove buff.

**Response `200`:** `{ "success": true }`
**Response `403`:** `{ "error": "Assistant GM permission required" }` (mesma regra do POST)
**Response `404`:** `{ "error": "Buff not found" }` quando o id não existe; também retornado quando a própria remoção falha
**Eventos internos:** Signal `buff.deleted`, e o genérico `buffs.deleted` (server-side, **não relayados** para WebSocket)
