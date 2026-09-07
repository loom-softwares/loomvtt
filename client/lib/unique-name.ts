/*******************************************************************************
 * LoomVTT
 * client/lib/unique-name.ts
 *
 *
 * Shared helper for "create" flows that skip a name prompt: picks `base` if
 * free, otherwise `base (1)`, `base (2)`, ... — first suffix not already
 * taken among `existing`.
 ******************************************************************************/

export function nextDefaultName(base: string, existing: string[]): string {
  if (!existing.includes(base)) return base;
  let n = 1;
  while (existing.includes(`${base} (${n})`)) n++;
  return `${base} (${n})`;
}
