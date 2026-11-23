import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canonicalToLatex,
  convertKeyboardInputAtCursor,
  convertTrailingGreekKeyword,
  normalizeUnicodeToCanonical,
} from '../math/SymbolConverter';
import {
  compileSafeEvaluator,
  evaluateMathExpression,
  parseSafeExpression,
  toNerdamerInput,
} from '../math/EquationParser';
import {
  classifyMatrix,
  matrixAdd,
  matrixCharacteristicPolynomial,
  matrixDeterminant,
  matrixEigen,
  matrixGaussianElimination,
  matrixInverse,
  matrixLU,
  matrixMultiply,
  matrixQR,
  matrixRank,
  matrixSVD,
  matrixSubtract,
  matrixTrace,
  matrixTranspose,
  parseMatrixInput,
  solveLinearSystem,
} from '../math/MatrixEngine';
import {
  evaluateExpressionValue,
  expandExpression,
  factorExpression,
  simplifyExpression,
  solveEquation,
  solveInequality1D,
  solveSimultaneousEquations,
} from '../math/AlgebraEngine';
import {
  differentiateImplicit,
  differentiateSymbolic,
  evaluateLimit,
  integrateDefinite,
  integrateIndefinite,
} from '../math/CalculusEngine';
import { suggestIdentities } from '../math/IdentitySuggestionEngine';
import { analyzeConicEquation } from '../math/ConicSectionEngine';
import {
  findRootNewtonRaphson,
  solveODEBoundaryValueShooting,
  solveODEFirstOrderRK4,
} from '../math/NumericalMethodsEngine';
import {
  computeDFT,
  computeFourierSeries,
  computeLaplaceTransform,
  computeStatistics,
  vectorOperations,
} from '../math/EngineeringMathEngine';
import { evaluate2DEquation, findExplicitIntersections } from '../math/Graph2DEngine';
import { evaluate3DSurfaceGrid, generateContourSegments } from '../math/Graph3DEngine';
import { createDefaultGraph3DConfig } from '../math/MathCanvasIntegration';
import { analyzeEquation } from '../math/EquationAnalyzer';

test('SymbolConverter converts natural math sequences without corrupting normal words or cursors', () => {
  assert.equal(convertKeyboardInputAtCursor('a^2', 3).nextValue, 'a²');
  assert.equal(convertKeyboardInputAtCursor('x_12', 4).nextValue, 'x₁₂');
  assert.equal(convertKeyboardInputAtCursor('a!=', 3).nextValue, 'a≠');

  // "theta" after delimiter converts; ordinary identifier "alphabet" stays intact
  const s2 = convertKeyboardInputAtCursor('theta ', 6);
  assert.equal(s2.nextValue, 'θ ');
  const s3 = convertKeyboardInputAtCursor('alphabet ', 9);
  assert.equal(s3.nextValue, 'alphabet ');

  const norm = normalizeUnicodeToCanonical('θ² + √(a+b) ≠ 0');
  assert.ok(norm.includes('theta^2'));
  assert.ok(norm.includes('sqrt(a+b)'));
  assert.ok(norm.includes('!='));

  const tex = canonicalToLatex('(a+b)/c + sqrt(x)');
  assert.ok(tex.includes('\\frac'));
  assert.ok(tex.includes('\\sqrt'));
});

test('EquationParser blocks dangerous identifiers and evaluates safely without eval/Function', () => {
  assert.equal(parseSafeExpression('window.alert(1)').valid, false);
  assert.equal(parseSafeExpression('__proto__ + 1').valid, false);
  assert.equal(parseSafeExpression('eval("2+2")').valid, false);

  const evalRes = compileSafeEvaluator('sin(x)^2 + cos(x)^2', 'rad');
  assert.equal(evalRes.ok, true);
  assert.ok(evalRes.evaluator);
  assert.ok(Math.abs(Number(evalRes.evaluator({ x: 1.23 })) - 1) < 1e-12);

  const degRes = compileSafeEvaluator('sin(x)', 'deg');
  assert.equal(degRes.ok, true);
  assert.ok(Math.abs(Number(degRes.evaluator?.({ x: 90 }) ?? 0) - 1) < 1e-12);
});

