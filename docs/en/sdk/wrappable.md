# Wrappable (`wrappable.ts`)

Function interception system that allows addons to stack wrappers on core functions, without depending on third-party libraries.

```typescript
import { wrap, getWraps } from '/_loom/sdk/index.js';
```

## API

```typescript
function wrap<Fn extends (...args: any[]) => any>(baseFn: Fn): Wrappable<Fn>

interface Wrappable<Fn> {
  (...args: Parameters<Fn>): ReturnType<Fn>;
  wrap(wrapper: (wrapped: Fn, ...args: Parameters<Fn>) => ReturnType<Fn>): () => void;
  /** Alias of `wrap()` — same implementation, name of the actual libWrapper convention from the
   * original platform. Some converted systems call `.addWrapper()` instead of `.wrap()`. */
  addWrapper(wrapper: (wrapped: Fn, ...args: Parameters<Fn>) => ReturnType<Fn>): () => void;
}
```

## Example

```typescript
// Wrap custom function
const myFn = wrap((x: number) => x * 2);

// Addon A adds wrapper
const unsubA = myFn.wrap((original, x) => {
  console.log('Addon A intercepted');
  return original(x);
});

// Addon B stacks another wrapper
const unsubB = myFn.wrap((original, x) => {
  console.log('Addon B first');
  return original(x);
});

// Call
myFn(5); // Addon B → Addon A → base

// Remove specific wrapper
unsubA();
```

## Behavior

- Multiple wrappers stack: last registered = outermost
- If a wrapper throws an error, skips to the previous layer
- `wrap()` returns an unsubscribe function

## Wrap points already exposed by the core (`Loom.wraps`)

Nominal extension points that the core has already created — addon doesn't need to (and shouldn't)
try to create its own competing equivalents:

| Wrap point | Signature | Usage |
|---|---|---|
| `renderRollCard` | `(roll: RollResult, esc) => string` | Customizes the HTML card of a chat roll |
| `renderMessage` | `(msg, ctx: { esc, canSeeRoll }) => string` | Customizes the HTML of any chat message |
| `renderMacroIcon` | `(macro) => string` | Customizes the icon of a macro hotbar slot |
| `resolveFOVOrigins` | `function` | Customizes the origin points for the Canvas FOV calculation |
| `chatCardContextOptions` | `(msg) => ChatCardContextOption[]` | Right-click menu items on a chat card — core already returns a generic "Reroll" for every roll message (resends the same formula/mode/meta/actorId), works even without any system registered |

```js
Loom.wraps.renderRollCard.addWrapper((original, roll, esc) => {
  return `<div class="my-custom-card">${original(roll, esc)}</div>`;
});

// The simple "Reroll" comes for free (core). Only add an extra option here if
// the system has its own mechanic conditioning the reroll (e.g. spending 1 Willpower
// point, only available if the roll failed, etc) — do not duplicate the generic
// reroll that the core already provides.
Loom.wraps.chatCardContextOptions.addWrapper((original, msg) => {
  const base = original(msg);
  if (!msg.isRoll || !msg.roll?.meta?.wod6ePool) return base;
  const willpower = getCurrentWillpower(msg.speaker?.actorId); // example
  if (willpower <= 0) return base;
  return [...base, {
    label: 'Reroll with Willpower (-1)',
    icon: '<i class="fa-solid fa-star"></i>',
    action: () => { /* spends 1 Willpower, redo the roll with the system rule */ },
  }];
});
```

> **About the `icon`**: it's raw HTML, and Font Awesome markup is still the
> correct way to write it. What changes is the drawing — names mapped by the core
> appear with the Lucide stroke, and unmapped names keep drawing Font
> Awesome, without turning into an empty square. See [`icons.md`](icons.md).

### Custom roll card — NEVER give a background/border to the root container

The entire message (avatar + name + timestamp + whatever `renderRollCard`/`renderMessage`
returns) already sits inside ONE core envelope (`.sidebar-message`) which alone already has
background/border/radius — it is the only visual box for the message. If the HTML returned by the wrap
point also has an opaque background/border on the root element, it becomes "box inside a box"
(two visible outlines, one inside the other — actual bug, has happened before).

```css
/* WRONG — creates a second outline inside .sidebar-message */
.my-custom-card { background: #141414; border: 1px solid #333; border-radius: 8px; }

/* RIGHT — transparent, only subtle dividers between sections if needed */
.my-custom-card { background: transparent; border: none; }
.my-custom-card .result { border-top: 1px solid rgba(255,255,255,0.08); }
```
