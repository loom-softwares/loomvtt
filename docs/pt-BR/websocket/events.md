# Eventos WebSocket

Catálogo completo de eventos Servidor→Cliente, entregues via **Socket.IO** — cada linha é um
nome de evento Socket.IO distinto (`socket.on('<evento>', ...)` do lado do cliente), não um
envelope `{type, data}`. Ver [overview.md](./overview.md) pro modelo de transporte e escopo
de sala.

## Convenção de nomenclatura

A nomenclatura **não é consistente** entre entidades — algumas são singular, outras plural,
outras com underscore, outras com hífen. O nome na rede **não** é o nome da tabela: a camada
genérica `Document.create/update/delete()` emite `Signal.broadcast(`${schema.tableName}.<ação>`, ...)`
(por exemplo `stages.updated`), mas esse sinal interno só chega aos clientes se `server/index.ts`
tiver um `Signal.listen` pra ele, e esse relay o reemite com o nome próprio na rede
(`stages.updated` sai como `stage.updated`). A tabela abaixo lista os nomes exatos na rede; não
assuma que um padrão de uma entidade vale pra outra. Renomeações conhecidas: `actors.*` → `actor.*`,
`stages.*` → `stage.*`, `levels.*` → `level.*`, `tiles.*` → `tile.*`, `macros.*` → `macro.*`,
`users.*` → `user.*`, `worlds.*` → `world.*`, `decks.deleted` → `deck.deleted`,
`compendium_packs.*` → `compendium.*`, `roll_tables.*` → `roll-table.*`,
`roll_table_entries.*` → `roll-table-entry.*`.

## Eventos de Canvas / Cena

