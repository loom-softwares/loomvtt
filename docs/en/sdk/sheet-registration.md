# Sheet Registration — `Actors`/`Items`/`DocumentSheetConfig` (`sheet-registration.ts`)

Compatibility layer that allows registering actor/item sheets in the catalog using the
converted systems' registration API. It is a **side-effect module**: just importing it exposes
the globals `Actors`, `Items`, and `DocumentSheetConfig` on `window` (it doesn't export anything
to import directly).

Source: `client/core/sheet-registration.ts`. Registrations made here end up in the
same catalog exposed at `Loom.sheets` (see `sheets.md`) — it is not a separate registry.

## Exposed globals (side-effect)

| Global | API | Description |
|--------|-----|-----------|
| `window.Actors` | `{ registerSheet(scope, SheetClass, options?) }` | Registers actor sheet |
| `window.Items` | `{ registerSheet(scope, SheetClass, options?) }` | Registers item sheet |
| `window.DocumentSheetConfig` | `{ registerSheet(documentClass, scope, SheetClass, options?) }` | Registers sheet resolving the type from the document class |

```typescript
interface RegisterSheetOptions {
  types?: string[];   // document subtypes; empty/absent = ['*']
  makeDefault?: boolean;
  label?: string;
}

Actors.registerSheet(scope: string, SheetClass: any, options?: RegisterSheetOptions): void;
Items.registerSheet(scope: string, SheetClass: any, options?: RegisterSheetOptions): void;
DocumentSheetConfig.registerSheet(documentClass: any, scope: string, SheetClass: any, options?: RegisterSheetOptions): void;
```

`DocumentSheetConfig.registerSheet` resolves the type by class: compares with the globals
`Actor`/`Item` and, as fallback, by `documentClass.name` lowercased (`'actor'`/`'item'`).
Unknown class logs a warning and registers nothing.

## Example

```js
// Equivalent registration to Actors.registerSheet
Actors.registerSheet('world', MyActorSheet, { types: ['npc'], makeDefault: true });

// Registration by document class (DocumentSheetConfig style)
DocumentSheetConfig.registerSheet(Actor, 'world', MyActorSheet, { types: ['character'] });

// Generic registration — applies to all subtypes
Items.registerSheet('world', MyItemSheet);
```

The registered `SheetClass` must follow the sheet contract (`LoomDocumentSheet` with
`LoomHandlebarsMixin(...)` applied at declaration, see `sheets.md` and `windows.md`).
