/*******************************************************************************
 * LoomVTT
 * client/core/resolve-formula.ts
 * 
 * 
 * Utility for resolving formulas with actor data.
 ******************************************************************************/

export function resolveFormula(formula: string, actorData: Record<string, any>): string {
  return formula.replace(/@(\w+(?:\.\w+)*)/g, (match, path: string) => {
    const parts = path.split('.');
    let val: any = actorData;
    for (const part of parts) {
      if (val == null || typeof val !== 'object') return match;
      val = val[part];
    }
    return val != null ? String(val) : match;
  });
}

/**
 * Sums the numeric value at each `paths` within `actorData`.
 * Missing or non-numeric paths count as 0 — never throws an error.
 * Generic: a dice-pool system builds the pool size by summing
 * `["attributes.strength.value", "skills.brawl.value"]` before rolling.
 * 
 * @param paths - An array of object paths (e.g., `"attributes.strength.value"`).
 * @param actorData - The object containing the values to sum.
 * @returns The numerical sum of all resolved paths.
 */
export function sumPaths(paths: string[], actorData: Record<string, any>): number {
  return paths.reduce((sum, path) => {
    const parts = path.split('.');
    let val: any = actorData;
    for (const part of parts) {
      if (val == null || typeof val !== 'object') { val = undefined; break; }
      val = val[part];
    }
    return sum + (typeof val === 'number' ? val : 0);
  }, 0);
}

/**
 * Resolve multiple action formulas for an item, returning a map of actionId -> resolved formula.
 * Uses the actor's systemData for @ref resolution.
 * 
 * @param actions - An array of action objects containing a formula.
 * @param actorSystemData - The actor's system data to use for resolution.
 * @returns A dictionary mapping action IDs to their resolved formula strings.
 */
export function resolveActionFormulas(
  actions: Array<{ id: string; formula: string }>,
  actorSystemData: Record<string, any>,
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const action of actions) {
    result[action.id] = resolveFormula(action.formula, actorSystemData);
  }
  return result;
}