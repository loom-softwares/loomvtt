# System Registry (`system-registry.ts`)

System/ruleset registry. Exposed globally as `globalThis.__loomSystemRegistry`.

```typescript
import { SystemRegistry, LoomSystem } from '../applications/systems/system-registry.js';
```

## API

```typescript
SystemRegistry.register(system: LoomSystem): void
SystemRegistry.get(id: string): LoomSystem | undefined
SystemRegistry.getAll(): LoomSystem[]
SystemRegistry.getActive(): LoomSystem | undefined
SystemRegistry.setActive(id: string): void
```

## LoomSystem

```typescript
interface LoomSystem {
  id: string;
  title: string;
  version: string;
  actorTypes: string[];       // e.g.: ['character', 'npc']
  itemTypes: string[];        // e.g.: ['weapon', 'armor', 'spell']
  getDefaultData(type: string): Record<string, any>;
  validateData?(type: string, data: any): { valid: boolean; errors?: string[] };
  prepareData?(actor: any): any;
  /**
   * ⚠️ **Declared in the interface, but NOT invoked by the engine** (checked on client and
   * server — no call site exists). To customize initiative, use `Loom.settings.get(systemId, 'initiativeFormula')`
   * which is resolved with @variables from the flattened systemData. Signature (reference, in case it's ever wired up):
   */
  rollInitiative?(actor: any): { formula: string; total: number } | null;
  getSheetSchema?(actorType: string): SheetSchema | null;
  getItemSheetSchema?(itemType: string): SheetSchema | null;
  /** Raw system CSS — injected once into a `<style id="loom-system-styles">` when the system becomes active. */
  styles?: string;
  changelogUrl?: string;
  wikiUrl?: string;
  bugsUrl?: string;
  licenseNotice?: { title: string; html: string; icon?: string };
}
```

> **Client-side registry:** `client/core/system-registry.ts` (behind `window.Loom.systems`) has its own
> `LoomSystem` with the same fields, plus the optional `rollField(field, actor, dispatch)`,
> `useItem(actorId, itemId)`, `runMacro(key)` and `manifest` (the parsed `ruleset.json`), and no
> `licenseNotice`. Its `getActive()` also returns the only registered system when exactly one exists.
> The server `getActive()` returns only the id set with `setActive()`.

## SheetSchema

```typescript
interface SheetField {
  key: string;
  label: string;
  type: 'text' | 'number' | 'textarea' | 'boolean' | 'dots' | 'actions'
      | 'select' | 'color' | 'image' | 'square-counter';
  /** Used by 'dots' (number of pips) and 'square-counter' (total squares). */
  max?: number;
  /** Only for type 'select' — list of options. */
  options?: { value: string; label: string }[];
}
interface SheetTab {
  id: string;
  label: string;
  /** Emoji or icon class (e.g. 'fa-sword'), displayed next to the label. */
  icon?: string;
  fields: SheetField[];
}
interface SheetSchema {
  tabs: SheetTab[];
}
```

> **`square-counter`**: the stored value is `{ max: number, superficial: number, aggravated: number }`
> (not a single `number` like the other types) — each square cycles
> `empty → superficial → aggravated → empty` individually when clicked.

## Example

```js
const SystemRegistry = globalThis.__loomSystemRegistry;

SystemRegistry.register({
  id: 'my-system',
  title: 'My System',
  version: '1.0.0',
  actorTypes: ['character', 'npc'],
  itemTypes: ['weapon', 'armor'],
  getDefaultData(type) {
    if (type === 'character') return { hp: { value: 10, max: 10 } };
    return {};
  },
  getSheetSchema(actorType) {
    return {
      tabs: [{
        id: 'main',
        label: 'Main',
        fields: [{ key: 'hp.value', label: 'HP', type: 'number' }],
      }],
    };
  },
});
```
