/**
 * client/src/lib/dice-client.ts
 * Client-side dice roller — same logic as core/src/dice/roller.ts
 * but runs in the browser so instant feedback is possible before WS confirm.
 */

export type DiceTermResult = {
  kind: 'dice';
  count: number;
  faces: number;
  rolls: number[];
  dropped: boolean[];
  subtotal: number;
  modifier?: string;
};

export type ModifierTerm = { kind: 'modifier'; value: number };
export type RollTerm = DiceTermResult | ModifierTerm;

export type RollResult = {
  formula: string;
  terms: RollTerm[];
  total: number;
  flavor?: string;
};

/** Parse + evaluate a dice formula string in the browser. */
export function rollDice(formula: string, data: Record<string, number> = {}): RollResult {
  let resolved = formula.replace(/@(\w+)/g, (_, k) => (k in data ? String(data[k]) : '0'));

  const terms: RollTerm[] = [];
  let total = 0;

  const TOKEN = /([+-]?\s*\d*d(?:\d+|f)(?:[a-z]{1,2}\d*)?|[+-]?\s*\d+)/gi;
  const tokens = resolved.replace(/\s+/g, '').match(TOKEN) ?? [];

  for (const token of tokens) {
    const dm = token.match(/^([+-]?)(\d*)d(\d+|f)([a-z]{1,2}\d*)?$/i);
    if (dm) {
      const sign  = dm[1] === '-' ? -1 : 1;
      const count = parseInt(dm[2] || '1');
      const isFate = dm[3].toLowerCase() === 'f';
      const faces = isFate ? -1 : parseInt(dm[3]);
      const mod   = (dm[4] ?? '').toLowerCase();

      const rawRolls = Array.from({ length: count }, () =>
        isFate ? Math.floor(Math.random() * 3) - 1 : Math.floor(Math.random() * faces) + 1
      );
      const dropped = new Array<boolean>(count).fill(false);

      if (mod.startsWith('kh') || mod === 'k') {
        const k = parseInt(mod.replace(/kh?/, '') || '1');
        idx([...rawRolls], 'desc').slice(k).forEach(i => { dropped[i] = true; });
      } else if (mod.startsWith('kl')) {
        const k = parseInt(mod.replace('kl', '') || '1');
        idx([...rawRolls], 'asc').slice(k).forEach(i => { dropped[i] = true; });
      } else if (mod.startsWith('dh')) {
        const k = parseInt(mod.replace('dh', '') || '1');
        idx([...rawRolls], 'desc').slice(0, k).forEach(i => { dropped[i] = true; });
      } else if (mod.startsWith('dl') || mod === 'd') {
        const k = parseInt(mod.replace(/dl?/, '') || '1');
        idx([...rawRolls], 'asc').slice(0, k).forEach(i => { dropped[i] = true; });
      }

      const subtotal = sign * rawRolls.reduce((s, v, i) => s + (dropped[i] ? 0 : v), 0);
      total += subtotal;
      terms.push({ kind: 'dice', count, faces, rolls: rawRolls, dropped, subtotal, modifier: mod || undefined });
    } else {
      const val = parseInt(token.replace(/\s/g, ''));
      if (!isNaN(val)) { total += val; terms.push({ kind: 'modifier', value: val }); }
    }
  }

  return { formula, terms, total };
}

function idx(arr: number[], dir: 'asc' | 'desc'): number[] {
  return arr.map((v, i) => ({ v, i }))
    .sort((a, b) => dir === 'asc' ? a.v - b.v : b.v - a.v)
    .map(x => x.i);
}

/** Icon path for a die face count. Falls back to a generic icon if not found. */
export function diceIcon(faces: number): string {
  if (faces === -1) return '/core/icons/dice/df.svg';
  const known = [4, 6, 8, 10, 12, 20, 100];
  const f = known.includes(faces) ? faces : 6;
  return `/core/icons/dice/d${f}.svg`;
}

/** Returns CSS classes for a die result (critical hit/fail highlighting). */
export function dieClass(result: number, faces: number, dropped: boolean): string {
  if (dropped) return 'die-dropped';
  if (faces === -1) {
    if (result === 1) return 'die-max';
    if (result === -1) return 'die-min';
    return 'die-normal';
  }
  if (result === faces) return 'die-max';
  if (result === 1)     return 'die-min';
  return 'die-normal';
}

/** Fate die display string */
export function fateLabel(result: number): string {
  if (result === 1) return '+';
  if (result === -1) return '\u2212';
  return '0';
}
