import nerdamer from 'nerdamer';
import 'nerdamer/algebra';
import 'nerdamer/calculus';
import 'nerdamer/solve';
import {
  evaluateMathExpression,
  evaluateNumericSafe,
  parseSafeExpression,
  splitEquationOrFunction,
  toNerdamerInput,
} from './EquationParser';
import { canonicalToLatex, normalizeUnicodeToCanonical } from './SymbolConverter';

export interface AlgebraResult {
  ok: boolean;
  operation: string;
  resultText: string;
  resultCanonical: string;
  resultLatex: string;
  solutions?: string[];
  error?: string;
}

function simplifySingleSide(rawSide: string, angleUnit: 'rad' | 'deg'): AlgebraResult {
  const parsed = parseSafeExpression(rawSide);
  if (!parsed.valid) {
    return {
      ok: false,
      operation: 'Simplify',
      resultText: '',
      resultCanonical: '',
      resultLatex: '',
      error: parsed.error || 'Invalid mathematical expression.',
    };
  }
  if (parsed.variables.length === 0) {
    const ev = evaluateMathExpression(rawSide, { angleUnit });
    if (!ev.ok) {
      return {
        ok: false,
        operation: 'Simplify',
        resultText: '',
        resultCanonical: '',
        resultLatex: '',
        error: ev.error || 'Unable to simplify constant expression.',
      };
    }
    return {
      ok: true,
      operation: 'Simplify',
      resultText: ev.resultText,
      resultCanonical: ev.resultText,
      resultLatex: ev.resultLatex,
    };
  }

  try {
    const clean = toNerdamerInput(rawSide, angleUnit);
    const out = nerdamer.simplify(clean);
    const canonical = out.text();
    return {
      ok: true,
      operation: 'Simplify',
      resultText: canonical,
      resultCanonical: canonical,
      resultLatex: out.toTeX(),
    };
  } catch (err) {
    return {
      ok: false,
      operation: 'Simplify',
      resultText: '',
      resultCanonical: '',
      resultLatex: '',
      error: err instanceof Error ? err.message : 'Unable to simplify expression.',
    };
  }
}

function expandSingleSide(rawSide: string, angleUnit: 'rad' | 'deg'): AlgebraResult {
  const parsed = parseSafeExpression(rawSide);
  if (!parsed.valid) {
    return {
      ok: false,
      operation: 'Expand',
      resultText: '',
      resultCanonical: '',
      resultLatex: '',
      error: parsed.error || 'Invalid mathematical expression.',
    };
  }
  try {
    const clean = toNerdamerInput(rawSide, angleUnit);
    const out = nerdamer.expand(clean);
    const canonical = out.text();
    return {
      ok: true,
      operation: 'Expand',
      resultText: canonical,
      resultCanonical: canonical,
      resultLatex: out.toTeX(),
    };
  } catch (err) {
    return {
      ok: false,
      operation: 'Expand',
      resultText: '',
      resultCanonical: '',
      resultLatex: '',
      error: err instanceof Error ? err.message : 'Unable to expand expression.',
    };
  }
}

function factorSingleSide(rawSide: string, angleUnit: 'rad' | 'deg'): AlgebraResult {
  const parsed = parseSafeExpression(rawSide);
  if (!parsed.valid) {
    return {
      ok: false,
      operation: 'Factorize',
      resultText: '',
      resultCanonical: '',
      resultLatex: '',
      error: parsed.error || 'Invalid mathematical expression.',
    };
  }
  try {
    const clean = toNerdamerInput(rawSide, angleUnit);
    const out = nerdamer.factor(clean);
    const canonical = out.text();
    return {
      ok: true,
      operation: 'Factorize',
      resultText: canonical,
      resultCanonical: canonical,
      resultLatex: out.toTeX(),
    };
  } catch (err) {
    return {
      ok: false,
      operation: 'Factorize',
      resultText: '',
      resultCanonical: '',
      resultLatex: '',
      error: err instanceof Error ? err.message : 'Unable to factorize expression.',
    };
  }
}