test('MatrixEngine parses [[...]], classifies matrices, and computes exact linear algebra operations', () => {
  const parsed = parseMatrixInput('A = [[1, 2], [3, 4]]');
  assert.equal(parsed.ok, true);
  assert.equal(parsed.name, 'A');
  assert.deepEqual(parsed.matrix, [
    [1, 2],
    [3, 4],
  ]);

  const idInfo = classifyMatrix([
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ]);
  assert.ok(idInfo.tags.includes('Identity Matrix'));
  assert.ok(idInfo.tags.includes('Symmetric'));

  const diagInfo = classifyMatrix([
    [2, 0],
    [0, 5],
  ]);
  assert.ok(diagInfo.tags.includes('Diagonal'));

  const A = [
    [4, 7],
    [2, 6],
  ];
  const B = [
    [1, 2],
    [3, 4],
  ];
  assert.deepEqual(matrixAdd(A, B).matrix, [
    [5, 9],
    [5, 10],
  ]);
  assert.deepEqual(matrixMultiply(A, B).matrix, [
    [25, 36],
    [20, 28],
  ]);
  assert.deepEqual(matrixTranspose(A).matrix, [
    [4, 2],
    [7, 6],
  ]);
  assert.equal(matrixTrace(A).scalar, 10);
  assert.equal(matrixDeterminant(A).scalar, 10);
  assert.equal(matrixRank(A).scalar, 2);

  const inv = matrixInverse(A);
  assert.equal(inv.ok, true);
  assert.ok(Math.abs(inv.matrix![0][0] - 0.6) < 1e-9);
  assert.ok(Math.abs(inv.matrix![0][1] - -0.7) < 1e-9);

  // LU & QR verification
  const lu = matrixLU(A);
  assert.equal(lu.ok, true);
  assert.ok(lu.matrices?.some((m) => m.label === 'L') && lu.matrices?.some((m) => m.label === 'U'));

  const qr = matrixQR(A);
  assert.equal(qr.ok, true);
  assert.ok(qr.matrices?.some((m) => m.label === 'Q') && qr.matrices?.some((m) => m.label === 'R'));

  // SVD verification on symmetric matrix
  const S = [
    [3, 1],
    [1, 3],
  ];
  const svd = matrixSVD(S);
  assert.equal(svd.ok, true);
  assert.ok(svd.matrices?.some((m) => m.label === 'Σ'));

  // Eigenvalues & Characteristic Polynomial
  const eig = matrixEigen(S);
  assert.equal(eig.ok, true);
  assert.ok(eig.eigenvalues);
  const sortedEig = eig.eigenvalues!.map((e) => e.real).sort((a, b) => a - b);
  assert.ok(Math.abs(sortedEig[0] - 2) < 1e-4);
  assert.ok(Math.abs(sortedEig[1] - 4) < 1e-4);

  const cp = matrixCharacteristicPolynomial(S);
  assert.equal(cp.ok, true);
  assert.ok(cp.textResult.includes('λ') || cp.polynomial?.includes('λ'));

  // RREF and linear solve Ax = b
  const rref = matrixGaussianElimination(A, true);
  assert.equal(rref.ok, true);
  assert.ok(rref.steps && rref.steps.length > 0);

  const sys = solveLinearSystem(A, [18, 14]);
  assert.equal(sys.ok, true);
  assert.ok(Math.abs(sys.vector![0] - 1) < 1e-9);
  assert.ok(Math.abs(sys.vector![1] - 2) < 1e-9);

  // Dimension mismatch and singular error handling
  assert.equal(matrixAdd(A, [[1, 2, 3]]).ok, false);
  assert.equal(
    matrixInverse([
      [1, 2],
      [2, 4],
    ]).ok,
    false
  );
});

