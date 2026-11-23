import { compileSafeEvaluator } from './EquationParser';
import { Graph3DConfig, Graph3DGeometricPreset } from './types';

export interface SurfaceGridData {
  rows: number;
  cols: number;
  xs: number[];
  ys: number[];
  zs: Float32Array; // rows * cols
  zMinFound: number;
  zMaxFound: number;
}

export interface ContourSegment {
  level: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export const GRAPH3D_PRESET_FUNCTIONS = [
  'a*x^2 + b*y^2 + c*x*y + d*x',
  'cos(a*x*y + b*x + c*y)',
  'log(abs(a*x*y + b*x + c*y) + 1)',
  '(a*x^2 + b*y^2 + c*x^2*y) / (x^2 + y^2 + 0.1)',
];

export const GEOMETRIC_3D_EXPRESSIONS: Record<Graph3DGeometricPreset, string> = {
  plane: 'a*x + b*y + c',
  sphere: 'sqrt(max(0, 9 - x^2 - y^2))',
  ellipsoid: 'sqrt(max(0, 1 - (x/3)^2 - (y/2)^2)) * 2',
  cylinder: 'x^2 + y^2 - 4',
  cone: 'sqrt(x^2 + y^2)',
  paraboloid: 'a*x^2 + b*y^2',
  hyperboloid: 'sqrt(1 + x^2 + y^2)',
  saddle: 'a*x^2 - b*y^2',
};

export function sampleColormap(
  t: number,
  map: Graph3DConfig['colormap'] = 'coolwarm'
): [number, number, number] {
  const u = Math.max(0, Math.min(1, t));
  if (map === 'emerald') {
    const r = Math.round(16 + u * 50);
    const g = Math.round(80 + u * 165);
    const b = Math.round(90 + (1 - u) * 120);
    return [r, g, b];
  }
  if (map === 'viridis') {
    // Smooth Viridis-inspired ramp: deep purple -> teal -> chartreuse
    const r = Math.round(68 + u * 185 * u);
    const g = Math.round(1 + u * 230);
    const b = Math.round(84 + Math.sin(u * Math.PI) * 110 - u * 45);
    return [Math.max(0, Math.min(255, r)), Math.max(0, Math.min(255, g)), Math.max(0, Math.min(255, b))];
  }
  // Coolwarm scientific ramp matching reference plot (cobalt blue -> sky cyan -> cream -> warm amber)
  if (u < 0.35) {
    const k = u / 0.35;
    return [
      Math.round(35 + k * 70),
      Math.round(75 + k * 125),
      Math.round(230 + k * 20),
    ];
  }
  if (u < 0.65) {
    const k = (u - 0.35) / 0.3;
    return [
      Math.round(105 + k * 135),
      Math.round(200 + k * 45),
      Math.round(250 - k * 35),
    ];
  }
  const k = (u - 0.65) / 0.35;
  return [
    Math.round(240 - k * 20),
    Math.round(245 - k * 110),
    Math.round(215 - k * 160),
  ];
}

export function evaluate3DSurfaceGrid(config: Graph3DConfig): SurfaceGridData {
  const n = Math.max(16, Math.min(80, config.resolution || 36));
  const rawExpr =
    config.kind === 'geometric' && config.geometricPreset
      ? GEOMETRIC_3D_EXPRESSIONS[config.geometricPreset]
      : config.expression;
  const clean = rawExpr.replace(/^(?:z|f\s*\(\s*x\s*,\s*y\s*\))\s*=\s*/i, '');
  const compiled = compileSafeEvaluator(clean, 'rad');

  const xs: number[] = [];
  const ys: number[] = [];
  const zs = new Float32Array(n * n);
  let zMinFound = Infinity;
  let zMaxFound = -Infinity;

  for (let i = 0; i < n; i++) {
    xs.push(config.xMin + (i / (n - 1)) * (config.xMax - config.xMin));
    ys.push(config.yMin + (i / (n - 1)) * (config.yMax - config.yMin));
  }

  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      let z = NaN;
      if (compiled.ok && compiled.evaluator) {
        try {
          const val = Number(
            compiled.evaluator({
              ...config.constants,
              x: xs[i],
              y: ys[j],
            })
          );
          if (Number.isFinite(val)) {
            z = Math.max(config.zMin * 4, Math.min(config.zMax * 4, val));
            zMinFound = Math.min(zMinFound, z);
            zMaxFound = Math.max(zMaxFound, z);
          }
        } catch {
          z = NaN;
        }
      }
      zs[j * n + i] = z;
    }
  }

  if (!Number.isFinite(zMinFound)) {
    zMinFound = -1;
    zMaxFound = 1;
  }

  return { rows: n, cols: n, xs, ys, zs, zMinFound, zMaxFound };
}

