# Roll Tables (Tabelas de Rolagem)

## Endpoints

**Base:** `/api/roll-tables`
**Auth:** `requireAuth, requireWorldMatch`

---

### GET `/`

Lista tabelas. `?worldId=`

---

### POST `/`

Cria tabela.

| Campo                  | Tipo        | Descrição                                            |
| ---------------------- | ----------- | ------------------------------------------------------ |
| `id`                 | `string`  | Opcional                                               |
| `worldId`            | `string`  | Mundo                                                  |
| `name`               | `string`  | Nome                                                   |
| `description`        | `string`  | Descrição                                            |
| `formula`            | `string`  | Fórmula de rolagem                                    |
| `sortMode`           | `string`  | Modo de ordenação                                    |
| `imgUrl`             | `string`  | URL da imagem                                          |
| `replacement`        | `boolean` | Com reposição?                                       |
| `displayRollFormula` | `boolean` | Exibe a fórmula de rolagem junto do resultado no chat |

**Evento WS:** `roll_tables.created` (auto-broadcast pela camada de documento)

---

### GET `/:id`

Busca tabela com `entries[]`.

---

### PUT `/:id`

Atualiza tabela.

**Evento WS:** `roll_tables.updated` (auto-broadcast)

---

### DELETE `/:id`

Remove tabela + entradas (cascade).

**Evento WS:** `roll_tables.deleted` (auto-broadcast)

---

### POST `/:id/entries`

Adiciona entrada. `rangeMin`/`rangeMax` são atribuídos automaticamente (contíguos ao
`rangeMax` da última entrada, cobrindo o `weight`) — passe explicitamente no `PUT` pra
sobrescrever.

| Campo                  | Tipo                                     | Descrição                                                                                                           |
| ---------------------- | ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `text`               | `string`                               | Nome/rótulo do resultado. Se`type` for `document` e ficar vazio, é preenchido com o nome do documento vinculado |
| `imgUrl`             | `string`                               | Caminho do ícone. Se`type` for `document` e ficar vazio, é preenchido com a imagem do documento vinculado       |
| `weight`             | `number`                               | Usado só pra calcular o intervalo inicial na criação                                                               |
| `drawn`              | `boolean`                              | Se esse resultado já foi sorteado (tabelas sem reposição)                                                          |
| `type`               | `'text' \| 'document'`                  | `document` vincula o resultado a um documento do mundo em vez de texto puro                                         |
| `documentCollection` | `'actors'\|'items'\|'stages'\|'journals'` | Coleção do documento vinculado (só quando`type: 'document'`)                                                     |
| `documentId`         | `string`                               | Id do documento vinculado (só quando`type: 'document'`)                                                            |
| `description`        | `string`                               | Corpo rich-text mostrado na própria janela de edição do resultado                                                  |

**Evento WS:** `roll_table_entries.created` (auto-broadcast)

---

### PUT `/entries/:entryId`

Atualiza entrada. Mesmos campos acima, mais `rangeMin`/`rangeMax` (`number`) — editáveis
diretamente aqui, independente do `weight`, igual `POST /:id/normalize-results` abaixo.

**Evento WS:** `roll_table_entries.updated` (auto-broadcast)

---

### DELETE `/entries/:entryId`

Remove entrada.

**Evento WS:** `roll_table_entries.deleted` (auto-broadcast)

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

**Response `200`:** `{ result, formula, total, label }` — `total` é o número realmente sorteado.
**Evento WS:** `roll-table.rolled`

---

### POST `/:id/reset-results`

Apenas GM. Limpa a marca `drawn` de todas as entradas, tornando-as elegíveis para
`/:id/roll` de novo sem precisar recriar a tabela.

**Response `200`:** `{ success: true }`

---

### POST `/:id/normalize-results`

Apenas GM. Recalcula `rangeMin`/`rangeMax` de todas as entradas, contíguos e na ordem
de criação, a partir do `weight` atual de cada uma. 

Use pra corrigir gaps/sobreposições deixados por edição manual de intervalo.

**Response `200`:** `{ success: true }`
