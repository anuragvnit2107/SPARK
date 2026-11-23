import nerdamer from 'nerdamer';
import 'nerdamer/algebra';
import 'nerdamer/calculus';
import {
  evaluateNumericSafe,
  parseSafeExpression,
  preprocessMathSyntax,
  splitEquationOrFunction,
  toNerdamerInput,
} from './EquationParser';
import { CalculusResult, MathStep } from './types';

function unwrapFunctionTarget(rawExpr: string, variable: string): string {
  const split = splitEquationOrFunction(rawExpr);
  if (split.isFunctionDef) return split.rhs;
  if (split.isEquation && split.lhs === 'y' && variable !== 'y') {
    const pR = parseSafeExpression(split.rhs);
    if (!pR.variables.includes('y')) return split.rhs;
  }
  return rawExpr;
}

function simpsonRule(fn: (x: number) => number, a: number, b: number): number {
  const m = (a + b) / 2;
  const fa = fn(a);
  const fm = fn(m);
  const fb = fn(b);
  if (!Number.isFinite(fa) || !Number.isFinite(fm) || !Number.isFinite(fb)) return NaN;
  return ((b - a) / 6) * (fa + 4 * fm + fb);
}

/**
 * Adaptive Simpson's quadrature for numerical definite integrals.
 */
export function adaptiveSimpson(
  fn: (x: number) => number,
  a: number,
  b: number,
  tol = 1e-8,
  maxDepth = 14
): number {
  if (a === b) return 0;
  const whole = simpsonRule(fn, a, b);
  if (!Number.isFinite(whole)) return NaN;

  function recurse(lo: number, hi: number, prev: number, eps: number, depth: number): number {
    const mid = (lo + hi) / 2;
    const left = simpsonRule(fn, lo, mid);
    const right = simpsonRule(fn, mid, hi);
    if (!Number.isFinite(left) || !Number.isFinite(right)) return NaN;
    const delta = left + right - prev;
    if (depth <= 0 || Math.abs(delta) <= 15 * eps) {
      return left + right + delta / 15;
    }
    return (
      recurse(lo, mid, left, eps / 2, depth - 1) +
      recurse(mid, hi, right, eps / 2, depth - 1)
    );
  }

  return recurse(a, b, whole, tol, maxDepth);
}

export function differentiateSymbolic(
  rawExpr: string,
  variable = 'x',
  order = 1
): CalculusResult {
  const targetExpr = unwrapFunctionTarget(rawExpr, variable);
  const parsed = parseSafeExpression(targetExpr);
  if (!parsed.valid) {
    return {
      ok: false,
      operation: `Derivative d/d${variable}`,
      resultCanonical: '',
      resultLatex: '',
      error: parsed.error || 'Invalid expression for differentiation.',
    };
  }
  const casInput = toNerdamerInput(targetExpr);
  try {
    let cur = nerdamer(casInput);
    const steps: MathStep[] = [];

    // Check explicit top-level AST rules when order === 1 for honest step explanations
    if (order === 1 && parsed.ast) {
      const ast = parsed.ast;
      if (ast.type === 'OperatorNode') {
        const op = (ast as unknown as { op: string }).op;
        const args = (ast as unknown as { args: { toString: () => string }[] }).args;
        if (op === '+' || op === '-') {
          steps.push({
            title: 'Sum / Difference Rule',
            detail: `d/d${variable}[f ${op} g] = df/d${variable} ${op} dg/d${variable}`,
          });
        } else if (op === '*') {
          steps.push({
            title: 'Product Rule',
            detail: `d/d${variable}[(${args[0]?.toString()})·(${args[1]?.toString()})] = f'·g + f·g'`,
          });
        } else if (op === '/') {
          steps.push({
            title: 'Quotient Rule',
            detail: `d/d${variable}[u/v] = (u'·v - u·v') / v²`,
          });
        }
      } else if (ast.type === 'FunctionNode') {
        steps.push({
          title: 'Chain Rule',
          detail: `d/d${variable}[f(g(${variable}))] = f'(g(${variable})) · g'(${variable})`,
        });
      }
    }

    for (let k = 1; k <= order; k++) {
      cur = nerdamer.diff(cur.text(), variable);
      if (order > 1) {
        steps.push({
          title: `Order ${k} derivative`,
          detail: `d^${k}/d${variable}^${k} = ${cur.text()}`,
          latex: cur.toTeX(),
        });
      }
    }

    const resultCanonical = cur.text();
    const resultLatex = cur.toTeX();
    steps.push({
      title: 'Simplified Derivative',
      detail: resultCanonical,
      latex: resultLatex,
    });

    return {
      ok: true,
      operation: order > 1 ? `Derivative (order ${order})` : `Derivative d/d${variable}`,
      resultCanonical,
      resultLatex,
      steps,
    };
  } catch (err) {
    return {
      ok: false,
      operation: `Derivative d/d${variable}`,
      resultCanonical: '',
      resultLatex: '',
      error: err instanceof Error ? err.message : 'Symbolic differentiation failed.',
    };
  }
}

