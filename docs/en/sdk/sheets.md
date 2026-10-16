# Sheet Catalog (`sheet-catalog.ts`)

Sheet catalog (Actor/Item sheets). Addons register their custom sheets here.

```typescript
import { sheets } from '/_loom/sdk/index.js';
```

## API

```typescript
sheets.catalog(docType: string, typeName: string, SheetClass): void
sheets.get(docType: string, typeName?: string): SheetConstructor | undefined
```

## Example

```typescript
import { MyActorSheet } from './sheets/my-actor-sheet.js';

// Register custom sheet
sheets.catalog('actor', 'character', MyActorSheet);

// Retrieve
const Sheet = sheets.get('actor', 'character');
// If typeName is not found, fallbacks to '*'
```

The core catalog falls back to the `'*'` entry. The SDK's `sheets.get()` adds one more fallback: if nothing matches, `actor` returns `LoomActorSheet` and `item` returns `LoomItemSheet` (`packages/sdk/src/index.ts`).

## LoomDocumentSheet

All sheets extend `LoomDocumentSheet`:

```typescript
abstract class LoomDocumentSheet<DocType> extends BaseWindow {
  protected abstract get documentName(): string; // e.g.: 'actor'
  protected abstract get apiRoute(): string;      // e.g.: '/actors'
  protected get dataKey(): string; // default: 'systemData' if documentName === 'actor', else 'data'
}
```

- `dataKey` has a default value (no need to override unless your document
  stores the system payload in a different key) — `'systemData'` for actor,
  `'data'` for any other `documentName`.
- **Fetch flow:** upon mounting, `loadDocument()` reads `this.options.documentId`; if
  empty, fetches nothing (sheet opens blank). If present, performs
  `GET {apiRoute}/{documentId}?populate=true` (`populate` is required so `ChildrenField` items
  come back) and stores the result in `this.document`, already passed through `prepareData()`:
  the active system's `prepareData(row)` first (if registered), then the document's own
  `prepareData()` from the registered `documentClass` (see `globals.md#prepareData`).
- **`documentId` is not the prop passed by the caller** — it's an internal field that
  YOUR class's `super()` needs to populate from whatever prop you chose
  (the native convention is `actorId`/`itemId`, but it's up to you in your constructor):
  ```typescript
  constructor(props: { itemId: string }) {
    super({ id: `item-sheet-${props.itemId}`, documentId: props.itemId, title: '...' });
  }
  ```
- **`apiRoute` and item sheets:** `LoomItemSheet` (abstract in the SDK typings) reads and saves through
  `${apiRoute}/${id}`. Its default is `/items`, and `_apiRouteOverride` replaces it. Keep the world route `/items`
  for embedded items too. `GET /api/actors/:actorId/items/:itemId` does not exist, so an override to the actor's
  item route makes the sheet fail with 404. Item sheets fetch without `?populate=true`.
- **Window ID:** no single convention is enforced by the engine — just needs to be
  stable and unique per document (if opening the same sheet twice with the same id,
  `windowManager.open` focuses the existing one instead of opening another). Native code uses
  the document's raw id (`windowManager.open(id, SheetClass, { itemId: id })`); third-party
  sheets tend to prefix (`item-sheet-${id}`) — both work.

## Opening a sheet from a token

Clicking a token that has an `actorId` opens the actor sheet with only `{ actorId, worldId }`, for linked and
unlinked tokens alike. The window id is `actor-sheet-<actorId>` (one window per actor). An unlinked token's own
`systemData` snapshot (see `api/cast.md`) is therefore not shown or edited there, and the sheet writes to the actor.

## How to programmatically open the sheet (own or another document's)

There is no `openItemSheet()`/`openSheet()` helper — the standard is to combine
`sheets.get()` (to find the right class, including fallback) with
`windowManager.open()`:

```typescript
import { sheets, windowManager } from '/_loom/sdk/index.js';

function openItemSheet(item: { id: string; type: string }) {
  const SheetClass = sheets.get('item', item.type) || sheets.get('item', '*');
  if (!SheetClass) return; // no sheet registered for this type, nor fallback
  windowManager.open(`item-sheet-${item.id}`, SheetClass, { itemId: item.id });
}
```

If your own sheet is already registered via `sheets.catalog(...)`, `sheets.get()`
returns itself — no extra logic needed to "open my own sheet".

## LoomHandlebarsMixin & Converted Sheet Rendering

Sheets utilizing the Handlebars mixin (`LoomHandlebarsMixin`) or converted system sheets feature strict lifecycle guarantees:

1. **Single Render Engine:** The rendering engine resides exactly once in the inheritance chain, ensuring `_onRender()` and `_postRender()` execute **once** per render cycle without duplicate execution.
2. **`update()` Loop Guard:** `ClientDocument` guards against recursive `this.update()` calls triggered inside `prepareData()` or `prepareDerivedData()` via an internal `_preparingDataDepth` guard. Changes assigned during data preparation apply locally without sending duplicate HTTP/WebSocket requests.
3. **Canvas Input Debounce:** Continuous inputs interacting with canvas state or numeric sliders must use a 300ms debounce before persisting updates to the server.
