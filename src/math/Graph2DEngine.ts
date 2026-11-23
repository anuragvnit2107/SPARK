import { analyzeEquation } from './EquationAnalyzer';
import { compileSafeEvaluator } from './EquationParser';
import { analyzeConicEquation } from './ConicSectionEngine';
import { Graph2DBounds, Graph2DConfig, Graph2DEquation } from './types';
import { ForgeTheme } from '../themes';

export interface PlotCurveSegment {
  points: Array<{ x: number; y: number }>;
}

export interface Evaluated2DCurve {
  eq: Graph2DEquation;
  segments: PlotCurveSegment[];
  kind: 'explicit' | 'implicit' | 'parametric' | 'polar';
  conicSummary?: string;
}

export function computeNiceGridStep(span: number, targetTicks = 8): number {
  const raw = Math.abs(span) / Math.max(2, targetTicks);
  if (!Number.isFinite(raw) || raw <= 0) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / pow;
  const mult = norm < 1.5 ? 1 : norm < 3.5 ? 2 : norm < 7.5 ? 5 : 10;
  return mult * pow;
}

export function evaluate2DEquation(
  eq: Graph2DEquation,
  bounds: Graph2DBounds,
  angleUnit: 'rad' | 'deg',
  parameters: Record<string, number>,
  pixelWidth = 480
): Evaluated2DCurve {
  const analysis = analyzeEquation(eq.expression, parameters);
  const { xMin, xMax, yMin, yMax } = bounds;
  const ySpan = Math.max(1e-6, yMax - yMin);

  // 1. Polar r = f(theta)
  if (analysis.kind === 'polar') {
    const rhs = analysis.canonical.replace(/^r\s*=\s*/i, '');
    const comp = compileSafeEvaluator(rhs, angleUnit);
    if (!comp.ok || !comp.evaluator) return { eq, segments: [], kind: 'polar' };
    const tMin = eq.parameterMin ?? 0;
    const tMax = eq.parameterMax ?? (angleUnit === 'deg' ? 360 : Math.PI * 2);
    const steps = eq.samples ?? 420;
    const segments: PlotCurveSegment[] = [];
    let cur: Array<{ x: number; y: number }> = [];
    for (let i = 0; i <= steps; i++) {
      const th = tMin + (i / steps) * (tMax - tMin);
      const rad = angleUnit === 'deg' ? (th * Math.PI) / 180 : th;
      let r = NaN;
      try {
        const res = comp.evaluator({ ...parameters, theta: th, t: th });
        if (typeof res === 'number' && Number.isFinite(res)) r = res;
      } catch {
        r = NaN;
      }
      if (Number.isFinite(r) && Math.abs(r) < 1e4) {
        cur.push({ x: r * Math.cos(rad), y: r * Math.sin(rad) });
      } else if (cur.length > 1) {
        segments.push({ points: cur });
        cur = [];
      } else {
        cur = [];
      }
    }
    if (cur.length > 1) segments.push({ points: cur });
    return { eq, segments, kind: 'polar' };
  }

  // 2. Parametric x = f(t), y = g(t)
  if (analysis.kind === 'parametric-2d' || (eq.expressionY && eq.expressionY.trim())) {
    let xExpr = eq.expression;
    let yExpr = eq.expressionY || '';
    if (!yExpr) {
      const m = analysis.canonical.match(/^x\s*=\s*([^,;]+)\s*[,;]\s*y\s*=\s*([^,;]+)$/);
      if (m) {
        xExpr = m[1];
        yExpr = m[2];
      }
    }
    const cx = compileSafeEvaluator(xExpr, angleUnit);
    const cy = compileSafeEvaluator(yExpr, angleUnit);
    if (!cx.ok || !cy.ok || !cx.evaluator || !cy.evaluator) {
      return { eq, segments: [], kind: 'parametric' };
    }
    const tMin = eq.parameterMin ?? -10;
    const tMax = eq.parameterMax ?? 10;
    const steps = eq.samples ?? 400;
    const segments: PlotCurveSegment[] = [];
    let cur: Array<{ x: number; y: number }> = [];
    for (let i = 0; i <= steps; i++) {
      const t = tMin + (i / steps) * (tMax - tMin);
      try {
        const px = Number(cx.evaluator({ ...parameters, t }));
        const py = Number(cy.evaluator({ ...parameters, t }));
        if (Number.isFinite(px) && Number.isFinite(py) && Math.abs(px) < 1e5 && Math.abs(py) < 1e5) {
          cur.push({ x: px, y: py });
        } else if (cur.length > 1) {
          segments.push({ points: cur });
          cur = [];
        } else {
          cur = [];
        }
      } catch {
        if (cur.length > 1) segments.push({ points: cur });
        cur = [];
      }
    }
    if (cur.length > 1) segments.push({ points: cur });
    return { eq, segments, kind: 'parametric' };
  }

  // 3. Implicit 2D F(x, y) = 0 (Conics, circles, hyperbolas, single-var equations like 2x+5=15) via Marching Squares
  if (analysis.kind === 'implicit-2d' || analysis.kind === 'inequality' || analysis.kind === 'algebraic-equation') {
    const parts = analysis.canonical.split(/<=|>=|<|>|=/);
    const expr = parts.length === 2 ? `(${parts[0]}) - (${parts[1]})` : analysis.canonical;
    const comp = compileSafeEvaluator(expr, angleUnit);
    if (!comp.ok || !comp.evaluator) return { eq, segments: [], kind: 'implicit' };

    const cols = 88;
    const rows = 88;
    const grid: number[][] = Array.from({ length: rows + 1 }, () => Array(cols + 1).fill(NaN));
    const dx = (xMax - xMin) / cols;
    const dy = (yMax - yMin) / rows;

    for (let j = 0; j <= rows; j++) {
      const y = yMin + j * dy;
      for (let i = 0; i <= cols; i++) {
        const x = xMin + i * dx;
        try {
          const val = Number(comp.evaluator({ ...parameters, x, y }));
          grid[j][i] = Number.isFinite(val) ? val : NaN;
        } catch {
          grid[j][i] = NaN;
        }
      }
    }

    const segments: PlotCurveSegment[] = [];
    const interp = (v1: number, v2: number) => {
      const d = v2 - v1;
      if (Math.abs(d) < 1e-12) return 0.5;
      return Math.max(0, Math.min(1, -v1 / d));
    };

    for (let j = 0; j < rows; j++) {
      const y0 = yMin + j * dy;
      const y1 = y0 + dy;
      for (let i = 0; i < cols; i++) {
        const x0 = xMin + i * dx;
        const x1 = x0 + dx;
        const vBL = grid[j][i];
        const vBR = grid[j][i + 1];
        const vTR = grid[j + 1][i + 1];
        const vTL = grid[j + 1][i];
        if (![vBL, vBR, vTR, vTL].every(Number.isFinite)) continue;

        const pts: Array<{ x: number; y: number }> = [];
        if ((vBL < 0) !== (vBR < 0)) pts.push({ x: x0 + interp(vBL, vBR) * dx, y: y0 });
        if ((vBR < 0) !== (vTR < 0)) pts.push({ x: x1, y: y0 + interp(vBR, vTR) * dy });
        if ((vTL < 0) !== (vTR < 0)) pts.push({ x: x0 + interp(vTL, vTR) * dx, y: y1 });
        if ((vBL < 0) !== (vTL < 0)) pts.push({ x: x0, y: y0 + interp(vBL, vTL) * dy });

        if (pts.length === 2) {
          segments.push({ points: [pts[0], pts[1]] });
        } else if (pts.length === 4) {
          segments.push({ points: [pts[0], pts[1]] });
          segments.push({ points: [pts[2], pts[3]] });
        }
      }
    }

    const conic = analyzeConicEquation(eq.expression);
    return {
      eq,
      segments,
      kind: 'implicit',
      conicSummary: conic.isConic ? `${conic.type.toUpperCase()}: ${conic.standardForm}` : undefined,
    };
  }

  // 4. Explicit y = f(x) or g(x) = ... with adaptive discontinuity / asymptote detection
  const rhs = analysis.canonical.replace(/^(?:y|[a-zA-Z]\w*\s*\(\s*x\s*\))\s*=\s*/i, '');
  const comp = compileSafeEvaluator(rhs, angleUnit);
  if (!comp.ok || !comp.evaluator) return { eq, segments: [], kind: 'explicit' };

  const dMin = Math.max(xMin, eq.domainMin ?? -Infinity);
  const dMax = Math.min(xMax, eq.domainMax ?? Infinity);
  if (dMin >= dMax) return { eq, segments: [], kind: 'explicit' };

  const steps = Math.max(240, Math.min(1200, Math.round(pixelWidth * 1.4)));
  const segments: PlotCurveSegment[] = [];
  let cur: Array<{ x: number; y: number }> = [];
  let prevY = NaN;

  const evalAt = (xv: number): number => {
    try {
      const val = comp.evaluator!({ ...parameters, x: xv });
      return typeof val === 'number' && Number.isFinite(val) ? val : NaN;
    } catch {
      return NaN;
    }
  };

  for (let i = 0; i <= steps; i++) {
    const x = dMin + (i / steps) * (dMax - dMin);
    const y = evalAt(x);

    if (!Number.isFinite(y) || Math.abs(y) > ySpan * 80 + Math.max(Math.abs(yMin), Math.abs(yMax)) * 10) {
      if (cur.length > 1) segments.push({ points: cur });
      cur = [];
      prevY = NaN;
      continue;
    }

    // Split across vertical asymptotes / jump discontinuities (sign flip + huge jump)
    if (
      Number.isFinite(prevY) &&
      Math.abs(y - prevY) > ySpan * 1.8 &&
      y * prevY < 0
    ) {
      if (cur.length > 1) segments.push({ points: cur });
      cur = [{ x, y }];
    } else {
      cur.push({ x, y });
    }
    prevY = y;
  }
  if (cur.length > 1) segments.push({ points: cur });

  return { eq, segments, kind: 'explicit' };
}

