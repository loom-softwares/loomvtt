/*******************************************************************************
 * LoomVTT
 * client/core/dice-term-bridge.ts
 * 
 * 
 * Bridge for resolving and evaluating dice terms.
 ******************************************************************************/

import { DiceExpression, DieExpression, ModifierExpression, DiceEvaluation } from './dice-expression.js';
import { diceRegistry } from './dice-registry.js';

export interface DiceTermResult {
  result: number;
  index?: number;
  active: boolean;
  discarded?: boolean;
  success?: boolean;
  failure?: boolean;
  critical?: boolean;
  fumble?: boolean;
}

export interface DiceTermEvaluation {
  results: DiceTermResult[];
  total: number;
  formula: string;
  rolls: number[];
  dropped?: boolean[];
  subtotal?: number;
}

export interface DieConfig {
  number?: number;
  faces: number;
  modifiers?: string[];
  results?: Array<number | DiceTermResult>;
  options?: {
    minimum?: number;
    maximum?: number;
    flavor?: string;
    choose?: number;
    displayResults?: boolean;
  };
}

export interface ExtendedDiceEvaluation extends DiceEvaluation {
  results?: DiceTermResult[];
}

/**
 * Die class - bridge over LoomVTT's DieExpression
 * Compatible with WOD5E and other systems that extend dice terms.
 */
export class Die extends DiceExpression {
  static DENOMINATION = 'd';
  static GAME_SYSTEM?: string;
  static DIE_TYPE?: string;

  number: number;
  faces: number;
  modifiers: string[];
  results: DiceTermResult[];
  options: {
    minimum: number;
    maximum: number;
    flavor?: string;
    choose?: number;
    displayResults: boolean;
  };

  _evaluated: boolean;
  _evaluationCache?: DiceEvaluation & DiceTermEvaluation;

  constructor(termData: DieConfig = { faces: 10 }) {
    super();

    this._evaluated = false;
    this.number = termData.number ?? 1;

    // Set defaults
    this.faces = termData.faces || 10;
    this.modifiers = Array.isArray(termData.modifiers) ? [...termData.modifiers] : [];
    this.options = {
      minimum: 1,
      maximum: this.faces,
      displayResults: true,
      ...(termData.options || {})
    };

    // Preset results (e.g. restored from JSON) are kept as-is.
    this.results = Array.isArray(termData.results)
      ? termData.results.map((r, i) =>
        typeof r === 'number'
          ? { result: r, index: i, active: true, discarded: false }
          : { ...r, index: r.index ?? i }
      )
      : [];
  }

  static getResultLabel(result: number): string {
    return String(result);
  }

  /**
   * Evaluate the die roll
   */
  evaluate(options: { minimize?: boolean; maximize?: boolean; async?: boolean } = {}): DiceEvaluation & DiceTermEvaluation {
    if (this._evaluated && this._evaluationCache) {
      return this._evaluationCache;
    }

    // Only roll if we don't have preset results (e.g., from fromData)
    if (this.results.length === 0) {
      const keepMod = this.modifiers.find((m) => /^kh?\d+|^kl\d+|^dh\d+|^dl\d+$/i.test(m));
      const dieExpr = new DieExpression({
        count: this.number,
        faces: this.faces,
        modifier: keepMod || undefined
      });

      const evaluation = dieExpr.evaluate();
      this.results = evaluation.rolls.map((roll, index) => {
        const dropped = !!evaluation.dropped[index];
        return {
          result: roll,
          index,
          active: !dropped,
          discarded: dropped
        };
      });
    }

    // Attach success/failure/critical/fumble metadata
    const threshold = this._csThreshold();
    for (const r of this.results) {
      if (threshold !== null && r.success === undefined) {
        r.success = this._csIsSuccess(r.result, threshold);
        r.failure = !r.success;
      }
      if (this.faces === 10) {
        if (r.critical === undefined) r.critical = r.result === 10;
        if (r.fumble === undefined) r.fumble = r.result === 1;
      }
    }

    // Total: count successes for cs modifiers, otherwise sum active faces
    const total = threshold !== null
      ? this.results.filter((r) => (r.active ?? true) && r.success).length
      : this.results.reduce((sum, r) => sum + ((r.active ?? true) ? r.result : 0), 0);

    const evaluationResult: DiceEvaluation & DiceTermEvaluation = {
      rolls: this.results.map((r) => r.result),
      subtotal: total,
      dropped: this.results.map((r) => !!r.discarded),
      results: this.results,
      total,
      formula: this.getFormula(),
      label: this.getFormula()
    };

    this._evaluated = true;
    this._evaluationCache = evaluationResult;
    return evaluationResult;
  }