export function evaluateExpressionValue(
  raw: string,
  angleUnit: 'rad' | 'deg' = 'rad',
  variable = 'x'
): AlgebraResult {
  const canonical = normalizeUnicodeToCanonical(raw);
  if (!canonical) {
    return {
      ok: false,
      operation: 'Evaluate',
      resultText: '',
      resultCanonical: '',
      resultLatex: '',
      error: 'Enter an expression or equation to evaluate.',
    };
  }

  // If it's an inequality, solve inequality
  if (/(<=|>=|<|>)/.test(canonical) && !canonical.includes('->')) {
    return solveInequality1D(raw, variable);
  }

  // If it's a function definition f(x) = rhs, evaluate or simplify rhs
  const split = splitEquationOrFunction(raw);
  if (split.isFunctionDef) {
    const rhsParsed = parseSafeExpression(split.rhs);
    if (!rhsParsed.valid) {
      return { ok: false, operation: 'Evaluate', resultText: '', resultCanonical: '', resultLatex: '', error: rhsParsed.error };
    }
    if (rhsParsed.variables.length === 0) {
      const ev = evaluateMathExpression(split.rhs, { angleUnit });
      if (!ev.ok) {
        return { ok: false, operation: 'Evaluate', resultText: '', resultCanonical: '', resultLatex: '', error: ev.error };
      }
      return {
        ok: true,
        operation: 'Evaluate',
        resultText: ev.resultText,
        resultCanonical: ev.resultText,
        resultLatex: ev.resultLatex,
      };
    }
    return simplifyExpression(raw, angleUnit);
  }

  // If it's an equation with '=', try solving for variable (or verifying identity if no variables)
  if (split.isEquation && split.lhs !== undefined) {
    const pL = parseSafeExpression(split.lhs);
    const pR = parseSafeExpression(split.rhs);
    if (!pL.valid) {
      return { ok: false, operation: 'Evaluate', resultText: '', resultCanonical: '', resultLatex: '', error: pL.error };
    }
    if (!pR.valid) {
      return { ok: false, operation: 'Evaluate', resultText: '', resultCanonical: '', resultLatex: '', error: pR.error };
    }
    const allVars = Array.from(new Set([...pL.variables, ...pR.variables]));
    if (allVars.length === 0) {
      const lVal = evaluateMathExpression(split.lhs, { angleUnit });
      const rVal = evaluateMathExpression(split.rhs, { angleUnit });
      if (lVal.ok && rVal.ok) {
        const equal = Math.abs((lVal.numericValue ?? NaN) - (rVal.numericValue ?? NaN)) < 1e-9;
        const text = equal ? `True (${lVal.resultText} = ${rVal.resultText})` : `False (${lVal.resultText} ≠ ${rVal.resultText})`;
        return {
          ok: true,
          operation: 'Verify Equality',
          resultText: text,
          resultCanonical: text,
          resultLatex: equal ? `${lVal.resultLatex} = ${rVal.resultLatex}` : `${lVal.resultLatex} \\neq ${rVal.resultLatex}`,
        };
      }
    }
    const targetVar = allVars.includes(variable) ? variable : allVars[0] || variable;
    return solveEquation(raw, targetVar, angleUnit);
  }

  const parsed = parseSafeExpression(raw);
  if (!parsed.valid) {
    return {
      ok: false,
      operation: 'Evaluate',
      resultText: '',
      resultCanonical: '',
      resultLatex: '',
      error: parsed.error || 'Syntax error in expression.',
    };
  }

  if (parsed.variables.length === 0) {
    const numRes = evaluateMathExpression(raw, { angleUnit });
    if (!numRes.ok) {
      return {
        ok: false,
        operation: 'Evaluate',
        resultText: '',
        resultCanonical: '',
        resultLatex: '',
        error: numRes.error || 'Unable to evaluate constant expression.',
      };
    }
    return {
      ok: true,
      operation: numRes.isExactFraction ? 'Exact Rational' : 'Evaluate',
      resultText: numRes.resultText,
      resultCanonical: numRes.resultText,
      resultLatex: numRes.resultLatex,
    };
  }

  return simplifyExpression(raw, angleUnit);
}

