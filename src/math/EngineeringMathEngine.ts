import nerdamer from 'nerdamer';
import 'nerdamer/algebra';
import 'nerdamer/calculus';
import { evaluateNumericSafe, preprocessMathSyntax } from './EquationParser';
import { adaptiveSimpson } from './CalculusEngine';

export interface ComplexResult {
  re: number;
  im: number;
  modulus: number;
  argRad: number;
  argDeg: number;
  formattedRect: string;
  formattedPolar: string;
}

export function analyzeComplex(re: number, im: number): ComplexResult {
  const r = Math.hypot(re, im);
  const theta = Math.atan2(im, re);
  const deg = (theta * 180) / Math.PI;
  const sign = im >= 0 ? '+' : '-';
  return {
    re,
    im,
    modulus: r,
    argRad: theta,
    argDeg: deg,
    formattedRect: `${Number(re.toFixed(4))} ${sign} ${Number(Math.abs(im).toFixed(4))}i`,
    formattedPolar: `${Number(r.toFixed(4))} ∠ ${Number(deg.toFixed(2))}°`,
  };
}

export function complexPower(re: number, im: number, power: number): ComplexResult {
  const r = Math.hypot(re, im);
  const theta = Math.atan2(im, re);
  const rp = Math.pow(r, power);
  const tp = theta * power;
  return analyzeComplex(rp * Math.cos(tp), rp * Math.sin(tp));
}

export function vectorOperations(a: number[], b: number[]) {
  const len = Math.max(a.length, b.length);
  const va = Array.from({ length: len }, (_, i) => a[i] ?? 0);
  const vb = Array.from({ length: len }, (_, i) => b[i] ?? 0);
  const dot = va.reduce((acc, v, i) => acc + v * vb[i], 0);
  const normA = Math.hypot(...va);
  const normB = Math.hypot(...vb);
  const cosAngle = normA > 0 && normB > 0 ? Math.max(-1, Math.min(1, dot / (normA * normB))) : 1;
  const angleDeg = (Math.acos(cosAngle) * 180) / Math.PI;
  const cross =
    len === 3
      ? [
          va[1] * vb[2] - va[2] * vb[1],
          va[2] * vb[0] - va[0] * vb[2],
          va[0] * vb[1] - va[1] * vb[0],
        ]
      : undefined;
  return { dot, normA, normB, angleDeg, cross };
}