/**
 * Generates contour segments via marching squares across multiple iso-levels for 2D contour plot.
 */
export function generateContourSegments(
  grid: SurfaceGridData,
  numLevels = 9
): { levels: number[]; segments: ContourSegment[] } {
  const span = Math.max(1e-6, grid.zMaxFound - grid.zMinFound);
  const levels: number[] = [];
  for (let k = 1; k < numLevels; k++) {
    levels.push(grid.zMinFound + (k / numLevels) * span);
  }
  const segments: ContourSegment[] = [];
  const { rows, cols, xs, ys, zs } = grid;

  const interp = (a: number, b: number, level: number) => {
    const d = b - a;
    if (Math.abs(d) < 1e-12) return 0.5;
    return Math.max(0, Math.min(1, (level - a) / d));
  };

  for (const level of levels) {
    for (let j = 0; j < rows - 1; j++) {
      for (let i = 0; i < cols - 1; i++) {
        const v0 = zs[j * cols + i];
        const v1 = zs[j * cols + (i + 1)];
        const v2 = zs[(j + 1) * cols + (i + 1)];
        const v3 = zs[(j + 1) * cols + i];
        if (![v0, v1, v2, v3].every(Number.isFinite)) continue;

        const pts: Array<{ x: number; y: number }> = [];
        if ((v0 < level) !== (v1 < level)) {
          pts.push({ x: xs[i] + interp(v0, v1, level) * (xs[i + 1] - xs[i]), y: ys[j] });
        }
        if ((v1 < level) !== (v2 < level)) {
          pts.push({ x: xs[i + 1], y: ys[j] + interp(v1, v2, level) * (ys[j + 1] - ys[j]) });
        }
        if ((v3 < level) !== (v2 < level)) {
          pts.push({ x: xs[i] + interp(v3, v2, level) * (xs[i + 1] - xs[i]), y: ys[j + 1] });
        }
        if ((v0 < level) !== (v3 < level)) {
          pts.push({ x: xs[i], y: ys[j] + interp(v0, v3, level) * (ys[j + 1] - ys[j]) });
        }

        if (pts.length >= 2) {
          segments.push({ level, x1: pts[0].x, y1: pts[0].y, x2: pts[1].x, y2: pts[1].y });
        }
        if (pts.length === 4) {
          segments.push({ level, x1: pts[2].x, y1: pts[2].y, x2: pts[3].x, y2: pts[3].y });
        }
      }
    }
  }
  return { levels, segments };
}

/**
 * Draws the synchronized 2D filled contour map onto a Canvas 2D context.
 */
export function drawContourPlot2D(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  config: Graph3DConfig,
  dark = true
): void {
  const grid = evaluate3DSurfaceGrid(config);
  const { levels, segments } = generateContourSegments(grid, 9);
  const { rows, cols, zs, zMinFound, zMaxFound } = grid;
  const zSpan = Math.max(1e-6, zMaxFound - zMinFound);

  ctx.save();
  ctx.fillStyle = dark ? '#0b1220' : '#ffffff';
  ctx.fillRect(x, y, width, height);

  const cellW = width / (cols - 1);
  const cellH = height / (rows - 1);

  // Quantized heatmap bands for crisp contour look matching scientific plots
  for (let j = 0; j < rows - 1; j++) {
    for (let i = 0; i < cols - 1; i++) {
      const zAvg =
        (zs[j * cols + i] +
          zs[j * cols + i + 1] +
          zs[(j + 1) * cols + i] +
          zs[(j + 1) * cols + i + 1]) /
        4;
      if (!Number.isFinite(zAvg)) continue;
      const tRaw = (zAvg - zMinFound) / zSpan;
      const band = Math.floor(tRaw * levels.length) / Math.max(1, levels.length);
      const [r, g, b] = sampleColormap(band, config.colormap);
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      const px = x + i * cellW;
      const py = y + height - (j + 1) * cellH;
      ctx.fillRect(px, py, cellW + 0.7, cellH + 0.7);
    }
  }

  // Crisp contour isolines
  const xSpan = Math.max(1e-6, config.xMax - config.xMin);
  const ySpan = Math.max(1e-6, config.yMax - config.yMin);
  ctx.strokeStyle = dark ? 'rgba(15,23,42,0.72)' : 'rgba(15,23,42,0.58)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (const seg of segments) {
    const px1 = x + ((seg.x1 - config.xMin) / xSpan) * width;
    const py1 = y + height - ((seg.y1 - config.yMin) / ySpan) * height;
    const px2 = x + ((seg.x2 - config.xMin) / xSpan) * width;
    const py2 = y + height - ((seg.y2 - config.yMin) / ySpan) * height;
    ctx.moveTo(px1, py1);
    ctx.lineTo(px2, py2);
  }
  ctx.stroke();

  ctx.strokeStyle = dark ? 'rgba(148,163,184,0.35)' : 'rgba(15,23,42,0.3)';
  ctx.strokeRect(x, y, width, height);
  ctx.restore();
}

