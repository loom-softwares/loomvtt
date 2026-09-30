# Global Primitives — extended prototypes (`primitives.ts`)

Polyfill that extends native JavaScript prototypes (`Array`, `String`, `Math`, `Number`,
`Set`, `Date`) with utility methods that converted systems assume already exist. It is a
**side-effect module** (`export {}`): just importing it (`import './core/primitives.js'`)
already applies the extensions at runtime — **there is nothing to import**.

Source: `client/core/primitives.ts`.

> **Careful:** by modifying global prototypes, these methods become available **everywhere**
> in the client app, not just in converted addons. Avoid defining methods with the same name to
> prevent overriding the polyfills.

## `Array.prototype`

| Method | Signature | Description |
|--------|-----------|-----------|
| `equals` | `(other: any[]): boolean` | Element-by-element equality (same size and values) |
| `partition` | `(fn: (item, index) => boolean): [fail, pass]` | Splits into two arrays: those that failed and those that passed |
| `findSplice` | `(fn: (item, index) => boolean, replacement?): item?` | Removes the first matching item, optionally inserting `replacement` in its place; returns the removed item |
| `filterJoin` | `(sep: string, fn?): string` | Filters (or uses all) and joins with separator |
| `deepFlatten` | `(): any[]` | Recursively flattens nested arrays |

## `Array` (static)

| Method | Signature | Description |
|--------|-----------|-----------|
| `fromRange` | `(n: number, start?: number): number[]` | Generates `[start, start+1, ..., start+n-1]` |

## `String.prototype`

| Method | Signature | Description |
|--------|-----------|-----------|
| `capitalize` | `(): string` | First letter capitalized |
| `titleCase` | `(): string` | First letter of each word capitalized |
| `slugify` | `(options?: { replacement?: string; lower?: boolean }): string` | Normalizes (strips accents) and turns into a slug |
| `stripScripts` | `(): string` | Removes `<script>...` tags |
| `stripDiacritics` | `(): string` | Removes diacritics (accents) |
| `compare` | `(other: string): number` | case-insensitive `localeCompare` (`sensitivity: 'base'`) |

## `Math` (static)

| Method | Signature | Description |
|--------|-----------|-----------|
| `clamp` | `(value, min, max): number` | Limits value to range |
| `mix` | `(a, b, t): number` | Linear interpolation `a*(1-t) + b*t` |
| `toDegrees` | `(radians): number` | rad → degrees |
| `toRadians` | `(degrees): number` | degrees → rad |
| `normalizeDegrees` | `(degrees): number` | Normalizes to `[0, 360)` |
| `normalizeRadians` | `(radians): number` | Normalizes to `[0, 2π)` |
| `SQRT1_3` | `number` (readonly) | `1/sqrt(3)` |
| `SQRT3` | `number` (readonly) | `sqrt(3)` |

## `Number` (static)

| Method | Signature | Description |
|--------|-----------|-----------|
| `isNumeric` | `(value): boolean` | Whether it is a finite number (rejects null/boolean/empty string) |
| `between` | `(num, min, max, inclusive?): boolean` | Range test (inclusive by default) |
| `fromString` | `(str): number \| null` | Converts string, `null` if invalid |
| `paddedString` | `(value, digits): string` | Left zero-padding |
| `signedString` | `(value): string` | Prefixes `+` for non-negative numbers |
| `ordinalString` | `(value): string` | Ordinal suffix (`1st`, `2nd`, `3rd`) |

## `Set.prototype`

| Method | Signature | Description |
|--------|-----------|-----------|
| `every` / `some` | `(fn): boolean` | Predicate over elements |
| `filter` | `(fn): Set` | Returns new Set with those that pass |
| `map` | `(fn): Set` | Maps to new Set |
| `find` | `(fn): item?` | First item that passes |
| `reduce` | `(fn, initial): acc` | Reduces |
| `equals` | `(other: Set): boolean` | Set equality |
| `isSubset` | `(other: Set): boolean` | Whether all elements are in `other` |
| `intersects` | `(other: Set): boolean` | Whether they share any element |
| `first` | `(): item?` | First element |
| `toObject` | `(): any[]` | Spreads into an array |

## `Date.prototype`

| Method | Signature | Description |
|--------|-----------|-----------|
| `isValid` | `(): boolean` | Whether the date is valid |
| `toDateInputString` | `(): string` | `YYYY-MM-DD` (for `<input type="date">`) |
| `toTimeInputString` | `(): string` | `HH:MM` (for `<input type="time">`) |

## Example

```js
import './core/primitives.js'; // applies the polyfills

const arr = [1, [2, [3]]].deepFlatten();        // [1, 2, 3]
const [fail, pass] = [1, 2, 3].partition(n => n > 1); // fail=[1], pass=[2,3]
const slug = 'Hello World!'.slugify();          // 'hello-world'
const clamped = Math.clamp(42, 0, 10);          // 10
const nums = Array.fromRange(3, 5);             // [5, 6, 7]
const subset = new Set([1, 2]).isSubset(new Set([1, 2, 3])); // true
```
