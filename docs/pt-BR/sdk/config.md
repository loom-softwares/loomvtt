# Configuração — `CONFIG` global (`Loom.config`)

Objeto de configuração que sistemas convertidos preenchem no próprio `init` pra
customizar comportamento: o **core cria o objeto antes**
de qualquer sistema carregar, sistema só escreve propriedades nele. Exposto como
`window.CONFIG` (global solto, `main.ts:569`) e como `Loom.config`.

Fonte: `client/core/config.ts` (`LOOM_CONFIG`), importado e atribuído em
`client/main.ts` — mesmo padrão de `const.ts`/`CONST_VALUES`.

> **Nem toda chave está "ligada" a comportamento real.** Algumas são só um lugar
> pra guardar o valor (não quebra a atribuição do sistema, mas nada no core lê
> depois) — está marcado abaixo qual é qual. Ver `.planning/config-const-parity-checklist.md`
> pro rastreamento completo, atualizado conforme mais coisa é ligada.

## Tipos de documento

> **Nomenclatura (corrigido 21/08/2026): as chaves usam o nome do LOOM**,
> sempre que o Loom tem um conceito próprio e distinto — mesma regra
> que já valia pra `Scene → Stage`/`Token → Cast` no resto do código, 
> só que antes não tinha sido aplicada em `CONFIG`. Um sistema
> convertido não "trava" o nome — quem porta um sistema pro Loom adapta o
> código dele pro nome do Loom, não o contrário. Tabela de correspondência com
> o nome de origem (pra quem tá portando um sistema e precisa saber pra onde
> foi cada chave):
>
> | Nome de origem               | Chave real no Loom                             |
> | ----------------------------- | ---------------------------------------------- |
> | `Scene`                     | `Stage`                                      |
> | `Token`                     | `Cast`                                       |
> | `Cards`                     | `Deck`                                       |
> | `AmbientSound`              | `Noise`                                      |
> | `FogExploration`            | `FogReveal`                                  |
> | `ActiveEffect`              | `Buff`                                       |
> | `ActorDelta`                | `CastOverride`                               |
> | `JournalEntry`              | `Journal`                                    |
> | `JournalEntryPage`          | `JournalPage`                                |
> | `JournalEntryCategory`      | `JournalCategory`                            |
> | `Region`/`RegionBehavior` | (sem chave — coberto por`Tile`, ver abaixo) |

Cada tipo tem `{ documentClass, dataModels }`. `dataModels` registra o schema por
subtipo (`vampire`, `weapon`, etc.) — **funciona de verdade** pra `Actor`/`Item`.
`documentClass` registra uma classe cujo `prepareDerivedData()` é chamado no
lifecycle do documento — funciona pra 4 tipos que têm uma classe `Live<Tipo>`
própria no core; os demais só guardam o valor (sem classe `Live*` ainda pra chamar).

