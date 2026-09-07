export interface DiceEvaluation {
  rolls: number[];
  subtotal: number;
  label: string;
  dropped: boolean[];
}

export abstract class DiceExpression {
  abstract readonly kind: string;
  abstract evaluate(): DiceEvaluation;
  abstract toJSON(): object;
}

export class DieExpression extends DiceExpression {
  readonly kind = 'd';
  count: number;
  faces: number;
  modifier?: string;

  constructor(config: { count: number; faces: number; modifier?: string }) {
    super();
    this.count = config.count;
    this.faces = config.faces;
    this.modifier = config.modifier;
  }

  evaluate(): DiceEvaluation {
    const rawRolls = Array.from({ length: this.count }, () =>
      Math.floor(Math.random() * this.faces) + 1
    );
    const dropped = new Array(this.count).fill(false);
    const mod = (this.modifier ?? '').toLowerCase();

    if (mod.startsWith('kh') || mod.startsWith('k')) {
      const keep = parseInt(mod.replace(/kh?/, '') || '1');
      const sorted = [...rawRolls].map((v, i) => ({ v, i })).sort((a, b) => b.v - a.v);
      sorted.slice(keep).forEach(({ i }) => { dropped[i] = true; });
    } else if (mod.startsWith('kl')) {
      const keep = parseInt(mod.replace('kl', '') || '1');
      const sorted = [...rawRolls].map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);
      sorted.slice(keep).forEach(({ i }) => { dropped[i] = true; });
    } else if (mod.startsWith('dh')) {
      const drop = parseInt(mod.replace('dh', '') || '1');
      const sorted = [...rawRolls].map((v, i) => ({ v, i })).sort((a, b) => b.v - a.v);
      sorted.slice(0, drop).forEach(({ i }) => { dropped[i] = true; });
    } else if (mod.startsWith('dl') || mod.startsWith('d')) {
      const drop = parseInt(mod.replace(/dl?/, '') || '1');
      const sorted = [...rawRolls].map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);
      sorted.slice(0, drop).forEach(({ i }) => { dropped[i] = true; });
    }

    const subtotal = rawRolls.reduce((sum, v, i) => sum + (dropped[i] ? 0 : v), 0);
    return { rolls: rawRolls, subtotal, label: `${this.count}d${this.faces}${this.modifier ?? ''}`, dropped };
  }

  toJSON(): object {
    return { kind: 'd', count: this.count, faces: this.faces, modifier: this.modifier };
  }
}

export class FateExpression extends DiceExpression {
  readonly kind = 'f';
  count: number;

  constructor(config: { count: number }) {
    super();
    this.count = config.count;
  }

  evaluate(): DiceEvaluation {
    const rawRolls = Array.from({ length: this.count }, () => Math.floor(Math.random() * 3) - 1);
    const dropped = new Array(this.count).fill(false);
    const subtotal = rawRolls.reduce((sum, v) => sum + v, 0);
    return { rolls: rawRolls, subtotal, label: `${this.count}dF`, dropped };
  }

  toJSON(): object {
    return { kind: 'f', count: this.count };
  }
}

export class ModifierExpression extends DiceExpression {
  readonly kind = 'm';
  value: number;

  constructor(config: { value: number }) {
    super();
    this.value = config.value;
  }

  evaluate(): DiceEvaluation {
    return { rolls: [this.value], subtotal: this.value, label: `${this.value > 0 ? '+' : ''}${this.value}`, dropped: [false] };
  }

  toJSON(): object {
    return { kind: 'm', value: this.value };
  }
}
