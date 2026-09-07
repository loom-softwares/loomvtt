# Utils — object utilities (`utils.ts`)

Critical utility functions for converted systems: debounce/throttle, recursive merge,
deep cloning and nested property access.

Source: `client/core/utils.ts`. Exposed at runtime as `Loom.utils` (all
functions), as `Loom.debounce`/`Loom.throttle` (top-level shortcuts) and via the global alias
`vtt.utils` (see `globals.md`).

## Exports

| Export | Signature | Description |
|--------|-----------|-----------|
| `debounce` | `<T>(callback: T, delay: number): (...args) => void` | Wraps the function with debounce (executes only after the delay without new calls) |
| `throttle` | `<T>(callback: T, delay: number): (...args) => void` | Limits the execution frequency (at most once per interval, with execution at the end if called in between) |
| `mergeObject` | `(original, other, options?): merged` | Recursive merge — nested objects combine, the rest is overwritten |
| `duplicate` | `(obj): cloned` | Deep clone via JSON (loses functions/Map/Set) |
| `deepClone` | `(obj): cloned` | Alias for `duplicate` |
| `getProperty` | `(obj, path): value?` | Reads nested property by dot notation (`'a.b.c'`) |
| `setProperty` | `(obj, path, value): void` | Sets nested property, creating intermediate objects |
| `isEmpty` | `(value): boolean` | `true` if `value` is `null`/`undefined`/empty array/empty object/empty Map or Set |
| `randomID` | `(length = 16): string` | Generates random alphanumeric ID |
| `flattenObject` | `(obj): flat` | Flattens nested object into dot keys (`{a:{b:1}}` → `{"a.b":1}`) — arrays are not flattened |
| `expandObject` | `(obj): nested` | Inverse of `flattenObject` — expands dot keys back to nested object |
| `parseHTML` | `(html, inline?): HTMLElement` | Parses HTML string into DOM element (`<div>` by default, or `DocumentFragment` if `inline=true`) |
| `escapeHTML` | `(text): string` | Escapes `& < > " '` for safe insertion into text |
| `isVideoUrl` | `(url): boolean` | `true` if the url ends in `.webm`/`.mp4`/`.m4v`/`.ogv`/`.mov` |
| `mediaHtml` | `(url, opts?: {className?, alt?, extraAttrs?}): string` | Returns `<img>` or `<video muted loop autoplay>` depending on the extension — use this ALWAYS when rendering `avatarUrl`/`imgUrl` of a user field in the template, never write `<img>` by hand for this (a `.webm` file in an `<img>` goes blank, with no error) |

## Example

```js
// Loom is not an SDK import — it's global on the client. Uses Loom.utils (or vtt.utils).
const { getProperty, mergeObject, duplicate, debounce } = Loom.utils;

// Nested property access
const str = getProperty(actor.systemData, 'attributes.strength.value'); // 10

// Recursive merge — subobjects combine, they don't replace entirely
const merged = mergeObject({ a: { x: 1 } }, { a: { y: 2 } });
// merged = { a: { x: 1, y: 2 } }

// Deep clone
const copy = duplicate(actor.systemData);

// Debounce for delayed save
const save = debounce(() => submitForm(), 300);
```

> **`duplicate`/`deepClone` limitation:** uses `JSON.parse(JSON.stringify())` — functions,
> `Map`, `Set` and non-serializable values are not cloned (becomes `undefined`/lost).

> **Note:** `expandObject` also runs automatically as a server-side middleware
> (`server/index.ts`) on every request — any update payload sent in
> dot notation (`{"system.attributes.hp": 5}`, common format in converted
> scripts) is expanded before reaching the route handler, and the `system`
> key (if present) is automatically renamed to `systemData`.
