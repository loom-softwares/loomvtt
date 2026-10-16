# Dice — Roll Parser + Dice Registry

> **Important for those porting a system:** there are TWO distinct things here.
>
> - **Real parser** (`server/applications/dice/roller.ts`, `roll()` function) — interprets the
>   formula string (`"2d6+3"`, `"5d10cs>5"`) and calculates the `total`. This is what actually runs
>   when the client sends `chat.roll` via WebSocket. The server is always the
>   final authority for standard terms (`d`, `kh/kl/dh/dl`, `r`, `x`, `cs>`).
> - **Dice Registry** (`dice-registry.ts`, below) — registry of **custom dice
>   expressions**. Since the `{kind:config}` bridge (see section below), this **DOES affect
>   the roll result** when used in the formula — it is no longer purely cosmetic.
>
> A common dice-pool system (WoD5e, Shadowrun, L5R etc) only needs to tweak the
> **formula it sends to the roller** (`cs>`/`cs<`/`cs=`) — it doesn't need the Dice Registry for
> this. The Dice Registry comes into play when an addon wants an entirely
> new TYPE of die (e.g. physical 3D die, or a face/expression that the standard parser does not cover).

## Real parser syntax (`roll()`)

```
NdF              → N dice of F faces, sums everything (e.g.: "2d6")
NdFkh / NdFkl    → keeps only the highest/lowest N
NdFdh / NdFdl    → drops the highest/lowest N
NdFr[T]          → recursive reroll while result is <= T (default T = 1)
NdFro[T]         → reroll once if result is <= T (default T = 1)
NdFx[T]          → exploding die: rolls again while result >= T
                   (T omitted = the face count, so only the maximum explodes;
                   fate dice "dF" never explode)
NdFcs>N / cs<N / cs=N   → COUNTS SUCCESSES (doesn't sum!) — generic dice-pool
NdFcs>=N / cs<=N        → same, with the inclusive comparisons
NdFcs>Nc                → accepted, but the `c` suffix has NO effect: a natural
                          maximum counts as one success like any other hit
NdFcf>N / cf<N / cf=N   → COUNTS FAILURES (same comparisons as cs). When cs and cf
                          are both present, the term is successes minus failures
(expr) / -(expr)        → parentheses and unary minus
min(...), max(...), floor(...), ceil(...), round(...)  → functions over expressions
+N / -N          → flat modifier added to the total
@path.to.data    → replaced by its numeric value before evaluating. The server
                   parser (`roll-formula.ts`) replaces an unknown path with 0 silently
```

`cs>`/`cs<`/`cs=` (and `>=`/`<=`) transform the term into a success counter: instead of summing
the dice values, `total` becomes the count of dice that met the condition. The `c` suffix is
parsed and discarded, so it does not double a natural maximum: a 10 counts as one success.
Generic — any dice-pool system can use it, it is not specific to any game.

**Example (WoD5e style — pool of 5 basic dice + 2 advanced, success >5):**
```
roll("5d10cs>5 + 2d10cs>5")
// total = sum of successes of both dice groups
// critical doubling on 10 is not done by the parser; a system that needs it must add it itself
```

## Automatically building the pool (`resolve-formula.ts` / `item-modifiers.ts`)

Before rolling, the client can automatically build the formula from the actor, instead
of typing the sum by hand. Exposed on `window.Loom.rolls`:

```typescript
import { sumPaths } from '../core/resolve-formula.js';
import { getActiveModifiers, collectItemModifiers, type ItemModifier } from '../core/item-modifiers.js';

// Sums various actor fields (e.g.: attribute + skill)
const baseDice = sumPaths(['attributes.strength.value', 'skills.brawl.value'], actor.systemData);

// Contextual item bonuses, queried AT THE MOMENT OF THE ROLL (not applied
// permanently in the actor's data — different from BuffChange/effects.ts)
const modifiers = collectItemModifiers(actor.items); // reads `item.systemData.bonuses: ItemModifier[]`
const bonus = getActiveModifiers(modifiers, ['skills.brawl'], actor.systemData);

const formula = `${baseDice + bonus}d10cs>5`;
```

`ItemModifier` = `{ selectors: string[], value: number, activeWhen?: {...}, source?: string }`.
An item stores these bonuses in `systemData.bonuses`; `activeWhen` accepts `always`, `isEqual`
(compares an actor path to a value) or `isPath` (path exists/is not null). This is the
generic equivalent to the "bonuses[] with selectors" that dice-pool systems usually have —
implemented as engine infrastructure, not tied to any specific system.