export function simplifyExpression(
  raw: string,
  angleUnit: 'rad' | 'deg' = 'rad'
): AlgebraResult {
  const split = splitEquationOrFunction(raw);
  if (split.isFunctionDef && split.lhsHeader) {
    const res = simplifySingleSide(split.rhs, angleUnit);
    if (!res.ok) return res;
    return {
      ...res,
      resultText: `${split.lhsHeader} = ${res.resultText}`,
      resultCanonical: `${split.lhsHeader} = ${res.resultCanonical}`,
      resultLatex: `${canonicalToLatex(split.lhsHeader)} = ${res.resultLatex}`,
    };
  }
  if (split.isEquation && split.lhs !== undefined) {
    const resL = simplifySingleSide(split.lhs, angleUnit);
    if (!resL.ok) return resL;
    const resR = simplifySingleSide(split.rhs, angleUnit);
    if (!resR.ok) return resR;
    return {
      ok: true,
      operation: 'Simplify',
      resultText: `${resL.resultText} = ${resR.resultText}`,
      resultCanonical: `${resL.resultCanonical} = ${resR.resultCanonical}`,
      resultLatex: `${resL.resultLatex} = ${resR.resultLatex}`,
    };
  }
  return simplifySingleSide(raw, angleUnit);
}

export function expandExpression(
  raw: string,
  angleUnit: 'rad' | 'deg' = 'rad'
): AlgebraResult {
  const split = splitEquationOrFunction(raw);
  if (split.isFunctionDef && split.lhsHeader) {
    const res = expandSingleSide(split.rhs, angleUnit);
    if (!res.ok) return res;
    return {
      ...res,
      resultText: `${split.lhsHeader} = ${res.resultText}`,
      resultCanonical: `${split.lhsHeader} = ${res.resultCanonical}`,
      resultLatex: `${canonicalToLatex(split.lhsHeader)} = ${res.resultLatex}`,
    };
  }
  if (split.isEquation && split.lhs !== undefined) {
    const resL = expandSingleSide(split.lhs, angleUnit);
    if (!resL.ok) return resL;
    const resR = expandSingleSide(split.rhs, angleUnit);
    if (!resR.ok) return resR;
    return {
      ok: true,
      operation: 'Expand',
      resultText: `${resL.resultText} = ${resR.resultText}`,
      resultCanonical: `${resL.resultCanonical} = ${resR.resultCanonical}`,
      resultLatex: `${resL.resultLatex} = ${resR.resultLatex}`,
    };
  }
  return expandSingleSide(raw, angleUnit);
}

export function factorExpression(
  raw: string,
  angleUnit: 'rad' | 'deg' = 'rad'
): AlgebraResult {
  const split = splitEquationOrFunction(raw);
  if (split.isFunctionDef && split.lhsHeader) {
    const res = factorSingleSide(split.rhs, angleUnit);
    if (!res.ok) return res;
    return {
      ...res,
      resultText: `${split.lhsHeader} = ${res.resultText}`,
      resultCanonical: `${split.lhsHeader} = ${res.resultCanonical}`,
      resultLatex: `${canonicalToLatex(split.lhsHeader)} = ${res.resultLatex}`,
    };
  }
  if (split.isEquation && split.lhs !== undefined) {
    const resL = factorSingleSide(split.lhs, angleUnit);
    if (!resL.ok) return resL;
    const resR = factorSingleSide(split.rhs, angleUnit);
    if (!resR.ok) return resR;
    return {
      ok: true,
      operation: 'Factorize',
      resultText: `${resL.resultText} = ${resR.resultText}`,
      resultCanonical: `${resL.resultCanonical} = ${resR.resultCanonical}`,
      resultLatex: `${resL.resultLatex} = ${resR.resultLatex}`,
    };
  }
  return factorSingleSide(raw, angleUnit);
}