export function vectorCalculusAtPoint(
  scalarOrField: { fx?: string; fy?: string; fz?: string; scalar?: string },
  pt: { x: number; y: number; z: number }
): {
  gradient?: [number, number, number];
  divergence?: number;
  curl?: [number, number, number];
  symbolicGrad?: [string, string, string];
  symbolicDiv?: string;
  symbolicCurl?: [string, string, string];
} {
  const h = 1e-5;
  const out: ReturnType<typeof vectorCalculusAtPoint> = {};

  if (scalarOrField.scalar) {
    const s = preprocessMathSyntax(scalarOrField.scalar);
    const gx =
      (evaluateNumericSafe(s, { ...pt, x: pt.x + h }) -
        evaluateNumericSafe(s, { ...pt, x: pt.x - h })) /
      (2 * h);
    const gy =
      (evaluateNumericSafe(s, { ...pt, y: pt.y + h }) -
        evaluateNumericSafe(s, { ...pt, y: pt.y - h })) /
      (2 * h);
    const gz =
      (evaluateNumericSafe(s, { ...pt, z: pt.z + h }) -
        evaluateNumericSafe(s, { ...pt, z: pt.z - h })) /
      (2 * h);
    out.gradient = [gx, gy, gz];
    try {
      out.symbolicGrad = [
        nerdamer.diff(s, 'x').text(),
        nerdamer.diff(s, 'y').text(),
        nerdamer.diff(s, 'z').text(),
      ];
    } catch {
      // numeric gradient remains available
    }
  }

  if (scalarOrField.fx !== undefined && scalarOrField.fy !== undefined) {
    const fx = preprocessMathSyntax(scalarOrField.fx || '0');
    const fy = preprocessMathSyntax(scalarOrField.fy || '0');
    const fz = preprocessMathSyntax(scalarOrField.fz || '0');

    const dFx_dx =
      (evaluateNumericSafe(fx, { ...pt, x: pt.x + h }) -
        evaluateNumericSafe(fx, { ...pt, x: pt.x - h })) /
      (2 * h);
    const dFy_dy =
      (evaluateNumericSafe(fy, { ...pt, y: pt.y + h }) -
        evaluateNumericSafe(fy, { ...pt, y: pt.y - h })) /
      (2 * h);
    const dFz_dz =
      (evaluateNumericSafe(fz, { ...pt, z: pt.z + h }) -
        evaluateNumericSafe(fz, { ...pt, z: pt.z - h })) /
      (2 * h);
    out.divergence = dFx_dx + dFy_dy + dFz_dz;

    const dFz_dy =
      (evaluateNumericSafe(fz, { ...pt, y: pt.y + h }) -
        evaluateNumericSafe(fz, { ...pt, y: pt.y - h })) /
      (2 * h);
    const dFy_dz =
      (evaluateNumericSafe(fy, { ...pt, z: pt.z + h }) -
        evaluateNumericSafe(fy, { ...pt, z: pt.z - h })) /
      (2 * h);
    const dFx_dz =
      (evaluateNumericSafe(fx, { ...pt, z: pt.z + h }) -
        evaluateNumericSafe(fx, { ...pt, z: pt.z - h })) /
      (2 * h);
    const dFz_dx =
      (evaluateNumericSafe(fz, { ...pt, x: pt.x + h }) -
        evaluateNumericSafe(fz, { ...pt, x: pt.x - h })) /
      (2 * h);
    const dFy_dx =
      (evaluateNumericSafe(fy, { ...pt, x: pt.x + h }) -
        evaluateNumericSafe(fy, { ...pt, x: pt.x - h })) /
      (2 * h);
    const dFx_dy =
      (evaluateNumericSafe(fx, { ...pt, y: pt.y + h }) -
        evaluateNumericSafe(fx, { ...pt, y: pt.y - h })) /
      (2 * h);

    out.curl = [dFz_dy - dFy_dz, dFx_dz - dFz_dx, dFy_dx - dFx_dy];

    try {
      out.symbolicDiv = nerdamer
        .simplify(`(${nerdamer.diff(fx, 'x').text()}) + (${nerdamer.diff(fy, 'y').text()}) + (${nerdamer.diff(fz, 'z').text()})`)
        .text();
    } catch {
      // numeric available
    }
  }

  return out;
}

export interface StatsSummary {
  count: number;
  mean: number;
  median: number;
  min: number;
  max: number;
  varianceSample: number;
  stdDevSample: number;
  variancePop: number;
  stdDevPop: number;
  linearRegression?: { slope: number; intercept: number; rSquared: number };
}

export function computeStatistics(data: number[], yData?: number[]): StatsSummary {
  const n = data.length;
  if (n === 0) {
    return {
      count: 0,
      mean: 0,
      median: 0,
      min: 0,
      max: 0,
      varianceSample: 0,
      stdDevSample: 0,
      variancePop: 0,
      stdDevPop: 0,
    };
  }
  const sorted = [...data].sort((a, b) => a - b);
  const mean = data.reduce((s, v) => s + v, 0) / n;
  const median = n % 2 === 1 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
  const ss = data.reduce((s, v) => s + (v - mean) * (v - mean), 0);
  const variancePop = ss / n;
  const varianceSample = n > 1 ? ss / (n - 1) : 0;

  let linearRegression: StatsSummary['linearRegression'];
  if (yData && yData.length === n && n >= 2) {
    const meanY = yData.reduce((s, v) => s + v, 0) / n;
    let sxx = 0;
    let syy = 0;
    let sxy = 0;
    for (let i = 0; i < n; i++) {
      const dx = data[i] - mean;
      const dy = yData[i] - meanY;
      sxx += dx * dx;
      syy += dy * dy;
      sxy += dx * dy;
    }
    const slope = sxx > 0 ? sxy / sxx : 0;
    const intercept = meanY - slope * mean;
    const rSquared = sxx > 0 && syy > 0 ? (sxy * sxy) / (sxx * syy) : 1;
    linearRegression = { slope, intercept, rSquared };
  }

  return {
    count: n,
    mean,
    median,
    min: sorted[0],
    max: sorted[n - 1],
    varianceSample,
    stdDevSample: Math.sqrt(varianceSample),
    variancePop,
    stdDevPop: Math.sqrt(variancePop),
    linearRegression,
  };
}

