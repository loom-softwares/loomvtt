# Roll Tables (Tabelas de Rolagem)

## Endpoints

**Base:** `/api/roll-tables`
**Auth:** `requireAuth, requireWorldMatch`

---

### GET `/`

Lista tabelas. `?worldId=`

---

### POST `/`

Cria tabela. `requireGM`. Retorna `201` com a tabela criada.

| Campo                  | Tipo        | Padrão | Descrição                                            |
| ---------------------- | ----------- | ------ | ------------------------------------------------------ |
| `id`                 | `string`  | automático | Opcional                                           |
| `worldId`            | `string`  | —      | Mundo                                                  |
| `name`               | `string`  | —      | Nome                                                   |
| `description`        | `string`  | `''`   | Descrição (sanitizada como rich text)                  |
| `formula`            | `string`  | `'1d20'` | Fórmula de rolagem                                   |
| `sortMode`           | `number`  | `0`    | Modo de ordenação                                    |
| `imgUrl`             | `string`  | `''`   | URL da imagem                                          |
| `replacement`        | `number`  | `1`    | Com reposição? `0` = sem reposição (`1` = sim)        |
| `displayRollFormula` | `number`  | `0`    | Exibe a fórmula de rolagem junto do resultado no chat (`1` = sim) |

Um array opcional `entries` cria as entradas na mesma requisição. Cada item aceita `text`, `imgUrl`, `weight`, `collectionId`, `type`, `documentCollection`, `documentId`, `description`, `rangeMin` e `rangeMax`. As entradas sempre começam com `drawn` = `'NONE'`. Os intervalos são gravados como enviados (faltando, viram `1`; não são calculados a partir de `weight`; veja `POST /:id/normalize-results`).

**Erros:** `400` com `{ "error": "..." }` quando a camada de Document rejeita a tabela.

**Evento WS:** `roll-table.created` (a camada de Document emite `roll_tables.created`, que o servidor repassa com este nome)

---

### GET `/:id`

Busca tabela com `entries[]`.

---

### PUT `/:id`

Atualiza tabela. `requireGM`. Retorna `{ "success": true }` (não a tabela). Só os campos enviados mudam.
`description` é sanitizada como rich text.

**Evento WS:** `roll-table.updated`

---

### DELETE `/:id`

Remove a tabela e suas entradas (o controller apaga as entradas explicitamente). `requireGM`. Retorna `{ "success": true }`.

**Evento WS:** `roll-table.deleted`

---

### POST `/:id/entries`

Adiciona entrada. `requireGM`. Retorna `201` com a entrada criada.
`rangeMin`/`rangeMax` são atribuídos automaticamente (contíguos ao
`rangeMax` da última entrada, cobrindo o `weight`) — passe explicitamente no `PUT` pra
sobrescrever.

| Campo                  | Tipo                                     | Descrição                                                                                                           |
| ---------------------- | ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `text`               | `string`                               | Nome/rótulo do resultado. Se`type` for `document` e ficar vazio, é preenchido com o nome do documento vinculado |
| `imgUrl`             | `string`                               | Caminho do ícone. Se`type` for `document` e ficar vazio, é preenchido com a imagem do documento vinculado       |
| `weight`             | `number`                               | Usado só pra calcular o intervalo inicial na criação (padrão `1`)                                                  |
| `collectionId`       | `string`                               | Id de coleção opcional (padrão `''`)                                                                               |
| `drawn`              | `string`                               | `'NONE'` (padrão) ou `'true'` depois de sorteado (tabelas sem reposição)                                          |
| `type`               | `'text' \| 'document'`                  | `document` vincula o resultado a um documento do mundo em vez de texto puro                                         |
| `documentCollection` | `'actors'\|'items'\|'stages'\|'journals'` | Coleção do documento vinculado (só quando`type: 'document'`)                                                     |
| `documentId`         | `string`                               | Id do documento vinculado (só quando`type: 'document'`)                                                            |
| `description`        | `string`                               | Corpo rich-text mostrado na própria janela de edição do resultado                                                  |

**Evento WS:** `roll-table-entry.created`

---

### PUT `/entries/:entryId`

Atualiza entrada. `requireGM`. Retorna `{ "success": true }`. Mesmos campos acima (exceto `collectionId`), mais `rangeMin`/`rangeMax` (`number`) — editáveis
diretamente aqui, independente do `weight`, igual `POST /:id/normalize-results` abaixo.
Diferente da `description` da tabela, a `description` da entrada é gravada como enviada, sem sanitização.

**Evento WS:** `roll-table-entry.updated`

---

### DELETE `/entries/:entryId`

Remove entrada. `requireGM`. Retorna `{ "success": true }`.

**Evento WS:** `roll-table-entry.deleted`

---

### POST `/:id/roll`

Rola a `formula` da tabela de verdade (via o motor de dados do server) e casa o total
contra o `[rangeMin, rangeMax]` de cada entrada — não é mais um sorteio ponderado cego
sobre `weight`. Quando `replacement` é `false`, entradas já marcadas como `drawn` ficam
fora da comparação e a entrada sorteada é marcada como `drawn` em seguida (o
`weight`/intervalo não são alterados, então `reset-results` consegue restaurar tudo
depois). Tenta rolar de novo internamente (até 25 vezes) se cair num gap ou num
intervalo já sorteado, antes de desistir com `400`. Também retorna `400` se nenhuma
entrada tiver intervalo configurado ainda, ou quando todas já foram sorteadas.

Qualquer jogador autenticado pode rolar (sem `requireGM`). Cada rolagem também posta uma mensagem de chat no
mundo (`chat.message`, com o nome da tabela, a fórmula e o total quando `displayRollFormula` está ativo).

**Response `200`:** `{ result, formula, total, label }` — `total` é o número realmente sorteado; `result` é a entrada sorteada.
**Erros:** `404` `{ "error": "Roll table not found." }`; `400` quando a tabela não tem entradas, não tem intervalo configurado, ou nenhuma entrada sorteável casa após 25 tentativas.
**Evento WS:** `roll-table.rolled` (`{ tableId, result, formula, total, label }`)

---

### POST `/:id/reset-results`

Apenas GM. Limpa a marca `drawn` de todas as entradas, tornando-as elegíveis para
`/:id/roll` de novo sem precisar recriar a tabela.

**Response `200`:** `{ success: true }`
**Response `404`:** `{ "error": "Roll table not found." }`

---

### POST `/:id/normalize-results`

Apenas GM. Recalcula `rangeMin`/`rangeMax` de todas as entradas, contíguos e na ordem
de criação, a partir do `weight` atual de cada uma. 

Use pra corrigir gaps/sobreposições deixados por edição manual de intervalo.

**Response `200`:** `{ success: true }`
