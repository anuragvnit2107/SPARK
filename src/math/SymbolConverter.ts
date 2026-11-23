import { MathNode, parse as mathParse } from 'mathjs';

const FORBIDDEN_PATTERN =
  /\b(eval|Function|window|document|globalThis|process|require|import|fetch|XMLHttpRequest|constructor|__proto__|prototype)\b/;

export type MathTokenKind = 'number' | 'ident' | 'op' | 'paren' | 'comma';

export interface MathToken {
  kind: MathTokenKind;
  value: string;
}

export const KNOWN_FUNCTIONS = new Set([
  'sin',
  'cos',
  'tan',
  'cot',
  'sec',
  'csc',
  'asin',
  'acos',
  'atan',
  'atan2',
  'sinh',
  'cosh',
  'tanh',
  'asinh',
  'acosh',
  'atanh',
  'sqrt',
  'cbrt',
  'nthRoot',
  'abs',
  'sign',
  'floor',
  'ceil',
  'round',
  'exp',
  'log',
  'log10',
  'log2',
  'ln',
  'max',
  'min',
  'mod',
  'pow',
  'factorial',
  'gamma',
  'erf',
  're',
  'im',
  'arg',
  'conj',
  'det',
  'inv',
  'transpose',
  'trace',
  'cross',
  'dot',
  'norm',
  'sum',
  'integrate',
  'defint',
  'limit',
  'diff',
  'partial',
]);

export const KNOWN_MULTI_CHAR_IDENTS = new Set([
  ...KNOWN_FUNCTIONS,
  'pi',
  'theta',
  'alpha',
  'beta',
  'gamma',
  'delta',
  'epsilon',
  'lambda',
  'omega',
  'sigma',
  'phi',
  'Infinity',
  'infinity',
  'inf',
  'NaN',
  'true',
  'false',
]);

const SUPERSCRIPT_MAP: Record<string, string> = {
  '0': '⁰',
  '1': '¹',
  '2': '²',
  '3': '³',
  '4': '⁴',
  '5': '⁵',
  '6': '⁶',
  '7': '⁷',
  '8': '⁸',
  '9': '⁹',
  '+': '⁺',
  '-': '⁻',
  '(': '⁽',
  ')': '⁾',
  n: 'ⁿ',
  i: 'ⁱ',
};

const SUBSCRIPT_MAP: Record<string, string> = {
  '0': '₀',
  '1': '₁',
  '2': '₂',
  '3': '₃',
  '4': '₄',
  '5': '₅',
  '6': '₆',
  '7': '₇',
  '8': '₈',
  '9': '₉',
  '+': '₊',
  '-': '₋',
  '(': '₍',
  ')': '₎',
};

const INV_SUPERSCRIPT_MAP: Record<string, string> = Object.fromEntries(
  Object.entries(SUPERSCRIPT_MAP).map(([k, v]) => [v, k])
);
const INV_SUBSCRIPT_MAP: Record<string, string> = Object.fromEntries(
  Object.entries(SUBSCRIPT_MAP).map(([k, v]) => [v, k])
);

