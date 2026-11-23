import { MathNode, parse as mathParse } from 'mathjs';
import {
  canonicalToLatex,
  expandImplicitMultiplication,
  KNOWN_FUNCTIONS,
  KNOWN_MULTI_CHAR_IDENTS,
  MathToken,
  MathTokenKind,
  normalizeUnicodeToCanonical,
  preprocessMathSyntax,
  tokenizeMathExpression,
} from './SymbolConverter';

export {
  expandImplicitMultiplication,
  KNOWN_FUNCTIONS,
  KNOWN_MULTI_CHAR_IDENTS,
  preprocessMathSyntax,
  tokenizeMathExpression,
};
export type { MathToken, MathTokenKind };

const FORBIDDEN_PATTERN =
  /\b(eval|Function|window|document|globalThis|process|require|import|fetch|XMLHttpRequest|constructor|__proto__|prototype)\b/;

export interface ParsedExpressionResult {
  valid: boolean;
  canonical: string;
  ast: MathNode | null;
  variables: string[];
  error?: string;
}

export interface EvaluatedMathResult {
  ok: boolean;
  canonical: string;
  resultText: string;
  resultLatex: string;
  numericValue?: number;
  isExactFraction?: boolean;
  error?: string;
}

const TRUE_CONSTANTS = new Set([
  'pi',
  'e',
  'i',
  'Infinity',
  'infinity',
  'inf',
  'NaN',
  'true',
  'false',
]);

/**
 * Splits `f(x) = rhs`, `y = rhs`, or `lhs = rhs` cleanly using unified canonical normalization.
 */
export function splitEquationOrFunction(raw: string): {
  isEquation: boolean;
  isFunctionDef: boolean;
  lhsHeader?: string;
  fnName?: string;
  fnParams?: string[];
  lhs?: string;
  rhs: string;
} {
  const canonical = normalizeUnicodeToCanonical(raw);
  if (!canonical.includes('=') || /(?:<=|>=|!=|->)/.test(canonical)) {
    return { isEquation: false, isFunctionDef: false, rhs: raw };
  }
  const eqIdx = canonical.indexOf('=');
  const lhs = canonical.slice(0, eqIdx).trim();
  const rhs = canonical.slice(eqIdx + 1).trim();
  const fnMatch = lhs.match(/^([a-zA-Z]\w*)\s*\(\s*([a-zA-Z]\w*(?:\s*,\s*[a-zA-Z]\w*)*)\s*\)$/);
  if (fnMatch) {
    return {
      isEquation: true,
      isFunctionDef: true,
      lhsHeader: lhs,
      fnName: fnMatch[1],
      fnParams: fnMatch[2].split(',').map((s) => s.trim()),
      lhs,
      rhs,
    };
  }
  return {
    isEquation: true,
    isFunctionDef: false,
    lhs,
    rhs,
  };
}

