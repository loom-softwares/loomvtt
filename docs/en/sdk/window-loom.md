# window.Loom (legacy)

> Prefer importing from the SDK (`/_loom/sdk/index.js`) instead of using `window.Loom`.
> The SDK offers the same methods with full typing.

Global API exposed to addons and systems on the client side.

```typescript
(window as any).Loom = {
  LoomHooks,
  windowManager,
  api,
  showToast,
  showConfirm,
  showPrompt,
  showAlert,
  sheets: sheetCatalog,
  systems: systemRegistry,
  dice: diceRegistry,
  keybinds: keybindManager,
  applications: {
    ux: {
      TextEditor: {
        enrichHTML,
        truncateText,
        previewHTML,
        createBylines,
        _uploadImage,
      }
    }
  },
  renderTemplate,
  loadTemplates,
  debounce,
  throttle,
  DragDrop,
  fields,
  rolls: {
    resolveFormula,
    resolveActionFormulas,
    sumPaths,
    getActiveModifiers,
    collectItemModifiers,
  },
  wrap: createWrappable,
  wraps: {
    get resolveFOVOrigins() { ... },
    renderRollCard: renderRollCardWrap,
    renderMessage: renderMessageWrap,
    renderMacroIcon: renderMacroIconWrap,
  },
  BaseWindow,
  LoomDocumentSheet,
  LoomHandlebarsMixin,
  statusEffects: statusEffectRegistry,
  transitions: transitionEffectRegistry,
  get three() { return import('three'); },
  get cannon() { return import('cannon-es'); },
};
```

## Properties

| Property                       | Type                                             | Description                                                            |
| ------------------------------ | ------------------------------------------------ | ---------------------------------------------------------------------- |
| `LoomHooks`                  | `HooksRegistry`                                | Event system (on/off/callAll)                                    |
| `config`                     | `object`                                       | Mirrored as `window.CONFIG` — see `config.md`                       |
| `windowManager`              | `WindowManager`                                | Window manager (open/focus/close/closeTopmost/get/getAll)      |
| `LoomFormData`               | `class LoomFormData`                           | Serializes `[name]` from a form into a structured object (`:` delimiter for nesting) |
| `LoomSidebarTab`             | `class LoomSidebarTab`                         | Customizable sidebar panel base — see `sidebar-tabs.md`          |
| `applications.sidebar.tabs`  | `{ ActorDirectory, ChatLog, CompendiumDirectory, Settings }` | Ready subclasses of `LoomSidebarTab`, one per panel — see `sidebar-tabs.md` |
| `api`                        | `{ get, post, put, delete }`                   | REST Client                                                           |
| `showToast`                  | `(msg, type?) => void`                         | Toast notification                                                    |
| `showConfirm`                | `(title, msg) => Promise<boolean>`             | Confirmation dialog                                              |
| `showPrompt`                 | `(message, default?) => Promise<string\|null>`  | Input dialog                                                      |
| `showAlert`                  | `(message) => Promise<void>`                   | Alert dialog                                                     |
| `sheets`                     | `SheetCatalog`                                 | Sheet catalog                                                    |
| `systems`                    | `SystemRegistry`                               | RPG systems registry                                            |
| `applications.ux.TextEditor` | `TextEditor`                                   | Text and HTML enrichment utilities (e.g. `@Embed`, `[[/roll]]`) |
| `debounce`                   | `(fn, delay) => fn`                            | Limits the execution of a function in time                           |
| `throttle`                   | `(fn, delay) => fn`                            | Limits the execution frequency of a function                     |
| `DragDrop`                   | `class LoomDragDrop`                           | Utility to manage native drag-and-drop operations        |
| `fields`                     | `Object`                                       | Data fields API (StringField, NumberField, etc)                        |
| `dice`                       | `DiceRegistry`                                 | Dice expressions registry (visual/face — see `dice.md`)       |
| `keybinds`                   | `KeybindRegistry`                              | Keyboard shortcuts registry                                         |
| `renderTemplate`             | `(path, data) => Promise<string>`              | Compiles a Handlebars (`.hbs`) template                               |
| `loadTemplates`              | `(paths[]) => Promise<void>`                   | Preloads template partials                                      |
| `rolls.resolveFormula`       | `(formula, actorData) => string`               | Replaces `@ref` with numeric value                                  |
| `rolls.sumPaths`             | `(paths[], actorData) => number`               | Sums several actor fields (pool assembly)                        |
| `rolls.getActiveModifiers`   | `(modifiers, selectors[], context) => number`  | Sums active item bonuses by selector (see `dice.md`)               |
| `rolls.collectItemModifiers` | `(items[]) => ItemModifier[]`                  | Collects `systemData.bonuses` from actor items                        |
| `wrap`                       | `(fn) => Wrappable`                            | Creates a wrapping point                                                 |
| `wraps.resolveFOVOrigins`    | `function`                                     | Canvas FOV wrap point                                               |
| `wraps.renderRollCard`       | `function`                                     | Chat roll card wrap point (see `wrappable.md`)               |
| `wraps.renderMessage`        | `function`                                     | HTML wrap point for any chat message                        |
| `wraps.renderMacroIcon`      | `function`                                     | Icon wrap point for each macro hotbar slot                  |
| `BaseWindow`                 | `class`                                        | Window base class — addon extends to create its own sheet        |
| `LoomDocumentSheet`          | `class`                                        | Sheet base with automatic data-binding                             |
| `LoomHandlebarsMixin`        | `function`                                     | Mixin `(Base) => class` — render via `static PARTS`/`TABS`       |
| `statusEffects`              | `StatusEffectRegistry`                         | Conditions registry (see `status-effects.md`)                     |
| `transitions`                 | `TransitionEffectRegistry`                     | Scene transition effects registry (see `transitions.md`)          |
| `three`                      | `Promise<typeof import('three')>` (getter)     | Loads Three.js on demand — only downloads the chunk if an addon accesses it  |
| `cannon`                     | `Promise<typeof import('cannon-es')>` (getter) | Loads cannon-es on demand, same logic                           |
| `user`                       | `{ id, name, color, role, isGM, targets }` (getter) | Current user session + `targets` (own getter): cast members currently targeted by them — see example below |

## Usage example in addon

```js
// Register hook
Loom.LoomHooks.on('actor.created', (actor) => {
  console.log('Actor created:', actor.name);
});

// Create window
await Loom.windowManager.open('my-window', MyWindowClass, { data: {} });

// Call API
const data = await Loom.api.get('/cast');

// Function wrap
const wrapped = Loom.wrap(myFunction);
wrapped.wrap((original, ...args) => {
  console.log('intercepted');
  return original(...args);
});

// Register a custom condition
Loom.statusEffects.register({ id: 'frenzy', label: 'Frenzy', color: 0xaa0000 });

// Load Three.js/cannon-es only when needed (e.g. 3D dice addon)
const THREE = await Loom.three;
const CANNON = await Loom.cannon;

// Read who the current user is targeting (e.g. pre-fill roll
// difficulty based on target NPC). targets is derived from `targetedBy` on the cast
// member — no need to fetch anything, it comes already populated.
const target = Loom.user.targets[0];
if (target) {
  console.log('Targeting:', target.name, 'difficulty:', target.systemData?.difficulty);
}

// React in real time when the target changes (triggers for ANY player who
// targets/untargets, not just you — filter by targetedBy if applicable)
Loom.LoomHooks.on('targetToken', ({ castId, targetedBy }) => {
  console.log('Cast', castId, 'is now targeted by', targetedBy);
});
```