const SYMBOL_KEYWORDS: Array<[RegExp, string]> = [
  [/\binfinity\b/g, '∞'],
  [/\bpartial\b/g, '∂'],
  [/\bnabla\b/g, '∇'],
  [/\btheta\b/g, 'θ'],
  [/\balpha\b/g, 'α'],
  [/\bbeta\b/g, 'β'],
  [/\bgamma\b/g, 'γ'],
  [/\bdelta\b/g, 'δ'],
  [/\bepsilon\b/g, 'ε'],
  [/\blambda\b/g, 'λ'],
  [/\bomega\b/g, 'ω'],
  [/\bsigma\b/g, 'σ'],
  [/\bphi\b/g, 'φ'],
  [/\bpi\b/g, 'π'],
  [/\bsum\b/g, '∑'],
  [/\bint\b/g, '∫'],
  [/\bsqrt\(/g, '√('],
  [/!=/g, '≠'],
  [/<=/g, '≤'],
  [/>=/g, '≥'],
  [/\+-/g, '±'],
  [/->/g, '→'],
];

const GREEK_KEYWORD_MAP: Record<string, string> = {
  pi: 'π',
  theta: 'θ',
  alpha: 'α',
  beta: 'β',
  gamma: 'γ',
  delta: 'δ',
  epsilon: 'ε',
  lambda: 'λ',
  omega: 'ω',
  sigma: 'σ',
  phi: 'φ',
  infinity: '∞',
  inf: '∞',
};

/**
 * Context-aware keyboard input shortcut converter.
 * Only converts complete trailing tokens right before the cursor so typing mid-word
 * (e.g. "integer", "pilot", "alphabet") is never corrupted, and preserves cursor offset cleanly.
 */
export function convertKeyboardInputAtCursor(
  value: string,
  cursorPos: number
): { nextValue: string; nextCursor: number; changed: boolean } {
  const before = value.slice(0, cursorPos);
  const after = value.slice(cursorPos);

  // 1. Multi-char operator shortcuts immediately before cursor
  const operatorSuffixes: Array<[string, string]> = [
    ['!=', '≠'],
    ['<=', '≤'],
    ['>=', '≥'],
    ['+-', '±'],
    ['->', '→'],
  ];
  for (const [pat, rep] of operatorSuffixes) {
    if (before.endsWith(pat)) {
      const nb = before.slice(0, before.length - pat.length) + rep;
      return {
        nextValue: nb + after,
        nextCursor: nb.length,
        changed: true,
      };
    }
  }

  // 2. Superscripts triggered for ^digits / ^-digits / ^+digits / ^n, including Greek bases (θ^2 -> θ²)
  const supMatch = before.match(/([a-zA-Z0-9)\]θπαβγδελωσφ])\^([+-]?[0-9n]+)$/);
  if (supMatch && !after.startsWith('^')) {
    const chars = supMatch[2].split('');
    if (chars.every((c) => c in SUPERSCRIPT_MAP)) {
      const converted = chars.map((c) => SUPERSCRIPT_MAP[c]).join('');
      const nb =
        before.slice(0, before.length - supMatch[0].length) + supMatch[1] + converted;
      return {
        nextValue: nb + after,
        nextCursor: nb.length,
        changed: true,
      };
    }
  }
  const supExtendMatch = before.match(/([⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻ⁿⁱ]+)([0-9])$/);
  if (supExtendMatch) {
    const rep = SUPERSCRIPT_MAP[supExtendMatch[2]];
    if (rep) {
      const nb = before.slice(0, before.length - 1) + rep;
      return {
        nextValue: nb + after,
        nextCursor: nb.length,
        changed: true,
      };
    }
  }

  // 3. Subscripts triggered when user types _digits (e.g., a_1, x_12, α_1) or extends trailing subscript digits
  const subMatch = before.match(/([a-zA-Zθπαβγδελωσφ])\s*_([0-9]+)$/);
  if (subMatch) {
    const chars = subMatch[2].split('');
    if (chars.every((c) => c in SUBSCRIPT_MAP)) {
      const converted = chars.map((c) => SUBSCRIPT_MAP[c]).join('');
      const nb =
        before.slice(0, before.length - subMatch[0].length) + subMatch[1] + converted;
      return {
        nextValue: nb + after,
        nextCursor: nb.length,
        changed: true,
      };
    }
  }
  const subExtendMatch = before.match(/([a-zA-Zθπαβγδελωσφ][₀₁₂₃₄₅₆₇₈₉]+)([0-9])$/);
  if (subExtendMatch) {
    const rep = SUBSCRIPT_MAP[subExtendMatch[2]];
    if (rep) {
      const nb = before.slice(0, before.length - 1) + rep;
      return {
        nextValue: nb + after,
        nextCursor: nb.length,
        changed: true,
      };
    }
  }

  // 4. Symbol keywords triggered ONLY after a delimiter (space, operator, comma, paren)
  // so typing "integer" or "alphabet" mid-identifier is untouched.
  const wordDelimiterMatch = before.match(/(^|[^a-zA-Z_])([a-zA-Z]+)([\s()+\-*/^,=<>[\]])$/);
  if (wordDelimiterMatch) {
    const kw = wordDelimiterMatch[2].toLowerCase();
    const delim = wordDelimiterMatch[3];
    const table: Record<string, string> = {
      ...GREEK_KEYWORD_MAP,
      partial: '∂',
      nabla: '∇',
      sum: '∑',
      int: '∫',
    };
    if (kw === 'sqrt' && delim === '(') {
      const nb =
        before.slice(0, before.length - (kw.length + 1)) + '√(';
      return { nextValue: nb + after, nextCursor: nb.length, changed: true };
    }
    if (kw in table) {
      const rep = table[kw];
      const nb =
        before.slice(0, before.length - (kw.length + 1)) + rep + delim;
      return { nextValue: nb + after, nextCursor: nb.length, changed: true };
    }
  }

  return { nextValue: value, nextCursor: cursorPos, changed: false };
}