function wrapDegTrigArgs(expr: string): string {
  const trigRe = /\b(sin|cos|tan|cot|sec|csc)\s*\(/g;
  let out = '';
  let lastIdx = 0;
  let m: RegExpExecArray | null;
  while ((m = trigRe.exec(expr)) !== null) {
    const fnStart = m.index;
    const openParenIdx = trigRe.lastIndex - 1;
    let depth = 1;
    let i = openParenIdx + 1;
    while (i < expr.length && depth > 0) {
      if (expr[i] === '(') depth++;
      else if (expr[i] === ')') depth--;
      i++;
    }
    if (depth === 0) {
      const innerRaw = expr.slice(openParenIdx + 1, i - 1);
      const inner = wrapDegTrigArgs(innerRaw);
      out += expr.slice(lastIdx, fnStart) + `${m[1]}((${inner})*pi/180)`;
      lastIdx = i;
      trigRe.lastIndex = i;
    }
  }
  out += expr.slice(lastIdx);
  return out;
}

/**
 * Converts expression to nerdamer CAS input where `log()` is natural log.
 * Maps `ln(x)` -> `log(x)` and `log(x)` -> `log10(x)` safely via placeholder.
 */
export function toNerdamerInput(raw: string, angleUnit: 'rad' | 'deg' = 'rad'): string {
  let expr = preprocessMathSyntax(raw);
  if (!expr) return '';
  expr = expr
    .replace(/\bln\s*\(/g, '__SPARK_LN__(')
    .replace(/\blog\s*\(/g, 'log10(')
    .replace(/__SPARK_LN__\(/g, 'log(');

  if (angleUnit === 'deg') {
    expr = wrapDegTrigArgs(expr);
  }
  return expr;
}

function checkBalancedDelimiters(input: string): string | null {
  const stack: string[] = [];
  const pairs: Record<string, string> = { '(': ')', '[': ']', '{': '}' };
  const closeToOpen: Record<string, string> = { ')': '(', ']': '[', '}': '{' };

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (ch in pairs) stack.push(ch);
    else if (ch in closeToOpen) {
      if (stack.length === 0 || stack[stack.length - 1] !== closeToOpen[ch]) {
        return `Unexpected closing bracket '${ch}' at position ${i + 1}`;
      }
      stack.pop();
    }
  }
  if (stack.length > 0) {
    return `Unclosed bracket '${stack[stack.length - 1]}'`;
  }
  return null;
}

/**
 * Safely parses an untrusted mathematical expression into a mathjs AST.
 * Never invokes eval() or new Function().
 */
export function parseSafeExpression(raw: string): ParsedExpressionResult {
  const rawTrimmed = normalizeUnicodeToCanonical(raw);
  if (!rawTrimmed) {
    return { valid: false, canonical: '', ast: null, variables: [], error: 'Empty expression' };
  }
  if (FORBIDDEN_PATTERN.test(rawTrimmed)) {
    return {
      valid: false,
      canonical: rawTrimmed,
      ast: null,
      variables: [],
      error: 'Expression contains disallowed identifier.',
    };
  }

  const delimErr = checkBalancedDelimiters(rawTrimmed);
  if (delimErr) {
    return {
      valid: false,
      canonical: rawTrimmed,
      ast: null,
      variables: [],
      error: delimErr,
    };
  }

  const canonical = preprocessMathSyntax(raw);
  if (!canonical) {
    return { valid: false, canonical: '', ast: null, variables: [], error: 'Empty expression' };
  }

  try {
    const ast = mathParse(canonical);
    const vars = new Set<string>();
    ast.traverse((node, _path, parent) => {
      if (node.type === 'SymbolNode') {
        const name = (node as MathNode & { name: string }).name;
        const isFuncCallee =
          parent?.type === 'FunctionNode' &&
          (parent as MathNode & { fn?: { name?: string } }).fn === node &&
          KNOWN_FUNCTIONS.has(name);
        if (!isFuncCallee && !TRUE_CONSTANTS.has(name)) {
          vars.add(name);
        }
      }
    });
    return {
      valid: true,
      canonical,
      ast,
      variables: Array.from(vars),
    };
  } catch (err) {
    return {
      valid: false,
      canonical,
      ast: null,
      variables: [],
      error: err instanceof Error ? err.message : 'Syntax error in expression',
    };
  }
}

export function cleanFloatNoise(val: number): number {
  if (!Number.isFinite(val)) return val;
  if (Math.abs(val) < 1e-12) return 0;
  // Clean IEEE 754 noise such as sin(30°) = 0.49999999999999994 -> 0.5
  const rounded12 = Number(val.toPrecision(12));
  const nearestInt = Math.round(rounded12);
  if (Math.abs(rounded12 - nearestInt) < 1e-11) return nearestInt;
  return rounded12;
}

interface Fraction {
  num: bigint;
  den: bigint;
}

function gcdBigInt(a: bigint, b: bigint): bigint {
  let x = a < 0n ? -a : a;
  let y = b < 0n ? -b : b;
  while (y !== 0n) {
    const t = x % y;
    x = y;
    y = t;
  }
  return x === 0n ? 1n : x;
}

function normalizeFrac(num: bigint, den: bigint): Fraction | null {
  if (den === 0n) return null;
  const sign = den < 0n ? -1n : 1n;
  const n = num * sign;
  const d = den * sign;
  const g = gcdBigInt(n, d);
  return { num: n / g, den: d / g };
}

function evalAstFraction(node: MathNode): Fraction | null {
  const anyNode = node as unknown as {
    type: string;
    value?: unknown;
    op?: string;
    fn?: string;
    args?: MathNode[];
    content?: MathNode;
  };

  if (anyNode.type === 'ParenthesisNode' && anyNode.content) {
    return evalAstFraction(anyNode.content);
  }
  if (anyNode.type === 'ConstantNode') {
    const s = String(anyNode.value ?? '');
    if (!/^\d+(\.\d+)?$/.test(s)) return null;
    if (!s.includes('.')) return { num: BigInt(s), den: 1n };
    const [ip, fp] = s.split('.');
    const den = 10n ** BigInt(fp.length);
    const num = BigInt(ip + fp);
    return normalizeFrac(num, den);
  }
  if (anyNode.type === 'OperatorNode' && anyNode.args) {
    if (anyNode.fn === 'unaryMinus' && anyNode.args.length === 1) {
      const inner = evalAstFraction(anyNode.args[0]);
      return inner ? { num: -inner.num, den: inner.den } : null;
    }
    if (anyNode.fn === 'unaryPlus' && anyNode.args.length === 1) {
      return evalAstFraction(anyNode.args[0]);
    }
    if (anyNode.args.length !== 2) return null;
    const L = evalAstFraction(anyNode.args[0]);
    const R = evalAstFraction(anyNode.args[1]);
    if (!L || !R) return null;

    switch (anyNode.op) {
      case '+':
        return normalizeFrac(L.num * R.den + R.num * L.den, L.den * R.den);
      case '-':
        return normalizeFrac(L.num * R.den - R.num * L.den, L.den * R.den);
      case '*':
        return normalizeFrac(L.num * R.num, L.den * R.den);
      case '/':
        return R.num === 0n ? null : normalizeFrac(L.num * R.den, L.den * R.num);
      case '^': {
        if (R.den !== 1n) return null;
        const exp = Number(R.num);
        if (!Number.isInteger(exp) || Math.abs(exp) > 24) return null;
        if (exp === 0) return { num: 1n, den: 1n };
        if (exp > 0) {
          return normalizeFrac(L.num ** BigInt(exp), L.den ** BigInt(exp));
        }
        if (L.num === 0n) return null;
        const absExp = BigInt(-exp);
        return normalizeFrac(L.den ** absExp, L.num ** absExp);
      }
      default:
        return null;
    }
  }
  return null;
}

export function tryEvaluateExactRational(
  raw: string
): { ok: true; text: string; latex: string; numeric: number } | null {
  const parsed = parseSafeExpression(raw);
  if (!parsed.valid || !parsed.ast || parsed.variables.length > 0) return null;
  // Use exact rational mode only when expression uses arithmetic ops (+ - * / ^) with at least one division or power
  const frac = evalAstFraction(parsed.ast);
  if (!frac) return null;
  const numeric = Number(frac.num) / Number(frac.den);
  if (!Number.isFinite(numeric)) return null;
  if (frac.den === 1n) {
    const s = frac.num.toString();
    return { ok: true, text: s, latex: s, numeric };
  }
  const neg = frac.num < 0n;
  const absNum = neg ? -frac.num : frac.num;
  const text = `${frac.num.toString()}/${frac.den.toString()}`;
  const latex = `${neg ? '-' : ''}\\frac{${absNum.toString()}}{${frac.den.toString()}}`;
  return { ok: true, text, latex, numeric };
}

export type CompiledEvaluator = (scope: Record<string, unknown>) => unknown;

/**
 * Compiles an expression using mathjs's safe AST compiler with angle-unit support
 * and custom functions (cot, sec, csc, ln, log base-10, etc.) — zero eval() / zero Function().
 */
export function compileSafeEvaluator(
  raw: string,
  angleUnit: 'rad' | 'deg' = 'rad'
): { ok: boolean; evaluator?: CompiledEvaluator; variables: string[]; error?: string } {
  const parsed = parseSafeExpression(raw);
  if (!parsed.valid || !parsed.ast) {
    return { ok: false, variables: [], error: parsed.error || 'Invalid expression' };
  }

  try {
    const compiled = parsed.ast.compile();
    const angleFactor = angleUnit === 'deg' ? Math.PI / 180 : 1;
    const invAngleFactor = angleUnit === 'deg' ? 180 / Math.PI : 1;

    const baseScope: Record<string, unknown> = {
      pi: Math.PI,
      e: Math.E,
      ln: (v: number) => Math.log(v),
      log: (v: number, base?: number) =>
        base === undefined ? Math.log10(v) : Math.log(v) / Math.log(base),
      log10: (v: number) => Math.log10(v),
      log2: (v: number) => Math.log2(v),
      sin: (v: number) => cleanFloatNoise(Math.sin(v * angleFactor)),
      cos: (v: number) => cleanFloatNoise(Math.cos(v * angleFactor)),
      tan: (v: number) => {
        if (angleUnit === 'deg') {
          const mod = ((v % 180) + 180) % 180;
          if (Math.abs(mod - 90) < 1e-9) return NaN;
        }
        return cleanFloatNoise(Math.tan(v * angleFactor));
      },
      cot: (v: number) => cleanFloatNoise(1 / Math.tan(v * angleFactor)),
      sec: (v: number) => cleanFloatNoise(1 / Math.cos(v * angleFactor)),
      csc: (v: number) => cleanFloatNoise(1 / Math.sin(v * angleFactor)),
      asin: (v: number) => cleanFloatNoise(Math.asin(v) * invAngleFactor),
      acos: (v: number) => cleanFloatNoise(Math.acos(v) * invAngleFactor),
      atan: (v: number) => cleanFloatNoise(Math.atan(v) * invAngleFactor),
      atan2: (y: number, x: number) => cleanFloatNoise(Math.atan2(y, x) * invAngleFactor),
      sinh: Math.sinh,
      cosh: Math.cosh,
      tanh: Math.tanh,
      sqrt: Math.sqrt,
      cbrt: Math.cbrt,
      nthRoot: (v: number, n = 2) =>
        v < 0 && n % 2 === 1 ? -Math.pow(-v, 1 / n) : Math.pow(v, 1 / n),
      abs: Math.abs,
      sign: Math.sign,
      floor: Math.floor,
      ceil: Math.ceil,
      round: Math.round,
      exp: Math.exp,
      pow: Math.pow,
      min: Math.min,
      max: Math.max,
    };

    const evaluator: CompiledEvaluator = (scope) => {
      const safeScope = { ...baseScope, ...scope };
      return compiled.evaluate(safeScope);
    };

    return { ok: true, evaluator, variables: parsed.variables };
  } catch (err) {
    return {
      ok: false,
      variables: [],
      error: err instanceof Error ? err.message : 'Failed to compile AST',
    };
  }
}

export function evaluateNumericSafe(
  raw: string,
  scope: Record<string, number> = {},
  angleUnit: 'rad' | 'deg' = 'rad'
): number {
  const res = compileSafeEvaluator(raw, angleUnit);
  if (!res.ok || !res.evaluator) return NaN;
  try {
    const val = res.evaluator(scope);
    if (typeof val === 'number') return Number.isFinite(val) ? cleanFloatNoise(val) : NaN;
    if (val && typeof val === 'object' && 're' in val && 'im' in val) {
      const c = val as { re: number; im: number };
      return Math.abs(c.im) < 1e-10 ? cleanFloatNoise(c.re) : NaN;
    }
    const num = Number(val);
    return Number.isFinite(num) ? cleanFloatNoise(num) : NaN;
  } catch {
    return NaN;
  }
}

/**
 * Unified numerical + exact rational evaluator for mathematical expressions.
 */
export function evaluateMathExpression(
  raw: string,
  opts: { scope?: Record<string, number>; angleUnit?: 'rad' | 'deg' } = {}
): EvaluatedMathResult {
  const { scope = {}, angleUnit = 'rad' } = opts;
  const parsed = parseSafeExpression(raw);
  if (!parsed.valid || !parsed.ast) {
    return {
      ok: false,
      canonical: parsed.canonical,
      resultText: '',
      resultLatex: '',
      error: parsed.error || 'Invalid mathematical expression.',
    };
  }

  const unbound = parsed.variables.filter((v) => !(v in scope));
  if (unbound.length > 0) {
    return {
      ok: false,
      canonical: parsed.canonical,
      resultText: '',
      resultLatex: '',
      error: `Undefined variable${unbound.length > 1 ? 's' : ''}: ${unbound.join(', ')}. Use Simplify / Solve / Differentiate or assign values.`,
    };
  }

  // Exact rational result when applicable (no scope overrides)
  if (Object.keys(scope).length === 0) {
    const exact = tryEvaluateExactRational(raw);
    if (exact) {
      return {
        ok: true,
        canonical: parsed.canonical,
        resultText: exact.text,
        resultLatex: exact.latex,
        numericValue: exact.numeric,
        isExactFraction: exact.text.includes('/'),
      };
    }
  }

  // Compile and run safely
  const comp = compileSafeEvaluator(raw, angleUnit);
  if (!comp.ok || !comp.evaluator) {
    return {
      ok: false,
      canonical: parsed.canonical,
      resultText: '',
      resultLatex: '',
      error: comp.error || 'Failed to evaluate expression.',
    };
  }

  try {
    const rawVal = comp.evaluator(scope);
    if (typeof rawVal === 'number') {
      if (!Number.isFinite(rawVal)) {
        return {
          ok: false,
          canonical: parsed.canonical,
          resultText: '',
          resultLatex: '',
          error: Number.isNaN(rawVal)
            ? 'Undefined mathematical operation (0/0 or domain error).'
            : 'Division by zero or overflow (result is not finite).',
        };
      }
      const clean = cleanFloatNoise(rawVal);
      const text = Number.isInteger(clean) ? String(clean) : String(Number(clean.toFixed(10)));
      return {
        ok: true,
        canonical: parsed.canonical,
        resultText: text,
        resultLatex: text,
        numericValue: clean,
      };
    }

    if (rawVal && typeof rawVal === 'object' && 're' in rawVal && 'im' in rawVal) {
      const c = rawVal as { re: number; im: number };
      const re = cleanFloatNoise(c.re);
      const im = cleanFloatNoise(c.im);
      if (Math.abs(im) < 1e-10) {
        const text = String(re);
        return { ok: true, canonical: parsed.canonical, resultText: text, resultLatex: text, numericValue: re };
      }
      const text = `${re} ${im >= 0 ? '+' : '-'} ${Math.abs(im)}i`;
      return { ok: true, canonical: parsed.canonical, resultText: text, resultLatex: text };
    }

    const str = String(rawVal);
    return {
      ok: true,
      canonical: parsed.canonical,
      resultText: str,
      resultLatex: canonicalToLatex(str),
    };
  } catch (err) {
    return {
      ok: false,
      canonical: parsed.canonical,
      resultText: '',
      resultLatex: '',
      error: err instanceof Error ? err.message : 'Evaluation failed.',
    };
  }
}