  /**
   * Get the formula string
   */
  getFormula(): string {
    const denom = (this.constructor as any).DENOMINATION;
    const face = (typeof denom === 'string' && denom && denom !== 'd') ? denom : this.faces;
    const mods = this.modifiers.length ? this.modifiers.join('') : '';
    return `${this.number}d${face}${mods}`;
  }

  getResultLabel(result: number): string {
    const label = (this.constructor as any).getResultLabel;
    return typeof label === 'function' ? label(result) : String(result);
  }

  toJSON(): object {
    return {
      class: this.constructor.name,
      number: this.number,
      faces: this.faces,
      modifiers: this.modifiers,
      options: this.options,
      results: this.results
    };
  }

  // Convenience accessors
  get total(): number {
    return this.evaluate().total;
  }

  get result(): number {
    return this.results[0]?.result ?? 1;
  }

  // Implement abstract property
  get kind(): string {
    return 'd';
  }

  private _csThreshold(): number | null {
    const m = this.modifiers.find((x) => /^cs[<>=]\d+/.test(x));
    if (!m) return null;
    const value = parseInt(m.replace(/cs[<>=]/, ''), 10);
    return Number.isNaN(value) ? null : value;
  }

  private _csIsSuccess(roll: number, threshold: number): boolean {
    const m = this.modifiers.find((x) => /^cs[<>=]\d+/.test(x)) || '';
    if (m.startsWith('cs>')) return roll > threshold;
    if (m.startsWith('cs<')) return roll < threshold;
    return roll >= threshold;
  }
}

/**
 * WOD5E-style base die - extends Die with WOD5E-specific behavior
 */
export class WOD5eDie extends Die {
  static DENOMINATION = 'w';
  static GAME_SYSTEM = 'wod5e';
  static DIE_TYPE = 'wod';

  constructor(termData: DieConfig) {
    super({
      ...termData,
      faces: 10, // Force 10 faces for WOD5E
      modifiers: termData.modifiers || ['cs>5'] // Default success counting
    });
  }

  get gameSystem(): string | undefined {
    return (this.constructor as any).GAME_SYSTEM;
  }

  get dieType(): string | undefined {
    return (this.constructor as any).DIE_TYPE;
  }

  getResultLabel(result: number): string {
    // WOD5E-style result labels
    if (result === 10) return '⭐';
    if (result === 1) return '💀';
    if (result >= 6) return '✓';
    return '✗';
  }

  // Implement abstract property
  get kind(): string {
    return 'w';
  }
}

// WOD5E subclasses
export class MortalDie extends WOD5eDie {
  static DENOMINATION = 'm';
  static DIE_TYPE = 'mortal';

  get kind(): string {
    return 'm';
  }
}

export class VampireDie extends WOD5eDie {
  static DENOMINATION = 'v';
  static DIE_TYPE = 'vampire';

  get kind(): string {
    return 'v';
  }
}

export class VampireHungerDie extends WOD5eDie {
  static DENOMINATION = 'vh';
  static DIE_TYPE = 'vampire-hunger';

  get kind(): string {
    return 'vh';
  }
}

export class HunterDie extends WOD5eDie {
  static DENOMINATION = 'h';
  static DIE_TYPE = 'hunter';

  get kind(): string {
    return 'h';
  }
}

export class HunterDesperationDie extends WOD5eDie {
  static DENOMINATION = 'hd';
  static DIE_TYPE = 'hunter-desperation';

  get kind(): string {
    return 'hd';
  }
}

export class WerewolfDie extends WOD5eDie {
  static DENOMINATION = 'w';
  static DIE_TYPE = 'werewolf';

  get kind(): string {
    return 'w';
  }
}

export class WerewolfRageDie extends WOD5eDie {
  static DENOMINATION = 'wr';
  static DIE_TYPE = 'werewolf-rage';

  get kind(): string {
    return 'wr';
  }
}

/**
 * Local denomination registry used when `CONFIG.Dice.terms` (the runtime
 * registry populated by converted systems on init) is not available — e.g.
 * in node/unit-test environments. Real systems override via CONFIG.
 */