/**
 * Converts a trailing Greek keyword (e.g. when the user blurs or submits "theta+alpha")
 * without disturbing longer ordinary identifiers.
 */
export function convertTrailingGreekKeyword(value: string): {
  nextValue: string;
  changed: boolean;
} {
  let out = value;
  let changed = false;

  // Convert any delimited Greek words inside the string as well (safe on pasted/filled strings)
  const delimitedReplaced = out.replace(
    /(^|[^a-zA-Z_])(pi|theta|alpha|beta|gamma|delta|epsilon|lambda|omega|sigma|phi|infinity|inf)(?=[^a-zA-Z_]|$)/gi,
    (full, prefix: string, kw: string, offset: number, src: string) => {
      // Skip matrix assignment names like `matrix = ...` (matrix isn't in list anyway)
      // Skip function calls if any (none of these are function names)
      void full;
      void offset;
      void src;
      const rep = GREEK_KEYWORD_MAP[kw.toLowerCase()];
      if (!rep) return full;
      changed = true;
      return `${prefix}${rep}`;
    }
  );
  out = delimitedReplaced;

  return { nextValue: out, changed };
}

/**
 * Converts a display mathematical expression (with Unicode superscripts/subscripts/symbols)
 * into canonical ASCII mathjs / nerdamer syntax.
 */
