import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  ArrowDown,
  ArrowUp,
  Box,
  Calculator,
  Code2,
  Copy,
  Maximize2,
  MousePointerClick,
  RotateCcw,
  RotateCw,
  Sigma,
  Sparkles,
  Trash2,
} from 'lucide-react';
import {
  CameraState,
  CircuitKind,
  FillStyle,
  FontFamily,
  Point,
  RemoteCursorPayload,
  Sloppiness,
  StrokeStyle,
  ToolType,
  TriangleVariant,
  WhiteboardElement,
} from '../types';
import { ForgeTheme } from '../themes';
import {
  computeUniformGridMetrics,
  computeResizedElement,
  computeWireJunctions,
  getCanvasFontCss,
  getNormalizedBounds,
  hitTestElement,
  pointToSegmentDistance,
  ResizeHandleDir,
  rotatePointAround,
  sampleCurvedWirePoints,
  updateBoundConnectors,
} from '../sketchEngine';
import {
  CIRCUIT_CATALOG,
  findNearestSnapTerminal,
  WorldTerminal,
} from '../engineeringComponents';
import { applyRecognizedShape, recognizeFreehandShape } from '../shapeRecognition';
import { isTunableCircuitKind, normalizeComponentValueInput } from '../circuitSimulator';
import {
  drawElementOnContext,
  drawRemoteCursor,
  drawWireJunctionDots,
  getSimulatedWireColor,
} from '../canvasRenderer';
import { GateLogicEvaluation, isLogicGateKind } from '../digitalLogic';
import { buildWebpageDocument } from '../webpageTemplates';
import {
  MathEquationOverlayCard,
  MathGraph2DOverlayCard,
  MathGraph3DOverlayCard,
  MathMatrixOverlayCard,
} from './math/MathCanvasOverlays';

interface CanvasProps {
  elements: WhiteboardElement[];
  selectedIds: string[];
  activeTool: ToolType;
  pendingCircuitKind: CircuitKind | null;
  camera: CameraState;
  theme: ForgeTheme;
  showGrid: boolean;
  shapeSnapEnabled: boolean;
  remoteCursors: Record<string, RemoteCursorPayload>;
  liveReadouts?: Record<string, string>;
  wireVoltages?: Record<string, number>;
  croWaveforms?: Record<string, { samples: number[]; connected: boolean }>;
  logicResults?: Record<string, GateLogicEvaluation>;
  simActive?: boolean;
  selectedCodeIds?: Set<string>;
  defaultStyle: {
    strokeColor: string;
    backgroundColor: string;
    fillStyle: FillStyle;
    strokeWidth: number;
    strokeStyle: StrokeStyle;
    sloppiness: Sloppiness;
    fontFamily: FontFamily;
    fontSize: number;
    opacity: number;
    triangleVariant: TriangleVariant;
  };
  onCameraChange: (next: CameraState) => void;
  onSelectIds: (ids: string[]) => void;
  onElementsChange: (next: WhiteboardElement[], commitHistory?: boolean) => void;
  onToolComplete: (nextTool?: ToolType) => void;
  onInstrumentClick?: (elementId: string) => void;
  onSwitchToggle?: (elementId: string) => void;
  onWebpageClick?: (elementId: string) => void;
  onCursorMove?: (worldPt: Point) => void;
  onStatusToast?: (msg: string) => void;
  onRotateSelected?: (deltaRad: number) => void;
  onResetRotationSelected?: () => void;
  onDuplicateSelected?: () => void;
  onDeleteSelected?: () => void;
  onLayerChange?: (direction: 'forward' | 'backward') => void;
  onSelectAll?: () => void;
  onFitToScreen?: () => void;
  onResetZoom?: () => void;
  onSelectTool?: (tool: ToolType) => void;
  onUpdateElementById?: (id: string, patch: Partial<WhiteboardElement>, commitHistory?: boolean) => void;
  onOpenMathStudio?: (elementId?: string, tab?: 'equation' | 'matrix' | 'engineering' | 'history') => void;
  onPlotEquation2D?: (el: WhiteboardElement) => void;
  onPlotEquation3D?: (el: WhiteboardElement) => void;
  onQuickMathAction?: (
    el: WhiteboardElement,
    op: 'simplify' | 'expand' | 'factor' | 'diff' | 'integrate' | 'solve'
  ) => void;
}

type HandleDir = ResizeHandleDir;

interface LaserPoint {
  x: number;
  y: number;
  createdAt: number;
  strokeId: number;
}

interface ContextMenuState {
  screenX: number;
  screenY: number;
  hitElementId: string | null;
}

interface InteractionState {
  mode: 'none' | 'pan' | 'pinch' | 'draw' | 'move' | 'resize' | 'marquee' | 'erase' | 'wire-vertex' | 'laser';
  startWorld: Point;
  startScreen: Point;
  startCamera: CameraState;
  draftElement: WhiteboardElement | null;
  snapshotBefore: WhiteboardElement[];
  resizeHandle?: HandleDir;
  initialBounds?: { x: number; y: number; width: number; height: number };
  initialElementsMap?: Map<string, WhiteboardElement>;
  marqueeRect?: { x: number; y: number; width: number; height: number };
  erasedAny?: boolean;
  clickedInstrumentId?: string;
  clickedSwitchId?: string;
  clickedWebpageId?: string;
  didMove?: boolean;
  wireId?: string;
  wirePointIndex?: number;
}

function hasWebpageCode(el: WhiteboardElement): boolean {
  return Boolean(
    (el.htmlCode && el.htmlCode.trim().length > 0) ||
      (el.cssCode && el.cssCode.trim().length > 0) ||
      (el.jsCode && el.jsCode.trim().length > 0)
  );
}

interface LiveWebpageOverlayCardProps {
  element: WhiteboardElement;
  camera: CameraState;
  activeTool: ToolType;
  isSelected: boolean;
  isInteractive: boolean;
  onToggleInteractive: (id: string) => void;
  onOpenEditor: (id: string) => void;
}

