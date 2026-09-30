# Configuration — Global `CONFIG` (`Loom.config`)

Configuration object that converted systems populate in their own `init` to
customize behavior: the **core creates the object before**
any system loads, the system only writes properties to it. Exposed as
`window.CONFIG` (loose global, `main.ts:569`) and as `Loom.config`.

Source: `client/core/config.ts` (`LOOM_CONFIG`), imported and assigned in
`client/main.ts` — same pattern as `const.ts`/`CONST_VALUES`.

> **Not every key is "wired" to actual behavior.** Some are just a place
> to store the value (doesn't break the system's assignment, but nothing in the core reads it
> later) — it's marked below which is which. See `.planning/config-const-parity-checklist.md`
> for full tracking, updated as more things are wired.

## Document types

> **Nomenclature (fixed 08/21/2026): the keys use the LOOM name**,
> whenever Loom has a distinct concept of its own — same rule
> that already applied to `Scene → Stage`/`Token → Cast` in the rest of the code, 
> except it hadn't been applied to `CONFIG` before. A converted
> system doesn't "lock" the name — whoever ports a system to Loom adapts its
> code to Loom's name, not the other way around. Correspondence table with
> the origin name (for anyone porting a system and needing to know where
> each key went):
>
> | Origin Name                  | Actual Key in Loom                             |
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
> | `Region`/`RegionBehavior` | (no key — covered by `Tile`, see below) |

Each type has `{ documentClass, dataModels }`. `dataModels` registers the schema by
subtype (`vampire`, `weapon`, etc.) — **actually works** for `Actor`/`Item`.
`documentClass` registers a class whose `prepareDerivedData()` is called in the
document lifecycle — works for 4 types that have an actual `Live<Type>` class
in the core; the rest just store the value (no `Live*` class yet to call).

| Type                                                                                                                                                       | Does `documentClass` wire to anything?                                                                                                                                                                                                                                                                                                                                                 |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Actor`                                                                                                                                                  | ✅ `LiveActor.prepareData()` (`actors-collection.ts`)                                                                                                                                                                                                                                                                                                                        |
| `Item`                                                                                                                                                   | ✅ `LiveItem.prepareData()` (`items-collection.ts`)                                                                                                                                                                                                                                                                                                                          |
| `User`                                                                                                                                                   | ✅ `LiveUser.prepareData()` (`users-collection.ts`)                                                                                                                                                                                                                                                                                                                          |
| `ChatMessage`                                                                                                                                            | ✅ `LiveMessage.prepareData()` (`messages-collection.ts`) — `template`/`modes` do not wire to anything, Loom renders chat via `Loom.wraps.renderMessage`, not by file template                                                                                                                                                                                    |
| `Macro`, `Folder`, `RollTable`, `TableResult`, `Playlist`, `PlaylistSound`, `Journal`, `JournalPage`, `Combat`, `Combatant`, `Stage` | ✅ calls `prepareDerivedData()` of the registered class when loading the collection/embedded                                                                                                                                                                                                                                                                                          |
| `Cast`, `Tile`, `Wall`, `Drawing`, `AmbientLight`, `Note`                                                                                      | ✅ calls `prepareDerivedData()` per placeable when loading the Stage (`scenes-collection.ts`)                                                                                                                                                                                                                                                                                   |
| `Buff`                                                                                                                                                   | ✅ calls `prepareDerivedData()` per embedded effect in `item.effects`/"buffs" (`items-collection.ts`)                                                                                                                                                                                                                                                                      |
| `CastOverride`                                                                                                                                           | ✅ calls `prepareDerivedData()` on each unlinked cast member (`isLinked===false`) — `CLAUDE.md` rule 6, it's not a separate document, it's the `systemData` of the cast itself                                                                                                                                                                                         |
| `Level`                                                                                                                                                  | ✅ calls `prepareDerivedData()` per level when loading the Stage — real feature (`stages.schema.ts` `levels`, tabs in `stage-nav.ts`)                                                                                                                                                                                                                                     |
| `JournalCategory`, `CombatantGroup`                                                                                                                    | ⚠️ only stores the value — Loom does not have this subresource implemented                                                                                                                                                                                                                                                                                                           |
| `Noise`                                                                                                                                                  | ✅ calls `prepareDerivedData()` per item when loading stage noises (`game-hud.ts:loadStageNoises()`, route `/api/noises`)                                                                                                                                                                                                                                                |
| `Region`/`RegionBehavior` (origin concept)                                                                                                          | not a gap, doesn't have its own key — covered by `Tile` (`TileTrigger`/`TileAction`: teleport, visibility toggle, play sound, dialog, etc.)                                                                                                                                                                                                                      |
| `Card`, `Deck`                                                                                                                                         | ✅ calls `prepareDerivedData()` per deck/card when loading "Decks" (`sidebar.ts:loadDecks()`, route `/api/decks`)                                                                                                                                                                                                                                                        |
| `FogReveal`                                                                                                                                              | ✅ calls `prepareDerivedData()` on the result of `loadFogReveals()` (`canvas-manager.ts`, route `/api/fog-reveals`, by stage+user). Separate bug fixed in the same session: fog exploration wasn't running in a scene with `darknessLevel=0` (new scene default) — `fovEnabled` incorrectly depended on darkness>0, not just on `tokenVision` (`fog-layer.ts`) |
| `Adventure`                                                                                                                                              | ⚠️ entire feature doesn't exist in Loom yet (no API/collection) — it's a full adventure compendium, future open decision                                                                                                                                                                                                                                          |

> **Correction (08/21/2026):** `Setting` and `MeasuredTemplate` were removed —
> checked against the actual list of members of the reference format
> (pasted by the user), neither actually exists there. They were an incorrect assumption
> from a previous session, should never have been documented.

```js
// Works: schema by subtype
Object.assign(CONFIG.Actor.dataModels, { vampire: VampireDataModel });