export function dividePolynomials(dividendRaw: string, divisorRaw: string): AlgebraResult {
  try {
    const p = toNerdamerInput(dividendRaw);
    const d = toNerdamerInput(divisorRaw);
    const out = nerdamer(`div(${p}, ${d})`);
    const txt = out.text();
    // div(p, d) in nerdamer returns [quotient, remainder]
    return {
      ok: true,
      operation: 'Polynomial Division',
      resultText: txt,
      resultCanonical: txt,
      resultLatex: out.toTeX(),
    };
  } catch (err) {
    return {
      ok: false,
      operation: 'Polynomial Division',
      resultText: '',
      resultCanonical: '',
      resultLatex: '',
      error: err instanceof Error ? err.message : 'Polynomial division failed.',
    };
  }
}

export function solveEquation(
  raw: string,
  variable = 'x',
  angleUnit: 'rad' | 'deg' = 'rad'
): AlgebraResult {
  try {
    const split = splitEquationOrFunction(raw);
    let eqStr: string;
    if (split.isFunctionDef) {
      const pR = parseSafeExpression(split.rhs);
      if (!pR.valid) {
        return { ok: false, operation: `Solve for ${variable}`, resultText: '', resultCanonical: '', resultLatex: '', error: pR.error };
      }
      eqStr = `${toNerdamerInput(split.rhs, angleUnit)}=0`;
    } else if (split.isEquation && split.lhs !== undefined) {
      const pL = parseSafeExpression(split.lhs);
      const pR = parseSafeExpression(split.rhs);
      if (!pL.valid || !pR.valid) {
        return { ok: false, operation: `Solve for ${variable}`, resultText: '', resultCanonical: '', resultLatex: '', error: pL.error || pR.error };
      }
      eqStr = `${toNerdamerInput(split.lhs, angleUnit)}=${toNerdamerInput(split.rhs, angleUnit)}`;
    } else {
      const p = parseSafeExpression(raw);
      if (!p.valid) {
        return { ok: false, operation: `Solve for ${variable}`, resultText: '', resultCanonical: '', resultLatex: '', error: p.error };
      }
      eqStr = `${toNerdamerInput(raw, angleUnit)}=0`;
    }
    const sols = nerdamer(eqStr).solveFor(variable) as unknown;
    let solStrings: string[] = [];
    if (Array.isArray(sols)) {
      solStrings = sols.map((s) => (s && typeof s.text === 'function' ? s.text() : String(s)));
    } else if (sols && typeof sols === 'object') {
      const sObj = sols as { elements?: unknown[]; _elements?: unknown[]; text?: () => string };
      const elems = Array.isArray(sObj.elements)
        ? sObj.elements
        : Array.isArray(sObj._elements)
        ? sObj._elements
        : null;
      if (elems) {
        solStrings = elems.map((el) =>
          el && typeof el === 'object' && 'text' in el && typeof (el as { text: () => string }).text === 'function'
            ? (el as { text: () => string }).text()
            : String(el)
        );
      } else if (typeof sObj.text === 'function') {
        const rawTxt = sObj.text().trim();
        const stripped = rawTxt.replace(/^[{[\s]+|[}\]\s]+$/g, '');
        solStrings = stripped ? stripped.split(',').map((p) => p.trim()).filter(Boolean) : [];
      }
    } else if (sols != null) {
      solStrings = [String(sols)];
    }
    const unique = Array.from(new Set(solStrings)).filter(Boolean);
    if (unique.length === 0) {
      return {
        ok: false,
        operation: `Solve for ${variable}`,
        resultText: '',
        resultCanonical: '',
        resultLatex: '',
        error: `No symbolic solutions found for ${variable}. Try numerical root finding.`,
      };
    }
    const text = unique.map((s) => `${variable} = ${s}`).join(', ');
    const latex = unique.map((s) => `${variable} = ${canonicalToLatex(s)}`).join(', \\; ');
    return {
      ok: true,
      operation: `Solve for ${variable}`,
      resultText: text,
      resultCanonical: unique.join(', '),
      resultLatex: latex,
      solutions: unique,
    };
  } catch (err) {
    return {
      ok: false,
      operation: `Solve for ${variable}`,
      resultText: '',
      resultCanonical: '',
      resultLatex: '',
      error: err instanceof Error ? err.message : 'Could not solve equation symbolically.',
    };
  }
}

