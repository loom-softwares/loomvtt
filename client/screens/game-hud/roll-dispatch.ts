import { wsClient } from '../../core/ws-client.js';
import { LoomHooks } from '../../core/hooks.js';
import { diceRegistry } from '../../core/dice-registry.js';

type RollMode = 'public' | 'gmroll' | 'blindroll' | 'selfroll';

export interface PreRollContext {
  formula: string;
  mode: RollMode;
  actorId?: string;
  meta?: Record<string, any>;
}

/**
 * Resolve custom dice terms in `{kind:config}` syntax before sending to server.
 * Each term is evaluated client-side via DiceRegistry and replaced by its
 * numeric subtotal. Unknown kinds or invalid JSON are left as-is (no crash).
 *
 * Syntax: `{kind:jsonConfig}`
 *   - Scalar: {myDie:6} → config=6
 *   - Object: {exploding:{"count":1,"faces":6}} → config={count:1,faces:6}
 *   - Array:  {pool:[3,10]} → config=[3,10]
 *
 * Limitation: JSON string values containing `}` will break parsing;
 * avoid `}` inside config strings.
 */
function resolveCustomDiceTerms(formula: string): string {
  const out: string[] = [];
  let i = 0;
  while (i < formula.length) {
    if (formula[i] === '{') {
      const colonIdx = formula.indexOf(':', i + 1);
      if (colonIdx <= i + 1) { out.push(formula[i]); i++; continue; }
      const kind = formula.slice(i + 1, colonIdx);

      let configEnd: number;
      const firstCh = formula[colonIdx + 1];
      if (firstCh === '{' || firstCh === '[') {
        // Object/array config — track matching bracket depth
        const close = firstCh === '{' ? '}' : ']';
        let depth = 1;
        let j = colonIdx + 2;
        for (; j < formula.length; j++) {
          if (formula[j] === '{' || formula[j] === '[') depth++;
          else if (formula[j] === close) {
            depth--;
            if (depth === 0) { j++; break; }
          }
        }
        if (j >= formula.length || formula[j] !== '}') {
          out.push(formula[i]); i++; continue;
        }
        configEnd = j;
      } else {
        // Scalar config — scan until next }
        const j = formula.indexOf('}', colonIdx + 1);
        if (j === -1) { out.push(formula[i]); i++; continue; }
        configEnd = j;
      }

      const jsonStr = formula.slice(colonIdx + 1, configEnd);
      let config: any;
      try { config = JSON.parse(jsonStr); }
      catch { out.push(formula.slice(i, configEnd + 1)); i = configEnd + 1; continue; }

      const expr = diceRegistry.create(kind, config);
      if (!expr) { out.push(formula.slice(i, configEnd + 1)); i = configEnd + 1; continue; }

      const result = expr.evaluate();
      out.push(String(result.subtotal));
      i = configEnd + 1;
    } else {
      out.push(formula[i]);
      i++;
    }
  }
  return out.join('');
}

export function dispatchRoll(opts: {
  worldId: string;
  userId: string;
  userName: string;
  userColor: string;
  formula: string;
  mode?: string;
  actorId?: string;
  meta?: Record<string, any>;
}): void {
  const ctx: PreRollContext = {
    formula: resolveCustomDiceTerms(opts.formula),
    mode: (opts.mode as RollMode) || 'public',
    actorId: opts.actorId,
    meta: opts.meta,
  };

  LoomHooks.callAll('preRoll', ctx);

  wsClient.send('chat.roll', {
    worldId: opts.worldId,
    userId: opts.userId,
    userName: opts.userName,
    userColor: opts.userColor,
    formula: ctx.formula,
    mode: ctx.mode,
    actorId: ctx.actorId,
    meta: ctx.meta,
  });
}

