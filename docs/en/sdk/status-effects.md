# Status Effect Registry (`status-effect-registry.ts`)

Registry of conditions/status effects displayed as an icon under the token on the Canvas.
Implemented as an **additive registry by key** (same pattern as `Loom.dice`/`Loom.sheets`) — not a
replaceable global object, which would reopen the addon order conflict problem.

```typescript
import { statusEffects } from '/_loom/sdk/index.js';
```

## API

```typescript
statusEffects.register(def: StatusEffectDef): void
statusEffects.get(id: string): StatusEffectDef | undefined
statusEffects.getAll(): StatusEffectDef[]
```

## StatusEffectDef

```typescript
interface StatusEffectDef {
  id: string;      // e.g.: 'frenzy', 'blinded'
  label: string;
  color: number;    // icon background color (hex, e.g.: 0xaa0000)
  icon?: string;
}
```

## Built-ins

5 generic conditions already registered by default: `blinded`, `poisoned`, `stunned`,
`prone`, `invisible`. A system can overwrite any of them by registering again
with the same `id`, or add custom conditions.

## Example

```js
Loom.statusEffects.register({ id: 'frenzy', label: 'Frenzy', color: 0xaa0000 });
Loom.statusEffects.register({ id: 'torpor', label: 'Torpor', color: 0x2b2b2b });
```

The `cast.statusMarkers` (array of ids) already uses this registry to draw the right
icon on the token — no additional wiring needed beyond `register()`.
