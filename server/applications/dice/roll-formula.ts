/**
 * Parser recursive-descent para fórmulas de dados.
 * Lê a string inteira (incluindo parênteses e funções) e monta a árvore de RollPart.
 *
 * Não reimplementa a lógica de rolagem — delega para DiceGroup que já rola.
 * Reaproveita a regex de @variavel de dice-roller.ts.
 */

import {
  RollPart,
  DiceGroup,
  FlatValue,
  MathOperator,
  RollGroup,
  SuccessPool,
  RollFunction,
  Operator,
} from './roll-parts.js';

type TokenType = 'OP' | 'LPAREN' | 'RPAREN' | 'COMMA' | 'NUMBER' | 'DICE' | 'FUNCTION' | 'EOF';

interface Token {
  type: TokenType;
  value: string;
}

type ComparisonOp = '>' | '>=' | '<' | '<=' | '=';

interface CSInfo {
  op: ComparisonOp;
  value: number;
}

function normalizeOp(op: string): ComparisonOp {
  if (op === '>=' || op === '>' || op === '<=' || op === '<' || op === '=') {
    return op;
  }
  throw new Error(`Unknown comparison operator: ${op}`);
}

/**
 * Substitui @variavel pela data[variavel] (mesma regex do dice-roller.ts original).
 */
function substituteVariables(formula: string, data: Record<string, number> = {}): string {
  return formula.replace(/@([\w.]+)/g, (_, key: string) =>
    key in data ? String(data[key]) : '0'
  );
}

/**
 * Tokenizador: produz tokens respeitando parênteses, funções, números, dados e operadores.
 */
