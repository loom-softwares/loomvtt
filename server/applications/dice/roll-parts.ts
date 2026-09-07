/**
 * Hierarquia de classes que representam um pedaço de fórmula de dado já avaliado.
 * nomenclatura própria.
 *
 * Esta base contém apenas as classes e a lógica de avaliação de cada uma isoladamente.
 * O parser fica em roll-formula.ts (Handoff 2).
 */

export type Operator = '+' | '-' | '*' | '/';

export interface DieResult {
  value: number;
  active: boolean;
  exploded?: boolean;
  rerolled?: boolean;
}

/** Config interno dos modificadores parseados da string (ex: "kh2r3x"). */
interface ParsedModifiers {
  keepHighest: number;
  keepLowest: number;
  dropHighest: number;
  dropLowest: number;
  rerollRecursive: number;
  rerollOnce: number;
  explode: number;
}

export abstract class RollPart {
  abstract readonly total: number;
  abstract get label(): string;
}

function defaultRng(): number {
  return Math.random();
}

function rollOne(faces: number, rng: () => number): number {
  if (faces === -1) {
    return Math.floor(rng() * 3) - 1;
  }
  return Math.floor(rng() * faces) + 1;
}

const REROLL_CAP = 100;
const EXPLODE_CAP = 100;

const MOD_TOKEN = /(ro|kh|kl|dh|dl|r|k|d|x)(\d*)/gi;

function parseModifiers(modStr: string, faces: number): ParsedModifiers {
  const cfg: ParsedModifiers = {
    keepHighest: 0,
    keepLowest: 0,
    dropHighest: 0,
    dropLowest: 0,
    rerollRecursive: 0,
    rerollOnce: 0,
    explode: 0,
  };

  const str = (modStr ?? '').toLowerCase();
  const tokens = Array.from(str.matchAll(MOD_TOKEN));

  for (const m of tokens) {
    const key = m[1];
    const numStr = m[2];
    const num = numStr ? parseInt(numStr, 10) : 0;

    if (key === 'ro') {
      cfg.rerollOnce = num || 1;
    } else if (key === 'r') {
      cfg.rerollRecursive = num || 1;
    } else if (key === 'x') {
      cfg.explode = num || faces;
    } else if (key === 'kh' || key === 'k') {
      cfg.keepHighest = num || 1;
    } else if (key === 'kl') {
      cfg.keepLowest = num || 1;
    } else if (key === 'dh') {
      cfg.dropHighest = num || 1;
    } else if (key === 'dl' || key === 'd') {
      cfg.dropLowest = num || 1;
    }
  }

  return cfg;
}

export class DiceGroup extends RollPart {
  readonly count: number;
  readonly faces: number;
  readonly modifiers: string;
  readonly results: DieResult[];

  constructor(config: {
    count: number;
    faces: number;
    modifiers?: string;
    rng?: () => number;
  }) {
    super();
    this.count = config.count;
    this.faces = config.faces;
    this.modifiers = config.modifiers ?? '';
    this.results = this.buildResults(config);
  }

  private buildResults(config: { count: number; faces: number; modifiers?: string; rng?: () => number }): DieResult[] {
    const rng = config.rng ?? defaultRng;
    const faces = config.faces;
    const modStr = config.modifiers ?? '';

    // 1. Roll initial dice
    let results: DieResult[] = Array.from({ length: config.count }, () => ({
      value: rollOne(faces, rng),
      active: true,
    }));

    // 2. Parse modifiers
    const mods = parseModifiers(modStr, faces);

    // 3. Apply reroll (r = recursive, ro = once)
    results = this.applyReroll(results, faces, rng, mods);
    // 4. Apply explode (x)
    results = this.applyExplode(results, faces, rng, mods);
    // 5. Apply keep/drop (kh, kl, dh, dl)
    this.applyKeepDrop(results, mods);

    return results;
  }

  private applyReroll(
    results: DieResult[],
    faces: number,
    rng: () => number,
    mods: ParsedModifiers,
  ): DieResult[] {
    if (mods.rerollRecursive === 0 && mods.rerollOnce === 0) return results;

    const out: DieResult[] = [];

    for (const die of results) {
      if (!die.active) {
        out.push(die);
        continue;
      }

      let threshold = 0;
      let recursive = false;
      if (mods.rerollRecursive > 0) {
        threshold = mods.rerollRecursive;
        recursive = true;
      } else if (mods.rerollOnce > 0) {
        threshold = mods.rerollOnce;
        recursive = false;
      }

      if (die.value <= threshold) {
        out.push({ value: die.value, active: false, rerolled: true });

        if (recursive) {
          let newVal = rollOne(faces, rng);
          let count = 0;
          while (newVal <= threshold && count < REROLL_CAP) {
            out.push({ value: newVal, active: false, rerolled: true });
            newVal = rollOne(faces, rng);
            count++;
          }
          out.push({ value: newVal, active: true, rerolled: true });
        } else {
          const newVal = rollOne(faces, rng);
          out.push({ value: newVal, active: true, rerolled: true });
        }
      } else {
        out.push(die);
      }
    }

    return out;
  }