const LOCAL_DICE = new Map<string, typeof Die>();

/**
 * LoomVTT Roll class - implementation for systems like WOD5E
 * Origin-compatible contract consumed by `system-rolls.js`:
 * - `this.dice`  -> dice terms as instances of `Die` (basic + advanced)
 * - `this.terms` -> `[basicDie, '+', advancedDie]` (used by rerolls)
 * - each result: `{ result, index, active, discarded, success, failure }`
 */
export class LoomRoll {
  system: string | undefined;
  protected _formula: string;
  protected _data: Record<string, any>;
  protected _options: Record<string, any>;
  protected _total = 0;
  protected _dice: Die[] = [];
  protected _terms: (Die | string)[] = [];
  protected _evaluated = false;

  constructor(formula: string, data: Record<string, any> = {}, options: Record<string, any> = {}) {
    this._formula = String(formula ?? '');
    this._data = data || {};
    this._options = options || {};
    this.system = options.system;
    this._total = 0;

    // Replace @attribute tokens in the formula using the provided data dictionary
    this.replaceFormulaData(this._data);
    this._parseFormula();
    this._validateSystem();
  }

  /**
   * Parse the formula and populate `_dice` (terms) and `_terms`.
   * WOD5E: `${basicCount}d${denom}cs>5[ + ${advancedCount}d${denom}cs>5khN]`
   */
  private _parseFormula(): void {
    this._dice = [];
    this._terms = [];

    for (const group of this._formula.split('+')) {
      const piece = group.trim();
      if (!piece) continue;
      const die = this._parseDieTerm(piece);
      if (!die) continue;
      if (this._dice.length > 0) this._terms.push('+');
      this._terms.push(die);
      this._dice.push(die);
    }
  }

  private _parseDieTerm(term: string): Die | null {
    // Plain dice: "5d10", "2d6+..." — resolve to base Die with explicit faces
    const plain = term.match(/^(\d*)d(\d+)(.*)$/i);
    if (plain) {
      const [, countStr, facesStr, mods] = plain;
      return new Die({
        number: countStr ? parseInt(countStr, 10) : 1,
        faces: parseInt(facesStr, 10),
        modifiers: this._parseModifiers(mods)
      });
    }

    // Denomination dice: "5dvcs>5", "2dgcs>5kh2", "1w" etc.
    const diceMatch = term.match(/^(\d*)d([a-zA-Z]+?)((?:cs[<>=]\d+c?|kh?\d+|kl\d+|dh\d+|dl\d+)*)$/i);
    if (!diceMatch) return null;
    const [, countStr, denom, modPart] = diceMatch;
    const number = countStr ? parseInt(countStr, 10) : 1;
    const DieClass = this._getDieClass(denom);
    return new DieClass({
      number,
      faces: 10,
      modifiers: this._parseModifiers(modPart)
    });
  }

