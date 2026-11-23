import {
  FontFamily,
  Point,
  Sloppiness,
  StrokeStyle,
  TriangleVariant,
  WhiteboardElement,
} from './types';

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function getSloppinessRoughness(sloppiness: Sloppiness): number {
  if (sloppiness === 0) return 0.35; // Architect
  if (sloppiness === 1) return 1.25; // Artist
  return 2.6; // Cartoonist
}

export function getCanvasFontCss(fontFamily: FontFamily, fontSize: number): string {
  switch (fontFamily) {
    case 'scribble':
      return `600 ${fontSize}px "Caveat", cursive`;
    case 'casual':
      return `700 ${fontSize}px "Comic Neue", cursive`;
    case 'heavy':
      return `400 ${fontSize}px "Lilita One", sans-serif`;
    case 'cleansans':
    default:
      return `600 ${fontSize}px "Nunito", sans-serif`;
  }
}

export function getFontDisplayName(fontFamily: FontFamily): string {
  switch (fontFamily) {
    case 'scribble':
      return 'Scribble (Caveat)';
    case 'casual':
      return 'Casual (Comic Neue)';
    case 'heavy':
      return 'Heavy (Lilita One)';
    case 'cleansans':
      return 'CleanSans (Nunito)';
  }
}

export interface SketchSegment {
  start: Point;
  cp: Point;
  end: Point;
}

export function generateSketchyLineSegments(
  p1: Point,
  p2: Point,
  sloppiness: Sloppiness,
  seed: number
): SketchSegment[] {
  const rand = mulberry32(seed);
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const len = Math.hypot(dx, dy);
  if (len < 0.5) return [];

  const roughness = getSloppinessRoughness(sloppiness);
  const maxOffset = Math.min(4.5, len * 0.035) * roughness;
  const passes = sloppiness === 0 ? 1 : 2;
  const segments: SketchSegment[] = [];

  for (let pass = 0; pass < passes; pass++) {
    const jitter = (scale = 1) => (rand() - 0.5) * 2 * maxOffset * scale;
    const midX = (p1.x + p2.x) / 2 + jitter(1.1);
    const midY = (p1.y + p2.y) / 2 + jitter(1.1);
    segments.push({
      start: { x: p1.x + jitter(0.35), y: p1.y + jitter(0.35) },
      cp: { x: midX, y: midY },
      end: { x: p2.x + jitter(0.35), y: p2.y + jitter(0.35) },
    });
  }
  return segments;
}

export function generateSketchyPolygonSegments(
  vertices: Point[],
  sloppiness: Sloppiness,
  seed: number,
  closed = true
): SketchSegment[] {
  const result: SketchSegment[] = [];
  const count = closed ? vertices.length : vertices.length - 1;
  for (let i = 0; i < count; i++) {
    const a = vertices[i];
    const b = vertices[(i + 1) % vertices.length];
    const edgeSegs = generateSketchyLineSegments(a, b, sloppiness, seed + i * 97);
    result.push(...edgeSegs);
  }
  return result;
}

export function generateSketchyEllipsePoints(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  sloppiness: Sloppiness,
  seed: number
): Point[][] {
  const rand = mulberry32(seed);
  const roughness = getSloppinessRoughness(sloppiness);
  const passes = sloppiness === 0 ? 1 : 2;
  const steps = Math.max(24, Math.min(64, Math.round((rx + ry) * 0.3)));
  const curves: Point[][] = [];

  for (let p = 0; p < passes; p++) {
    const pts: Point[] = [];
    const angleOffset = rand() * 0.4;
    const amp = Math.min(4, Math.max(0.4, Math.min(rx, ry) * 0.03)) * roughness;
    for (let i = 0; i <= steps + 1; i++) {
      const t = (i / steps) * Math.PI * 2 + angleOffset;
      const wobble = (rand() - 0.5) * amp;
      pts.push({
        x: cx + (rx + wobble) * Math.cos(t),
        y: cy + (ry + wobble) * Math.sin(t),
      });
    }
    curves.push(pts);
  }
  return curves;
}

