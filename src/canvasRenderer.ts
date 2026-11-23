import {
  RemoteCursorPayload,
  WhiteboardElement,
} from './types';
import { ForgeTheme } from './themes';
import {
  generatePolygonHachureLines,
  generateSketchyEllipsePoints,
  generateSketchyLineSegments,
  generateSketchyPolygonSegments,
  getArrowheadPoints,
  getCanvasFontCss,
  getDiamondVertices,
  getEllipsePolygon,
  getNormalizedBounds,
  getParallelogramVertices,
  getRectangleVertices,
  getStrokeDashArray,
  getTriangleVertices,
  sampleCurvedWirePoints,
  SketchSegment,
} from './sketchEngine';
import { buildCircuitGeometry, getCircuitTerminals } from './engineeringComponents';
import { GateLogicEvaluation, isLogicGateKind } from './digitalLogic';
import { extractWebpageSummary } from './webpageTemplates';
import { drawGraph2DOnCanvas } from './math/Graph2DEngine';
import { draw3DSurfaceIsometricFallback, drawContourPlot2D } from './math/Graph3DEngine';
import { formatNum } from './math/MatrixEngine';
import { canonicalToPrettyUnicode } from './math/SymbolConverter';

const imageCache = new Map<string, HTMLImageElement>();

export function getCachedImage(dataUrl: string, onLoad?: () => void): HTMLImageElement | null {
  const existing = imageCache.get(dataUrl);
  if (existing) {
    return existing.complete && existing.naturalWidth > 0 ? existing : null;
  }
  const img = new Image();
  img.onload = () => {
    if (onLoad) onLoad();
  };
  img.src = dataUrl;
  imageCache.set(dataUrl, img);
  return null;
}

function traceSketchSegments(ctx: CanvasRenderingContext2D, segs: SketchSegment[]) {
  ctx.beginPath();
  for (const seg of segs) {
    ctx.moveTo(seg.start.x, seg.start.y);
    ctx.quadraticCurveTo(seg.cp.x, seg.cp.y, seg.end.x, seg.end.y);
  }
  ctx.stroke();
}