  private _parseModifiers(mods: string): string[] {
    const found: string[] = [];
    const re = /cs[<>=]\d+c?|kh?\d+|kl\d+|dh\d+|dl\d+/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(mods || '')) !== null) found.push(m[0]);
    if (found.length === 0 && mods) found.push(mods);
    return found;
  }

  /**
   * Get the Die class for a given denomination. Runtime systems register
   * their dice in `CONFIG.Dice.terms` (e.g. wod5e no init); fall back to the
   * local registry (node/unit-test environments) and finally to `Die`.
   */
  private _getDieClass(denom: string): typeof Die {
    const cfg = (globalThis as any).CONFIG?.Dice?.terms;
    if (cfg && cfg[denom]) return cfg[denom] as typeof Die;
    const local = LOCAL_DICE.get(denom);
    if (local) return local;
    return Die;
  }

  /**
   * Validate that all dice belong to the same system.
   */
  private _validateSystem(): void {
    const systems = new Set<string>();
    for (const die of this._dice) {
      const gs = (die as any).gameSystem ?? (die.constructor as any).GAME_SYSTEM;
      if (gs) systems.add(gs);
    }
    if (this.system !== undefined) {
      for (const gs of systems) {
        if (gs !== this.system) {
          throw new Error('Dice are not compatible with this roll');
        }
      }
    } else if (systems.size === 1) {
      this.system = systems.values().next().value;
    } else if (systems.size > 1) {
      throw new Error('Multiple systems detected in dice');
    }
  }

  /**
   * Evaluate the roll (internal hook — subclasses like `WOD5eRoll` extend it)
   */
  async _evaluate(options: Record<string, any> = {}): Promise<this> {
    for (const die of this._dice) {
      die.evaluate(options);
    }
    this._total = this._evaluateTotal();
    this._evaluated = true;
    return this;
  }

  _evaluateTotal(): number {
    return this._dice.reduce((sum, die) => sum + (die.total || 0), 0);
  }

  /**
   * Evaluate the roll and return itself (public signature)
   */
  async roll(options: Record<string, any> = {}): Promise<LoomRoll> {
    await this._evaluate(options);
    return this;
  }

  /**
   * Get the total result of the roll
   */
  get total(): number {
    return this._total;
  }

  /**
   * Get the formula string
   */
  get formula(): string {
    return this._formula;
  }

  get data(): Record<string, any> {
    return this._data;
  }

  /**
   * Foundry's real `Roll` exposes the constructor's third argument as
   * `.options` (title, flavor, difficulty, etc. for system-specific rulesets
   * to read back). `_options` alone left every subclass reading `.options`
   * silently getting `undefined` and falling back to generic placeholder text.
   */
  get options(): Record<string, any> {
    return this._options;
  }

  /**
   * Get the dice terms used in this roll
   */
  get dice(): Die[] {
    return this._dice;
  }

  /**
   * Get the ordered term list — `[basicDie, '+', advancedDie]`, mirroring the
   * layout the legacy reroll code expects (`terms[0]`, `terms[2]`).
   */
  get terms(): (Die | string)[] {
    return this._terms;
  }

  /**
   * Evaluate the roll and return itself — public signature
   * (`await roll.evaluate()`), the most common method in converted systems.
   * Internally delegates to the protected `_evaluate(options)` where subclasses
   * can inject extra logic without duplicating the public signature.
   */
  async evaluate(options: Record<string, any> = {}): Promise<LoomRoll> {
    await this._evaluate(options);
    return this;
  }

  // Static factory method
  static async create(formula: string, data: Record<string, any> = {}, options: Record<string, any> = {}): Promise<LoomRoll> {
    const RollClass = this as unknown as typeof LoomRoll;
    const roll = new RollClass(formula, data, options);
    await roll.evaluate();
    return roll;
  }

  // --- API Gaps added from HANDOFF ---

  /**
   * Send this roll to chat as a message.
   */
  async toMessage(messageData: Record<string, any> = {}, options: Record<string, any> = {}): Promise<void> {
    if (!this._evaluated && this._dice.length > 0) {
      await this._evaluate(options);
    }

    const mode = options.rollMode || options.messageMode || 'public';

    const terms: any[] = [];
    for (const d of this._dice) {
      terms.push({
        kind: 'dice',
        count: d.number,
        faces: d.faces,
        rolls: d.results.map((r) => r.result), // the raw numbers
        dropped: d.results.map((r) => !!r.discarded),
        subtotal: d.total,
        modifier: d.modifiers.join('')
      });
    }

    const loomRoll = {
      formula: this._formula,
      terms,
      total: this._total,
      flavor: messageData.flavor,
      mode,
      meta: messageData.meta
    };

    const { wsClient } = await import('./ws-client.js');
    const { dispatchRoll } = await import('../screens/game-hud/roll-dispatch.js');

    const session = wsClient.session || {};

    dispatchRoll({
      worldId: session.worldId || '',
      userId: session.userId || '',
      userName: session.userName || 'Anonymous',
      userColor: session.userColor || '#888',
      formula: String(this._total),
      mode,
      actorId: messageData.speaker?.actor || undefined,
      meta: {
        ...messageData.meta,
        flavor: messageData.flavor,
        originalFormula: this._formula, // Sends the actual formula here to prevent re-rolling
        loomRoll
      }
    });
  }

  /**
   * Return a new Roll instance identical to this one, but without evaluated results.
   */
  clone(): LoomRoll {
    const RollClass = this.constructor as typeof LoomRoll;
    return new RollClass(this._formula, this._data, { system: this.system });
  }

  /**
   * Serialize this Roll into a JSON format.
   */
  toJSON(): object {
    return {
      class: this.constructor.name,
      formula: this._formula,
      data: this._data,
      total: this._total,
      system: this.system,
      dice: this._dice.map((d) => d.toJSON()),
      terms: this._terms.map((t) => (typeof t === 'string' ? t : t.toJSON()))
    };
  }

  /**
   * Reconstruct a Roll instance from JSON without re-evaluating it.
   */
  static fromJSON(json: string | object): LoomRoll {
    const data = typeof json === 'string' ? JSON.parse(json) : json;
    return this.fromData(data);
  }

  /**
   * Reconstruct a Roll instance from a parsed data object.
   */
  static fromData(data: any): LoomRoll {
    const RollClass = this as unknown as typeof LoomRoll;
    const roll = new RollClass(data.formula, data.data, { system: data.system });

    // Restore total
    roll._total = Number(data.total) || 0;

    // Restore dice if available (terms take precedence over dice)
    const diceData: any[] = Array.isArray(data.terms)
      ? data.terms.filter((t: any) => typeof t !== 'string')
      : Array.isArray(data.dice)
        ? data.dice
        : [];
    roll._dice = diceData.map((d: any) => this._restoreDie(d));
    roll._terms = [];
    roll._dice.forEach((die, i) => {
      if (i > 0) roll._terms.push('+');
      roll._terms.push(die);
    });

    return roll;
  }

  private static _restoreDie(data: any): Die {
    const Resolved = this._resolveDieClass(data.class) || Die;
    const die = new Resolved({
      number: data.number ?? 1,
      faces: data.faces ?? 10,
      modifiers: data.modifiers ?? [],
      options: data.options,
      results: data.results ?? []
    });
    die.evaluate(); // Populates totals/caches without re-rolling (results preset)
    return die;
  }

  private static _resolveDieClass(name?: string): typeof Die | undefined {
    if (!name) return undefined;
    const cfg = (globalThis as any).CONFIG?.Dice?.terms;
    if (cfg) {
      const found = Object.values(cfg).find((c: any) => c?.name === name);
      if (found) return found as typeof Die;
    }
    for (const cls of LOCAL_DICE.values()) {
      if (cls.name === name) return cls;
    }
    return undefined;
  }

  /**
   * Create a Roll instance from pre-constructed Die instances.
   */
  static fromTerms(terms: Die[]): LoomRoll {
    const formula = terms.map((t) => t.getFormula()).join(' + ');
    const RollClass = this as unknown as typeof LoomRoll;
    const roll = new RollClass(formula);
    roll._dice = terms;
    roll._terms = [];
    terms.forEach((t, i) => {
      if (i > 0) roll._terms.push('+');
      roll._terms.push(t);
    });
    roll._total = terms.reduce((sum, die) => sum + die.total, 0);
    return roll;
  }

  /**
   * Synchronously evaluate the roll without await.
   */
  evaluateSync(options: Record<string, any> = {}): LoomRoll {
    for (const die of this._dice) {
      die.evaluate(options); // Die.evaluate is synchronous
    }
    this._total = this._dice.reduce((sum, die) => sum + die.total, 0);
    this._evaluated = true;
    return this;
  }

  /**
   * Alter the evaluated result by applying a multiplier and/or addition.
   */
  alter(multiply: number, add: number, options: Record<string, any> = {}): LoomRoll {
    this._total = (this._total * multiply) + add;
    return this;
  }

  /**
   * Re-evaluate the roll to generate a new result.
   */
  async reroll(options: Record<string, any> = {}): Promise<LoomRoll> {
    this._dice = [];
    this._terms = [];
    this._parseFormula();
    await this._evaluate(options);
    return this;
  }

  /**
   * Remove redundant or zero terms from the roll.
   * Documented no-op for now due to simple regex parser.
   */
  simplifyTerms(): LoomRoll {
    return this;
  }

  /**
   * Reset the formula string to match the current terms.
   */
  resetFormula(): string {
    this._formula = this._dice.map((d) => d.getFormula()).join(' + ');
    return this._formula;
  }

  /**
   * Replace @attribute tokens in the formula using the provided data dictionary.
   */
  replaceFormulaData(data: Record<string, any>): void {
    if (!data) return;
    this._formula = this._formula.replace(/@([a-zA-Z0-9_]+)/g, (match, key) => {
      return data[key] !== undefined ? String(data[key]) : match;
    });
  }

  /**
   * Get an HTML string representing the breakdown of the roll.
   */
  async getTooltip(): Promise<string> {
    const tooltipHtml = this._dice.map((t) => {
      const dieLabel = `d${t.faces}`;
      const rollsHtml = t.results.map((r) => `<span class="roll-tooltip-die">${r.result}</span>`).join(' ');
      return `<div class="roll-tooltip-term">
        <span class="roll-tooltip-label">${t.number}${dieLabel}</span>
        <span class="roll-tooltip-rolls">${rollsHtml}</span>
        <span class="roll-tooltip-subtotal">= ${t.total}</span>
      </div>`;
    }).join('');

    return `
      <div class="roll-tooltip">
        <div class="roll-tooltip-header">Roll Breakdown</div>
        <div class="roll-tooltip-content">${tooltipHtml}</div>
        <div class="roll-tooltip-total">Total: ${this._total}</div>
      </div>
    `;
  }

  /**
   * Validates if the given formula string is syntactically sound.
   */
  static validate(formula: string): boolean {
    if (typeof formula !== 'string') return false;
    return /^[0-9a-zA-Z+\-*\/\s()@_.]+$/.test(formula);
  }

  /**
   * Evaluate the roll and set the total to the product of terms.
   */
  async product(): Promise<LoomRoll> {
    await this._evaluate();
    this._total = this._dice.reduce((prod, die) => prod * die.total, 1);
    return this;
  }
}

