import { compileSafeEvaluator } from './EquationParser';
import { normalizeUnicodeToCanonical } from './SymbolConverter';
import { ConicAnalysis } from './types';

function roundVal(n: number, digits = 4): number {
  const f = Math.pow(10, digits);
  const r = Math.round(n * f) / f;
  return Math.abs(r) < 1e-10 ? 0 : r;
}

/**
 * Extracts general quadratic conic coefficients A*x^2 + B*x*y + C*y^2 + D*x + E*y + F = 0
 * by safe AST evaluation at lattice points and verifies exact quadratic behavior.
 */
export function analyzeConicEquation(rawInput: string): ConicAnalysis {
  const empty: ConicAnalysis = {
    isConic: false,
    type: 'none',
    coefficients: { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0 },
    standardForm: '',
  };

  const canonical = normalizeUnicodeToCanonical(rawInput);
  if (!canonical.includes('=')) return empty;
  const parts = canonical.split('=');
  if (parts.length !== 2) return empty;
  const polyExpr = `(${parts[0].trim()}) - (${parts[1].trim()})`;

  const compiled = compileSafeEvaluator(polyExpr, 'rad');
  if (!compiled.ok || !compiled.evaluator) return empty;
  const unsupportedVars = compiled.variables.filter((v) => v !== 'x' && v !== 'y');
  if (unsupportedVars.length > 0) return empty;

  const evalF = (x: number, y: number): number => {
    try {
      const v = compiled.evaluator!({ x, y });
      return typeof v === 'number' && Number.isFinite(v) ? v : NaN;
    } catch {
      return NaN;
    }
  };

  const f00 = evalF(0, 0);
  const f10 = evalF(1, 0);
  const fn10 = evalF(-1, 0);
  const f01 = evalF(0, 1);
  const f0n1 = evalF(0, -1);
  const f11 = evalF(1, 1);
  const f21 = evalF(2, 1);
  const fn12 = evalF(-1, 2);

  if ([f00, f10, fn10, f01, f0n1, f11, f21, fn12].some((v) => !Number.isFinite(v))) {
    return empty;
  }

  const F = f00;
  const A = (f10 + fn10 - 2 * F) / 2;
  const D = (f10 - fn10) / 2;
  const C = (f01 + f0n1 - 2 * F) / 2;
  const E = (f01 - f0n1) / 2;
  const B = f11 - A - C - D - E - F;

  // Verify the expression truly matches quadratic A x^2 + B x y + C y^2 + D x + E y + F at extra points
  const quad = (x: number, y: number) => A * x * x + B * x * y + C * y * y + D * x + E * y + F;
  if (Math.abs(quad(2, 1) - f21) > 1e-5 || Math.abs(quad(-1, 2) - fn12) > 1e-5) {
    return empty;
  }

  if (Math.abs(A) < 1e-9 && Math.abs(B) < 1e-9 && Math.abs(C) < 1e-9) {
    return empty; // Linear, not a conic
  }

  const coeffs = {
    A: roundVal(A, 6),
    B: roundVal(B, 6),
    C: roundVal(C, 6),
    D: roundVal(D, 6),
    E: roundVal(E, 6),
    F: roundVal(F, 6),
  };

  const disc = B * B - 4 * A * C;

  // Rotation angle to eliminate B*x*y
  const theta = Math.abs(B) > 1e-9 ? 0.5 * Math.atan2(B, A - C) : 0;
  const cosT = Math.cos(theta);
  const sinT = Math.sin(theta);

  // Coefficients in rotated coordinates (u, v)
  const A_p = A * cosT * cosT + B * cosT * sinT + C * sinT * sinT;
  const C_p = A * sinT * sinT - B * cosT * sinT + C * cosT * cosT;
  const D_p = D * cosT + E * sinT;
  const E_p = -D * sinT + E * cosT;

  const toWorld = (u: number, v: number) => ({
    x: roundVal(u * cosT - v * sinT),
    y: roundVal(u * sinT + v * cosT),
  });

  // Case 1: Parabola (B^2 - 4AC == 0)
  if (Math.abs(disc) < 1e-7) {
    if (Math.abs(A_p) < 1e-7 && Math.abs(C_p) > 1e-7) {
      // C_p*v^2 + D_p*u + E_p*v + F = 0 -> (v - vk)^2 = 4p(u - uh)
      if (Math.abs(D_p) < 1e-9) {
        return { isConic: true, type: 'degenerate', coefficients: coeffs, standardForm: 'Degenerate parabola' };
      }
      const vk = -E_p / (2 * C_p);
      const constRem = F - C_p * vk * vk;
      const uh = -constRem / D_p;
      const fourP = -D_p / C_p;
      const p = fourP / 4;
      const vertex = toWorld(uh, vk);
      const focus = toWorld(uh + p, vk);
      const directrixVal = roundVal(uh - p);
      return {
        isConic: true,
        type: 'parabola',
        coefficients: coeffs,
        center: vertex,
        vertices: [vertex],
        foci: [focus],
        eccentricity: 1,
        latusRectum: roundVal(Math.abs(fourP)),
        directrices: [
          Math.abs(theta) < 1e-6
            ? `x = ${directrixVal}`
            : `u = ${directrixVal} (rotated ${roundVal((theta * 180) / Math.PI)}°)`,
        ],
        rotationRad: theta,
        standardForm: `(y - ${roundVal(vk)})² = ${roundVal(fourP)}(x - ${roundVal(uh)})`,
      };
    } else if (Math.abs(C_p) < 1e-7 && Math.abs(A_p) > 1e-7) {
      if (Math.abs(E_p) < 1e-9) {
        return { isConic: true, type: 'degenerate', coefficients: coeffs, standardForm: 'Degenerate parabola' };
      }
      const uh = -D_p / (2 * A_p);
      const constRem = F - A_p * uh * uh;
      const vk = -constRem / E_p;
      const fourP = -E_p / A_p;
      const p = fourP / 4;
      const vertex = toWorld(uh, vk);
      const focus = toWorld(uh, vk + p);
      const directrixVal = roundVal(vk - p);
      return {
        isConic: true,
        type: 'parabola',
        coefficients: coeffs,
        center: vertex,
        vertices: [vertex],
        foci: [focus],
        eccentricity: 1,
        latusRectum: roundVal(Math.abs(fourP)),
        directrices: [
          Math.abs(theta) < 1e-6
            ? `y = ${directrixVal}`
            : `v = ${directrixVal} (rotated ${roundVal((theta * 180) / Math.PI)}°)`,
        ],
        rotationRad: theta,
        standardForm: `(x - ${roundVal(uh)})² = ${roundVal(fourP)}(y - ${roundVal(vk)})`,
      };
    }
    return { isConic: true, type: 'degenerate', coefficients: coeffs, standardForm: 'Degenerate conic' };
  }

  // Case 2: Central conics (Circle, Ellipse, Hyperbola)
  const uh = -D_p / (2 * A_p);
  const vk = -E_p / (2 * C_p);
  const rhs = -(F - A_p * uh * uh - C_p * vk * vk);
  const center = toWorld(uh, vk);

  if (Math.abs(rhs) < 1e-9) {
    return {
      isConic: true,
      type: 'degenerate',
      coefficients: coeffs,
      center,
      standardForm: 'Degenerate point / intersecting lines',
    };
  }

  // Normalize A_p/rhs * (u - uh)^2 + C_p/rhs * (v - vk)^2 = 1
  const kU = A_p / rhs;
  const kV = C_p / rhs;

  if (kU > 0 && kV > 0) {
    // Circle or Ellipse
    const rx = Math.sqrt(1 / kU);
    const ry = Math.sqrt(1 / kV);

    if (Math.abs(rx - ry) < 1e-6 && Math.abs(B) < 1e-7) {
      const r = roundVal(rx);
      return {
        isConic: true,
        type: 'circle',
        coefficients: coeffs,
        center,
        radius: r,
        eccentricity: 0,
        vertices: [
          toWorld(uh + r, vk),
          toWorld(uh - r, vk),
          toWorld(uh, vk + r),
          toWorld(uh, vk - r),
        ],
        standardForm: `(x - ${center.x})² + (y - ${center.y})² = ${roundVal(r * r)}`,
      };
    }

    const majorIsU = rx >= ry;
    const a = majorIsU ? rx : ry;
    const b = majorIsU ? ry : rx;
    const c = Math.sqrt(Math.max(0, a * a - b * b));
    const e = c / a;

    const foci = majorIsU
      ? [toWorld(uh + c, vk), toWorld(uh - c, vk)]
      : [toWorld(uh, vk + c), toWorld(uh, vk - c)];
    const vertices = majorIsU
      ? [toWorld(uh + a, vk), toWorld(uh - a, vk)]
      : [toWorld(uh, vk + a), toWorld(uh, vk - a)];
    const coVertices = majorIsU
      ? [toWorld(uh, vk + b), toWorld(uh, vk - b)]
      : [toWorld(uh + b, vk), toWorld(uh - b, vk)];
    const dirOff = e > 1e-9 ? a / e : Infinity;
    const directrices =
      Number.isFinite(dirOff) && Math.abs(theta) < 1e-6
        ? majorIsU
          ? [`x = ${roundVal(uh + dirOff)}`, `x = ${roundVal(uh - dirOff)}`]
          : [`y = ${roundVal(vk + dirOff)}`, `y = ${roundVal(vk - dirOff)}`]
        : undefined;

    return {
      isConic: true,
      type: 'ellipse',
      coefficients: coeffs,
      center,
      foci,
      vertices,
      coVertices,
      directrices,
      eccentricity: roundVal(e),
      semiMajor: roundVal(a),
      semiMinor: roundVal(b),
      latusRectum: roundVal((2 * b * b) / a),
      rotationRad: theta,
      standardForm: `(u - ${roundVal(uh)})²/${roundVal(rx * rx)} + (v - ${roundVal(vk)})²/${roundVal(ry * ry)} = 1`,
    };
  }

  if (kU * kV < 0) {
    // Hyperbola
    const isHorizontal = kU > 0;
    const a = Math.sqrt(1 / Math.abs(isHorizontal ? kU : kV));
    const b = Math.sqrt(1 / Math.abs(isHorizontal ? kV : kU));
    const c = Math.sqrt(a * a + b * b);
    const e = c / a;
    const isRect = Math.abs(A + C) < 1e-6;

    const foci = isHorizontal
      ? [toWorld(uh + c, vk), toWorld(uh - c, vk)]
      : [toWorld(uh, vk + c), toWorld(uh, vk - c)];
    const vertices = isHorizontal
      ? [toWorld(uh + a, vk), toWorld(uh - a, vk)]
      : [toWorld(uh, vk + a), toWorld(uh, vk - a)];

    const slope = isHorizontal ? b / a : a / b;
    const asymptotes =
      Math.abs(theta) < 1e-6
        ? [
            `y = ${roundVal(vk)} + ${roundVal(slope)}(x - ${roundVal(uh)})`,
            `y = ${roundVal(vk)} - ${roundVal(slope)}(x - ${roundVal(uh)})`,
          ]
        : undefined;

    const dirOff = a / e;
    const directrices =
      Math.abs(theta) < 1e-6
        ? isHorizontal
          ? [`x = ${roundVal(uh + dirOff)}`, `x = ${roundVal(uh - dirOff)}`]
          : [`y = ${roundVal(vk + dirOff)}`, `y = ${roundVal(vk - dirOff)}`]
        : undefined;

    return {
      isConic: true,
      type: isRect ? 'rectangular-hyperbola' : 'hyperbola',
      coefficients: coeffs,
      center,
      foci,
      vertices,
      directrices,
      asymptotes,
      eccentricity: roundVal(e),
      semiMajor: roundVal(a),
      semiMinor: roundVal(b),
      latusRectum: roundVal((2 * b * b) / a),
      rotationRad: theta,
      standardForm: isHorizontal
        ? `(x - ${center.x})²/${roundVal(a * a)} - (y - ${center.y})²/${roundVal(b * b)} = 1`
        : `(y - ${center.y})²/${roundVal(a * a)} - (x - ${center.x})²/${roundVal(b * b)} = 1`,
    };
  }

  return {
    isConic: true,
    type: 'degenerate',
    coefficients: coeffs,
    standardForm: 'No real locus (imaginary conic)',
  };
}