function extractSolutionEntries(raw: unknown): Array<Array<[string, string]>> {
  const formatVal = (val: unknown): string => {
    if (val && typeof val === 'object' && 'text' in val && typeof (val as { text: () => string }).text === 'function') {
      return (val as { text: () => string }).text();
    }
    return String(val ?? '');
  };

  if (Array.isArray(raw)) {
    const tuples: Array<[string, string]> = [];
    for (const item of raw) {
      if (Array.isArray(item) && item.length >= 2) {
        tuples.push([String(item[0]), formatVal(item[1])]);
      }
    }
    return tuples.length > 0 ? [tuples] : [];
  }

  if (raw && typeof raw === 'object') {
    const obj = raw as {
      _entries?: Map<string, unknown>;
      elements?: unknown[];
      text?: () => string;
    };

    if (obj._entries instanceof Map) {
      const pairs: Array<[string, string]> = [];
      for (const [k, v] of obj._entries.entries()) {
        pairs.push([String(k), formatVal(v)]);
      }
      return pairs.length > 0 ? [pairs] : [];
    }

    if (Array.isArray(obj.elements)) {
      const sets: Array<Array<[string, string]>> = [];
      const flatTuples: Array<[string, string]> = [];
      for (const el of obj.elements) {
        if (el && typeof el === 'object' && '_entries' in el && (el as { _entries?: unknown })._entries instanceof Map) {
          const pairs: Array<[string, string]> = [];
          for (const [k, v] of ((el as { _entries: Map<string, unknown> })._entries).entries()) {
            pairs.push([String(k), formatVal(v)]);
          }
          if (pairs.length > 0) sets.push(pairs);
        } else if (Array.isArray(el) && el.length >= 2) {
          flatTuples.push([String(el[0]), formatVal(el[1])]);
        }
      }
      if (sets.length > 0) return sets;
      if (flatTuples.length > 0) return [flatTuples];
    }

    if (typeof obj.text === 'function') {
      const txt = obj.text();
      const arrowMatches = [...txt.matchAll(/([a-zA-Z_]\w*)\s*=>\s*([^,}\]]+)/g)];
      if (arrowMatches.length > 0) {
        return [arrowMatches.map((m) => [m[1], m[2].trim()])];
      }
    }
  }

  return [];
}

export function solveSimultaneousEquations(equationsRaw: string[]): AlgebraResult {
  try {
    const cleaned = equationsRaw.map((e) => toNerdamerInput(e)).filter(Boolean);
    if (cleaned.length === 0) {
      return {
        ok: false,
        operation: 'System of Equations',
        resultText: '',
        resultCanonical: '',
        resultLatex: '',
        error: 'Provide at least one equation.',
      };
    }
    const sols = nerdamer.solveEquations(cleaned);
    const solutionSets = extractSolutionEntries(sols);
    if (solutionSets.length === 0) {
      return {
        ok: false,
        operation: 'System of Equations',
        resultText: '',
        resultCanonical: '',
        resultLatex: '',
        error: 'No symbolic solution found for the system of equations.',
      };
    }

    const formattedSets = solutionSets.map((set) =>
      set.map(([v, val]) => `${v} = ${val}`).join(', ')
    );
    const formattedLatex = solutionSets.map((set) =>
      set.map(([v, val]) => `${v} = ${canonicalToLatex(val)}`).join(', \\quad ')
    );
    const flatPairs = solutionSets.flatMap((set) => set.map(([v, val]) => `${v} = ${val}`));
    const resultText =
      formattedSets.length === 1
        ? formattedSets[0]
        : formattedSets.map((s) => `(${s})`).join('  or  ');
    const resultLatex =
      formattedLatex.length === 1
        ? formattedLatex[0]
        : formattedLatex.map((s) => `\\left(${s}\\right)`).join(' \\;\\lor\\; ');

    return {
      ok: true,
      operation: 'System of Equations',
      resultText,
      resultCanonical: resultText,
      resultLatex,
      solutions: flatPairs,
    };
  } catch (err) {
    return {
      ok: false,
      operation: 'System of Equations',
      resultText: '',
      resultCanonical: '',
      resultLatex: '',
      error: err instanceof Error ? err.message : 'Could not solve system of equations.',
    };
  }
}