/**
 * Software isometric fallback / PNG export renderer for 3D surface when WebGL
 * isn't available or when exporting directly to a static 2D canvas.
 */
export function draw3DSurfaceIsometricFallback(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  config: Graph3DConfig,
  dark = true,
  yawRad = 0.65,
  pitchRad = 0.55
): void {
  const grid = evaluate3DSurfaceGrid(config);
  const { rows, cols, xs, ys, zs, zMinFound, zMaxFound } = grid;
  const xSpan = Math.max(1e-6, config.xMax - config.xMin);
  const ySpan = Math.max(1e-6, config.yMax - config.yMin);
  const zSpan = Math.max(1e-6, zMaxFound - zMinFound);

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, 8);
  ctx.fillStyle = dark ? '#0b1220' : '#f8fafc';
  ctx.fill();
  ctx.clip();

  const scale = Math.min(width, height) * 0.36;
  const cx = x + width / 2;
  const cy = y + height * 0.56;

  const project = (wx: number, wy: number, wz: number) => {
    const nx = ((wx - config.xMin) / xSpan - 0.5) * 2;
    const ny = ((wy - config.yMin) / ySpan - 0.5) * 2;
    const nz = ((wz - zMinFound) / zSpan - 0.5) * 1.4;

    const rx = nx * Math.cos(yawRad) - ny * Math.sin(yawRad);
    const ry = nx * Math.sin(yawRad) + ny * Math.cos(yawRad);
    const rz = nz * Math.cos(pitchRad) - ry * Math.sin(pitchRad);
    const depth = nz * Math.sin(pitchRad) + ry * Math.cos(pitchRad);
    return {
      px: cx + rx * scale,
      py: cy - rz * scale,
      depth,
    };
  };

  // Painter's algorithm sorted quads
  interface Quad {
    pts: Array<{ px: number; py: number }>;
    depth: number;
    t: number;
  }
  const quads: Quad[] = [];
  for (let j = 0; j < rows - 1; j++) {
    for (let i = 0; i < cols - 1; i++) {
      const z00 = zs[j * cols + i];
      const z10 = zs[j * cols + i + 1];
      const z11 = zs[(j + 1) * cols + i + 1];
      const z01 = zs[(j + 1) * cols + i];
      if (![z00, z10, z11, z01].every(Number.isFinite)) continue;
      const p00 = project(xs[i], ys[j], z00);
      const p10 = project(xs[i + 1], ys[j], z10);
      const p11 = project(xs[i + 1], ys[j + 1], z11);
      const p01 = project(xs[i], ys[j + 1], z01);
      const avgZ = (z00 + z10 + z11 + z01) / 4;
      quads.push({
        pts: [p00, p10, p11, p01],
        depth: (p00.depth + p10.depth + p11.depth + p01.depth) / 4,
        t: (avgZ - zMinFound) / zSpan,
      });
    }
  }

  quads.sort((a, b) => a.depth - b.depth);
  for (const q of quads) {
    const [r, g, b] = sampleColormap(q.t, config.colormap);
    ctx.beginPath();
    q.pts.forEach((pt, idx) => (idx === 0 ? ctx.moveTo(pt.px, pt.py) : ctx.lineTo(pt.px, pt.py)));
    ctx.closePath();
    if (config.renderMode !== 'wireframe') {
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fill();
    }
    if (config.renderMode !== 'surface') {
      ctx.strokeStyle =
        config.renderMode === 'wireframe'
          ? `rgb(${r},${g},${b})`
          : dark
          ? 'rgba(15,23,42,0.48)'
          : 'rgba(15,23,42,0.36)';
      ctx.lineWidth = config.renderMode === 'wireframe' ? 1 : 0.65;
      ctx.stroke();
    }
  }

  ctx.restore();
}