/** Clips horizontal/diagonal hachure lines to a convex/general polygon via scanline intersections */
export function generatePolygonHachureLines(
  polygon: Point[],
  angleDeg: number,
  gap: number,
  sloppiness: Sloppiness,
  seed: number,
  crossHatch = false
): SketchSegment[] {
  if (polygon.length < 3) return [];
  const segments: SketchSegment[] = [];

  const runAngle = (deg: number, seedOffset: number) => {
    const rad = (deg * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const rot = polygon.map((p) => ({
      x: p.x * cos + p.y * sin,
      y: -p.x * sin + p.y * cos,
    }));

    let minY = Infinity;
    let maxY = -Infinity;
    for (const p of rot) {
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }

    const step = Math.max(6, gap);
    let lineIndex = 0;
    for (let y = minY + step * 0.5; y < maxY; y += step) {
      const xs: number[] = [];
      for (let i = 0; i < rot.length; i++) {
        const a = rot[i];
        const b = rot[(i + 1) % rot.length];
        if ((a.y <= y && b.y > y) || (b.y <= y && a.y > y)) {
          const t = (y - a.y) / (b.y - a.y);
          xs.push(a.x + t * (b.x - a.x));
        }
      }
      xs.sort((u, v) => u - v);
      for (let i = 0; i + 1 < xs.length; i += 2) {
        const rx1 = xs[i];
        const rx2 = xs[i + 1];
        if (rx2 - rx1 < 2) continue;
        // Rotate back
        const p1 = { x: rx1 * cos - y * sin, y: rx1 * sin + y * cos };
        const p2 = { x: rx2 * cos - y * sin, y: rx2 * sin + y * cos };
        const segs = generateSketchyLineSegments(p1, p2, sloppiness, seed + seedOffset + lineIndex * 31);
        if (segs.length > 0) segments.push(segs[0]);
      }
      lineIndex++;
    }
  };

  runAngle(angleDeg, 1000);
  if (crossHatch) {
    runAngle(angleDeg + 90, 5000);
  }
  return segments;
}

export function getEllipsePolygon(cx: number, cy: number, rx: number, ry: number, steps = 28): Point[] {
  const pts: Point[] = [];
  for (let i = 0; i < steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    pts.push({ x: cx + rx * Math.cos(t), y: cy + ry * Math.sin(t) });
  }
  return pts;
}

export function getTriangleVertices(
  x: number,
  y: number,
  w: number,
  h: number,
  variant: TriangleVariant = 'equilateral',
  customPoints?: Point[]
): Point[] {
  if (customPoints && customPoints.length === 3) {
    // Custom normalized/relative points scaled with bounding box
    return customPoints.map((p) => ({ x: x + p.x * w, y: y + p.y * h }));
  }
  if (variant === 'right-left') {
    return [
      { x, y },
      { x, y: y + h },
      { x: x + w, y: y + h },
    ];
  }
  if (variant === 'right-right') {
    return [
      { x: x + w, y },
      { x: x + w, y: y + h },
      { x, y: y + h },
    ];
  }
  if (variant === 'isosceles') {
    return [
      { x: x + w / 2, y },
      { x: x + w, y: y + h },
      { x, y: y + h },
    ];
  }
  return [
    { x: x + w / 2, y },
    { x: x + w, y: y + h },
    { x, y: y + h },
  ];
}

export function getParallelogramVertices(
  x: number,
  y: number,
  w: number,
  h: number,
  skewRatio = 0.24,
  customPoints?: Point[]
): Point[] {
  if (customPoints && customPoints.length === 4) {
    return customPoints.map((p) => ({ x: x + p.x * w, y: y + p.y * h }));
  }
  const offset = Math.min(w * 0.45, Math.abs(skewRatio) * w);
  if (skewRatio >= 0) {
    // Top edge shifted right relative to bottom edge
    return [
      { x: x + offset, y },
      { x: x + w, y },
      { x: x + w - offset, y: y + h },
      { x, y: y + h },
    ];
  }
  // Top edge shifted left relative to bottom edge
  return [
    { x, y },
    { x: x + w - offset, y },
    { x: x + w, y: y + h },
    { x: x + offset, y: y + h },
  ];
}

export function getDiamondVertices(x: number, y: number, w: number, h: number): Point[] {
  return [
    { x: x + w / 2, y },
    { x: x + w, y: y + h / 2 },
    { x: x + w / 2, y: y + h },
    { x, y: y + h / 2 },
  ];
}

export function getRectangleVertices(x: number, y: number, w: number, h: number): Point[] {
  return [
    { x, y },
    { x: x + w, y },
    { x: x + w, y: y + h },
    { x, y: y + h },
  ];
}

export function getNormalizedBounds(el: WhiteboardElement): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  if (
    (el.type === 'line' || el.type === 'arrow' || el.type === 'wire' || el.type === 'freedraw') &&
    el.points &&
    el.points.length > 0
  ) {
    const pts = el.type === 'wire' ? getWireRenderPoints(el) : el.points.map((p) => ({ x: el.x + p.x, y: el.y + p.y }));
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const p of pts) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
    return {
      x: minX,
      y: minY,
      width: Math.max(8, maxX - minX),
      height: Math.max(8, maxY - minY),
    };
  }
  const nx = el.width >= 0 ? el.x : el.x + el.width;
  const ny = el.height >= 0 ? el.y : el.y + el.height;
  return {
    x: nx,
    y: ny,
    width: Math.abs(el.width),
    height: Math.abs(el.height),
  };
}