export function normalizeUnicodeToCanonical(input: string): string {
  let out = input.trim();

  // Convert runs of Unicode superscripts: x² -> x^2 or x⁻² -> x^(-2)
  out = out.replace(/([⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁽⁾ⁿⁱ]+)/g, (seq) => {
    const ascii = seq
      .split('')
      .map((ch) => INV_SUPERSCRIPT_MAP[ch] ?? ch)
      .join('');
    return ascii.length === 1 ? `^${ascii}` : `^(${ascii})`;
  });

  // Convert runs of Unicode subscripts: a₁₂ -> a_12
  out = out.replace(/([₀₁₂₃₄₅₆₇₈₉₊₋₍₎]+)/g, (seq) => {
    const ascii = seq
      .split('')
      .map((ch) => INV_SUBSCRIPT_MAP[ch] ?? ch)
      .join('');
    return `_${ascii}`;
  });

  // Replace Unicode symbols with canonical math identifiers/operators
  out = out
    .replace(/√\s*\(/g, 'sqrt(')
    .replace(/√([a-zA-Z0-9_.]+)/g, 'sqrt($1)')
    .replace(/π/g, 'pi')
    .replace(/θ/g, 'theta')
    .replace(/α/g, 'alpha')
    .replace(/β/g, 'beta')
    .replace(/γ/g, 'gamma')
    .replace(/δ/g, 'delta')
    .replace(/ε/g, 'epsilon')
    .replace(/λ/g, 'lambda')
    .replace(/ω/g, 'omega')
    .replace(/σ/g, 'sigma')
    .replace(/φ/g, 'phi')
    .replace(/∞/g, 'Infinity')
    .replace(/≠/g, '!=')
    .replace(/≤/g, '<=')
    .replace(/≥/g, '>=')
    .replace(/×/g, '*')
    .replace(/·/g, '*')
    .replace(/÷/g, '/')
    .replace(/−/g, '-')
    .replace(/±/g, '+-')
    .replace(/→/g, '->');

  return out;
}

/**
 * Converts canonical ASCII expression into readable mathematical Unicode notation.
 */
export function canonicalToPrettyUnicode(canonical: string): string {
  let out = canonical;
  for (const [re, sym] of SYMBOL_KEYWORDS) {
    out = out.replace(re, sym);
  }
  out = out.replace(/\^([0-9n])/g, (_, d: string) => SUPERSCRIPT_MAP[d] || `^${d}`);
  out = out.replace(/_([0-9]+)/g, (_, digits: string) =>
    digits
      .split('')
      .map((d) => SUBSCRIPT_MAP[d] || d)
      .join('')
  );
  return out;
}

/**
 * Context-safe tokenizer for canonical math strings.
 */
export function tokenizeMathExpression(canonical: string): MathToken[] {
  const tokens: MathToken[] = [];
  let i = 0;
  while (i < canonical.length) {
    const ch = canonical[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }

    // Number (including decimals & scientific notation like 1.5e-4)
    if (/\d/.test(ch) || (ch === '.' && /\d/.test(canonical[i + 1] || ''))) {
      let end = i;
      while (end < canonical.length && /[\d.]/.test(canonical[end])) end++;
      if (
        (canonical[end] === 'e' || canonical[end] === 'E') &&
        /[+-]?\d/.test(canonical.slice(end + 1, end + 3))
      ) {
        end++;
        if (canonical[end] === '+' || canonical[end] === '-') end++;
        while (end < canonical.length && /\d/.test(canonical[end])) end++;
      }
      tokens.push({ kind: 'number', value: canonical.slice(i, end) });
      i = end;
      continue;
    }

    // Identifier (including subscripted variables like a_1, x_12 or shorthand powers like a2, x2)
    if (/[a-zA-Z_]/.test(ch)) {
      let end = i + 1;
      while (end < canonical.length && /[a-zA-Z0-9_]/.test(canonical[end])) end++;
      tokens.push({ kind: 'ident', value: canonical.slice(i, end) });
      i = end;
      continue;
    }

    // Multi-char relational operators
    const two = canonical.slice(i, i + 2);
    if (two === '<=' || two === '>=' || two === '!=' || two === '+-' || two === '->') {
      tokens.push({ kind: 'op', value: two });
      i += 2;
      continue;
    }

    if (ch === '(' || ch === ')' || ch === '[' || ch === ']' || ch === '{' || ch === '}') {
      tokens.push({ kind: 'paren', value: ch });
      i++;
      continue;
    }

    if (ch === ',') {
      tokens.push({ kind: 'comma', value: ch });
      i++;
      continue;
    }

    tokens.push({ kind: 'op', value: ch });
    i++;
  }
  return tokens;
}

function expandSideImplicitMultiplication(side: string): string {
  const tokens = tokenizeMathExpression(side);
  if (tokens.length === 0) return side.trim();

  // Expand shorthand power identifiers (e.g. a2 -> a^2, x2 -> x^2, ab2 -> a*b^2)
  // and multi-letter variable clusters (e.g. 3ab -> 3*a*b) while preserving
  // known functions (log10, log2, atan2), Greek names, and explicit subscripts (a_1).
  const expanded: MathToken[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    const next = tokens[i + 1];
    const isFuncCall =
      next?.kind === 'paren' && next.value === '(' && KNOWN_FUNCTIONS.has(tok.value);

    if (
      tok.kind === 'ident' &&
      !KNOWN_MULTI_CHAR_IDENTS.has(tok.value) &&
      !tok.value.includes('_') &&
      !isFuncCall
    ) {
      const powMatch = tok.value.match(/^([a-zA-Z]+)(\d+)$/);
      if (powMatch) {
        const [, alphaPart, powDigits] = powMatch;
        if (KNOWN_MULTI_CHAR_IDENTS.has(alphaPart)) {
          expanded.push({ kind: 'ident', value: alphaPart });
        } else {
          for (const ch of alphaPart.split('')) {
            expanded.push({ kind: 'ident', value: ch });
          }
        }
        expanded.push({ kind: 'op', value: '^' });
        expanded.push({ kind: 'number', value: powDigits });
        continue;
      }

      if (tok.value.length > 1 && /^[a-zA-Z]+$/.test(tok.value)) {
        for (const ch of tok.value.split('')) {
          expanded.push({ kind: 'ident', value: ch });
        }
        continue;
      }
    }

    expanded.push(tok);
  }

  const parts: string[] = [];
  for (let i = 0; i < expanded.length; i++) {
    const cur = expanded[i];
    const prev = i > 0 ? expanded[i - 1] : null;

    if (prev) {
      const prevIsValueEnd =
        prev.kind === 'number' ||
        prev.kind === 'ident' ||
        (prev.kind === 'paren' && (prev.value === ')' || prev.value === ']')) ||
        (prev.kind === 'op' && prev.value === '!');
      const curIsValueStart =
        cur.kind === 'number' ||
        cur.kind === 'ident' ||
        (cur.kind === 'paren' && cur.value === '(');

      const isKnownFuncCall =
        prev.kind === 'ident' &&
        KNOWN_FUNCTIONS.has(prev.value) &&
        cur.kind === 'paren' &&
        cur.value === '(';

      if (prevIsValueEnd && curIsValueStart && !isKnownFuncCall) {
        parts.push('*');
      }
    }

    parts.push(cur.value);
  }

  return parts.join('');
}

/**
 * Context-safe implicit multiplication & shorthand power expansion across expressions,
 * equations, and inequalities. Preserves function calls (`sin(x)`), `f(x)=` headers,
 * subscripts (`a_1`), matrices (`[[1,2],[3,4]]`), and scientific notation (`1e-5`).
 */
export function expandImplicitMultiplication(rawCanonical: string): string {
  const trimmed = rawCanonical.trim();
  if (!trimmed) return '';
  if (FORBIDDEN_PATTERN.test(trimmed)) return trimmed;

  // Preserve matrix literal syntax untouched
  if (/^\s*([a-zA-Z_][a-zA-Z0-9_]*\s*=\s*)?\[\[[\s\S]*\]\]\s*$/.test(trimmed)) {
    return trimmed;
  }

  // Handle relationals (=, !=, <=, >=, <, >)
  const relMatch = trimmed.match(/^(.+?)\s*(<=|>=|!=|=|<|>)\s*(.+)$/);
  if (relMatch) {
    const lhsRaw = relMatch[1].trim();
    const op = relMatch[2];
    const rhsRaw = relMatch[3].trim();
    // Preserve function definitions on LHS like f(x) = ... or g(x, y) = ...
    const isFuncHeader = /^[a-zA-Z]\w*\s*\(\s*[a-zA-Z]\w*(?:\s*,\s*[a-zA-Z]\w*)*\s*\)$/.test(lhsRaw);
    const lhs = isFuncHeader ? lhsRaw : expandSideImplicitMultiplication(lhsRaw);
    const rhs = expandSideImplicitMultiplication(rhsRaw);
    return `${lhs} ${op} ${rhs}`;
  }

  return expandSideImplicitMultiplication(trimmed);
}

/**
 * Unified plain-text preprocessing:
 * Unicode -> Canonical ASCII -> |x| -> abs(x) -> context-safe implicit multiplication & shorthand powers.
 * Preserves distinction between `log(x)` (base-10) and `ln(x)` (base-e).
 */
export function preprocessMathSyntax(raw: string): string {
  let expr = normalizeUnicodeToCanonical(raw);
  if (!expr) return '';
  if (FORBIDDEN_PATTERN.test(expr)) return expr;

  // Simple non-nested absolute value bars |...|
  expr = expr.replace(/\|([^|]+)\|/g, 'abs($1)');

  // Replace unicode-converted infinity keyword
  expr = expr.replace(/\binfinity\b/gi, 'Infinity');

  expr = expandImplicitMultiplication(expr);
  return expr;
}

function matrixLiteralToLatex(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed.startsWith('[[')) return null;
  try {
    const cleaned = trimmed.replace(/\s+/g, '');
    if (!cleaned.endsWith(']]')) return null;
    const inner = cleaned.slice(1, -1);
    const rows = inner.match(/\[[^\]]+\]/g);
    if (!rows || rows.length === 0) return null;
    const body = rows
      .map((r) =>
        r
          .slice(1, -1)
          .split(',')
          .filter((cell) => cell.trim() !== '')
          .map((cell) => cell.trim())
          .join(' & ')
      )
      .join(' \\\\ ');
    return `\\begin{bmatrix} ${body} \\end{bmatrix}`;
  } catch {
    return null;
  }
}

