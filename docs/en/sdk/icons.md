# Icons

LoomVTT draws icons from Font Awesome markup, but the strokes that
appear on screen come from [Lucide](https://lucide.dev). You write the usual HTML
and get the new stroke.

```html
<i class="fa-solid fa-star"></i>
```

There is no function to import, nor component to instantiate. The replacement happens in
CSS.

## How it works

`client/styles/generated/hud-icons.css` brings one rule per icon that swaps the
Font Awesome glyph for a Lucide SVG mask:

```css
.fa-star::before {
  content: '';
  display: inline-block;
  width: 1em;
  height: 1em;
  background-color: currentColor;
  mask: url("data:image/svg+xml,…") no-repeat center / contain;
}
```

Practical consequences for those writing a system or addon:

- The icon **inherits the text color** (`currentColor`). To recolor, change `color`
  on the element or its parent — not `background`.
- The icon **measures 1em**, so it scales with the context's `font-size`, just like
  Font Awesome did.
- Font Awesome sizing modifiers (`fa-lg`, `fa-2x`) still
  work, because they act upon `font-size`.

## Unmapped name remains Font Awesome

Only icons actually used by the app make it into the generated file. **A name that is not
in the map draws regular Font Awesome** — it doesn't turn into an empty square.

This is deliberate and protects two cases the core doesn't control: macro icons,
chosen by the user at runtime, and icons that a third-party system
injects as raw HTML. Font Awesome is kept loaded in the app precisely for this reason.

In other words: any valid Font Awesome name works. The ones LoomVTT maps
appear with the Lucide stroke; the rest appear as before.

## Brands

`fa-github` and `fa-discord` come from [Simple Icons](https://simpleicons.org), not from
Lucide — which removed brand icons for licensing reasons. Swapping a known
logo for a generic icon would strip the brand's identity.

Brands use a fill mold instead of a stroke, but usage is identical:

```html
<i class="fa-brands fa-github"></i>
```

## Request a new icon

If your system uses a Font Awesome name that isn't mapped yet, it already
works — but with the old stroke, and will clash with the rest of the interface.

To map it, edit `MAP` in `scripts/gen-icons.mjs` and regenerate:

```bash
npm run gen:icons
```

The key is the Font Awesome name without the `fa-` prefix; the value is the name in Lucide.

```js
const MAP = {
  'shield-halved': 'shield',
  'masks-theater': 'drama',
};
```

The script fails and lists the names if any don't exist in Lucide, so a typo
appears immediately instead of turning into a missing icon on screen.

## Licenses

| Source | License | Requires attribution |
|---|---|---|
| Lucide | ISC | No |
| Simple Icons | CC0 | No |
| Font Awesome Free | CC BY 4.0 | **Yes** |

`lucide-static` and `simple-icons` are `devDependencies`: they only serve the generator.
The generated CSS is versioned, so **the client bundle doesn't load either
library** — the cost in production is just the mask file.

## Emoji

Some parts of the interface use emojis on purpose, and are not candidates for
conversion: token status conditions (poisoned, burning, stunned)
appear tiny and overlaid on the token, several at once, and the emoji's own color
is what makes them distinguishable over a colorful map. A 16px monochromatic icon
would be harder to read exactly where it matters most.

The same goes for card suits (`♥ ♠ ♦ ♣`) and markers where color
carries the meaning.

## See also

- [`wrappable.md`](wrappable.md) — card menu options accept an icon as raw
  HTML, and the same rules from this page apply.
