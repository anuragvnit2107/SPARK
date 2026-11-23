import { Point, TriangleVariant, WhiteboardElement } from './types';
import { pointToSegmentDistance } from './sketchEngine';

/** Ramer-Douglas-Peucker polyline simplification */
export function rdpSimplify(points: Point[], epsilon: number): Point[] {
  if (points.length <= 2) return points;
  let maxDist = 0;
  let index = 0;
  const start = points[0];
  const end = points[points.length - 1];

  for (let i = 1; i < points.length - 1; i++) {
    const d = pointToSegmentDistance(points[i], start, end);
    if (d > maxDist) {
      maxDist = d;
      index = i;
    }
  }

  if (maxDist > epsilon) {
    const left = rdpSimplify(points.slice(0, index + 1), epsilon);
    const right = rdpSimplify(points.slice(index), epsilon);
    return [...left.slice(0, -1), ...right];
  }
  return [start, end];
}

function pathLength(points: Point[]): number {
  let len = 0;
  for (let i = 0; i < points.length - 1; i++) {
    len += Math.hypot(points[i + 1].x - points[i].x, points[i + 1].y - points[i].y);
  }
  return len;
}

function normalizeVec(dx: number, dy: number): Point {
  const len = Math.hypot(dx, dy) || 1;
  return { x: dx / len, y: dy / len };
}

function sortPolygonVerticesCCW(pts: Point[]): Point[] {
  const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
  const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
  return [...pts].sort((a, b) => Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx));
}

export interface RecognizedShapeResult {
  type: 'ellipse' | 'rectangle' | 'triangle' | 'diamond' | 'parallelogram' | 'line';
  x: number;
  y: number;
  width: number;
  height: number;
  points?: Point[];
  triangleVariant?: TriangleVariant;
  skewRatio?: number;
  label: string;
}

/**
 * Classifies a world-space freehand stroke into a clean geometric primitive:
 * - Straight line
 * - Circle / Ellipse
 * - Triangle (Equilateral/Isosceles, Right-Left, Right-Right, Top-Left/Top-Right Right Triangle)
 * - Parallelogram (Left or Right slanted)
 * - Diamond
 * - Rectangle / Square
 */