| Evento | Payload (`data`) | Descrição |
|--------|-------------------|-----------|
| `stage.created` | Stage completa | Stage criada (nome na rede do sinal `stages.created`) |
| `stage.activated` | `{ stageId, id, levelId, levels, name, bgUrl, backgroundColor, gridSize, gridColor, gridType, gridStyle, gridOpacity, gridDistance, gridUnit, width, height, ambientPlaylistId, ambientSoundId, ambientStartSoundId, darknessLevel, weatherEffect, transitionType, transitionDuration, flags, ...config de névoa e visão }` | Stage ativada (`levelId`/`bgUrl`/`backgroundColor` vêm do level inicial, ou do primeiro level por elevação). Montado por `buildActivationPayload()` em `server/applications/api/stages.ts` |
| `stage.updated` | Stage completa | Stage atualizada |
| `stage.deleted` | `{ id, worldId, stageId }` | Stage removida |
| `stage.darkness` | `{ stageId, darknessLevel, duration }` | Escuridão alterada |
| `stage.theaterToggled` | `{ stageId, active }` | Modo teatro ligado ou desligado (enviado depois de uma mensagem `stage.theater` do GM) |
| `stage.theaterSkinChanged` | `{ stageId, skinId }` | Moldura do teatro alterada |
| `stage.theaterEffectChanged` | `{ stageId, effect, worldId }` | Efeito do teatro alterado |
| `stage.theaterItemsChanged` | `{ stageId, items }` | As imagens e textos da tela de teatro de uma cena mudaram (`items` é a lista inteira) |
| `stage.castChanged` | `{ stageId, activeCast, activeCastMembers }` | Os atores visíveis na bandeja de cinema mudaram |
| `stage.castRosterChanged` | `{ stageId, castRoster, activeCast, activeCastMembers }` | O elenco da cena mudou (`activeCast` é reduzido ao elenco) |
| `level.created` | Level completo | Level criado (nome na rede do sinal `levels.created`) |
| `level.updated` | Level completo | Level atualizado |
| `level.deleted` | `{ id, worldId, stageId }` | Level removido |
| `levels.changed` | `{ stageId }` | Todos os levels de uma stage mudaram |
| `cast.created` | Cast member completo | Token criado. Um token com `hidden: true` vai só pra sockets de GM (ver Notas) |
| `cast.updated` | Cast member completo | Token atualizado. O servidor remove `_socketId` antes de enviar; ele serve só pra pular o remetente |
| `cast.deleted` | `{ id, worldId, stageId }` | Token removido |
| `cast.resync` | `{ cast: [...] }` | Enviado só a um cliente que reconectou: todos os tokens de novo (mesma redação do `init`), porque os eventos durante a queda nunca foram entregues |
| `token.moved` | `{ id, x, y, worldId, movedAt, movePath? }` | Token movido (`movePath`: os pontos que quem moveu marcou, para as outras telas andarem com o token pela mesma linha). O remetente é pulado |
| `token.target` | `{ castId, targetedBy }` | Token marcado como alvo |
| `tile.created` | Tile completo | Tile criado (nome na rede do sinal `tiles.created`). Vai só pra sala da stage do tile |
| `tile.updated` | Tile completo | Tile atualizado (só sala da stage) |
| `tile.deleted` | `{ id, worldId, stageId }` | Tile removido (só sala da stage) |
| `tile.triggered` | `{ action, tokenId }` | Mandado direto pra um socket alvo (`targetSocket.emit(...)`), não é broadcast de sala — ver [overview.md](./overview.md) |
| `light.created` | Light completa | Luz criada |
| `light.updated` | Light completa | Luz atualizada |
| `light.deleted` | `{ id, stageId }` | Luz removida |
| `drawing.created` | Drawing completo | Desenho criado |
| `drawing.updated` | Drawing completo | Desenho atualizado |
| `drawing.deleted` | `{ id }` | Desenho removido |
| `drawing.cleared` | `{ stageId }` | Desenhos limpos |
| `wall.created` | Wall completa | Parede criada |
| `wall.updated` | Wall completa | Parede atualizada |
| `wall.deleted` | `{ id }` | Parede removida |
| `wall.bulkDeleted` | `{ ids: [...] }` | Várias paredes removidas numa única requisição |
| `door.state` | `{ wallId, door, doorState, worldId }` | Estado da porta alterado |
| `noise.created` | Noise completo | Som ambiente criado |
| `noise.updated` | Noise completo | Som ambiente atualizado |
| `noise.deleted` | `{ id }` | Som ambiente removido |
| `note.created` | Note completa | Nota criada |
| `note.updated` | Note completa | Nota atualizada |
| `note.deleted` | `{ id }` | Nota removida |
| `fog.updated` | Delta da névoa: `{ id, stageId, userId, levelId, newPolygons }` | Revelação de névoa alterada. Vai pra sala da stage; no modo de exploração individual, só pro usuário dono e pra sockets de GM |
| `fog.created` | `{ id, stageId, userId, levelId, ... }` | Revelação de névoa criada. Mesmo público de `fog.updated` |
| `fog.reset` | `{ stageId, userId? }` | Névoa limpa. Com `userId`, só esse usuário e sockets de GM; sem ele, a sala inteira da stage |
| `ping` | Payload original do ping | Rebroadcast pra sala do world (ping de latência/posição estilo Ctrl+click) |
| `pong` | `{ timestamp, ...dadosOriginais }` | Mandado de volta só pra quem enviou o `ping` |
| `canvas.ping` | `{ ...data, userColor }` | Marcador visual compartilhado (Ctrl+click) |
| `canvas.floatingText` | `{ x, y, text, color, options }` | Texto/dano flutuante sincronizado no canvas para todos os jogadores |

## Eventos de Dados do Mundo

