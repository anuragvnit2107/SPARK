import {
  canonicalToLatex,
  canonicalToPrettyUnicode,
  convertKeyboardInputAtCursor,
  normalizeUnicodeToCanonical,
} from './SymbolConverter';
import { MathExprModel } from './types';

export interface MathTemplateItem {
  id: string;
  label: string;
  category:
    | 'Structures'
    | 'Calculus'
    | 'Matrices'
    | 'Greek'
    | 'Trig & Log'
    | 'Operators';
  preview: string;
  /** Snippet with |cursor| marker for cursor placement */
  snippet: string;
}

export const MATH_VISUAL_TEMPLATES: MathTemplateItem[] = [
  // Structures
  { id: 'frac', label: 'Fraction a/b', category: 'Structures', preview: 'a/b', snippet: '(|cursor|)/()' },
  { id: 'pow', label: 'Power x^n', category: 'Structures', preview: 'xⁿ', snippet: '^(|cursor|)' },
  { id: 'sub', label: 'Subscript a_n', category: 'Structures', preview: 'aₙ', snippet: '_(|cursor|)' },
  { id: 'sqrt', label: 'Square Root', category: 'Structures', preview: '√x', snippet: 'sqrt(|cursor|)' },
  { id: 'nthroot', label: 'nth Root', category: 'Structures', preview: 'ⁿ√x', snippet: 'nthRoot(|cursor|, 3)' },
  { id: 'abs', label: 'Absolute Value', category: 'Structures', preview: '|x|', snippet: 'abs(|cursor|)' },
  { id: 'parens', label: 'Brackets', category: 'Structures', preview: '( )', snippet: '(|cursor|)' },
  { id: 'vector', label: 'Vector [x,y,z]', category: 'Structures', preview: 'v⃗', snippet: '[|cursor|, 0, 0]' },
  { id: 'complex', label: 'Complex a+bi', category: 'Structures', preview: 'a+bi', snippet: '|cursor| + 1i' },

  // Calculus
  { id: 'sum', label: 'Summation', category: 'Calculus', preview: '∑', snippet: 'sum(|cursor|, k, 1, n)' },
  { id: 'int', label: 'Integral', category: 'Calculus', preview: '∫', snippet: 'integrate(|cursor|, x)' },
  { id: 'defint', label: 'Definite Integral', category: 'Calculus', preview: '∫ₐᵇ', snippet: 'defint(|cursor|, x, 0, 1)' },
  { id: 'limit', label: 'Limit', category: 'Calculus', preview: 'lim', snippet: 'limit(|cursor|, x, 0)' },
  { id: 'deriv', label: 'Derivative', category: 'Calculus', preview: 'd/dx', snippet: 'diff(|cursor|, x)' },
  { id: 'partial', label: 'Partial Deriv', category: 'Calculus', preview: '∂/∂x', snippet: 'partial(|cursor|, x)' },

  // Matrices
  { id: 'mat2', label: '2×2 Matrix', category: 'Matrices', preview: '[2×2]', snippet: '[[|cursor|, 0], [0, 1]]' },
  { id: 'mat3', label: '3×3 Matrix', category: 'Matrices', preview: '[3×3]', snippet: '[[|cursor|, 0, 0], [0, 1, 0], [0, 0, 1]]' },
  { id: 'det', label: 'Determinant', category: 'Matrices', preview: 'det(A)', snippet: 'det([[|cursor|, 0], [0, 1]])' },

  // Greek
  { id: 'pi', label: 'Pi', category: 'Greek', preview: 'π', snippet: 'π|cursor|' },
  { id: 'theta', label: 'Theta', category: 'Greek', preview: 'θ', snippet: 'θ|cursor|' },
  { id: 'alpha', label: 'Alpha', category: 'Greek', preview: 'α', snippet: 'α|cursor|' },
  { id: 'beta', label: 'Beta', category: 'Greek', preview: 'β', snippet: 'β|cursor|' },
  { id: 'gamma', label: 'Gamma', category: 'Greek', preview: 'γ', snippet: 'γ|cursor|' },
  { id: 'delta', label: 'Delta', category: 'Greek', preview: 'δ', snippet: 'δ|cursor|' },
  { id: 'lambda', label: 'Lambda', category: 'Greek', preview: 'λ', snippet: 'λ|cursor|' },
  { id: 'omega', label: 'Omega', category: 'Greek', preview: 'ω', snippet: 'ω|cursor|' },
  { id: 'inf', label: 'Infinity', category: 'Greek', preview: '∞', snippet: '∞|cursor|' },

  // Trig & Log
  { id: 'sin', label: 'sin', category: 'Trig & Log', preview: 'sin(x)', snippet: 'sin(|cursor|)' },
  { id: 'cos', label: 'cos', category: 'Trig & Log', preview: 'cos(x)', snippet: 'cos(|cursor|)' },
  { id: 'tan', label: 'tan', category: 'Trig & Log', preview: 'tan(x)', snippet: 'tan(|cursor|)' },
  { id: 'ln', label: 'ln', category: 'Trig & Log', preview: 'ln(x)', snippet: 'ln(|cursor|)' },
  { id: 'log10', label: 'log₁₀', category: 'Trig & Log', preview: 'log₁₀', snippet: 'log10(|cursor|)' },
  { id: 'exp', label: 'eˣ', category: 'Trig & Log', preview: 'eˣ', snippet: 'exp(|cursor|)' },

  // Operators
  { id: 'neq', label: '≠', category: 'Operators', preview: '≠', snippet: ' ≠ |cursor|' },
  { id: 'leq', label: '≤', category: 'Operators', preview: '≤', snippet: ' ≤ |cursor|' },
  { id: 'geq', label: '≥', category: 'Operators', preview: '≥', snippet: ' ≥ |cursor|' },
  { id: 'pm', label: '±', category: 'Operators', preview: '±', snippet: ' ± |cursor|' },
  { id: 'nabla', label: '∇', category: 'Operators', preview: '∇', snippet: '∇|cursor|' },
];

