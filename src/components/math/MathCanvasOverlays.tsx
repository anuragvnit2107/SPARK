import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  Activity,
  Box,
  Edit3,
  Eye,
  EyeOff,
  Maximize2,
  Plus,
  RotateCcw,
  Sliders,
  Sparkles,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { CameraState, ToolType, WhiteboardElement } from '../../types';
import { ForgeTheme } from '../../themes';
import { MathFormula } from '../../math/MathematicalRenderer';
import { classifyMatrix, formatNum } from '../../math/MatrixEngine';
import { drawGraph2DOnCanvas, findExplicitIntersections } from '../../math/Graph2DEngine';
import {
  draw3DSurfaceIsometricFallback,
  drawContourPlot2D,
  evaluate3DSurfaceGrid,
  sampleColormap,
} from '../../math/Graph3DEngine';
import { analyzeConicEquation } from '../../math/ConicSectionEngine';

function checkWebGLAvailable(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    return Boolean(gl);
  } catch {
    return false;
  }
}

interface OverlayCommonProps {
  element: WhiteboardElement;
  camera: CameraState;
  activeTool: ToolType;
  theme: ForgeTheme;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onUpdateElement: (id: string, patch: Partial<WhiteboardElement>) => void;
  onOpenMathStudio: (id: string, tab?: 'equation' | 'matrix' | 'engineering' | 'history') => void;
  onPlot2DFromEquation?: (el: WhiteboardElement) => void;
  onPlot3DFromEquation?: (el: WhiteboardElement) => void;
}