export function recognizeFreehandShape(points: Point[]): RecognizedShapeResult | null {
  if (points.length < 5) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }

  const width = maxX - minX;
  const height = maxY - minY;
  const diag = Math.hypot(width, height);
  if (diag < 28) return null;

  const totalLen = pathLength(points);
  const startEndDist = Math.hypot(
    points[0].x - points[points.length - 1].x,
    points[0].y - points[points.length - 1].y
  );

  // Straight line check: open stroke with high straightness ratio
  if (startEndDist > diag * 0.82 && totalLen / Math.max(1, startEndDist) < 1.12) {
    return {
      type: 'line',
      x: points[0].x,
      y: points[0].y,
      width: Math.max(1, Math.abs(points[points.length - 1].x - points[0].x)),
      height: Math.max(1, Math.abs(points[points.length - 1].y - points[0].y)),
      points: [
        { x: 0, y: 0 },
        {
          x: points[points.length - 1].x - points[0].x,
          y: points[points.length - 1].y - points[0].y,
        },
      ],
      label: 'Line',
    };
  }

  // Must be reasonably closed to recognize as a closed 2D shape
  const isClosed = startEndDist < diag * 0.38;
  if (!isClosed) return null;

  // Test ellipse / circle radial fit
  const cx = minX + width / 2;
  const cy = minY + height / 2;
  const rx = Math.max(4, width / 2);
  const ry = Math.max(4, height / 2);
  let radialErrorSum = 0;
  for (const p of points) {
    const normR = Math.hypot((p.x - cx) / rx, (p.y - cy) / ry);
    radialErrorSum += Math.abs(normR - 1);
  }
  const meanRadialError = radialErrorSum / points.length;

  // Simplify with RDP (try adaptive epsilon for sharp corners vs curved circles)
  let simplified = rdpSimplify(points, Math.max(7, diag * 0.055));
  let vertices =
    simplified.length > 2 &&
    Math.hypot(
      simplified[0].x - simplified[simplified.length - 1].x,
      simplified[0].y - simplified[simplified.length - 1].y
    ) <
      diag * 0.28
      ? simplified.slice(0, -1)
      : simplified;

  // If RDP produced 5+ points for a polygon with sharp corners, simplify slightly coarser
  if (vertices.length > 4 && meanRadialError >= 0.16) {
    const coarser = rdpSimplify(points, Math.max(10, diag * 0.085));
    const trimmed =
      coarser.length > 2 &&
      Math.hypot(
        coarser[0].x - coarser[coarser.length - 1].x,
        coarser[0].y - coarser[coarser.length - 1].y
      ) <
        diag * 0.28
        ? coarser.slice(0, -1)
        : coarser;
    if (trimmed.length === 3 || trimmed.length === 4) {
      vertices = trimmed;
    }
  }

  // 1. Triangle Classification (Equilateral/Isosceles vs Right-Angle Left/Right/Top)
  if (vertices.length === 3) {
    const tri = sortPolygonVerticesCCW(vertices);
    // Recompute tight bounding box from the 3 vertices
    const tMinX = Math.min(tri[0].x, tri[1].x, tri[2].x);
    const tMaxX = Math.max(tri[0].x, tri[1].x, tri[2].x);
    const tMinY = Math.min(tri[0].y, tri[1].y, tri[2].y);
    const tMaxY = Math.max(tri[0].y, tri[1].y, tri[2].y);
    const tw = Math.max(12, tMaxX - tMinX);
    const th = Math.max(12, tMaxY - tMinY);

    // Check interior angles at each vertex to detect right-angle corner (90° ± 22°)
    let bestRightIdx = -1;
    let bestAbsDot = 1;
    for (let i = 0; i < 3; i++) {
      const prev = tri[(i + 2) % 3];
      const curr = tri[i];
      const next = tri[(i + 1) % 3];
      const u = normalizeVec(prev.x - curr.x, prev.y - curr.y);
      const v = normalizeVec(next.x - curr.x, next.y - curr.y);
      const absDot = Math.abs(u.x * v.x + u.y * v.y); // cos(90°) = 0
      if (absDot < 0.37 && absDot < bestAbsDot) {
        bestAbsDot = absDot;
        bestRightIdx = i;
      }
    }

    if (bestRightIdx !== -1) {
      const corner = tri[bestRightIdx];
      const isLeft = corner.x - tMinX < tMaxX - corner.x;
      const isBottom = tMaxY - corner.y < corner.y - tMinY;

      if (isBottom && isLeft) {
        return {
          type: 'triangle',
          x: tMinX,
          y: tMinY,
          width: tw,
          height: th,
          triangleVariant: 'right-left',
          label: 'Right Triangle (L)',
        };
      }
      if (isBottom && !isLeft) {
        return {
          type: 'triangle',
          x: tMinX,
          y: tMinY,
          width: tw,
          height: th,
          triangleVariant: 'right-right',
          label: 'Right Triangle (R)',
        };
      }
      if (!isBottom && isLeft) {
        // Top-left 90° corner
        return {
          type: 'triangle',
          x: tMinX,
          y: tMinY,
          width: tw,
          height: th,
          points: [
            { x: 0, y: 0 },
            { x: 1, y: 0 },
            { x: 0, y: 1 },
          ],
          label: 'Right Triangle (Top-L)',
        };
      }
      // Top-right 90° corner
      return {
        type: 'triangle',
        x: tMinX,
        y: tMinY,
        width: tw,
        height: th,
        points: [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
          { x: 1, y: 1 },
        ],
        label: 'Right Triangle (Top-R)',
      };
    }

    // Check if triangle is inverted (pointing downward) or sideways
    const sortedByY = [...tri].sort((a, b) => a.y - b.y);
    const apexIsBottom = sortedByY[1].y - sortedByY[0].y < sortedByY[2].y - sortedByY[1].y;
    if (apexIsBottom) {
      return {
        type: 'triangle',
        x: tMinX,
        y: tMinY,
        width: tw,
        height: th,
        points: [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
          { x: 0.5, y: 1 },
        ],
        label: 'Inverted Triangle',
      };
    }

    return {
      type: 'triangle',
      x: tMinX,
      y: tMinY,
      width: tw,
      height: th,
      triangleVariant: 'isosceles',
      label: 'Triangle',
    };
  }

  // 2. Circle / Ellipse Classification
  if (meanRadialError < 0.16 && vertices.length >= 5) {
    const isCircle = Math.abs(width - height) / Math.max(width, height) < 0.2;
    const size = isCircle ? (width + height) / 2 : width;
    return {
      type: 'ellipse',
      x: isCircle ? cx - size / 2 : minX,
      y: isCircle ? cy - size / 2 : minY,
      width: isCircle ? size : width,
      height: isCircle ? size : height,
      label: isCircle ? 'Circle' : 'Ellipse',
    };
  }

  // 3. Quadrilateral Classification: Diamond vs Parallelogram vs Rectangle / Square
  if (vertices.length === 4) {
    const quad = sortPolygonVerticesCCW(vertices);
    const qMinX = Math.min(...quad.map((v) => v.x));
    const qMaxX = Math.max(...quad.map((v) => v.x));
    const qMinY = Math.min(...quad.map((v) => v.y));
    const qMaxY = Math.max(...quad.map((v) => v.y));
    const qw = Math.max(12, qMaxX - qMinX);
    const qh = Math.max(12, qMaxY - qMinY);
    const qCx = (qMinX + qMaxX) / 2;
    const qCy = (qMinY + qMaxY) / 2;
    const qDiag = Math.hypot(qw, qh);

    // Check diamond first: vertices lie close to the 4 midpoints of bounding box edges
    let nearMidEdge = 0;
    for (const v of quad) {
      const distTop = Math.hypot(v.x - qCx, v.y - qMinY);
      const distBot = Math.hypot(v.x - qCx, v.y - qMaxY);
      const distLeft = Math.hypot(v.x - qMinX, v.y - qCy);
      const distRight = Math.hypot(v.x - qMaxX, v.y - qCy);
      if (Math.min(distTop, distBot, distLeft, distRight) < qDiag * 0.15) {
        nearMidEdge++;
      }
    }
    if (nearMidEdge >= 3) {
      return {
        type: 'diamond',
        x: qMinX,
        y: qMinY,
        width: qw,
        height: qh,
        label: 'Diamond',
      };
    }

    // Compute edge unit vectors around the CCW quadrilateral
    const edges = [0, 1, 2, 3].map((i) => {
      const a = quad[i];
      const b = quad[(i + 1) % 4];
      return normalizeVec(b.x - a.x, b.y - a.y);
    });

    // Opposite edges in CCW order should point in opposite directions (dot ≈ -1)
    const oppParallel02 = -(edges[0].x * edges[2].x + edges[0].y * edges[2].y);
    const oppParallel13 = -(edges[1].x * edges[3].x + edges[1].y * edges[3].y);
    const areOppositeEdgesParallel = oppParallel02 > 0.78 && oppParallel13 > 0.78;

    // Corner perpendicularity: |dot(e_i, e_{i+1})| ≈ 0 for 90° rectangles, > 0.20 for skewed parallelograms
    const cornerDots = [0, 1, 2, 3].map((i) => {
      const u = edges[i];
      const v = edges[(i + 1) % 4];
      return Math.abs(u.x * v.x + u.y * v.y);
    });
    const avgCornerDot = cornerDots.reduce((s, d) => s + d, 0) / 4;

    if (areOppositeEdgesParallel && avgCornerDot >= 0.2) {
      // It's a Parallelogram! Determine top-vs-bottom horizontal shift for skewRatio
      const sortedY = [...quad].sort((a, b) => a.y - b.y);
      const topPair = sortedY.slice(0, 2).sort((a, b) => a.x - b.x);
      const botPair = sortedY.slice(2, 4).sort((a, b) => a.x - b.x);
      const topMidX = (topPair[0].x + topPair[1].x) / 2;
      const botMidX = (botPair[0].x + botPair[1].x) / 2;
      const shiftX = topMidX - botMidX;
      // Offset in parallelogram is half of horizontal span difference or topLeft - botLeft
      const topLeftShift = topPair[0].x - botPair[0].x;
      const rawSkew = Math.abs(topLeftShift) > 4 ? topLeftShift / qw : shiftX / qw;
      const clampedSkew =
        Math.sign(rawSkew || 1) * Math.min(0.42, Math.max(0.16, Math.abs(rawSkew)));

      return {
        type: 'parallelogram',
        x: qMinX,
        y: qMinY,
        width: qw,
        height: qh,
        skewRatio: clampedSkew,
        label: 'Parallelogram',
      };
    }

    const isSquare = Math.abs(qw - qh) / Math.max(qw, qh) < 0.15;
    const sqSize = (qw + qh) / 2;
    return {
      type: 'rectangle',
      x: isSquare ? qCx - sqSize / 2 : qMinX,
      y: isSquare ? qCy - sqSize / 2 : qMinY,
      width: isSquare ? sqSize : qw,
      height: isSquare ? sqSize : qh,
      label: isSquare ? 'Square' : 'Rectangle',
    };
  }

  return null;
}

export function applyRecognizedShape(
  baseElement: WhiteboardElement,
  recognized: RecognizedShapeResult
): WhiteboardElement {
  return {
    ...baseElement,
    type: recognized.type,
    x: recognized.x,
    y: recognized.y,
    width: recognized.width,
    height: recognized.height,
    points: recognized.points,
    triangleVariant: recognized.triangleVariant ?? baseElement.triangleVariant,
    skewRatio: recognized.skewRatio ?? baseElement.skewRatio,
    version: baseElement.version + 1,
    updatedAt: Date.now(),
  };
}