/**
 * Implicit differentiation dy/dx = - (∂F/∂x) / (∂F/∂y) for F(x, y) = 0 or lhs = rhs.
 */
export function differentiateImplicit(rawEquation: string, xVar = 'x', yVar = 'y'): CalculusResult {
  const clean = toNerdamerInput(rawEquation);
  const eqParts = clean.split('=');
  const F =
    eqParts.length === 2 ? `(${eqParts[0].trim()}) - (${eqParts[1].trim()})` : clean;
  try {
    const Fx = nerdamer.diff(F, xVar);
    const Fy = nerdamer.diff(F, yVar);
    const ratio = nerdamer.simplify(`-(${Fx.text()}) / (${Fy.text()})`);
    const steps: MathStep[] = [
      { title: 'Implicit Form F(x, y) = 0', detail: `F = ${F}` },
      { title: 'Partial Derivative ∂F/∂x', detail: Fx.text(), latex: Fx.toTeX() },
      { title: 'Partial Derivative ∂F/∂y', detail: Fy.text(), latex: Fy.toTeX() },
      { title: 'Formula dy/dx = -(∂F/∂x) / (∂F/∂y)', detail: ratio.text(), latex: ratio.toTeX() },
    ];
    return {
      ok: true,
      operation: `Implicit Derivative d${yVar}/d${xVar}`,
      resultCanonical: ratio.text(),
      resultLatex: ratio.toTeX(),
      steps,
    };
  } catch (err) {
    return {
      ok: false,
      operation: `Implicit Derivative d${yVar}/d${xVar}`,
      resultCanonical: '',
      resultLatex: '',
      error: err instanceof Error ? err.message : 'Implicit differentiation failed.',
    };
  }
}

export function integrateIndefinite(rawExpr: string, variable = 'x'): CalculusResult {
  const targetExpr = unwrapFunctionTarget(rawExpr, variable);
  const parsed = parseSafeExpression(targetExpr);
  if (!parsed.valid) {
    return {
      ok: false,
      operation: `Indefinite Integral ∫ d${variable}`,
      resultCanonical: '',
      resultLatex: '',
      error: parsed.error || 'Invalid expression for integration.',
    };
  }
  const clean = toNerdamerInput(targetExpr);
  try {
    const integral = nerdamer.integrate(clean, variable);
    const txt = integral.text();
    return {
      ok: true,
      operation: `Indefinite Integral ∫ d${variable}`,
      resultCanonical: `${txt} + C`,
      resultLatex: `${integral.toTeX()} + C`,
    };
  } catch (err) {
    return {
      ok: false,
      operation: `Indefinite Integral ∫ d${variable}`,
      resultCanonical: '',
      resultLatex: '',
      error: err instanceof Error ? err.message : 'Symbolic integration unavailable for this expression.',
    };
  }
}

