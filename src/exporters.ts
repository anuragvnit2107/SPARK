import {
  CanvasThemeId,
  ExcalidrawDocument,
  FontFamily,
  Point,
  ThemeId,
  WhiteboardElement,
} from './types';
import { ForgeTheme } from './themes';
import {
  generatePolygonHachureLines,
  generateSketchyEllipsePoints,
  generateSketchyLineSegments,
  generateSketchyPolygonSegments,
  getArrowheadPoints,
  getDiamondVertices,
  getEllipsePolygon,
  getNormalizedBounds,
  getParallelogramVertices,
  getRectangleVertices,
  getStrokeDashArray,
  getTriangleVertices,
  getWireRenderPoints,
  SketchSegment,
} from './sketchEngine';
import { buildCircuitGeometry } from './engineeringComponents';
import { exportGraph2DToSvg } from './math/Graph2DEngine';
import { canonicalToPrettyUnicode } from './math/SymbolConverter';
import { formatNum } from './math/MatrixEngine';

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function segmentsToSvgPath(segs: SketchSegment[]): string {
  return segs
    .map(
      (s) =>
        `M ${s.start.x.toFixed(1)} ${s.start.y.toFixed(1)} Q ${s.cp.x.toFixed(1)} ${s.cp.y.toFixed(1)} ${s.end.x.toFixed(1)} ${s.end.y.toFixed(1)}`
    )
    .join(' ');
}

function fontFamilySvgName(font: FontFamily): string {
  switch (font) {
    case 'scribble':
      return '"Caveat", cursive';
    case 'casual':
      return '"Comic Neue", cursive';
    case 'heavy':
      return '"Lilita One", sans-serif';
    default:
      return '"Nunito", sans-serif';
  }
}

