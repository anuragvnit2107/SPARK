import { WhiteboardElement } from '../types';
import { Graph2DConfig, Graph2DEquation, Graph3DConfig } from './types';
import { canonicalToLatex, normalizeUnicodeToCanonical } from './SymbolConverter';
import { formatMatrixLatex, formatNum, parseMatrixInput } from './MatrixEngine';
import { GRAPH3D_PRESET_FUNCTIONS } from './Graph3DEngine';

const DEFAULT_PLOT_COLORS = ['#38bdf8', '#10b981', '#f59e0b', '#f472b6', '#a78bfa', '#fb7185'];

export function makeMathId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export function createMathEquationElement(
  rawExpression: string,
  x: number,
  y: number,
  strokeColor: string,
  result?: { text: string; latex?: string; operation?: string }
): WhiteboardElement {
  const canonical = normalizeUnicodeToCanonical(rawExpression);
  const latex = canonicalToLatex(canonical);
  return {
    id: makeMathId('meq'),
    type: 'math-equation',
    x,
    y,
    width: Math.max(240, Math.min(480, canonical.length * 11 + 80)),
    height: result ? 96 : 64,
    angle: 0,
    strokeColor,
    backgroundColor: 'transparent',
    fillStyle: 'none',
    strokeWidth: 1.5,
    strokeStyle: 'solid',
    sloppiness: 0,
    opacity: 100,
    seed: Math.floor(Math.random() * 100000),
    fontFamily: 'cleansans',
    fontSize: 18,
    mathRaw: rawExpression,
    mathLatex: latex,
    mathResult: result?.text,
    mathResultLatex: result?.latex,
    mathOperation: result?.operation,
    version: 1,
    updatedAt: Date.now(),
  };
}

export function createMathMatrixElement(
  matrix: number[][],
  name: string,
  x: number,
  y: number,
  strokeColor: string
): WhiteboardElement {
  const rows = matrix.length;
  const cols = matrix[0]?.length || 1;
  return {
    id: makeMathId('mmat'),
    type: 'math-matrix',
    x,
    y,
    width: Math.max(220, cols * 58 + 76),
    height: Math.max(120, rows * 34 + 62),
    angle: 0,
    strokeColor,
    backgroundColor: 'transparent',
    fillStyle: 'none',
    strokeWidth: 1.5,
    strokeStyle: 'solid',
    sloppiness: 0,
    opacity: 100,
    seed: Math.floor(Math.random() * 100000),
    fontFamily: 'cleansans',
    fontSize: 16,
    matrixName: name || 'A',
    matrixData: matrix,
    mathRaw: `${name || 'A'} = ${JSON.stringify(matrix)}`,
    mathLatex: `${name || 'A'} = ${formatMatrixLatex(matrix)}`,
    version: 1,
    updatedAt: Date.now(),
  };
}

export function createDefaultGraph2DConfig(
  equations: Array<Partial<Graph2DEquation> & { expression: string }> = []
): Graph2DConfig {
  return {
    equations: equations.map((eq, idx) => ({
      id: eq.id || makeMathId('geq'),
      sourceElementId: eq.sourceElementId,
      expression: eq.expression,
      expressionY: eq.expressionY,
      label: eq.label || eq.expression,
      color: eq.color || DEFAULT_PLOT_COLORS[idx % DEFAULT_PLOT_COLORS.length],
      thickness: eq.thickness ?? 2.3,
      lineStyle: eq.lineStyle ?? 'solid',
      visible: eq.visible ?? true,
      domainMin: eq.domainMin,
      domainMax: eq.domainMax,
      parameterMin: eq.parameterMin,
      parameterMax: eq.parameterMax,
    })),
    bounds: { xMin: -10, xMax: 10, yMin: -10, yMax: 10 },
    angleUnit: 'rad',
    equalAspect: false,
    showGrid: true,
    showMinorGrid: true,
    showAxes: true,
    showLegend: true,
    showIntersections: true,
    showConicFeatures: true,
    parameters: { a: 1, b: 1, c: 0, d: 0 },
  };
}