// Works: prepareDerivedData called when document loads
CONFIG.Actor.documentClass = MyActor; // class MyActor { prepareDerivedData() {...} }

// Only stores, doesn't trigger anything:
CONFIG.Combat.documentClass = MyCombat;
```

## Data/rolling

`CONFIG.Dice.rolls`/`.terms` — actual dice engine is `Loom.dice` (dice-registry);
these slots exist only so as not to break system assignment, but they don't feed
the actual engine.

## UI / Sidebar

`CONFIG.ui.*` uses the actual IDs of the Loom `Sidebar` tabs (`decks`, `journals`,
`stages`, not `cards`/`journal`/`scenes` — same nomenclature correction
as above). All native UI components with an actual equivalent in
Loom follow the same additive pattern: after rendering the native template, if
`CONFIG.ui.<key>` has a class with `_onRender()`, it instantiates and calls it
passing the already rendered element as `element` — **decorates**, never replaces,
the native template always runs the same whether it has a registration or not.

| Key                                                                                                                                                 | Actual Loom component                                                                                                                                                                                                                                              | Status                                                                                                                                                                                            |
| ----------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `actors`, `decks`, `chat`, `combat`, `compendium`, `items`, `journals`, `macros`, `playlists`, `stages`, `settings`, `tables` | `Sidebar` tabs (`sidebar.ts:onRender()`)                                                                                                                                                                                                                       | ✅                                                                                                                                                                                                |
| `hotbar`                                                                                                                                            | `MacroHotbar` (`macro-hotbar.ts`)                                                                                                                                                                                                                                | ✅                                                                                                                                                                                                |
| `players`                                                                                                                                           | `PlayersList` (`players-list.ts`)                                                                                                                                                                                                                                | ✅                                                                                                                                                                                                |
| `nav`                                                                                                                                               | `StageNav` (`stage-nav.ts`)                                                                                                                                                                                                                                      | ✅                                                                                                                                                                                                |
| `controls`                                                                                                                                          | `Toolbox` (`toolbox.ts`)                                                                                                                                                                                                                                         | ✅                                                                                                                                                                                                |
| `pause`                                                                                                                                             | `#hud-pause-overlay` overlay (`game-hud.ts:showPauseBanner()`)                                                                                                                                                                                                    | ✅                                                                                                                                                                                                |
| `notifications`                                                                                                                                     | Toast (`components/toast.ts:showToast()`)                                                                                                                                                                                                                          | ✅                                                                                                                                                                                                |
| `sidebar`                                                                                                                                           | Entire `Sidebar` container (`sidebar.ts:onRender()`)                                                                                                                                                                                                          | ✅ — separate hook from the 12 tabs, scope is the entire sidebar element                                                                                                                       |
| `menu`                                                                                                                                              | Not a separate component — the "Game Menu" content (return to setup, etc.) already lives inside the `settings` tab (`data-action="return-to-setup"`), covered by `ui.settings`                                                                     | covered indirectly, no own key                                                                                                                                                         |
| `placeables`                                                                                                                                        | No longer a `CONFIG.ui.*` hook — became the native "Elements" tab of the `Sidebar` itself (`sidebar.ts:renderPlaceablesTab()`, **new, original feature**): lists tokens (grouped Player/Non-Player Character), lights, walls, tiles, notes and drawings of the active scene, with search; click centers the camera (`canvasManager.panToPoint`) | ✅ (08/22/2026) — no own key in `CONFIG.ui`, it's a fixed tab just like Chat/Actors/Items                                                                                                          |
| `webrtc`                                                                                                                                            | —                                                                                                                                                                                                                                                                   | ❌ confirmed absent: Loom has no video/voice call (the only hit for "webrtc" in the code is `getCameraView()` in `canvas-manager.ts`, which is canvas pan/zoom, completely unrelated) |

Shared helper: `client/core/ui-override.ts` (`applyUiOverride(key, element, context)`).

## Status effects / time

- `CONFIG.statusEffects = [...]` — **actually works**: bridge to
  `Loom.statusEffects` (`statusEffectRegistry.register()`), translating
  `name`→`label`/`img`→`icon` per entry. Reading `CONFIG.statusEffects` returns the
  current registry list.
- `CONFIG.specialStatusEffects` — only stores the value, no canvas/vision code
  reads it yet.
- `CONFIG.time.worldCalendarClass`/`.worldCalendarConfig`/`.formatters` — slot
  prepared for a customizable calendar engine (years/months/days/seasons,
  leap year), which **has not been built yet**. `Loom.time.earthCalendar` remains
  fixed (Gregorian, without these features) until this engine exists.

## Text / i18n

- `CONFIG.TextEditor.enrichers` — **actually works**: `.push(fn)` feeds an
  array that is actually iterated in enrichHTML.
- `CONFIG.i18n` — getter that returns the same `Loom.i18n` instance, does not duplicate.
- `fontDefinitions`, `defaultFontFamily`, `supportedLanguages`, `compatibility`,
  `debug` — only store a reasonable default value, without an actual consumer yet.

## Miscellaneous (only store value, no consumer in core)

`controlIcons`, `cursors`, `canvasTextStyle`, `weatherEffects`, `soundEffects`,
`sounds`, `WebRTC`, `MeasuredTemplate`, `Canvas`, `ux`, `queries`, `formulaEditor`.

## Out of scope (deliberately does not exist)

`DatabaseBackend` (origin server-side concept, makes no sense on the Loom
client), wall door animation/sound, canvas weather system, scene transition
— Loom doesn't have these subsystems today; adding an empty slot wouldn't help
at all until the subsystem itself exists.