/**
 * Converts canonical math expressions (including equations, inequalities, matrices,
 * calculus expressions) into valid KaTeX-compatible LaTeX via the unified tokenizer/parser.
 */
export function canonicalToLatex(input: string): string {
  const rawNormalized = normalizeUnicodeToCanonical(input);
  if (!rawNormalized) return '';

  // Handle matrix assignment e.g. A = [[1,2],[3,4]] or bare [[1,2],[3,4]]
  const assignMatch = rawNormalized.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*(\[\[[\s\S]*\]\])$/);
  if (assignMatch) {
    const matTex = matrixLiteralToLatex(assignMatch[2]);
    if (matTex) return `${assignMatch[1]} = ${matTex}`;
  }
  const bareMatTex = matrixLiteralToLatex(rawNormalized);
  if (bareMatTex) return bareMatTex;

  // Handle LaTeX strings passed directly
  if (
    rawNormalized.includes('\\frac') ||
    rawNormalized.includes('\\int') ||
    rawNormalized.includes('\\sum') ||
    rawNormalized.includes('\\lim') ||
    rawNormalized.includes('\\begin{')
  ) {
    return rawNormalized;
  }

  const preprocessed = preprocessMathSyntax(input);

  // Split around relational operators (=, !=, <=, >=, <, >)
  const relMatch = preprocessed.match(/^(.+?)\s*(<=|>=|!=|=|<|>)\s*(.+)$/);
  if (relMatch) {
    const lhs = singleExprToLatex(relMatch[1]);
    const opMap: Record<string, string> = {
      '=': '=',
      '!=': '\\neq',
      '<=': '\\le',
      '>=': '\\ge',
      '<': '<',
      '>': '>',
    };
    const rhs = singleExprToLatex(relMatch[3]);
    return `${lhs} ${opMap[relMatch[2]] || relMatch[2]} ${rhs}`;
  }

  return singleExprToLatex(preprocessed);
}