| Tipo                                                                                                                                                       | `documentClass` liga em algo?                                                                                                                                                                                                                                                                                                                                                 |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Actor`                                                                                                                                                  | ✅`LiveActor.prepareData()` (`actors-collection.ts`)                                                                                                                                                                                                                                                                                                                        |
| `Item`                                                                                                                                                   | ✅`LiveItem.prepareData()` (`items-collection.ts`)                                                                                                                                                                                                                                                                                                                          |
| `User`                                                                                                                                                   | ✅`LiveUser.prepareData()` (`users-collection.ts`)                                                                                                                                                                                                                                                                                                                          |
| `ChatMessage`                                                                                                                                            | ✅`LiveMessage.prepareData()` (`messages-collection.ts`) — `template`/`modes` não ligam a nada, Loom renderiza chat via `Loom.wraps.renderMessage`, não por template de arquivo                                                                                                                                                                                    |
| `Macro`, `Folder`, `RollTable`, `TableResult`, `Playlist`, `PlaylistSound`, `Journal`, `JournalPage`, `Combat`, `Combatant`, `Stage` | ✅ chama`prepareDerivedData()` da classe registrada ao carregar a coleção/embutido                                                                                                                                                                                                                                                                                          |
| `Cast`, `Tile`, `Wall`, `Drawing`, `AmbientLight`, `Note`                                                                                      | ✅ chama`prepareDerivedData()` por placeable ao carregar a Stage (`scenes-collection.ts`)                                                                                                                                                                                                                                                                                   |
| `Buff`                                                                                                                                                   | ✅ chama`prepareDerivedData()` por efeito embutido em `item.effects`/"buffs" (`items-collection.ts`)                                                                                                                                                                                                                                                                      |
| `CastOverride`                                                                                                                                           | ✅ chama`prepareDerivedData()` em cada membro do cast desvinculado (`isLinked===false`) — regra 6 do `CLAUDE.md`, não é documento separado, é `systemData` do próprio cast                                                                                                                                                                                         |
| `Level`                                                                                                                                                  | ✅ chama`prepareDerivedData()` por nível ao carregar a Stage — feature real (`stages.schema.ts` `levels`, abas em `stage-nav.ts`)                                                                                                                                                                                                                                     |
| `JournalCategory`, `CombatantGroup`                                                                                                                    | ⚠️ só guarda o valor — Loom não tem esse subrecurso implementado                                                                                                                                                                                                                                                                                                           |
| `Noise`                                                                                                                                                  | ✅ chama`prepareDerivedData()` por item ao carregar os sons do stage (`game-hud.ts:loadStageNoises()`, rota `/api/noises`)                                                                                                                                                                                                                                                |
| `Region`/`RegionBehavior` (conceito de origem)                                                                                                          | não é gap, não tem chave própria — coberto por`Tile` (`TileTrigger`/`TileAction`: teleporte, toggle de visibilidade, tocar som, diálogo, etc.)                                                                                                                                                                                                                      |
| `Card`, `Deck`                                                                                                                                         | ✅ chama`prepareDerivedData()` por baralho/carta ao carregar "Decks" (`sidebar.ts:loadDecks()`, rota `/api/decks`)                                                                                                                                                                                                                                                        |
| `FogReveal`                                                                                                                                              | ✅ chama`prepareDerivedData()` no resultado de `loadFogReveals()` (`canvas-manager.ts`, rota `/api/fog-reveals`, por stage+usuário). Bug separado corrigido na mesma sessão: exploração de fog não rodava em cena com `darknessLevel=0` (padrão de cena nova) — `fovEnabled` dependia errado de escuridão>0, não só de `tokenVision` (`fog-layer.ts`) |
| `Adventure`                                                                                                                                              | ⚠️ feature inteira não existe no Loom ainda (sem API/coleção) — é um compêndio de aventura completa, decisão futura em aberto                                                                                                                                                                                                                                          |

> **Correção (21/08/2026):** `Setting` e `MeasuredTemplate` foram removidos —
> conferido contra a lista real de membros do formato de referência
> (colada pelo usuário), nenhum dos dois existe de verdade lá. Eram suposição
> errada de uma sessão anterior, nunca deveriam ter sido documentados.

```js
// Funciona: schema por subtipo
Object.assign(CONFIG.Actor.dataModels, { vampire: VampireDataModel });

// Funciona: prepareDerivedData chamado quando o documento carrega
CONFIG.Actor.documentClass = MyActor; // class MyActor { prepareDerivedData() {...} }

