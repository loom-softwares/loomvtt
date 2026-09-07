/*******************************************************************************
 * LoomVTT
 * client/core/config.ts
 *
 *
 * Global engine configuration object, exposed as `window.CONFIG`/`Loom.config`.
 * Same idiom as `const.ts`: converted systems write properties here in their
 * own `init`; the core creates the object before any system loads.
 * Member list cross-checked against the public reference API docs this
 * project stays compatible with (21/08/2026).
 *
 * ⚠️ (25/08/2026) The `.planning/config-const-parity-checklist.md` previously cited here
 * no longer exists (deleted or never committed) — only the `ui` section (below) was
 * truly re-audited (wired vs. decorative vs. missing); the rest of the object
 * (documentClass/dataModels per type, WebRTC, controlIcons, etc.) does not have
 * updated confirmation of what is real behavior vs. just storage.
 ******************************************************************************/

import { statusEffectRegistry } from './status-effect-registry.js';

export const LOOM_CONFIG = {
  Actor: { documentClass: null as any, dataModels: {} as Record<string, any> },
  Item: { documentClass: null as any, dataModels: {} as Record<string, any> },
  // `documentClass` read by `usersCollection.load()` — calls the registered
  // class's `prepareDerivedData()` on each `LiveUser`, same pattern as Actor/Item.
  User: { documentClass: null as any, dataModels: {} as Record<string, any> },
  ChatMessage: {
    documentClass: null as any,
    // LoomVTT chat does not use file template — it is rendered by
    // TS function (`renderMessage` in screens/game-hud/chat-message-card.ts,
    // exposed as `window.Loom.wraps.renderMessage`). There is no path to point to.
    template: null as any,
    modes: {} as Record<string, any>,
  },
  // The document types below only have a storage slot — no `Live*` wrapper
  // class exists yet for them (unlike Actor/Item/User/ChatMessage), so
  // `documentClass` is accepted without error but its lifecycle methods are
  // never invoked. Wiring one means adding a real `Live<Type>` class first,
  // same shape as `LiveActor`/`LiveUser` — tracked in
  // `.planning/config-const-parity-checklist.md`, done on demand.
  //
  // Key names below are Loom's OWN names everywhere Loom actually has a
  // distinct concept — this is a native engine, not an emulator, and
  // converted-system code is expected to adapt to Loom's naming, not the
  // other way around (corrected 21/08/2026, just not applied to CONFIG until now). Where Loom has no
  // distinct concept (Macro, Folder, RollTable, Combat, Actor, Item...) the
  // plain English name is kept, since there's nothing Loom-specific to say.
  Macro: { documentClass: null as any, dataModels: {} as Record<string, any> },
  // JournalEntry -> Journal: internal name across the codebase (`/api/journals`,
  // `journalCollection`), never "JournalEntry".
  Journal: { documentClass: null as any, dataModels: {} as Record<string, any> },
  JournalEntryCategory: { documentClass: null as any, dataModels: {} as Record<string, any> },
  JournalPage: { documentClass: null as any, dataModels: {} as Record<string, any> },
  Folder: { documentClass: null as any, dataModels: {} as Record<string, any> },
  RollTable: { documentClass: null as any, dataModels: {} as Record<string, any> },
  TableResult: { documentClass: null as any, dataModels: {} as Record<string, any> },
  Playlist: { documentClass: null as any, dataModels: {} as Record<string, any> },
  PlaylistSound: { documentClass: null as any, dataModels: {} as Record<string, any> },
  Combat: { documentClass: null as any, dataModels: {} as Record<string, any> },
  Combatant: { documentClass: null as any, dataModels: {} as Record<string, any> },
  CombatantGroup: { documentClass: null as any, dataModels: {} as Record<string, any> },
  // Scene -> Stage: Loom's own name.
  Stage: { documentClass: null as any, dataModels: {} as Record<string, any> },
  Card: { documentClass: null as any, dataModels: {} as Record<string, any> },
  // Cards -> Deck: internal name (`/api/decks`, `sidebar.ts:loadDecks()`).
  Deck: { documentClass: null as any, dataModels: {} as Record<string, any> },
  // Loom's real "Adventure" isn't a document type — it's `type: 'Adventure'` on a
  // Compendium pack (see `compendium.ts`: `POST /:id/adventure-entry` bundles selected
  // actors/items/stages/journals/macros/playlists into one entry, `.../import` recreates
  // them in the world). This slot stays only so a converted system's `CONFIG.Adventure = {...}`
  // registration doesn't throw — nothing reads `documentClass`/`dataModels` here.
  Adventure: { documentClass: null as any, dataModels: {} as Record<string, any> },
  // FogExploration -> FogReveal: internal name (`/api/fog-reveals`, `FogRevealsDocument`).
  FogReveal: { documentClass: null as any, dataModels: {} as Record<string, any> },
  // Scene-embedded placeables — a canvas-driven pattern (not WorldCollection-
  // driven). Loom's canvas placeable classes (`client/canvas/`) don't read
  // these yet.
  // ActiveEffect -> Buff: internal name (`items.schema.ts` effects -> `buffs` table).
  Buff: { documentClass: null as any, dataModels: {} as Record<string, any> },
  // ActorDelta has no separate document in Loom — an unlinked Cast member's
  // own `systemData` already IS the per-token override.
  // Kept as its own slot only so a converted system's registration doesn't
  // silently no-op; named for what it actually is here.
  CastOverride: { documentClass: null as any, dataModels: {} as Record<string, any> },
  AmbientLight: { documentClass: null as any, dataModels: {} as Record<string, any> },
  // AmbientSound -> Noise: internal name (`/api/noises`, `noise-config-window.ts`).
  Noise: { documentClass: null as any, dataModels: {} as Record<string, any> },
  Drawing: { documentClass: null as any, dataModels: {} as Record<string, any> },
  Note: { documentClass: null as any, dataModels: {} as Record<string, any> },
  // No Region/RegionBehavior slot: Loom has no separate document for this —
  // the same practical need (trigger on enter/exit, teleport, etc.) is
  // covered by Active Tiles (`TileTrigger`/`TileAction` embedded in `Tile`),
  // which already has its own slot below. Adding a dead slot just to mirror
  // an external reference shape would be exactly the kind of "pautar no
  // sistema" this rename is correcting.
  Tile: { documentClass: null as any, dataModels: {} as Record<string, any> },
  // Token -> Cast: Loom's own name.
  Cast: { documentClass: null as any, dataModels: {} as Record<string, any> },
  Wall: { documentClass: null as any, dataModels: {} as Record<string, any> },
  Level: { documentClass: null as any, dataModels: {} as Record<string, any> },

  // Misc display/canvas config — storage slots, not wired to Loom's own
  // rendering pipeline (which doesn't read these for now).
  controlIcons: {} as Record<string, any>,
  cursors: {} as Record<string, any>,
  canvasTextStyle: {} as Record<string, any>,
  weatherEffects: {} as Record<string, any>,
  soundEffects: {} as Record<string, any>,
  sounds: {} as Record<string, any>,
  WebRTC: {} as Record<string, any>,
  Canvas: {} as Record<string, any>,
  ux: {} as Record<string, any>,
  fontDefinitions: {} as Record<string, any>,
  defaultFontFamily: 'Signika',
  supportedLanguages: ['en'] as string[],
  compatibility: { mode: 0 },
  debug: {} as Record<string, any>,
  queries: {} as Record<string, any>,
  formulaEditor: {} as Record<string, any>,
  // `Loom.i18n` already exists and is the real implementation — this just
  // exposes the same instance under the name converted systems expect.
  get i18n() {
    return (window as any).Loom.i18n;
  },

  // `config.Dice.rolls/terms` — the wod5e registers `CONFIG.Dice.rolls = [WOD5eRoll]`
  // and `CONFIG.Dice.terms.m = MortalDie` in init. The real dice engine is in
  // `Loom.dice` (dice-registry); keep slots empty here just so the converted
  // registration doesn't break — functional integration (if/use) is checked
  // system by system.
  Dice: { rolls: [] as any[], terms: {} as Record<string, any> },
  // `config.ui.*` — uses Loom's own Sidebar tab ids (`sidebar.ts:SIDEBAR_TABS`),
  // for the same reason as the document types above (corrected 21/08/2026 —
  // this used to mirror an external reference naming for these keys, which
  // was wrong). Every native UI component with a real
  // equivalent decorates itself after rendering (Sidebar tabs+container,
  // MacroHotbar, PlayersList, StageNav, Toolbox, pause overlay, toast, the
  // placeable search — see `client/core/ui-override.ts`): if a class is
  // registered here, it gets instantiated and `._onRender()`'d against the
  // already-rendered element — decorates, never replaces.
  // `decks` = Loom's own "Deck" feature (playing-card decks).
  // `menu` (25/08/2026): Loom's main menu (`client/core/main-menu-registry.ts`) is a real,
  // extensible registry now, but isn't built through this decorate-a-registered-class
  // pattern — nothing would ever read `CONFIG.ui.menu`. Not a missing feature, just a slot
  // this mechanism doesn't apply to.
  // `webrtc`: deliberately not implemented — voice/video is delegated to Discord
  // integration instead of a native WebRTC stack.
  ui: {
    actors: null as any, decks: null as any, chat: null as any, combat: null as any, compendium: null as any,
    controls: null as any, hotbar: null as any, items: null as any, journals: null as any, macros: null as any,
    nav: null as any, notifications: null as any, pause: null as any, placeables: null as any,
    players: null as any, playlists: null as any, stages: null as any, settings: null as any, sidebar: null as any,
    tables: null as any,
  },
  // `CONFIG.statusEffects = [...]` (bulk array idiom) bridges to the
  // real registry (`Loom.statusEffects` = `statusEffectRegistry`) instead of
  // being a dead slot: each entry is translated (`name`->`label`, `img`->`icon`)
  // and registered one by one. Reading it returns the registry's current list.
  get statusEffects(): any[] {
    return statusEffectRegistry.getAll();
  },
  set statusEffects(list: any[]) {
    for (const entry of list ?? []) {
      statusEffectRegistry.register({
        id: entry.id,
        label: entry.label ?? entry.name ?? entry.id,
        color: entry.color ?? 0x888888,
        icon: entry.icon ?? entry.img,
      });
    }
  },
  // `CONFIG.specialStatusEffects` (role name -> status id, e.g. `{DEFEATED: 'dead'}`)
  // — stored as-is. No canvas/vision code reads this yet (unlike `statusEffects`,
  // there's no equivalent core concept to bridge into today).
  specialStatusEffects: {} as Record<string, any>,
  // `CONFIG.time.worldCalendarClass`/`worldCalendarConfig` — extension point for a
  // custom calendar (own years/months/days/seasons, e.g. a homebrew calendar).
  // Stored only for now: `Loom.time` still runs on the fixed Gregorian
  // `earthCalendar` (see below) until a real calendar engine reads this config —
  // that engine is a separate, larger piece (not built in this pass).
  time: {
    worldCalendarClass: null as any,
    worldCalendarConfig: null as any,
    formatters: {} as Record<string, any>,
  },
};
