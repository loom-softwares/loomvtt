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
 *   }
 *
 *   RollTerm (dice):
 *     { kind:'dice', count:2, faces:6, rolls:[3,5], subtotal:8, dropped:[false,false] }
 *
 *   RollTerm (modifier):
 *     { kind:'modifier', value:3 }
 */

import { RollFormula } from './roll-formula.js';
import { DiceGroup, FlatValue, MathOperator, RollGroup, RollFunction, SuccessPool, Operator } from './roll-parts.js';

export type DiceTermResult = {
  kind: 'dice';
  count: number;
  faces: number;
  rolls: number[];
  dropped: boolean[];  // true = this individual die was dropped (kl/kh)
  subtotal: number;
  modifier?: string;   // 'kh','kl','r','x','cs>N' etc (for display)
  /** Present when the 'cs' (count-successes) modifier is used — subtotal already equals this value. */
  successes?: number;
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

// ─── ROLL ENGINE (delegates to RollFormula) ──────────────────────────────────

/**
 * Parse and evaluate a dice formula string via the RollFormula engine.
 * Supports: NdF, NdFkh, NdFkl, NdFr, NdFr0, NdFx, NdFcs>CF, NdFrro,
 * +/- operators, parênteses, funções min/max/floor/ceil/round, @variable substitution.
 *
 * @example  roll("2d6+3")  → { formula:"2d6+3", total:11, terms:[...] }
 * @example  roll("1d20kh", {}, { mode:'gmroll', flavor:'Attack' })
 * @example  roll("4d6cs>4") → pool style: counts dice > 4 as successes
 */
export function roll(
  formula: string,
  data: Record<string, number> = {},
  options: { mode?: RollMode; flavor?: string } = {}
): RollResult {
  const rf = new RollFormula(formula, data);
  const mode: RollMode = options.mode ?? 'public';
  const terms: RollTerm[] = [];

  let currentOp: Operator = '+';

  for (const part of rf.terms) {
    if (part instanceof MathOperator) {
      currentOp = part.operator;
      continue;
    }

    const sign = currentOp === '-' ? -1 : 1;

    if (part instanceof DiceGroup) {
      terms.push({
        kind: 'dice',
        count: part.count,
        faces: part.faces,
        rolls: part.results.map((r) => r.value),
        dropped: part.results.map((r) => !r.active),
        subtotal: sign * part.total,
        modifier: part.modifiers || undefined,
      });
    } else if (part instanceof SuccessPool) {
      // Preserve success info for backward compat with pool-aware consumers
      const dg = part.diceGroup;
      terms.push({
        kind: 'dice',
        count: dg.count,
        faces: dg.faces,
        rolls: dg.results.map((r) => r.value),
        dropped: dg.results.map((r) => !r.active),
        subtotal: sign * part.total,
        modifier: dg.modifiers + `cs${part.comparison}${part.threshold}`,
        successes: part.total,
      });
    } else if (part instanceof FlatValue) {
      terms.push({
        kind: 'modifier',
        value: sign * part.value,
      });
    } else {
      // RollGroup, RollFunction → flatten to a single modifier with resolved total
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