export function exportToSvg(
  elements: WhiteboardElement[],
  theme: ForgeTheme,
  includeBackground = true
): string {
  const active = elements.filter((e) => !e.isDeleted);
  if (active.length === 0) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">${
      includeBackground ? `<rect width="100%" height="100%" fill="${theme.canvasBg}" />` : ''
    }</svg>`;
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const el of active) {
    const b = getNormalizedBounds(el);
    minX = Math.min(minX, b.x - 24);
    minY = Math.min(minY, b.y - (el.type === 'frame' ? 40 : 24));
    maxX = Math.max(maxX, b.x + b.width + 24);
    maxY = Math.max(maxY, b.y + b.height + 24);
  }

  const width = Math.max(200, Math.ceil(maxX - minX));
  const height = Math.max(200, Math.ceil(maxY - minY));

  const chunks: string[] = [];
  chunks.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${minX.toFixed(1)} ${minY.toFixed(1)} ${width} ${height}">`
  );
  if (includeBackground) {
    chunks.push(
      `<rect x="${minX.toFixed(1)}" y="${minY.toFixed(1)}" width="${width}" height="${height}" fill="${theme.canvasBg}" />`
    );
  }

  for (const el of active) {
    const b = getNormalizedBounds(el);
    const dash = getStrokeDashArray(el.strokeStyle, el.strokeWidth);
    const dashAttr = dash.length ? ` stroke-dasharray="${dash.join(' ')}"` : '';
    const opacityAttr = el.opacity < 100 ? ` opacity="${(el.opacity / 100).toFixed(2)}"` : '';
    const angleDeg = el.angle ? (el.angle * 180) / Math.PI : 0;
    const rotCx = (b.x + b.width / 2).toFixed(1);
    const rotCy = (b.y + b.height / 2).toFixed(1);
    const transformAttr = el.angle
      ? ` transform="rotate(${angleDeg.toFixed(2)} ${rotCx} ${rotCy})"`
      : '';
    const strokeAttrs = `stroke="${el.strokeColor}" stroke-width="${el.strokeWidth}" stroke-linecap="round" stroke-linejoin="round" fill="none"${dashAttr}`;

    chunks.push(`<g${opacityAttr}${transformAttr}>`);

    if (el.type === 'frame') {
      chunks.push(
        `<rect x="${b.x}" y="${b.y}" width="${b.width}" height="${b.height}" rx="12" fill="none" stroke="${el.strokeColor}" stroke-width="1.5" stroke-dasharray="6 4" opacity="0.55" />`
      );
      const label = `Frame ${el.frameIndex || 1}${el.frameTitle ? ` — ${el.frameTitle}` : ''}`;
      chunks.push(
        `<text x="${b.x + 8}" y="${b.y - 10}" font-family="Plus Jakarta Sans, sans-serif" font-size="14" font-weight="600" fill="${el.strokeColor}">${escapeXml(label)}</text>`
      );
    } else if (
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
        if (el.fillStyle === 'solid') {
          const ptsAttr = poly.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
          chunks.push(`<polygon points="${ptsAttr}" fill="${el.backgroundColor}" />`);
        } else {
          const hachure = generatePolygonHachureLines(
            poly,
            -42,
            Math.max(8, el.strokeWidth * 4.5),
            el.sloppiness,
            el.seed,
            el.fillStyle === 'cross-hatch'
          );
          chunks.push(
            `<path d="${segmentsToSvgPath(hachure)}" stroke="${el.backgroundColor}" stroke-width="${Math.max(1, el.strokeWidth * 0.7)}" stroke-linecap="round" fill="none" />`
          );
        }
      }
      const segs = generateSketchyPolygonSegments(poly, el.sloppiness, el.seed, true);
      chunks.push(`<path d="${segmentsToSvgPath(segs)}" ${strokeAttrs} />`);
    } else if (el.type === 'ellipse') {
      const cx = b.x + b.width / 2;
      const cy = b.y + b.height / 2;
      const rx = b.width / 2;
      const ry = b.height / 2;
      if (el.backgroundColor !== 'transparent' && el.fillStyle !== 'none') {
        if (el.fillStyle === 'solid') {
          chunks.push(`<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${el.backgroundColor}" />`);
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
          chunks.push(
            `<path d="${segmentsToSvgPath(hachure)}" stroke="${el.backgroundColor}" stroke-width="${Math.max(1, el.strokeWidth * 0.7)}" fill="none" />`
          );
        }
      }
      const curves = generateSketchyEllipsePoints(cx, cy, rx, ry, el.sloppiness, el.seed);
      for (const curve of curves) {
        const d = curve
          .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
          .join(' ');
        chunks.push(`<path d="${d}" ${strokeAttrs} />`);
      }
    } else if (el.type === 'wire' && el.points && el.points.length >= 2) {
      const worldPts = getWireRenderPoints(el);
      const ptsStr = worldPts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
      chunks.push(`<polyline points="${ptsStr}" ${strokeAttrs} />`);
    } else if ((el.type === 'line' || el.type === 'arrow') && el.points && el.points.length >= 2) {
      const worldPts = el.points.map((p) => ({ x: el.x + p.x, y: el.y + p.y }));
      const segs: SketchSegment[] = [];
      for (let i = 0; i < worldPts.length - 1; i++) {
        segs.push(...generateSketchyLineSegments(worldPts[i], worldPts[i + 1], el.sloppiness, el.seed + i * 53));
      }
      chunks.push(`<path d="${segmentsToSvgPath(segs)}" ${strokeAttrs} />`);
      if (el.type === 'arrow' && el.endArrowhead !== false) {
        const tip = worldPts[worldPts.length - 1];
        const prev = worldPts[worldPts.length - 2];
        const [a1, a2] = getArrowheadPoints(tip, prev, 10 + el.strokeWidth * 2);
        const headSegs = [
          ...generateSketchyLineSegments(tip, a1, el.sloppiness, el.seed + 301),
          ...generateSketchyLineSegments(tip, a2, el.sloppiness, el.seed + 302),
        ];
        chunks.push(`<path d="${segmentsToSvgPath(headSegs)}" stroke="${el.strokeColor}" stroke-width="${el.strokeWidth}" stroke-linecap="round" fill="none" />`);
      }
    } else if (el.type === 'freedraw' && el.points && el.points.length >= 2) {
      const d = el.points
        .map((p, i) => `${i === 0 ? 'M' : 'L'} ${(el.x + p.x).toFixed(1)} ${(el.y + p.y).toFixed(1)}`)
        .join(' ');
      chunks.push(`<path d="${d}" ${strokeAttrs} />`);
    } else if (el.type === 'circuit') {
      const geom = buildCircuitGeometry(el);
      geom.polylines.forEach((poly, idx) => {
        const segs = generateSketchyPolygonSegments(poly, el.sloppiness, el.seed + idx * 71, false);
        chunks.push(`<path d="${segmentsToSvgPath(segs)}" ${strokeAttrs} />`);
      });
      geom.circles.forEach((c, idx) => {
        const curves = generateSketchyEllipsePoints(c.cx, c.cy, c.r, c.r, el.sloppiness, el.seed + 900 + idx);
        for (const curve of curves) {
          const d = curve.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
          chunks.push(`<path d="${d}" ${strokeAttrs} />`);
        }
      });
      geom.labels.forEach((lbl) => {
        chunks.push(
          `<text x="${lbl.x}" y="${lbl.y}" text-anchor="middle" dominant-baseline="middle" font-family="JetBrains Mono, monospace" font-size="${lbl.size}" fill="${el.strokeColor}">${escapeXml(lbl.text)}</text>`
        );
      });
      if (el.componentValue) {
        if (el.circuitKind === 'ac-source' || el.circuitKind === 'dc-source') {
          chunks.push(
            `<text x="${b.x - 6}" y="${b.y + b.height / 2}" text-anchor="end" dominant-baseline="middle" font-family="${escapeXml(fontFamilySvgName(el.fontFamily))}" font-size="16" fill="${el.strokeColor}">${escapeXml(el.componentValue)}</text>`
          );
        } else {
          chunks.push(
            `<text x="${b.x + b.width / 2}" y="${b.y + b.height + 16}" text-anchor="middle" font-family="${escapeXml(fontFamilySvgName(el.fontFamily))}" font-size="16" fill="${el.strokeColor}">${escapeXml(el.componentValue)}</text>`
          );
        }
      }
    } else if (el.type === 'webpage') {
      const cardTitle = el.webpageTitle || 'Interactive Webpage';
      chunks.push(
        `<rect x="${b.x}" y="${b.y}" width="${b.width}" height="${b.height}" rx="12" fill="#0f172a" stroke="${el.strokeColor}" stroke-width="${Math.max(1.5, el.strokeWidth)}" />`
      );
      chunks.push(
        `<line x1="${b.x}" y1="${b.y + 30}" x2="${b.x + b.width}" y2="${b.y + 30}" stroke="${el.strokeColor}" stroke-width="1" opacity="0.35" />`
      );
      chunks.push(
        `<text x="${b.x + 14}" y="${b.y + 19}" font-family="Plus Jakarta Sans, sans-serif" font-size="12" font-weight="600" fill="#f1f5f9">${escapeXml(cardTitle)}</text>`
      );
      chunks.push(
        `<text x="${b.x + 14}" y="${b.y + 54}" font-family="JetBrains Mono, monospace" font-size="11" fill="#34d399">HTML / CSS / JS Webpage</text>`
      );
    } else if (el.type === 'math-equation') {
      const eqFont = Math.max(10, Math.min(96, Math.round((el.fontSize || 16) * 0.92)));
      const resFont = Math.max(9, Math.min(80, Math.round(eqFont * 0.8)));
      chunks.push(
        `<rect x="${b.x}" y="${b.y}" width="${b.width}" height="${b.height}" rx="12" fill="#0f172a" stroke="${el.strokeColor}" stroke-width="1.4" />`
      );
      chunks.push(
        `<text x="${b.x + 12}" y="${b.y + (el.mathResult ? b.height * 0.34 : b.height * 0.5)}" dominant-baseline="middle" font-family="Plus Jakarta Sans, sans-serif" font-size="${eqFont}" font-weight="600" fill="#f8fafc">${escapeXml(canonicalToPrettyUnicode(el.mathRaw || 'f(x)'))}</text>`
      );
      if (el.mathResult) {
        chunks.push(
          `<text x="${b.x + 12}" y="${b.y + b.height * 0.78}" dominant-baseline="middle" font-family="JetBrains Mono, monospace" font-size="${resFont}" fill="#34d399">${escapeXml(el.mathResult)}</text>`
        );
      }
    } else if (el.type === 'math-matrix') {
      const mat = el.matrixData || [[1, 0], [0, 1]];
      const cellFont = Math.max(10, Math.min(96, Math.round((el.fontSize || 16) * 0.85)));
      const labelFont = Math.max(8, Math.min(20, Math.round(cellFont * 0.62)));
      const headerH = Math.max(22, labelFont + 12);
      const rowStep = cellFont * 1.3;
      const totalH = mat.length * rowStep;
      const startY = b.y + headerH + Math.max(8, (b.height - headerH - totalH) / 2) + cellFont * 0.5;
      chunks.push(
        `<rect x="${b.x}" y="${b.y}" width="${b.width}" height="${b.height}" rx="12" fill="#0f172a" stroke="${el.strokeColor}" stroke-width="1.4" />`
      );
      chunks.push(
        `<text x="${b.x + 12}" y="${b.y + headerH * 0.55}" dominant-baseline="middle" font-family="JetBrains Mono, monospace" font-size="${labelFont}" fill="#94a3b8">${escapeXml(`${el.matrixName || 'A'} (${mat.length}×${mat[0]?.length || 0})`)}</text>`
      );
      mat.forEach((row, r) => {
        chunks.push(
          `<text x="${b.x + 16}" y="${(startY + r * rowStep).toFixed(1)}" dominant-baseline="middle" font-family="JetBrains Mono, monospace" font-size="${cellFont}" fill="#f8fafc">${escapeXml('[ ' + row.map((v) => formatNum(v, 2)).join('  ') + ' ]')}</text>`
        );
      });
    } else if (el.type === 'math-graph-2d' && el.graph2DConfig) {
      const innerSvg = exportGraph2DToSvg(
        el.graph2DConfig,
        Math.max(120, Math.round(b.width)),
        Math.max(90, Math.round(b.height)),
        theme.mode === 'dark'
      )
        .replace(/^<svg[^>]*>/, '')
        .replace(/<\/svg>$/, '');
      chunks.push(`<g transform="translate(${b.x}, ${b.y})">${innerSvg}</g>`);
      chunks.push(
        `<rect x="${b.x}" y="${b.y}" width="${b.width}" height="${b.height}" rx="8" fill="none" stroke="${el.strokeColor}" stroke-width="1.4" />`
      );
    } else if (el.type === 'math-graph-3d' && el.graph3DConfig) {
      chunks.push(
        `<rect x="${b.x}" y="${b.y}" width="${b.width}" height="${b.height}" rx="12" fill="#0f172a" stroke="${el.strokeColor}" stroke-width="1.4" />`
      );
      chunks.push(
        `<text x="${b.x + 14}" y="${b.y + 22}" font-family="JetBrains Mono, monospace" font-size="12" fill="#34d399">${escapeXml(`3D f(x,y) = ${el.graph3DConfig.expression}`)}</text>`
      );
    } else if (el.type === 'image' && el.imageDataUrl) {
      chunks.push(
        `<image href="${escapeXml(el.imageDataUrl)}" x="${b.x}" y="${b.y}" width="${b.width}" height="${b.height}" preserveAspectRatio="none" />`
      );
    }

    if (el.text && el.type !== 'frame') {
      const tx = b.x + b.width / 2;
      const ty = b.y + b.height / 2;
      const lines = el.text.split('\n');
      const lineHeight = el.fontSize * 1.25;
      const startY = ty - ((lines.length - 1) * lineHeight) / 2;
      lines.forEach((line, idx) => {
        chunks.push(
          `<text x="${tx}" y="${startY + idx * lineHeight}" text-anchor="middle" dominant-baseline="middle" font-family="${escapeXml(fontFamilySvgName(el.fontFamily))}" font-size="${el.fontSize}" fill="${el.strokeColor}">${escapeXml(line)}</text>`
        );
      });
    }

    chunks.push('</g>');
  }

  chunks.push('</svg>');
  return chunks.join('\n');
}