function tokenize(formula: string): Token[] {
  const tokens: Token[] = [];
  const s = formula;
  let i = 0;

  const isDigit = (c: string) => c >= '0' && c <= '9';
  const isAlpha = (c: string) => (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z');

  while (i < s.length) {
    const c = s[i];

    if (c === ' ' || c === '\t' || c === '\n') { i++; continue; }
    if (c === '(') { tokens.push({ type: 'LPAREN', value: c }); i++; continue; }
    if (c === ')') { tokens.push({ type: 'RPAREN', value: c }); i++; continue; }
    if (c === ',') { tokens.push({ type: 'COMMA', value: c }); i++; continue; }
    if (c === '+' || c === '-' || c === '*' || c === '/') {
      tokens.push({ type: 'OP', value: c }); i++; continue;
    }

    // Dice (count optional): [0-9]*d([0-9]+|f)[modifiers...]
    if (c === 'd' || c === 'D' || isDigit(c)) {
      const start = i;
      let countStr = '';

      while (i < s.length && isDigit(s[i])) { countStr += s[i]; i++; }

      if (i < s.length && (s[i] === 'd' || s[i] === 'D')) {
        i++; // skip d/D

        // Faces: digits or f/F
        if (i < s.length && (s[i] === 'f' || s[i] === 'F')) {
          i++;
        } else {
          let faceDigits = 0;
          while (i < s.length && isDigit(s[i])) { i++; faceDigits++; }
          if (faceDigits === 0) {
            throw new Error(`Invalid dice notation at position ${start}: missing faces after 'd'`);
          }
        }

        // Modifiers: [a-z\d>=<]+
        while (i < s.length && (isAlpha(s[i]) || isDigit(s[i]) || s[i] === '>' || s[i] === '<' || s[i] === '=')) {
          i++;
        }

        tokens.push({ type: 'DICE', value: s.slice(start, i) });
        continue;
      }

      // Pure number
      tokens.push({ type: 'NUMBER', value: countStr });
      continue;
    }

    // Function name
    if (isAlpha(c)) {
      const start = i;
      while (i < s.length && isAlpha(s[i])) { i++; }
      const name = s.slice(start, i).toLowerCase();
      tokens.push({ type: 'FUNCTION', value: name });
      continue;
    }

    throw new Error(`Unexpected character '${c}' at position ${i}`);
  }

  tokens.push({ type: 'EOF', value: '' });
  return tokens;
}

/**
 * Separa cs/cf do restante da string de modificadores.
 * Ex: "kh2cs>4" → { diceMods: "kh2", cs: {op:'>', value:4} }
 */
function splitSuccessModifiers(modStr: string): {
  diceMods: string;
  cs?: CSInfo;
  cf?: CSInfo;
} {
  let mods = modStr;
  let cs: CSInfo | undefined;
  let cf: CSInfo | undefined;

  const csMatch = mods.match(/cs(>=|<=|>|<|=)(\d+)c?/);
  if (csMatch) {
    cs = { op: normalizeOp(csMatch[1]), value: parseInt(csMatch[2], 10) };
    mods = mods.replace(/cs(>=|<=|>|<|=)\d+c?/, '');
  }

  const cfMatch = mods.match(/cf(>=|<=|>|<|=)(\d+)c?/);
  if (cfMatch) {
    cf = { op: normalizeOp(cfMatch[1]), value: parseInt(cfMatch[2], 10) };
    mods = mods.replace(/cf(>=|<=|>|<|=)\d+c?/, '');
  }

  return { diceMods: mods, cs, cf };
}

/**
 * Faz o parse de um token DICE (ex: "4d6kh2cs>4") em um RollPart.
 * DiceGroup é criado (rola os dados) e, se houver cs/cf, envolto em SuccessPool.
 */
function parseDiceToken(value: string): RollPart {
  const m = value.match(/^(\d*)d(\d+|f)(.*)$/i);
  if (!m) throw new Error(`Invalid dice token: ${value}`);

  const count = parseInt(m[1] || '1', 10);
  const isFate = m[2].toLowerCase() === 'f';
  const faces = isFate ? -1 : parseInt(m[2], 10);
  const modStr = m[3].toLowerCase();

  const { diceMods, cs, cf } = splitSuccessModifiers(modStr);

  const dice = new DiceGroup({ count, faces, modifiers: diceMods });

  if (cs && !cf) {
    return new SuccessPool({
      threshold: cs.value,
      comparison: cs.op,
      mode: 'success',
      diceGroup: dice,
    });
  }

  if (cf && !cs) {
    return new SuccessPool({
      threshold: cf.value,
      comparison: cf.op,
      mode: 'failure',
      diceGroup: dice,
    });
  }

  if (cs && cf) {
    const successPool = new SuccessPool({
      threshold: cs.value,
      comparison: cs.op,
      mode: 'success',
      diceGroup: dice,
    });
    const failurePool = new SuccessPool({
      threshold: cf.value,
      comparison: cf.op,
      mode: 'failure',
      diceGroup: dice,
    });
    return new RollGroup([successPool, new MathOperator('-'), failurePool]);
  }

  return dice;
}

/**
 * Avalia uma lista de termos intercalados com MathOperator (+ e - apenas no topo).
 */
function evaluateTopLevel(terms: RollPart[]): number {
  let result = 0;
  let currentOp: Operator = '+';

  for (const term of terms) {
    if (term instanceof MathOperator) {
      currentOp = term.operator;
    } else {
      const val = term.total;
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

class Parser {
  private tokens: Token[];
  private pos = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  private peek(): Token {
    return this.tokens[this.pos];
  }

  private advance(): Token {
    return this.tokens[this.pos++];
  }

  private expect(type: TokenType, value?: string): Token {
    const t = this.peek();
    if (t.type !== type || (value !== undefined && t.value !== value)) {
      throw new Error(`Expected ${type}${value ? ` '${value}'` : ''}, got ${t.type} '${t.value}'`);
    }
    return this.advance();
  }

  /** Expression: lida com + e - (precedência baixa). */
  parseExpression(): RollPart[] {
    const parts: RollPart[] = [this.parseTerm()];

    while (
      this.peek().type === 'OP' &&
      (this.peek().value === '+' || this.peek().value === '-')
    ) {
      const op = this.advance().value as Operator;
      parts.push(new MathOperator(op));
      parts.push(this.parseTerm());
    }

    return parts;
  }

  /** Term: lida com * e / (precedência alta). */
  parseTerm(): RollPart {
    const parts: RollPart[] = [this.parseFactor()];

    while (
      this.peek().type === 'OP' &&
      (this.peek().value === '*' || this.peek().value === '/')
    ) {
      const op = this.advance().value as Operator;
      parts.push(new MathOperator(op));
      parts.push(this.parseFactor());
    }

    if (parts.length === 1) {
      return parts[0];
    }
    return new RollGroup(parts);
  }

  /** Factor: átomos — número, dado, variável, parênteses, função, unário menos. */
  parseFactor(): RollPart {
    const t = this.peek();

    if (t.type === 'NUMBER') {
      this.advance();
      return new FlatValue(parseInt(t.value, 10));
    }

    if (t.type === 'DICE') {
      this.advance();
      return parseDiceToken(t.value);
    }

    if (t.type === 'LPAREN') {
      this.advance();
      const expr = this.parseExpression();
      this.expect('RPAREN');
      if (expr.length === 1) {
        return expr[0];
      }
      return new RollGroup(expr);
    }

    if (t.type === 'FUNCTION') {
      this.advance();
      const name = t.value;
      this.expect('LPAREN');
      const args = this.parseFunctionArgs();
      this.expect('RPAREN');

      const knownFns = ['min', 'max', 'floor', 'ceil', 'round'];
      if (!knownFns.includes(name)) {
        throw new Error(`Unknown function: ${name}`);
      }
      return new RollFunction(name, args);
    }

    if (t.type === 'OP' && t.value === '-') {
      this.advance();
      const operand = this.parseFactor();
      if (operand instanceof FlatValue) {
        return new FlatValue(-operand.value);
      }
      return new RollGroup([new FlatValue(-1), new MathOperator('*'), operand]);
    }

    throw new Error(`Unexpected token: ${t.type} '${t.value}'`);
  }

  /** Argumentos de função separados por vírgula. */
  private parseFunctionArgs(): RollPart[] {
    const args: RollPart[] = [];

    if (this.peek().type === 'RPAREN') {
      return args;
    }

    const expr = this.parseExpression();
    if (expr.length === 1) {
      args.push(expr[0]);
    } else {
      args.push(new RollGroup(expr));
    }

    while (this.peek().type === 'COMMA') {
      this.advance();
      const nextExpr = this.parseExpression();
      if (nextExpr.length === 1) {
        args.push(nextExpr[0]);
      } else {
        args.push(new RollGroup(nextExpr));
      }
    }

    return args;
  }
}

/**
 * RNG determinístico de sequência para testes manuais.
 */
export function createSequenceRng(values: number[]): () => number {
  let idx = 0;
  return () => {
    const v = values[idx % values.length];
    idx++;
    return v;
  };
}

export class RollFormula {
  readonly formula: string;
  readonly terms: RollPart[];
  readonly total: number;

  constructor(formula: string, data: Record<string, number> = {}) {
    this.formula = formula;

    const stripped = formula.replace(/\s+/g, '');
    const resolved = substituteVariables(stripped, data);
    const tokens = tokenize(resolved);

    const parser = new Parser(tokens);
    this.terms = parser.parseExpression();

    this.total = evaluateTopLevel(this.terms);
  }
}
