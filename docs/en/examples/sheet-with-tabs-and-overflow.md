# Reference: sheet with tabs + floating element outside the window

Copy this structure for any new sheet that needs tabs and/or an element
that overflows outside the window rectangle (side rail, suspended popup). Do not invent
tab CSS or margin calculation from scratch — the three points below (window options,
HTML, CSS) are already ready in the core; just change the names.

Do not skip any of the three blocks — each solves a real, documented bug that has already
happened in production when it was missing:

1. `allowOverflow` + `overflowMargin` without this: the floating element disappears from the screen
   depending on where the window is dragged, without any console error.
2. `.loom-window-tabs` / `.tab[data-group]` without this: all tabs become visible
   at the same time, stacked.
3. `overflow: visible` scoped to the system class without this: even with 1 and 2
   correct, `.loom-window-body` clips the floating element (body scroll clips the
   X axis as well, not just Y).

## 1. Window options (`extends BaseWindow`)

```typescript
export class MySheetWindow extends BaseWindow {
  constructor(props: { actorId: string }) {
    super({
      id: `my-sheet-${props.actorId}`,
      title: 'My Sheet',
      width: 900,
      height: 820,
      allowOverflow: true,      // only if there is an element overflowing outside the window
      overflowMargin: 70,       // real width of what overflows + padding — limits dragging
      classes: ['my-sheet'], // becomes the class of the root .loom-window, used in the CSS below
    });
  }
}
```

If the sheet does NOT have anything overflowing outside (only normal tabs, everything inside the body),
skip `allowOverflow`/`overflowMargin`/`classes` — only section 2 applies.

## 2. HTML (inside `bodyTemplate()`)

```html
<form class="my-sheet-root">
  <!-- Optional: floating rail outside the window (section 1 needs to be configured) -->
  <nav class="my-sheet-rail">
    <button data-tab="attributes" data-group="primary" class="active">Attributes</button>
    <button data-tab="inventory" data-group="primary">Inventory</button>
  </nav>

  <div class="my-sheet-body">
    <div class="tab" data-tab="attributes" data-group="primary">
      ... tab content ...
    </div>
    <div class="tab" data-tab="inventory" data-group="primary">
      ... tab content ...
    </div>
  </div>
</form>
```

Fixed rules, do not change:
- Nav: `[data-tab][data-group]` on any clickable element — clicking works automatically
  by itself (core delegation), no need for `data-action` or a new listener.
- Content: exact `.tab` class (not `.tab-content`) + `data-tab`/`data-group`
  matching the corresponding button.

## 3. CSS (in the system stylesheet)

```css
/* Only necessary if using a floating rail outside the window (otherwise skip this block) */
.my-sheet .loom-window-body {
  overflow: visible;
}

.my-sheet-rail {
  position: absolute;
  left: -58px; /* needs to match overflowMargin (>=) up in section 1 */
  top: 40px;
  width: 52px;
  display: flex;
  flex-direction: column;
}
```

The scoping class (`.my-sheet` here) is the same one passed in `classes: [...]` in
section 1 — without this binding, `overflow: visible` would have no way of knowing which window
to target, and applying it generically to every `.loom-window-body` would break the scroll
of all other Loom windows.

## Where are the generic tab classes (nav inside window bounds)

If your sheet does NOT need a floating rail outside the window — only normal tabs inside
the body — use the ready-made generic classes instead of reinventing `.my-sheet-rail`:

```html
<nav class="loom-window-tabs">
  <a data-tab="general" data-group="primary" class="active">General</a>
</nav>
```

`.loom-window-tabs` already styles the bar (`client/styles/windows.css`). This covers the
majority of cases — the floating rail (section 1/3) is only for when the design specifically requests
something hanging outside the window.

See also: `docs/sdk/windows.md` (`allowOverflow`, tabs), `docs/sdk/wrappable.md`
(`addWrapper`).