/**
 * WOD5E-specific Roll class that extends LoomRoll
 */
export class WOD5eRoll extends LoomRoll {
  constructor(formula = '', data = {}, options = {}) {
    super(formula, data, options);
    // System is determined by the dice used or can be explicitly set
    this.system = (options as any).system ?? this._tryCalculateWOD5ESystem();

    // Validate that all dice belong to the WOD5E system
    if (!this.dice.every((d) => {
      const DieClass = d.constructor as any;
      return DieClass.GAME_SYSTEM === 'wod5e' || DieClass.DENOMINATION === 'w';
    })) {
      throw new Error('All dice must belong to the WOD5E system');
    }
  }

  /**
   * Try to calculate the WOD5E system from the dice used
   */
  private _tryCalculateWOD5ESystem(): string {
    const systems = new Set<string>();
    for (const die of this.dice) {
      const gameSystem = (die as any).gameSystem ?? (die.constructor as any).GAME_SYSTEM;
      if (gameSystem) {
        systems.add(gameSystem);
      }
    }

    // Default to WOD5E if no specific system is found
    if (systems.size === 0) {
      return 'wod5e';
    }

    return systems.size === 1 ? systems.values().next().value! : 'wod5e';
  }
}

// Register all dice types with the LoomVTT registry
diceRegistry.register('d', Die);
diceRegistry.register('w', WOD5eDie);
diceRegistry.register('m', MortalDie);
diceRegistry.register('v', VampireDie);
diceRegistry.register('vh', VampireHungerDie);
diceRegistry.register('h', HunterDie);
diceRegistry.register('hd', HunterDesperationDie);
diceRegistry.register('wr', WerewolfDie);