export interface TransformResult {
  ok: boolean;
  transform: string;
  resultText: string;
  resultLatex?: string;
  spectrum?: Array<{ k: number; magnitude: number; phaseRad: number }>;
  error?: string;
}

/**
 * Laplace and Inverse Laplace transforms via nerdamer + verified engineering transform rules.
 */
export function computeLaplaceTransform(exprRaw: string, inverse = false): TransformResult {
  const clean = preprocessMathSyntax(exprRaw);
  try {
    const out = inverse ? nerdamer.ilaplace(clean, 's', 't') : nerdamer.laplace(clean, 't', 's');
    const txt = out.text();
    if (!txt || txt.includes('laplace(') || txt.includes('ilaplace(')) {
      return {
        ok: false,
        transform: inverse ? 'Inverse Laplace ℒ⁻¹' : 'Laplace ℒ',
        resultText: '',
        error: 'Transform not available in closed symbolic table for this expression.',
      };
    }
    return {
      ok: true,
      transform: inverse ? 'Inverse Laplace ℒ⁻¹' : 'Laplace ℒ',
      resultText: txt,
      resultLatex: out.toTeX(),
    };
  } catch (err) {
    return {
      ok: false,
      transform: inverse ? 'Inverse Laplace ℒ⁻¹' : 'Laplace ℒ',
      resultText: '',
      error: err instanceof Error ? err.message : 'Laplace transform failed.',
    };
  }
}

/**
 * Computes Fourier series coefficients a0, an, bn for f(x) over [-L, L] via adaptive quadrature.
 */
export function computeFourierSeries(
  exprRaw: string,
  halfPeriodL = Math.PI,
  harmonics = 4
): TransformResult {
  const clean = preprocessMathSyntax(exprRaw);
  const f = (x: number) => evaluateNumericSafe(clean, { x });
  const a0 = (1 / halfPeriodL) * adaptiveSimpson(f, -halfPeriodL, halfPeriodL, 1e-6, 10);
  if (!Number.isFinite(a0)) {
    return { ok: false, transform: 'Fourier Series', resultText: '', error: 'Could not integrate over [-L, L].' };
  }
  const terms: string[] = [`${(a0 / 2).toFixed(4)}`];
  for (let n = 1; n <= harmonics; n++) {
    const an =
      (1 / halfPeriodL) *
      adaptiveSimpson(
        (x) => f(x) * Math.cos((n * Math.PI * x) / halfPeriodL),
        -halfPeriodL,
        halfPeriodL,
        1e-6,
        10
      );
    const bn =
      (1 / halfPeriodL) *
      adaptiveSimpson(
        (x) => f(x) * Math.sin((n * Math.PI * x) / halfPeriodL),
        -halfPeriodL,
        halfPeriodL,
        1e-6,
        10
      );
    if (Math.abs(an) > 1e-4) {
      terms.push(`${an.toFixed(4)}·cos(${n}πx/${halfPeriodL.toFixed(2)})`);
    }
    if (Math.abs(bn) > 1e-4) {
      terms.push(`${bn.toFixed(4)}·sin(${n}πx/${halfPeriodL.toFixed(2)})`);
    }
  }
  return {
    ok: true,
    transform: `Fourier Series [-${halfPeriodL.toFixed(2)}, ${halfPeriodL.toFixed(2)}]`,
    resultText: `f(x) ≈ ${terms.join(' + ')}`,
  };
}

/**
 * Discrete Fourier Transform (DFT) spectrum for discrete sequences.
 */
