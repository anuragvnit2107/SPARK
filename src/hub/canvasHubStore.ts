import { createDemoCircuitPreset } from '../circuitPreset';
import {
  createDefaultGraph2DConfig,
  createDefaultGraph3DConfig,
  createMathEquationElement,
  createMathGraph2DElement,
  createMathGraph3DElement,
  createMathMatrixElement,
} from '../math/MathCanvasIntegration';
import { CameraState, CanvasThemeId, CircuitKind, FillStyle, Point, WhiteboardElement } from '../types';

export type CanvasCategory = 'Architecture' | 'Circuits' | 'Math' | 'Wireframes';
export type SpatialLayoutMode = 'constellation' | 'helix' | 'matrix';

export interface SpatialPosition {
  x: number;
  y: number;
  z: number;
  rotY: number;
  pinned?: boolean;
}

export interface CanvasPreviewElement {
  id: string;
  type: WhiteboardElement['type'];
  x: number;
  y: number;
  width: number;
  height: number;
  strokeColor: string;
  backgroundColor: string;
  fillStyle: FillStyle;
  text?: string;
  mathRaw?: string;
  mathResult?: string;
  matrixData?: number[][];
  circuitKind?: CircuitKind;
  componentValue?: string;
  frameTitle?: string;
  points?: Point[];
}

export interface FocusBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface CanvasLastViewport {
  x: number;
  y: number;
  zoom: number;
  viewportWidth?: number;
  viewportHeight?: number;
  previewElements: CanvasPreviewElement[];
  lastNoteSnippet: string;
  focusBounds: FocusBounds;
}

export interface SpatialCanvasRecord {
  id: string;
  title: string;
  category: CanvasCategory;
  tags: string[];
  createdAt: number;
  updatedAt: number;
  elementCount: number;
  camera: CameraState;
  canvasThemeId?: CanvasThemeId;
  spatialPosition?: SpatialPosition;
  elements: WhiteboardElement[];
  lastViewport: CanvasLastViewport;
}

export interface CategoryMeta {
  color: string;
  softBg: string;
  badge: string;
  center: { x: number; y: number; z: number };
  description: string;
}

export const HUB_STORAGE_KEY = 'spark-spatial-hub-canvases-v1';
export const ACTIVE_CANVAS_STORAGE_KEY = 'spark-spatial-hub-active-id-v1';

export const CANVAS_CATEGORY_ORDER: CanvasCategory[] = [
  'Architecture',
  'Circuits',
  'Math',
  'Wireframes',
];

export const CANVAS_CATEGORIES: Record<CanvasCategory, CategoryMeta> = {
  Architecture: {
    color: '#064E3B',
    softBg: '#D1FAE5',
    badge: 'ARC',
    center: { x: -9.6, y: 4.1, z: -2.5 },
    description: 'Distributed systems, meshes & infrastructure topologies',
  },
  Circuits: {
    color: '#059669',
    softBg: '#ECFDF5',
    badge: 'CKT',
    center: { x: 9.6, y: 4.3, z: -1.8 },
    description: 'Analog filters, PWM drivers & interactive SPICE schematics',
  },
  Math: {
    color: '#0D9488',
    softBg: '#CCFBF1',
    badge: 'MTH',
    center: { x: -8.8, y: -4.4, z: 3.8 },
    description: 'Symbolic calculus, 3D surfaces & linear algebra matrices',
  },
  Wireframes: {
    color: '#10B981',
    softBg: '#D1FAE5',
    badge: 'WFR',
    center: { x: 9.0, y: -4.1, z: 4.2 },
    description: 'Interactive HUD prototypes, flows & spatial UI sketches',
  },
};