| Evento | Payload (`data`) | Descrição |
|--------|-------------------|-----------|
| `actor.created` | Actor completo | Actor criado. Vai pra sala do world; um jogador Limitado recebe a versão reduzida (`redactActorForLimited`) |
| `actor.updated` | Actor completo | Actor atualizado (mesmo público e redução de `actor.created`). Também é o nome na rede do sinal `actors.updated` |
| `actor.deleted` | `{ id, worldId, stageId }` | Actor removido |
| `item.created` | Item completo | Item criado (sala do world, filtrado pelo `ownership` do item) |
| `item.updated` | Item completo | Item atualizado (sala do world, filtrado por `ownership`) |
| `item.deleted` | `{ id }` | Item removido |
| `journal.created` | Journal completo | Journal criado (sala do world, filtrado por `ownership`) |
| `journal.updated` | Journal completo | Journal atualizado (também disparado pra CRUD de página e categoria — ver [journals.md](../api/journals.md)) |
| `journal.deleted` | `{ id }` | Journal removido |
| `folder.created` | Folder completa | Pasta criada |
| `folder.updated` | Folder completa | Pasta atualizada |
| `folder.deleted` | `{ id }` | Pasta removida |
| `deck.created` | Deck completo | Deck criado (sala do world, filtrado por ownership; sem ownership, só sockets de GM) |
| `deck.updated` | Deck completo | Deck atualizado (mesmo público de `deck.created`) |
| `deck.deleted` | `{ id, worldId, stageId }` | Deck removido (nome na rede do sinal `decks.deleted`; o sinal é plural e o nome na rede é singular) |
| `playlist.created` | Playlist completa | Playlist criada |
| `playlist.updated` | Playlist completa | Playlist atualizada |
| `playlist.deleted` | `{ id }` | Playlist removida |
| `playlist.sound.created` | Sound completo | Som adicionado |
| `playlist.sound.updated` | Sound completo | Som atualizado |
| `playlist.sound.deleted` | `{ id, playlistId, soundCount }` | Som removido |
| `macro.created` | Macro completo | Macro criada (nome na rede do sinal `macros.created`) |
| `macro.updated` | Macro completo | Macro atualizada |
| `macro.deleted` | `{ id, worldId, stageId }` | Macro removida |
| `user.created` | User completo | Usuário criado (nome na rede do sinal `users.created`) |
| `user.updated` | User completo (também disparado por `/users/:id/flags`) | Usuário atualizado |
| `user.deleted` | `{ id }` | Usuário removido |
| `combat.started` | Combat completo | Um combate foi iniciado. Sala do world, filtrado com `defaultPerm` 0: só sockets de GM recebem (ver Notas) |
| `combat.next` | Combat completo | Turno avançado. Mesmo público de `combat.started` |
| `combat.updated` | Combat completo | Combate alterado (combatentes, rodada etc.). Mesmo público de `combat.started` |
| `combat.ended` | `{ worldId }` | Combate encerrado. Mesmo público de `combat.started` |
| `display.push` | `{ worldId, journalId, pageId, targetUserIds, journal }` | Uma página de journal foi enviada às telas de display e aos jogadores. Só o GM e os usuários alvo recebem o payload completo (com `journal`); os demais recebem sem `journal` |
| `display.media` | `{ worldId, src, title, targetUserIds }` | Um item de mídia foi exibido nas telas de display. Vai pra sala do world |
| `display.revoked` | `{ worldId, linkId, token }` | Um link de display foi revogado. O próprio dispositivo de display é desconectado na hora (ver Notas) |

## Eventos de Sistema

| Evento | Payload (`data`) | Descrição |
|--------|-------------------|-----------|
| `init` | Estado completo do mundo | Sincronização inicial (após `user.identify`) — ver [overview.md](./overview.md) pra forma exata |
| `users.online` | `OnlineUser[]` | Lista de usuários online no world (também reenviado ao trocar de stage) |
| `session.kicked` | `{ reason }` | Enviado a um socket antes de ser desconectado. `reason` é `kicked`, `banned` ou `revoked` |
| `world.created` | World completo | Mundo criado (nome na rede do sinal `worlds.created`) |
| `world.updated` | World completo | Mundo atualizado |
| `world.deleted` | `{ worldId }` | Mundo removido |
| `world.deactivated` | `{}` | Mundo desativado. Enviado com `io.emit` pra **todo** socket do servidor, e o servidor desconecta todo usuário conectado, de todos os worlds (ver Notas) |
| `world.paused` | `{ worldId }` | Mundo pausado pelo GM |
| `world.resumed` | `{ worldId }` | Mundo retomado pelo GM |
| `time.updated` | `{ worldId, worldTime, timeScale, paused, serverNow, calendarId? }` | Snapshot do relógio do mundo: enviado a cada mudança, ao pausar e ao retomar, e a cada cerca de 30 s enquanto o relógio roda. Os clientes calculam o horário atual a partir do último snapshot |

## Eventos de efeito