function toExcalidrawType(el: WhiteboardElement): string {
  switch (el.type) {
    case 'rectangle':
    case 'diamond':
    case 'ellipse':
    case 'arrow':
    case 'line':
    case 'freedraw':
    case 'text':
    case 'image':
    case 'frame':
      return el.type;
    case 'triangle':
    case 'parallelogram':
    case 'wire':
      return 'line';
    case 'circuit':
    case 'webpage':
    case 'math-equation':
    case 'math-matrix':
    case 'math-graph-2d':
    case 'math-graph-3d':
      return 'rectangle';
  }
}

export function exportToExcalidrawJson(
  elements: WhiteboardElement[],
  theme: ForgeTheme
): ExcalidrawDocument {
  const files: ExcalidrawDocument['files'] = {};
  const mapped = elements
    .filter((e) => !e.isDeleted)
    .map((el) => {
      if (el.type === 'image' && el.imageDataUrl) {
        files[`file_${el.id}`] = {
          id: `file_${el.id}`,
          mimeType: 'image/png',
          dataURL: el.imageDataUrl,
        };
      }
      return {
        id: el.id,
        type: toExcalidrawType(el),
        x: el.x,
        y: el.y,
        width: el.width,
        height: el.height,
        angle: el.angle,
        strokeColor: el.strokeColor,
        backgroundColor: el.backgroundColor,
        fillStyle: el.fillStyle === 'none' ? 'hachure' : el.fillStyle,
        strokeWidth: el.strokeWidth,
        strokeStyle: el.strokeStyle,
        roughness: el.sloppiness,
        opacity: el.opacity,
        seed: el.seed,
        version: el.version,
        updated: el.updatedAt,
        isDeleted: false,
        text: el.text,
        fontSize: el.fontSize,
        points: el.points ? el.points.map((p) => [p.x, p.y]) : undefined,
        fileId: el.type === 'image' ? `file_${el.id}` : undefined,
        // Preserve full Rustly Forge fidelity metadata
        customData: {
          rustlyType: el.type,
          fontFamily: el.fontFamily,
          triangleVariant: el.triangleVariant,
          skewRatio: el.skewRatio,
          circuitKind: el.circuitKind,
          componentValue: el.componentValue,
          frequencyHz: el.frequencyHz,
          waveformType: el.waveformType,
          switchClosed: el.switchClosed,
          logicInputA: el.logicInputA,
          logicInputB: el.logicInputB,
          webpageTitle: el.webpageTitle,
          htmlCode: el.htmlCode,
          cssCode: el.cssCode,
          jsCode: el.jsCode,
          webpageAutoPolish: el.webpageAutoPolish,
          mathRaw: el.mathRaw,
          mathLatex: el.mathLatex,
          mathResult: el.mathResult,
          mathResultLatex: el.mathResultLatex,
          mathOperation: el.mathOperation,
          matrixName: el.matrixName,
          matrixData: el.matrixData,
          graph2DConfig: el.graph2DConfig,
          graph3DConfig: el.graph3DConfig,
          icPinCount: el.icPinCount,
          icPinLabels: el.icPinLabels,
          frameIndex: el.frameIndex,
          frameTitle: el.frameTitle,
          startBinding: el.startBinding,
          endBinding: el.endBinding,
        },
      };
    });

  return {
    type: 'excalidraw',
    version: 2,
    source: 'https://rustly-forge.local',
    elements: mapped,
    appState: {
      viewBackgroundColor: theme.canvasBg,
      gridSize: 24,
      rustlyTheme: theme.id,
      rustlyCanvasTheme: theme.canvasThemeId,
    },
    files,
  };
}