export function formatRelativeTime(timestamp: number, now = Date.now()): string {
  const diffSec = Math.max(0, Math.floor((now - timestamp) / 1000));
  if (diffSec < 45) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return `${diffDay}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

function toPreviewElement(el: WhiteboardElement): CanvasPreviewElement {
  return {
    id: el.id,
    type: el.type,
    x: el.x,
    y: el.y,
    width: el.width,
    height: el.height,
    strokeColor: el.strokeColor,
    backgroundColor: el.backgroundColor,
    fillStyle: el.fillStyle,
    text: el.text,
    mathRaw: el.mathRaw,
    mathResult: el.mathResult,
    matrixData: el.matrixData,
    circuitKind: el.circuitKind,
    componentValue: el.componentValue,
    frameTitle: el.frameTitle,
    points: el.points ? el.points.slice(0, 28) : undefined,
  };
}

function getElementBounds(elements: WhiteboardElement[]): FocusBounds {
  if (elements.length === 0) {
    return { minX: 0, minY: 0, maxX: 900, maxY: 600 };
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const el of elements) {
    const x2 = el.x + Math.max(40, Math.abs(el.width || 0));
    const y2 = el.y + Math.max(30, Math.abs(el.height || 0));
    if (el.x < minX) minX = el.x;
    if (el.y < minY) minY = el.y;
    if (x2 > maxX) maxX = x2;
    if (y2 > maxY) maxY = y2;
  }
  const pad = 48;
  return {
    minX: minX - pad,
    minY: minY - pad,
    maxX: maxX + pad,
    maxY: maxY + pad,
  };
}

function extractNoteSnippet(elements: WhiteboardElement[]): string {
  const sorted = [...elements].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  for (const el of sorted) {
    if (el.type === 'math-equation' && el.mathRaw) {
      return el.mathResult ? `${el.mathRaw} → ${el.mathResult}` : el.mathRaw;
    }
    if (el.text && el.text.trim().length > 2) {
      return el.text.trim().replace(/\s+/g, ' ').slice(0, 88);
    }
    if (el.frameTitle && el.frameTitle.trim().length > 1) {
      return el.frameTitle.trim().slice(0, 88);
    }
    if (el.type === 'circuit' && el.componentValue) {
      return `${el.circuitKind?.toUpperCase() || 'NODE'}: ${el.componentValue}`;
    }
  }
  return 'Blank engineering canvas ready for sketches, circuits & math';
}

export function extractLastViewport(
  elements: WhiteboardElement[],
  camera: CameraState = { x: 0, y: 0, zoom: 1 },
  viewportWidth = 1280,
  viewportHeight = 800
): CanvasLastViewport {
  const active = elements.filter((el) => !el.isDeleted);
  if (active.length === 0) {
    return {
      x: camera.x,
      y: camera.y,
      zoom: camera.zoom,
      previewElements: [],
      lastNoteSnippet: 'Empty workspace — double-click to start sketching',
      focusBounds: { minX: 0, minY: 0, maxX: 900, maxY: 600 },
    };
  }

  const safeZoom = Math.max(0.15, camera.zoom || 1);
  const viewLeft = -camera.x / safeZoom;
  const viewTop = -camera.y / safeZoom;
  const viewRight = viewLeft + viewportWidth / safeZoom;
  const viewBottom = viewTop + viewportHeight / safeZoom;
  const viewCenterX = (viewLeft + viewRight) / 2;
  const viewCenterY = (viewTop + viewBottom) / 2;

  const visibleInCamera = active.filter((el) => {
    const cx = el.x + (el.width || 0) / 2;
    const cy = el.y + (el.height || 0) / 2;
    return (
      cx >= viewLeft - 140 &&
      cx <= viewRight + 140 &&
      cy >= viewTop - 120 &&
      cy <= viewBottom + 120
    );
  });

  const focusCandidates =
    visibleInCamera.length > 0
      ? visibleInCamera
      : [...active]
          .sort((a, b) => {
            const acx = a.x + (a.width || 0) / 2;
            const acy = a.y + (a.height || 0) / 2;
            const bcx = b.x + (b.width || 0) / 2;
            const bcy = b.y + (b.height || 0) / 2;
            const da = Math.hypot(acx - viewCenterX, acy - viewCenterY);
            const db = Math.hypot(bcx - viewCenterX, bcy - viewCenterY);
            return da - db;
          })
          .slice(0, 12);

  const previewElements = active.slice(0, 42).map(toPreviewElement);
  const focusBounds = getElementBounds(focusCandidates);
  const lastNoteSnippet = extractNoteSnippet(focusCandidates);

  return {
    x: camera.x,
    y: camera.y,
    zoom: camera.zoom,
    viewportWidth,
    viewportHeight,
    previewElements,
    lastNoteSnippet,
    focusBounds,
  };
}

function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function generateFreeSpacePosition(
  seedId: string,
  index: number,
  total: number,
  existing: SpatialPosition[] = []
): SpatialPosition {
  const baseHash = hashString(seedId);
  const goldenAngle = 2.399963229728653;

  for (let attempt = 0; attempt < 40; attempt++) {
    const h = hashString(`${seedId}-${attempt}`);
    const jitterA = ((h & 0xffff) / 0xffff) * 2 - 1;
    const jitterB = (((h >>> 16) & 0xffff) / 0xffff) * 2 - 1;
    const theta = (index + attempt * 0.73) * goldenAngle + jitterA * 0.4;
    const norm = (index + 0.5) / Math.max(4, total);
    const radius = 5.2 + norm * 13.5 + jitterB * 2.2;

    const x = Math.cos(theta) * radius * 1.25;
    const z = Math.sin(theta) * radius * 0.55 - 1.0;
    const y = (((baseHash >>> (attempt % 12)) & 0xff) / 255 - 0.44) * 11.2;

    const collides3D = existing.some(
      (p) => Math.hypot(p.x - x, (p.y - y) * 1.3, p.z - z) < 7.2
    );
    const occludes2D = existing.some(
      (p) => Math.abs(p.x - x) < 5.6 && Math.abs(p.y - y) < 3.6
    );
    if ((!collides3D && !occludes2D) || attempt === 39) {
      const rotY = Math.atan2(-x * 0.32, 30 - z) * 0.42;
      return {
        x: Number(x.toFixed(2)),
        y: Number(y.toFixed(2)),
        z: Number(z.toFixed(2)),
        rotY: Number(rotY.toFixed(4)),
        pinned: false,
      };
    }
  }

  return { x: 0, y: 0, z: 0, rotY: 0, pinned: false };
}

export function reArrangeUnpinnedCanvases(
  canvases: SpatialCanvasRecord[],
  salt = Date.now()
): SpatialCanvasRecord[] {
  const pinnedPositions: SpatialPosition[] = canvases
    .filter((c) => c.spatialPosition?.pinned)
    .map((c) => c.spatialPosition!);
  const placed: SpatialPosition[] = [...pinnedPositions];

  return canvases.map((c, idx) => {
    if (c.spatialPosition?.pinned) return c;
    const nextPos = generateFreeSpacePosition(`${c.id}-${salt}`, idx, canvases.length, placed);
    placed.push(nextPos);
    return {
      ...c,
      spatialPosition: nextPos,
    };
  });
}

export function searchCanvases(
  canvases: SpatialCanvasRecord[],
  query: string,
  categoryFilter: CanvasCategory | 'All' = 'All'
): SpatialCanvasRecord[] {
  const q = query.trim().toLowerCase();
  return canvases.filter((canvas) => {
    if (categoryFilter !== 'All' && canvas.category !== categoryFilter) return false;
    if (!q) return true;
    if (canvas.title.toLowerCase().includes(q)) return true;
    if (canvas.category.toLowerCase().includes(q)) return true;
    if (canvas.tags.some((tag) => tag.toLowerCase().includes(q))) return true;
    if (canvas.lastViewport.lastNoteSnippet.toLowerCase().includes(q)) return true;
    return canvas.elements.some((el) => {
      if (el.isDeleted) return false;
      const fields = [el.text, el.mathRaw, el.mathResult, el.frameTitle, el.componentValue];
      return fields.some((f) => Boolean(f && f.toLowerCase().includes(q)));
    });
  });
}

function makeBaseElement(
  partial: Partial<WhiteboardElement> & Pick<WhiteboardElement, 'id' | 'type' | 'x' | 'y'>,
  now: number,
  inkColor = '#064E3B'
): WhiteboardElement {
  return {
    width: 180,
    height: 90,
    angle: 0,
    strokeColor: inkColor,
    backgroundColor: 'transparent',
    fillStyle: 'none',
    strokeWidth: 2,
    strokeStyle: 'solid',
    sloppiness: 1,
    opacity: 100,
    seed: Math.floor(Math.abs(partial.x * 13 + partial.y * 7) + 17),
    fontFamily: 'cleansans',
    fontSize: 16,
    version: 1,
    updatedAt: now,
    ...partial,
  };
}

function createRecordFromElements(params: {
  id: string;
  title: string;
  category: CanvasCategory;
  tags: string[];
  updatedAt: number;
  createdAt?: number;
  camera?: CameraState;
  canvasThemeId?: CanvasThemeId;
  spatialPosition?: SpatialPosition;
  elements: WhiteboardElement[];
}): SpatialCanvasRecord {
  const camera = params.camera || { x: 40, y: 30, zoom: 0.9 };
  const activeCount = params.elements.filter((e) => !e.isDeleted).length;
  return {
    id: params.id,
    title: params.title,
    category: params.category,
    tags: params.tags,
    createdAt: params.createdAt ?? params.updatedAt - 1000 * 60 * 60 * 24,
    updatedAt: params.updatedAt,
    elementCount: activeCount,
    camera,
    canvasThemeId: params.canvasThemeId || 'emerald-minimal',
    spatialPosition: params.spatialPosition,
    elements: params.elements,
    lastViewport: extractLastViewport(params.elements, camera, 960, 600),
  };
}

export function createSeedCanvases(inkColor = '#064E3B'): SpatialCanvasRecord[] {
  const now = Date.now();
  const min = 60 * 1000;
  const hr = 60 * min;

  // 1. Circuits: Active RC Filter & Op-Amp Buffer
  const rcElements = createDemoCircuitPreset(inkColor);
  rcElements.push(
    makeBaseElement(
      {
        id: 'rc_note_1',
        type: 'rectangle',
        x: 475,
        y: 422,
        width: 265,
        height: 74,
        strokeColor: '#059669',
        backgroundColor: '#ECFDF5',
        fillStyle: 'solid',
        text: 'Cutoff fc = 1 / (2π·10kΩ·10nF)\nfc = 1.59 kHz · Unity Buffer',
        fontSize: 13,
      },
      now - 4 * min,
      '#064E3B'
    )
  );

  // 2. Circuits: PWM MOSFET Gate Driver
  const pwmTime = now - 38 * min;
  const pwmElements: WhiteboardElement[] = [
    makeBaseElement(
      {
        id: 'pwm_frame',
        type: 'frame',
        x: 70,
        y: 70,
        width: 720,
        height: 410,
        frameIndex: 1,
        frameTitle: '24kHz PWM Motor Gate Drive',
      },
      pwmTime,
      inkColor
    ),
    makeBaseElement(
      {
        id: 'pwm_dc',
        type: 'circuit',
        circuitKind: 'dc-source',
        componentValue: '12V DC',
        x: 115,
        y: 195,
        width: 72,
        height: 110,
      },
      pwmTime,
      inkColor
    ),
    makeBaseElement(
      {
        id: 'pwm_sw',
        type: 'circuit',
        circuitKind: 'switch',
        componentValue: 'Q1 FET',
        switchClosed: true,
        x: 245,
        y: 155,
        width: 110,
        height: 54,
      },
      pwmTime,
      inkColor
    ),
    makeBaseElement(
      {
        id: 'pwm_res',
        type: 'circuit',
        circuitKind: 'resistor',
        componentValue: '22Ω Gate',
        x: 410,
        y: 158,
        width: 120,
        height: 48,
      },
      pwmTime,
      inkColor
    ),
    makeBaseElement(
      {
        id: 'pwm_diode',
        type: 'circuit',
        circuitKind: 'diode',
        componentValue: 'Flyback',
        x: 565,
        y: 235,
        width: 90,
        height: 60,
      },
      pwmTime,
      inkColor
    ),
    makeBaseElement(
      {
        id: 'pwm_wire_1',
        type: 'wire',
        x: 187,
        y: 210,
        width: 58,
        height: 2,
        points: [
          { x: 0, y: 0 },
          { x: 58, y: -28 },
        ],
        strokeColor: '#059669',
      },
      pwmTime,
      '#059669'
    ),
    makeBaseElement(
      {
        id: 'pwm_wire_2',
        type: 'wire',
        x: 355,
        y: 182,
        width: 55,
        height: 2,
        points: [
          { x: 0, y: 0 },
          { x: 55, y: 0 },
        ],
        strokeColor: '#059669',
      },
      pwmTime,
      '#059669'
    ),
    makeBaseElement(
      {
        id: 'pwm_note',
        type: 'text',
        x: 120,
        y: 355,
        width: 390,
        height: 60,
        text: 'Duty Cycle: 62% @ 24kHz · Vgs(th) margin +4.8V verified',
        strokeColor: '#047857',
        fontSize: 16,
      },
      pwmTime,
      '#047857'
    ),
  ];

  // 3. Math: Taylor Series & Linear Algebra
  const mathTime1 = now - 16 * min;
  const eq1 = createMathEquationElement(
    'd/dx(x^3 - 4*x)',
    100,
    100,
    '#064E3B',
    { text: '3x^2 - 4', latex: '3x^2 - 4', operation: 'Differentiate' }
  );
  const eq2 = createMathEquationElement(
    'integrate(sin(x) + 2x)',
    100,
    220,
    '#064E3B',
    { text: '-cos(x) + x^2 + C', latex: '-\\cos(x) + x^2 + C', operation: 'Integrate' }
  );
  const mat1 = createMathMatrixElement(
    [
      [2, -1, 0],
      [1, 3, -1],
      [0, 2, 4],
    ],
    'J_jacobian',
    100,
    350,
    '#064E3B'
  );
  const graph2d = createMathGraph2DElement(
    createDefaultGraph2DConfig([
      { id: 'ex1', expression: 'sin(x) + 0.3*cos(2*x)', color: '#059669', visible: true },
      { id: 'ex2', expression: 'x^2 / 8 - 1', color: '#0D9488', visible: true },
    ]),
    460,
    95,
    '#064E3B'
  );
  const mathNote1 = makeBaseElement(
    {
      id: 'math_note_1',
      type: 'rectangle',
      x: 460,
      y: 425,
      width: 340,
      height: 75,
      strokeColor: '#0D9488',
      backgroundColor: '#ECFDF5',
      fillStyle: 'solid',
      text: 'Critical points at x = ±2/√3 · det(J) = 28',
      fontSize: 15,
    },
    mathTime1,
    '#064E3B'
  );

  // 4. Math: Damped Harmonic Oscillator 3D Surface
  const mathTime2 = now - 3 * hr;
  const odeEq = createMathEquationElement(
    'y(t) = exp(-0.35*t) * cos(3.2*t)',
    110,
    110,
    '#064E3B',
    { text: 'ζ = 0.109 (Underdamped)', latex: '\\zeta = 0.109', operation: 'Analyze' }
  );
  const graph3d = createMathGraph3DElement(
    createDefaultGraph3DConfig(),
    420,
    95,
    '#064E3B'
  );
  const odeNote = makeBaseElement(
    {
      id: 'ode_note',
      type: 'text',
      x: 110,
      y: 250,
      width: 270,
      height: 85,
      text: 'Natural ω₀ = 3.22 rad/s\nLog decrement δ = 0.69',
      strokeColor: '#047857',
      fontSize: 16,
    },
    mathTime2,
    '#047857'
  );

  // 5. Architecture: Distributed Event Mesh
  const archTime1 = now - 22 * min;
  const archElements1: WhiteboardElement[] = [
    makeBaseElement(
      {
        id: 'arch1_gw',
        type: 'rectangle',
        x: 90,
        y: 140,
        width: 175,
        height: 86,
        strokeColor: '#064E3B',
        backgroundColor: '#ECFDF5',
        fillStyle: 'solid',
        text: 'Edge API Gateway\nTLS + Rate Limit',
      },
      archTime1,
      '#064E3B'
    ),
    makeBaseElement(
      {
        id: 'arch1_arr1',
        type: 'arrow',
        x: 265,
        y: 183,
        width: 85,
        height: 10,
        points: [
          { x: 0, y: 0 },
          { x: 85, y: 0 },
        ],
        endArrowhead: true,
        strokeColor: '#059669',
      },
      archTime1,
      '#059669'
    ),
    makeBaseElement(
      {
        id: 'arch1_bus',
        type: 'diamond',
        x: 350,
        y: 120,
        width: 150,
        height: 125,
        strokeColor: '#059669',
        backgroundColor: '#D1FAE5',
        fillStyle: 'solid',
        text: 'Event Router\nKafka Mesh',
      },
      archTime1,
      '#064E3B'
    ),
    makeBaseElement(
      {
        id: 'arch1_arr2',
        type: 'arrow',
        x: 500,
        y: 183,
        width: 85,
        height: 10,
        points: [
          { x: 0, y: 0 },
          { x: 85, y: 0 },
        ],
        endArrowhead: true,
        strokeColor: '#059669',
      },
      archTime1,
      '#059669'
    ),
    makeBaseElement(
      {
        id: 'arch1_worker',
        type: 'rectangle',
        x: 585,
        y: 140,
        width: 185,
        height: 86,
        strokeColor: '#064E3B',
        backgroundColor: '#FFFFFF',
        fillStyle: 'solid',
        text: 'Worker Shards (x12)\nP99 Latency 11.4ms',
      },
      archTime1,
      '#064E3B'
    ),
    makeBaseElement(
      {
        id: 'arch1_cache',
        type: 'ellipse',
        x: 345,
        y: 300,
        width: 160,
        height: 90,
        strokeColor: '#0D9488',
        backgroundColor: '#CCFBF1',
        fillStyle: 'solid',
        text: 'Vector Cache\n99.2% Hit Rate',
      },
      archTime1,
      '#064E3B'
    ),
  ];

  // 6. Architecture: AI Telemetry Stream
  const archTime2 = now - 6 * hr;
  const archElements2: WhiteboardElement[] = [
    makeBaseElement(
      {
        id: 'arch2_in',
        type: 'rectangle',
        x: 110,
        y: 150,
        width: 170,
        height: 80,
        backgroundColor: '#ECFDF5',
        fillStyle: 'solid',
        text: 'Telemetry Ingest\ngRPC Stream',
      },
      archTime2,
      inkColor
    ),
    makeBaseElement(
      {
        id: 'arch2_arr',
        type: 'arrow',
        x: 280,
        y: 190,
        width: 90,
        height: 10,
        points: [
          { x: 0, y: 0 },
          { x: 90, y: 0 },
        ],
        endArrowhead: true,
        strokeColor: '#059669',
      },
      archTime2,
      '#059669'
    ),
    makeBaseElement(
      {
        id: 'arch2_proc',
        type: 'rectangle',
        x: 370,
        y: 150,
        width: 210,
        height: 80,
        backgroundColor: '#D1FAE5',
        fillStyle: 'solid',
        text: 'Batch Quantizer\n12,400 tok/sec',
      },
      archTime2,
      inkColor
    ),
    makeBaseElement(
      {
        id: 'arch2_note',
        type: 'text',
        x: 120,
        y: 280,
        width: 440,
        height: 45,
        text: 'Checkpointed ring buffer across EU & US-West edge PoPs',
        strokeColor: '#047857',
      },
      archTime2,
      '#047857'
    ),
  ];

  // 7. Wireframes: Mobile Detent Workspace
  const wireTime1 = now - 48 * min;
  const wireElements1: WhiteboardElement[] = [
    makeBaseElement(
      {
        id: 'wf1_phone',
        type: 'rectangle',
        x: 180,
        y: 70,
        width: 270,
        height: 450,
        strokeColor: '#064E3B',
        backgroundColor: '#FFFFFF',
        fillStyle: 'solid',
      },
      wireTime1,
      '#064E3B'
    ),
    makeBaseElement(
      {
        id: 'wf1_hdr',
        type: 'rectangle',
        x: 196,
        y: 88,
        width: 238,
        height: 44,
        strokeColor: '#10B981',
        backgroundColor: '#ECFDF5',
        fillStyle: 'solid',
        text: '≡ SPARK · Inspector Sheet',
      },
      wireTime1,
      '#064E3B'
    ),
    makeBaseElement(
      {
        id: 'wf1_sheet',
        type: 'rectangle',
        x: 196,
        y: 300,
        width: 238,
        height: 204,
        strokeColor: '#059669',
        backgroundColor: '#D1FAE5',
        fillStyle: 'solid',
        text: 'Detent 55vh Drawer\nStroke · Fill · Sim Probes',
      },
      wireTime1,
      '#064E3B'
    ),
    makeBaseElement(
      {
        id: 'wf1_callout',
        type: 'text',
        x: 485,
        y: 170,
        width: 250,
        height: 90,
        text: 'Pinch-to-zoom locked at 100% UI scale + sticky corner tools',
        strokeColor: '#047857',
      },
      wireTime1,
      '#047857'
    ),
  ];

  // 8. Wireframes: Spatial 3D HUD Blueprint
  const wireTime2 = now - 12 * hr;
  const wireElements2: WhiteboardElement[] = [
    makeBaseElement(
      {
        id: 'wf2_win',
        type: 'rectangle',
        x: 110,
        y: 90,
        width: 580,
        height: 360,
        strokeColor: '#064E3B',
        backgroundColor: '#FFFFFF',
        fillStyle: 'solid',
      },
      wireTime2,
      '#064E3B'
    ),
    makeBaseElement(
      {
        id: 'wf2_bar',
        type: 'rectangle',
        x: 132,
        y: 110,
        width: 536,
        height: 44,
        strokeColor: '#10B981',
        backgroundColor: '#ECFDF5',
        fillStyle: 'solid',
        text: 'Search / Ctrl+K  |  Constellations · Helix · Matrix  |  + New',
      },
      wireTime2,
      '#064E3B'
    ),
    makeBaseElement(
      {
        id: 'wf2_card1',
        type: 'rectangle',
        x: 150,
        y: 185,
        width: 220,
        height: 150,
        strokeColor: '#059669',
        backgroundColor: '#F3FBF7',
        fillStyle: 'solid',
        text: '3D Board Slab\nZoom < 15 → Semantic LOD',
      },
      wireTime2,
      '#064E3B'
    ),
    makeBaseElement(
      {
        id: 'wf2_card2',
        type: 'rectangle',
        x: 410,
        y: 185,
        width: 220,
        height: 150,
        strokeColor: '#059669',
        backgroundColor: '#F3FBF7',
        fillStyle: 'solid',
        text: '📍 Resume Where Left Off\nInline Rename + Open CTA',
      },
      wireTime2,
      '#064E3B'
    ),
  ];

  const rawSeeds = [
    createRecordFromElements({
      id: 'canvas-rc-filter',
      title: 'Active RC Filter & Op-Amp Buffer',
      category: 'Circuits',
      tags: ['analog', 'filter', 'opamp', 'spice'],
      updatedAt: now - 4 * min,
      camera: { x: 20, y: 10, zoom: 0.92 },
      elements: rcElements,
    }),
    createRecordFromElements({
      id: 'canvas-math-calculus',
      title: 'Symbolic Calculus & Jacobian Lab',
      category: 'Math',
      tags: ['calculus', 'matrix', '2d-plot', 'jacobian'],
      updatedAt: mathTime1,
      camera: { x: 10, y: 15, zoom: 0.88 },
      elements: [eq1, eq2, mat1, graph2d, mathNote1],
    }),
    createRecordFromElements({
      id: 'canvas-event-mesh',
      title: 'Distributed Event Mesh & Edge Cache',
      category: 'Architecture',
      tags: ['kafka', 'edge', 'cache', 'latency'],
      updatedAt: archTime1,
      camera: { x: 15, y: 20, zoom: 0.95 },
      elements: archElements1,
    }),
    createRecordFromElements({
      id: 'canvas-pwm-driver',
      title: '24kHz PWM Motor Gate Drive',
      category: 'Circuits',
      tags: ['pwm', 'mosfet', 'power', 'flyback'],
      updatedAt: pwmTime,
      camera: { x: 25, y: 20, zoom: 0.9 },
      elements: pwmElements,
    }),
    createRecordFromElements({
      id: 'canvas-mobile-detent',
      title: 'Mobile Sheet & Gesture Detents',
      category: 'Wireframes',
      tags: ['mobile', 'ui', 'sheet', 'touch'],
      updatedAt: wireTime1,
      camera: { x: 10, y: 15, zoom: 0.92 },
      elements: wireElements1,
    }),
    createRecordFromElements({
      id: 'canvas-ode-oscillator',
      title: 'Damped Harmonic Oscillator 3D',
      category: 'Math',
      tags: ['ode', '3d-surface', 'damping'],
      updatedAt: mathTime2,
      camera: { x: 15, y: 15, zoom: 0.88 },
      elements: [odeEq, graph3d, odeNote],
    }),
    createRecordFromElements({
      id: 'canvas-ai-telemetry',
      title: 'AI Inference Telemetry Bus',
      category: 'Architecture',
      tags: ['grpc', 'telemetry', 'streaming'],
      updatedAt: archTime2,
      camera: { x: 20, y: 15, zoom: 0.94 },
      elements: archElements2,
    }),
    createRecordFromElements({
      id: 'canvas-spatial-hud',
      title: '3D Workspace HUD Blueprint',
      category: 'Wireframes',
      tags: ['threejs', 'spatial', 'lod', 'hud'],
      updatedAt: wireTime2,
      camera: { x: 25, y: 15, zoom: 0.9 },
      elements: wireElements2,
    }),
  ];

  const placed: SpatialPosition[] = [];
  return rawSeeds.map((seed, idx) => {
    const pos = generateFreeSpacePosition(seed.id, idx, rawSeeds.length, placed);
    placed.push(pos);
    return { ...seed, spatialPosition: pos };
  });
}

export function createBlankSpatialCanvas(
  title = 'Untitled Canvas',
  category: CanvasCategory = 'Architecture',
  options?: {
    canvasThemeId?: CanvasThemeId;
    spatialPosition?: SpatialPosition;
  }
): SpatialCanvasRecord {
  const now = Date.now();
  const id = `canvas-${now.toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const camera: CameraState = { x: 0, y: 0, zoom: 1 };
  const elements: WhiteboardElement[] = [];
  return {
    id,
    title: title.trim() || 'Untitled Canvas',
    category,
    tags: [category.toLowerCase(), 'blank'],
    createdAt: now,
    updatedAt: now,
    elementCount: 0,
    camera,
    canvasThemeId: options?.canvasThemeId || 'emerald-minimal',
    spatialPosition: options?.spatialPosition || {
      x: 0,
      y: 0.6,
      z: 6,
      rotY: 0,
      pinned: true,
    },
    elements,
    lastViewport: extractLastViewport(elements, camera),
  };
}

export function loadHubCanvases(legacyElements?: WhiteboardElement[]): SpatialCanvasRecord[] {
  try {
    const raw = localStorage.getItem(HUB_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const placed: SpatialPosition[] = [];
        return parsed.map((item, idx) => {
          const elements = Array.isArray(item.elements) ? item.elements : [];
          const camera = item.camera || { x: 0, y: 0, zoom: 1 };
          const activeCount = elements.filter((e: WhiteboardElement) => !e.isDeleted).length;
          let spatialPosition: SpatialPosition | undefined =
            item.spatialPosition &&
            typeof item.spatialPosition.x === 'number' &&
            typeof item.spatialPosition.y === 'number' &&
            typeof item.spatialPosition.z === 'number'
              ? item.spatialPosition
              : undefined;
          if (!spatialPosition) {
            spatialPosition = generateFreeSpacePosition(
              String(item.id || idx),
              idx,
              parsed.length,
              placed
            );
          }
          placed.push(spatialPosition);
          return {
            ...item,
            category: CANVAS_CATEGORIES[item.category as CanvasCategory]
              ? (item.category as CanvasCategory)
              : 'Architecture',
            tags: Array.isArray(item.tags) ? item.tags : [],
            elementCount: activeCount,
            camera,
            canvasThemeId: item.canvasThemeId || 'emerald-minimal',
            spatialPosition,
            elements,
            lastViewport: item.lastViewport || extractLastViewport(elements, camera),
          };
        });
      }
    }
  } catch {
    // Fallback to starter seed canvases
  }

  const seeds = createSeedCanvases();
  if (legacyElements && legacyElements.filter((el) => !el.isDeleted).length > 0) {
    const now = Date.now();
    const recovered = createRecordFromElements({
      id: 'canvas-recovered-session',
      title: 'Current Active Workspace',
      category: 'Architecture',
      tags: ['recent', 'workspace'],
      updatedAt: now,
      camera: { x: 0, y: 0, zoom: 1 },
      elements: legacyElements,
    });
    const combined = [recovered, ...seeds];
    saveHubCanvases(combined);
    return combined;
  }

  saveHubCanvases(seeds);
  return seeds;
}

export function saveHubCanvases(canvases: SpatialCanvasRecord[]): void {
  try {
    localStorage.setItem(HUB_STORAGE_KEY, JSON.stringify(canvases));
  } catch {
    // Ignore localStorage quota issues gracefully
  }
}

export function loadActiveCanvasId(): string | null {
  try {
    return localStorage.getItem(ACTIVE_CANVAS_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function saveActiveCanvasId(id: string | null): void {
  try {
    if (id) {
      localStorage.setItem(ACTIVE_CANVAS_STORAGE_KEY, id);
    } else {
      localStorage.removeItem(ACTIVE_CANVAS_STORAGE_KEY);
    }
  } catch {
    // Ignore storage issues
  }
}
