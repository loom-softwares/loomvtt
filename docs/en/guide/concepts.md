# Concepts

> Any API documented here can be imported via
> `import { ... } from '/_loom/sdk/index.js'` in addons and systems.

## LoomDocument

Base ORM system for all entities. Exposes automatic CRUD with hooks, schema validation, signals, and ownership control.

```typescript
class LoomDocument {
  static schema: SchemaDefinition;
  static find(filter?): Promise<T[]>;  // filter accepts limit/offset for pagination
  static findById(id): Promise<T | null>;
  static findOne(filter): Promise<T | null>;
  static create(data, context?, opts?): Promise<{ data; error? }>;
  static update(id, data, context?): Promise<{ data; error? }>;
  static delete(id, context?): Promise<{ success; error? }>;
  static count(filter?): Promise<number>;
  static bulkUpdate(filter, updates): Promise<{ count: number; error?: string }>;
  static getFlag(scope, key, id);
  static setFlag(scope, key, value, id, context?);
  static unsetFlag(scope, key, id, context?);
}
```

Each table has its own `LoomDocument` (e.g., `ActorsDocument`, `ItemsDocument`, `CastsDocument`). The schema defines fields, types, and indexes.

### ClientDocument Lifecycle

For entities living in the client (`Actor`, `Item`, etc.), the `ClientDocument` establishes a data preparation chain with four stages to prevent infinite *loops* (where an update triggers a re-render which triggers another update). The complete cycle (`prepareData()`) invokes:

1. `prepareBaseData()`: Base values (innate attributes), before embedded documents.
2. `prepareEmbeddedDocuments()`: Processes items, buffs, and effects.
3. `prepareDerivedData()`: Calculates final data, applying buffs and derivatives (e.g., total Armor). **Warning:** Never call `.update()` here.

During this cycle, the flag `isPreparingData(this)` is true.

**Pagination:** `find()` accepts `limit` and `number` in the filter:
```typescript
const page = await ActorsDocument.find({ worldId, limit: 50, offset: 0 });
```
The values are passed down as query strings in the `GET /api/actors`, `GET /api/items`, `GET /api/cast` endpoints.

**SchemaDefinition:**

```typescript
{
  tableName: string;
  fields: Record<string, FieldType>;
  indexes?: { columns: string[]; unique?: boolean }[];
  primaryKey?: string; // default: 'id'
}
```

## Fields

```typescript
StringField({ required, minLength, maxLength, pattern, enum, default })
NumberField({ min, max, integer, default })
BooleanField({ default })
JSONField<T>({ default })
IdField({ default: randomUUID })
ForeignField({ ref, refKey })       // FK to another table
ChildrenField({ ref, foreignKey })  // has-many (not persisted)
SchemaField<T>({ schema })          // nested object (JSON string)
```

## LoomHooks

Client-side event system. Exposed as `Loom.LoomHooks` and aliased globally as `window.Hooks` for compatibility.

```typescript
LoomHooks.on('actor.created', (actor) => {});
LoomHooks.off('actor.created', handler);
LoomHooks.callAll('actor.created', actorData);
LoomHooks.call('preUpdateActor', actor, changes, context);
```