/**
 * Finds approximate intersections between two explicit y=f(x) curves on [xMin, xMax].
 */
export function findExplicitIntersections(
  exprA: string,
  exprB: string,
  bounds: Graph2DBounds,
  angleUnit: 'rad' | 'deg',
  parameters: Record<string, number>
): Array<{ x: number; y: number }> {
  const cleanA = exprA.replace(/^(?:y|[a-zA-Z]\w*\s*\(\s*x\s*\))\s*=\s*/i, '');
  const cleanB = exprB.replace(/^(?:y|[a-zA-Z]\w*\s*\(\s*x\s*\))\s*=\s*/i, '');
  const ca = compileSafeEvaluator(cleanA, angleUnit);
  const cb = compileSafeEvaluator(cleanB, angleUnit);
  if (!ca.ok || !cb.ok || !ca.evaluator || !cb.evaluator) return [];

  const diff = (x: number) => {
    try {
      const a = Number(ca.evaluator!({ ...parameters, x }));
      const b = Number(cb.evaluator!({ ...parameters, x }));
      return Number.isFinite(a) && Number.isFinite(b) ? a - b : NaN;
    } catch {
      return NaN;
    }
  };

  const N = 220;
  const pts: Array<{ x: number; y: number }> = [];
  let prevX = bounds.xMin;
  let prevD = diff(prevX);

  for (let i = 1; i <= N; i++) {
    const x = bounds.xMin + (i / N) * (bounds.xMax - bounds.xMin);
    const d = diff(x);
    if (Number.isFinite(prevD) && Number.isFinite(d) && prevD * d <= 0 && Math.abs(d - prevD) < 50) {
      // Refine via bisection
      let lo = prevX;
      let hi = x;
      let flo = prevD;
      for (let k = 0; k < 24; k++) {
        const mid = (lo + hi) / 2;
        const fm = diff(mid);
        if (!Number.isFinite(fm)) break;
        if (Math.abs(fm) < 1e-8) {
          lo = hi = mid;
          break;
        }
        if (flo * fm <= 0) hi = mid;
        else {
          lo = mid;
          flo = fm;
        }
      }
      const rx = (lo + hi) / 2;
      const ry = Number(ca.evaluator({ ...parameters, x: rx }));
      if (Number.isFinite(ry) && ry >= bounds.yMin && ry <= bounds.yMax) {
        if (!pts.some((p) => Math.hypot(p.x - rx, p.y - ry) < 1e-3)) {
          pts.push({ x: rx, y: ry });
        }
      }
    }
    prevX = x;
    prevD = d;
  }
  return pts.slice(0, 16);
}