// Local denomination map (fallback when CONFIG.Dice.terms is not populated yet)
LOCAL_DICE.set('w', WerewolfDie);
LOCAL_DICE.set('m', MortalDie);
LOCAL_DICE.set('v', VampireDie);
LOCAL_DICE.set('g', VampireHungerDie);
LOCAL_DICE.set('h', HunterDie);
LOCAL_DICE.set('s', HunterDesperationDie);
LOCAL_DICE.set('r', WerewolfRageDie);
LOCAL_DICE.set('vh', VampireHungerDie);
LOCAL_DICE.set('hd', HunterDesperationDie);
LOCAL_DICE.set('wr', WerewolfRageDie);
LOCAL_DICE.set('d', Die);

// Expose dice API via Loom namespace
declare global {
  interface Window {
    Loom: {
      dice: {
        terms: {
          Die: typeof Die;
          Roll: typeof LoomRoll;
          WOD5eRoll: typeof WOD5eRoll;
        };
      };
    };
  }
}

if (typeof window !== 'undefined') {
  window.Loom = {
    ...window.Loom,
    dice: {
      terms: {
        Die,
        Roll: LoomRoll,
        WOD5eRoll
      }
    }
  };
}

export { Die as loomDie, LoomRoll as loomRoll, WOD5eRoll as wod5eRoll };