> **Operation:** `LoomHooks` triggers local client hooks via `call()` (returning `boolean` to allow short-circuiting in pre-hooks) and `callAll()`. On the client, `ClientDocument` fires document hooks (`preUpdateActor`, `updateActor`, `preDeleteActor`, `deleteActor`, etc.) and listens to Socket.IO events relayed from the server (`actors.created`, `actors.updated`, `actors.deleted`, `cast.created`, etc. — naming isn't consistent across entities, see [websocket/events.md](../websocket/events.md)).

Available client-side hooks include:

- Documents: `preUpdateActor`, `updateActor`, `preDeleteActor`, `deleteActor`, `actors.created`, `actors.updated`, `actors.deleted`
- Cast (Tokens): `cast.created`, `cast.updated`, `cast.deleted`, `token.target`
- Chat & Dice: `chat.message`, `chat.roll`, `preRoll`
- Windows & System: `renderWindow`, `closeWindow`, `render<Class>`, `close<Class>`, `init`, `setup`, `ready`

## Release / Engine Version

The environment exposes `game.release` containing the LoomVTT version signature:

```typescript
game.release = { generation: "1", build: 364 };
```

## Signals

Server-side events broadcasted via Socket.IO (room-scoped — see [websocket/overview.md](../websocket/overview.md)). Uses `EventEmitter` internally.

```typescript
Signal.broadcast('cast.created', { data: actor });
Signal.listen('cast.created', (payload) => {});
Signal.deafen('cast.created', handler);
```

Automatically routed to Socket.IO clients when a LoomDocument is created/edited/deleted — but only for Signals that have a matching `Signal.listen()` registered in `server/index.ts`; not every Signal is relayed (see [websocket/events.md](../websocket/events.md)). Addons can also use Signals on the server without any client relay at all.

## Permissions / Ownership

Ownership is stored as JSON in the `ownership` column:

```json
{ "userId": 3 }
```

Levels: `0=none`, `1=limited`, `2=observer`, `3=owner`.

```typescript
isGM(req): boolean           // role >= 4
canView(ownership, defaultPerm, userId): boolean
canEdit(ownership, userId): boolean
buildOwnership(userId): string  // generates { userId: 3 }
```

## Wrappable

Function interception system (libWrapper alternative):

```typescript
const fn = Loom.wrap(myFunction);
const unsub = fn.wrap((original, ...args) => {
  return original(...args);
});
```

## Dialogs

Functions for modal dialogs. Available in the SDK as `showConfirm`, `showPrompt`, `showAlert`, `showToast`, `showSelectDialog`.

```typescript
import { showConfirm, showPrompt, showAlert, showToast, showSelectDialog } from '/_loom/sdk/index.js';
```

```typescript
showConfirm('Are you sure?', 'Do you want to continue?');        // Promise<boolean>
showPrompt('Character name:', 'Gandalf');                        // Promise<string | null>
showAlert('Operation completed');                                // Promise<void>
showToast('Message', 'success');                                 // void (types: info|success|warning|error)

showSelectDialog('Choose Actor', 'Select:', [
  { value: 'gandalf', label: 'Gandalf' },
  { value: 'frodo', label: 'Frodo' },
]);                                                              // Promise<string | null>
```

> **Note:** `showCreatePageDialog` exists internally in `client/components/dialog.ts`
> but is **not** exported by the SDK. It is only available within the internal client context
> (e.g., used by `journal-window.ts`).

## Keybinds

Keyboard shortcuts system. Addons can register, override, and remove shortcuts dynamically.

```typescript
import { keybinds } from '/_loom/sdk/index.js';
```

```typescript
interface KeybindAction {
  id: string;
  label: string;
  description: string;
  defaultKey: string;
  category?: string;
  onPress?: () => void;
}

keybinds.register({
  id: 'my-addon-action',
  label: 'My Action',
  description: 'Does something special',
  defaultKey: 'Ctrl+Shift+X',
  category: 'My Addon',
  onPress: () => console.log('action triggered'),
});

keybinds.unregister('my-addon-action');
keybinds.setBinding('my-addon-action', 'Ctrl+Shift+Y');
keybinds.resetBinding('my-addon-action');
keybinds.resetAll();
```

Supported keys: letters (`A-Z`), numbers (`0-9`), `F1`-`F24`, `Escape`, `Enter`, `Space`, `ArrowUp/Down/Left/Right`, `PageUp`, `PageDown`, `Delete`, `Tab`, `Shift+`, `Ctrl+`, `Ctrl+Shift+`.

Core LoomVTT shortcuts include:

| Shortcut                  | Action             | Description                                |
| ------------------------- | ------------------ | ------------------------------------------ |
| `T`                     | target-cast        | Target/untarget cast member                |
| `Delete`                | delete-selected    | Delete selected                            |
| `Escape`                | cancel-or-close    | Cancel tool or close top window            |
| `Ctrl+A`                | select-all         | Select all visible cast members            |
| `Shift+C`               | focus-chat         | Focus chat input                           |
| `PageUp` / `PageDown` | zoom-in/zoom-out   | Canvas zoom                                |
| `Ctrl+Arrow`            | pan-*              | Move camera                                |
| `Arrow`                 | move-*             | Move cast member 1 cell                    |
| `Q` / `E`             | rotate-ccw/rotate-cw | Rotate cast member 45°                     |
| `Space`                 | toggle-pause       | Pause/resume world (GM)                    |

## Templates

Handlebars for sheet rendering:

```typescript
// renderTemplate/loadTemplates are not exports from the SDK package — they are globals on
// the window.Loom facade, exposed by the client at runtime.
const html = await Loom.renderTemplate('path/to/template.hbs', { data });
```

> **Note:** Templates are plain Handlebars files with the `.hbs` extension — there is no
> custom extension or rewrite involved.

## i18n

```typescript
// Also via window.Loom, not import — and the API is localize/format, not t/setLocale.
Loom.i18n.localize('actor.name', { name: 'Gandalf' });
Loom.i18n.registerLang('en-US', { actor: { name: '{name}' } });
```