test('AlgebraEngine, CalculusEngine, IdentitySuggestionEngine, and ConicSectionEngine compute accurate symbolic results', () => {
  const exp = expandExpression('(x + 2)^2');
  assert.equal(exp.ok, true);
  assert.ok(exp.resultText.includes('x^2') && exp.resultText.includes('4'));

  const fac = factorExpression('x^2 - 9');
  assert.equal(fac.ok, true);
  assert.ok(fac.resultText.includes('3') && fac.resultText.includes('*'));

  const simp = simplifyExpression('2*x + 3*x');
  assert.equal(simp.ok, true);
  assert.ok(simp.resultText.includes('5*x') || simp.resultText.includes('5x'));

  const sol = solveEquation('x^2 - 5*x + 6 = 0', 'x');
  assert.equal(sol.ok, true);
  assert.ok(sol.resultText.includes('2') && sol.resultText.includes('3'));

  const simSol = solveSimultaneousEquations(['x + y = 5', 'x - y = 1']);
  assert.equal(simSol.ok, true);
  assert.ok(simSol.resultText.includes('3') && simSol.resultText.includes('2'));

  const ineq = solveInequality1D('x^2 - 4 < 0', 'x');
  assert.equal(ineq.ok, true);
  assert.ok(ineq.resultText.includes('-2') && ineq.resultText.includes('2'));

  const diff = differentiateSymbolic('x^3 + sin(x)', 'x', 1);
  assert.equal(diff.ok, true);
  assert.ok(diff.resultCanonical.includes('3*x^2') && diff.resultCanonical.includes('cos(x)'));

  const imp = differentiateImplicit('x^2 + y^2 = 25', 'x', 'y');
  assert.equal(imp.ok, true);
  assert.ok(imp.operation.includes('dy/dx'));
  assert.ok(imp.resultCanonical.includes('-x') && imp.resultCanonical.includes('y'));

  const defInt = integrateDefinite('x^2', 0, 3, 'x');
  assert.equal(defInt.ok, true);
  assert.ok(Math.abs((defInt.numericValue ?? 0) - 9) < 1e-5);

  const lim = evaluateLimit('sin(x)/x', 'x', 0);
  assert.equal(lim.ok, true);
  assert.ok(lim.resultCanonical.includes('1'));

  const ids = suggestIdentities('sin(x)^2 + cos(x)^2');
  assert.ok(ids.some((i) => i.title.includes('Pythagorean')));

  const ellipse = analyzeConicEquation('x^2/9 + y^2/4 = 1');
  assert.equal(ellipse.isConic, true);
  assert.equal(ellipse.type, 'ellipse');
  assert.ok(ellipse.eccentricity && ellipse.eccentricity > 0.7 && ellipse.eccentricity < 0.8);
});

test('NumericalMethodsEngine & EngineeringMathEngine compute RK4 ODE, shooting BVP, root finding, transforms, and stats', () => {
  // dy/dx = -2*x*y, y(0)=1 => exact y(1) = e^(-1) ≈ 0.367879441
  const rk4 = solveODEFirstOrderRK4('-2*x*y', 0, 1, 1, 200);
  assert.equal(rk4.ok, true);
  const lastY = rk4.points[rk4.points.length - 1].y;
  assert.ok(Math.abs(lastY - Math.exp(-1)) < 1e-6);

  // Shooting BVP: y'' = 0, y(0)=0, y(1)=5 => y'(0)=5
  const bvp = solveODEBoundaryValueShooting('0', 0, 0, 1, 5);
  assert.equal(bvp.ok, true);
  const endPt = bvp.points[bvp.points.length - 1];
  assert.ok(Math.abs(endPt.y - 5) < 1e-4);
  assert.ok(Math.abs((bvp.points[0].yp ?? 0) - 5) < 1e-4);

  const root = findRootNewtonRaphson('x^2 - 2', 1.5);
  assert.equal(root.ok, true);
  assert.ok(Math.abs((root.root ?? 0) - Math.SQRT2) < 1e-8);

  const lap = computeLaplaceTransform('sin(3*t)', false);
  assert.equal(lap.ok, true);
  assert.ok(lap.resultText.includes('s^2') && lap.resultText.includes('9'));

  const dft = computeDFT([1, 0, -1, 0]);
  assert.equal(dft.ok, true);
  assert.ok(dft.spectrum && dft.spectrum.length === 4);

  const fs = computeFourierSeries('x', Math.PI, 3);
  assert.equal(fs.ok, true);

  const vec = vectorOperations([1, 0, 0], [0, 1, 0]);
  assert.equal(vec.dot, 0);
  assert.deepEqual(vec.cross, [0, 0, 1]);

  const stats = computeStatistics([1, 2, 3], [2, 4, 6]);
  assert.equal(stats.mean, 2);
  assert.ok(stats.linearRegression && Math.abs(stats.linearRegression.slope - 2) < 1e-9);
});