export function importSceneFromJson(
  rawText: string,
  defaultInk: string
): { elements: WhiteboardElement[]; themeId?: ThemeId; canvasThemeId?: CanvasThemeId } {
  const parsed = JSON.parse(rawText) as {
    type?: string;
    elements?: Record<string, unknown>[];
    appState?: { rustlyTheme?: ThemeId; rustlyCanvasTheme?: CanvasThemeId };
    files?: Record<string, { dataURL?: string }>;
  };

  if (!Array.isArray(parsed.elements)) {
    throw new Error('Invalid scene JSON: missing elements array.');
  }

  const elements: WhiteboardElement[] = parsed.elements
    .filter((raw) => !raw.isDeleted)
    .map((raw, idx) => {
      const custom = (raw.customData || {}) as Record<string, unknown>;
      const rawPoints = Array.isArray(raw.points)
        ? raw.points.map((pt: unknown) => {
            if (Array.isArray(pt)) return { x: Number(pt[0] || 0), y: Number(pt[1] || 0) };
            const obj = pt as { x?: number; y?: number };
            return { x: Number(obj?.x || 0), y: Number(obj?.y || 0) };
          })
        : undefined;

      const fileId = typeof raw.fileId === 'string' ? raw.fileId : undefined;
      const imageDataUrl =
        typeof raw.imageDataUrl === 'string'
          ? raw.imageDataUrl
          : fileId && parsed.files?.[fileId]?.dataURL
          ? parsed.files[fileId].dataURL
          : undefined;

      const type = (custom.rustlyType || raw.type || 'rectangle') as WhiteboardElement['type'];
      const sloppinessRaw = Number(raw.sloppiness ?? raw.roughness ?? 1);
      const sloppiness = (sloppinessRaw <= 0 ? 0 : sloppinessRaw >= 2 ? 2 : 1) as WhiteboardElement['sloppiness'];

      return {
        id: String(raw.id || `imported_${Date.now()}_${idx}`),
        type,
        x: Number(raw.x || 0),
        y: Number(raw.y || 0),
        width: Number(raw.width || 120),
        height: Number(raw.height || 80),
        angle: Number(raw.angle || 0),
        strokeColor: String(raw.strokeColor || defaultInk),
        backgroundColor: String(raw.backgroundColor || 'transparent'),
        fillStyle: (raw.fillStyle as WhiteboardElement['fillStyle']) || 'none',
        strokeWidth: Number(raw.strokeWidth || 2),
        strokeStyle: (raw.strokeStyle as WhiteboardElement['strokeStyle']) || 'solid',
        sloppiness,
        opacity: Number(raw.opacity ?? 100),
        seed: Number(raw.seed || idx * 1337 + 42),
        fontFamily: (custom.fontFamily as FontFamily) || (raw.fontFamily as FontFamily) || 'scribble',
        fontSize: Number(raw.fontSize || 20),
        text: typeof raw.text === 'string' ? raw.text : undefined,
        points: rawPoints,
        startArrowhead: Boolean(raw.startArrowhead),
        endArrowhead: raw.endArrowhead !== false,
        startBinding: (custom.startBinding as WhiteboardElement['startBinding']) || (raw.startBinding as WhiteboardElement['startBinding']) || null,
        endBinding: (custom.endBinding as WhiteboardElement['endBinding']) || (raw.endBinding as WhiteboardElement['endBinding']) || null,
        triangleVariant: custom.triangleVariant as WhiteboardElement['triangleVariant'],
        skewRatio: typeof custom.skewRatio === 'number' ? custom.skewRatio : undefined,
        circuitKind: (custom.circuitKind || raw.circuitKind) as WhiteboardElement['circuitKind'],
        componentValue: (custom.componentValue || raw.componentValue) as string | undefined,
        frequencyHz:
          typeof custom.frequencyHz === 'number'
            ? custom.frequencyHz
            : typeof raw.frequencyHz === 'number'
            ? raw.frequencyHz
            : undefined,
        waveformType: (custom.waveformType || raw.waveformType) as WhiteboardElement['waveformType'],
        switchClosed:
          typeof custom.switchClosed === 'boolean'
            ? custom.switchClosed
            : typeof raw.switchClosed === 'boolean'
            ? raw.switchClosed
            : undefined,
        logicInputA: (custom.logicInputA || raw.logicInputA) as string | undefined,
        logicInputB: (custom.logicInputB || raw.logicInputB) as string | undefined,
        webpageTitle: (custom.webpageTitle || raw.webpageTitle) as string | undefined,
        htmlCode: (custom.htmlCode || raw.htmlCode) as string | undefined,
        cssCode: (custom.cssCode || raw.cssCode) as string | undefined,
        jsCode: (custom.jsCode || raw.jsCode) as string | undefined,
        webpageAutoPolish:
          typeof custom.webpageAutoPolish === 'boolean'
            ? custom.webpageAutoPolish
            : typeof raw.webpageAutoPolish === 'boolean'
            ? raw.webpageAutoPolish
            : undefined,
        mathRaw: (custom.mathRaw || raw.mathRaw) as string | undefined,
        mathLatex: (custom.mathLatex || raw.mathLatex) as string | undefined,
        mathResult: (custom.mathResult || raw.mathResult) as string | undefined,
        mathResultLatex: (custom.mathResultLatex || raw.mathResultLatex) as string | undefined,
        mathOperation: (custom.mathOperation || raw.mathOperation) as string | undefined,
        matrixName: (custom.matrixName || raw.matrixName) as string | undefined,
        matrixData: (custom.matrixData || raw.matrixData) as number[][] | undefined,
        graph2DConfig: (custom.graph2DConfig || raw.graph2DConfig) as WhiteboardElement['graph2DConfig'],
        graph3DConfig: (custom.graph3DConfig || raw.graph3DConfig) as WhiteboardElement['graph3DConfig'],
        icPinCount: (custom.icPinCount || raw.icPinCount) as number | undefined,
        icPinLabels: (custom.icPinLabels || raw.icPinLabels) as string[] | undefined,
        frameIndex: (custom.frameIndex || raw.frameIndex) as number | undefined,
        frameTitle: (custom.frameTitle || raw.frameTitle) as string | undefined,
        imageDataUrl,
        version: Number(raw.version || 1),
        updatedAt: Number(raw.updated || raw.updatedAt || Date.now()),
      };
    });

  return {
    elements,
    themeId: parsed.appState?.rustlyTheme,
    canvasThemeId: parsed.appState?.rustlyCanvasTheme,
  };
}
