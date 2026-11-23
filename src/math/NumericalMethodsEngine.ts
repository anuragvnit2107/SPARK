import { evaluateNumericSafe } from './EquationParser';

export interface ODESolution {
  ok: boolean;
  method: string;
  points: Array<{ x: number; y: number; yp?: number }>;
  summary: string;
  error?: string;
}

/**
 * 4th-order Runge-Kutta IVP solver for dy/dx = f(x, y), y(x0) = y0.
 */
export function solveODEFirstOrderRK4(
  rhsExpr: string,
  x0: number,
  y0: number,
  xEnd: number,
  steps = 100
): ODESolution {
  const n = Math.max(10, Math.min(2000, steps));
  const h = (xEnd - x0) / n;
  let x = x0;
  let y = y0;
  const pts: Array<{ x: number; y: number }> = [{ x, y }];

  for (let i = 0; i < n; i++) {
    const k1 = evaluateNumericSafe(rhsExpr, { x, y });
    const k2 = evaluateNumericSafe(rhsExpr, { x: x + h / 2, y: y + (h / 2) * k1 });
    const k3 = evaluateNumericSafe(rhsExpr, { x: x + h / 2, y: y + (h / 2) * k2 });
    const k4 = evaluateNumericSafe(rhsExpr, { x: x + h, y: y + h * k3 });
    if (![k1, k2, k3, k4].every(Number.isFinite)) {
      return {
        ok: false,
        method: 'RK4 (1st-order IVP)',
        points: pts,
        summary: '',
        error: `ODE evaluation became non-finite near x = ${x.toFixed(4)}`,
      };
    }
    y += (h / 6) * (k1 + 2 * k2 + 2 * k3 + k4);
    x += h;
    pts.push({ x, y });
  }

  return {
    ok: true,
    method: 'RK4 (1st-order IVP)',
    points: pts,
    summary: `y(${xEnd}) ≈ ${y.toFixed(6)} (${n} steps, h = ${h.toFixed(4)})`,
  };
}

/**
 * 4th-order Runge-Kutta solver for 2nd-order ODE y'' = f(x, y, yp)
 * with y(x0) = y0, y'(x0) = yp0.
 */
export function solveODESecondOrderRK4(
  rhsExpr: string,
  x0: number,
  y0: number,
  yp0: number,
  xEnd: number,
  steps = 120
): ODESolution {
  const n = Math.max(10, Math.min(2000, steps));
  const h = (xEnd - x0) / n;
  let x = x0;
  let y = y0;
  let yp = yp0;
  const pts: Array<{ x: number; y: number; yp: number }> = [{ x, y, yp }];

  for (let i = 0; i < n; i++) {
    const evalAcc = (xv: number, yv: number, ypv: number) =>
      evaluateNumericSafe(rhsExpr, { x: xv, y: yv, yp: ypv, dy: ypv });

    const k1y = yp;
    const k1v = evalAcc(x, y, yp);

    const k2y = yp + (h / 2) * k1v;
    const k2v = evalAcc(x + h / 2, y + (h / 2) * k1y, k2y);

    const k3y = yp + (h / 2) * k2v;
    const k3v = evalAcc(x + h / 2, y + (h / 2) * k2y, k3y);

    const k4y = yp + h * k3v;
    const k4v = evalAcc(x + h, y + h * k3y, k4y);

    if (![k1v, k2v, k3v, k4v].every(Number.isFinite)) {
      return {
        ok: false,
        method: 'RK4 (2nd-order IVP)',
        points: pts,
        summary: '',
        error: `2nd-order ODE failed near x = ${x.toFixed(4)}`,
      };
    }

    y += (h / 6) * (k1y + 2 * k2y + 2 * k3y + k4y);
    yp += (h / 6) * (k1v + 2 * k2v + 2 * k3v + k4v);
    x += h;
    pts.push({ x, y, yp });
  }

  return {
    ok: true,
    method: 'RK4 (2nd-order IVP)',
    points: pts,
    summary: `y(${xEnd}) ≈ ${y.toFixed(6)}, y'(${xEnd}) ≈ ${yp.toFixed(6)}`,
  };
}

/**
 * Linear/Nonlinear BVP shooting method for y'' = f(x, y, yp) with y(a) = ya, y(b) = yb.
 */
export function solveODEBoundaryValueShooting(
  rhsExpr: string,
  a: number,
  ya: number,
  b: number,
  yb: number,
  steps = 100
): ODESolution {
  let s0 = (yb - ya) / (b - a || 1);
  let s1 = s0 + 0.5;
  const endY = (slope: number) => {
    const res = solveODESecondOrderRK4(rhsExpr, a, ya, slope, b, steps);
    return res.ok ? res.points[res.points.length - 1].y - yb : NaN;
  };

  let f0 = endY(s0);
  let f1 = endY(s1);
  for (let iter = 0; iter < 30; iter++) {
    if (!Number.isFinite(f0) || !Number.isFinite(f1)) break;
    if (Math.abs(f1) < 1e-7) break;
    const denom = f1 - f0;
    if (Math.abs(denom) < 1e-12) break;
    const s2 = s1 - (f1 * (s1 - s0)) / denom;
    s0 = s1;
    f0 = f1;
    s1 = s2;
    f1 = endY(s1);
  }
  const finalRes = solveODESecondOrderRK4(rhsExpr, a, ya, s1, b, steps);
  return {
    ...finalRes,
    method: 'Shooting Method (BVP)',
    summary: finalRes.ok
      ? `Initial slope y'(${a}) ≈ ${s1.toFixed(6)} → y(${b}) = ${finalRes.points[finalRes.points.length - 1].y.toFixed(6)}`
      : finalRes.error || 'BVP shooting failed',
  };
}