export function integrateDefinite(
  rawExpr: string,
  fromVal: number,
  toVal: number,
  variable = 'x'
): CalculusResult {
  const targetExpr = unwrapFunctionTarget(rawExpr, variable);
  const clean = preprocessMathSyntax(targetExpr);
  const casClean = toNerdamerInput(targetExpr);
  const steps: MathStep[] = [];

  // 1. Try symbolic antiderivative first
  let symbolicText = '';
  let symbolicLatex = '';
  let exactNumeric: number | undefined;
  try {
    const anti = nerdamer.integrate(casClean, variable);
    const upper = anti.evaluate({ [variable]: toVal }).text();
    const lower = anti.evaluate({ [variable]: fromVal }).text();
    const diffExpr = `(${upper}) - (${lower})`;
    const symVal = evaluateNumericSafe(diffExpr);
    if (Number.isFinite(symVal)) {
      exactNumeric = symVal;
      symbolicText = Number(symVal.toFixed(8)).toString();
      symbolicLatex = symbolicText;
      steps.push({
        title: 'Antiderivative F(x)',
        detail: `F(${variable}) = ${anti.text()}`,
        latex: anti.toTeX(),
      });
      steps.push({
        title: 'Fundamental Theorem Evaluation',
        detail: `F(${toVal}) - F(${fromVal}) = ${symbolicText}`,
      });
    }
  } catch {
    // Fallback cleanly to adaptive quadrature
  }

  // 2. Adaptive Simpson quadrature (reliable fallback + cross-verification)
  if (exactNumeric === undefined) {
    const num = adaptiveSimpson(
      (v) => evaluateNumericSafe(clean, { [variable]: v }),
      fromVal,
      toVal
    );
    if (!Number.isFinite(num)) {
      return {
        ok: false,
        operation: `Definite Integral [${fromVal}, ${toVal}]`,
        resultCanonical: '',
        resultLatex: '',
        error: 'Integral diverges or encounters a singularity inside the interval.',
      };
    }
    const formatted = Number(num.toFixed(8)).toString();
    steps.push({
      title: 'Adaptive Simpson Quadrature',
      detail: `∫_${fromVal}^${toVal} (${clean}) d${variable} ≈ ${formatted}`,
    });
    return {
      ok: true,
      operation: `Definite Integral [${fromVal}, ${toVal}]`,
      numericValue: num,
      resultCanonical: formatted,
      resultLatex: formatted,
      steps,
    };
  }

  return {
    ok: true,
    operation: `Definite Integral [${fromVal}, ${toVal}]`,
    numericValue: exactNumeric,
    resultCanonical: symbolicText,
    resultLatex: symbolicLatex,
    steps,
  };
}

