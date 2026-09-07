/*******************************************************************************
 * LoomVTT
 * client/core/item-modifiers.ts
 * 
 * 
 * Manager for item-based rule modifiers.
 ******************************************************************************/

export type ModifierCondition =
  | { check: 'always' }
  | { check: 'isEqual'; path: string; value: any }
  | { check: 'isPath'; path: string };

export interface ItemModifier {
  /** A match with any of the roll's selectors activates this modifier (e.g., ["skills.brawl"]). */
  selectors: string[];
  /** Value added to the pool/total when active. */
  value: number;
  /** Activation condition. Omitted = always active. */
  activeWhen?: ModifierCondition;
  /** Optional label for display (e.g., "Fighting Style"). */
  source?: string;
}

function getPath(obj: Record<string, any>, path: string): any {
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

function isConditionActive(condition: ModifierCondition | undefined, context: Record<string, any>): boolean {
  if (!condition || condition.check === 'always') return true;
  if (condition.check === 'isEqual') return getPath(context, condition.path) === condition.value;
  if (condition.check === 'isPath') return getPath(context, condition.path) != null;
  return true;
}

/**
 * Sums the `value` of any modifier whose `selectors` intersect the provided `selectors`
 * and whose `activeWhen` evaluates to true. `context` is the data used to evaluate
 * `isEqual`/`isPath` (typically the rolling actor's `systemData`).
 */
export function getActiveModifiers(
  modifiers: ItemModifier[],
  selectors: string[],
  context: Record<string, any> = {},
): number {
  return modifiers
    .filter((m) => m.selectors.some((s) => selectors.includes(s)))
    .filter((m) => isConditionActive(m.activeWhen, context))
    .reduce((sum, m) => sum + m.value, 0);
}

/**
 * Collects all `systemData.bonuses` from given items, skipping `suppressed` ones.
 * Opt-in convention: systems not storing `bonuses` simply return [].
 */
export function collectItemModifiers(
  items: Array<{ systemData?: Record<string, any>; suppressed?: boolean }>,
): ItemModifier[] {
  const result: ItemModifier[] = [];
  for (const item of items) {
    if (item.suppressed) continue;
    const bonuses = item.systemData?.bonuses;
    if (Array.isArray(bonuses)) result.push(...bonuses);
  }
  return result;
}