export function createMathGraph2DElement(
  config: Graph2DConfig,
  x: number,
  y: number,
  strokeColor: string
): WhiteboardElement {
  return {
    id: makeMathId('mg2d'),
    type: 'math-graph-2d',
    x,
    y,
    width: 440,
    height: 320,
    angle: 0,
    strokeColor,
    backgroundColor: 'transparent',
    fillStyle: 'none',
    strokeWidth: 1.5,
    strokeStyle: 'solid',
    sloppiness: 0,
    opacity: 100,
    seed: Math.floor(Math.random() * 100000),
    fontFamily: 'cleansans',
    fontSize: 14,
    graph2DConfig: config,
    version: 1,
    updatedAt: Date.now(),
  };
}

export function createDefaultGraph3DConfig(
  expression = GRAPH3D_PRESET_FUNCTIONS[0],
  sourceElementId?: string
): Graph3DConfig {
  return {
    kind: 'explicit',
    expression,
    constants: { a: 1, b: 1, c: 0, d: 0 },
    xMin: -3,
    xMax: 3,
    yMin: -3,
    yMax: 3,
    zMin: -5,
    zMax: 15,
    resolution: 32,
    renderMode: 'surface-mesh',
    colormap: 'coolwarm',
    showAxes: true,
    showGrid: true,
    showContour2D: true,
    presetExpressions: GRAPH3D_PRESET_FUNCTIONS,
    sourceElementId,
  };
}

export function createMathGraph3DElement(
  config: Graph3DConfig,
  x: number,
  y: number,
  strokeColor: string
): WhiteboardElement {
  return {
    id: makeMathId('mg3d'),
    type: 'math-graph-3d',
    x,
    y,
    width: 560,
    height: 410,
    angle: 0,
    strokeColor,
    backgroundColor: 'transparent',
    fillStyle: 'none',
    strokeWidth: 1.5,
    strokeStyle: 'solid',
    sloppiness: 0,
    opacity: 100,
    seed: Math.floor(Math.random() * 100000),
    fontFamily: 'cleansans',
    fontSize: 14,
    graph3DConfig: config,
    version: 1,
    updatedAt: Date.now(),
  };
}

/**
 * Synchronizes any 2D or 3D graph elements linked via `sourceElementId` when a source
 * `math-equation` element is edited on the canvas.
 */
export function propagateEquationEditsToGraphs(
  elements: WhiteboardElement[],
  updatedEquationId: string,
  newExpression: string
): WhiteboardElement[] {
  const canonical = normalizeUnicodeToCanonical(newExpression);
  return elements.map((el) => {
    if (el.isDeleted) return el;
    if (el.type === 'math-graph-2d' && el.graph2DConfig) {
      const hasLinked = el.graph2DConfig.equations.some(
        (eq) => eq.sourceElementId === updatedEquationId
      );
      if (!hasLinked) return el;
      return {
        ...el,
        graph2DConfig: {
          ...el.graph2DConfig,
          equations: el.graph2DConfig.equations.map((eq) =>
            eq.sourceElementId === updatedEquationId
              ? { ...eq, expression: canonical, label: newExpression }
              : eq
          ),
        },
        version: el.version + 1,
        updatedAt: Date.now(),
      };
    }
    if (
      el.type === 'math-graph-3d' &&
      el.graph3DConfig &&
      el.graph3DConfig.sourceElementId === updatedEquationId
    ) {
      return {
        ...el,
        graph3DConfig: {
          ...el.graph3DConfig,
          expression: canonical.replace(/^z\s*=\s*/i, ''),
        },
        version: el.version + 1,
        updatedAt: Date.now(),
      };
    }
    return el;
  });
}

/**
 * Helper: parses `matrix = [[...]]` input string and returns a math-matrix element
 * or updates an existing matrix element cleanly.
 */
export function maybeParseMatrixElementData(
  raw: string
): { name: string; matrix: number[][] } | null {
  const res = parseMatrixInput(raw);
  if (!res.ok || !res.matrix) return null;
  return { name: res.name || 'A', matrix: res.matrix };
}

export function formatMatrixCompact(M: number[][]): string {
  return M.map((r) => `[${r.map((v) => formatNum(v, 3)).join(', ')}]`).join('\n');
}