export const MathEquationOverlayCard: React.FC<OverlayCommonProps> = ({
  element,
  camera,
  activeTool,
  theme,
  isSelected,
  onOpenMathStudio,
  onPlot2DFromEquation,
  onPlot3DFromEquation,
}) => {
  const screenLeft = camera.x + element.x * camera.zoom;
  const screenTop = camera.y + element.y * camera.zoom;
  const worldW = Math.max(48, element.width);
  const worldH = Math.max(36, element.height);
  const canInteract = activeTool === 'select';
  const isDark = theme.mode === 'dark';
  const baseFontPx = Math.max(10, Math.min(96, (element.fontSize || 16) * 0.92));
  const resultFontPx = Math.max(9, Math.min(80, baseFontPx * 0.8));
  const opLabelPx = Math.max(8, Math.min(20, Math.round(resultFontPx * 0.58)));
  const cardTransform = element.angle
    ? `scale(${camera.zoom}) translate(${worldW / 2}px, ${worldH / 2}px) rotate(${element.angle}rad) translate(${-worldW / 2}px, ${-worldH / 2}px)`
    : `scale(${camera.zoom})`;

  return (
    <div
      data-testid={`math-equation-card-${element.id}`}
      data-font-size={baseFontPx.toFixed(1)}
      data-camera-zoom={camera.zoom}
      style={{
        left: `${screenLeft}px`,
        top: `${screenTop}px`,
        width: `${worldW}px`,
        minHeight: `${worldH}px`,
        opacity: Math.max(0.15, element.opacity / 100),
        transform: cardTransform,
        transformOrigin: '0 0',
        backgroundColor: isDark ? 'rgba(15, 23, 42, 0.92)' : 'rgba(255, 255, 255, 0.96)',
        borderColor: isSelected ? theme.accentColor : theme.borderColor,
      }}
      className={`pointer-events-none absolute rounded-xl border shadow-sm overflow-hidden flex flex-col justify-between transition-shadow ${
        isSelected ? 'ring-2 ring-[var(--rf-accent)]/40' : ''
      }`}
    >
      <div className="px-3 py-2 flex items-center justify-between gap-2 overflow-x-auto rf-scrollbar flex-1">
        <div className="text-[var(--rf-text)] leading-snug" style={{ fontSize: `${baseFontPx}px` }}>
          <MathFormula expression={element.mathRaw || ''} latex={element.mathLatex} displayMode={false} />
        </div>
        {canInteract && (
          <div className="pointer-events-auto flex items-center gap-1 shrink-0">
            {onPlot2DFromEquation && (
              <button
                type="button"
                title="Plot 2D Graph"
                onClick={(e) => {
                  e.stopPropagation();
                  onPlot2DFromEquation(element);
                }}
                className="p-1 rounded hover:bg-[var(--rf-surface-hover)] text-[var(--rf-text-muted)] hover:text-[var(--rf-accent)]"
              >
                <Activity className="w-3.5 h-3.5" />
              </button>
            )}
            {onPlot3DFromEquation && (
              <button
                type="button"
                title="Plot 3D Surface"
                onClick={(e) => {
                  e.stopPropagation();
                  onPlot3DFromEquation(element);
                }}
                className="p-1 rounded hover:bg-[var(--rf-surface-hover)] text-[var(--rf-text-muted)] hover:text-[var(--rf-accent)]"
              >
                <Box className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              type="button"
              title="Edit in Math Studio"
              onClick={(e) => {
                e.stopPropagation();
                onOpenMathStudio(element.id, 'equation');
              }}
              className="p-1 rounded hover:bg-[var(--rf-surface-hover)] text-[var(--rf-text-muted)] hover:text-[var(--rf-text)]"
            >
              <Edit3 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {element.mathResult && (
        <div
          style={{ fontSize: `${resultFontPx}px` }}
          className="px-3 py-1.5 border-t border-[var(--rf-border)] bg-[var(--rf-accent-soft)] flex items-center justify-between gap-2"
        >
          <span
            style={{ fontSize: `${opLabelPx}px` }}
            className="font-medium uppercase tracking-wide text-[var(--rf-text-muted)] shrink-0"
          >
            {element.mathOperation || 'Result'}
          </span>
          <span className="font-mono-tabular font-semibold text-[var(--rf-accent)] truncate">
            {element.mathResultLatex ? (
              <MathFormula latex={element.mathResultLatex} />
            ) : (
              element.mathResult
            )}
          </span>
        </div>
      )}
    </div>
  );
};

export const MathMatrixOverlayCard: React.FC<OverlayCommonProps> = ({
  element,
  camera,
  activeTool,
  theme,
  isSelected,
  onOpenMathStudio,
}) => {
  const screenLeft = camera.x + element.x * camera.zoom;
  const screenTop = camera.y + element.y * camera.zoom;
  const worldW = Math.max(48, element.width);
  const worldH = Math.max(36, element.height);
  const canInteract = activeTool === 'select';
  const matrix = element.matrixData || [
    [1, 0],
    [0, 1],
  ];
  const info = useMemo(() => classifyMatrix(matrix), [matrix]);
  const isDark = theme.mode === 'dark';
  const cellFontPx = Math.max(10, Math.min(96, (element.fontSize || 16) * 0.85));
  const metaFontPx = Math.max(8, Math.min(20, Math.round(cellFontPx * 0.62)));
  const minColW = Math.max(14, Math.round(cellFontPx * 1.4));
  const cardTransform = element.angle
    ? `scale(${camera.zoom}) translate(${worldW / 2}px, ${worldH / 2}px) rotate(${element.angle}rad) translate(${-worldW / 2}px, ${-worldH / 2}px)`
    : `scale(${camera.zoom})`;

  return (
    <div
      data-testid={`math-matrix-card-${element.id}`}
      data-font-size={cellFontPx.toFixed(1)}
      data-camera-zoom={camera.zoom}
      style={{
        left: `${screenLeft}px`,
        top: `${screenTop}px`,
        width: `${worldW}px`,
        minHeight: `${worldH}px`,
        opacity: Math.max(0.15, element.opacity / 100),
        transform: cardTransform,
        transformOrigin: '0 0',
        backgroundColor: isDark ? 'rgba(15, 23, 42, 0.92)' : 'rgba(255, 255, 255, 0.96)',
        borderColor: isSelected ? theme.accentColor : theme.borderColor,
      }}
      className={`pointer-events-none absolute rounded-xl border shadow-sm overflow-hidden flex flex-col justify-between ${
        isSelected ? 'ring-2 ring-[var(--rf-accent)]/40' : ''
      }`}
    >
      <div
        style={{ fontSize: `${metaFontPx}px` }}
        className="flex items-center justify-between px-2.5 py-1 border-b border-[var(--rf-border)] font-mono-tabular text-[var(--rf-text-muted)]"
      >
        <span className="font-semibold text-[var(--rf-text)]">
          {element.matrixName || 'A'} ({info.rows}×{info.cols})
        </span>
        <div className="flex items-center gap-1.5">
          <span>{info.tags.slice(0, 2).join(' · ')}</span>
          {canInteract && (
            <button
              type="button"
              title="Open Matrix Engine"
              onClick={(e) => {
                e.stopPropagation();
                onOpenMathStudio(element.id, 'matrix');
              }}
              className="pointer-events-auto p-0.5 rounded hover:bg-[var(--rf-surface-hover)] text-[var(--rf-accent)]"
            >
              <Edit3 className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center px-3 py-2 overflow-auto">
        <div className="flex items-stretch gap-1">
          <div className="w-1.5 border-l-2 border-t-2 border-b-2 border-[var(--rf-text)] rounded-l-[2px]" />
          <div
            className="grid gap-x-3 gap-y-1 px-1 py-0.5 font-mono-tabular text-center text-[var(--rf-text)]"
            style={{
              gridTemplateColumns: `repeat(${info.cols}, minmax(${minColW}px, auto))`,
              fontSize: `${cellFontPx}px`,
            }}
          >
            {matrix.map((row, r) =>
              row.map((val, c) => (
                <span key={`${r}-${c}`} className="tabular-nums">
                  {formatNum(val, 3)}
                </span>
              ))
            )}
          </div>
          <div className="w-1.5 border-r-2 border-t-2 border-b-2 border-[var(--rf-text)] rounded-r-[2px]" />
        </div>
      </div>

      {info.isSquare && typeof info.determinant === 'number' && (
        <div
          style={{ fontSize: `${metaFontPx}px` }}
          className="px-2.5 py-1 border-t border-[var(--rf-border)] font-mono-tabular text-[var(--rf-text-muted)] flex items-center justify-between"
        >
          <span>det = {formatNum(info.determinant, 3)}</span>
          <span>{info.isInvertible ? 'Invertible' : 'Singular'}</span>
        </div>
      )}
    </div>
  );
};

export const MathGraph2DOverlayCard: React.FC<OverlayCommonProps> = ({
  element,
  camera,
  activeTool,
  theme,
  isSelected,
  onSelect,
  onUpdateElement,
  onOpenMathStudio,
}) => {
  const plotCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [interactive, setInteractive] = useState(false);
  const [hoverCoord, setHoverCoord] = useState<{ x: number; y: number } | null>(null);
  const panRef = useRef<{ x: number; y: number; bounds: { xMin: number; xMax: number; yMin: number; yMax: number } } | null>(null);

  const cfg = element.graph2DConfig;
  const screenLeft = camera.x + element.x * camera.zoom;
  const screenTop = camera.y + element.y * camera.zoom;
  const screenW = Math.max(240, element.width * camera.zoom);
  const screenH = Math.max(180, element.height * camera.zoom);
  const canInteract = activeTool === 'select';
  const headerH = 28;
  const footerH = 24;
  const plotH = Math.max(80, screenH - headerH - footerH);

  useEffect(() => {
    const canvas = plotCanvasRef.current;
    if (!canvas || !cfg) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(screenW * dpr);
    canvas.height = Math.floor(plotH * dpr);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawGraph2DOnCanvas(ctx, 0, 0, screenW, plotH, cfg, theme);
  }, [cfg, screenW, plotH, theme]);

  const visibleConic = useMemo(() => {
    if (!cfg) return null;
    for (const eq of cfg.equations) {
      if (!eq.visible) continue;
      const c = analyzeConicEquation(eq.expression);
      if (c.isConic) return c;
    }
    return null;
  }, [cfg]);

  const intersections = useMemo(() => {
    if (!cfg) return [];
    const vis = cfg.equations.filter((e) => e.visible && e.expression.trim());
    if (vis.length < 2 || !cfg.showIntersections) return [];
    return findExplicitIntersections(
      vis[0].expression,
      vis[1].expression,
      cfg.bounds,
      cfg.angleUnit,
      cfg.parameters
    );
  }, [cfg]);

  if (!cfg) return null;

  const zoomBounds = (factor: number, centerX?: number, centerY?: number) => {
    const { xMin, xMax, yMin, yMax } = cfg.bounds;
    const cx = centerX ?? (xMin + xMax) / 2;
    const cy = centerY ?? (yMin + yMax) / 2;
    const nextBounds = {
      xMin: cx - (cx - xMin) * factor,
      xMax: cx + (xMax - cx) * factor,
      yMin: cy - (cy - yMin) * factor,
      yMax: cy + (yMax - cy) * factor,
    };
    onUpdateElement(element.id, { graph2DConfig: { ...cfg, bounds: nextBounds } });
  };

  const resetBounds = () => {
    onUpdateElement(element.id, {
      graph2DConfig: {
        ...cfg,
        bounds: { xMin: -10, xMax: 10, yMin: -10, yMax: 10 },
      },
    });
  };

  return (
    <div
      data-testid={`math-graph-2d-${element.id}`}
      style={{
        left: `${screenLeft}px`,
        top: `${screenTop}px`,
        width: `${screenW}px`,
        height: `${screenH}px`,
        opacity: Math.max(0.15, element.opacity / 100),
        backgroundColor: theme.mode === 'dark' ? '#0f172a' : '#ffffff',
        borderColor: isSelected ? theme.accentColor : theme.borderColor,
      }}
      className={`absolute rounded-xl border shadow-md overflow-hidden flex flex-col ${
        canInteract && interactive ? 'pointer-events-auto' : 'pointer-events-none'
      }`}
    >
      {/* Top Toolbar */}
      <div
        style={{ height: `${headerH}px` }}
        className="px-2.5 flex items-center justify-between border-b border-[var(--rf-border)] bg-[var(--rf-surface-elevated)] text-[11px]"
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <Activity className="w-3.5 h-3.5 text-[var(--rf-accent)] shrink-0" />
          <span className="font-semibold text-[var(--rf-text)] truncate">
            2D Graph ({cfg.equations.filter((e) => e.visible).length})
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSelect(element.id);
              setInteractive((v) => !v);
            }}
            className={`${canInteract ? 'pointer-events-auto' : ''} px-1.5 py-0.5 rounded text-[10px] font-medium ${
              interactive
                ? 'bg-[var(--rf-accent)] text-[var(--rf-accent-fg)]'
                : 'border border-[var(--rf-border)] text-[var(--rf-text-muted)]'
            }`}
          >
            {interactive ? 'Pan Active' : 'Interact'}
          </button>
        </div>

        <div className={`${canInteract ? 'pointer-events-auto' : ''} flex items-center gap-0.5 shrink-0`}>
          <button
            type="button"
            title="Zoom In"
            onClick={(e) => {
              e.stopPropagation();
              onSelect(element.id);
              zoomBounds(0.75);
            }}
            className="p-1 rounded hover:bg-[var(--rf-surface-hover)] text-[var(--rf-text-muted)]"
          >
            <ZoomIn className="w-3 h-3" />
          </button>
          <button
            type="button"
            title="Zoom Out"
            onClick={(e) => {
              e.stopPropagation();
              onSelect(element.id);
              zoomBounds(1.33);
            }}
            className="p-1 rounded hover:bg-[var(--rf-surface-hover)] text-[var(--rf-text-muted)]"
          >
            <ZoomOut className="w-3 h-3" />
          </button>
          <button
            type="button"
            title="Reset View (-10..10)"
            onClick={(e) => {
              e.stopPropagation();
              onSelect(element.id);
              resetBounds();
            }}
            className="p-1 rounded hover:bg-[var(--rf-surface-hover)] text-[var(--rf-text-muted)]"
          >
            <RotateCcw className="w-3 h-3" />
          </button>
          <button
            type="button"
            title="Graph Properties & Bounds"
            onClick={(e) => {
              e.stopPropagation();
              onSelect(element.id);
              onOpenMathStudio(element.id, 'equation');
            }}
            className="p-1 rounded hover:bg-[var(--rf-surface-hover)] text-[var(--rf-accent)]"
          >
            <Sliders className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Interactive Plot Surface */}
      <div className="relative flex-1 overflow-hidden">
        <canvas
          ref={plotCanvasRef}
          className={`block w-full h-full ${interactive ? 'cursor-crosshair' : 'cursor-pointer'}`}
          onPointerDown={(e) => {
            if (!interactive) return;
            e.stopPropagation();
            e.currentTarget.setPointerCapture(e.pointerId);
            panRef.current = { x: e.clientX, y: e.clientY, bounds: { ...cfg.bounds } };
          }}
          onPointerMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const nx = (e.clientX - rect.left) / Math.max(1, rect.width);
            const ny = 1 - (e.clientY - rect.top) / Math.max(1, rect.height);
            const wx = cfg.bounds.xMin + nx * (cfg.bounds.xMax - cfg.bounds.xMin);
            const wy = cfg.bounds.yMin + ny * (cfg.bounds.yMax - cfg.bounds.yMin);
            setHoverCoord({ x: wx, y: wy });

            if (interactive && panRef.current) {
              e.stopPropagation();
              const dxPx = e.clientX - panRef.current.x;
              const dyPx = e.clientY - panRef.current.y;
              const b = panRef.current.bounds;
              const dxWorld = (dxPx / Math.max(1, rect.width)) * (b.xMax - b.xMin);
              const dyWorld = (dyPx / Math.max(1, rect.height)) * (b.yMax - b.yMin);
              onUpdateElement(element.id, {
                graph2DConfig: {
                  ...cfg,
                  bounds: {
                    xMin: b.xMin - dxWorld,
                    xMax: b.xMax - dxWorld,
                    yMin: b.yMin + dyWorld,
                    yMax: b.yMax + dyWorld,
                  },
                },
              });
            }
          }}
          onPointerUp={(e) => {
            if (panRef.current) {
              e.stopPropagation();
              panRef.current = null;
            }
          }}
          onPointerLeave={() => setHoverCoord(null)}
          onWheel={(e) => {
            if (!interactive) return;
            e.stopPropagation();
            const rect = e.currentTarget.getBoundingClientRect();
            const nx = (e.clientX - rect.left) / Math.max(1, rect.width);
            const ny = 1 - (e.clientY - rect.top) / Math.max(1, rect.height);
            const wx = cfg.bounds.xMin + nx * (cfg.bounds.xMax - cfg.bounds.xMin);
            const wy = cfg.bounds.yMin + ny * (cfg.bounds.yMax - cfg.bounds.yMin);
            zoomBounds(e.deltaY > 0 ? 1.15 : 0.87, wx, wy);
          }}
        />

        {hoverCoord && (
          <div className="pointer-events-none absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/70 text-white font-mono-tabular text-[10px]">
            ({hoverCoord.x.toFixed(2)}, {hoverCoord.y.toFixed(2)})
          </div>
        )}
      </div>

      {/* Bottom Readout Strip */}
      <div
        style={{ height: `${footerH}px` }}
        className="px-2.5 flex items-center justify-between border-t border-[var(--rf-border)] bg-[var(--rf-surface-elevated)] font-mono-tabular text-[10px] text-[var(--rf-text-muted)]"
      >
        <span className="truncate">
          {visibleConic
            ? `${visibleConic.type.toUpperCase()} · e=${visibleConic.eccentricity ?? '-'}${
                visibleConic.center ? ` · C(${visibleConic.center.x},${visibleConic.center.y})` : ''
              }`
            : intersections.length > 0
            ? `∩ (${intersections[0].x.toFixed(2)}, ${intersections[0].y.toFixed(2)})${
                intersections.length > 1 ? ` +${intersections.length - 1}` : ''
              }`
            : `x:[${cfg.bounds.xMin.toFixed(1)},${cfg.bounds.xMax.toFixed(1)}] y:[${cfg.bounds.yMin.toFixed(1)},${cfg.bounds.yMax.toFixed(1)}]`}
        </span>
        <span className="uppercase">{cfg.angleUnit}</span>
      </div>
    </div>
  );
};

export const MathGraph3DOverlayCard: React.FC<OverlayCommonProps> = ({
  element,
  camera,
  activeTool,
  theme,
  isSelected,
  onSelect,
  onUpdateElement,
}) => {
  const cfg = element.graph3DConfig;
  const threeHostRef = useRef<HTMLDivElement | null>(null);
  const contourCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const fallbackCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [hasWebGL] = useState<boolean>(() => checkWebGLAvailable());
  const [interactive, setInteractive] = useState(false);

  const screenLeft = camera.x + element.x * camera.zoom;
  const screenTop = camera.y + element.y * camera.zoom;
  const screenW = Math.max(360, element.width * camera.zoom);
  const screenH = Math.max(260, element.height * camera.zoom);
  const canInteract = activeTool === 'select';
  const isDark = theme.mode === 'dark';

  // Three.js WebGL interactive surface renderer
  useEffect(() => {
    const host = threeHostRef.current;
    if (!host || !cfg || !hasWebGL) return;

    const w = Math.max(180, host.clientWidth || 280);
    const h = Math.max(140, host.clientHeight || 200);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(isDark ? 0x0b1220 : 0xffffff);

    const cam3D = new THREE.PerspectiveCamera(42, w / h, 0.1, 100);
    cam3D.position.set(4.5, 3.8, 4.8);
    cam3D.lookAt(0, 0, 0);

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    } catch {
      return;
    }
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    host.innerHTML = '';
    host.appendChild(renderer.domElement);

    const controls = new OrbitControls(cam3D, renderer.domElement);
    controls.enableDamping = true;
    controls.enabled = interactive;

    scene.add(new THREE.AmbientLight(0xffffff, 0.8));
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.7);
    dirLight.position.set(5, 8, 6);
    scene.add(dirLight);

    if (cfg.showAxes) {
      const axes = new THREE.AxesHelper(2.4);
      scene.add(axes);
    }
    if (cfg.showGrid) {
      const gridHelper = new THREE.GridHelper(4.2, 8, 0x64748b, isDark ? 0x1e293b : 0xe2e8f0);
      gridHelper.position.y = -1.2;
      scene.add(gridHelper);
    }

    // Build custom indexed BufferGeometry from evaluated 3D surface grid
    const grid = evaluate3DSurfaceGrid(cfg);
    const { rows, cols, xs, ys, zs, zMinFound, zMaxFound } = grid;
    const xSpan = Math.max(1e-6, cfg.xMax - cfg.xMin);
    const ySpan = Math.max(1e-6, cfg.yMax - cfg.yMin);
    const zSpan = Math.max(1e-6, zMaxFound - zMinFound);

    const positions = new Float32Array(rows * cols * 3);
    const colors = new Float32Array(rows * cols * 3);
    const indices: number[] = [];

    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const idx = j * cols + i;
        const nx = ((xs[i] - cfg.xMin) / xSpan - 0.5) * 3.4;
        const ny = ((ys[j] - cfg.yMin) / ySpan - 0.5) * 3.4;
        const rawZ = zs[idx];
        const nz = Number.isFinite(rawZ) ? ((rawZ - zMinFound) / zSpan - 0.5) * 2.2 : 0;

        positions[idx * 3] = nx;
        positions[idx * 3 + 1] = nz; // Three.js +Y is vertical up
        positions[idx * 3 + 2] = ny;

        const t = Number.isFinite(rawZ) ? (rawZ - zMinFound) / zSpan : 0.5;
        const [r, g, b] = sampleColormap(t, cfg.colormap);
        colors[idx * 3] = r / 255;
        colors[idx * 3 + 1] = g / 255;
        colors[idx * 3 + 2] = b / 255;
      }
    }

    for (let j = 0; j < rows - 1; j++) {
      for (let i = 0; i < cols - 1; i++) {
        const a = j * cols + i;
        const b = a + 1;
        const c = (j + 1) * cols + i;
        const d = c + 1;
        if (
          [zs[a], zs[b], zs[c], zs[d]].every((v) => Number.isFinite(v))
        ) {
          indices.push(a, c, b, b, c, d);
        }
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();

    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      side: THREE.DoubleSide,
      roughness: 0.45,
      metalness: 0.05,
      wireframe: cfg.renderMode === 'wireframe',
    });
    const mesh = new THREE.Mesh(geo, mat);
    scene.add(mesh);

    let wireOverlay: THREE.LineSegments | null = null;
    if (cfg.renderMode === 'surface-mesh') {
      const wireGeo = new THREE.WireframeGeometry(geo);
      const wireMat = new THREE.LineBasicMaterial({
        color: isDark ? 0x0f172a : 0x334155,
        transparent: true,
        opacity: 0.35,
      });
      wireOverlay = new THREE.LineSegments(wireGeo, wireMat);
      scene.add(wireOverlay);
    }

    let rafId = 0;
    const renderLoop = () => {
      controls.update();
      renderer.render(scene, cam3D);
      rafId = requestAnimationFrame(renderLoop);
    };
    renderLoop();

    return () => {
      cancelAnimationFrame(rafId);
      controls.dispose();
      geo.dispose();
      mat.dispose();
      if (wireOverlay) {
        wireOverlay.geometry.dispose();
        (wireOverlay.material as THREE.Material).dispose();
      }
      renderer.dispose();
    };
  }, [cfg, hasWebGL, interactive, isDark, screenW, screenH]);

  // Software isometric fallback if WebGL isn't present
  useEffect(() => {
    const c = fallbackCanvasRef.current;
    if (!c || !cfg || hasWebGL) return;
    const dpr = window.devicePixelRatio || 1;
    const cw = Math.max(180, c.clientWidth || 260);
    const ch = Math.max(120, c.clientHeight || 160);
    c.width = cw * dpr;
    c.height = ch * dpr;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw3DSurfaceIsometricFallback(ctx, 0, 0, cw, ch, cfg, isDark);
  }, [cfg, hasWebGL, isDark, screenW, screenH]);

  // Synchronized 2D contour plot underneath (matching reference image!)
  useEffect(() => {
    const c = contourCanvasRef.current;
    if (!c || !cfg || !cfg.showContour2D) return;
    const dpr = window.devicePixelRatio || 1;
    const cw = Math.max(120, c.clientWidth || 180);
    const ch = Math.max(100, c.clientHeight || 140);
    c.width = cw * dpr;
    c.height = ch * dpr;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawContourPlot2D(ctx, 0, 0, cw, ch, cfg, isDark);
  }, [cfg, isDark, screenW, screenH]);

  if (!cfg) return null;
  const presets = cfg.presetExpressions || [cfg.expression];

  return (
    <div
      data-testid={`math-graph-3d-${element.id}`}
      style={{
        left: `${screenLeft}px`,
        top: `${screenTop}px`,
        width: `${screenW}px`,
        height: `${screenH}px`,
        opacity: Math.max(0.15, element.opacity / 100),
        backgroundColor: isDark ? '#0f172a' : '#f8fafc',
        borderColor: isSelected ? theme.accentColor : theme.borderColor,
      }}
      className={`absolute rounded-xl border shadow-md overflow-hidden flex flex-col ${
        canInteract ? 'pointer-events-auto' : 'pointer-events-none'
      }`}
      onClick={(e) => {
        if (!canInteract) return;
        e.stopPropagation();
        onSelect(element.id);
      }}
    >
      {/* Header Bar */}
      <div className="px-2.5 py-1.5 border-b border-[var(--rf-border)] bg-[var(--rf-surface-elevated)] flex items-center justify-between gap-2 text-[11px]">
        <div className="flex items-center gap-1.5 min-w-0">
          <Box className="w-3.5 h-3.5 text-[var(--rf-accent)] shrink-0" />
          <span className="font-semibold text-[var(--rf-text)] truncate">
            3D & Contour Plot
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setInteractive((v) => !v);
            }}
            className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
              interactive
                ? 'bg-[var(--rf-accent)] text-[var(--rf-accent-fg)]'
                : 'border border-[var(--rf-border)] text-[var(--rf-text-muted)]'
            }`}
          >
            {interactive ? 'Orbit Active' : 'Orbit 3D'}
          </button>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              const nextMode =
                cfg.renderMode === 'surface-mesh'
                  ? 'surface'
                  : cfg.renderMode === 'surface'
                  ? 'wireframe'
                  : 'surface-mesh';
              onUpdateElement(element.id, { graph3DConfig: { ...cfg, renderMode: nextMode } });
            }}
            className="px-1.5 py-0.5 rounded border border-[var(--rf-border)] text-[10px] text-[var(--rf-text)] hover:bg-[var(--rf-surface-hover)]"
          >
            {cfg.renderMode === 'surface-mesh'
              ? 'Mesh'
              : cfg.renderMode === 'wireframe'
              ? 'Wire'
              : 'Solid'}
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onUpdateElement(element.id, {
                graph3DConfig: { ...cfg, showContour2D: !cfg.showContour2D },
              });
            }}
            className={`px-1.5 py-0.5 rounded border text-[10px] ${
              cfg.showContour2D
                ? 'bg-[var(--rf-accent)] text-[var(--rf-accent-fg)] border-transparent'
                : 'border-[var(--rf-border)] text-[var(--rf-text-muted)]'
            }`}
          >
            Contour
          </button>
        </div>
      </div>

      {/* Main Split Workspace: Left Controls (Functions + Constants Sliders) & Right 3D + Contour Plots */}
      <div className="flex-1 min-h-0 flex">
        {/* Left Controls Sidebar */}
        <div
          className="w-40 shrink-0 border-r border-[var(--rf-border)] bg-[var(--rf-surface)] p-2 overflow-y-auto rf-scrollbar space-y-2.5 text-[11px]"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div>
            <div className="font-semibold text-[var(--rf-text-muted)] text-[10px] uppercase tracking-wide mb-1">
              function f(x, y)
            </div>
            <div className="space-y-1">
              {presets.map((expr) => {
                const active = cfg.expression === expr;
                return (
                  <label
                    key={expr}
                    className={`flex items-start gap-1.5 p-1 rounded cursor-pointer transition-colors ${
                      active ? 'bg-[var(--rf-accent-soft)] text-[var(--rf-text)]' : 'hover:bg-[var(--rf-surface-hover)]'
                    }`}
                  >
                    <input
                      type="radio"
                      name={`fn-${element.id}`}
                      checked={active}
                      onChange={() =>
                        onUpdateElement(element.id, { graph3DConfig: { ...cfg, expression: expr } })
                      }
                      className="mt-0.5 accent-[var(--rf-accent)]"
                    />
                    <span className="text-[10px] leading-tight overflow-hidden text-ellipsis">
                      <MathFormula expression={expr} />
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="border-t border-[var(--rf-border)] pt-2">
            <div className="font-semibold text-[var(--rf-text-muted)] text-[10px] uppercase tracking-wide mb-1.5">
              constants
            </div>
            <div className="space-y-1.5">
              {(['a', 'b', 'c', 'd'] as const).map((param) => {
                const val = cfg.constants[param] ?? (param === 'a' || param === 'b' ? 1 : 0);
                return (
                  <div key={param} className="space-y-0.5">
                    <div className="flex items-center justify-between text-[10px] font-mono-tabular">
                      <span className="italic font-semibold text-[var(--rf-text)]">{param}</span>
                      <span className="text-[var(--rf-accent)]">{val.toFixed(1)}</span>
                    </div>
                    <input
                      type="range"
                      min={-3}
                      max={3}
                      step={0.1}
                      value={val}
                      onChange={(e) =>
                        onUpdateElement(element.id, {
                          graph3DConfig: {
                            ...cfg,
                            constants: { ...cfg.constants, [param]: Number(e.target.value) },
                          },
                        })
                      }
                      className="w-full accent-[var(--rf-accent)] cursor-pointer h-1"
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right 3D Surface + Synchronized 2D Contour Plot */}
        <div className="flex-1 min-w-0 flex flex-col p-1.5 gap-1.5">
          <div className="text-center text-[10px] font-mono-tabular text-[var(--rf-text-muted)] truncate">
            f(x, y) = <MathFormula expression={cfg.expression} />
          </div>
          <div className="flex-1 min-h-0 flex flex-col gap-1.5">
            <div className="flex-1 min-h-0 relative rounded-lg overflow-hidden border border-[var(--rf-border)]">
              {hasWebGL ? (
                <div ref={threeHostRef} className="w-full h-full" />
              ) : (
                <canvas ref={fallbackCanvasRef} className="w-full h-full block" />
              )}
            </div>
            {cfg.showContour2D && (
              <div className="h-[42%] min-h-[75px] relative rounded-lg overflow-hidden border border-[var(--rf-border)] flex items-center justify-center bg-[var(--rf-surface)]">
                <canvas ref={contourCanvasRef} className="w-full h-full block" />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
