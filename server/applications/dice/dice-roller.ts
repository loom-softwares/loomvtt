/**
 * core/src/dice/roller.ts
 * LoomVTT Dice Engine — original implementation.
 * Inspired by tabletop VTT conventions but written from scratch.
 *
 * Data structure:
 *   RollResult {
 *     formula: string           "2d6+3"
 *     terms: RollTerm[]         parsed parts
 *     total: number             final sum
 *     flavor?: string           optional label
 *     mode: RollMode            visibility
 *   }
 *
 *   RollTerm (dice):
 *     { kind:'dice', count:2, faces:6, rolls:[3,5], subtotal:8, dropped:[false,false] }
 *
 *   RollTerm (modifier):
 *     { kind:'modifier', value:3 }
 *
 * Now delegates evaluation to RollFormula (roll-formula.ts) which uses the
 * RollPart hierarchy (roll-parts.ts). The legacy RollResult shape is preserved
 * for backward compatibility — call-sites don't need changes.
 */

import { RollFormula } from './roll-formula.js';
import { DiceGroup, FlatValue, MathOperator, RollPart, RollGroup, RollFunction, SuccessPool } from './roll-parts.js';

export type DiceTermResult = {
  kind: 'dice';
  count: number;
  faces: number;
  rolls: number[];
  dropped: boolean[];  // true = this individual die was dropped (kl/kh)
  subtotal: number;
  modifier?: string;   // 'kh','kl','r','x' etc (for display)
  successes?: number;  // present when cs/cf modifier is used
};

export type ModifierTerm = {
  kind: 'modifier';
  value: number;
};

export type RollTerm = DiceTermResult | ModifierTerm;

export type RollResult = {
  formula: string;
  terms: RollTerm[];
  total: number;
  flavor?: string;
  /** Roll visibility mode */
  mode: RollMode;
  /** Opaque metadata from system hooks (e.g. WoD success info) */
  meta?: Record<string, any>;
};

/** Who can see this roll result */
export type RollMode = 'public' | 'gmroll' | 'blindroll' | 'selfroll';

/**
 * Parse and evaluate a dice formula string via the new RollFormula engine.
 * Supports: NdF, NdFkh, NdFkl, NdFr, NdFro, NdFx, NdFcs>CF, +/- operators,
 * parênteses, funções min/max/floor/ceil/round, @variable substitution.
 *
 * @example  roll("2d6+3")  → { formula:"2d6+3", total:11, terms:[...] }
 * @example  roll("1d20kh", {}, { mode:'gmroll', flavor:'Attack' })
 */
export function roll(
  formula: string,
  data: Record<string, number> = {},
  options: { mode?: RollMode; flavor?: string } = {}
): RollResult {
  const rf = new RollFormula(formula, data);
  const mode: RollMode = options.mode ?? 'public';
  const terms: RollTerm[] = [];

  // Convert RollPart[] → legacy RollTerm[]
  let currentOp: '+' | '-' = '+';

  for (const part of rf.terms) {
    if (part instanceof MathOperator) {
      currentOp = part.operator as '+' | '-';
      continue;
    }

    const sign = currentOp === '-' ? -1 : 1;

    if (part instanceof DiceGroup) {
      terms.push({
        kind: 'dice',
        count: part.results.length,
        faces: part.faces,
        rolls: part.results.map((r) => r.value),
        dropped: part.results.map((r) => !r.active),
        subtotal: sign * part.total,
        modifier: part.modifiers || undefined,
      });
    } else if (part instanceof SuccessPool) {
      // Flatten success/failure pools to a single modifier term with the
      // resolved count — the legacy format has no dedicated pool term.
      terms.push({
        kind: 'modifier',
        value: sign * part.total,
      });
    } else if (part instanceof FlatValue) {
      terms.push({
        kind: 'modifier',
        value: sign * part.value,
      });
    } else {
      // RollGroup, RollFunction → flatten to modifier with resolved total
      terms.push({
        kind: 'modifier',
        value: sign * part.total,
      });
    }
  }

  return {
    formula,
    terms,
    total: rf.total,
    flavor: options.flavor,
    mode,
  };
}

/**
 * Nova API — dá acesso à árvore completa (reroll/explode/pool visíveis),
 * pra quem precisar de detalhe por dado (ex: animação de dado 3D no futuro).
 */
export function rollDetailed(formula: string, data: Record<string, number> = {}): RollFormula {
  return new RollFormula(formula, data);
}

/**
 * Labels for each die face count → used for icon selection in the UI.
 * Only standard RPG polyhedra get a specific icon; others fall back to "dX".
 */
export const KNOWN_DICE = [4, 6, 8, 10, 12, 20, 100, -1] as const;

/** Convert a RollResult to a plain JSON-serializable object for DB / WS. */
export function rollToJSON(r: RollResult): object {
  return { ...r };
}
