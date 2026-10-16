# Render Template — `.hbs` (`render-template.ts`)

Client-side Handlebars template engine — used by addons/rulesets to render Actor/Item
sheets. Exposed **only** on `window.Loom.renderTemplate`/`window.Loom.loadTemplates` —
it is **not** an SDK package export (`/_loom/sdk/index.js`), although it is documented in this
folder due to subject affinity.

```typescript
// Not an import — Loom is already global on the client, addon uses it directly.
const html = await Loom.renderTemplate('path/to/template.hbs', data);
```

## API

```typescript
Loom.renderTemplate(path: string, data?: unknown): Promise<string>;
Loom.loadTemplates(paths: string[]): Promise<void>;   // registers partials by path and short name
```

`clearTemplateCache` and the internal `Handlebars` **are not accessible** to addons — they
only exist inside the `client/core/render-template.ts` module, with no public alias.

## Path resolution (important)

Legacy convention path is automatically translated to the real served path:

| Legacy convention | Real path |
|------------------|--------------|
| `systems/<id>/...` | `/marketplace/rulesets/<id>/...` |
| `modules/<id>/...` | `/marketplace/addons/<id>/...` |

Templates are plain `.hbs` files served natively — no extension rewrite. If the resolved
path is wrong, the server may answer with HTML (for example the dev server's `index.html`, 200 OK).
`renderTemplate` detects an HTML content type and rejects with an error instead of compiling it.
A non-2xx response also rejects.

## Cache

Templates are cached in memory by resolved path (the compiled template and its source). Failed
fetches are not cached. After editing an addon in dev, reload the page to see the changes:
`clearTemplateCache` is not exposed on `window.Loom` (see the CODE ISSUE note below).

> **CODE ISSUE:** `clearTemplateCache(path?)` is exported from `client/core/render-template.ts`, but
> `window.Loom` (`client/main.ts`) only exposes `renderTemplate` and `loadTemplates`, so addons cannot call it.

## Handlebars helpers

Compatible helpers (see `handlebars-helpers.md`) are already globally registered in the
internal engine — no extra action needed from the addon side.

## Example

```js
// Preload partials
await Loom.loadTemplates(['/marketplace/rulesets/wod5e/templates/parts/health.hbs']);

// Render the sheet
const html = await Loom.renderTemplate('/marketplace/rulesets/wod5e/templates/actor-sheet.hbs', actorData);
container.innerHTML = html;
```