test('Graph2DEngine and Graph3DEngine compute asymptote-split segments, intersections, 3D grids, and contours', () => {
  // Asymptote split on 1/x across [-5, 5] must produce >= 2 disconnected segments
  const invCurve = evaluate2DEquation(
    { id: 'c1', expression: '1/x', color: '#38bdf8', thickness: 2, lineStyle: 'solid', visible: true },
    { xMin: -5, xMax: 5, yMin: -5, yMax: 5 },
    'rad',
    {}
  );
  assert.ok(invCurve.segments.length >= 2);

  // Intersections of y = x^2 and y = x + 2 -> (-1, 1) and (2, 4)
  const hits = findExplicitIntersections('x^2', 'x + 2', { xMin: -5, xMax: 5, yMin: -5, yMax: 10 }, 'rad', {});
  assert.equal(hits.length, 2);
  assert.ok(Math.abs(hits[0].x - -1) < 1e-3);
  assert.ok(Math.abs(hits[1].x - 2) < 1e-3);

  // Implicit circle x^2 + y^2 = 4 produces closed contour segments
  const circle = evaluate2DEquation(
    { id: 'c2', expression: 'x^2 + y^2 = 4', color: '#10b981', thickness: 2, lineStyle: 'solid', visible: true },
    { xMin: -4, xMax: 4, yMin: -4, yMax: 4 },
    'rad',
    {}
  );
  assert.ok(circle.segments.length > 10);

  // 3D grid + contour isolines
  const cfg3d = createDefaultGraph3DConfig('a*x^2 + b*y^2');
  const grid = evaluate3DSurfaceGrid(cfg3d);
  assert.ok(grid.zMaxFound > grid.zMinFound);
  const contours = generateContourSegments(grid, 6);
  assert.ok(contours.segments.length > 10);
});

test('Plain-text mathematical input pipeline handles implicit mult, exact fractions, DEG/RAD trig, logs, Greek keywords, and CAS', () => {
  // Implicit multiplication preservation & expansion
  assert.equal(toNerdamerInput('2x + 5 = 15'), '2*x+5 = 15');
  assert.equal(toNerdamerInput('3ab'), '3*a*b');
  assert.equal(toNerdamerInput('2(x+1)'), '2*(x+1)');
  assert.equal(toNerdamerInput('(a+b)(a-b)'), '(a+b)*(a-b)');
  assert.equal(toNerdamerInput('theta + alpha'), 'theta+alpha');

  // Trailing Greek keyword conversion on blur/submit
  assert.equal(convertTrailingGreekKeyword('theta').nextValue, 'θ');
  assert.equal(convertTrailingGreekKeyword('θ + alpha').nextValue, 'θ + α');
  assert.equal(convertTrailingGreekKeyword('alphabet').nextValue, 'alphabet');

  // Exact rational & numeric evaluation
  const fracRes = evaluateExpressionValue('1/2 + 1/3', 'rad');
  assert.equal(fracRes.ok, true);
  assert.equal(fracRes.resultText, '5/6');

  const sqrtRes = evaluateExpressionValue('sqrt(25)', 'rad');
  assert.equal(sqrtRes.ok, true);
  assert.equal(sqrtRes.resultText, '5');

  const logRes = evaluateExpressionValue('log(100)', 'rad');
  assert.equal(logRes.ok, true);
  assert.equal(logRes.resultText, '2');

  const lnRes = evaluateExpressionValue('ln(e)', 'rad');
  assert.equal(lnRes.ok, true);
  assert.equal(lnRes.resultText, '1');

  const piRes = evaluateMathExpression('pi + 2', { angleUnit: 'rad' });
  assert.equal(piRes.ok, true);
  assert.ok(Math.abs((piRes.numericValue ?? 0) - (Math.PI + 2)) < 1e-10);

  // DEG vs RAD trig accuracy
  assert.equal(evaluateExpressionValue('sin(30)', 'deg').resultText, '0.5');
  assert.equal(evaluateExpressionValue('cos(60)', 'deg').resultText, '0.5');
  assert.equal(evaluateExpressionValue('tan(45)', 'deg').resultText, '1');

  // Symbolic algebra & calculus on plain-text expressions
  const sol = solveEquation('2x + 5 = 15', 'x');
  assert.equal(sol.ok, true);
  assert.ok(sol.resultText.includes('5'));

  const exp = expandExpression('(x+1)^2');
  assert.equal(exp.ok, true);
  assert.ok(exp.resultText.includes('x^2') && exp.resultText.includes('2*x'));

  const fac = factorExpression('x^2 - 4');
  assert.equal(fac.ok, true);
  assert.ok(fac.resultText.includes('x-2') || fac.resultText.includes('-2+x'));
  assert.ok(fac.resultText.includes('x+2') || fac.resultText.includes('2+x'));

  const diff = differentiateSymbolic('x^2', 'x', 1);
  assert.equal(diff.ok, true);
  assert.ok(diff.resultCanonical.includes('2*x'));

  const indef = integrateIndefinite('x^2 - 4', 'x');
  assert.equal(indef.ok, true);
  assert.ok(indef.resultCanonical.includes('+ C'));

  // Clear error handling for unbalanced delimiters and division by zero
  assert.equal(simplifyExpression('((x+1)').ok, false);
  assert.equal(evaluateExpressionValue('1 / 0', 'rad').ok, false);
});