## `@variable` resolved automatically by the server

When `chat.roll` arrives with an `actorId`, the server fetches the actor, flattens the
`systemData` (paths like `abilities.dex` become key `"abilities.dex"`) and passes that
as `data` to `roll()` — so `"1d20+@abilities.dex"` already resolves the real attribute
value without the client needing to build the formula with the number already embedded. This is
different from the client's `resolveFormula()` (which exists for client-side building before
sending) — both coexist, use whichever makes more sense for your case.

## Custom terms in formula — bridge with the Dice Registry (`{kind:config}`)

`resolveCustomDiceTerms()` (`client/screens/game-hud/roll-dispatch.ts`) resolves terms
in the `{kind:config}` format **in the client, before sending the formula to the server** — the
term becomes the calculated `subtotal`, and the server never needs to know that custom
type exists (ruleset/addon never runs server-side in LoomVTT).

```
{myDie:6}                        → scalar config (number)
{exploding:{"count":1,"faces":6}} → object config
{pool:[3,10]}                     → array config
```

```js
Loom.dice.register('myDie', MyDieExpression);

dispatchRoll({
  ...,
  formula: '1d20+{myDie:6}', // resolved in the client before sending
});
```

Limitation: config strings containing `}` break the parsing — avoid `}` inside
config string values. Unknown `kind` or invalid JSON is left as is (does not
break the roll).

---

# Dice Registry (`dice-registry.ts`)

Registry of customizable dice expressions (visuals/die faces). In the browser it is exposed as `Loom.dice` (`client/core/dice-registry.ts`), and the SDK exports it as `diceRegistry`. The client expression classes are in `client/core/dice-expression.ts`.

> **Note:** `globalThis.__loomDice` is set by `server/applications/dice/dice-registry.ts`, a server module that the browser does not load, so this global is not available in the client. Use `Loom.dice` (or the SDK `diceRegistry`) instead.

```typescript
import { diceRegistry } from '/_loom/sdk/index.js';
```

## API

```typescript
diceRegistry.register(kind: string, exprClass: ExpressionConstructor): void
diceRegistry.create(kind: string, config?: any): DiceExpression | undefined
diceRegistry.has(kind: string): boolean
```

## DiceExpression

```typescript
abstract class DiceExpression {
  abstract readonly kind: string;
  abstract evaluate(): DiceEvaluation;
  abstract toJSON(): object;
}

interface DiceEvaluation {
  rolls: number[];
  subtotal: number;
  label: string;
  dropped: boolean[];
}
```

## Native Expressions

| Class | kind | Description |
|--------|------|-----------|
| `DieExpression` | `'d'` | Numeric die (d4, d6, d20 etc) |
| `FateExpression` | `'f'` | Fate die (-/0/+) |
| `ModifierExpression` | `'m'` | Flat modifier (+2, -1) |

## Example

```js
const DiceRegistry = Loom.dice;

// Register a custom expression kind (the kind is the key used in `{kind:config}` terms)
DiceRegistry.register('pct', MyPercentileDie);

// Use the native die kind 'd' (config: count and faces)
const die = DiceRegistry.create('d', { count: 1, faces: 20 });
const result = die.evaluate();
console.log(result.subtotal, result.rolls);
```

## VTT Compatibility (`LoomRoll` and `Die`)

Converted systems (like WoD5e) heavily extend the base classes `Roll` and `Die` to inject custom dice behavior (e.g.: _VampireHungerDie_). To maintain full compatibility with these system-native constructs:

- **`Loom.Roll` (`LoomRoll`)**: A bridge that implements the object-oriented API (e.g.: `await roll.evaluate()`, `roll.terms`, `roll.toMessage()`). When calling `toMessage()`, this class converts its own roll into a payload for our Serverless API (`dispatchRoll`), not re-rolling dice but properly dispatching to the LoomVTT Chat Log and HUD. Also contains implementations for methods like `Roll.validate()` and `roll.product()`.
- **`Loom.Die` (`Die`)**: The polyfill superclass that allows subsystems to create classes like `class VampireDie extends Die`. Implements core functions like isolated evaluation, extraction of success targets (`cs>X`) and marginal bonus extraction. The die's `evaluate()` function results are automatically "cached" (in the die's local array, `this.results`) and respected by `LoomRoll`, preserving the original system's subclass-oriented design.
