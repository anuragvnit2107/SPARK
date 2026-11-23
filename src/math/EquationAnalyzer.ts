import { parseSafeExpression } from './EquationParser';
import { parseMatrixInput } from './MatrixEngine';
import { canonicalToLatex, normalizeUnicodeToCanonical } from './SymbolConverter';
import { EquationAnalysis, EquationKind } from './types';

const PARAMETER_ALLOWLIST = new Set(['a', 'b', 'c', 'd', 'k', 'm', 'n', 'p', 'q', 'w', 'omega', 'alpha', 'beta', 'gamma', 'delta']);

export function analyzeEquation(
  rawInput: string,
  definedParameters: Record<string, number> = {}
): EquationAnalysis {
  const raw = rawInput.trim();
  const canonical = normalizeUnicodeToCanonical(raw);
  const latex = canonicalToLatex(canonical);

  if (!canonical) {
    return {
      raw,
      canonical: '',
      latex: '',
      kind: 'expression',
      category: 'Empty',
      variables: [],
      parameters: [],
      plottable2D: false,
      plottable3D: false,
      isConicCandidate: false,
      valid: false,
      error: 'Enter an equation or mathematical expression.',
      domainRestrictions: [],
      singularities: [],
      missingParameters: [],
    };
  }

  // Matrix detection: matrix = [[...]] or [[...]]
  if (/^\s*([a-zA-Z_][a-zA-Z0-9_]*\s*=\s*)?\[\[[\s\S]*\]\]\s*$/.test(canonical)) {
    const matRes = parseMatrixInput(canonical);
    return {
      raw,
      canonical,
      latex,
      kind: 'matrix',
      category: matRes.ok && matRes.matrix
        ? `Matrix (${matRes.matrix.length}×${matRes.matrix[0]?.length || 0})`
        : 'Matrix',
      variables: [],
      parameters: [],
      plottable2D: false,
      plottable3D: false,
      isConicCandidate: false,
      valid: matRes.ok,
      error: matRes.error,
      domainRestrictions: [],
      singularities: [],
      missingParameters: [],
    };
  }

  // ODE detection: y' = ..., dy/dx = ..., y'' + ... = ...
  if (/(\by'|y''|d\^?2?y\/dx\^?2?|dy\/dx)/.test(canonical)) {
    return {
      raw,
      canonical,
      latex,
      kind: 'ode',
      category: 'Differential Equation',
      variables: ['x', 'y'],
      parameters: [],
      plottable2D: false,
      plottable3D: false,
      isConicCandidate: false,
      valid: true,
      domainRestrictions: [],
      singularities: [],
      missingParameters: [],
    };
  }

  // Parametric 2D detection: x = f(t), y = g(t)
  const param2DMatch = canonical.match(/^x\s*=\s*([^,;]+)\s*[,;]\s*y\s*=\s*([^,;]+)$/);
  if (param2DMatch) {
    const p1 = parseSafeExpression(param2DMatch[1]);
    const p2 = parseSafeExpression(param2DMatch[2]);
    const vars = Array.from(new Set([...p1.variables, ...p2.variables]));
    const params = vars.filter((v) => v !== 't' && PARAMETER_ALLOWLIST.has(v));
    return {
      raw,
      canonical,
      latex,
      kind: 'parametric-2d',
      category: 'Parametric 2D',
      variables: vars,
      parameters: params,
      plottable2D: p1.valid && p2.valid,
      plottable3D: false,
      isConicCandidate: false,
      valid: p1.valid && p2.valid,
      error: p1.error || p2.error,
      domainRestrictions: [],
      singularities: [],
      missingParameters: params.filter((p) => !(p in definedParameters)),
    };
  }

  // Parametric 3D detection: x = f(u,v), y = g(u,v), z = h(u,v)
  const param3DMatch = canonical.match(
    /^x\s*=\s*([^,;]+)\s*[,;]\s*y\s*=\s*([^,;]+)\s*[,;]\s*z\s*=\s*([^,;]+)$/
  );
  if (param3DMatch) {
    const p1 = parseSafeExpression(param3DMatch[1]);
    const p2 = parseSafeExpression(param3DMatch[2]);
    const p3 = parseSafeExpression(param3DMatch[3]);
    const vars = Array.from(new Set([...p1.variables, ...p2.variables, ...p3.variables]));
    const params = vars.filter((v) => v !== 'u' && v !== 'v' && v !== 't' && PARAMETER_ALLOWLIST.has(v));
    return {
      raw,
      canonical,
      latex,
      kind: 'parametric-3d',
      category: 'Parametric 3D',
      variables: vars,
      parameters: params,
      plottable2D: false,
      plottable3D: p1.valid && p2.valid && p3.valid,
      isConicCandidate: false,
      valid: p1.valid && p2.valid && p3.valid,
      error: p1.error || p2.error || p3.error,
      domainRestrictions: [],
      singularities: [],
      missingParameters: params.filter((p) => !(p in definedParameters)),
    };
  }

  // Inequality detection
  if (/(<=|>=|<|>)/.test(canonical) && !canonical.includes('->')) {
    const parts = canonical.split(/<=|>=|<|>/);
    const pL = parseSafeExpression(parts[0] || '');
    const pR = parseSafeExpression(parts[1] || '');
    const vars = Array.from(new Set([...pL.variables, ...pR.variables]));
    return {
      raw,
      canonical,
      latex,
      kind: 'inequality',
      category: 'Inequality',
      variables: vars,
      parameters: [],
      plottable2D: vars.includes('x') || vars.includes('y'),
      plottable3D: false,
      isConicCandidate: false,
      valid: pL.valid && pR.valid,
      error: pL.error || pR.error,
      domainRestrictions: detectDomainRestrictions(canonical),
      singularities: detectSingularities(canonical),
      missingParameters: [],
    };
  }

  // Polar detection: r = f(theta)
  const polarMatch = canonical.match(/^r\s*=\s*(.+)$/);
  if (polarMatch) {
    const pRhs = parseSafeExpression(polarMatch[1]);
    const params = pRhs.variables.filter((v) => v !== 'theta' && PARAMETER_ALLOWLIST.has(v));
    return {
      raw,
      canonical,
      latex,
      kind: 'polar',
      category: 'Polar Function',
      variables: pRhs.variables,
      parameters: params,
      plottable2D: pRhs.valid,
      plottable3D: false,
      isConicCandidate: false,
      valid: pRhs.valid,
      error: pRhs.error,
      domainRestrictions: detectDomainRestrictions(canonical),
      singularities: detectSingularities(canonical),
      missingParameters: params.filter((p) => !(p in definedParameters)),
    };
  }

  // Equations with '='
  const eqIdx = canonical.indexOf('=');
  if (eqIdx !== -1 && !canonical.includes('!=')) {
    const lhs = canonical.slice(0, eqIdx).trim();
    const rhs = canonical.slice(eqIdx + 1).trim();
    const pLhs = parseSafeExpression(lhs);
    const pRhs = parseSafeExpression(rhs);
    const allVars = Array.from(new Set([...pLhs.variables, ...pRhs.variables]));
    const params = allVars.filter(
      (v) => v !== 'x' && v !== 'y' && v !== 'z' && v !== 't' && v !== 'theta' && PARAMETER_ALLOWLIST.has(v)
    );
    const valid = pLhs.valid && pRhs.valid;

    let kind: EquationKind = 'algebraic-equation';
    let category = 'Equation';
    let plottable2D = false;
    let plottable3D = false;
    let isConicCandidate = false;

    if (/^z$/i.test(lhs) || /^[a-zA-Z]\w*\s*\(\s*x\s*,\s*y\s*\)$/i.test(lhs)) {
      kind = 'explicit-3d';
      category = '3D Surface Function';
      plottable3D = valid;
    } else if (allVars.includes('z')) {
      kind = 'implicit-3d';
      category = 'Implicit 3D Equation';
      plottable3D = valid;
    } else if ((/^y$/i.test(lhs) || /^[a-zA-Z]\w*\s*\(\s*x\s*\)$/i.test(lhs)) && !pRhs.variables.includes('y')) {
      kind = 'explicit-2d';
      category = 'Function y = f(x)';
      plottable2D = valid;
    } else if (allVars.includes('x') && allVars.includes('y')) {
      kind = 'implicit-2d';
      const preCombined = `${pLhs.canonical} = ${pRhs.canonical}`;
      isConicCandidate = /\^2|x\s*\*\s*y|x\^2|y\^2/.test(preCombined);
      category = isConicCandidate ? 'Implicit Conic / Relation' : 'Implicit 2D Relation';
      plottable2D = valid;
    } else if (allVars.includes('x') || allVars.includes('y')) {
      // Single-variable equations like 2x + 5 = 15 remain algebraic-equation (solvable & plottable as x=root)
      kind = 'algebraic-equation';
      category = 'Algebraic Equation';
      plottable2D = valid;
      isConicCandidate = /\^2/.test(`${pLhs.canonical} = ${pRhs.canonical}`);
    }

    return {
      raw,
      canonical,
      latex,
      kind,
      category,
      variables: allVars,
      parameters: params,
      plottable2D,
      plottable3D,
      isConicCandidate,
      valid,
      error: pLhs.error || pRhs.error,
      domainRestrictions: detectDomainRestrictions(canonical),
      singularities: detectSingularities(canonical),
      missingParameters: params.filter((p) => !(p in definedParameters)),
    };
  }

  // Bare expression (e.g. sin(x) + x^2, a^2+b^2, 1/2+1/3, sin(30), theta+alpha)
  const parsed = parseSafeExpression(canonical);
  const vars = parsed.variables;
  const params = vars.filter(
    (v) => v !== 'x' && v !== 'y' && v !== 'z' && v !== 't' && v !== 'theta' && PARAMETER_ALLOWLIST.has(v)
  );
  const hasX = vars.includes('x');
  const hasY = vars.includes('y');

  let kind: EquationKind = 'expression';
  let category = 'Calculation';
  let plottable2D = false;
  let plottable3D = false;
  let isBareExpressionInX = false;

  if (hasX && hasY) {
    kind = 'explicit-3d';
    category = '3D Expression';
    plottable3D = parsed.valid;
  } else if (hasX) {
    kind = 'explicit-2d';
    category = 'Expression in x';
    plottable2D = parsed.valid;
    isBareExpressionInX = parsed.valid;
  } else if (/\b(sin|cos|tan|cot|sec|csc|asin|acos|atan|sinh|cosh|tanh)\s*\(/i.test(parsed.canonical)) {
    kind = 'expression';
    category = vars.length === 0 ? 'Trigonometric Calculation' : 'Trigonometric Expression';
  } else if (vars.length > 0) {
    kind = 'expression';
    category = 'Algebraic Expression';
  }

  return {
    raw,
    canonical,
    latex,
    kind,
    category,
    isBareExpressionInX,
    variables: vars,
    parameters: params,
    plottable2D,
    plottable3D,
    isConicCandidate: false,
    valid: parsed.valid,
    error: parsed.error,
    domainRestrictions: detectDomainRestrictions(canonical),
    singularities: detectSingularities(canonical),
    missingParameters: params.filter((p) => !(p in definedParameters)),
  };
}

function detectDomainRestrictions(expr: string): string[] {
  const restrictions: string[] = [];
  if (/sqrt\s*\(([^)]+)\)/.test(expr)) {
    const m = expr.match(/sqrt\s*\(([^)]+)\)/);
    if (m) restrictions.push(`${m[1]} ≥ 0`);
  }
  if (/\b(?:log|ln|log10|log2)\s*\(([^)]+)\)/.test(expr)) {
    const m = expr.match(/\b(?:log|ln|log10|log2)\s*\(([^)]+)\)/);
    if (m) restrictions.push(`${m[1]} > 0`);
  }
  if (/\b(?:asin|acos)\s*\(([^)]+)\)/.test(expr)) {
    const m = expr.match(/\b(?:asin|acos)\s*\(([^)]+)\)/);
    if (m) restrictions.push(`-1 ≤ ${m[1]} ≤ 1`);
  }
  return restrictions;
}

function detectSingularities(expr: string): string[] {
  const sings: string[] = [];
  if (/\/\s*x\b/.test(expr) || /\/\s*\(\s*x\s*\)/.test(expr)) {
    sings.push('x = 0 (division by zero)');
  }
  const denomMatch = expr.match(/\/\s*\(([^)]+)\)/);
  if (denomMatch && denomMatch[1] !== 'x') {
    sings.push(`${denomMatch[1]} = 0`);
  }
  if (/\btan\s*\(/.test(expr)) {
    sings.push('cos(arg) = 0 (vertical asymptotes at π/2 + kπ)');
  }
  if (/\bcot\s*\(/.test(expr) || /\bcsc\s*\(/.test(expr)) {
    sings.push('sin(arg) = 0 (vertical asymptotes at kπ)');
  }
  if (/\bsec\s*\(/.test(expr)) {
    sings.push('cos(arg) = 0 (vertical asymptotes at π/2 + kπ)');
  }
  return sings;
}