test('Section 9 Mathematics Test Suite: exact inputs, live typing conversions, classification, and edge cases', () => {
  // Arithmetic & functions
  assert.equal(evaluateExpressionValue('2+3', 'rad').resultText, '5');
  assert.equal(evaluateExpressionValue('2*3+4', 'rad').resultText, '10');
  assert.equal(evaluateExpressionValue('2^3', 'rad').resultText, '8');
  assert.equal(evaluateExpressionValue('sqrt(25)', 'rad').resultText, '5');
  assert.equal(evaluateExpressionValue('1/2+1/3', 'rad').resultText, '5/6');
  assert.equal(evaluateExpressionValue('sin(30)', 'deg').resultText, '0.5');
  assert.equal(evaluateExpressionValue('cos(60)', 'deg').resultText, '0.5');
  assert.equal(evaluateExpressionValue('tan(45)', 'deg').resultText, '1');
  assert.equal(evaluateExpressionValue('sin(30 + (0))', 'deg').resultText, '0.5');

  // Classification
  const abSq = analyzeEquation('(a+b)^2');
  assert.equal(abSq.valid, true);
  assert.equal(abSq.category, 'Algebraic Expression');
  assert.deepEqual(abSq.variables.sort(), ['a', 'b']);

  const poly = analyzeEquation('x^2-4');
  assert.equal(poly.valid, true);
  assert.equal(poly.isBareExpressionInX, true);
  assert.equal(poly.plottable2D, true);

  const gFunc = analyzeEquation('g(x) = x^2 + 1');
  assert.equal(gFunc.valid, true);
  assert.equal(gFunc.kind, 'explicit-2d');
  assert.equal(gFunc.plottable2D, true);

  // Greek symbols remain variables and evaluate cleanly
  const greekAnalysis = analyzeEquation('theta+alpha');
  assert.equal(greekAnalysis.valid, true);
  assert.equal(greekAnalysis.category, 'Algebraic Expression');
  assert.deepEqual(greekAnalysis.variables.sort(), ['alpha', 'theta']);
  assert.equal(canonicalToLatex('theta+alpha'), '\\theta+\\alpha');
  assert.equal(evaluateExpressionValue('theta+alpha', 'rad').ok, true);

  // Keystroke-by-keystroke live typing for x^-2 and x_12
  const typeSeq = (str: string): string => {
    let val = '';
    let cur = 0;
    for (const ch of str) {
      val = val.slice(0, cur) + ch + val.slice(cur);
      cur++;
      const res = convertKeyboardInputAtCursor(val, cur);
      val = res.nextValue;
      cur = res.nextCursor;
    }
    return convertTrailingGreekKeyword(val).nextValue;
  };
  assert.equal(typeSeq('x^-2'), 'x⁻²');
  assert.equal(typeSeq('x_12'), 'x₁₂');
  assert.equal(typeSeq('theta + alpha'), 'θ + α');
  assert.equal(normalizeUnicodeToCanonical('x⁻²'), 'x^(-2)');

  // 3ab LaTeX renders 3 * a * b (not single variable ab)
  const tex3ab = canonicalToLatex('3ab');
  assert.ok(!tex3ab.includes('ab'), `Expected split variables in LaTeX, got: ${tex3ab}`);

  // Matrix literal recognition
  const matLit = analyzeEquation('[[1,2],[3,4]]');
  assert.equal(matLit.valid, true);
  assert.equal(matLit.kind, 'matrix');
  assert.equal(matLit.category, 'Matrix (2×2)');
  const matNamed = parseMatrixInput('matrix = [[1,2,3],[4,5,6],[7,8,9]]');
  assert.equal(matNamed.ok, true);
  assert.equal(matNamed.name, 'matrix');
  assert.deepEqual(matNamed.matrix, [[1, 2, 3], [4, 5, 6], [7, 8, 9]]);

  // Edge cases: negative powers, nested fractions, large expressions
  assert.equal(evaluateExpressionValue('2^-3', 'rad').resultText, '1/8');
  assert.equal(evaluateExpressionValue('(1/2)/(1/3)', 'rad').resultText, '3/2');
  const large = Array.from({ length: 20 }, (_, i) => `${i + 1}`).join('+');
  assert.equal(evaluateExpressionValue(large, 'rad').resultText, '210');

  // Invalid / error states
  assert.equal(evaluateExpressionValue('', 'rad').ok, false);
  assert.equal(evaluateExpressionValue('2+*3', 'rad').ok, false);
  assert.equal(evaluateExpressionValue('(x+1', 'rad').ok, false);
  assert.equal(evaluateExpressionValue('1/0', 'rad').ok, false);
  assert.equal(evaluateMathExpression('foo + bar', { angleUnit: 'rad' }).ok, false);
});