export interface RootFindingResult {
  ok: boolean;
  method: string;
  root?: number;
  iterations: number;
  residual?: number;
  error?: string;
}

export function findRootBisection(
  expr: string,
  a: number,
  b: number,
  variable = 'x',
  tol = 1e-8,
  maxIter = 80
): RootFindingResult {
  let lo = a;
  let hi = b;
  let flo = evaluateNumericSafe(expr, { [variable]: lo });
  let fhi = evaluateNumericSafe(expr, { [variable]: hi });

  if (!Number.isFinite(flo) || !Number.isFinite(fhi)) {
    return { ok: false, method: 'Bisection', iterations: 0, error: 'Endpoint evaluation non-finite.' };
  }
  if (Math.abs(flo) < tol) return { ok: true, method: 'Bisection', root: lo, iterations: 0, residual: flo };
  if (Math.abs(fhi) < tol) return { ok: true, method: 'Bisection', root: hi, iterations: 0, residual: fhi };
  if (flo * fhi > 0) {
    return {
      ok: false,
      method: 'Bisection',
      iterations: 0,
      error: `f(${lo}) and f(${hi}) have the same sign; bracket does not guarantee a root.`,
    };
  }

  let mid = lo;
  let fmid = flo;
  let iter = 0;
  while (iter < maxIter && (hi - lo) / 2 > tol) {
    iter++;
    mid = (lo + hi) / 2;
    fmid = evaluateNumericSafe(expr, { [variable]: mid });
    if (Math.abs(fmid) < tol) break;
    if (flo * fmid < 0) {
      hi = mid;
      fhi = fmid;
    } else {
      lo = mid;
      flo = fmid;
    }
  }
  return { ok: true, method: 'Bisection', root: mid, iterations: iter, residual: fmid };
}

export function findRootNewtonRaphson(
  expr: string,
  x0: number,
  variable = 'x',
  tol = 1e-9,
  maxIter = 60
): RootFindingResult {
  let x = x0;
  const h = 1e-6;
  for (let iter = 1; iter <= maxIter; iter++) {
    const fx = evaluateNumericSafe(expr, { [variable]: x });
    if (!Number.isFinite(fx)) {
      return { ok: false, method: 'Newton-Raphson', iterations: iter, error: 'Non-finite evaluation.' };
    }
    if (Math.abs(fx) < tol) {
      return { ok: true, method: 'Newton-Raphson', root: x, iterations: iter - 1, residual: fx };
    }
    const dfx =
      (evaluateNumericSafe(expr, { [variable]: x + h }) -
        evaluateNumericSafe(expr, { [variable]: x - h })) /
      (2 * h);
    if (!Number.isFinite(dfx) || Math.abs(dfx) < 1e-12) {
      return {
        ok: false,
        method: 'Newton-Raphson',
        iterations: iter,
        error: `Zero derivative encountered near x = ${x.toFixed(5)}.`,
      };
    }
    const nextX = x - fx / dfx;
    if (Math.abs(nextX - x) < tol) {
      const res = evaluateNumericSafe(expr, { [variable]: nextX });
      return { ok: true, method: 'Newton-Raphson', root: nextX, iterations: iter, residual: res };
    }
    x = nextX;
  }
  const res = evaluateNumericSafe(expr, { [variable]: x });
  return {
    ok: Math.abs(res) < 1e-4,
    method: 'Newton-Raphson',
    root: x,
    iterations: maxIter,
    residual: res,
    error: Math.abs(res) < 1e-4 ? undefined : 'Did not converge within maximum iterations.',
  };
}

export function numericalDerivative(
  expr: string,
  atX: number,
  order: 1 | 2 = 1,
  variable = 'x',
  h = 1e-4
): number {
  const f0 = evaluateNumericSafe(expr, { [variable]: atX });
  const fp = evaluateNumericSafe(expr, { [variable]: atX + h });
  const fm = evaluateNumericSafe(expr, { [variable]: atX - h });
  if (order === 1) return (fp - fm) / (2 * h);
  return (fp - 2 * f0 + fm) / (h * h);
}

export function lagrangeInterpolate(
  points: Array<{ x: number; y: number }>,
  evalAt: number
): number {
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    let li = 1;
    for (let j = 0; j < points.length; j++) {
      if (i !== j) {
        li *= (evalAt - points[j].x) / (points[i].x - points[j].x || 1e-12);
      }
    }
    sum += points[i].y * li;
  }
  return sum;
}