function texHandler(node: MathNode, options: unknown): string | undefined {
  if (node.type === 'FunctionNode') {
    const fnNode = node as unknown as { fn: { name?: string }; args: MathNode[] };
    const fnName = fnNode.fn?.name;
    const argTex = fnNode.args.map((a) => a.toTex(options as never)).join(', ');
    if (fnName === 'log' && fnNode.args.length === 1) {
      return `\\log\\left(${argTex}\\right)`;
    }
    if (fnName === 'ln') {
      return `\\ln\\left(${argTex}\\right)`;
    }
    if (fnName === 'log10') {
      return `\\log_{10}\\left(${argTex}\\right)`;
    }
    if (fnName === 'log2') {
      return `\\log_{2}\\left(${argTex}\\right)`;
    }
  }
  return undefined;
}

function singleExprToLatex(preprocessedExpr: string): string {
  try {
    const node = mathParse(preprocessedExpr);
    let tex = node.toTex({
      parenthesis: 'keep',
      implicit: 'hide',
      handler: texHandler as never,
    });
    tex = tex
      .replace(/(\\[a-zA-Z]+)\\mathrm\{([^}]+)\}/g, '$1 $2')
      .replace(/\\mathrm\{([^}]+)\}/g, '$1')
      .replace(/(\\cdot)(?=[a-zA-Z])/g, '$1 ');
    return tex;
  } catch {
    return preprocessedExpr
      .replace(/\*/g, ' \\cdot ')
      .replace(/\bpi\b/g, '\\pi ')
      .replace(/\btheta\b/g, '\\theta ')
      .replace(/\balpha\b/g, '\\alpha ')
      .replace(/\bbeta\b/g, '\\beta ')
      .replace(/\bgamma\b/g, '\\gamma ')
      .replace(/\bdelta\b/g, '\\delta ')
      .replace(/\bepsilon\b/g, '\\varepsilon ')
      .replace(/\blambda\b/g, '\\lambda ')
      .replace(/\bsigma\b/g, '\\sigma ')
      .replace(/\bomega\b/g, '\\omega ')
      .replace(/\bphi\b/g, '\\phi ')
      .replace(/\binfinity\b/gi, '\\infty ');
  }
}
