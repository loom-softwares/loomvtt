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
path is wrong, the fetch hits the dev server's `index.html` (200 OK) — Handlebars compiles
any HTML and the template comes out garbage.

## Cache

Compiled templates and fonts are cached by resolved path. After editing an addon in
dev, call `clearTemplateCache(path)` (or without arguments to clear everything) to see changes.

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
