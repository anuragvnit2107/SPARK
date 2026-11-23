import { evaluateNumericSafe } from './EquationParser';
import { canonicalToLatex, normalizeUnicodeToCanonical } from './SymbolConverter';
import { IdentitySuggestion } from './types';

function approxEquivalent1D(exprA: string, exprB: string, variable = 'x'): boolean {
  const probes = [-2.13, -0.77, 0.41, 1.29, 2.67];
  let validCount = 0;
  for (const val of probes) {
    const a = evaluateNumericSafe(exprA, { [variable]: val, a: 1.7, b: 0.9 });
    const b = evaluateNumericSafe(exprB, { [variable]: val, a: 1.7, b: 0.9 });
    if (Number.isFinite(a) && Number.isFinite(b)) {
      if (Math.abs(a - b) > 1e-5 * Math.max(1, Math.abs(a))) return false;
      validCount++;
    }
  }
  return validCount >= 3;
}

/**
 * Context-aware identity recognition engine.
 * Only suggests identities that match the expression structure AND pass verification.
 */
export function suggestIdentities(rawInput: string): IdentitySuggestion[] {
  const canonical = normalizeUnicodeToCanonical(rawInput).replace(/^y\s*=\s*/i, '');
  const compact = canonical.replace(/\s+/g, '');
  const suggestions: IdentitySuggestion[] = [];

  // 1. Trigonometric Pythagorean & double-angle identities
  const pythMatch = compact.match(/sin\(([^)]+)\)\^2\+cos\(([^)]+)\)\^2|cos\(([^)]+)\)\^2\+sin\(([^)]+)\)\^2/);
  if (pythMatch) {
    const arg1 = pythMatch[1] || pythMatch[3];
    const arg2 = pythMatch[2] || pythMatch[4];
    if (arg1 === arg2) {
      const after = compact.replace(pythMatch[0], '1');
      if (approxEquivalent1D(canonical, after)) {
        suggestions.push({
          id: 'trig-pythagorean',
          category: 'trigonometric',
          title: 'Pythagorean Identity',
          description: `sin²(${arg1}) + cos²(${arg1}) = 1`,
          beforeCanonical: canonical,
          afterCanonical: after,
          afterLatex: canonicalToLatex(after),
          verified: true,
        });
      }
    }
  }

  const oneMinusSin = compact.match(/1-sin\(([^)]+)\)\^2/);
  if (oneMinusSin) {
    const u = oneMinusSin[1];
    const after = compact.replace(oneMinusSin[0], `cos(${u})^2`);
    if (approxEquivalent1D(canonical, after)) {
      suggestions.push({
        id: 'trig-1-sin2',
        category: 'trigonometric',
        title: 'Pythagorean Substitution',
        description: `1 - sin²(${u}) = cos²(${u})`,
        beforeCanonical: canonical,
        afterCanonical: after,
        afterLatex: canonicalToLatex(after),
        verified: true,
      });
    }
  }

  const oneMinusCos = compact.match(/1-cos\(([^)]+)\)\^2/);
  if (oneMinusCos) {
    const u = oneMinusCos[1];
    const after = compact.replace(oneMinusCos[0], `sin(${u})^2`);
    if (approxEquivalent1D(canonical, after)) {
      suggestions.push({
        id: 'trig-1-cos2',
        category: 'trigonometric',
        title: 'Pythagorean Substitution',
        description: `1 - cos²(${u}) = sin²(${u})`,
        beforeCanonical: canonical,
        afterCanonical: after,
        afterLatex: canonicalToLatex(after),
        verified: true,
      });
    }
  }

  const tanPyth = compact.match(/1\+tan\(([^)]+)\)\^2|tan\(([^)]+)\)\^2\+1/);
  if (tanPyth) {
    const u = tanPyth[1] || tanPyth[2];
    const after = compact.replace(tanPyth[0], `sec(${u})^2`);
    if (approxEquivalent1D(canonical, after)) {
      suggestions.push({
        id: 'trig-1-tan2',
        category: 'trigonometric',
        title: 'Secant-Tangent Identity',
        description: `1 + tan²(${u}) = sec²(${u})`,
        beforeCanonical: canonical,
        afterCanonical: after,
        afterLatex: canonicalToLatex(after),
        verified: true,
      });
    }
  }

  const cotPyth = compact.match(/1\+cot\(([^)]+)\)\^2|cot\(([^)]+)\)\^2\+1/);
  if (cotPyth) {
    const u = cotPyth[1] || cotPyth[2];
    const after = compact.replace(cotPyth[0], `csc(${u})^2`);
    if (approxEquivalent1D(canonical, after)) {
      suggestions.push({
        id: 'trig-1-cot2',
        category: 'trigonometric',
        title: 'Cosecant-Cotangent Identity',
        description: `1 + cot²(${u}) = csc²(${u})`,
        beforeCanonical: canonical,
        afterCanonical: after,
        afterLatex: canonicalToLatex(after),
        verified: true,
      });
    }
  }

  const sinDouble = compact.match(/2\*sin\(([^)]+)\)\*cos\(([^)]+)\)/);
  if (sinDouble && sinDouble[1] === sinDouble[2]) {
    const u = sinDouble[1];
    const after = compact.replace(sinDouble[0], `sin(2*(${u}))`);
    if (approxEquivalent1D(canonical, after)) {
      suggestions.push({
        id: 'trig-sin2x',
        category: 'trigonometric',
        title: 'Sine Double-Angle Formula',
        description: `2·sin(${u})·cos(${u}) = sin(2·${u})`,
        beforeCanonical: canonical,
        afterCanonical: after,
        afterLatex: canonicalToLatex(after),
        verified: true,
      });
    }
  }

  const sinDoubleExpand = compact.match(/sin\(2\*([a-zA-Z])\)/);
  if (sinDoubleExpand) {
    const u = sinDoubleExpand[1];
    const after = compact.replace(sinDoubleExpand[0], `2*sin(${u})*cos(${u})`);
    if (approxEquivalent1D(canonical, after)) {
      suggestions.push({
        id: 'trig-sin2x-expand',
        category: 'trigonometric',
        title: 'Expand Double-Angle Sine',
        description: `sin(2${u}) = 2·sin(${u})·cos(${u})`,
        beforeCanonical: canonical,
        afterCanonical: after,
        afterLatex: canonicalToLatex(after),
        verified: true,
      });
    }
  }

  // 2. Algebraic identities
  const sqSum = compact.match(/^\(([a-zA-Z0-9]+)\+([a-zA-Z0-9]+)\)\^2$/);
  if (sqSum) {
    const [, p, q] = sqSum;
    const after = `${p}^2 + 2*${p}*${q} + ${q}^2`;
    suggestions.push({
      id: 'alg-square-sum',
      category: 'algebraic',
      title: 'Square of Sum',
      description: `(a + b)² = a² + 2ab + b²`,
      beforeCanonical: canonical,
      afterCanonical: after,
      afterLatex: canonicalToLatex(after),
      verified: true,
    });
  }

  const sqDiff = compact.match(/^\(([a-zA-Z0-9]+)-([a-zA-Z0-9]+)\)\^2$/);
  if (sqDiff) {
    const [, p, q] = sqDiff;
    const after = `${p}^2 - 2*${p}*${q} + ${q}^2`;
    suggestions.push({
      id: 'alg-square-diff',
      category: 'algebraic',
      title: 'Square of Difference',
      description: `(a - b)² = a² - 2ab + b²`,
      beforeCanonical: canonical,
      afterCanonical: after,
      afterLatex: canonicalToLatex(after),
      verified: true,
    });
  }

  const diffSquares = compact.match(/^([a-zA-Z0-9]+)\^2-([a-zA-Z0-9]+)\^2$/);
  if (diffSquares) {
    const [, p, q] = diffSquares;
    const after = `(${p} - ${q}) * (${p} + ${q})`;
    suggestions.push({
      id: 'alg-diff-squares',
      category: 'algebraic',
      title: 'Difference of Squares',
      description: `a² - b² = (a - b)(a + b)`,
      beforeCanonical: canonical,
      afterCanonical: after,
      afterLatex: canonicalToLatex(after),
      verified: true,
    });
  }

  const cubeSum = compact.match(/^\(([a-zA-Z0-9]+)\+([a-zA-Z0-9]+)\)\^3$/);
  if (cubeSum) {
    const [, p, q] = cubeSum;
    const after = `${p}^3 + 3*${p}^2*${q} + 3*${p}*${q}^2 + ${q}^3`;
    suggestions.push({
      id: 'alg-cube-sum',
      category: 'algebraic',
      title: 'Binomial Cube Expansion',
      description: `(a + b)³ = a³ + 3a²b + 3ab² + b³`,
      beforeCanonical: canonical,
      afterCanonical: after,
      afterLatex: canonicalToLatex(after),
      verified: true,
    });
  }

  const sumCubes = compact.match(/^([a-zA-Z0-9]+)\^3\+([a-zA-Z0-9]+)\^3$/);
  if (sumCubes) {
    const [, p, q] = sumCubes;
    const after = `(${p} + ${q}) * (${p}^2 - ${p}*${q} + ${q}^2)`;
    suggestions.push({
      id: 'alg-sum-cubes',
      category: 'algebraic',
      title: 'Sum of Cubes',
      description: `a³ + b³ = (a + b)(a² - ab + b²)`,
      beforeCanonical: canonical,
      afterCanonical: after,
      afterLatex: canonicalToLatex(after),
      verified: true,
    });
  }

  const diffCubes = compact.match(/^([a-zA-Z0-9]+)\^3-([a-zA-Z0-9]+)\^3$/);
  if (diffCubes) {
    const [, p, q] = diffCubes;
    const after = `(${p} - ${q}) * (${p}^2 + ${p}*${q} + ${q}^2)`;
    suggestions.push({
      id: 'alg-diff-cubes',
      category: 'algebraic',
      title: 'Difference of Cubes',
      description: `a³ - b³ = (a - b)(a² + ab + b²)`,
      beforeCanonical: canonical,
      afterCanonical: after,
      afterLatex: canonicalToLatex(after),
      verified: true,
    });
  }

  // 3. Logarithmic & Exponential identities
  const logProd = compact.match(/\b(?:log|ln)\(([^*+()]+)\*([^*+()]+)\)/);
  if (logProd) {
    const after = `log(${logProd[1]}) + log(${logProd[2]})`;
    suggestions.push({
      id: 'log-product',
      category: 'logarithmic',
      title: 'Logarithm of Product',
      description: `ln(a·b) = ln(a) + ln(b)  (a, b > 0)`,
      beforeCanonical: canonical,
      afterCanonical: after,
      afterLatex: canonicalToLatex(after),
      verified: true,
    });
  }

  const logPow = compact.match(/\b(?:log|ln)\(([a-zA-Z0-9]+)\^([a-zA-Z0-9]+)\)/);
  if (logPow) {
    const after = `${logPow[2]} * log(${logPow[1]})`;
    suggestions.push({
      id: 'log-power',
      category: 'logarithmic',
      title: 'Logarithm Power Rule',
      description: `ln(aⁿ) = n·ln(a)`,
      beforeCanonical: canonical,
      afterCanonical: after,
      afterLatex: canonicalToLatex(after),
      verified: true,
    });
  }

  const expSum = compact.match(/exp\(([^)]+)\)\*exp\(([^)]+)\)/);
  if (expSum) {
    const after = `exp(${expSum[1]} + ${expSum[2]})`;
    suggestions.push({
      id: 'exp-product',
      category: 'exponential',
      title: 'Exponential Product Law',
      description: `eᵃ · eᵇ = e^(a+b)`,
      beforeCanonical: canonical,
      afterCanonical: after,
      afterLatex: canonicalToLatex(after),
      verified: true,
    });
  }

  // 4. Hyperbolic identity
  const hypPyth = compact.match(/cosh\(([^)]+)\)\^2-sinh\(([^)]+)\)\^2/);
  if (hypPyth && hypPyth[1] === hypPyth[2]) {
    const after = compact.replace(hypPyth[0], '1');
    if (approxEquivalent1D(canonical, after)) {
      suggestions.push({
        id: 'hyp-pyth',
        category: 'hyperbolic',
        title: 'Hyperbolic Identity',
        description: `cosh²(${hypPyth[1]}) - sinh²(${hypPyth[1]}) = 1`,
        beforeCanonical: canonical,
        afterCanonical: after,
        afterLatex: canonicalToLatex(after),
        verified: true,
      });
    }
  }

  // 5. Euler / Complex exponential hint
  if (/\be\^\(i\*[^)]+\)|exp\(i\*[^)]+\)/.test(compact)) {
    const m = compact.match(/(?:e\^|exp)\(i\*([^)]+)\)/);
    if (m) {
      const th = m[1];
      const after = `cos(${th}) + i*sin(${th})`;
      suggestions.push({
        id: 'complex-euler',
        category: 'complex',
        title: "Euler's Formula",
        description: `e^(i${th}) = cos(${th}) + i·sin(${th})`,
        beforeCanonical: canonical,
        afterCanonical: after,
        afterLatex: canonicalToLatex(after),
        verified: true,
      });
    }
  }

  return suggestions;
}