/**
 * Shared Canvas 2D renderer for 2D graphs (used by both live canvas previews and PNG export).
 */
export function drawGraph2DOnCanvas(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  config: Graph2DConfig,
  theme: ForgeTheme
): void {
  const { bounds } = config;
  const isDark = theme.mode === 'dark';
  const bg = isDark ? '#0b1220' : '#ffffff';
  const minorGridColor = isDark ? 'rgba(148, 163, 184, 0.08)' : 'rgba(15, 23, 42, 0.06)';
  const majorGridColor = isDark ? 'rgba(148, 163, 184, 0.18)' : 'rgba(15, 23, 42, 0.14)';
  const axisColor = isDark ? '#94a3b8' : '#334155';
  const labelColor = isDark ? '#cbd5e1' : '#334155';

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, 10);
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.clip();

  const xSpan = Math.max(1e-6, bounds.xMax - bounds.xMin);
  const ySpan = Math.max(1e-6, bounds.yMax - bounds.yMin);

  const worldToPxX = (wx: number) => x + ((wx - bounds.xMin) / xSpan) * width;
  const worldToPxY = (wy: number) => y + height - ((wy - bounds.yMin) / ySpan) * height;

  const stepX = computeNiceGridStep(xSpan, Math.max(4, Math.floor(width / 64)));
  const stepY = computeNiceGridStep(ySpan, Math.max(4, Math.floor(height / 54)));

  // Gridlines
  if (config.showGrid) {
    if (config.showMinorGrid) {
      ctx.strokeStyle = minorGridColor;
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      const mStepX = stepX / 4;
      const mStepY = stepY / 4;
      for (let gx = Math.ceil(bounds.xMin / mStepX) * mStepX; gx <= bounds.xMax; gx += mStepX) {
        const px = worldToPxX(gx);
        ctx.moveTo(px, y);
        ctx.lineTo(px, y + height);
      }
      for (let gy = Math.ceil(bounds.yMin / mStepY) * mStepY; gy <= bounds.yMax; gy += mStepY) {
        const py = worldToPxY(gy);
        ctx.moveTo(x, py);
        ctx.lineTo(x + width, py);
      }
      ctx.stroke();
    }

    ctx.strokeStyle = majorGridColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let gx = Math.ceil(bounds.xMin / stepX) * stepX; gx <= bounds.xMax; gx += stepX) {
      const px = worldToPxX(gx);
      ctx.moveTo(px, y);
      ctx.lineTo(px, y + height);
    }
    for (let gy = Math.ceil(bounds.yMin / stepY) * stepY; gy <= bounds.yMax; gy += stepY) {
      const py = worldToPxY(gy);
      ctx.moveTo(x, py);
      ctx.lineTo(x + width, py);
    }
    ctx.stroke();
  }

  // Axes
  if (config.showAxes) {
    const axY = worldToPxY(0);
    const axX = worldToPxX(0);
    ctx.strokeStyle = axisColor;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    if (axY >= y && axY <= y + height) {
      ctx.moveTo(x, axY);
      ctx.lineTo(x + width, axY);
    }
    if (axX >= x && axX <= x + width) {
      ctx.moveTo(axX, y);
      ctx.lineTo(axX, y + height);
    }
    ctx.stroke();

    // Tick numbers
    ctx.fillStyle = labelColor;
    ctx.font = '500 10px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const tickY = Math.max(y + 4, Math.min(y + height - 16, axY + 4));
    for (let gx = Math.ceil(bounds.xMin / stepX) * stepX; gx <= bounds.xMax; gx += stepX) {
      if (Math.abs(gx) < stepX * 0.05) continue;
      const px = worldToPxX(gx);
      if (px > x + 16 && px < x + width - 16) {
        ctx.fillText(Number(gx.toFixed(3)).toString(), px, tickY);
      }
    }

    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    const tickX = Math.max(x + 32, Math.min(x + width - 6, axX - 5));
    for (let gy = Math.ceil(bounds.yMin / stepY) * stepY; gy <= bounds.yMax; gy += stepY) {
      if (Math.abs(gy) < stepY * 0.05) continue;
      const py = worldToPxY(gy);
      if (py > y + 12 && py < y + height - 12) {
        ctx.fillText(Number(gy.toFixed(3)).toString(), tickX, py);
      }
    }
  }

  // Curves
  const visibleEqs = config.equations.filter((eq) => eq.visible && eq.expression.trim());
  for (const eq of visibleEqs) {
    const evalCurve = evaluate2DEquation(eq, bounds, config.angleUnit, config.parameters, width);
    ctx.save();
    ctx.strokeStyle = eq.color;
    ctx.lineWidth = eq.thickness || 2.2;
    if (eq.lineStyle === 'dashed') ctx.setLineDash([7, 5]);
    else if (eq.lineStyle === 'dotted') ctx.setLineDash([2, 4]);
    else ctx.setLineDash([]);

    for (const seg of evalCurve.segments) {
      if (seg.points.length < 2) continue;
      ctx.beginPath();
      seg.points.forEach((pt, idx) => {
        const px = worldToPxX(pt.x);
        const py = worldToPxY(pt.y);
        if (idx === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.stroke();
    }

    // Conic feature markers (center & foci)
    if (config.showConicFeatures && evalCurve.kind === 'implicit') {
      const conic = analyzeConicEquation(eq.expression);
      if (conic.isConic) {
        ctx.setLineDash([]);
        if (conic.center) {
          const cx = worldToPxX(conic.center.x);
          const cy = worldToPxY(conic.center.y);
          ctx.fillStyle = eq.color;
          ctx.beginPath();
          ctx.arc(cx, cy, 4, 0, Math.PI * 2);
          ctx.fill();
        }
        conic.foci?.forEach((f) => {
          const fx = worldToPxX(f.x);
          const fy = worldToPxY(f.y);
          ctx.strokeStyle = eq.color;
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(fx, fy, 4, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        });
      }
    }
    ctx.restore();
  }

  // Intersections
  if (config.showIntersections && visibleEqs.length >= 2) {
    for (let i = 0; i < visibleEqs.length; i++) {
      for (let j = i + 1; j < visibleEqs.length; j++) {
        const pts = findExplicitIntersections(
          visibleEqs[i].expression,
          visibleEqs[j].expression,
          bounds,
          config.angleUnit,
          config.parameters
        );
        for (const pt of pts) {
          const px = worldToPxX(pt.x);
          const py = worldToPxY(pt.y);
          ctx.fillStyle = '#f59e0b';
          ctx.strokeStyle = isDark ? '#0f172a' : '#ffffff';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(px, py, 4.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
      }
    }
  }

  // Legend
  if (config.showLegend && visibleEqs.length > 0) {
    ctx.save();
    ctx.font = '600 10px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const boxW = Math.min(width * 0.48, 190);
    const boxH = 12 + visibleEqs.length * 16;
    ctx.fillStyle = isDark ? 'rgba(15, 23, 42, 0.82)' : 'rgba(248, 250, 252, 0.88)';
    ctx.strokeStyle = majorGridColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(x + width - boxW - 8, y + 8, boxW, boxH, 6);
    ctx.fill();
    ctx.stroke();

    visibleEqs.forEach((eq, idx) => {
      const ly = y + 16 + idx * 16;
      ctx.fillStyle = eq.color;
      ctx.fillRect(x + width - boxW, ly - 2, 10, 4);
      ctx.fillStyle = labelColor;
      const lbl = (eq.label || eq.expression).slice(0, 22);
      ctx.fillText(lbl, x + width - boxW + 15, ly);
    });
    ctx.restore();
  }

  ctx.restore();
}

export function exportGraph2DToSvg(
  config: Graph2DConfig,
  width = 640,
  height = 420,
  dark = true
): string {
  const { bounds } = config;
  const xSpan = Math.max(1e-6, bounds.xMax - bounds.xMin);
  const ySpan = Math.max(1e-6, bounds.yMax - bounds.yMin);
  const toX = (wx: number) => (((wx - bounds.xMin) / xSpan) * width).toFixed(2);
  const toY = (wy: number) => (height - ((wy - bounds.yMin) / ySpan) * height).toFixed(2);

  const bg = dark ? '#0b1220' : '#ffffff';
  const gridCol = dark ? '#1e293b' : '#e2e8f0';
  const axisCol = dark ? '#94a3b8' : '#334155';

  const stepX = computeNiceGridStep(xSpan, 8);
  const stepY = computeNiceGridStep(ySpan, 6);

  const parts: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    `<rect width="${width}" height="${height}" fill="${bg}" />`,
  ];

  if (config.showGrid) {
    for (let gx = Math.ceil(bounds.xMin / stepX) * stepX; gx <= bounds.xMax; gx += stepX) {
      parts.push(`<line x1="${toX(gx)}" y1="0" x2="${toX(gx)}" y2="${height}" stroke="${gridCol}" stroke-width="1" />`);
    }
    for (let gy = Math.ceil(bounds.yMin / stepY) * stepY; gy <= bounds.yMax; gy += stepY) {
      parts.push(`<line x1="0" y1="${toY(gy)}" x2="${width}" y2="${toY(gy)}" stroke="${gridCol}" stroke-width="1" />`);
    }
  }

  if (config.showAxes) {
    if (bounds.yMin <= 0 && bounds.yMax >= 0) {
      parts.push(`<line x1="0" y1="${toY(0)}" x2="${width}" y2="${toY(0)}" stroke="${axisCol}" stroke-width="1.5" />`);
    }
    if (bounds.xMin <= 0 && bounds.xMax >= 0) {
      parts.push(`<line x1="${toX(0)}" y1="0" x2="${toX(0)}" y2="${height}" stroke="${axisCol}" stroke-width="1.5" />`);
    }
  }

  for (const eq of config.equations.filter((e) => e.visible && e.expression.trim())) {
    const evalCurve = evaluate2DEquation(eq, bounds, config.angleUnit, config.parameters, width);
    const dash = eq.lineStyle === 'dashed' ? ' stroke-dasharray="7 5"' : eq.lineStyle === 'dotted' ? ' stroke-dasharray="2 4"' : '';
    for (const seg of evalCurve.segments) {
      if (seg.points.length < 2) continue;
      const d = seg.points
        .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${toX(p.x)} ${toY(p.y)}`)
        .join(' ');
      parts.push(`<path d="${d}" fill="none" stroke="${eq.color}" stroke-width="${eq.thickness || 2}"${dash} />`);
    }
  }

  parts.push('</svg>');
  return parts.join('\n');
}