// Só guarda, não dispara nada:
CONFIG.Combat.documentClass = MyCombat;
```

## Dados/rolagem

`CONFIG.Dice.rolls`/`.terms` — motor real de dados é `Loom.dice` (dice-registry);
esses slots existem só pra não quebrar a atribuição do sistema, mas não alimentam
o motor de verdade.

## UI / Sidebar

`CONFIG.ui.*` usa os ids reais das abas da `Sidebar` do Loom (`decks`, `journals`,
`stages`, não `cards`/`journal`/`scenes` — mesma correção de
nomenclatura acima). Todos os componentes nativos de UI com equivalente real no
Loom seguem o mesmo padrão aditivo: depois de renderizar o template nativo, se
`CONFIG.ui.<chave>` tiver uma classe com `_onRender()`, instancia e chama
passando o elemento já renderizado como `element` — **decora**, nunca substitui,
o template nativo roda sempre igual quer tenha registro ou não.

| Chave                                                                                                                                                 | Componente real no Loom                                                                                                                                                                                                                                              | Status                                                                                                                                                                                            |
| ----------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `actors`, `decks`, `chat`, `combat`, `compendium`, `items`, `journals`, `macros`, `playlists`, `stages`, `settings`, `tables` | Abas da`Sidebar` (`sidebar.ts:onRender()`)                                                                                                                                                                                                                       | ✅                                                                                                                                                                                                |
| `hotbar`                                                                                                                                            | `MacroHotbar` (`macro-hotbar.ts`)                                                                                                                                                                                                                                | ✅                                                                                                                                                                                                |
| `players`                                                                                                                                           | `PlayersList` (`players-list.ts`)                                                                                                                                                                                                                                | ✅                                                                                                                                                                                                |
| `nav`                                                                                                                                               | `StageNav` (`stage-nav.ts`)                                                                                                                                                                                                                                      | ✅                                                                                                                                                                                                |
| `controls`                                                                                                                                          | `Toolbox` (`toolbox.ts`)                                                                                                                                                                                                                                         | ✅                                                                                                                                                                                                |
| `pause`                                                                                                                                             | Overlay`#hud-pause-overlay` (`game-hud.ts:showPauseBanner()`)                                                                                                                                                                                                    | ✅                                                                                                                                                                                                |
| `notifications`                                                                                                                                     | Toast (`components/toast.ts:showToast()`)                                                                                                                                                                                                                          | ✅                                                                                                                                                                                                |
| `sidebar`                                                                                                                                           | Container inteiro da`Sidebar` (`sidebar.ts:onRender()`)                                                                                                                                                                                                          | ✅ — hook separado do das 12 abas, escopo é o elemento inteiro da sidebar                                                                                                                       |
| `menu`                                                                                                                                              | Não é componente separado — o conteúdo do "Game Menu" (voltar ao setup, etc.) já mora dentro da aba`settings` (`data-action="return-to-setup"`), coberta por `ui.settings`                                                                     | coberto indiretamente, sem chave própria                                                                                                                                                         |
| `placeables`                                                                                                                                        | Não é mais um hook `CONFIG.ui.*` — virou aba nativa "Elementos" da própria `Sidebar` (`sidebar.ts:renderPlaceablesTab()`, **feature nova, original**): lista tokens (agrupados Player/Non-Player Character), luzes, paredes, tiles, notas e desenhos da cena ativa, com busca; clique centraliza a câmera (`canvasManager.panToPoint`) | ✅ (22/08/2026) — sem chave própria em `CONFIG.ui`, é aba fixa igual Chat/Atores/Itens                                                                                                          |
| `webrtc`                                                                                                                                            | —                                                                                                                                                                                                                                                                   | ❌ confirmado ausente: Loom não tem chamada de vídeo/voz (o único hit de "webrtc" no código é`getCameraView()` em `canvas-manager.ts`, que é pan/zoom do canvas, sem relação nenhuma) |

Helper compartilhado: `client/core/ui-override.ts` (`applyUiOverride(key, element, context)`).

## Status effects / tempo

- `CONFIG.statusEffects = [...]` — **funciona de verdade**: bridge pro
  `Loom.statusEffects` (`statusEffectRegistry.register()`), traduzindo
  `name`→`label`/`img`→`icon` por entrada. Ler `CONFIG.statusEffects` retorna a
  lista atual do registry.
- `CONFIG.specialStatusEffects` — só guarda o valor, nenhum código de canvas/visão
  lê ainda.
- `CONFIG.time.worldCalendarClass`/`.worldCalendarConfig`/`.formatters` — slot
  preparado pra um motor de calendário customizável (anos/meses/dias/estações,
  bissexto), que ainda **não foi construído**. `Loom.time.earthCalendar` continua
  fixo (Gregoriano, sem essas features) até esse motor existir.

## Texto / i18n

- `CONFIG.TextEditor.enrichers` — **funciona de verdade**: `.push(fn)` alimenta um
  array percorrido de verdade no enrichHTML.
- `CONFIG.i18n` — getter que retorna a mesma instância de `Loom.i18n`, não duplica.
- `fontDefinitions`, `defaultFontFamily`, `supportedLanguages`, `compatibility`,
  `debug` — só guardam valor default razoável, sem consumidor real ainda.

## Diversos (só guardam valor, sem consumidor no core)

`controlIcons`, `cursors`, `canvasTextStyle`, `weatherEffects`, `soundEffects`,
`sounds`, `WebRTC`, `MeasuredTemplate`, `Canvas`, `ux`, `queries`, `formulaEditor`.

## Fora de escopo (deliberadamente não existe)

`DatabaseBackend` (conceito server-side de origem, não faz sentido no client do
Loom), animação/som de porta de parede, sistema de clima de canvas, transição de
cena — o Loom não tem esses subsistemas hoje; adicionar um slot vazio não ajudaria
em nada até o subsistema em si existir.