Relayados por `server/index.ts` via `lib/effect-relay.ts`. Ver [api/effects.md](../api/effects.md#signals) para saber quando cada um é enviado.

| Evento | Payload (`data`) | Quem recebe |
|--------|-------------------|-----------|
| `buff.created` | O efeito aplicado | Todos os sockets do mundo do efeito |
| `buff.updated` | O efeito atualizado | Todos os sockets do mundo |
| `buff.deleted` | `{ id, worldId }` | Todos os sockets do mundo (relayado do signal interno `buff.removed`, que carrega o mundo) |
| `effect.requested` | `{ requestId, worldId, userId, templateId, targetCastId, targetActorId, templateName }` | Só os sockets de Assistant GM e Gamemaster do mundo (role 3 ou mais) |
| `effect.denied` | `{ requestId, userId }` | Só os sockets do jogador cujo pedido foi negado |

Um payload `buff.*` ou `effect.requested` sem `worldId` é descartado (nada é enviado); `effect.denied` é roteado por `userId`.

## Eventos de Chat

| Evento | Payload (`data`) | Descrição |
|--------|-------------------|-----------|
| `chat.message` | `{ id, userId, userName, userColor, type: 'chat', content, speaker, createdAt, worldId }` | Mensagem de chat |
| `chat.roll` | `{ id, userId, userName, userColor, formula, roll, actorId, speaker, createdAt, worldId }` | Rolagem de dado. Uma rolagem oculta (`gmroll`, `blindroll`, `selfroll`) chega a todos os sockets, mas só quem rolou e o GM recebem os valores reais; os demais recebem só `roll: { mode }` e `formula` vazia |
| `chat.messageUpdated` | `{ id, worldId, roll, userId }` | A rolagem de uma mensagem de chat foi alterada (por exemplo, uma rerrolagem). Mesma regra de visibilidade de `chat.roll` |
| `chat.messageDeleted` | `{ id, worldId }` | Mensagem apagada via `DELETE /api/chat-messages/:id` |
| `chat.cleared` | `{ worldId }` | Histórico de chat inteiro limpo via `DELETE /api/chat-messages` |

## Eventos de Addon/Sistema

| Evento | Payload (`data`) | Descrição |
|--------|-------------------|-----------|
| `addon.installed` | `{ type, name, version }` | Addon instalado |
| `addon.uninstalled` | `{ type, name }` | Addon removido |
| `roll-table.created` | Roll table completa | Tabela de rolagem criada (nome na rede do sinal `roll_tables.created`) |
| `roll-table.updated` | Roll table completa | Tabela de rolagem atualizada |
| `roll-table.deleted` | `{ id, worldId, stageId }` | Tabela de rolagem removida |
| `roll-table-entry.created` | Entry completa | Entrada de tabela criada (nome na rede do sinal `roll_table_entries.created`) |
| `roll-table-entry.updated` | Entry completa | Entrada de tabela atualizada |
| `roll-table-entry.deleted` | `{ id, worldId, stageId }` | Entrada de tabela removida |
| `roll-table.rolled` | `{ tableId, result, formula, total, label }` | Tabela de rolagem usada — repare no hífen, diferente dos eventos de CRUD com underscore acima |
| `compendium.created` | Compendium pack completo | Pacote criado (nome na rede do sinal `compendium_packs.created`) |
| `compendium.updated` | Compendium pack completo | Pacote atualizado |
| `compendium.deleted` | `{ id, worldId, stageId }` | Pacote removido |
| `compendium.entry.updated` | `{ packId, entry }` | Entrada de compendium atualizada |
| `compendium.sourceEntryUpdated` | `{ sourceId, entryId }` | Entry de uma fonte de addon/ruleset atualizada; clientes devem recarregar a entry pela rota da fonte |
| `template.created` | Template completo | Template de área criado |
| `template.updated` | Template completo | Template de área atualizado |
| `template.deleted` | `{ id, stageId }` | Template de área removido |

## Relay customizado para eventos de addon/sistema (`module.*`, `system.*`, `socket.*`)

Qualquer evento que um cliente emitir cujo nome comece com `module.`, `system.` ou `socket.`
é automaticamente relayado pra todo outro socket na sala do world de quem mandou — nenhum
código do servidor precisa registrar isso. É a via de escape que addons usam pros próprios
eventos de tempo real sem tocar em `server/index.ts`. Pela via direta (o nome do evento emitido
como está no socket, `wsClient.socket.emit(name, data)`) o limite é de 20 mensagens por segundo
por socket e 64 KB por payload; mensagens acima do limite ou grandes demais são descartadas com
registro no log. Sessões de display e stream são somente leitura e nunca relayam. Os mesmos
prefixos também funcionam dentro do envelope `message` (`wsClient.send('module.x', data)`), que
não tem limite de taxa. O evento relayado mantém o nome e o `data` sem alteração; quem enviou não
recebe o próprio evento.

## Eventos Cliente→Servidor

Mandados embrulhados num único evento Socket.IO chamado `'message'`: `socket.emit('message',
{ type, data })`. `wsClient.send(type, data)` faz esse embrulho pra você.

| Tipo | Payload (`data`) | Descrição |
|------|-------------------|-----------|
| `user.identify` | `{ worldId, isReconnect? }` | Identifica e inicia a sincronização; entra na sala `world:<id>`. Com `isReconnect: true` o servidor não envia `init`: reenvia `users.online` e `cast.resync` no lugar |
| `context.update` | `{ worldId, stageId? }` | Reescopo de salas: (re)entra em `world:<id>`, sai de toda sala `stage:*`, entra em `stage:<id>` se informado |
| `token.move` / `moveMember` | `{ id, x, y, path? }` | Move token — dispara `cast.updated` e `token.moved`; `path` é a lista opcional de pontos marcados no caminho (repassada, não gravada). Um movimento recusado recebe `token.move.rejected` de volta (`reason`: `rate-limited`, `not-found` ou `forbidden`) |
| `token.drag` | `{ tokens: [{ id, x, y }], waypoints?, ended? }` | Prévia ao vivo de um arrasto (não gravada): os outros veem a linha que quem arrasta está traçando, com os pontos marcados; `ended: true` quando o arrasto foi cancelado. Relayado pra sala do world, sem o remetente |
| `chat.message` | `{ content, speaker? }` | Envia mensagem |
| `chat.roll` | `{ formula, mode?, actorId?, speaker? }` | Rola dado. Uma rolagem recusada recebe `chat.roll.rejected` de volta (`reason`: `rate-limited` ou `invalid-formula`) |
| `stage.activate` | `{ stageId, worldId }` | Ativa stage (só GM). Emite `stages.updated` e `stage.activated` |
| `stage.theater` | `{ stageId, active }` | Liga ou desliga o modo teatro (só GM). Grava `flags.theaterActive` e emite `stage.theaterToggled` |
| `stage.theaterSkin` | `{ stageId, skinId }` | Troca a moldura do teatro (só GM). Grava `flags.theaterSkin` e emite `stage.theaterSkinChanged` |
| `stage.theaterEffect` | `{ stageId, effect }` | Troca o efeito do teatro (só GM). Grava `flags.theaterEffect` e emite `stage.theaterEffectChanged` |
| `stage.theaterItems` | `{ stageId, items, worldId }` | Define as imagens e textos da tela de teatro (só GM). O servidor reconstrói a lista campo a campo (máx. 80 itens; o endereço de uma imagem precisa ser um arquivo deste servidor ou uma página https), grava em `flags.theaterItems` da cena e transmite `stage.theaterItemsChanged` |
| `stage.cast` | `{ stageId, activeCast: [actorId, ...] }` | Define quais atores aparecem como cards no modo teatro (só GM, lista inteira a cada vez). Grava `flags.activeCast` e emite `stage.castChanged` |
| `stage.castRoster` | `{ stageId, castRoster: [actorId, ...] }` | Define o elenco da cena (só GM). Atores removidos do elenco também saem de `activeCast`. Emite `stage.castRosterChanged` |
| `ping` | `{ timestamp? }` | Mede latência — servidor responde `pong` pro remetente e rebroadcasta `ping` pra sala do world |
| `canvas.ping` | `{ ...dados do marcador }` | Ping visual compartilhado (Ctrl+click) |
| `canvas.floatingText` | `{ x, y, text, color, options }` | Texto ou número de dano flutuante, relayado pra sala do world como está |
| `combat.animation` | `{ ...dados da animação }` | Sinal de animação de combate, relayado pra sala do world como está |
| `tile.effect` | `{ tileId, actionIndex, tokenId? }` | Executa a ação de um tile. O servidor lê a ação no banco e envia `tile.triggered` aos outros sockets do world, escolhidos pelo `recipient` da ação: `all` alcança todos; `gm` e `trigger+gm` alcançam só sockets de GM (quem enviou nunca é alvo). Ações `show-dialog` com `journalId` também são filtradas pelo ownership desse journal. Com limite de taxa (bucket de movimento compartilhado) |
| `user.cursor` | `{ stageId, x, y }` | Posição de cursor de alta frequência — relayado pra sala da stage, excluindo o remetente, nunca persistido |
| `module.*` / `system.*` / `socket.*` | qualquer | Relay customizado, igual à seção acima |

## Notas

- **Documentos com campos embarcados (`ChildrenField`, ex: `items` no Actor) sempre chegam populados em `*.updated`** — `Document.update()` (core) popula esses campos antes de fazer o `Signal.broadcast`, então nunca vem com `items: undefined`/faltando por engano. Um array vazio no payload é um valor real (último filho removido), não "não populado" — quem escuta o evento e faz merge do estado local precisa tratar `undefined` e `[]` como coisas diferentes.
- `_socketId` num payload é usado pra exclusão do remetente (evitar eco). O servidor remove o campo antes de enviar `cast.updated` e `token.moved`, então o cliente nunca o recebe.
- Eventos com Signal mas **sem relay WS nenhum** (sem `Signal.listen()` pra eles em `server/index.ts`, então `wsClient.on(...)` nunca vai disparar): `bug-report.*`, `campaign.*`, `zone.*`, `compendium.sourceFolderChanged`, `compendium.sourceLockChanged`, `operation.progress`, e os eventos genéricos `<tableName>.*` de tabelas sem relay (por exemplo `settings.*`, `module_settings.*`, `walls.*`, `drawings.*`). `fog.*` é relayado (ver a tabela de canvas).
- **CODE ISSUE:** `client/components/card-progress.ts` (e um comentário em `client/screens/setup-hub/worlds-tab.ts`) escuta `operation.progress`, mas não existe `Signal.listen('operation.progress')`, então esses listeners nunca disparam. `compendium.sourceFolderChanged` e `compendium.sourceLockChanged` têm o mesmo problema: o cliente escuta e ninguém repassa.
- **Público dos eventos da sala do world:** os relays filtram pelo `ownership` de cada documento e por um nível padrão de permissão. Quando o mapa de ownership está vazio, vale o padrão: `0` significa que só sockets de GM recebem o evento (`deck.*`, `combat.*`, `item.*` sem ownership); `1` significa que todo jogador do world recebe. `actor.*` e `journal.*` também redigem o payload pra jogadores Limitados. Tokens `cast.*` com `hidden: true` vão só pra sockets de GM.
- `world.deactivated` é a exceção ao escopo de sala: vai pra todo socket conectado e desconecta todo usuário conectado, inclusive de outros worlds.
- A maioria dos broadcasts tem **escopo de sala**, não são de verdade globais, apesar do helper do lado do servidor se chamar `broadcastToAll()` — ele resolve `worldId`/`stageId` a partir do payload e roteia via `broadcastToWorld`/`broadcastToStage`, só caindo pra um broadcast de verdade pra todo socket quando nenhum dos dois pode ser resolvido.
- `broadcastToWorldOwned()` existe pra documentos com `ownership` por linha (ex: actors) — ele itera os sockets ativos da sala e manda um payload redigido pra quem estiver abaixo do nível de permissão de Dono, em vez de um único `io.to(room).emit(...)`.
- Addons podem disparar eventos customizados via o relay `module.*`/`system.*`/`socket.*` acima, ou coordenar direto por um listener de `Signal` do lado do servidor.