export function pointToSegmentDistance(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

export function rotatePointAround(pt: Point, center: Point, angleRad: number): Point {
  if (!angleRad || Math.abs(angleRad) <= 0.0001) return pt;
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);
  const dx = pt.x - center.x;
  const dy = pt.y - center.y;
  return {
    x: center.x + dx * cos - dy * sin,
    y: center.y + dx * sin + dy * cos,
  };
}

export function normalizeElementAngle(angleRad: number): number {
  const twoPi = Math.PI * 2;
  let norm = ((angleRad % twoPi) + twoPi) % twoPi;
  if (Math.abs(norm - twoPi) < 0.001 || norm < 0.001) norm = 0;
  for (const step of [Math.PI / 2, Math.PI, (3 * Math.PI) / 2]) {
    if (Math.abs(norm - step) < 0.001) return step;
  }
  return norm;
}

export function rotateElementBy(el: WhiteboardElement, deltaRad: number): WhiteboardElement {
  if (
    (el.type === 'line' || el.type === 'arrow' || el.type === 'wire' || el.type === 'freedraw') &&
    el.points &&
    el.points.length >= 2
  ) {
    const worldPts = el.points.map((p) => ({ x: el.x + p.x, y: el.y + p.y }));
    const xs = worldPts.map((p) => p.x);
    const ys = worldPts.map((p) => p.y);
    const center = {
      x: (Math.min(...xs) + Math.max(...xs)) / 2,
      y: (Math.min(...ys) + Math.max(...ys)) / 2,
    };
    const rotWorld = worldPts.map((p) => rotatePointAround(p, center, deltaRad));
    const origin = rotWorld[0];
    const relPts = rotWorld.map((p) => ({ x: p.x - origin.x, y: p.y - origin.y }));
    const rxs = relPts.map((p) => p.x);
    const rys = relPts.map((p) => p.y);
    return {
      ...el,
      x: origin.x,
      y: origin.y,
      width: Math.max(1, Math.max(...rxs) - Math.min(...rxs)),
      height: Math.max(1, Math.max(...rys) - Math.min(...rys)),
      points: relPts,
      version: el.version + 1,
      updatedAt: Date.now(),
    };
  }
  return {
    ...el,
    angle: normalizeElementAngle((el.angle || 0) + deltaRad),
    version: el.version + 1,
    updatedAt: Date.now(),
  };
}