export function drawElementOnContext(
  ctx: CanvasRenderingContext2D,
  el: WhiteboardElement,
  theme: ForgeTheme,
  options?: {
    showTerminals?: boolean;
    onImageLoad?: () => void;
    liveReadouts?: Record<string, string>;
    wireVoltages?: Record<string, number>;
    croWaveforms?: Record<string, { samples: number[]; connected: boolean }>;
    logicResults?: Record<string, GateLogicEvaluation>;
    simActive?: boolean;
    selectedCodeIds?: Set<string>;
    liveWebpageOverlay?: boolean;
  }
): void {
  if (el.isDeleted) return;
  const b = getNormalizedBounds(el);

  ctx.save();
  ctx.globalAlpha = Math.max(0.05, Math.min(1, el.opacity / 100));

  if (el.angle && Math.abs(el.angle) > 0.001) {
    const cx = b.x + b.width / 2;
    const cy = b.y + b.height / 2;
    ctx.translate(cx, cy);
    ctx.rotate(el.angle);
    ctx.translate(-cx, -cy);
  }

  ctx.strokeStyle = el.strokeColor;
  ctx.fillStyle = el.strokeColor;
  ctx.lineWidth = el.strokeWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.setLineDash(getStrokeDashArray(el.strokeStyle, el.strokeWidth));

  if (el.type === 'frame') {
    ctx.save();
    ctx.strokeStyle = el.strokeColor;
    ctx.globalAlpha *= 0.55;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([7, 5]);
    ctx.beginPath();
    ctx.roundRect(b.x, b.y, b.width, b.height, 12);
    ctx.stroke();
    ctx.restore();

    const title = `Frame ${el.frameIndex || 1}${el.frameTitle ? ` — ${el.frameTitle}` : ''}`;
    ctx.save();
    ctx.setLineDash([]);
    ctx.font = '600 13px "Plus Jakarta Sans", sans-serif';
    ctx.fillStyle = theme.mutedColor;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText(title, b.x + 6, b.y - 8);
    ctx.restore();
    ctx.restore();
    return;
  }

  if (
    el.type === 'rectangle' ||
    el.type === 'diamond' ||
    el.type === 'triangle' ||
    el.type === 'parallelogram'
  ) {
    const poly =
      el.type === 'rectangle'
        ? getRectangleVertices(b.x, b.y, b.width, b.height)
        : el.type === 'diamond'
        ? getDiamondVertices(b.x, b.y, b.width, b.height)
        : el.type === 'parallelogram'
        ? getParallelogramVertices(b.x, b.y, b.width, b.height, el.skewRatio ?? 0.24, el.points)
        : getTriangleVertices(b.x, b.y, b.width, b.height, el.triangleVariant, el.points);

    if (el.backgroundColor !== 'transparent' && el.fillStyle !== 'none') {
      ctx.save();
      ctx.setLineDash([]);
      if (el.fillStyle === 'solid') {
        ctx.fillStyle = el.backgroundColor;
        ctx.beginPath();
        poly.forEach((pt, idx) => (idx === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y)));
        ctx.closePath();
        ctx.fill();
      } else {
        const hachure = generatePolygonHachureLines(
          poly,
          -42,
          Math.max(8, el.strokeWidth * 4.5),
          el.sloppiness,
          el.seed,
          el.fillStyle === 'cross-hatch'
        );
        ctx.strokeStyle = el.backgroundColor;
        ctx.lineWidth = Math.max(1, el.strokeWidth * 0.72);
        traceSketchSegments(ctx, hachure);
      }
      ctx.restore();
    }

    const segs = generateSketchyPolygonSegments(poly, el.sloppiness, el.seed, true);
    traceSketchSegments(ctx, segs);
  } else if (el.type === 'ellipse') {
    const cx = b.x + b.width / 2;
    const cy = b.y + b.height / 2;
    const rx = Math.max(2, b.width / 2);
    const ry = Math.max(2, b.height / 2);

    if (el.backgroundColor !== 'transparent' && el.fillStyle !== 'none') {
      ctx.save();
      ctx.setLineDash([]);
      if (el.fillStyle === 'solid') {
        ctx.fillStyle = el.backgroundColor;
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        ctx.fill();
      } else {
        const poly = getEllipsePolygon(cx, cy, rx, ry);
        const hachure = generatePolygonHachureLines(
          poly,
          -42,
          Math.max(8, el.strokeWidth * 4.5),
          el.sloppiness,
          el.seed,
          el.fillStyle === 'cross-hatch'
        );
        ctx.strokeStyle = el.backgroundColor;
        ctx.lineWidth = Math.max(1, el.strokeWidth * 0.72);
        traceSketchSegments(ctx, hachure);
      }
      ctx.restore();
    }

    const curves = generateSketchyEllipsePoints(cx, cy, rx, ry, el.sloppiness, el.seed);
    for (const curve of curves) {
      ctx.beginPath();
      curve.forEach((pt, idx) => (idx === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y)));
      ctx.stroke();
    }
  } else if (el.type === 'wire' && el.points && el.points.length >= 2) {
    const worldPts = el.points.map((p) => ({ x: el.x + p.x, y: el.y + p.y }));
    const liveV = options?.wireVoltages?.[el.id];
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(2, el.strokeWidth);
    ctx.strokeStyle = getSimulatedWireColor(liveV, el.strokeColor);

    ctx.beginPath();
    if (el.wireRouting === 'curved' && worldPts.length >= 3) {
      const curvePts = sampleCurvedWirePoints(worldPts, 18);
      ctx.moveTo(curvePts[0].x, curvePts[0].y);
      for (let i = 1; i < curvePts.length; i++) {
        ctx.lineTo(curvePts[i].x, curvePts[i].y);
      }
    } else if (el.wireRouting === 'straight') {
      ctx.moveTo(worldPts[0].x, worldPts[0].y);
      for (let i = 1; i < worldPts.length; i++) {
        ctx.lineTo(worldPts[i].x, worldPts[i].y);
      }
    } else {
      // Orthogonal polyline with subtle 5px corner fillets
      ctx.moveTo(worldPts[0].x, worldPts[0].y);
      for (let i = 1; i < worldPts.length - 1; i++) {
        const prev = worldPts[i - 1];
        const curr = worldPts[i];
        const next = worldPts[i + 1];
        const d1 = Math.hypot(curr.x - prev.x, curr.y - prev.y);
        const d2 = Math.hypot(next.x - curr.x, next.y - curr.y);
        const r = Math.min(5, d1 * 0.35, d2 * 0.35);
        if (r > 0.5) {
          const ax = curr.x - ((curr.x - prev.x) / d1) * r;
          const ay = curr.y - ((curr.y - prev.y) / d1) * r;
          const bx = curr.x + ((next.x - curr.x) / d2) * r;
          const by = curr.y + ((next.y - curr.y) / d2) * r;
          ctx.lineTo(ax, ay);
          ctx.quadraticCurveTo(curr.x, curr.y, bx, by);
        } else {
          ctx.lineTo(curr.x, curr.y);
        }
      }
      ctx.lineTo(worldPts[worldPts.length - 1].x, worldPts[worldPts.length - 1].y);
    }
    const lastPt = worldPts[worldPts.length - 1];
    ctx.stroke();

    // Terminal connector pins at ends
    ctx.fillStyle = ctx.strokeStyle;
    for (const endPt of [worldPts[0], lastPt]) {
      ctx.beginPath();
      ctx.arc(endPt.x, endPt.y, Math.max(2.4, el.strokeWidth * 1.15), 0, Math.PI * 2);
      ctx.fill();
    }

    if (el.text) {
      const midIdx = Math.floor(worldPts.length / 2);
      const pA = worldPts[Math.max(0, midIdx - 1)];
      const pB = worldPts[Math.min(worldPts.length - 1, midIdx)];
      const mx = (pA.x + pB.x) / 2;
      const my = (pA.y + pB.y) / 2;
      ctx.setLineDash([]);
      ctx.font = `600 ${Math.max(11, el.fontSize - 5)}px "JetBrains Mono", monospace`;
      const metrics = ctx.measureText(el.text);
      const padX = 6;
      const boxH = 18;
      ctx.fillStyle = theme.canvasBg;
      ctx.fillRect(mx - metrics.width / 2 - padX, my - boxH / 2, metrics.width + padX * 2, boxH);
      ctx.fillStyle = el.strokeColor;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(el.text, mx, my);
    }
    ctx.restore();
    ctx.restore();
    return;
  } else if ((el.type === 'line' || el.type === 'arrow') && el.points && el.points.length >= 2) {
    const worldPts = el.points.map((p) => ({ x: el.x + p.x, y: el.y + p.y }));
    const liveV = options?.wireVoltages?.[el.id];
    if (el.type === 'line' && typeof liveV === 'number') {
      ctx.strokeStyle = getSimulatedWireColor(liveV, el.strokeColor);
    }
    const segs: SketchSegment[] = [];
    for (let i = 0; i < worldPts.length - 1; i++) {
      segs.push(
        ...generateSketchyLineSegments(worldPts[i], worldPts[i + 1], el.sloppiness, el.seed + i * 53)
      );
    }
    traceSketchSegments(ctx, segs);

    if (el.type === 'arrow' && el.endArrowhead !== false) {
      const tip = worldPts[worldPts.length - 1];
      const prev = worldPts[worldPts.length - 2];
      const [a1, a2] = getArrowheadPoints(tip, prev, 10 + el.strokeWidth * 2);
      ctx.save();
      ctx.setLineDash([]);
      traceSketchSegments(ctx, [
        ...generateSketchyLineSegments(tip, a1, el.sloppiness, el.seed + 301),
        ...generateSketchyLineSegments(tip, a2, el.sloppiness, el.seed + 302),
      ]);
      ctx.restore();
    }
    if (el.type === 'arrow' && el.startArrowhead) {
      const tip = worldPts[0];
      const next = worldPts[1];
      const [a1, a2] = getArrowheadPoints(tip, next, 10 + el.strokeWidth * 2);
      ctx.save();
      ctx.setLineDash([]);
      traceSketchSegments(ctx, [
        ...generateSketchyLineSegments(tip, a1, el.sloppiness, el.seed + 303),
        ...generateSketchyLineSegments(tip, a2, el.sloppiness, el.seed + 304),
      ]);
      ctx.restore();
    }

    if (el.text) {
      const midIdx = Math.floor(worldPts.length / 2);
      const pA = worldPts[Math.max(0, midIdx - 1)];
      const pB = worldPts[Math.min(worldPts.length - 1, midIdx)];
      const mx = (pA.x + pB.x) / 2;
      const my = (pA.y + pB.y) / 2;
      ctx.save();
      ctx.setLineDash([]);
      ctx.font = getCanvasFontCss(el.fontFamily, el.fontSize);
      const metrics = ctx.measureText(el.text);
      const padX = 8;
      const boxH = el.fontSize + 8;
      ctx.fillStyle = theme.canvasBg;
      ctx.fillRect(mx - metrics.width / 2 - padX, my - boxH / 2, metrics.width + padX * 2, boxH);
      ctx.fillStyle = el.strokeColor;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(el.text, mx, my);
      ctx.restore();
    }
    ctx.restore();
    return;
  } else if (el.type === 'freedraw' && el.points && el.points.length >= 2) {
    ctx.beginPath();
    ctx.moveTo(el.x + el.points[0].x, el.y + el.points[0].y);
    for (let i = 1; i < el.points.length - 1; i++) {
      const xc = el.x + (el.points[i].x + el.points[i + 1].x) / 2;
      const yc = el.y + (el.points[i].y + el.points[i + 1].y) / 2;
      ctx.quadraticCurveTo(el.x + el.points[i].x, el.y + el.points[i].y, xc, yc);
    }
    const last = el.points[el.points.length - 1];
    ctx.lineTo(el.x + last.x, el.y + last.y);
    ctx.stroke();
  } else if (el.type === 'circuit') {
    const geom = buildCircuitGeometry(el);

    if (geom.screenRect) {
      ctx.save();
      ctx.fillStyle = '#06121a';
      ctx.fillRect(geom.screenRect.x, geom.screenRect.y, geom.screenRect.width, geom.screenRect.height);
      ctx.strokeStyle = 'rgba(52, 211, 153, 0.28)';
      ctx.lineWidth = 0.8;
      ctx.setLineDash([]);
      const midX = geom.screenRect.x + geom.screenRect.width / 2;
      const midY = geom.screenRect.y + geom.screenRect.height / 2;
      ctx.beginPath();
      ctx.moveTo(geom.screenRect.x, midY);
      ctx.lineTo(geom.screenRect.x + geom.screenRect.width, midY);
      ctx.moveTo(midX, geom.screenRect.y);
      ctx.lineTo(midX, geom.screenRect.y + geom.screenRect.height);
      ctx.stroke();
      ctx.restore();
    }

    geom.polylines.forEach((poly, idx) => {
      const segs = generateSketchyPolygonSegments(poly, el.sloppiness, el.seed + idx * 71, false);
      traceSketchSegments(ctx, segs);
    });

    if (options?.simActive && geom.screenRect && el.circuitKind === 'oscilloscope') {
      const sr = geom.screenRect;
      const pad = 2;
      const ix = sr.x + pad;
      const iy = sr.y + pad;
      const iw = Math.max(4, sr.width - pad * 2);
      const ih = Math.max(4, sr.height - pad * 2);
      const midY = iy + ih / 2;
      const midX = ix + iw / 2;
      const croInfo = options.croWaveforms?.[el.id];

      ctx.save();
      ctx.setLineDash([]);
      ctx.fillStyle = '#06121a';
      ctx.fillRect(ix, iy, iw, ih);

      ctx.strokeStyle = 'rgba(52, 211, 153, 0.25)';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(ix, midY);
      ctx.lineTo(ix + iw, midY);
      ctx.moveTo(midX, iy);
      ctx.lineTo(midX, iy + ih);
      ctx.stroke();

      if (croInfo?.connected && croInfo.samples.length > 1) {
        const samples = croInfo.samples;
        const maxAbs = Math.max(0.5, ...samples.map((v) => Math.abs(v)));
        ctx.strokeStyle = '#34d399';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        for (let i = 0; i < samples.length; i++) {
          const px = ix + 2 + (i / (samples.length - 1)) * Math.max(1, iw - 4);
          const py = midY - (samples[i] / maxAbs) * (ih * 0.38);
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
      } else {
        ctx.strokeStyle = 'rgba(52, 211, 153, 0.45)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(ix + 2, midY);
        ctx.lineTo(ix + iw - 2, midY);
        ctx.stroke();
      }
      ctx.restore();
    }

    geom.circles.forEach((c, idx) => {
      const curves = generateSketchyEllipsePoints(
        c.cx,
        c.cy,
        c.r,
        c.r,
        el.sloppiness,
        el.seed + 900 + idx
      );
      for (const curve of curves) {
        ctx.beginPath();
        curve.forEach((pt, i) => (i === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y)));
        ctx.stroke();
      }
    });

    if (geom.dialArc) {
      const { cx, cy, r } = geom.dialArc;
      const liveStr = options?.liveReadouts?.[el.id] || '';
      const numericMatch = liveStr.match(/([-+]?\d*\.?\d+)/);
      const rawNum = numericMatch ? parseFloat(numericMatch[1]) : 0;
      const clampedRatio = liveStr
        ? Math.max(-1, Math.min(1, rawNum / (geom.dialArc.kind === 'voltmeter' ? 15 : 250)))
        : 0;
      const needleAngle = -Math.PI / 2 + clampedRatio * (Math.PI * 0.38);

      ctx.save();
      ctx.setLineDash([]);
      ctx.strokeStyle = el.strokeColor;
      ctx.lineWidth = Math.max(1.2, el.strokeWidth * 0.65);
      ctx.beginPath();
      ctx.arc(cx, cy, r, Math.PI * 1.12, Math.PI * 1.88);
      ctx.stroke();

      // Analog scale ticks
      for (let t = 0; t <= 4; t++) {
        const ang = Math.PI * 1.12 + (t / 4) * (Math.PI * 0.76);
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(ang) * (r - 3), cy + Math.sin(ang) * (r - 3));
        ctx.lineTo(cx + Math.cos(ang) * r, cy + Math.sin(ang) * r);
        ctx.stroke();
      }

      // Live deflecting needle
      ctx.strokeStyle = liveStr ? '#10b981' : '#ef4444';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(
        cx + Math.cos(needleAngle) * (r * 0.85),
        cy + Math.sin(needleAngle) * (r * 0.85)
      );
      ctx.stroke();

      ctx.fillStyle = el.strokeColor;
      ctx.beginPath();
      ctx.arc(cx, cy, 2.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    if (geom.probes) {
      ctx.save();
      ctx.setLineDash([]);
      for (const probe of geom.probes) {
        ctx.strokeStyle = probe.color;
        ctx.lineWidth = 3.2;
        ctx.beginPath();
        ctx.moveTo(probe.leadFrom.x, probe.leadFrom.y);
        ctx.lineTo(probe.leadTo.x, probe.leadTo.y);
        ctx.stroke();

        ctx.fillStyle = probe.color;
        ctx.beginPath();
        ctx.arc(probe.tip.x, probe.tip.y, 3.2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    ctx.save();
    ctx.setLineDash([]);
    ctx.fillStyle = el.strokeColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    geom.labels.forEach((lbl) => {
      ctx.font = `600 ${lbl.size}px "JetBrains Mono", monospace`;
      ctx.fillText(lbl.text, lbl.x, lbl.y);
    });
    const liveVal = options?.liveReadouts?.[el.id];
    const isInstrumentBox =
      el.circuitKind === 'voltmeter' ||
      el.circuitKind === 'ammeter' ||
      el.circuitKind === 'oscilloscope';
    const rawVal = (el.componentValue || '').trim();
    const isRedundantDefault =
      isInstrumentBox && /^(V|A|CH1|CRO)$/i.test(rawVal);

    const displayLabel = liveVal
      ? liveVal
      : el.circuitKind === 'function-generator'
      ? `${el.componentValue || '10V'} · ${el.frequencyHz || 60}Hz · ${(el.waveformType || 'sine').toUpperCase()}`
      : el.circuitKind === 'switch'
      ? el.switchClosed
        ? 'CLOSED'
        : 'OPEN'
      : el.circuitKind === 'ac-source' && el.frequencyHz
      ? `${el.componentValue || '10V'} · ${el.frequencyHz}Hz`
      : isRedundantDefault
      ? ''
      : el.componentValue;

    if (displayLabel) {
      if (liveVal) {
        ctx.fillStyle = liveVal === 'No Probe' ? '#f59e0b' : '#10b981';
        ctx.font = '600 13px "JetBrains Mono", monospace';
      } else if (el.circuitKind === 'switch') {
        ctx.fillStyle = el.switchClosed ? '#10b981' : '#f59e0b';
        ctx.font = '600 12px "JetBrains Mono", monospace';
      } else if (el.circuitKind === 'function-generator') {
        ctx.fillStyle = el.strokeColor;
        ctx.font = '600 12px "JetBrains Mono", monospace';
      } else {
        ctx.font = getCanvasFontCss(el.fontFamily, Math.max(15, el.fontSize - 3));
      }
      if (el.circuitKind === 'ac-source' || el.circuitKind === 'dc-source') {
        ctx.textAlign = 'right';
        ctx.fillText(displayLabel, b.x - 6, b.y + b.height / 2);
      } else {
        ctx.fillText(displayLabel, b.x + b.width / 2, b.y + b.height + 16);
      }
    }

    if (isLogicGateKind(el.circuitKind)) {
      const gateEval = options?.logicResults?.[el.id];
      const inA = gateEval?.inputALabel ?? (el.logicInputA || '0');
      const inB = gateEval?.inputBLabel ?? (el.logicInputB || '0');
      const isNot = el.circuitKind === 'gate-not';
      ctx.save();
      ctx.font = '600 12px "JetBrains Mono", monospace';
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'right';
      ctx.fillStyle = el.strokeColor;
      ctx.fillText(inA, b.x - 6, b.y + b.height * (isNot ? 0.5 : 0.3));
      if (!isNot) {
        ctx.fillText(inB, b.x - 6, b.y + b.height * 0.7);
      }

      if (gateEval) {
        const outText =
          gateEval.outputBinary !== null
            ? `Y=${gateEval.outputBinary}`
            : `Y=${gateEval.outputExpr}`;
        ctx.textAlign = 'left';
        ctx.fillStyle =
          gateEval.outputBinary === 1
            ? '#10b981'
            : gateEval.outputBinary === 0
            ? theme.mutedColor
            : theme.accentColor;
        ctx.fillText(outText, b.x + b.width + 6, b.y + b.height * 0.5);
      }
      ctx.restore();
    }

    if (options?.showTerminals) {
      const pins = getCircuitTerminals(el);
      pins.forEach((pin) => {
        const px = b.x + pin.nx * b.width;
        const py = b.y + pin.ny * b.height;
        ctx.beginPath();
        ctx.arc(px, py, 4, 0, Math.PI * 2);
        ctx.fillStyle = theme.accentColor;
        ctx.fill();
      });
    }
    ctx.restore();
  } else if (el.type === 'webpage') {
    const isDark = theme.mode === 'dark';
    const hasCode = Boolean(
      (el.htmlCode && el.htmlCode.trim().length > 0) ||
        (el.cssCode && el.cssCode.trim().length > 0) ||
        (el.jsCode && el.jsCode.trim().length > 0)
    );
    const hasLiveOverlay = Boolean(options?.liveWebpageOverlay && hasCode);
    const cardBg = hasLiveOverlay ? '#ffffff' : isDark ? '#0f172a' : '#ffffff';
    const headerBg = isDark ? '#1e293b' : '#f1f5f9';
    const titleInk = isDark ? '#f8fafc' : '#0f172a';
    const mutedInk = isDark ? '#94a3b8' : '#64748b';
    const borderInk = theme.accentColor;
    const headerH = Math.min(30, Math.max(24, b.height * 0.16));

    ctx.save();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.roundRect(b.x, b.y, b.width, b.height, 12);
    ctx.fillStyle = cardBg;
    ctx.fill();
    ctx.lineWidth = Math.max(1.5, el.strokeWidth * 0.8);
    ctx.strokeStyle = borderInk;
    ctx.stroke();

    // Clip inner browser chrome cleanly to rounded bounds
    ctx.clip();

    // Top browser bar
    ctx.fillStyle = headerBg;
    ctx.fillRect(b.x, b.y, b.width, headerH);
    ctx.strokeStyle = isDark ? 'rgba(148, 163, 184, 0.2)' : 'rgba(15, 23, 42, 0.12)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(b.x, b.y + headerH);
    ctx.lineTo(b.x + b.width, b.y + headerH);
    ctx.stroke();

    // Window dots
    const dotY = b.y + headerH / 2;
    ['#ef4444', '#f59e0b', '#10b981'].forEach((col, i) => {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(b.x + 14 + i * 12, dotY, 3.6, 0, Math.PI * 2);
      ctx.fill();
    });

    // Webpage filename title
    ctx.font = '600 11px "JetBrains Mono", monospace';
    ctx.fillStyle = titleInk;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const pageTitle = (el.webpageTitle || 'index.html').slice(0, 26);
    ctx.fillText(pageTitle, b.x + 54, dotY);

    if (!hasCode) {
      if (b.width >= 220) {
        ctx.textAlign = 'right';
        ctx.fillStyle = mutedInk;
        ctx.font = '500 10px "JetBrains Mono", monospace';
        ctx.fillText('HTML · CSS · JS', b.x + b.width - 12, dotY);
      }

      const cx = b.x + b.width / 2;
      const cy = b.y + headerH + (b.height - headerH) / 2;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = titleInk;
      ctx.font = '600 13px "Plus Jakarta Sans", sans-serif';
      ctx.fillText('Click to write HTML, CSS & JS', cx, cy - 9, Math.max(80, b.width - 28));
      ctx.fillStyle = mutedInk;
      ctx.font = '500 11px "JetBrains Mono", monospace';
      ctx.fillText('No code yet', cx, cy + 12, Math.max(80, b.width - 28));
    } else if (!hasLiveOverlay) {
      if (b.width >= 240) {
        ctx.textAlign = 'right';
        ctx.fillStyle = theme.accentColor;
        ctx.font = '600 10px "JetBrains Mono", monospace';
        ctx.fillText('HTML · CSS · JS', b.x + b.width - 12, dotY);
      }

      const summary = extractWebpageSummary(el.htmlCode);
      const padX = 16;
      let curY = b.y + headerH + 18;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillStyle = titleInk;
      ctx.font = '700 15px "Plus Jakarta Sans", sans-serif';
      ctx.fillText(summary.heading, b.x + padX, curY, Math.max(40, b.width - padX * 2));
      curY += 26;

      if (summary.snippet && b.height >= 120) {
        ctx.fillStyle = mutedInk;
        ctx.font = '400 12px "Plus Jakarta Sans", sans-serif';
        const maxLineW = Math.max(60, b.width - padX * 2);
        const words = summary.snippet.split(' ');
        let line = '';
        let linesDrawn = 0;
        for (const word of words) {
          const test = line ? `${line} ${word}` : word;
          if (ctx.measureText(test).width > maxLineW && line) {
            ctx.fillText(line, b.x + padX, curY);
            curY += 18;
            linesDrawn += 1;
            line = word;
            if (linesDrawn >= 3 || curY > b.y + b.height - 46) break;
          } else {
            line = test;
          }
        }
        if (line && linesDrawn < 3 && curY <= b.y + b.height - 46) {
          ctx.fillText(line, b.x + padX, curY);
        }
      }
    }

    ctx.restore();
  } else if (el.type === 'math-equation') {
    const isDark = theme.mode === 'dark';
    ctx.save();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.roundRect(b.x, b.y, b.width, b.height, 12);
    ctx.fillStyle = isDark ? '#0f172a' : '#ffffff';
    ctx.fill();
    ctx.lineWidth = Math.max(1.2, el.strokeWidth * 0.8);
    ctx.strokeStyle = theme.borderColor;
    ctx.stroke();
    ctx.clip();

    const prettyExpr = canonicalToPrettyUnicode(el.mathRaw || 'f(x)');
    const eqFont = Math.max(10, Math.min(96, Math.round((el.fontSize || 16) * 0.92)));
    const resFont = Math.max(9, Math.min(80, Math.round(eqFont * 0.8)));
    ctx.fillStyle = isDark ? '#f8fafc' : '#0f172a';
    ctx.font = `600 ${eqFont}px "Plus Jakarta Sans", sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const exprY = el.mathResult ? b.y + b.height * 0.34 : b.y + b.height * 0.5;
    ctx.fillText(prettyExpr, b.x + 12, exprY, Math.max(40, b.width - 24));

    if (el.mathResult) {
      ctx.fillStyle = isDark ? 'rgba(52, 211, 153, 0.14)' : 'rgba(16, 185, 129, 0.12)';
      ctx.fillRect(b.x, b.y + b.height * 0.58, b.width, b.height * 0.42);
      ctx.fillStyle = theme.accentColor;
      ctx.font = `600 ${resFont}px "JetBrains Mono", monospace`;
      const label = `${el.mathOperation ? el.mathOperation + ': ' : '= '}${el.mathResult}`;
      ctx.fillText(label, b.x + 12, b.y + b.height * 0.79, Math.max(40, b.width - 24));
    }
    ctx.restore();
  } else if (el.type === 'math-matrix') {
    const isDark = theme.mode === 'dark';
    const mat = el.matrixData || [[1, 0], [0, 1]];
    ctx.save();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.roundRect(b.x, b.y, b.width, b.height, 12);
    ctx.fillStyle = isDark ? '#0f172a' : '#ffffff';
    ctx.fill();
    ctx.lineWidth = Math.max(1.2, el.strokeWidth * 0.8);
    ctx.strokeStyle = theme.borderColor;
    ctx.stroke();
    ctx.clip();

    const cellFont = Math.max(10, Math.min(96, Math.round((el.fontSize || 16) * 0.85)));
    const labelFont = Math.max(8, Math.min(20, Math.round(cellFont * 0.62)));
    const headerOffset = Math.max(22, labelFont + 12);

    ctx.fillStyle = theme.mutedColor;
    ctx.font = `600 ${labelFont}px "JetBrains Mono", monospace`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      `${el.matrixName || 'A'} (${mat.length}×${mat[0]?.length || 0})`,
      b.x + 10,
      b.y + headerOffset * 0.52
    );

    const rows = mat.length;
    const cols = mat[0]?.length || 1;
    const cellW = Math.max(14, (b.width - 36) / cols);
    const cellH = Math.max(14, (b.height - headerOffset - 12) / rows);
    const gridW = cols * cellW;
    const gridH = rows * cellH;
    const gx = b.x + (b.width - gridW) / 2;
    const gy = b.y + headerOffset + (b.height - headerOffset - 6 - gridH) / 2;

    // Matrix brackets
    ctx.strokeStyle = isDark ? '#e2e8f0' : '#0f172a';
    ctx.lineWidth = Math.max(1.4, cellFont * 0.09);
    ctx.beginPath();
    ctx.moveTo(gx - 2, gy);
    ctx.lineTo(gx - 8, gy);
    ctx.lineTo(gx - 8, gy + gridH);
    ctx.lineTo(gx - 2, gy + gridH);
    ctx.moveTo(gx + gridW + 2, gy);
    ctx.lineTo(gx + gridW + 8, gy);
    ctx.lineTo(gx + gridW + 8, gy + gridH);
    ctx.lineTo(gx + gridW + 2, gy + gridH);
    ctx.stroke();

    ctx.fillStyle = isDark ? '#f8fafc' : '#0f172a';
    ctx.font = `500 ${cellFont}px "JetBrains Mono", monospace`;
    ctx.textAlign = 'center';
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        ctx.fillText(
          formatNum(mat[r][c], 2),
          gx + c * cellW + cellW / 2,
          gy + r * cellH + cellH / 2
        );
      }
    }
    ctx.restore();
  } else if (el.type === 'math-graph-2d' && el.graph2DConfig) {
    const isDark = theme.mode === 'dark';
    ctx.save();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.roundRect(b.x, b.y, b.width, b.height, 12);
    ctx.fillStyle = isDark ? '#0f172a' : '#ffffff';
    ctx.fill();
    ctx.lineWidth = Math.max(1.2, el.strokeWidth * 0.8);
    ctx.strokeStyle = theme.borderColor;
    ctx.stroke();
    ctx.clip();

    drawGraph2DOnCanvas(ctx, b.x, b.y + 26, b.width, Math.max(60, b.height - 48), el.graph2DConfig, theme);
    ctx.fillStyle = isDark ? '#1e293b' : '#f1f5f9';
    ctx.fillRect(b.x, b.y, b.width, 26);
    ctx.fillStyle = isDark ? '#f8fafc' : '#0f172a';
    ctx.font = '600 11px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('2D Mathematical Plot', b.x + 10, b.y + 13);
    ctx.restore();
  } else if (el.type === 'math-graph-3d' && el.graph3DConfig) {
    const isDark = theme.mode === 'dark';
    ctx.save();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.roundRect(b.x, b.y, b.width, b.height, 12);
    ctx.fillStyle = isDark ? '#0f172a' : '#ffffff';
    ctx.fill();
    ctx.lineWidth = Math.max(1.2, el.strokeWidth * 0.8);
    ctx.strokeStyle = theme.borderColor;
    ctx.stroke();
    ctx.clip();

    const headerH = 26;
    const innerY = b.y + headerH + 6;
    const innerH = Math.max(80, b.height - headerH - 12);
    if (el.graph3DConfig.showContour2D) {
      const surfH = innerH * 0.56;
      const contH = innerH * 0.4;
      draw3DSurfaceIsometricFallback(ctx, b.x + 8, innerY, b.width - 16, surfH, el.graph3DConfig, isDark);
      drawContourPlot2D(ctx, b.x + 8, innerY + surfH + 4, b.width - 16, contH, el.graph3DConfig, isDark);
    } else {
      draw3DSurfaceIsometricFallback(ctx, b.x + 8, innerY, b.width - 16, innerH, el.graph3DConfig, isDark);
    }
    ctx.fillStyle = isDark ? '#1e293b' : '#f1f5f9';
    ctx.fillRect(b.x, b.y, b.width, headerH);
    ctx.fillStyle = isDark ? '#f8fafc' : '#0f172a';
    ctx.font = '600 11px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`f(x,y) = ${el.graph3DConfig.expression}`, b.x + 10, b.y + 13, Math.max(40, b.width - 20));
    ctx.restore();
  } else if (el.type === 'image' && el.imageDataUrl) {
    const img = getCachedImage(el.imageDataUrl, options?.onImageLoad);
    if (img) {
      ctx.drawImage(img, b.x, b.y, b.width, b.height);
    } else {
      ctx.save();
      ctx.strokeStyle = theme.mutedColor;
      ctx.strokeRect(b.x, b.y, b.width, b.height);
      ctx.restore();
    }
  }

  if (el.text) {
    ctx.save();
    ctx.setLineDash([]);
    const isCodeSelected = el.type === 'text' && Boolean(options?.selectedCodeIds?.has(el.id));
    if (isCodeSelected) {
      const codeFontSize = Math.max(13, Math.round(el.fontSize * 0.85));
      const lines = el.text.split('\n');
      const lineH = codeFontSize * 1.38;
      ctx.font = `500 ${codeFontSize}px "JetBrains Mono", ui-monospace, monospace`;
      const maxLineW = Math.max(120, ...lines.map((l) => ctx.measureText(l).width));
      const boxW = Math.max(b.width, maxLineW + 24);
      const boxH = Math.max(b.height, lines.length * lineH + 14);
      ctx.fillStyle = theme.mode === 'dark' ? 'rgba(15, 23, 42, 0.86)' : 'rgba(241, 245, 249, 0.94)';
      ctx.beginPath();
      ctx.roundRect(b.x - 4, b.y - 2, boxW + 8, boxH + 4, 8);
      ctx.fill();
      ctx.fillStyle = theme.accentColor;
      ctx.fillRect(b.x - 4, b.y + 4, 3, boxH - 8);
      ctx.fillStyle = theme.mode === 'dark' ? '#e2e8f0' : '#0f172a';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      lines.forEach((line, idx) => {
        ctx.fillText(line, b.x + 8, b.y + 5 + idx * lineH);
      });
    } else {
      ctx.font = getCanvasFontCss(el.fontFamily, el.fontSize);
      ctx.fillStyle = el.strokeColor;
      ctx.textAlign = el.type === 'text' ? 'left' : 'center';
      ctx.textBaseline = el.type === 'text' ? 'top' : 'middle';
      const lines = el.text.split('\n');
      const lineH = el.fontSize * 1.24;
      if (el.type === 'text') {
        lines.forEach((line, idx) => {
          ctx.fillText(line, b.x + 4, b.y + 4 + idx * lineH);
        });
      } else {
        const cx = b.x + b.width / 2;
        const cy = b.y + b.height / 2;
        const startY = cy - ((lines.length - 1) * lineH) / 2;
        lines.forEach((line, idx) => {
          ctx.fillText(line, cx, startY + idx * lineH);
        });
      }
    }
    ctx.restore();
  }

  ctx.restore();
}

export function drawRemoteCursor(
  ctx: CanvasRenderingContext2D,
  cursor: RemoteCursorPayload,
  zoom: number
): void {
  ctx.save();
  ctx.translate(cursor.x, cursor.y);
  const invScale = 1 / Math.max(0.5, zoom);
  ctx.scale(invScale, invScale);

  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, 16);
  ctx.lineTo(5, 12);
  ctx.lineTo(12, 11);
  ctx.closePath();
  ctx.fillStyle = cursor.color;
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = '#ffffff';
  ctx.stroke();

  ctx.font = '600 11px "Plus Jakarta Sans", sans-serif';
  const tw = ctx.measureText(cursor.name).width;
  ctx.fillStyle = cursor.color;
  ctx.beginPath();
  ctx.roundRect(10, 14, tw + 12, 20, 6);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.textBaseline = 'middle';
  ctx.fillText(cursor.name, 16, 24);

  ctx.restore();
}

export function renderSceneToPngDataUrl(
  elements: WhiteboardElement[],
  theme: ForgeTheme,
  scale = 2,
  includeBackground = true
): string {
  const active = elements.filter((e) => !e.isDeleted);
  if (active.length === 0) {
    const emptyCanvas = document.createElement('canvas');
    emptyCanvas.width = 800 * scale;
    emptyCanvas.height = 600 * scale;
    const ectx = emptyCanvas.getContext('2d');
    if (ectx && includeBackground) {
      ectx.fillStyle = theme.canvasBg;
      ectx.fillRect(0, 0, emptyCanvas.width, emptyCanvas.height);
    }
    return emptyCanvas.toDataURL('image/png');
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const el of active) {
    const b = getNormalizedBounds(el);
    minX = Math.min(minX, b.x - 32);
    minY = Math.min(minY, b.y - (el.type === 'frame' ? 44 : 32));
    maxX = Math.max(maxX, b.x + b.width + 32);
    maxY = Math.max(maxY, b.y + b.height + 32);
  }

  const width = Math.max(240, Math.ceil(maxX - minX));
  const height = Math.max(200, Math.ceil(maxY - minY));

  const offscreen = document.createElement('canvas');
  offscreen.width = width * scale;
  offscreen.height = height * scale;
  const ctx = offscreen.getContext('2d');
  if (!ctx) return '';

  ctx.scale(scale, scale);
  if (includeBackground) {
    ctx.fillStyle = theme.canvasBg;
    ctx.fillRect(0, 0, width, height);
  }
  ctx.translate(-minX, -minY);

  const sorted = [...active].sort((a, b) => (a.type === 'frame' ? -1 : b.type === 'frame' ? 1 : 0));
  for (const el of sorted) {
    drawElementOnContext(ctx, el, theme);
  }

  return offscreen.toDataURL('image/png');
}

export function getSimulatedWireColor(
  liveV: number | undefined,
  fallbackColor: string
): string {
  if (typeof liveV !== 'number') return fallbackColor;
  // Energized positive rail (+ve): cyan (#38bdf8); negative or 0V (-ve / GND) return rail: rose (#fb7185)
  return liveV > 0.02 ? '#38bdf8' : '#fb7185';
}

export function drawWireJunctionDots(
  ctx: CanvasRenderingContext2D,
  junctions: { x: number; y: number }[],
  color: string | ((pt: { x: number; y: number }) => string)
): void {
  if (junctions.length === 0) return;
  ctx.save();
  for (const pt of junctions) {
    ctx.fillStyle = typeof color === 'function' ? color(pt) : color;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, 4.2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