const LiveWebpageOverlayCard: React.FC<LiveWebpageOverlayCardProps> = React.memo(
  ({
    element,
    camera,
    activeTool,
    isSelected,
    isInteractive,
    onToggleInteractive,
    onOpenEditor,
  }) => {
    const b = getNormalizedBounds(element);
    const screenW = b.width * camera.zoom;
    const screenH = b.height * camera.zoom;
    const hasCode = hasWebpageCode(element);

    const fullDoc = useMemo(
      () =>
        hasCode
          ? buildWebpageDocument({
              title: element.webpageTitle,
              htmlCode: element.htmlCode,
              cssCode: element.cssCode,
              jsCode: element.jsCode,
              autoPolish: element.webpageAutoPolish,
            })
          : '',
      [
        hasCode,
        element.webpageTitle,
        element.htmlCode,
        element.cssCode,
        element.jsCode,
        element.webpageAutoPolish,
      ]
    );

    if (!hasCode || screenW < 40 || screenH < 40) return null;

    const headerH = Math.min(30, Math.max(24, b.height * 0.16));
    const headerScreenH = headerH * camera.zoom;
    const insetWorld = Math.max(1.5, element.strokeWidth * 0.8) * 0.5 + 0.5;
    const contentWorldW = Math.max(20, b.width - insetWorld * 2);
    const contentWorldH = Math.max(20, b.height - headerH - insetWorld);
    const contentScreenW = contentWorldW * camera.zoom;
    const contentScreenH = contentWorldH * camera.zoom;

    // Render into a clean virtual viewport width so responsive web layouts look sharp inside any canvas card size
    const virtualW = Math.max(contentWorldW, 820);
    const iframeScale = contentScreenW / virtualW;
    const virtualH = contentScreenH / Math.max(0.05, iframeScale);

    const canInteract = isInteractive && activeTool === 'select';
    const showControls = activeTool === 'select' && screenW >= 150;
    const showLabels = screenW >= 245;
    const bottomRadius = Math.max(0, (12 - insetWorld) * camera.zoom);

    return (
      <div
        data-testid={`webpage-window-${element.id}`}
        style={{
          position: 'absolute',
          left: `${camera.x + b.x * camera.zoom}px`,
          top: `${camera.y + b.y * camera.zoom}px`,
          width: `${screenW}px`,
          height: `${screenH}px`,
          transform:
            element.angle && Math.abs(element.angle) > 0.001
              ? `rotate(${element.angle}rad)`
              : undefined,
          transformOrigin: 'center center',
          opacity: Math.max(0.05, Math.min(1, element.opacity / 100)),
          pointerEvents: 'none',
        }}
      >
        {/* Top chrome control strip aligned over the canvas-drawn browser bar */}
        <div
          style={{
            height: `${headerScreenH}px`,
            paddingRight: `${Math.max(6, 8 * camera.zoom)}px`,
          }}
          className="flex items-center justify-end gap-1"
        >
          {showControls && (
            <div
              className="pointer-events-auto flex items-center gap-1"
              onPointerDown={(e) => e.stopPropagation()}
              onDoubleClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                data-testid={`webpage-interact-${element.id}`}
                aria-pressed={canInteract}
                title={
                  canInteract
                    ? 'Exit live page interaction (return to drag/select)'
                    : 'Interact with buttons & scroll inside preview'
                }
                onClick={() => onToggleInteractive(element.id)}
                className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold transition-colors shadow-sm ${
                  canInteract
                    ? 'bg-emerald-600 text-white'
                    : isSelected
                    ? 'bg-[var(--rf-surface-elevated)] text-[var(--rf-text)] border border-[var(--rf-border)] hover:border-[var(--rf-accent)]'
                    : 'bg-[var(--rf-surface-elevated)]/85 text-[var(--rf-text-muted)] border border-[var(--rf-border)] hover:text-[var(--rf-text)]'
                }`}
              >
                <MousePointerClick className="w-3 h-3 shrink-0" />
                {showLabels && <span>{canInteract ? 'Live' : 'Interact'}</span>}
              </button>

              <button
                type="button"
                data-testid={`webpage-edit-${element.id}`}
                title="Edit HTML / CSS / JS code"
                onClick={() => onOpenEditor(element.id)}
                className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[var(--rf-accent)] text-[var(--rf-accent-fg)] hover:opacity-95 transition-opacity shadow-sm"
              >
                <Code2 className="w-3 h-3 shrink-0" />
                {showLabels && <span>Code</span>}
              </button>
            </div>
          )}
        </div>

        {/* Live Sandboxed Webpage Preview Viewport */}
        <div
          style={{
            marginLeft: `${insetWorld * camera.zoom}px`,
            width: `${contentScreenW}px`,
            height: `${contentScreenH}px`,
            borderBottomLeftRadius: `${bottomRadius}px`,
            borderBottomRightRadius: `${bottomRadius}px`,
            overflow: 'hidden',
            background: '#ffffff',
            pointerEvents: canInteract ? 'auto' : 'none',
          }}
        >
          <iframe
            data-testid={`webpage-canvas-preview-${element.id}`}
            title={element.webpageTitle || 'Live Webpage Preview'}
            sandbox="allow-scripts"
            srcDoc={fullDoc}
            style={{
              width: `${virtualW}px`,
              height: `${virtualH}px`,
              transform: `scale(${iframeScale})`,
              transformOrigin: 'top left',
              border: 0,
              display: 'block',
              background: '#ffffff',
              pointerEvents: canInteract ? 'auto' : 'none',
            }}
          />
        </div>
      </div>
    );
  }
);

function makeId(prefix = 'el'): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function projectPointToSegment(p: Point, a: Point, b: Point): Point {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return a;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq));
  return { x: a.x + t * dx, y: a.y + t * dy };
}

function findNearestWireSnapPoint(
  elements: WhiteboardElement[],
  worldPt: Point,
  maxDist = 14
): Point | null {
  let best: Point | null = null;
  let bestD = maxDist;
  for (const el of elements) {
    if (el.isDeleted || el.type !== 'wire' || !el.points || el.points.length < 2) continue;
    for (let i = 0; i < el.points.length - 1; i++) {
      const a = { x: el.x + el.points[i].x, y: el.y + el.points[i].y };
      const b = { x: el.x + el.points[i + 1].x, y: el.y + el.points[i + 1].y };
      const d = pointToSegmentDistance(worldPt, a, b);
      if (d < bestD) {
        bestD = d;
        best = projectPointToSegment(worldPt, a, b);
      }
    }
  }
  return best;
}

export const Canvas: React.FC<CanvasProps> = ({
  elements,
  selectedIds,
  activeTool,
  pendingCircuitKind,
  camera,
  theme,
  showGrid,
  shapeSnapEnabled,
  remoteCursors,
  liveReadouts,
  wireVoltages,
  croWaveforms,
  logicResults,
  simActive,
  selectedCodeIds,
  defaultStyle,
  onCameraChange,
  onSelectIds,
  onElementsChange,
  onToolComplete,
  onInstrumentClick,
  onSwitchToggle,
  onWebpageClick,
  onCursorMove,
  onStatusToast,
  onRotateSelected,
  onResetRotationSelected,
  onDuplicateSelected,
  onDeleteSelected,
  onLayerChange,
  onSelectAll,
  onFitToScreen,
  onResetZoom,
  onSelectTool,
  onUpdateElementById,
  onOpenMathStudio,
  onPlotEquation2D,
  onPlotEquation3D,
  onQuickMathAction,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const laserCanvasRef = useRef<HTMLCanvasElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const editOpenedAtRef = useRef<number>(0);
  const spaceHeldRef = useRef(false);
  const [snapTarget, setSnapTarget] = useState<WorldTerminal | null>(null);
  const [wireSnapPt, setWireSnapPt] = useState<Point | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [interactiveWebpageId, setInteractiveWebpageId] = useState<string | null>(null);
  const [renderTick, setRenderTick] = useState(0);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  useEffect(() => {
    if (activeTool !== 'select' && interactiveWebpageId) {
      setInteractiveWebpageId(null);
    }
  }, [activeTool, interactiveWebpageId]);

  // Ephemeral laser pointer trail state (never stored in elements or undo history)
  const laserPointsRef = useRef<LaserPoint[]>([]);
  const laserStrokeIdRef = useRef(0);
  const laserHoverWorldRef = useRef<Point | null>(null);
  const laserRafRef = useRef<number | null>(null);
  const cameraRef = useRef<CameraState>(camera);
  cameraRef.current = camera;
  const activeToolRef = useRef<ToolType>(activeTool);
  activeToolRef.current = activeTool;

  const interactionRef = useRef<InteractionState>({
    mode: 'none',
    startWorld: { x: 0, y: 0 },
    startScreen: { x: 0, y: 0 },
    startCamera: camera,
    draftElement: null,
    snapshotBefore: elements,
  });

  // Multi-touch pinch/pan & touch long-press tracking
  const activePointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchStartRef = useRef<{
    dist: number;
    midX: number;
    midY: number;
    startCamera: CameraState;
  } | null>(null);
  const longPressTimerRef = useRef<number | null>(null);

  const clearLongPressTimer = useCallback(() => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const screenToWorld = useCallback(
    (clientX: number, clientY: number): Point => {
      const rect = canvasRef.current?.getBoundingClientRect();
      const sx = clientX - (rect?.left || 0);
      const sy = clientY - (rect?.top || 0);
      return {
        x: (sx - camera.x) / camera.zoom,
        y: (sy - camera.y) / camera.zoom,
      };
    },
    [camera]
  );

  // Track Spacebar for temporary pan
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !editingId && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        spaceHeldRef.current = true;
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        spaceHeldRef.current = false;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [editingId]);

  const getSelectionBounds = useCallback(
    (list: WhiteboardElement[], ids: string[]) => {
      const selected = list.filter((e) => !e.isDeleted && ids.includes(e.id));
      if (selected.length === 0) return null;
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (const el of selected) {
        const b = getNormalizedBounds(el);
        if (
          el.angle &&
          Math.abs(el.angle) > 0.001 &&
          el.type !== 'line' &&
          el.type !== 'arrow' &&
          el.type !== 'wire' &&
          el.type !== 'freedraw'
        ) {
          const center = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
          const corners = [
            rotatePointAround({ x: b.x, y: b.y }, center, el.angle),
            rotatePointAround({ x: b.x + b.width, y: b.y }, center, el.angle),
            rotatePointAround({ x: b.x + b.width, y: b.y + b.height }, center, el.angle),
            rotatePointAround({ x: b.x, y: b.y + b.height }, center, el.angle),
          ];
          for (const c of corners) {
            minX = Math.min(minX, c.x);
            minY = Math.min(minY, c.y);
            maxX = Math.max(maxX, c.x);
            maxY = Math.max(maxY, c.y);
          }
        } else {
          minX = Math.min(minX, b.x);
          minY = Math.min(minY, b.y);
          maxX = Math.max(maxX, b.x + b.width);
          maxY = Math.max(maxY, b.y + b.height);
        }
      }
      return { x: minX, y: minY, width: Math.max(8, maxX - minX), height: Math.max(8, maxY - minY) };
    },
    []
  );

  const hitTestResizeHandle = useCallback(
    (worldPt: Point, bounds: { x: number; y: number; width: number; height: number }): HandleDir | null => {
      const pad = 6 / camera.zoom;
      const bx = bounds.x - pad;
      const by = bounds.y - pad;
      const bw = bounds.width + pad * 2;
      const bh = bounds.height + pad * 2;
      const handles: { dir: HandleDir; x: number; y: number }[] = [
        { dir: 'nw', x: bx, y: by },
        { dir: 'n', x: bx + bw / 2, y: by },
        { dir: 'ne', x: bx + bw, y: by },
        { dir: 'e', x: bx + bw, y: by + bh / 2 },
        { dir: 'se', x: bx + bw, y: by + bh },
        { dir: 's', x: bx + bw / 2, y: by + bh },
        { dir: 'sw', x: bx, y: by + bh },
        { dir: 'w', x: bx, y: by + bh / 2 },
      ];
      const tol = 10 / camera.zoom;
      for (const h of handles) {
        if (Math.hypot(worldPt.x - h.x, worldPt.y - h.y) <= tol) {
          return h.dir;
        }
      }
      return null;
    },
    [camera.zoom]
  );

  // Main Canvas paint loop triggered cleanly on state changes
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const dpr = window.devicePixelRatio || 1;
    const width = container.clientWidth;
    const height = container.clientHeight;
    if (canvas.width !== Math.floor(width * dpr) || canvas.height !== Math.floor(height * dpr)) {
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.save();
    ctx.scale(dpr, dpr);

    // Keep canvas background clean (respecting chosen canvas theme without gradient tint)
    ctx.fillStyle = theme.canvasBg;
    ctx.fillRect(0, 0, width, height);

    // Draw crisp uniform graph-paper grid (self-adjusts world step so screen square size stays constant across all zoom levels)
    if (showGrid) {
      const { screenStep } = computeUniformGridMetrics(camera.zoom, 24);
      const offsetX = ((camera.x % screenStep) + screenStep) % screenStep;
      const offsetY = ((camera.y % screenStep) + screenStep) % screenStep;

      ctx.save();
      ctx.strokeStyle = theme.gridColor;
      ctx.globalAlpha = 1;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = offsetX; x <= width + 0.5; x += screenStep) {
        const sx = Math.round(x) + 0.5;
        if (sx < -1 || sx > width + 1) continue;
        ctx.moveTo(sx, 0);
        ctx.lineTo(sx, height);
      }
      for (let y = offsetY; y <= height + 0.5; y += screenStep) {
        const sy = Math.round(y) + 0.5;
        if (sy < -1 || sy > height + 1) continue;
        ctx.moveTo(0, sy);
        ctx.lineTo(width, sy);
      }
      ctx.stroke();
      ctx.restore();
    }

    // Apply camera transform
    ctx.translate(camera.x, camera.y);
    ctx.scale(camera.zoom, camera.zoom);

    const showTerminals =
      activeTool === 'arrow' || activeTool === 'line' || activeTool === 'wire';
    const triggerImageReload = () => setRenderTick((t) => t + 1);

    // Draw frames first, then non-frame elements
    const activeElements = elements.filter((e) => !e.isDeleted);
    const frames = activeElements.filter((e) => e.type === 'frame');
    const others = activeElements.filter((e) => e.type !== 'frame');

    for (const f of frames) {
      drawElementOnContext(ctx, f, theme, { onImageLoad: triggerImageReload });
    }
    for (const el of others) {
      if (el.id === editingId && el.type === 'text') continue;
      const wb = el.type === 'webpage' ? getNormalizedBounds(el) : null;
      const hasLiveOverlay = Boolean(
        wb && wb.width * camera.zoom >= 40 && wb.height * camera.zoom >= 40
      );
      drawElementOnContext(ctx, el, theme, {
        showTerminals,
        liveReadouts,
        wireVoltages,
        croWaveforms,
        logicResults,
        simActive,
        selectedCodeIds,
        liveWebpageOverlay: hasLiveOverlay,
        onImageLoad: triggerImageReload,
      });
    }

    // Draw draft element if actively drawing
    const draft = interactionRef.current.draftElement;
    if (draft) {
      drawElementOnContext(ctx, draft, theme, { showTerminals, wireVoltages });
    }

    // Draw solder junction dots where wires form T-junctions or 3-way nodes
    const junctions = computeWireJunctions(
      draft && draft.type === 'wire' ? [...activeElements, draft] : activeElements
    );
    if (junctions.length > 0) {
      drawWireJunctionDots(ctx, junctions, (pt) => {
        if (wireVoltages) {
          for (const el of activeElements) {
            if ((el.type !== 'wire' && el.type !== 'line') || !el.points?.length) continue;
            const liveV = wireVoltages[el.id];
            if (typeof liveV !== 'number') continue;
            for (const p of el.points) {
              if (Math.hypot(el.x + p.x - pt.x, el.y + p.y - pt.y) <= 10) {
                return getSimulatedWireColor(liveV, theme.defaultInk);
              }
            }
          }
        }
        return theme.defaultInk;
      });
    }

    // Draw snap terminal or wire T-junction highlight
    const activeSnap = snapTarget
      ? { x: snapTarget.x, y: snapTarget.y }
      : wireSnapPt;
    if (activeSnap) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(activeSnap.x, activeSnap.y, 7 / camera.zoom, 0, Math.PI * 2);
      ctx.strokeStyle = theme.accentColor;
      ctx.lineWidth = 2.2 / camera.zoom;
      ctx.fillStyle = theme.accentSoft;
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // Draw selection bounding box / interactive wire bend & arc handles
    const selectedWire =
      activeTool === 'select' && !editingId && selectedIds.length === 1
        ? activeElements.find(
            (e) => e.id === selectedIds[0] && e.type === 'wire' && e.points && e.points.length >= 2
          )
        : undefined;

    if (selectedWire && selectedWire.points) {
      const worldPts = selectedWire.points.map((p) => ({
        x: selectedWire.x + p.x,
        y: selectedWire.y + p.y,
      }));
      ctx.save();
      const invZoom = 1 / camera.zoom;

      // Highlight selected wire path softly
      ctx.strokeStyle = theme.accentColor;
      ctx.globalAlpha = 0.28;
      ctx.lineWidth = Math.max(6, selectedWire.strokeWidth + 4) * invZoom;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      const previewPts =
        selectedWire.wireRouting === 'curved' && worldPts.length >= 3
          ? sampleCurvedWirePoints(worldPts, 14)
          : worldPts;
      ctx.moveTo(previewPts[0].x, previewPts[0].y);
      for (let i = 1; i < previewPts.length; i++) ctx.lineTo(previewPts[i].x, previewPts[i].y);
      ctx.stroke();
      ctx.globalAlpha = 1;

      // Midpoint '+' arc/bend insert handles on every segment
      for (let i = 0; i < worldPts.length - 1; i++) {
        const a = worldPts[i];
        const b = worldPts[i + 1];
        if (Math.hypot(b.x - a.x, b.y - a.y) < 18 * invZoom) continue;
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        const r = 6.2 * invZoom;
        ctx.fillStyle = theme.surfaceElevated;
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1.6 * invZoom;
        ctx.beginPath();
        ctx.arc(mid.x, mid.y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // '+' glyph inside midpoint handle
        const plus = 2.8 * invZoom;
        ctx.beginPath();
        ctx.moveTo(mid.x - plus, mid.y);
        ctx.lineTo(mid.x + plus, mid.y);
        ctx.moveTo(mid.x, mid.y - plus);
        ctx.lineTo(mid.x, mid.y + plus);
        ctx.stroke();
      }

      // Existing wire vertex & endpoint handles
      worldPts.forEach((pt, idx) => {
        const isEnd = idx === 0 || idx === worldPts.length - 1;
        const r = (isEnd ? 5.8 : 6.2) * invZoom;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2);
        ctx.fillStyle = isEnd ? theme.surfaceElevated : theme.accentColor;
        ctx.strokeStyle = isEnd ? theme.accentColor : theme.surfaceElevated;
        ctx.lineWidth = 2 * invZoom;
        ctx.fill();
        ctx.stroke();
      });

      ctx.restore();
    } else {
      const selBounds = getSelectionBounds(elements, selectedIds);
      if (selBounds && activeTool === 'select' && !editingId) {
        const pad = 6 / camera.zoom;
        const bx = selBounds.x - pad;
        const by = selBounds.y - pad;
        const bw = selBounds.width + pad * 2;
        const bh = selBounds.height + pad * 2;

        ctx.save();
        ctx.strokeStyle = theme.accentColor;
        ctx.lineWidth = 1.5 / camera.zoom;
        ctx.setLineDash([5 / camera.zoom, 4 / camera.zoom]);
        ctx.strokeRect(bx, by, bw, bh);
        ctx.setLineDash([]);

        const handleSize = 8 / camera.zoom;
        const handlePts = [
          { x: bx, y: by },
          { x: bx + bw / 2, y: by },
          { x: bx + bw, y: by },
          { x: bx + bw, y: by + bh / 2 },
          { x: bx + bw, y: by + bh },
          { x: bx + bw / 2, y: by + bh },
          { x: bx, y: by + bh },
          { x: bx, y: by + bh / 2 },
        ];
        for (const hp of handlePts) {
          ctx.fillStyle = theme.surfaceElevated;
          ctx.strokeStyle = theme.accentColor;
          ctx.lineWidth = 1.6 / camera.zoom;
          ctx.fillRect(hp.x - handleSize / 2, hp.y - handleSize / 2, handleSize, handleSize);
          ctx.strokeRect(hp.x - handleSize / 2, hp.y - handleSize / 2, handleSize, handleSize);
        }
        ctx.restore();
      }
    }

    // Draw marquee selection box
    const marquee = interactionRef.current.marqueeRect;
    if (marquee) {
      ctx.save();
      ctx.fillStyle = theme.accentSoft;
      ctx.strokeStyle = theme.accentColor;
      ctx.lineWidth = 1.2 / camera.zoom;
      ctx.fillRect(marquee.x, marquee.y, marquee.width, marquee.height);
      ctx.strokeRect(marquee.x, marquee.y, marquee.width, marquee.height);
      ctx.restore();
    }

    // Draw remote E2EE collaborator cursors
    for (const cursor of Object.values(remoteCursors)) {
      if (Date.now() - cursor.updatedAt < 15000) {
        drawRemoteCursor(ctx, cursor, camera.zoom);
      }
    }

    ctx.restore();
  }, [
    elements,
    selectedIds,
    activeTool,
    camera,
    theme,
    showGrid,
    remoteCursors,
    liveReadouts,
    wireVoltages,
    croWaveforms,
    logicResults,
    simActive,
    selectedCodeIds,
    snapTarget,
    wireSnapPt,
    editingId,
    renderTick,
    getSelectionBounds,
  ]);

  // Focus inline textarea cleanly whenever editingId becomes active
  useEffect(() => {
    if (!editingId) return;
    editOpenedAtRef.current = Date.now();
    const raf = requestAnimationFrame(() => {
      const ta = textareaRef.current;
      if (ta) {
        ta.focus();
        const len = ta.value.length;
        ta.setSelectionRange(len, len);
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [editingId]);

  // Continuous decay rAF loop for temporary red laser pointer overlay canvas
  const ensureLaserLoop = useCallback(() => {
    if (laserRafRef.current !== null) return;
    const DECAY_MS = 950;

    const frame = () => {
      const overlay = laserCanvasRef.current;
      const container = containerRef.current;
      if (!overlay || !container) {
        laserRafRef.current = null;
        return;
      }

      const dpr = window.devicePixelRatio || 1;
      const width = container.clientWidth;
      const height = container.clientHeight;
      const targetW = Math.floor(width * dpr);
      const targetH = Math.floor(height * dpr);
      if (overlay.width !== targetW || overlay.height !== targetH) {
        overlay.width = targetW;
        overlay.height = targetH;
      }

      const ctx = overlay.getContext('2d');
      if (!ctx) {
        laserRafRef.current = null;
        return;
      }

      const now = performance.now();
      const cam = cameraRef.current;
      laserPointsRef.current = laserPointsRef.current.filter((p) => now - p.createdAt <= DECAY_MS);

      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, overlay.width, overlay.height);
      ctx.scale(dpr, dpr);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      const pts = laserPointsRef.current;
      for (let i = 1; i < pts.length; i++) {
        const p0 = pts[i - 1];
        const p1 = pts[i];
        if (p0.strokeId !== p1.strokeId) continue;

        const life = Math.max(0, 1 - (now - p1.createdAt) / DECAY_MS);
        if (life <= 0) continue;

        const x0 = cam.x + p0.x * cam.zoom;
        const y0 = cam.y + p0.y * cam.zoom;
        const x1 = cam.x + p1.x * cam.zoom;
        const y1 = cam.y + p1.y * cam.zoom;

        // Soft glowing red aura
        ctx.save();
        ctx.strokeStyle = `rgba(239, 68, 68, ${(0.38 * life).toFixed(3)})`;
        ctx.lineWidth = (4 + 8 * life) * Math.min(1.5, Math.max(0.75, cam.zoom));
        ctx.shadowColor = '#ef4444';
        ctx.shadowBlur = 14 * life;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.stroke();
        ctx.restore();

        // Crisp hot laser core
        ctx.strokeStyle = `rgba(255, 64, 64, ${(0.95 * life).toFixed(3)})`;
        ctx.lineWidth = (1.4 + 3.4 * life) * Math.min(1.4, Math.max(0.75, cam.zoom));
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.stroke();
      }

      // Draw active glowing emitter tip on newest laser point or laser hover cursor
      const tipWorld =
        pts.length > 0
          ? pts[pts.length - 1]
          : activeToolRef.current === 'laser'
          ? laserHoverWorldRef.current
          : null;

      if (tipWorld) {
        const latestPt = pts.length > 0 ? pts[pts.length - 1] : null;
        const tipLife = latestPt
          ? Math.max(0, 1 - (now - latestPt.createdAt) / DECAY_MS)
          : 0.85;
        if (tipLife > 0.05) {
          const sx = cam.x + tipWorld.x * cam.zoom;
          const sy = cam.y + tipWorld.y * cam.zoom;
          ctx.save();
          ctx.fillStyle = `rgba(239, 68, 68, ${(0.32 * tipLife).toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(sx, sy, 10 * tipLife, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = `rgba(255, 255, 255, ${(0.95 * tipLife).toFixed(3)})`;
          ctx.strokeStyle = `rgba(239, 68, 68, ${tipLife.toFixed(3)})`;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(sx, sy, 3.6, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.restore();
        }
      }

      ctx.restore();

      if (laserPointsRef.current.length > 0 || (activeToolRef.current === 'laser' && laserHoverWorldRef.current)) {
        laserRafRef.current = requestAnimationFrame(frame);
      } else {
        laserRafRef.current = null;
      }
    };

    laserRafRef.current = requestAnimationFrame(frame);
  }, []);

  // Cleanup rAF on unmount & close context menu on Escape or outside click
  useEffect(() => {
    const onGlobalKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setContextMenu(null);
    };
    window.addEventListener('keydown', onGlobalKey);
    return () => {
      window.removeEventListener('keydown', onGlobalKey);
      clearLongPressTimer();
      if (laserRafRef.current !== null) {
        cancelAnimationFrame(laserRafRef.current);
        laserRafRef.current = null;
      }
    };
  }, [clearLongPressTimer]);

  // Resize observer so canvas adapts cleanly to window or sidebar resizing
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver(() => setRenderTick((t) => t + 1));
    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  const commitInlineEdit = useCallback(() => {
    if (!editingId) return;
    const target = elements.find((e) => e.id === editingId);
    if (!target) {
      setEditingId(null);
      return;
    }
    const trimmed = editingText.trimEnd();
    if (target.type === 'text' && trimmed.trim() === '') {
      onElementsChange(
        elements.filter((e) => e.id !== editingId),
        true
      );
    } else if (target.type === 'circuit') {
      const nextVal =
        target.circuitKind && isTunableCircuitKind(target.circuitKind)
          ? normalizeComponentValueInput(target.circuitKind, trimmed).formatted
          : trimmed;
      onElementsChange(
        elements.map((e) =>
          e.id === editingId
            ? { ...e, componentValue: nextVal, version: e.version + 1, updatedAt: Date.now() }
            : e
        ),
        true
      );
    } else if (target.type === 'frame') {
      onElementsChange(
        elements.map((e) =>
          e.id === editingId
            ? { ...e, frameTitle: trimmed, version: e.version + 1, updatedAt: Date.now() }
            : e
        ),
        true
      );
    } else {
      const lineCount = Math.max(1, trimmed.split('\n').length);
      const maxLineLen = Math.max(4, ...trimmed.split('\n').map((l) => l.length));
      onElementsChange(
        elements.map((e) =>
          e.id === editingId
            ? {
                ...e,
                text: trimmed || undefined,
                width:
                  e.type === 'text'
                    ? Math.max(60, maxLineLen * e.fontSize * 0.56)
                    : e.width,
                height:
                  e.type === 'text'
                    ? Math.max(32, lineCount * e.fontSize * 1.3)
                    : e.height,
                version: e.version + 1,
                updatedAt: Date.now(),
              }
            : e
        ),
        true
      );
    }
    setEditingId(null);
  }, [editingId, editingText, elements, onElementsChange]);

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (contextMenu) setContextMenu(null);
    if (interactiveWebpageId) setInteractiveWebpageId(null);
    if (e.button === 2) return; // Right-click is handled cleanly by onContextMenu

    // Track active pointers for 2-finger pinch-to-zoom & pan on touch screens
    activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (activePointersRef.current.size >= 2) {
      clearLongPressTimer();
      const prevState = interactionRef.current;
      if (
        prevState.mode === 'draw' ||
        prevState.mode === 'move' ||
        prevState.mode === 'resize' ||
        prevState.mode === 'erase' ||
        prevState.mode === 'wire-vertex'
      ) {
        onElementsChange(prevState.snapshotBefore, false);
      }
      const pts = Array.from(activePointersRef.current.values());
      const dist = Math.max(12, Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y));
      const midX = (pts[0].x + pts[1].x) / 2;
      const midY = (pts[0].y + pts[1].y) / 2;
      pinchStartRef.current = {
        dist,
        midX,
        midY,
        startCamera: { ...camera },
      };
      interactionRef.current = {
        mode: 'pinch',
        startWorld: { x: 0, y: 0 },
        startScreen: { x: midX, y: midY },
        startCamera: { ...camera },
        draftElement: null,
        snapshotBefore: prevState.snapshotBefore,
      };
      setRenderTick((t) => t + 1);
      return;
    }

    if (editingId) {
      commitInlineEdit();
    }
    const worldPt = screenToWorld(e.clientX, e.clientY);

    // Schedule long-press touch context menu (520ms) when touching with 1 finger
    clearLongPressTimer();
    if (e.pointerType === 'touch' && activePointersRef.current.size === 1) {
      const touchClientX = e.clientX;
      const touchClientY = e.clientY;
      longPressTimerRef.current = window.setTimeout(() => {
        if (activePointersRef.current.size !== 1) return;
        const st = interactionRef.current;
        if (st.mode === 'pinch' || st.didMove) return;
        const activeList = elements.filter((el) => !el.isDeleted);
        const nonFrames = activeList.filter((el) => el.type !== 'frame').reverse();
        const frames = activeList.filter((el) => el.type === 'frame').reverse();
        const hit =
          nonFrames.find((el) => hitTestElement(el, worldPt, 12 / camera.zoom)) ||
          frames.find((el) => hitTestElement(el, worldPt, 12 / camera.zoom)) ||
          null;
        if (hit && !selectedIds.includes(hit.id)) {
          onSelectIds([hit.id]);
        }
        const menuW = 220;
        const menuH = hit || selectedIds.length > 0 ? 330 : 210;
        setContextMenu({
          screenX: Math.max(8, Math.min(touchClientX, window.innerWidth - menuW - 8)),
          screenY: Math.max(8, Math.min(touchClientY, window.innerHeight - menuH - 8)),
          hitElementId: hit?.id || null,
        });
        interactionRef.current.mode = 'none';
        interactionRef.current.draftElement = null;
        setRenderTick((t) => t + 1);
      }, 520);
    }

    // Text tool: prevent canvas pointerdown from stealing focus away from newly mounted textarea
    if (activeTool === 'text' && e.button === 0 && !spaceHeldRef.current) {
      e.preventDefault();
      const newText: WhiteboardElement = {
        id: makeId('text'),
        type: 'text',
        x: worldPt.x,
        y: worldPt.y,
        width: 160,
        height: 36,
        angle: 0,
        strokeColor: defaultStyle.strokeColor,
        backgroundColor: 'transparent',
        fillStyle: 'none',
        strokeWidth: defaultStyle.strokeWidth,
        strokeStyle: 'solid',
        sloppiness: defaultStyle.sloppiness,
        opacity: defaultStyle.opacity,
        seed: Math.floor(Math.random() * 100000),
        fontFamily: defaultStyle.fontFamily,
        fontSize: defaultStyle.fontSize,
        text: '',
        version: 1,
        updatedAt: Date.now(),
      };
      editOpenedAtRef.current = Date.now();
      onElementsChange([...elements, newText], false);
      onSelectIds([newText.id]);
      setEditingId(newText.id);
      setEditingText('');
      onToolComplete('select');
      return;
    }

    e.currentTarget.setPointerCapture(e.pointerId);

    // Middle mouse button, Hand tool, or Space+drag => Pan
    if (e.button === 1 || activeTool === 'hand' || spaceHeldRef.current) {
      interactionRef.current = {
        mode: 'pan',
        startWorld: worldPt,
        startScreen: { x: e.clientX, y: e.clientY },
        startCamera: { ...camera },
        draftElement: null,
        snapshotBefore: elements,
      };
      return;
    }

    // Laser pointer tool: writes ONLY to temporary overlay canvas (never saved to elements or undo history)
    if (activeTool === 'laser') {
      laserStrokeIdRef.current += 1;
      laserHoverWorldRef.current = worldPt;
      laserPointsRef.current.push({
        x: worldPt.x,
        y: worldPt.y,
        createdAt: performance.now(),
        strokeId: laserStrokeIdRef.current,
      });
      interactionRef.current = {
        mode: 'laser',
        startWorld: worldPt,
        startScreen: { x: e.clientX, y: e.clientY },
        startCamera: camera,
        draftElement: null,
        snapshotBefore: elements,
      };
      ensureLaserLoop();
      return;
    }

    // Stamp pending circuit component directly on click
    if (pendingCircuitKind) {
      const spec = CIRCUIT_CATALOG.find((c) => c.kind === pendingCircuitKind);
      if (spec) {
        const newCircuit: WhiteboardElement = {
          id: makeId('circuit'),
          type: 'circuit',
          circuitKind: spec.kind,
          componentValue: spec.defaultValue,
          frequencyHz: spec.defaultFrequencyHz,
          waveformType: spec.defaultWaveform,
          switchClosed: spec.kind === 'switch' ? false : undefined,
          logicInputA: isLogicGateKind(spec.kind) ? '0' : undefined,
          logicInputB: isLogicGateKind(spec.kind) && spec.kind !== 'gate-not' ? '0' : undefined,
          icPinCount: spec.kind === 'ic-chip' ? 8 : undefined,
          x: worldPt.x - spec.defaultWidth / 2,
          y: worldPt.y - spec.defaultHeight / 2,
          width: spec.defaultWidth,
          height: spec.defaultHeight,
          angle: 0,
          strokeColor: defaultStyle.strokeColor,
          backgroundColor: defaultStyle.backgroundColor,
          fillStyle: defaultStyle.fillStyle,
          strokeWidth: defaultStyle.strokeWidth,
          strokeStyle: defaultStyle.strokeStyle,
          sloppiness: defaultStyle.sloppiness,
          opacity: defaultStyle.opacity,
          seed: Math.floor(Math.random() * 100000),
          fontFamily: defaultStyle.fontFamily,
          fontSize: defaultStyle.fontSize,
          version: 1,
          updatedAt: Date.now(),
        };
        onElementsChange([...elements, newCircuit], true);
        onSelectIds([newCircuit.id]);
        onToolComplete('select');
        return;
      }
    }

    // Eraser tool
    if (activeTool === 'eraser') {
      const hit = [...elements].reverse().find((el) => hitTestElement(el, worldPt, 10 / camera.zoom));
      interactionRef.current = {
        mode: 'erase',
        startWorld: worldPt,
        startScreen: { x: e.clientX, y: e.clientY },
        startCamera: camera,
        draftElement: null,
        snapshotBefore: elements,
        erasedAny: Boolean(hit),
      };
      if (hit) {
        onElementsChange(
          elements.filter((el) => el.id !== hit.id),
          false
        );
      }
      return;
    }

    // Select tool
    if (activeTool === 'select') {
      // 1. Check interactive wire vertex & midpoint arc handles when a single wire is selected
      if (selectedIds.length === 1) {
        const selWire = elements.find(
          (el) => !el.isDeleted && el.id === selectedIds[0] && el.type === 'wire' && el.points && el.points.length >= 2
        );
        if (selWire && selWire.points) {
          const worldPts = selWire.points.map((p) => ({
            x: selWire.x + p.x,
            y: selWire.y + p.y,
          }));
          const tol = 11 / camera.zoom;

          // Existing vertex / endpoint handle hit
          const vIdx = worldPts.findIndex((pt) => Math.hypot(worldPt.x - pt.x, worldPt.y - pt.y) <= tol);
          if (vIdx !== -1) {
            interactionRef.current = {
              mode: 'wire-vertex',
              startWorld: worldPt,
              startScreen: { x: e.clientX, y: e.clientY },
              startCamera: camera,
              draftElement: null,
              snapshotBefore: elements,
              wireId: selWire.id,
              wirePointIndex: vIdx,
            };
            return;
          }

          // Midpoint '+' handle hit -> insert a new controllable arc/bend vertex
          for (let i = 0; i < worldPts.length - 1; i++) {
            const a = worldPts[i];
            const b = worldPts[i + 1];
            if (Math.hypot(b.x - a.x, b.y - a.y) < 18 / camera.zoom) continue;
            const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
            if (Math.hypot(worldPt.x - mid.x, worldPt.y - mid.y) <= tol) {
              const insertedIdx = i + 1;
              const nextWorldPts = [
                ...worldPts.slice(0, insertedIdx),
                worldPt,
                ...worldPts.slice(insertedIdx),
              ];
              const origin = nextWorldPts[0];
              const relPts = nextWorldPts.map((p) => ({ x: p.x - origin.x, y: p.y - origin.y }));
              const xs = relPts.map((p) => p.x);
              const ys = relPts.map((p) => p.y);
              const nextEls = elements.map((el) =>
                el.id === selWire.id
                  ? {
                      ...el,
                      wireRouting: 'curved' as const,
                      x: origin.x,
                      y: origin.y,
                      width: Math.max(1, Math.max(...xs) - Math.min(...xs)),
                      height: Math.max(1, Math.max(...ys) - Math.min(...ys)),
                      points: relPts,
                      version: el.version + 1,
                      updatedAt: Date.now(),
                    }
                  : el
              );
              onElementsChange(nextEls, false);
              interactionRef.current = {
                mode: 'wire-vertex',
                startWorld: worldPt,
                startScreen: { x: e.clientX, y: e.clientY },
                startCamera: camera,
                draftElement: null,
                snapshotBefore: elements,
                wireId: selWire.id,
                wirePointIndex: insertedIdx,
              };
              return;
            }
          }
        }
      }

      const selBounds = getSelectionBounds(elements, selectedIds);
      if (selBounds) {
        const handle = hitTestResizeHandle(worldPt, selBounds);
        if (handle) {
          const map = new Map<string, WhiteboardElement>();
          elements.forEach((el) => {
            if (selectedIds.includes(el.id)) map.set(el.id, structuredClone(el));
          });
          interactionRef.current = {
            mode: 'resize',
            startWorld: worldPt,
            startScreen: { x: e.clientX, y: e.clientY },
            startCamera: camera,
            draftElement: null,
            snapshotBefore: elements,
            resizeHandle: handle,
            initialBounds: selBounds,
            initialElementsMap: map,
          };
          return;
        }
      }

      // Hit test elements top-to-bottom (prefer non-frames over frames)
      const activeList = elements.filter((el) => !el.isDeleted);
      const nonFrames = activeList.filter((el) => el.type !== 'frame').reverse();
      const frames = activeList.filter((el) => el.type === 'frame').reverse();
      const hit =
        nonFrames.find((el) => hitTestElement(el, worldPt, 8 / camera.zoom)) ||
        frames.find((el) => hitTestElement(el, worldPt, 8 / camera.zoom));

      if (hit) {
        let nextSel = selectedIds;
        if (e.shiftKey) {
          nextSel = selectedIds.includes(hit.id)
            ? selectedIds.filter((id) => id !== hit.id)
            : [...selectedIds, hit.id];
        } else if (!selectedIds.includes(hit.id)) {
          nextSel = [hit.id];
        }
        onSelectIds(nextSel);

        const map = new Map<string, WhiteboardElement>();
        elements.forEach((el) => {
          if (nextSel.includes(el.id)) map.set(el.id, structuredClone(el));
        });

        const isInstrument =
          hit.type === 'circuit' &&
          (hit.circuitKind === 'voltmeter' ||
            hit.circuitKind === 'ammeter' ||
            hit.circuitKind === 'oscilloscope' ||
            hit.circuitKind === 'function-generator' ||
            isLogicGateKind(hit.circuitKind));
        const isSwitch = hit.type === 'circuit' && hit.circuitKind === 'switch';
        const isWebpage = hit.type === 'webpage';

        interactionRef.current = {
          mode: 'move',
          startWorld: worldPt,
          startScreen: { x: e.clientX, y: e.clientY },
          startCamera: camera,
          draftElement: null,
          snapshotBefore: elements,
          initialElementsMap: map,
          clickedInstrumentId: isInstrument && !e.shiftKey ? hit.id : undefined,
          clickedSwitchId: isSwitch && !e.shiftKey ? hit.id : undefined,
          clickedWebpageId: isWebpage && !e.shiftKey ? hit.id : undefined,
          didMove: false,
        };
      } else {
        if (!e.shiftKey) onSelectIds([]);
        interactionRef.current = {
          mode: 'marquee',
          startWorld: worldPt,
          startScreen: { x: e.clientX, y: e.clientY },
          startCamera: camera,
          draftElement: null,
          snapshotBefore: elements,
          marqueeRect: { x: worldPt.x, y: worldPt.y, width: 0, height: 0 },
        };
      }
      return;
    }

    // Drawing tools (rectangle, diamond, ellipse, triangle, arrow, line, wire, freedraw, frame)
    const isConnector = activeTool === 'arrow' || activeTool === 'line' || activeTool === 'wire';
    const snapStart = isConnector
      ? findNearestSnapTerminal(elements, worldPt, undefined, 20 / camera.zoom)
      : null;
    const wireTapStart =
      activeTool === 'wire' && !snapStart
        ? findNearestWireSnapPoint(elements, worldPt, 14 / camera.zoom)
        : null;
    const startPt = snapStart
      ? { x: snapStart.x, y: snapStart.y }
      : wireTapStart || worldPt;

    const frameCount = elements.filter((el) => !el.isDeleted && el.type === 'frame').length;
    const draftType =
      activeTool === 'image' ? 'rectangle' : activeTool === 'math' ? 'math-equation' : activeTool;

    const draft: WhiteboardElement = {
      id: makeId(draftType),
      type: draftType as WhiteboardElement['type'],
      wireRouting: draftType === 'wire' ? 'straight' : undefined,
      x: startPt.x,
      y: startPt.y,
      width: 1,
      height: 1,
      angle: 0,
      strokeColor: defaultStyle.strokeColor,
      backgroundColor: defaultStyle.backgroundColor,
      fillStyle: defaultStyle.fillStyle,
      strokeWidth: defaultStyle.strokeWidth,
      strokeStyle: defaultStyle.strokeStyle,
      sloppiness: draftType === 'wire' ? 0 : defaultStyle.sloppiness,
      opacity: defaultStyle.opacity,
      seed: Math.floor(Math.random() * 100000),
      fontFamily: defaultStyle.fontFamily,
      fontSize: defaultStyle.fontSize,
      triangleVariant: draftType === 'triangle' ? defaultStyle.triangleVariant : undefined,
      frameIndex: draftType === 'frame' ? frameCount + 1 : undefined,
      frameTitle: draftType === 'frame' ? `Slide ${frameCount + 1}` : undefined,
      webpageTitle: draftType === 'webpage' ? 'index.html' : undefined,
      htmlCode: draftType === 'webpage' ? '' : undefined,
      cssCode: draftType === 'webpage' ? '' : undefined,
      jsCode: draftType === 'webpage' ? '' : undefined,
      webpageAutoPolish: draftType === 'webpage' ? false : undefined,
      mathRaw: draftType === 'math-equation' ? 'f(x) = x^2 - 4' : undefined,
      mathLatex: draftType === 'math-equation' ? 'f\\left(x\\right) = x^{2} - 4' : undefined,
      points:
        draftType === 'arrow' || draftType === 'line' || draftType === 'wire'
          ? [
              { x: 0, y: 0 },
              { x: 0, y: 0 },
            ]
          : draftType === 'freedraw'
          ? [{ x: 0, y: 0 }]
          : undefined,
      endArrowhead: draftType === 'arrow',
      startBinding: snapStart
        ? { elementId: snapStart.elementId, terminalId: snapStart.terminalId, anchor: snapStart.anchor }
        : null,
      endBinding: null,
      version: 1,
      updatedAt: Date.now(),
    };

    interactionRef.current = {
      mode: 'draw',
      startWorld: startPt,
      startScreen: { x: e.clientX, y: e.clientY },
      startCamera: camera,
      draftElement: draft,
      snapshotBefore: elements,
    };
    setRenderTick((t) => t + 1);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (activePointersRef.current.has(e.pointerId)) {
      activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }

    const state = interactionRef.current;

    // Cancel touch long-press as soon as finger moves > 8px
    if (e.pointerType === 'touch' && longPressTimerRef.current !== null) {
      if (Math.hypot(e.clientX - state.startScreen.x, e.clientY - state.startScreen.y) > 8) {
        clearLongPressTimer();
      }
    }

    // 2-finger pinch-to-zoom & pan
    if (state.mode === 'pinch' && activePointersRef.current.size >= 2 && pinchStartRef.current) {
      const pts = Array.from(activePointersRef.current.values());
      const dist = Math.max(12, Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y));
      const midX = (pts[0].x + pts[1].x) / 2;
      const midY = (pts[0].y + pts[1].y) / 2;
      const rect = canvasRef.current?.getBoundingClientRect();
      const startMidLocalX = pinchStartRef.current.midX - (rect?.left || 0);
      const startMidLocalY = pinchStartRef.current.midY - (rect?.top || 0);
      const currMidLocalX = midX - (rect?.left || 0);
      const currMidLocalY = midY - (rect?.top || 0);

      const startCam = pinchStartRef.current.startCamera;
      const scaleRatio = dist / pinchStartRef.current.dist;
      const nextZoom = Math.min(6, Math.max(0.05, startCam.zoom * scaleRatio));
      const worldMidX = (startMidLocalX - startCam.x) / startCam.zoom;
      const worldMidY = (startMidLocalY - startCam.y) / startCam.zoom;

      onCameraChange({
        zoom: nextZoom,
        x: currMidLocalX - worldMidX * nextZoom,
        y: currMidLocalY - worldMidY * nextZoom,
      });
      return;
    }

    const worldPt = screenToWorld(e.clientX, e.clientY);
    if (onCursorMove) onCursorMove(worldPt);

    if (activeTool === 'laser') {
      laserHoverWorldRef.current = worldPt;
      if (state.mode === 'laser') {
        const last = laserPointsRef.current[laserPointsRef.current.length - 1];
        if (
          !last ||
          last.strokeId !== laserStrokeIdRef.current ||
          Math.hypot(worldPt.x - last.x, worldPt.y - last.y) >= 2
        ) {
          laserPointsRef.current.push({
            x: worldPt.x,
            y: worldPt.y,
            createdAt: performance.now(),
            strokeId: laserStrokeIdRef.current,
          });
        }
      }
      ensureLaserLoop();
      if (state.mode === 'laser') return;
    } else if (laserHoverWorldRef.current) {
      laserHoverWorldRef.current = null;
    }

    if (activeTool === 'arrow' || activeTool === 'line' || activeTool === 'wire' || state.mode === 'wire-vertex') {
      const snap = findNearestSnapTerminal(elements, worldPt, undefined, 20 / camera.zoom);
      setSnapTarget(snap);
      if ((activeTool === 'wire' || state.mode === 'wire-vertex') && !snap) {
        setWireSnapPt(findNearestWireSnapPoint(elements, worldPt, 14 / camera.zoom));
      } else if (wireSnapPt) {
        setWireSnapPt(null);
      }
    } else {
      if (snapTarget) setSnapTarget(null);
      if (wireSnapPt) setWireSnapPt(null);
    }

    if (state.mode === 'none') return;

    if (state.mode === 'pan') {
      const dx = e.clientX - state.startScreen.x;
      const dy = e.clientY - state.startScreen.y;
      onCameraChange({
        ...state.startCamera,
        x: state.startCamera.x + dx,
        y: state.startCamera.y + dy,
      });
      return;
    }

    if (state.mode === 'erase') {
      const hit = [...elements].reverse().find((el) => hitTestElement(el, worldPt, 10 / camera.zoom));
      if (hit) {
        state.erasedAny = true;
        onElementsChange(
          elements.filter((el) => el.id !== hit.id),
          false
        );
      }
      return;
    }

    if (state.mode === 'move' && state.initialElementsMap) {
      const screenDist = Math.hypot(
        e.clientX - state.startScreen.x,
        e.clientY - state.startScreen.y
      );
      if (screenDist < 4 && !state.didMove) {
        return;
      }
      state.didMove = true;
      const dx = worldPt.x - state.startWorld.x;
      const dy = worldPt.y - state.startWorld.y;
      const movedIds = new Set(state.initialElementsMap.keys());

      let next = elements.map((el) => {
        const orig = state.initialElementsMap?.get(el.id);
        if (!orig) return el;
        return {
          ...el,
          x: orig.x + dx,
          y: orig.y + dy,
          version: el.version + 1,
          updatedAt: Date.now(),
        };
      });
      next = updateBoundConnectors(next, movedIds);
      onElementsChange(next, false);
      return;
    }

    if (state.mode === 'resize' && state.initialBounds && state.initialElementsMap && state.resizeHandle) {
      const ib = state.initialBounds;
      const dx = worldPt.x - state.startWorld.x;
      const dy = worldPt.y - state.startWorld.y;
      const dir = state.resizeHandle;

      let nx = ib.x;
      let ny = ib.y;
      let nw = ib.width;
      let nh = ib.height;

      if (dir.includes('e')) nw = Math.max(16, ib.width + dx);
      if (dir.includes('s')) nh = Math.max(16, ib.height + dy);
      if (dir.includes('w')) {
        const clampedDx = Math.min(dx, ib.width - 16);
        nx = ib.x + clampedDx;
        nw = ib.width - clampedDx;
      }
      if (dir.includes('n')) {
        const clampedDy = Math.min(dy, ib.height - 16);
        ny = ib.y + clampedDy;
        nh = ib.height - clampedDy;
      }

      const changedIds = new Set(state.initialElementsMap.keys());
      const isSingleElement = state.initialElementsMap.size === 1;

      let next = elements.map((el) => {
        const orig = state.initialElementsMap?.get(el.id);
        if (!orig) return el;
        return computeResizedElement(el, orig, ib, nx, ny, nw, nh, dir, isSingleElement);
      });

      next = updateBoundConnectors(next, changedIds);
      onElementsChange(next, false);
      return;
    }

    if (state.mode === 'marquee') {
      const mx = Math.min(state.startWorld.x, worldPt.x);
      const my = Math.min(state.startWorld.y, worldPt.y);
      const mw = Math.abs(worldPt.x - state.startWorld.x);
      const mh = Math.abs(worldPt.y - state.startWorld.y);
      state.marqueeRect = { x: mx, y: my, width: mw, height: mh };
      setRenderTick((t) => t + 1);
      return;
    }

    if (state.mode === 'wire-vertex' && state.wireId !== undefined && state.wirePointIndex !== undefined) {
      const targetWire = elements.find((el) => el.id === state.wireId);
      if (targetWire && targetWire.points && targetWire.points.length >= 2) {
        const ptIdx = state.wirePointIndex;
        const isStart = ptIdx === 0;
        const isEnd = ptIdx === targetWire.points.length - 1;
        const snap = (isStart || isEnd)
          ? findNearestSnapTerminal(elements, worldPt, undefined, 20 / camera.zoom)
          : null;
        const wireTap = (isStart || isEnd) && !snap
          ? findNearestWireSnapPoint(
              elements.filter((el) => el.id !== targetWire.id),
              worldPt,
              14 / camera.zoom
            )
          : null;
        const finalPt = snap ? { x: snap.x, y: snap.y } : wireTap || worldPt;
        const worldPts = targetWire.points.map((p) => ({
          x: targetWire.x + p.x,
          y: targetWire.y + p.y,
        }));
        worldPts[ptIdx] = finalPt;
        const origin = worldPts[0];
        const relPts = worldPts.map((p) => ({ x: p.x - origin.x, y: p.y - origin.y }));
        const xs = relPts.map((p) => p.x);
        const ys = relPts.map((p) => p.y);
        const nextEls = elements.map((el) =>
          el.id === targetWire.id
            ? {
                ...el,
                x: origin.x,
                y: origin.y,
                width: Math.max(1, Math.max(...xs) - Math.min(...xs)),
                height: Math.max(1, Math.max(...ys) - Math.min(...ys)),
                points: relPts,
                startBinding: isStart
                  ? snap
                    ? { elementId: snap.elementId, terminalId: snap.terminalId, anchor: snap.anchor }
                    : null
                  : el.startBinding,
                endBinding: isEnd
                  ? snap
                    ? { elementId: snap.elementId, terminalId: snap.terminalId, anchor: snap.anchor }
                    : null
                  : el.endBinding,
                version: el.version + 1,
                updatedAt: Date.now(),
              }
            : el
        );
        onElementsChange(nextEls, false);
      }
      return;
    }

    if (state.mode === 'draw' && state.draftElement) {
      const draft = state.draftElement;
      if (draft.type === 'freedraw') {
        const pts = draft.points || [];
        const relPt = { x: worldPt.x - draft.x, y: worldPt.y - draft.y };
        const last = pts[pts.length - 1];
        if (!last || Math.hypot(relPt.x - last.x, relPt.y - last.y) >= 2.5) {
          draft.points = [...pts, relPt];
        }
      } else if (draft.type === 'wire') {
        const snapEnd = findNearestSnapTerminal(elements, worldPt, undefined, 20 / camera.zoom);
        const wireTapEnd = !snapEnd
          ? findNearestWireSnapPoint(elements, worldPt, 14 / camera.zoom)
          : null;
        const target = snapEnd
          ? { x: snapEnd.x, y: snapEnd.y }
          : wireTapEnd || worldPt;
        draft.points = [
          { x: 0, y: 0 },
          { x: target.x - draft.x, y: target.y - draft.y },
        ];
        draft.width = Math.max(1, Math.abs(target.x - draft.x));
        draft.height = Math.max(1, Math.abs(target.y - draft.y));
        draft.endBinding = snapEnd
          ? { elementId: snapEnd.elementId, terminalId: snapEnd.terminalId, anchor: snapEnd.anchor }
          : null;
      } else if (draft.type === 'arrow' || draft.type === 'line') {
        const snapEnd = findNearestSnapTerminal(elements, worldPt, undefined, 20 / camera.zoom);
        const target = snapEnd ? { x: snapEnd.x, y: snapEnd.y } : worldPt;
        draft.points = [
          { x: 0, y: 0 },
          { x: target.x - draft.x, y: target.y - draft.y },
        ];
        draft.width = Math.max(1, Math.abs(target.x - draft.x));
        draft.height = Math.max(1, Math.abs(target.y - draft.y));
        draft.endBinding = snapEnd
          ? { elementId: snapEnd.elementId, terminalId: snapEnd.terminalId, anchor: snapEnd.anchor }
          : null;
      } else {
        let w = worldPt.x - state.startWorld.x;
        let h = worldPt.y - state.startWorld.y;
        if (e.shiftKey) {
          const size = Math.max(Math.abs(w), Math.abs(h));
          w = Math.sign(w || 1) * size;
          h = Math.sign(h || 1) * size;
        }
        draft.x = w >= 0 ? state.startWorld.x : state.startWorld.x + w;
        draft.y = h >= 0 ? state.startWorld.y : state.startWorld.y + h;
        draft.width = Math.abs(w);
        draft.height = Math.abs(h);
      }
      setRenderTick((t) => t + 1);
    }
  };

  const handlePointerUp = (e?: React.PointerEvent<HTMLCanvasElement>) => {
    clearLongPressTimer();
    if (e) {
      activePointersRef.current.delete(e.pointerId);
    } else {
      activePointersRef.current.clear();
    }

    const state = interactionRef.current;
    if (state.mode === 'pinch') {
      if (activePointersRef.current.size < 2) {
        pinchStartRef.current = null;
        interactionRef.current = {
          mode: 'none',
          startWorld: { x: 0, y: 0 },
          startScreen: { x: 0, y: 0 },
          startCamera: camera,
          draftElement: null,
          snapshotBefore: elements,
        };
      }
      return;
    }
    if (state.mode === 'none') return;

    if (state.mode === 'erase') {
      if (state.erasedAny) {
        onElementsChange(elements, true);
      }
    } else if (state.mode === 'move') {
      if (state.didMove) {
        onElementsChange(elements, true);
      } else if (state.clickedSwitchId && onSwitchToggle) {
        onSwitchToggle(state.clickedSwitchId);
      } else if (state.clickedWebpageId && onWebpageClick) {
        onWebpageClick(state.clickedWebpageId);
      } else if (state.clickedInstrumentId && onInstrumentClick) {
        onInstrumentClick(state.clickedInstrumentId);
      }
    } else if (state.mode === 'resize' || state.mode === 'wire-vertex') {
      onElementsChange(elements, true);
      setSnapTarget(null);
      setWireSnapPt(null);
    } else if (state.mode === 'marquee' && state.marqueeRect) {
      const m = state.marqueeRect;
      if (m.width > 4 || m.height > 4) {
        const inside = elements
          .filter((el) => {
            if (el.isDeleted || el.type === 'frame') return false;
            const b = getNormalizedBounds(el);
            return (
              b.x < m.x + m.width &&
              b.x + b.width > m.x &&
              b.y < m.y + m.height &&
              b.y + b.height > m.y
            );
          })
          .map((el) => el.id);
        onSelectIds(inside);
      }
    } else if (state.mode === 'draw' && state.draftElement) {
      let finalEl = state.draftElement;
      const b = getNormalizedBounds(finalEl);
      let pathLen = 0;
      if ((finalEl.type === 'arrow' || finalEl.type === 'line' || finalEl.type === 'wire') && finalEl.points) {
        for (let i = 0; i < finalEl.points.length - 1; i++) {
          pathLen += Math.hypot(
            finalEl.points[i + 1].x - finalEl.points[i].x,
            finalEl.points[i + 1].y - finalEl.points[i].y
          );
        }
      }
      const isTiny =
        finalEl.type === 'freedraw'
          ? (finalEl.points?.length || 0) < 3
          : finalEl.type === 'arrow' || finalEl.type === 'line' || finalEl.type === 'wire'
          ? pathLen < 8
          : b.width < 8 && b.height < 8;

      if (finalEl.type === 'webpage') {
        finalEl = {
          ...finalEl,
          width: isTiny ? 460 : Math.max(260, b.width),
          height: isTiny ? 340 : Math.max(180, b.height),
        };
        onElementsChange([...elements, finalEl], true);
        onSelectIds([finalEl.id]);
        onToolComplete('select');
      } else if (finalEl.type === 'math-equation') {
        finalEl = {
          ...finalEl,
          width: isTiny ? 280 : Math.max(200, b.width),
          height: isTiny ? 72 : Math.max(56, b.height),
        };
        onElementsChange([...elements, finalEl], true);
        onSelectIds([finalEl.id]);
        onToolComplete('select');
        onOpenMathStudio?.(finalEl.id, 'equation');
      } else if (!isTiny) {
        if (finalEl.type === 'freedraw' && shapeSnapEnabled && finalEl.points) {
          const worldPts = finalEl.points.map((p) => ({ x: finalEl.x + p.x, y: finalEl.y + p.y }));
          const recognized = recognizeFreehandShape(worldPts);
          if (recognized) {
            finalEl = applyRecognizedShape(finalEl, recognized);
            if (onStatusToast) onStatusToast(`Snapped stroke to ${recognized.label}`);
          }
        }
        onElementsChange([...elements, finalEl], true);
        onSelectIds([finalEl.id]);
        if (activeTool !== 'freedraw' && activeTool !== 'wire') {
          onToolComplete('select');
        }
      }
    }

    interactionRef.current = {
      mode: 'none',
      startWorld: { x: 0, y: 0 },
      startScreen: { x: 0, y: 0 },
      startCamera: camera,
      draftElement: null,
      snapshotBefore: elements,
    };
    setRenderTick((t) => t + 1);
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      const rect = canvasRef.current?.getBoundingClientRect();
      const sx = e.clientX - (rect?.left || 0);
      const sy = e.clientY - (rect?.top || 0);
      const zoomFactor = e.deltaY < 0 ? 1.09 : 0.91;
      const nextZoom = Math.min(6, Math.max(0.05, camera.zoom * zoomFactor));
      const worldX = (sx - camera.x) / camera.zoom;
      const worldY = (sy - camera.y) / camera.zoom;
      onCameraChange({
        zoom: nextZoom,
        x: sx - worldX * nextZoom,
        y: sy - worldY * nextZoom,
      });
    } else {
      onCameraChange({
        ...camera,
        x: camera.x - e.deltaX,
        y: camera.y - e.deltaY,
      });
    }
  };

  const handleDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const worldPt = screenToWorld(e.clientX, e.clientY);

    // Double-clicking an interior bend/arc vertex of a selected wire removes that control point
    if (selectedIds.length === 1) {
      const selWire = elements.find(
        (el) => !el.isDeleted && el.id === selectedIds[0] && el.type === 'wire' && el.points && el.points.length > 2
      );
      if (selWire && selWire.points) {
        const worldPts = selWire.points.map((p) => ({
          x: selWire.x + p.x,
          y: selWire.y + p.y,
        }));
        const tol = 12 / camera.zoom;
        const interiorIdx = worldPts.findIndex(
          (pt, idx) => idx > 0 && idx < worldPts.length - 1 && Math.hypot(worldPt.x - pt.x, worldPt.y - pt.y) <= tol
        );
        if (interiorIdx !== -1) {
          const nextWorldPts = worldPts.filter((_, idx) => idx !== interiorIdx);
          const origin = nextWorldPts[0];
          const relPts = nextWorldPts.map((p) => ({ x: p.x - origin.x, y: p.y - origin.y }));
          const xs = relPts.map((p) => p.x);
          const ys = relPts.map((p) => p.y);
          onElementsChange(
            elements.map((el) =>
              el.id === selWire.id
                ? {
                    ...el,
                    x: origin.x,
                    y: origin.y,
                    width: Math.max(1, Math.max(...xs) - Math.min(...xs)),
                    height: Math.max(1, Math.max(...ys) - Math.min(...ys)),
                    points: relPts,
                    wireRouting: relPts.length <= 2 ? 'straight' : el.wireRouting,
                    version: el.version + 1,
                    updatedAt: Date.now(),
                  }
                : el
            ),
            true
          );
          return;
        }
      }
    }

    const hit = [...elements]
      .filter((el) => !el.isDeleted)
      .reverse()
      .find((el) => hitTestElement(el, worldPt, 10 / camera.zoom));

    if (hit) {
      if (hit.type === 'webpage') {
        onWebpageClick?.(hit.id);
        return;
      }
      if (
        hit.type === 'math-equation' ||
        hit.type === 'math-matrix' ||
        hit.type === 'math-graph-2d' ||
        hit.type === 'math-graph-3d'
      ) {
        onOpenMathStudio?.(hit.id, hit.type === 'math-matrix' ? 'matrix' : 'equation');
        return;
      }
      setEditingId(hit.id);
      if (hit.type === 'circuit') {
        setEditingText(hit.componentValue || '');
      } else if (hit.type === 'frame') {
        setEditingText(hit.frameTitle || '');
      } else {
        setEditingText(hit.text || '');
      }
    }
  };

  const handleContextMenu = (e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const worldPt = screenToWorld(e.clientX, e.clientY);
    const activeList = elements.filter((el) => !el.isDeleted);
    const nonFrames = activeList.filter((el) => el.type !== 'frame').reverse();
    const frames = activeList.filter((el) => el.type === 'frame').reverse();
    const hit =
      nonFrames.find((el) => hitTestElement(el, worldPt, 8 / camera.zoom)) ||
      frames.find((el) => hitTestElement(el, worldPt, 8 / camera.zoom)) ||
      null;

    if (hit && !selectedIds.includes(hit.id)) {
      onSelectIds([hit.id]);
    }

    const menuW = 220;
    const menuH = hit || selectedIds.length > 0 ? 330 : 210;
    const screenX = Math.max(8, Math.min(e.clientX, window.innerWidth - menuW - 8));
    const screenY = Math.max(8, Math.min(e.clientY, window.innerHeight - menuH - 8));
    setContextMenu({
      screenX,
      screenY,
      hitElementId: hit?.id || null,
    });
  };

  const editingElement = editingId ? elements.find((e) => e.id === editingId) : null;
  const editingBounds = editingElement ? getNormalizedBounds(editingElement) : null;

  const cursorClass =
    activeTool === 'hand' || spaceHeldRef.current
      ? 'cursor-grab active:cursor-grabbing'
      : activeTool === 'select'
      ? 'cursor-default'
      : activeTool === 'text'
      ? 'cursor-text'
      : 'cursor-crosshair';

  const contextSelection = elements.filter((e) => !e.isDeleted && selectedIds.includes(e.id));
  const contextPrimary = contextSelection[0];
  const hasRotatedSelected = contextSelection.some((e) => Math.abs(e.angle || 0) > 0.001);
  const contextAngleDeg = contextPrimary
    ? Math.round((((contextPrimary.angle || 0) * 180) / Math.PI + 360) % 360)
    : 0;

  return (
    <div ref={containerRef} className="relative w-full h-full overflow-hidden touch-none">
      <canvas
        ref={canvasRef}
        data-testid="whiteboard-canvas"
        data-camera-x={camera.x}
        data-camera-y={camera.y}
        data-camera-zoom={camera.zoom}
        aria-label="Spark Whiteboard Canvas"
        className={`block w-full h-full touch-none ${cursorClass}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={(e) => {
          laserHoverWorldRef.current = null;
          clearLongPressTimer();
          activePointersRef.current.delete(e.pointerId);
        }}
        onPointerCancel={handlePointerUp}
        onWheel={handleWheel}
        onDoubleClick={handleDoubleClick}
        onContextMenu={handleContextMenu}
      />

      {/* Live Sandboxed Webpage Window Overlays (visible directly on canvas without clicking to preview) */}
      <div
        aria-label="Live Webpage Previews"
        className="pointer-events-none absolute inset-0 overflow-hidden z-[5]"
      >
        {elements
          .filter((el) => !el.isDeleted && el.type === 'webpage')
          .map((wp) => (
            <LiveWebpageOverlayCard
              key={wp.id}
              element={wp}
              camera={camera}
              activeTool={activeTool}
              isSelected={selectedIds.includes(wp.id)}
              isInteractive={interactiveWebpageId === wp.id}
              onToggleInteractive={(id) => {
                onSelectIds([id]);
                setInteractiveWebpageId((prev) => (prev === id ? null : id));
              }}
              onOpenEditor={(id) => {
                onSelectIds([id]);
                onWebpageClick?.(id);
              }}
            />
          ))}

        {/* Interactive Smart Mathematics Engine Overlays */}
        {elements
          .filter((el) => !el.isDeleted && el.type === 'math-equation')
          .map((meq) => (
            <MathEquationOverlayCard
              key={meq.id}
              element={meq}
              camera={camera}
              activeTool={activeTool}
              theme={theme}
              isSelected={selectedIds.includes(meq.id)}
              onSelect={(id) => onSelectIds([id])}
              onUpdateElement={(id, patch) => onUpdateElementById?.(id, patch, true)}
              onOpenMathStudio={(id, tab) => onOpenMathStudio?.(id, tab)}
              onPlot2DFromEquation={onPlotEquation2D}
              onPlot3DFromEquation={onPlotEquation3D}
            />
          ))}

        {elements
          .filter((el) => !el.isDeleted && el.type === 'math-matrix')
          .map((mmat) => (
            <MathMatrixOverlayCard
              key={mmat.id}
              element={mmat}
              camera={camera}
              activeTool={activeTool}
              theme={theme}
              isSelected={selectedIds.includes(mmat.id)}
              onSelect={(id) => onSelectIds([id])}
              onUpdateElement={(id, patch) => onUpdateElementById?.(id, patch, true)}
              onOpenMathStudio={(id, tab) => onOpenMathStudio?.(id, tab)}
            />
          ))}

        {elements
          .filter((el) => !el.isDeleted && el.type === 'math-graph-2d')
          .map((mg2) => (
            <MathGraph2DOverlayCard
              key={mg2.id}
              element={mg2}
              camera={camera}
              activeTool={activeTool}
              theme={theme}
              isSelected={selectedIds.includes(mg2.id)}
              onSelect={(id) => onSelectIds([id])}
              onUpdateElement={(id, patch) => onUpdateElementById?.(id, patch, false)}
              onOpenMathStudio={(id, tab) => onOpenMathStudio?.(id, tab)}
            />
          ))}

        {elements
          .filter((el) => !el.isDeleted && el.type === 'math-graph-3d')
          .map((mg3) => (
            <MathGraph3DOverlayCard
              key={mg3.id}
              element={mg3}
              camera={camera}
              activeTool={activeTool}
              theme={theme}
              isSelected={selectedIds.includes(mg3.id)}
              onSelect={(id) => onSelectIds([id])}
              onUpdateElement={(id, patch) => onUpdateElementById?.(id, patch, false)}
              onOpenMathStudio={(id, tab) => onOpenMathStudio?.(id, tab)}
            />
          ))}
      </div>

      {/* Ephemeral Temporary Overlay Canvas for Laser Pointer (never saved to scene) */}
      <canvas
        ref={laserCanvasRef}
        data-testid="laser-overlay-canvas"
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 w-full h-full z-10"
      />

      {/* Right-Click Canvas Context Menu */}
      {contextMenu && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setContextMenu(null)}
            onContextMenu={(ev) => {
              ev.preventDefault();
              setContextMenu(null);
            }}
          />
          <div
            role="menu"
            data-testid="canvas-context-menu"
            style={{ left: `${contextMenu.screenX}px`, top: `${contextMenu.screenY}px` }}
            className="rf-panel fixed z-50 w-52 rounded-xl p-1.5 text-xs shadow-xl"
          >
            {contextSelection.length > 0 ? (
              <>
                <div className="px-2.5 py-1.5 text-[11px] font-semibold text-[var(--rf-text-muted)] flex items-center justify-between border-b border-[var(--rf-border)] mb-1">
                  <span className="truncate">
                    {contextSelection.length === 1 && contextPrimary?.type === 'circuit'
                      ? `${contextPrimary.circuitKind?.replace('-', ' ').toUpperCase()}`
                      : contextSelection.length === 1 && contextPrimary?.type === 'math-equation'
                      ? 'Math Equation'
                      : contextSelection.length === 1 && contextPrimary?.type === 'math-matrix'
                      ? `Matrix ${contextPrimary.matrixName || 'A'}`
                      : contextSelection.length === 1 && contextPrimary?.type === 'math-graph-2d'
                      ? '2D Plot'
                      : contextSelection.length === 1 && contextPrimary?.type === 'math-graph-3d'
                      ? '3D Surface Plot'
                      : `${contextSelection.length} selected`}
                  </span>
                  <span className="font-mono-tabular text-[10px] opacity-80">
                    {contextAngleDeg}°
                  </span>
                </div>

                {contextSelection.length === 1 &&
                  contextPrimary &&
                  (contextPrimary.type === 'math-equation' ||
                    contextPrimary.type === 'math-matrix' ||
                    contextPrimary.type === 'math-graph-2d' ||
                    contextPrimary.type === 'math-graph-3d') && (
                    <>
                      {onOpenMathStudio && (
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            onOpenMathStudio(
                              contextPrimary.id,
                              contextPrimary.type === 'math-matrix' ? 'matrix' : 'equation'
                            );
                            setContextMenu(null);
                          }}
                          className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[var(--rf-text)] hover:bg-[var(--rf-surface-hover)]"
                        >
                          <Calculator className="w-3.5 h-3.5 text-[var(--rf-accent)]" />
                          <span>Open in Math Studio</span>
                        </button>
                      )}
                      {contextPrimary.type === 'math-equation' && onQuickMathAction && (
                        <>
                          {(
                            [
                              ['simplify', 'Simplify'],
                              ['expand', 'Expand'],
                              ['factor', 'Factorize'],
                              ['diff', 'Derivative d/dx'],
                              ['integrate', 'Integrate ∫'],
                              ['solve', 'Solve'],
                            ] as const
                          ).map(([op, label]) => (
                            <button
                              key={op}
                              type="button"
                              role="menuitem"
                              onClick={() => {
                                onQuickMathAction(contextPrimary, op);
                                setContextMenu(null);
                              }}
                              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[var(--rf-text)] hover:bg-[var(--rf-surface-hover)]"
                            >
                              <Sparkles className="w-3.5 h-3.5 text-[var(--rf-accent)]" />
                              <span>{label}</span>
                            </button>
                          ))}
                        </>
                      )}
                      {contextPrimary.type === 'math-equation' && onPlotEquation2D && (
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            onPlotEquation2D(contextPrimary);
                            setContextMenu(null);
                          }}
                          className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[var(--rf-text)] hover:bg-[var(--rf-surface-hover)]"
                        >
                          <Activity className="w-3.5 h-3.5 text-[var(--rf-accent)]" />
                          <span>Plot 2D Graph</span>
                        </button>
                      )}
                      {contextPrimary.type === 'math-equation' && onPlotEquation3D && (
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            onPlotEquation3D(contextPrimary);
                            setContextMenu(null);
                          }}
                          className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[var(--rf-text)] hover:bg-[var(--rf-surface-hover)]"
                        >
                          <Box className="w-3.5 h-3.5 text-[var(--rf-accent)]" />
                          <span>Plot 3D Surface</span>
                        </button>
                      )}
                      <div className="my-1 border-t border-[var(--rf-border)]" />
                    </>
                  )}

                {onRotateSelected && (
                  <>
                    <button
                      type="button"
                      role="menuitem"
                      data-testid="ctx-rotate-cw"
                      onClick={() => {
                        onRotateSelected(Math.PI / 2);
                        setContextMenu(null);
                      }}
                      className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[var(--rf-text)] hover:bg-[var(--rf-surface-hover)]"
                    >
                      <span className="flex items-center gap-2">
                        <RotateCw className="w-3.5 h-3.5 text-[var(--rf-accent)]" />
                        <span>Rotate 90° CW</span>
                      </span>
                      <span className="text-[10px] text-[var(--rf-text-muted)]">+90°</span>
                    </button>

                    <button
                      type="button"
                      role="menuitem"
                      data-testid="ctx-rotate-ccw"
                      onClick={() => {
                        onRotateSelected(-Math.PI / 2);
                        setContextMenu(null);
                      }}
                      className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[var(--rf-text)] hover:bg-[var(--rf-surface-hover)]"
                    >
                      <span className="flex items-center gap-2">
                        <RotateCcw className="w-3.5 h-3.5 text-[var(--rf-accent)]" />
                        <span>Rotate 90° CCW</span>
                      </span>
                      <span className="text-[10px] text-[var(--rf-text-muted)]">-90°</span>
                    </button>

                    <button
                      type="button"
                      role="menuitem"
                      data-testid="ctx-rotate-180"
                      onClick={() => {
                        onRotateSelected(Math.PI);
                        setContextMenu(null);
                      }}
                      className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[var(--rf-text)] hover:bg-[var(--rf-surface-hover)]"
                    >
                      <span className="flex items-center gap-2">
                        <RotateCw className="w-3.5 h-3.5" />
                        <span>Rotate 180°</span>
                      </span>
                      <span className="text-[10px] text-[var(--rf-text-muted)]">180°</span>
                    </button>

                    {hasRotatedSelected && onResetRotationSelected && (
                      <button
                        type="button"
                        role="menuitem"
                        data-testid="ctx-rotate-reset"
                        onClick={() => {
                          onResetRotationSelected();
                          setContextMenu(null);
                        }}
                        className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[var(--rf-text)] hover:bg-[var(--rf-surface-hover)]"
                      >
                        <span className="flex items-center gap-2">
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Reset Rotation (0°)</span>
                        </span>
                      </button>
                    )}

                    <div className="my-1 border-t border-[var(--rf-border)]" />
                  </>
                )}

                {onLayerChange && (
                  <>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        onLayerChange('forward');
                        setContextMenu(null);
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[var(--rf-text)] hover:bg-[var(--rf-surface-hover)]"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                      <span>Bring Forward</span>
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        onLayerChange('backward');
                        setContextMenu(null);
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[var(--rf-text)] hover:bg-[var(--rf-surface-hover)]"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                      <span>Send Backward</span>
                    </button>
                  </>
                )}

                {onDuplicateSelected && (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      onDuplicateSelected();
                      setContextMenu(null);
                    }}
                    className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[var(--rf-text)] hover:bg-[var(--rf-surface-hover)]"
                  >
                    <span className="flex items-center gap-2">
                      <Copy className="w-3.5 h-3.5" />
                      <span>Duplicate</span>
                    </span>
                    <span className="text-[10px] text-[var(--rf-text-muted)]">Ctrl+D</span>
                  </button>
                )}

                {onDeleteSelected && (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      onDeleteSelected();
                      setContextMenu(null);
                    }}
                    className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-rose-400 hover:bg-rose-500/15"
                  >
                    <span className="flex items-center gap-2">
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete</span>
                    </span>
                    <span className="text-[10px] opacity-75">Del</span>
                  </button>
                )}
              </>
            ) : (
              <>
                <div className="px-2.5 py-1 text-[11px] font-semibold text-[var(--rf-text-muted)] border-b border-[var(--rf-border)] mb-1">
                  Canvas Actions
                </div>
                {onSelectTool && (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      onSelectTool('laser');
                      setContextMenu(null);
                    }}
                    className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[var(--rf-text)] hover:bg-[var(--rf-surface-hover)]"
                  >
                    <span className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-[0_0_6px_#ef4444]" />
                      <span>Laser Pointer</span>
                    </span>
                    <span className="text-[10px] text-[var(--rf-text-muted)]">Q</span>
                  </button>
                )}
                {onSelectAll && (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      onSelectAll();
                      setContextMenu(null);
                    }}
                    className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[var(--rf-text)] hover:bg-[var(--rf-surface-hover)]"
                  >
                    <span>Select All</span>
                    <span className="text-[10px] text-[var(--rf-text-muted)]">Ctrl+A</span>
                  </button>
                )}
                {onResetZoom && (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      onResetZoom();
                      setContextMenu(null);
                    }}
                    className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[var(--rf-text)] hover:bg-[var(--rf-surface-hover)]"
                  >
                    <span>Reset Zoom (100%)</span>
                    <span className="text-[10px] text-[var(--rf-text-muted)]">Ctrl+0</span>
                  </button>
                )}
                {onFitToScreen && (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      onFitToScreen();
                      setContextMenu(null);
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[var(--rf-text)] hover:bg-[var(--rf-surface-hover)]"
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                    <span>Fit to Content</span>
                  </button>
                )}
              </>
            )}
          </div>
        </>
      )}

      {editingElement && editingBounds && (
        <textarea
          ref={textareaRef}
          autoFocus
          aria-label="Edit element text"
          value={editingText}
          onChange={(ev) => setEditingText(ev.target.value)}
          onBlur={() => {
            if (Date.now() - editOpenedAtRef.current < 180) {
              requestAnimationFrame(() => textareaRef.current?.focus());
              return;
            }
            commitInlineEdit();
          }}
          onKeyDown={(ev) => {
            if (ev.key === 'Escape') {
              ev.stopPropagation();
              if (editingElement.type === 'text' && editingText.trim() === '') {
                onElementsChange(
                  elements.filter((e) => e.id !== editingElement.id),
                  false
                );
                setEditingId(null);
              } else {
                commitInlineEdit();
              }
            } else if (ev.key === 'Enter' && !ev.shiftKey && editingElement.type !== 'text') {
              ev.preventDefault();
              commitInlineEdit();
            } else if ((ev.metaKey || ev.ctrlKey) && ev.key === 'Enter') {
              ev.preventDefault();
              commitInlineEdit();
            }
          }}
          style={{
            position: 'absolute',
            left: `${camera.x + editingBounds.x * camera.zoom}px`,
            top: `${
              camera.y +
              (editingElement.type === 'frame'
                ? editingBounds.y - 32
                : editingElement.type === 'circuit'
                ? editingBounds.y + editingBounds.height + 4
                : editingBounds.y) *
                camera.zoom
            }px`,
            minWidth: `${Math.max(160, editingBounds.width * camera.zoom)}px`,
            minHeight: `${Math.max(38, editingElement.type === 'text' ? editingBounds.height * camera.zoom : 44)}px`,
            font: getCanvasFontCss(editingElement.fontFamily, editingElement.fontSize * camera.zoom),
            color: editingElement.strokeColor,
            backgroundColor: theme.surfaceElevated,
            border: `1.5px solid ${theme.accentColor}`,
          }}
          className={`z-30 rounded-lg px-2 py-1 shadow-lg outline-none resize ${
            editingElement.type === 'text' ? 'text-left' : 'text-center'
          }`}
          placeholder={
            editingElement.type === 'circuit'
              ? 'Component value (e.g. 10kΩ)'
              : editingElement.type === 'frame'
              ? 'Slide title...'
              : 'Type text...'
          }
        />
      )}
    </div>
  );
};