export const MATH_AUTOCOMPLETE_WORDS = [
  'sin(',
  'cos(',
  'tan(',
  'cot(',
  'sec(',
  'csc(',
  'asin(',
  'acos(',
  'atan(',
  'sinh(',
  'cosh(',
  'tanh(',
  'sqrt(',
  'cbrt(',
  'abs(',
  'exp(',
  'ln(',
  'log(',
  'log10(',
  'log2(',
  'pi',
  'theta',
  'alpha',
  'beta',
  'gamma',
  'delta',
  'infinity',
  'det(',
  'inv(',
  'transpose(',
];

const OPEN_TO_CLOSE: Record<string, string> = {
  '(': ')',
  '[': ']',
  '{': '}',
};
const CLOSE_TO_OPEN: Record<string, string> = {
  ')': '(',
  ']': '[',
  '}': '{',
};

export function createMathExprModel(raw: string, cursor?: number): MathExprModel {
  const canonical = normalizeUnicodeToCanonical(raw);
  return {
    canonical,
    display: raw,
    latex: canonicalToLatex(canonical),
    cursor,
  };
}

export function applyVisualTemplateAtSelection(
  currentValue: string,
  selectionStart: number,
  selectionEnd: number,
  snippet: string
): { nextValue: string; nextCursor: number } {
  const selected = currentValue.slice(selectionStart, selectionEnd);
  const markerIdx = snippet.indexOf('|cursor|');
  let inserted: string;
  let relativeCursor: number;

  if (markerIdx !== -1) {
    const prefix = snippet.slice(0, markerIdx);
    const suffix = snippet.slice(markerIdx + '|cursor|'.length);
    inserted = prefix + selected + suffix;
    relativeCursor = prefix.length + selected.length;
  } else {
    inserted = snippet;
    relativeCursor = snippet.length;
  }

  const nextValue =
    currentValue.slice(0, selectionStart) + inserted + currentValue.slice(selectionEnd);
  return {
    nextValue,
    nextCursor: selectionStart + relativeCursor,
  };
}

export function handleSmartBracketKey(
  value: string,
  selectionStart: number,
  selectionEnd: number,
  key: string
): { handled: boolean; nextValue: string; nextCursor: number } {
  // Auto-pair opening brackets
  if (key in OPEN_TO_CLOSE) {
    const close = OPEN_TO_CLOSE[key];
    const selected = value.slice(selectionStart, selectionEnd);
    const nextValue =
      value.slice(0, selectionStart) + key + selected + close + value.slice(selectionEnd);
    return {
      handled: true,
      nextValue,
      nextCursor: selectionStart + 1 + selected.length,
    };
  }

  // Skip over matching closing bracket if already at cursor
  if (key in CLOSE_TO_OPEN && selectionStart === selectionEnd && value[selectionStart] === key) {
    return {
      handled: true,
      nextValue: value,
      nextCursor: selectionStart + 1,
    };
  }

  // Backspace deletes empty bracket pair () or []
  if (
    key === 'Backspace' &&
    selectionStart === selectionEnd &&
    selectionStart > 0 &&
    OPEN_TO_CLOSE[value[selectionStart - 1]] === value[selectionStart]
  ) {
    const nextValue = value.slice(0, selectionStart - 1) + value.slice(selectionStart + 1);
    return {
      handled: true,
      nextValue,
      nextCursor: selectionStart - 1,
    };
  }

  return { handled: false, nextValue: value, nextCursor: selectionStart };
}

export function findMatchingBracketPair(
  value: string,
  cursorPos: number
): [number, number] | null {
  const candidates = [cursorPos - 1, cursorPos];
  for (const idx of candidates) {
    if (idx < 0 || idx >= value.length) continue;
    const ch = value[idx];
    if (ch in OPEN_TO_CLOSE) {
      const target = OPEN_TO_CLOSE[ch];
      let depth = 0;
      for (let i = idx; i < value.length; i++) {
        if (value[i] === ch) depth++;
        else if (value[i] === target) {
          depth--;
          if (depth === 0) return [idx, i];
        }
      }
    } else if (ch in CLOSE_TO_OPEN) {
      const target = CLOSE_TO_OPEN[ch];
      let depth = 0;
      for (let i = idx; i >= 0; i--) {
        if (value[i] === ch) depth++;
        else if (value[i] === target) {
          depth--;
          if (depth === 0) return [i, idx];
        }
      }
    }
  }
  return null;
}

export function getAutocompleteSuggestions(value: string, cursorPos: number): string[] {
  const before = value.slice(0, cursorPos);
  const wordMatch = before.match(/([a-zA-Z_][a-zA-Z0-9_]*)$/);
  if (!wordMatch || wordMatch[1].length < 2) return [];
  const prefix = wordMatch[1].toLowerCase();
  return MATH_AUTOCOMPLETE_WORDS.filter(
    (w) => w.toLowerCase().startsWith(prefix) && w.toLowerCase() !== prefix
  ).slice(0, 6);
}

export function processNaturalMathInput(
  rawValue: string,
  cursorPos: number
): { model: MathExprModel; nextCursor: number } {
  const conv = convertKeyboardInputAtCursor(rawValue, cursorPos);
  const pretty = canonicalToPrettyUnicode(conv.nextValue);
  const finalValue = conv.changed ? conv.nextValue : pretty === conv.nextValue ? conv.nextValue : conv.nextValue;
  return {
    model: createMathExprModel(finalValue, conv.nextCursor),
    nextCursor: conv.nextCursor,
  };
}
