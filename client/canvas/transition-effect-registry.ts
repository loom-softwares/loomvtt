/*******************************************************************************
 * LoomVTT
 * client/canvas/transition-effect-registry.ts
 *
 *
 * Registry for scene-transition effects (used by CanvasManager.runTransition).
 * Lets any part of Loom, or a future addon/module, add a new transition type
 * without editing canvas-manager.ts / screens.css / stage-config-window.ts.
 * Same pattern as main-menu-registry.ts. The builtins are DATA, not code — they
 * live in transition-effects.json; an addon can register more via
 * `Loom.transitions.register(...)` (client/main.ts) or by shipping its own JSON
 * and importing+registering each entry the same way this file does below.
 ******************************************************************************/

import builtinEffects from './transition-effects.json';

export interface TransitionEffectDef {
  id: string;
  label: string;
  /** false = opacity-only (fade). true = a `mask-image`/`clip-path` shape controls
   * visibility; opacity stays fixed at 1 the whole time. */
  usesMask: boolean;
  /** Web Animations API keyframes for the "reveal" phase — from fully covered
   * (the just-taken snapshot) to fully shown (the live scene underneath). */
  reveal: Keyframe[];
  /** CSS `mask-image` formula (only when usesMask and does not use pure clip-path in the
   * keyframes themselves, e.g.: wipe). References the custom properties from `reveal`. */
  maskImage?: string;
  /** Extra CSS `filter` (e.g.: `url(#some-svg-filter)`) applied along with the mask. */
  filter?: string;
  /** Name of an extra animator registered via `registerAnimator` — runs in parallel
   * to the CSS animation (e.g.: the swirl animates the `scale` of a feDisplacementMap via rAF,
   * since SVG attributes are not WAAPI-animatable). */
  extraAnimation?: string;
}

/** Runs in parallel with the reveal CSS animation; receives the total duration in ms. */
export type TransitionAnimatorFn = (durationMs: number) => Promise<void>;

// transition-effects.json doesn't know the DOM `Keyframe` type (it's pure JSON) — the keys
// match the exact structure, only the cast is missing for TS to accept it.
const BUILTIN = builtinEffects as unknown as TransitionEffectDef[];

class TransitionEffectRegistry {
  private effects = new Map<string, TransitionEffectDef>();
  private animators = new Map<string, TransitionAnimatorFn>();
  private styleEl: HTMLStyleElement | null = null;

  constructor() {
    for (const def of BUILTIN) this.register(def);
  }

  /** Registers (or overwrites) an effect and injects its mask/filter rule into CSS —
   * addons/modules call this, they don't need to edit screens.css. */
  register(def: TransitionEffectDef): void {
    this.effects.set(def.id, def);
    this.injectMaskCss(def);
  }

  unregister(id: string): void {
    this.effects.delete(id);
  }

  get(id: string): TransitionEffectDef | undefined {
    return this.effects.get(id);
  }

  getAll(): TransitionEffectDef[] {
    return Array.from(this.effects.values());
  }

  /** Extra animator by name (e.g.: the swirl rAF) — separate from effect registration
   * because it's a function, not data; an `id` can reference one via the `extraAnimation` field. */
  registerAnimator(name: string, fn: TransitionAnimatorFn): void {
    this.animators.set(name, fn);
  }

  getAnimator(name: string): TransitionAnimatorFn | undefined {
    return this.animators.get(name);
  }

  private injectMaskCss(def: TransitionEffectDef): void {
    if (!def.maskImage && !def.filter) return;
    if (!this.styleEl) {
      this.styleEl = document.createElement('style');
      this.styleEl.id = 'transition-effect-registry-styles';
      document.head.appendChild(this.styleEl);
    }
    const decls: string[] = [];
    if (def.maskImage) decls.push(`-webkit-mask-image: ${def.maskImage};`, `mask-image: ${def.maskImage};`);
    if (def.filter) decls.push(`filter: ${def.filter};`);
    this.styleEl.appendChild(document.createTextNode(
      `.stage-transition-overlay--${def.id} { ${decls.join(' ')} }\n`,
    ));
  }
}

export const transitionEffectRegistry = new TransitionEffectRegistry();
