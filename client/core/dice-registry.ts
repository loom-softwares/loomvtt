/*******************************************************************************
 * LoomVTT
 * client/core/dice-registry.ts
 * 
 * 
 * Registry for custom dice types and terms.
 ******************************************************************************/

import { DiceExpression, DieExpression, FateExpression, ModifierExpression } from './dice-expression.js';

type ExpressionConstructor = new (...args: any[]) => DiceExpression;

class ClientDiceRegistry {
  private kinds = new Map<string, ExpressionConstructor>();

  constructor() {
    this.kinds.set('d', DieExpression);
    this.kinds.set('f', FateExpression);
    this.kinds.set('m', ModifierExpression);
  }

  register(kind: string, exprClass: ExpressionConstructor): void {
    this.kinds.set(kind, exprClass);
  }

  create(kind: string, config?: any): DiceExpression | undefined {
    const Ctor = this.kinds.get(kind);
    if (!Ctor) return;
    return new Ctor(config ?? {});
  }

  has(kind: string): boolean {
    return this.kinds.has(kind);
  }
}

export const diceRegistry = new ClientDiceRegistry();