export function computeDFT(samples: number[]): TransformResult {
  const N = samples.length;
  if (N === 0) return { ok: false, transform: 'DFT', resultText: '', error: 'Empty sequence.' };
  const spectrum: Array<{ k: number; magnitude: number; phaseRad: number }> = [];
  for (let k = 0; k < N; k++) {
    let re = 0;
    let im = 0;
    for (let n = 0; n < N; n++) {
      const ang = (-2 * Math.PI * k * n) / N;
      re += samples[n] * Math.cos(ang);
      im += samples[n] * Math.sin(ang);
    }
    spectrum.push({ k, magnitude: Math.hypot(re, im), phaseRad: Math.atan2(im, re) });
  }
  const summary = spectrum
    .map((s) => `X[${s.k}]: |X|=${s.magnitude.toFixed(3)}, ∠=${((s.phaseRad * 180) / Math.PI).toFixed(1)}°`)
    .join('\n');
  return { ok: true, transform: 'Discrete Fourier Transform (DFT)', resultText: summary, spectrum };
}

/**
 * Supported closed-form Z-Transform / Inverse Z-Transform lookup & pattern matcher.
 */
export function computeZTransform(exprRaw: string, inverse = false): TransformResult {
  const clean = exprRaw.replace(/\s+/g, '');
  if (!inverse) {
    if (clean === '1' || clean === 'u[n]' || clean === 'u(n)') {
      return { ok: true, transform: 'Z-Transform', resultText: 'z / (z - 1)   (|z| > 1)', resultLatex: '\\frac{z}{z - 1}' };
    }
    if (clean === 'delta[n]' || clean === 'delta(n)') {
      return { ok: true, transform: 'Z-Transform', resultText: '1   (all z)', resultLatex: '1' };
    }
    const powMatch = clean.match(/^([+-]?\d*\.?\d+|[a-zA-Z])\^n$/);
    if (powMatch) {
      const a = powMatch[1];
      return {
        ok: true,
        transform: 'Z-Transform',
        resultText: `z / (z - ${a})   (|z| > |${a}|)`,
        resultLatex: `\\frac{z}{z - ${a}}`,
      };
    }
    if (clean === 'n') {
      return {
        ok: true,
        transform: 'Z-Transform',
        resultText: 'z / (z - 1)^2   (|z| > 1)',
        resultLatex: '\\frac{z}{(z - 1)^2}',
      };
    }
    return {
      ok: false,
      transform: 'Z-Transform',
      resultText: '',
      error: 'Closed-form Z-Transform supports standard sequences: 1, u[n], delta[n], a^n, n.',
    };
  } else {
    if (clean === '1') {
      return { ok: true, transform: 'Inverse Z-Transform', resultText: 'δ[n]', resultLatex: '\\delta[n]' };
    }
    if (clean === 'z/(z-1)') {
      return { ok: true, transform: 'Inverse Z-Transform', resultText: 'u[n]', resultLatex: 'u[n]' };
    }
    const invPow = clean.match(/^z\/\(z-([+-]?\d*\.?\d+|[a-zA-Z])\)$/);
    if (invPow) {
      const a = invPow[1];
      return {
        ok: true,
        transform: 'Inverse Z-Transform',
        resultText: `(${a})^n · u[n]`,
        resultLatex: `${a}^n u[n]`,
      };
    }
    return {
      ok: false,
      transform: 'Inverse Z-Transform',
      resultText: '',
      error: 'Closed-form Inverse Z-Transform supports forms like 1, z/(z-1), z/(z-a).',
    };
  }
}

/**
 * Numerical double integral over rectangle [xMin, xMax] × [yMin, yMax].
 */
export function numericalDoubleIntegral(
  exprRaw: string,
  xMin: number,
  xMax: number,
  yMin: number,
  yMax: number,
  nx = 40,
  ny = 40
): number {
  const clean = preprocessMathSyntax(exprRaw);
  const hx = (xMax - xMin) / nx;
  const hy = (yMax - yMin) / ny;
  let sum = 0;
  for (let i = 0; i < nx; i++) {
    const x = xMin + (i + 0.5) * hx;
    for (let j = 0; j < ny; j++) {
      const y = yMin + (j + 0.5) * hy;
      const val = evaluateNumericSafe(clean, { x, y });
      if (Number.isFinite(val)) sum += val;
    }
  }
  return sum * hx * hy;
}