test('Plain-text shorthand powers, function-wrapped CAS, LaTeX formatting, Greek powers, and matrices work seamlessly', () => {
  // Shorthand powers a2+b2 and x2+y2=25
  const pyth = parseSafeExpression('a2+b2');
  assert.equal(pyth.valid, true);
  assert.equal(pyth.canonical, 'a^2+b^2');

  const circleEq = analyzeEquation('x2+y2=25');
  assert.equal(circleEq.valid, true);
  assert.equal(circleEq.category, 'Implicit Conic / Relation');
  assert.equal(circleEq.plottable2D, true);

  const circleImp = differentiateImplicit('x2+y2=25', 'x', 'y');
  assert.equal(circleImp.ok, true);
  assert.ok(circleImp.resultLatex.includes('\\frac{x}{y}'));

  // Function-wrapped symbolic CAS & equation simplification
  const expFn = expandExpression('f(x) = (x+1)^2');
  assert.equal(expFn.ok, true);
  assert.ok(expFn.resultText.startsWith('f(x) = '));
  assert.ok(expFn.resultText.includes('x^2') && expFn.resultText.includes('2*x'));

  const facFn = factorExpression('f(x) = x^2 - 4');
  assert.equal(facFn.ok, true);
  assert.ok(facFn.resultText.startsWith('f(x) = '));
  assert.ok(facFn.resultText.includes('x-2') || facFn.resultText.includes('2+x'));

  const diffFn = differentiateSymbolic('f(x) = x^2', 'x', 1);
  assert.equal(diffFn.ok, true);
  assert.ok(diffFn.resultCanonical.includes('2*x'));

  const intFn = integrateIndefinite('f(x) = x^2 - 4', 'x');
  assert.equal(intFn.ok, true);
  assert.ok(intFn.resultCanonical.includes('+ C'));

  const simpEq = simplifyExpression('2x+5=15');
  assert.equal(simpEq.ok, true);
  assert.ok(simpEq.resultText.includes('='));

  // LaTeX accuracy for logs and implicit multi-char products
  assert.equal(canonicalToLatex('log(100)'), '\\log\\left(100\\right)');
  assert.equal(canonicalToLatex('ln(e)'), '\\ln\\left( e\\right)');
  const latex3ab = canonicalToLatex('3ab');
  assert.ok(!latex3ab.includes('\\cdotb') && latex3ab.includes('\\cdot a\\cdot b'), `Got ${latex3ab}`);

  // Greek superscripts & subscripts
  assert.equal(convertKeyboardInputAtCursor('θ^2', 3).nextValue, 'θ²');
  assert.equal(convertKeyboardInputAtCursor('α_1', 3).nextValue, 'α₁');
  assert.equal(convertTrailingGreekKeyword('theta+alpha').nextValue, 'θ+α');

  // Matrix literal and matrix algebra suite (+, -, *, det, inv)
  const p2 = parseMatrixInput('[[1,2],[3,4]]');
  assert.equal(p2.ok, true);
  assert.deepEqual(p2.matrix, [[1, 2], [3, 4]]);
  const p3 = parseMatrixInput('matrix = [[1,2,3],[4,5,6],[7,8,9]]');
  assert.equal(p3.ok, true);
  assert.equal(p3.name, 'matrix');
  assert.deepEqual(p3.matrix, [[1, 2, 3], [4, 5, 6], [7, 8, 9]]);

  const mA = [[1, 2], [3, 4]];
  const mB = [[5, 6], [7, 8]];
  assert.deepEqual(matrixAdd(mA, mB).matrix, [[6, 8], [10, 12]]);
  assert.deepEqual(matrixSubtract(mB, mA).matrix, [[4, 4], [4, 4]]);
  assert.deepEqual(matrixMultiply(mA, mB).matrix, [[19, 22], [43, 50]]);
  assert.equal(matrixDeterminant(mA).scalar, -2);
  const invA = matrixInverse(mA);
  assert.equal(invA.ok, true);
  assert.ok(invA.matrix && Math.abs(invA.matrix[0][0] - (-2)) < 1e-6);
});

