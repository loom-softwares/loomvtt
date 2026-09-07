# Scene Transition Effect Registry (`transition-effect-registry.ts`)

Registry of scene-transition effects — played by `CanvasManager` when a stage is
activated (or updated in a way that changes background/grid/dimensions), controlled
per-stage by `transitionType`/`transitionDuration` (Stage Configuration → "Animação de
Transição"). Implemented as an **additive registry by key** (same pattern as
`Loom.statusEffects`/`Loom.dice`) — not a replaceable global object.

Built-ins are **data, not code**: they live in `client/canvas/transition-effects.json`
and get loaded into the registry at startup. An addon adds a new effect the same way —
call `register()` with an object shaped like the JSON entries — it never needs to touch
`canvas-manager.ts`, `screens.css`, or the stage config window.

```typescript
import { transitionEffectRegistry } from '/_loom/canvas/transition-effect-registry.js';
// or, from an addon:
Loom.transitions.register({ ... });
```

## API

```typescript
transitions.register(def: TransitionEffectDef): void
transitions.unregister(id: string): void
transitions.registerAnimator(name: string, fn: (durationMs: number) => Promise<void>): void
```

`register()` also injects the effect's `mask-image`/`filter` CSS rule into the page
automatically — no separate stylesheet edit needed.

## TransitionEffectDef

```typescript
interface TransitionEffectDef {
  id: string;              // e.g.: 'circle', 'wipe'
  label: string;           // shown in the stage config dropdown
  usesMask: boolean;       // false = opacity-only fade; true = mask-image/clip-path shape
  reveal: Keyframe[];      // Web Animations API keyframes, "covered" -> "revealed"
  maskImage?: string;      // CSS mask-image formula (only when usesMask)
  filter?: string;         // extra CSS filter (e.g. url(#some-svg-filter))
  extraAnimation?: string; // name of an animator registered via registerAnimator()
}
```

`reveal` keyframes can target plain CSS properties (`opacity`, `clipPath`) or custom
properties (`--my-var`) — a custom property used inside `maskImage` needs a matching
`@property` declaration in `screens.css` so the browser interpolates it smoothly instead
of jumping at the midpoint of the animation (percentage/angle/etc — see the existing
`--iris-r`/`--blind-h`/`--clock-a` declarations for the pattern).

## How it plays

Right before a stage transition starts, `CanvasManager` snapshots the current screen
into an overlay `<canvas>`, applies the effect's mask/opacity to it, swaps the actual
scene content underneath (invisible, hidden by the still-opaque snapshot), then runs the
`reveal` animation — the old frame dissolves/opens through the shape, revealing the new
scene. This is why `usesMask` effects don't need an explicit "cover" state: the snapshot
itself already is that state.

## Built-ins

`none`, `fade`, `circle` (iris), `swirl` (iris + pixel distortion via an SVG
`feDisplacementMap` filter, animated separately through `registerAnimator`), `wipe`
(curtain), `blinds` (venetian), `clock` (radial sweep) — see
`client/canvas/transition-effects.json` for the exact keyframes/formulas.

## Example

```js
Loom.transitions.register({
  id: 'my-effect',
  label: 'My Effect',
  usesMask: true,
  reveal: [{ '--my-var': '0%' }, { '--my-var': '150%' }],
  maskImage: 'radial-gradient(circle at 50% 50%, transparent 0%, transparent var(--my-var), #000 var(--my-var), #000 100%)',
});
```

It shows up automatically in the stage config's "Tipo de Transição" dropdown — no
additional wiring needed beyond `register()`.