export function hitTestElement(el: WhiteboardElement, worldPt: Point, tolerance = 8): boolean {
  if (el.isDeleted) return false;
  const bounds = getNormalizedBounds(el);

  if (el.type === 'line' || el.type === 'arrow' || el.type === 'wire' || el.type === 'freedraw') {
    const pts = el.points || [];
    if (pts.length === 0) return false;
    if (pts.length === 1) {
      return Math.hypot(worldPt.x - (el.x + pts[0].x), worldPt.y - (el.y + pts[0].y)) <= tolerance;
    }
    const worldPts =
      el.type === 'wire'
        ? getWireRenderPoints(el)
        : pts.map((p) => ({ x: el.x + p.x, y: el.y + p.y }));
    for (let i = 0; i < worldPts.length - 1; i++) {
      if (pointToSegmentDistance(worldPt, worldPts[i], worldPts[i + 1]) <= tolerance + el.strokeWidth) {
        return true;
      }
    }
    return false;
  }

  const testPt =
    el.angle && Math.abs(el.angle) > 0.001
      ? rotatePointAround(
          worldPt,
          { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 },
          -el.angle
        )
      : worldPt;

  // Frame hit-tests along its border or header tab so elements inside remain easy to select
  if (el.type === 'frame') {
    const inHeader =
      testPt.x >= bounds.x &&
      testPt.x <= bounds.x + Math.min(bounds.width, 220) &&
      testPt.y >= bounds.y - 28 &&
      testPt.y <= bounds.y + 4;
    if (inHeader) return true;
    const nearLeft = Math.abs(testPt.x - bounds.x) <= tolerance && testPt.y >= bounds.y && testPt.y <= bounds.y + bounds.height;
    const nearRight = Math.abs(testPt.x - (bounds.x + bounds.width)) <= tolerance && testPt.y >= bounds.y && testPt.y <= bounds.y + bounds.height;
    const nearTop = Math.abs(testPt.y - bounds.y) <= tolerance && testPt.x >= bounds.x && testPt.x <= bounds.x + bounds.width;
    const nearBottom = Math.abs(testPt.y - (bounds.y + bounds.height)) <= tolerance && testPt.x >= bounds.x && testPt.x <= bounds.x + bounds.width;
    return nearLeft || nearRight || nearTop || nearBottom;
  }

  if (el.type === 'ellipse') {
    const cx = bounds.x + bounds.width / 2;
    const cy = bounds.y + bounds.height / 2;
    const rx = Math.max(1, bounds.width / 2 + tolerance);
    const ry = Math.max(1, bounds.height / 2 + tolerance);
    const norm = ((testPt.x - cx) ** 2) / (rx ** 2) + ((testPt.y - cy) ** 2) / (ry ** 2);
    return norm <= 1.05;
  }

  return (
    testPt.x >= bounds.x - tolerance &&
    testPt.x <= bounds.x + bounds.width + tolerance &&
    testPt.y >= bounds.y - tolerance &&
    testPt.y <= bounds.y + bounds.height + tolerance
  );
}

export function getStrokeDashArray(style: StrokeStyle, strokeWidth: number): number[] {
  if (style === 'dashed') return [Math.max(8, strokeWidth * 3.5), Math.max(6, strokeWidth * 2.5)];
  if (style === 'dotted') return [Math.max(2, strokeWidth), Math.max(5, strokeWidth * 2.4)];
  return [];
}

export function getArrowheadPoints(tip: Point, from: Point, size = 14): [Point, Point] {
  const angle = Math.atan2(tip.y - from.y, tip.x - from.x);
  const spread = Math.PI / 6.5;
  return [
    {
      x: tip.x - size * Math.cos(angle - spread),
      y: tip.y - size * Math.sin(angle - spread),
    },
    {
      x: tip.x - size * Math.cos(angle + spread),
      y: tip.y - size * Math.sin(angle + spread),
    },
  ];
}

export function getAnchorWorldPosition(el: WhiteboardElement, anchor: Point): Point {
  const b = getNormalizedBounds(el);
  const rawPt = {
    x: b.x + anchor.x * b.width,
    y: b.y + anchor.y * b.height,
  };
  if (el.angle && Math.abs(el.angle) > 0.001) {
    return rotatePointAround(rawPt, { x: b.x + b.width / 2, y: b.y + b.height / 2 }, el.angle);
  }
  return rawPt;
}

export type TerminalExitDir = 'left' | 'right' | 'top' | 'bottom' | 'auto';

export function inferTerminalExitDir(anchor?: Point): TerminalExitDir {
  if (!anchor) return 'auto';
  if (anchor.x <= 0.05) return 'left';
  if (anchor.x >= 0.95) return 'right';
  if (anchor.y <= 0.05) return 'top';
  if (anchor.y >= 0.95) return 'bottom';
  return 'auto';
}

/**
 * Generates clean MATLAB/Simulink-style orthogonal Manhattan 90-degree wire waypoints
 * in world coordinates, removing redundant collinear points.
 */
