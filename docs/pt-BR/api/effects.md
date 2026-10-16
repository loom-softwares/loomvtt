# Effects (Efeitos aplicados)

Effects são as cópias aplicadas dos templates de efeito. Um **template** fica num item ou num tile e nunca é consumido. Ao aplicar um template, cria-se um **efeito aplicado** num actor ou cast. O efeito aplicado é o registro que conta a duração, expira e altera os atributos pelos seus `changes`.

As regras estão em `shared/effect-rules.ts`. As rotas estão em `server/applications/api/effects.ts`. Os efeitos são guardados na mesma tabela dos buffs, então as rotas de [Buffs](buffs.md) também leem e editam esses registros.

## Endpoints

**Base:** `/api/effects`
**Auth:** `requireAuth, requireWorldMatch`

## Permissões

| Rota | Quem pode chamar |
|------|------------------|
| `POST /apply` | Assistant GM (role 3) e acima, ou a sessão admin, para qualquer template. Jogador só quando o template vem de um item de um actor que ele pode editar, ou quando é um template de tile aplicado a um cast que ele possui e que está dentro do tile. |
| `POST /clear` | Assistant GM (role 3) e acima, ou a sessão admin. Jogador só numa remoção de tile sobre um alvo que ele possui (ver [Remoção de tile pelo jogador](#remoção-de-tile-pelo-jogador)). |
| `POST /condition` | Assistant GM (role 3) e acima, ou a sessão admin |
| `GET /target` | Qualquer sessão logada do mundo |
| `GET /requests` | Assistant GM (role 3) e acima, ou a sessão admin |
| `POST /requests/:id/approve` | Assistant GM (role 3) e acima, ou a sessão admin |
| `POST /requests/:id/deny` | Assistant GM (role 3) e acima, ou a sessão admin |

Um jogador que aplica um template de tile a um cast que não é dele, ou fora do tile, recebe `403`.

Quando o mundo tem aprovação do GM ligada (ver [Aprovação do GM](#aprovação-do-gm)), um jogador que aplica um template de item não o aplica direto. A requisição fica em espera até um Assistant GM (role 3) ou o GM responder.

---

## Conceitos

### Templates e efeitos aplicados

Um template é um buff com `itemId` ou `tileId` e sem `actorId` nem `castId`. Ele é criado com `POST /api/buffs`.

Um efeito aplicado é um buff com `actorId` ou `castId`. Ele só é criado por `POST /api/effects/apply`. Ao aplicar, copiam-se para o novo registro o `name`, `icon`, `description`, `durationUnit`, `expireOn`, `conditionId`, `tags`, `removeOnCombatEnd` e `changes` do template. Os `changes` são copiados em profundidade, então edições posteriores no template não mudam efeitos que já foram aplicados.

A cópia aplicada também define estes campos:

- `origin` com o nome do template.
- `disabled` como `false`, qualquer que seja o valor do template.
- `templateId` com o id do template.
- `sourceType` como `item` ou `tile`, e `sourceId` com o id do item ou tile.
- `appliedBy` com o usuário que aplicou.
- `startedAt` com o tempo atual do mundo, em segundos.

### Unidades de duração

| `durationUnit` | `duration` | Como conta |
|----------------|------------|------------|
| `permanent` | Ignorado; guardado como `-1` | Nunca |
| `rounds` | Número inteiro, mínimo 1 | Uma contagem a cada mudança de rodada |
| `turns` | Número inteiro, mínimo 1 | Uma contagem a cada fronteira de turno correspondente do alvo (ver `expireOn`) |
| `seconds`, `minutes`, `hours`, `days`, `weeks`, `months`, `years` | Número inteiro, mínimo 1 | Pelo tempo do mundo |

Para unidades de tempo, a cópia aplicada guarda `expiresAt`. É o instante de início somado à duração, convertida em segundos pelo calendário do mundo; por isso meses e anos seguem o tamanho desse calendário.

Mensagens de validação:

- `unknown duration unit "<unit>"` quando a unidade não está na tabela acima.
- `duration must be a whole number of at least 1 for the unit "<unit>"` quando uma unidade que não é `permanent` recebe uma duração que não é inteira ou é menor que 1.

### Sem empilhamento

Um efeito aplicado é bloqueado quando já existe, no mesmo alvo, um efeito aplicado habilitado com a mesma chave. A chave é o `conditionId`, quando preenchido, e o `templateId` caso contrário. Dois templates diferentes que compartilham um `conditionId` se bloqueiam entre si. Efeitos desabilitados nunca bloqueiam.

### Filtro de remoção

Uma requisição de remoção apaga os efeitos aplicados de um alvo que combinam com um filtro. Cada chave abaixo é um critério. Quando várias são enviadas, todas precisam combinar.

| Chave | Combina com |
|-------|-------------|
| `all` | Todo efeito aplicado. Deve ser `true`; ele sobrepõe as outras chaves. |
| `origin` | Efeitos cujo `origin` é igual ao valor. |
| `sourceType` | Efeitos cujo `sourceType` é igual ao valor. |
| `sourceId` | Efeitos cujo `sourceId` é igual ao valor. |
| `conditionId` | Efeitos cujo `conditionId` é igual ao valor. |
| `tag` | Efeitos cujas `tags` incluem o valor. |
| `templateId` | Efeitos cujo `templateId` é igual ao valor. |

Chaves fora dessas são ignoradas. Um filtro vazio não combina com nada e é recusado com `400`. Templates nunca são combinados.

### Aprovação do GM

O campo do mundo `effectsRequireGmApproval` (padrão `false`) liga a aprovação do GM para efeitos de jogadores. O GM o define com `PUT /api/worlds/:id/basic-info` (ver [Worlds](worlds.md)). Enquanto ele está `true`:

- Só entra em espera o efeito de um jogador que aplica um template de **item**. Templates de tile nunca são bloqueados, e um Assistant GM ou GM aplica qualquer template direto.
- Antes de entrar em espera, o servidor roda as mesmas verificações de uma aplicação direta (template, alvo, duração, Sem empilhamento). Uma requisição que não poderia dar certo é recusada na hora com `400`, `404` ou `409`, e nada é guardado.
- É preciso ter pelo menos um usuário conectado com role 3 ou acima (Assistant GM ou GM) no mundo. Senão a requisição é recusada com `409`.
- As requisições pendentes ficam guardadas só em memória. Cada uma vale 5 minutos, um jogador pode ter no máximo 5 pendentes, e um reinício do servidor descarta todas. Nada é gravado no banco de dados.
- Responder uma requisição a remove, qualquer que seja o resultado. Requisições expiradas são tratadas como inexistentes, então responder uma delas devolve `404`.
- No **approve**, o servidor verifica a requisição de novo, como o jogador estaria agora: o alvo e o template ainda precisam existir, o jogador ainda precisa estar no mundo, e ele ainda precisa poder usar o template (ser dono do actor do item). Se não puder, a resposta é `403`. Caso contrário, o efeito é aplicado com as mesmas regras de uma aplicação direta, então `409` ainda é possível.
- O alvo é o cast ou actor que o jogador enviou, resolvido de novo quando o GM responde.

---

## Rotas

### POST `/apply`

Copia um template de efeito para um cast ou um actor.

**Request body:**

| Campo | Tipo | Obrigatório |
|-------|------|-------------|
| `templateId` | `string` | **sim** |
| `targetCastId` | `string` | sim, a menos que `targetActorId` seja enviado |
| `targetActorId` | `string` | sim, a menos que `targetCastId` seja enviado |

Quando os dois alvos são enviados, usa-se `targetCastId`. Um cast vinculado a um actor (personagem de jogador) recebe o efeito no actor, então o efeito acompanha o personagem entre cenas. Um cast não vinculado (NPC) guarda o efeito nele mesmo.

**As verificações rodam nesta ordem:** body, mundo, alvo, template, permissão.

**Response `201`:** `{ "effect": <efeito aplicado> }` quando o efeito é aplicado diretamente.
**Response `202`:** `{ "requestId": "<id>" }` quando o efeito de item de um jogador fica em espera por aprovação do GM (ver [Aprovação do GM](#aprovação-do-gm)). Nada foi aplicado ainda.
**Response `400`:** `{ "error": "worldId is required" }` quando nem a sessão nem o body informam o mundo; `{ "error": "templateId and a target are required" }`; `{ "error": "Not an effect template" }` quando `templateId` não é um template; ou uma mensagem de validação de duração (ver acima).
**Response `403`:** `{ "error": "You cannot use this effect" }` quando um jogador não é dono do actor do item do template, ou quando o alvo de um template de tile não é um cast do jogador dentro do tile (no stage do tile).
**Response `404`:** `{ "error": "Target not found" }` quando o alvo não existe ou pertence a outro mundo; `{ "error": "Effect template not found" }` quando o template não existe ou pertence a outro mundo.
**Response `409`:** `{ "error": "Effect already active", "blockedBy": "<id do efeito que bloqueia>" }` (ver Sem empilhamento). Também `{ "error": "No GM is connected to approve this effect" }` quando o efeito de um jogador precisa de aprovação e nenhum Assistant GM ou GM está conectado ao mundo.
**Response `429`:** `{ "error": "Too many pending effect requests" }` quando o jogador já tem 5 requisições esperando.
**Response `500`:** `{ "error": "..." }` em falha inesperada
**Eventos internos:** Signal `buff.created` com o efeito aplicado quando ele é aplicado diretamente. Uma requisição em espera envia `effect.requested` no lugar (ver Signals).

---

### POST `/clear`

Remove os efeitos aplicados de um alvo que combinam com um filtro. Templates não são afetados.

**Request body:**

| Campo | Tipo | Obrigatório |
|-------|------|-------------|
| `targetCastId` | `string` | sim, a menos que `targetActorId` seja enviado |
| `targetActorId` | `string` | sim, a menos que `targetCastId` seja enviado |
| `filter` | `object` | **sim**, com pelo menos um critério (ver Filtro de remoção) |

Para um Assistant GM, a verificação de papel roda antes das verificações do body, então quem está abaixo de Assistant GM é recusado mesmo que o body também seja inválido. Para um jogador, o filtro é verificado primeiro pelas regras de [Remoção de tile pelo jogador](#remoção-de-tile-pelo-jogador): qualquer coisa diferente de uma remoção de tile é recusada com `403`, antes das verificações de alvo e do restante do body.

**Response `200`:** `{ "removed": ["<id>", "..."] }`. O array fica vazio quando nada combinou.
**Response `400`:** `{ "error": "worldId is required" }`; `{ "error": "A target is required" }`; `{ "error": "A clear needs at least one criterion" }` quando `filter` falta, não é um objeto ou não tem nenhuma chave utilizável.
**Response `403`:** `{ "error": "Assistant GM permission required" }` quando quem chama é um jogador e a requisição não é uma remoção de tile permitida, ou quando o jogador não é dono do alvo
**Response `404`:** `{ "error": "Target not found" }` quando o alvo não existe ou pertence a outro mundo
**Response `500`:** `{ "error": "..." }` em falha inesperada
**Eventos internos:** Signal `buff.deleted` com `{ "id": "<id>" }` para cada efeito removido

### Remoção de tile pelo jogador

Um jogador pode remover os efeitos que um tile colocou em um dos seus casts ou actors. Qualquer outra remoção continua com o Assistant GM. A requisição do jogador só é permitida quando todas estas condições valem:

- `filter.sourceType` é `"tile"`.
- `filter` também informa `sourceId` (o id do tile) ou `templateId` (o id do template do tile).
- O alvo existe no mundo de quem chama.
- Quem chama é dono do alvo. Para um cast, isso significa permissão de edição no cast, ou no actor ao qual o cast está vinculado. Para um actor, significa permissão de edição no próprio actor. É a mesma regra de posse que a aplicação de tile de um jogador usa.

Para um jogador, o servidor então altera o filtro antes de comparar:

- `all` é removido, porque `all` combina com todo efeito e ignoraria a verificação de `sourceType`.
- `sourceType` é forçado para `"tile"`, então só são removidos os efeitos aplicados por um tile. Efeitos de item e condições manuais no mesmo alvo permanecem.

As outras chaves (`sourceId`, `templateId`, `conditionId`, `origin`, `tag`) continuam restringindo a combinação normalmente.

Cópias aplicadas de templates de tile sempre carregam `sourceType: "tile"` e `sourceId` com o id do tile, então são elas que uma remoção do jogador apaga.

### POST `/condition`

Liga ou desliga uma condição manual em um cast ou actor. Uma condição manual é um efeito aplicado permanente, sem template, escolhido à mão pelo GM.

**Request body:**

| Campo | Tipo | Obrigatório |
|-------|------|-------------|
| `conditionId` | `string` | **sim**, não vazio |
| `on` | `boolean` | **sim** |
| `targetCastId` | `string` | sim, a menos que `targetActorId` seja enviado |
| `targetActorId` | `string` | sim, a menos que `targetCastId` seja enviado |
| `name` | `string` | não. O nome exibido quando `on` é `true`; o padrão é `conditionId`. |
| `icon` | `string` | não. Usado quando `on` é `true`. |

O alvo é resolvido como em `POST /apply`: um cast vinculado recebe a condição no seu actor, e quando os dois campos de alvo são enviados, `targetCastId` é usado.

**As verificações rodam nesta ordem:** papel, depois mundo, depois alvo presente, depois `conditionId`, depois `on`, depois o alvo encontrado no mundo.

**`on: true`:** cria um efeito aplicado com `sourceType: "manual"`, `sourceId: ""`, `templateId: ""`, `durationUnit: "permanent"`, `duration: -1`, `conditionId` com o id informado e `appliedBy` com quem chamou. A condição também aparece nos status markers dos casts do alvo (ver [Status markers](#status-markers)). Vale a mesma regra de Sem empilhamento de um template: um segundo efeito ativo com o mesmo `conditionId` no alvo é recusado.

**`on: false`:** remove os efeitos aplicados do alvo que carregam esse `conditionId`. Também remove a condição dos status markers dos casts do alvo, mesmo quando nenhum efeito sustenta esse marker (por exemplo um marker definido à mão). O marker permanece somente enquanto outro efeito aplicado no alvo ainda carrega a mesma condição.

**Response `201`:** `{ "effect": <efeito aplicado> }` quando `on` é `true` e o efeito foi criado.
**Response `200`:** `{ "removed": ["<id>", "..."] }` quando `on` é `false`. O array fica vazio quando nada combinou; os status markers são atualizados do mesmo jeito.
**Response `400`:** `{ "error": "worldId is required" }`; `{ "error": "A target is required" }`; `{ "error": "conditionId is required" }` quando falta ou está em branco; `{ "error": "on must be true or false" }`; `{ "error": "<mensagem>" }` quando o efeito gravado é inválido.
**Response `403`:** `{ "error": "Assistant GM permission required" }` quando quem chama está abaixo de Assistant GM
**Response `404`:** `{ "error": "Target not found" }` quando o alvo não existe ou pertence a outro mundo
**Response `409`:** `{ "error": "Effect already active", "blockedBy": "<id>" }` quando `on` é `true` e a condição já está ativa no alvo
**Response `500`:** `{ "error": "..." }` em falha inesperada
**Eventos internos:** Signal `buff.created` quando uma condição é ligada; `buff.deleted` para cada efeito removido quando ela é desligada.

---

### GET `/target`

Lista os efeitos aplicados de um cast ou de um actor. Templates nunca aparecem na lista.

**Query parameters:** `castId` ou `actorId`. Um cast é resolvido do mesmo jeito que em `POST /apply`, então um cast vinculado devolve os efeitos do seu actor.

**Response `200`:** `{ "effects": [<efeito aplicado>, ...] }`
**Response `400`:** `{ "error": "worldId is required" }`; `{ "error": "castId or actorId is required" }`
**Response `404`:** `{ "error": "Target not found" }` quando o alvo não existe ou pertence a outro mundo
**Response `500`:** `{ "error": "..." }` em falha inesperada

---

### GET `/requests`

Lista as requisições de jogadores que esperam resposta no mundo de quem chama, da mais antiga para a mais nova. Requisições expiradas não aparecem. O mundo vem da sessão.

**Response `200`:** `{ "requests": [{ "id", "worldId", "userId", "templateId", "target", "createdAt" }, ...] }`. `target` guarda o `castId` ou `actorId` que o jogador enviou. `createdAt` é a hora do servidor em milissegundos.
**Response `400`:** `{ "error": "worldId is required" }`
**Response `403`:** `{ "error": "Assistant GM permission required" }` quando quem chama está abaixo de Assistant GM
**Response `500`:** `{ "error": "..." }` em falha inesperada

---

### POST `/requests/:id/approve`

Aplica um efeito de jogador em espera. A requisição é removida primeiro, então ela é respondida uma única vez, qualquer que seja o resultado. As verificações estão descritas em [Aprovação do GM](#aprovação-do-gm).

**Response `200`:** `{ "effect": <efeito aplicado> }`. Diferente da aplicação direta, esta rota devolve `200`, não `201`.
**Response `400`:** uma mensagem de validação de duração, ou o mesmo erro de uma aplicação direta
**Response `403`:** `{ "error": "Assistant GM permission required" }` quando quem chama está abaixo de Assistant GM; `{ "error": "The player can no longer use this effect" }` quando o jogador ou o template já não se qualificam
**Response `404`:** `{ "error": "Effect request not found" }` quando o id é desconhecido, expirou ou pertence a outro mundo; `{ "error": "Target not found" }`; `{ "error": "Effect template not found" }`
**Response `409`:** `{ "error": "Effect already active", "blockedBy": "<id do efeito que bloqueia>" }`
**Response `500`:** `{ "error": "..." }` em falha inesperada
**Eventos internos:** Signal `buff.created` com o efeito aplicado

---

### POST `/requests/:id/deny`

Descarta um efeito de jogador em espera sem aplicá-lo e avisa o jogador.

**Response `200`:** `{ "ok": true }`
**Response `403`:** `{ "error": "Assistant GM permission required" }` quando quem chama está abaixo de Assistant GM
**Response `404`:** `{ "error": "Effect request not found" }` quando o id é desconhecido, expirou ou pertence a outro mundo
**Response `500`:** `{ "error": "..." }` em falha inesperada
**Eventos internos:** Signal `effect.denied`

---

## Ciclo de vida

### Contagem de rodadas e turnos

As contagens acontecem dentro de `POST /api/combat/:worldId/next`. A cada chamada, o servidor executa estes passos, nesta ordem:

1. **Fim de turno.** Para o combatente cujo turno termina, os efeitos por turno do seu alvo com `expireOn: "turn-end"` perdem uma contagem. Esse é o padrão de `expireOn`.
2. **Mudança de rodada.** Quando a chamada avança para uma nova rodada, todo efeito por rodada do mundo perde uma contagem. Isso inclui efeitos em actors que não estão no combate.
3. **Início de turno.** Para o combatente cujo turno começa, os efeitos por turno do seu alvo com `expireOn: "turn-start"` perdem uma contagem.

Uma contagem que chega a `0` remove o efeito. Uma contagem que cai sem chegar a `0` emite `buff.updated`, e uma remoção emite `buff.deleted`. Templates e efeitos desabilitados nunca são contados. Para um cast vinculado, as contagens vão para os efeitos do seu actor.

`POST /api/combat/:worldId/previous` não conta nada e não devolve contagens já gastas.

### Expiração por tempo

Um timer roda a cada 2 segundos para cada mundo carregado, mesmo com o relógio do mundo pausado, então uma mudança manual de tempo também encerra efeitos. Um efeito aplicado com unidade de tempo é removido quando o seu `expiresAt` é igual ou anterior ao tempo atual do mundo. Efeitos desabilitados não expiram.

### Fim do combate

Efeitos aplicados com `removeOnCombatEnd: true` são removidos quando:

- `POST /api/combat/:worldId/end` é chamado, ou
- `POST /api/combat/:worldId/start` ou `POST /api/combat/:worldId/dex-initiative` substitui um combate que estava ativo.

Iniciar um combate quando não havia nenhum ativo não remove nada. `POST /api/combat/:worldId/reset` e `previous` também não os removem. Templates nunca são tocados.

### Remoção de cast, stage ou actor

Remover um objeto também remove os efeitos aplicados que pertencem a ele. Templates nunca são removidos por isso.

- `DELETE /api/cast/:id` remove todos os efeitos aplicados daquele cast.
- `DELETE /api/stages/:id` remove os efeitos aplicados de todos os casts do stage. Os casts em si não são removidos nesse passo.
- `DELETE /api/actors/:id` remove as cópias aplicadas dos efeitos do actor. Templates de item permanecem.

Cada remoção envia `buff.deleted`, e também atualiza os status markers dos casts afetados (ver abaixo).

### Status markers

Os `statusMarkers` de um cast acompanham os efeitos aplicados no seu alvo. O alvo é o próprio cast, ou o actor quando o cast está vinculado (um cast vinculado mostra os markers do seu actor em todos os stages).

- Aplicar um efeito com `conditionId` adiciona essa condição aos markers dos casts do alvo.
- Remover um efeito (por remoção, contagem, expiração, fim de combate ou pelas remoções em cascata acima) tira a sua condição dos markers somente quando nenhum outro efeito aplicado no alvo ainda a tem.
- Markers que nenhuma condição removida nomeia nunca são alterados, então um marker definido à mão permanece.
- `POST /api/effects/condition` com `on: false` também remove o marker da condição dos casts do alvo quando nenhum efeito aplicado no alvo ainda a carrega. É assim que o GM remove um marker definido à mão.
- `DELETE /api/buffs/:id` em um efeito aplicado atualiza os status markers do mesmo jeito: a condição sai do cast quando nenhum outro efeito aplicado no alvo ainda a tem.
- A condição `blinded` remove a visão própria do token: um token cego não dá visão, visão no escuro nem campo de visão estendido por luz, enquanto a visão dos outros tokens do jogador continua contando.

---

## Signals

| Signal | Quando é enviado | Payload |
|--------|------------------|---------|
| `buff.created` | Um efeito é aplicado, diretamente ou por aprovação, ou uma condição manual é ligada | O efeito aplicado |
| `buff.updated` | Uma contagem diminui | O efeito atualizado |
| `buff.deleted` | Um efeito é removido, expira, chega a `0`, termina com o combate ou é removido por uma cascata | `{ "id": "<id>" }` |
| `effect.requested` | O efeito de item de um jogador fica em espera por aprovação | `{ "requestId", "worldId", "userId", "templateId", "targetCastId", "targetActorId", "templateName" }`. O campo de alvo não usado vai como string vazia. |
| `effect.denied` | Um GM nega uma requisição em espera | `{ "requestId", "userId" }` |

As rotas de [Buffs](buffs.md) enviam os mesmos signals `buff.*` nas suas próprias escritas.