/**
 * Solves 1D inequalities like x^2 - 4 <= 0 or 2*x + 3 > 7 over real x
 * by locating boundary roots and testing interval midpoints.
 */
export function solveInequality1D(raw: string, variable = 'x'): AlgebraResult {
  const canonical = normalizeUnicodeToCanonical(raw);
  const match = canonical.match(/^(.+?)\s*(<=|>=|<|>)\s*(.+)$/);
  if (!match) {
    return {
      ok: false,
      operation: 'Solve Inequality',
      resultText: '',
      resultCanonical: '',
      resultLatex: '',
      error: 'Expected inequality with <, >, <=, or >=.',
    };
  }
  const [, lhs, op, rhs] = match;
  const diffExpr = `(${lhs}) - (${rhs})`;
  const inclusive = op === '<=' || op === '>=';

  const boundary = solveEquation(`${diffExpr} = 0`, variable);
  const roots = (boundary.solutions || [])
    .map((s) => evaluateNumericSafe(s))
    .filter((v) => Number.isFinite(v))
    .sort((a, b) => a - b);

  const uniqueRoots: number[] = [];
  for (const r of roots) {
    if (uniqueRoots.length === 0 || Math.abs(r - uniqueRoots[uniqueRoots.length - 1]) > 1e-7) {
      uniqueRoots.push(r);
    }
  }

  const testPoints: Array<{ from: number; to: number; probe: number }> = [];
  if (uniqueRoots.length === 0) {
    testPoints.push({ from: -Infinity, to: Infinity, probe: 0 });
  } else {
    testPoints.push({ from: -Infinity, to: uniqueRoots[0], probe: uniqueRoots[0] - 1 });
    for (let i = 0; i < uniqueRoots.length - 1; i++) {
      testPoints.push({
        from: uniqueRoots[i],
        to: uniqueRoots[i + 1],
        probe: (uniqueRoots[i] + uniqueRoots[i + 1]) / 2,
      });
    }
    const last = uniqueRoots[uniqueRoots.length - 1];
    testPoints.push({ from: last, to: Infinity, probe: last + 1 });
  }

  const satisfies = (v: number): boolean => {
    if (!Number.isFinite(v)) return false;
    if (op === '<') return v < -1e-9;
    if (op === '<=') return v <= 1e-9;
    if (op === '>') return v > 1e-9;
    return v >= -1e-9;
  };

  const intervals: string[] = [];
  for (const seg of testPoints) {
    const val = evaluateNumericSafe(diffExpr, { [variable]: seg.probe });
    if (satisfies(val)) {
      const leftBracket = seg.from === -Infinity ? '(' : inclusive ? '[' : '(';
      const rightBracket = seg.to === Infinity ? ')' : inclusive ? ']' : ')';
      const leftVal = seg.from === -Infinity ? '-∞' : Number(seg.from.toFixed(4)).toString();
      const rightVal = seg.to === Infinity ? '∞' : Number(seg.to.toFixed(4)).toString();
      intervals.push(`${leftBracket}${leftVal}, ${rightVal}${rightBracket}`);
    }
  }

  const text = intervals.length > 0 ? `${variable} ∈ ${intervals.join(' ∪ ')}` : 'No real solution (∅)';
  return {
    ok: true,
    operation: 'Solve Inequality',
    resultText: text,
    resultCanonical: text,
    resultLatex: text.replace(/∞/g, '\\infty').replace(/∪/g, '\\cup').replace(/∈/g, '\\in'),
  };
}