  private applyExplode(
    results: DieResult[],
    faces: number,
    rng: () => number,
    mods: ParsedModifiers,
  ): DieResult[] {
    if (mods.explode === 0) return results;
    if (faces === -1) return results;

    const threshold = mods.explode;
    const out: DieResult[] = [];

    for (const die of results) {
      out.push(die);

      if (die.active && die.value >= threshold) {
        let count = 0;
        let newVal = rollOne(faces, rng);
        while (newVal >= threshold && count < EXPLODE_CAP) {
          out.push({ value: newVal, active: true, exploded: true });
          newVal = rollOne(faces, rng);
          count++;
        }
        out.push({ value: newVal, active: true, exploded: true });
      }
    }

    return out;
  }

  private applyKeepDrop(results: DieResult[], mods: ParsedModifiers): void {
    const activeEntries = results
      .map((r, i) => ({ value: r.value, index: i }))
      .filter((d) => results[d.index].active);

    if (mods.keepHighest > 0) {
      const sorted = [...activeEntries].sort((a, b) => b.value - a.value);
      sorted.slice(mods.keepHighest).forEach((d) => (results[d.index].active = false));
    } else if (mods.keepLowest > 0) {
      const sorted = [...activeEntries].sort((a, b) => a.value - b.value);
      sorted.slice(mods.keepLowest).forEach((d) => (results[d.index].active = false));
    } else if (mods.dropHighest > 0) {
      const sorted = [...activeEntries].sort((a, b) => b.value - a.value);
      sorted.slice(0, mods.dropHighest).forEach((d) => (results[d.index].active = false));
    } else if (mods.dropLowest > 0) {
      const sorted = [...activeEntries].sort((a, b) => a.value - b.value);
      sorted.slice(0, mods.dropLowest).forEach((d) => (results[d.index].active = false));
    }
  }

  get total(): number {
    return this.results.reduce((sum, r) => sum + (r.active ? r.value : 0), 0);
  }

  get label(): string {
    const faceLabel = this.faces === -1 ? 'F' : String(this.faces);
    const modLabel = this.modifiers;
    const vals = this.results.map((r) => r.value).join(', ');
    return `${this.count}d${faceLabel}${modLabel} [${vals}]`;
  }
}

export class FlatValue extends RollPart {
  readonly value: number;

  constructor(value: number) {
    super();
    this.value = value;
  }

  get total(): number {
    return this.value;
  }

  get label(): string {
    return `${this.value >= 0 ? '+' : ''}${this.value}`;
  }
}

export class MathOperator extends RollPart {
  readonly operator: Operator;

  constructor(operator: Operator) {
    super();
    this.operator = operator;
  }

  get total(): number {
    throw new Error('MathOperator has no total; resolved during parsing');
  }

  get label(): string {
    return this.operator;
  }
}

export class RollGroup extends RollPart {
  readonly inner: RollPart[];

  constructor(inner: RollPart[]) {
    super();
    this.inner = inner;
  }

  get total(): number {
    let result = 0;
    let currentOp: Operator = '+';

    for (const part of this.inner) {
      if (part instanceof MathOperator) {
        currentOp = part.operator;
      } else {
        const val = part.total;
        switch (currentOp) {
          case '+': result += val; break;
          case '-': result -= val; break;
          case '*': result *= val; break;
          case '/': result /= val; break;
        }
      }
    }

    return result;
  }

  get label(): string {
    return `(${this.inner.map((p) => p.label).join(' ')})`;
  }
}

export class SuccessPool extends RollPart {
  readonly threshold: number;
  readonly comparison: '>' | '>=' | '<' | '<=' | '=';
  readonly mode: 'success' | 'failure';
  readonly diceGroup: DiceGroup;

  constructor(config: {
    threshold: number;
    comparison: '>' | '>=' | '<' | '<=' | '=';
    mode: 'success' | 'failure';
    diceGroup: DiceGroup;
  }) {
    super();
    this.threshold = config.threshold;
    this.comparison = config.comparison;
    this.mode = config.mode;
    this.diceGroup = config.diceGroup;
  }

  get total(): number {
    return this.diceGroup.results.reduce((count, r) => {
      if (!r.active) return count;
      const v = r.value;
      let hit: boolean;
      switch (this.comparison) {
        case '>': hit = v > this.threshold; break;
        case '>=': hit = v >= this.threshold; break;
        case '<': hit = v < this.threshold; break;
        case '<=': hit = v <= this.threshold; break;
        case '=': hit = v === this.threshold; break;
        default: hit = false;
      }
      return count + (hit ? 1 : 0);
    }, 0);
  }

  get label(): string {
    const cmpMap: Record<string, string> = {
      '>': '>',
      '>=': '\u2265',
      '<': '<',
      '<=': '\u2264',
      '=': '=',
    };
    const prefix = this.mode === 'success' ? 'cs' : 'cf';
    return `${this.diceGroup.label} ${prefix}${cmpMap[this.comparison]}${this.threshold}`;
  }
}

export class RollFunction extends RollPart {
  readonly name: string;
  readonly args: RollPart[];

  constructor(name: string, args: RollPart[]) {
    super();
    this.name = name;
    this.args = args;
  }

  get total(): number {
    const vals = this.args.map((a) => a.total);
    const fn = this.name.toLowerCase();

    switch (fn) {
      case 'min':
        return Math.min(...vals);
      case 'max':
        return Math.max(...vals);
      case 'floor':
        return Math.floor(vals[0]);
      case 'ceil':
        return Math.ceil(vals[0]);
      case 'round':
        return Math.round(vals[0]);
      default:
        throw new Error(`Unknown function: ${this.name}`);
    }
  }

  get label(): string {
    return `${this.name}(${this.args.map((a) => a.label).join(', ')})`;
  }
}