export function buildOrthogonalWirePath(
  start: Point,
  end: Point,
  startDir: TerminalExitDir = 'auto',
  endDir: TerminalExitDir = 'auto'
): Point[] {
  const dx = end.x - start.x;
  const dy = end.y - start.y;

  // Already purely horizontal or vertical
  if (Math.abs(dx) < 2 || Math.abs(dy) < 2) {
    return [start, end];
  }

  const raw: Point[] = [start];
  const sHoriz = startDir === 'left' || startDir === 'right';
  const eHoriz = endDir === 'left' || endDir === 'right';
  const sVert = startDir === 'top' || startDir === 'bottom';
  const eVert = endDir === 'top' || endDir === 'bottom';

  if (sHoriz && eVert) {
    // Clean 1-elbow horizontal-then-vertical L-bend
    raw.push({ x: end.x, y: start.y });
  } else if (sVert && eHoriz) {
    // Clean 1-elbow vertical-then-horizontal L-bend
    raw.push({ x: start.x, y: end.y });
  } else if (sVert && eVert) {
    // Both vertical: Z-bend at midY
    const stub = 18;
    const sOutY = startDir === 'top' ? start.y - stub : start.y + stub;
    const eOutY = endDir === 'top' ? end.y - stub : end.y + stub;
    const midY = (start.y + end.y) / 2;
    if ((startDir === 'bottom' && dy > 20) || (startDir === 'top' && dy < -20)) {
      raw.push({ x: start.x, y: midY }, { x: end.x, y: midY });
    } else {
      raw.push(
        { x: start.x, y: sOutY },
        { x: end.x, y: sOutY },
        { x: end.x, y: eOutY }
      );
    }
  } else {
    // Default / horizontal-to-horizontal: Z-bend at midX
    const stub = 20;
    const forwardRight = startDir === 'right' && endDir === 'left' && dx > 12;
    const forwardLeft = startDir === 'left' && endDir === 'right' && dx < -12;
    if (forwardRight || forwardLeft || startDir === 'auto' || endDir === 'auto') {
      if (startDir === 'auto' && endDir === 'auto' && Math.abs(dy) > Math.abs(dx) * 1.35) {
        const midY = (start.y + end.y) / 2;
        raw.push({ x: start.x, y: midY }, { x: end.x, y: midY });
      } else {
        const midX = (start.x + end.x) / 2;
        raw.push({ x: midX, y: start.y }, { x: midX, y: end.y });
      }
    } else {
      // Loopback around component when pins face same/opposite direction
      const sOutX = startDir === 'left' ? start.x - stub : start.x + stub;
      const eOutX = endDir === 'left' ? end.x - stub : end.x + stub;
      const midY = (start.y + end.y) / 2;
      raw.push(
        { x: sOutX, y: start.y },
        { x: sOutX, y: midY },
        { x: eOutX, y: midY },
        { x: eOutX, y: end.y }
      );
    }
  }

  raw.push(end);

  // Deduplicate & strip collinear intermediate vertices
  const dedup: Point[] = [];
  for (const pt of raw) {
    const prev = dedup[dedup.length - 1];
    if (!prev || Math.hypot(pt.x - prev.x, pt.y - prev.y) > 0.5) {
      dedup.push(pt);
    }
  }
  const clean: Point[] = [];
  for (let i = 0; i < dedup.length; i++) {
    if (i === 0 || i === dedup.length - 1) {
      clean.push(dedup[i]);
      continue;
    }
    const p0 = clean[clean.length - 1];
    const p1 = dedup[i];
    const p2 = dedup[i + 1];
    const sameX = Math.abs(p0.x - p1.x) < 0.5 && Math.abs(p1.x - p2.x) < 0.5;
    const sameY = Math.abs(p0.y - p1.y) < 0.5 && Math.abs(p1.y - p2.y) < 0.5;
    if (!sameX && !sameY) {
      clean.push(p1);
    }
  }
  return clean.length >= 2 ? clean : [start, end];
}

/**
 * Samples a smooth Catmull-Rom spline passing directly through every control point
 * so users can drag any handle to decide exactly where a wire arcs.
 */