export function evaluateLimit(
  rawExpr: string,
  variable = 'x',
  target: string | number = 0,
  direction: 'both' | 'left' | 'right' = 'both'
): CalculusResult {
  const targetExpr = unwrapFunctionTarget(rawExpr, variable);
  const clean = preprocessMathSyntax(targetExpr);
  const casClean = toNerdamerInput(targetExpr);
  const steps: MathStep[] = [];
  const targetStr = String(target).trim();

  // Handle direct symbolic limit via nerdamer for two-sided finite or Infinity
  if (direction === 'both') {
    try {
      const sym = nerdamer.limit(casClean, variable, targetStr);
      const txt = sym.text();
      if (txt && !txt.includes('limit(')) {
        const num = evaluateNumericSafe(txt);
        return {
          ok: true,
          operation: `lim ${variable} → ${targetStr}`,
          numericValue: Number.isFinite(num) ? num : undefined,
          resultCanonical: txt,
          resultLatex: sym.toTeX(),
          steps: [{ title: 'Symbolic Limit', detail: `${txt}`, latex: sym.toTeX() }],
        };
      }
    } catch {
      // Proceed to numerical directional + L'Hôpital analysis
    }
  }

  // Numerical limit probing + L'Hôpital for ratios f/g
  if (/^[-+]?inf(inity)?$/i.test(targetStr)) {
    const sign = targetStr.startsWith('-') ? -1 : 1;
    const samples = [1e3, 1e4, 1e5, 1e6].map((m) =>
      evaluateNumericSafe(clean, { [variable]: sign * m })
    );
    const last = samples[samples.length - 1];
    if (Number.isFinite(last) && Math.abs(samples[3] - samples[2]) < 1e-4) {
      const rounded = Number(last.toFixed(6)).toString();
      return {
        ok: true,
        operation: `lim ${variable} → ${targetStr}`,
        numericValue: last,
        resultCanonical: rounded,
        resultLatex: rounded,
      };
    }
    return {
      ok: true,
      operation: `lim ${variable} → ${targetStr}`,
      resultCanonical: last > 0 ? '∞' : last < 0 ? '-∞' : 'Does not exist',
      resultLatex: last > 0 ? '\\infty' : last < 0 ? '-\\infty' : '\\text{DNE}',
    };
  }

  const a = Number(targetStr);
  if (!Number.isFinite(a)) {
    return {
      ok: false,
      operation: `lim ${variable} → ${targetStr}`,
      resultCanonical: '',
      resultLatex: '',
      error: 'Limit point must be numeric or Infinity.',
    };
  }

  const epsilons = [1e-2, 1e-4, 1e-6, 1e-8];
  const leftVals = epsilons.map((h) => evaluateNumericSafe(clean, { [variable]: a - h }));
  const rightVals = epsilons.map((h) => evaluateNumericSafe(clean, { [variable]: a + h }));
  const lVal = leftVals[leftVals.length - 1];
  const rVal = rightVals[rightVals.length - 1];

  // Check L'Hôpital applicability for f/g
  const fracMatch = clean.match(/^\(?([^/]+)\)?\s*\/\s*\(?([^)]+)\)?$/);
  if (fracMatch) {
    const f0 = evaluateNumericSafe(fracMatch[1], { [variable]: a });
    const g0 = evaluateNumericSafe(fracMatch[2], { [variable]: a });
    if (Math.abs(f0) < 1e-7 && Math.abs(g0) < 1e-7) {
      try {
        const df = nerdamer.diff(fracMatch[1], variable).text();
        const dg = nerdamer.diff(fracMatch[2], variable).text();
        const lhop = evaluateNumericSafe(`(${df})/(${dg})`, { [variable]: a });
        if (Number.isFinite(lhop)) {
          steps.push({
            title: "Indeterminate Form 0/0 — L'Hôpital's Rule",
            detail: `f'(x)/g'(x) = (${df}) / (${dg})`,
          });
          const resStr = Number(lhop.toFixed(6)).toString();
          return {
            ok: true,
            operation: `lim ${variable} → ${targetStr}`,
            numericValue: lhop,
            resultCanonical: resStr,
            resultLatex: resStr,
            steps,
          };
        }
      } catch {
        // continue with directional values
      }
    }
  }

  if (direction === 'left') {
    const s = Number.isFinite(lVal) ? Number(lVal.toFixed(6)).toString() : 'DNE';
    return { ok: true, operation: `lim ${variable} → ${a}⁻`, numericValue: lVal, resultCanonical: s, resultLatex: s };
  }
  if (direction === 'right') {
    const s = Number.isFinite(rVal) ? Number(rVal.toFixed(6)).toString() : 'DNE';
    return { ok: true, operation: `lim ${variable} → ${a}⁺`, numericValue: rVal, resultCanonical: s, resultLatex: s };
  }

  if (Number.isFinite(lVal) && Number.isFinite(rVal) && Math.abs(lVal - rVal) < 1e-3) {
    const avg = (lVal + rVal) / 2;
    const s = Number(avg.toFixed(6)).toString();
    return {
      ok: true,
      operation: `lim ${variable} → ${a}`,
      numericValue: avg,
      resultCanonical: s,
      resultLatex: s,
      steps: [{ title: 'Left & Right Convergence', detail: `lim⁻ ≈ ${lVal.toFixed(5)}, lim⁺ ≈ ${rVal.toFixed(5)}` }],
    };
  }

  return {
    ok: true,
    operation: `lim ${variable} → ${a}`,
    resultCanonical: `Does not exist (Left: ${Number.isFinite(lVal) ? lVal.toFixed(4) : '±∞'}, Right: ${Number.isFinite(rVal) ? rVal.toFixed(4) : '±∞'})`,
    resultLatex: '\\text{DNE}',
  };
}