export function sampleCurvedWirePoints(worldPts: Point[], segmentsPerSpan = 16): Point[] {
  if (worldPts.length < 3) return worldPts;
  const sampled: Point[] = [worldPts[0]];
  const n = worldPts.length;
  for (let i = 0; i < n - 1; i++) {
    const p0 = worldPts[Math.max(0, i - 1)];
    const p1 = worldPts[i];
    const p2 = worldPts[i + 1];
    const p3 = worldPts[Math.min(n - 1, i + 2)];
    for (let step = 1; step <= segmentsPerSpan; step++) {
      const t = step / segmentsPerSpan;
      const t2 = t * t;
      const t3 = t2 * t;
      const x =
        0.5 *
        (2 * p1.x +
          (-p0.x + p2.x) * t +
          (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
          (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3);
      const y =
        0.5 *
        (2 * p1.y +
          (-p0.y + p2.y) * t +
          (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
          (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3);
      sampled.push({ x, y });
    }
  }
  return sampled;
}

export function getWireRenderPoints(el: WhiteboardElement): Point[] {
  const worldPts = (el.points || []).map((p) => ({ x: el.x + p.x, y: el.y + p.y }));
  if (el.wireRouting === 'curved' && worldPts.length >= 3) {
    return sampleCurvedWirePoints(worldPts, 16);
  }
  return worldPts;
}

/** Detects shared circuit solder junction dots (where >= 3 wire branches or T-junctions meet) */
export function computeWireJunctions(elements: WhiteboardElement[]): Point[] {
  const wires = elements.filter(
    (e) => !e.isDeleted && e.type === 'wire' && e.points && e.points.length >= 2
  );
  if (wires.length < 2) return [];

  const endpoints: { pt: Point; wireId: string }[] = [];
  const segments: { a: Point; b: Point; wireId: string }[] = [];

  for (const w of wires) {
    const worldPts = w.points!.map((p) => ({ x: w.x + p.x, y: w.y + p.y }));
    endpoints.push({ pt: worldPts[0], wireId: w.id });
    endpoints.push({ pt: worldPts[worldPts.length - 1], wireId: w.id });
    for (let i = 0; i < worldPts.length - 1; i++) {
      segments.push({ a: worldPts[i], b: worldPts[i + 1], wireId: w.id });
    }
  }

  const junctions: Point[] = [];
  const addJunction = (pt: Point) => {
    if (!junctions.some((j) => Math.hypot(j.x - pt.x, j.y - pt.y) < 8)) {
      junctions.push(pt);
    }
  };

  // 1. T-junction where a wire endpoint lands on the interior of another wire's segment
  for (const ep of endpoints) {
    for (const seg of segments) {
      if (seg.wireId === ep.wireId) continue;
      if (pointToSegmentDistance(ep.pt, seg.a, seg.b) <= 4) {
        const dA = Math.hypot(ep.pt.x - seg.a.x, ep.pt.y - seg.a.y);
        const dB = Math.hypot(ep.pt.x - seg.b.x, ep.pt.y - seg.b.y);
        if (dA > 4 && dB > 4) {
          addJunction(ep.pt);
        }
      }
    }
  }

  // 2. Multi-way node where 3+ wire endpoints coincide
  for (let i = 0; i < endpoints.length; i++) {
    let matches = 1;
    for (let j = i + 1; j < endpoints.length; j++) {
      if (Math.hypot(endpoints[i].pt.x - endpoints[j].pt.x, endpoints[i].pt.y - endpoints[j].pt.y) <= 5) {
        matches += 1;
      }
    }
    if (matches >= 3) {
      addJunction(endpoints[i].pt);
    }
  }

  return junctions;
}

/** Updates any bound arrows/lines/wires whose connected shape moved or resized */
export function updateBoundConnectors(
  elements: WhiteboardElement[],
  changedIds: Set<string>
): WhiteboardElement[] {
  const byId = new Map(elements.map((e) => [e.id, e]));
  let mutated = false;

  const next = elements.map((el) => {
    if (
      el.isDeleted ||
      (el.type !== 'arrow' && el.type !== 'line' && el.type !== 'wire') ||
      !el.points ||
      el.points.length < 2
    ) {
      return el;
    }
    const startBound = el.startBinding && changedIds.has(el.startBinding.elementId);
    const endBound = el.endBinding && changedIds.has(el.endBinding.elementId);
    if (!startBound && !endBound) return el;

    let worldPts = el.points.map((p) => ({ x: el.x + p.x, y: el.y + p.y }));
    if (startBound && el.startBinding) {
      const target = byId.get(el.startBinding.elementId);
      if (target && !target.isDeleted) {
        worldPts[0] = getAnchorWorldPosition(target, el.startBinding.anchor);
      }
    }
    if (endBound && el.endBinding) {
      const target = byId.get(el.endBinding.elementId);
      if (target && !target.isDeleted) {
        worldPts[worldPts.length - 1] = getAnchorWorldPosition(target, el.endBinding.anchor);
      }
    }

    if (el.type === 'wire' && el.wireRouting === 'orthogonal' && worldPts.length <= 4) {
      worldPts = buildOrthogonalWirePath(
        worldPts[0],
        worldPts[worldPts.length - 1],
        inferTerminalExitDir(el.startBinding?.anchor),
        inferTerminalExitDir(el.endBinding?.anchor)
      );
    }

    mutated = true;
    const origin = worldPts[0];
    const relPts = worldPts.map((p) => ({ x: p.x - origin.x, y: p.y - origin.y }));
    const xs = relPts.map((p) => p.x);
    const ys = relPts.map((p) => p.y);
    return {
      ...el,
      x: origin.x,
      y: origin.y,
      width: Math.max(1, Math.max(...xs) - Math.min(...xs)),
      height: Math.max(1, Math.max(...ys) - Math.min(...ys)),
      points: relPts,
      version: el.version + 1,
      updatedAt: Date.now(),
    };
  });

  return mutated ? next : elements;
}

export type ResizeHandleDir = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

/**
 * Computes the updated element geometry during a selection bounding-box resize.
 * Corner handles (`nw`, `ne`, `sw`, `se`) on standalone `text` elements lock
 * proportions around the opposite corner and scale `fontSize` smoothly;
 * multi-element corner resizes also scale `text` font sizes proportionally.
 */
export function computeResizedElement(
  el: WhiteboardElement,
  orig: WhiteboardElement,
  ib: { x: number; y: number; width: number; height: number },
  nx: number,
  ny: number,
  nw: number,
  nh: number,
  dir: ResizeHandleDir,
  isSingleElement: boolean
): WhiteboardElement {
  const ob = getNormalizedBounds(orig);
  const scaleX = nw / Math.max(1, ib.width);
  const scaleY = nh / Math.max(1, ib.height);
  const isCorner = dir === 'nw' || dir === 'ne' || dir === 'sw' || dir === 'se';
  const relX = (ob.x - ib.x) * scaleX;
  const relY = (ob.y - ib.y) * scaleY;

  if (
    (orig.type === 'line' || orig.type === 'arrow' || orig.type === 'wire' || orig.type === 'freedraw') &&
    orig.points
  ) {
    return {
      ...el,
      x: nx + relX + (orig.x - ob.x) * scaleX,
      y: ny + relY + (orig.y - ob.y) * scaleY,
      points: orig.points.map((p) => ({ x: p.x * scaleX, y: p.y * scaleY })),
      width: Math.max(8, ob.width * scaleX),
      height: Math.max(8, ob.height * scaleY),
      version: el.version + 1,
      updatedAt: Date.now(),
    };
  }

  if (orig.type === 'text') {
    if (isSingleElement && (isCorner || dir === 'n' || dir === 's')) {
      const rawScale = isCorner
        ? Math.abs(scaleX - 1) >= Math.abs(scaleY - 1)
          ? scaleX
          : scaleY
        : scaleY;
      const clampedScale = Math.max(0.15, rawScale);
      const nextFontSize = Math.max(
        8,
        Math.min(260, Math.round(orig.fontSize * clampedScale * 10) / 10)
      );
      const effScale = nextFontSize / Math.max(1, orig.fontSize);
      const scaledW = isCorner ? Math.max(16, ob.width * effScale) : ob.width;
      const scaledH = Math.max(16, ob.height * effScale);
      const anchoredX = dir.includes('w') ? ob.x + ob.width - scaledW : ob.x;
      const anchoredY = dir.includes('n') ? ob.y + ob.height - scaledH : ob.y;

      return {
        ...el,
        x: anchoredX,
        y: anchoredY,
        width: scaledW,
        height: scaledH,
        fontSize: nextFontSize,
        version: el.version + 1,
        updatedAt: Date.now(),
      };
    }

    if (!isSingleElement && (isCorner || dir === 'n' || dir === 's')) {
      const groupScale = Math.sqrt(Math.max(0.05, scaleX) * Math.max(0.05, scaleY));
      const nextFontSize = Math.max(
        8,
        Math.min(260, Math.round(orig.fontSize * groupScale * 10) / 10)
      );
      return {
        ...el,
        x: nx + relX,
        y: ny + relY,
        width: Math.max(12, ob.width * scaleX),
        height: Math.max(12, ob.height * scaleY),
        fontSize: nextFontSize,
        version: el.version + 1,
        updatedAt: Date.now(),
      };
    }
  }

  if (orig.type === 'math-equation' || orig.type === 'math-matrix') {
    const scaleFactor = Math.sqrt(Math.max(0.15, scaleX) * Math.max(0.15, scaleY));
    const baseFontSize = orig.fontSize || 16;
    const nextFontSize = Math.max(
      10,
      Math.min(96, Math.round(baseFontSize * scaleFactor * 10) / 10)
    );
    const scaledW = Math.max(48, ob.width * scaleX);
    const scaledH = Math.max(36, ob.height * scaleY);
    const anchoredX =
      isSingleElement && dir.includes('w') ? ob.x + ob.width - scaledW : nx + relX;
    const anchoredY =
      isSingleElement && dir.includes('n') ? ob.y + ob.height - scaledH : ny + relY;
    return {
      ...el,
      x: anchoredX,
      y: anchoredY,
      width: scaledW,
      height: scaledH,
      fontSize: nextFontSize,
      version: el.version + 1,
      updatedAt: Date.now(),
    };
  }

  const nextScaledW = Math.max(12, ob.width * scaleX);
  const nextScaledH = Math.max(12, ob.height * scaleY);
  const shapeHasText =
    Boolean(orig.text) &&
    orig.type !== 'frame' &&
    orig.type !== 'text';
  const shapeFontPatch = shapeHasText
    ? {
        fontSize: Math.max(
          8,
          Math.min(
            160,
            Math.round(
              (orig.fontSize || 20) *
                Math.sqrt(Math.max(0.15, scaleX) * Math.max(0.15, scaleY)) *
                10
            ) / 10
          )
        ),
      }
    : {};

  return {
    ...el,
    ...shapeFontPatch,
    x: isSingleElement && dir.includes('w') ? ob.x + ob.width - nextScaledW : nx + relX,
    y: isSingleElement && dir.includes('n') ? ob.y + ob.height - nextScaledH : ny + relY,
    width: nextScaledW,
    height: nextScaledH,
    version: el.version + 1,
    updatedAt: Date.now(),
  };
}

export interface AdaptiveGridMetrics {
  majorWorldStep: number;
  minorWorldStep: number;
  majorScreenStep: number;
  minorScreenStep: number;
  showMinor: boolean;
}

/**
 * Computes zoom-adaptive major and minor grid intervals anchored to world origin (0, 0).
 * Keeps major screen spacing cleanly readable (~45–160px) across extreme zoom-out and zoom-in.
 */
export function computeAdaptiveGridMetrics(
  zoom: number,
  baseWorldStep = 24
): AdaptiveGridMetrics {
  const safeZoom = Math.max(0.02, Math.min(20, zoom || 1));
  const targetWorldMajor = 84 / safeZoom;
  const ratio = Math.max(1e-4, targetWorldMajor / baseWorldStep);
  const exp = Math.floor(Math.log10(ratio));
  const pow10 = Math.pow(10, exp);
  const norm = ratio / pow10;
  const niceNorm = norm < 1.5 ? 1 : norm < 3.5 ? 2 : norm < 7.5 ? 5 : 10;

  const majorWorldStep = baseWorldStep * niceNorm * pow10;
  const majorScreenStep = majorWorldStep * safeZoom;

  let subdivisions = niceNorm === 5 ? 5 : 4;
  let minorWorldStep = majorWorldStep / subdivisions;
  let minorScreenStep = minorWorldStep * safeZoom;

  if (minorScreenStep < 10) {
    subdivisions = 2;
    minorWorldStep = majorWorldStep / subdivisions;
    minorScreenStep = minorWorldStep * safeZoom;
  }

  return {
    majorWorldStep,
    minorWorldStep,
    majorScreenStep,
    minorScreenStep,
    showMinor: minorScreenStep >= 10,
  };
}

export interface UniformGridMetrics {
  screenStep: number;
  worldStep: number;
}

/**
 * Computes zoom-compensated uniform graph-paper grid metrics so the rendered
 * square cell size remains constant on screen across all zoom levels.
 */
export function computeUniformGridMetrics(
  zoom: number,
  targetScreenStep = 24
): UniformGridMetrics {
  const safeZoom = Math.max(
    0.01,
    Math.min(20, Number.isFinite(zoom) && zoom > 0 ? zoom : 1)
  );
  const screenStep = Math.max(8, targetScreenStep);
  return {
    screenStep,
    worldStep: screenStep / safeZoom,
  };
}
