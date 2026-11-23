import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  ArrowRight,
  Check,
  ChevronDown,
  ChevronUp,
  Crosshair,
  Edit3,
  Maximize2,
  Minimize2,
  Minus,
  Monitor,
  Moon,
  Move,
  Pin,
  Plus,
  RotateCw,
  Search,
  Sparkles,
  Sun,
  Trash2,
  X,
} from 'lucide-react';
import { CanvasThemeId } from '../types';
import {
  CanvasCategory,
  SpatialCanvasRecord,
  SpatialPosition,
  formatRelativeTime,
  searchCanvases,
} from '../hub/canvasHubStore';
import {
  BoardTextureMode,
  createBoardCanvasTexture,
  renderBoardThumbnailDataUrl,
} from '../hub/boardTextureRenderer';
import { CANVAS_THEMES } from '../themes';

export type HubSpaceThemePreference = 'system' | 'light' | 'dark';
export type HubSpaceTheme = 'light' | 'dark';

const HUB_SPACE_THEME_KEY = 'spark-hub-space-theme-v2';

function loadInitialSpaceThemePreference(): HubSpaceThemePreference {
  try {
    const saved = localStorage.getItem(HUB_SPACE_THEME_KEY);
    if (saved === 'system' || saved === 'light' || saved === 'dark') return saved;
  } catch {
    // Ignore storage issues
  }
  return 'system';
}

function getSystemDarkMatches(): boolean {
  try {
    return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  } catch {
    return false;
  }
}

interface CanvasHub3DProps {
  canvases: SpatialCanvasRecord[];
  activeCanvasId: string | null;
  onOpenCanvas: (canvasId: string) => void;
  onCreateBlankCanvas: (
    category?: CanvasCategory,
    options?: { canvasThemeId?: CanvasThemeId; spatialPosition?: SpatialPosition }
  ) => SpatialCanvasRecord;
  onRenameCanvas: (canvasId: string, nextTitle: string) => void;
  onUpdateCanvasPosition: (canvasId: string, position: SpatialPosition) => void;
  onAutoArrange?: () => void;
  onDeleteCanvas: (canvasId: string) => void;
  onBackToSplash: () => void;
}

interface BoardRuntime {
  id: string;
  group: THREE.Group;
  frameMesh: THREE.Mesh;
  faceMesh: THREE.Mesh;
  pinGroup: THREE.Group;
  shadowMesh: THREE.Mesh;
  glowMesh: THREE.Mesh;
  highlightEdges: THREE.LineSegments;
  overviewTexture: THREE.CanvasTexture;
  inspectTexture: THREE.CanvasTexture;
  currentMode: BoardTextureMode;
  targetPos: THREE.Vector3;
  targetRotY: number;
  pinned: boolean;
  signature: string;
}

const CLOSE_ZOOM_THRESHOLD = 16.5;
const INSPECT_DISTANCE = 7.4;
const BOARD_W = 5.6;
const BOARD_H = 3.5;

const SPACE_PALETTES: Record<
  HubSpaceTheme,
  {
    bg: string;
    fog: string;
    skyZenith: string;
    skyMid: string;
    skyHorizon: string;
    auroraA: string;
    auroraB: string;
    auroraOpacity: number;
    floorColor: string;
    floorRoughness: number;
    floorMetalness: number;
    gridMajor: string;
    gridMinor: string;
    ringColor: string;
    particleColor: string;
    particleOpacity: number;
    hemiSky: string;
    hemiGround: string;
    hemiIntensity: number;
    keyColor: string;
    keyIntensity: number;
    fillColor: string;
    fillIntensity: number;
    slabColor: string;
    slabRoughness: number;
    slabMetalness: number;
    edgeColor: string;
    glowColor: string;
  }
> = {
  light: {
    bg: '#E3F6EE',
    fog: '#D9F1E7',
    skyZenith: '#F8FCFA',
    skyMid: '#E3F6EE',
    skyHorizon: '#BEEAD8',
    auroraA: '#10B981',
    auroraB: '#6EE7B7',
    auroraOpacity: 0.56,
    floorColor: '#ECF9F3',
    floorRoughness: 0.24,
    floorMetalness: 0.06,
    gridMajor: '#A7E3CA',
    gridMinor: '#D1F2E4',
    ringColor: '#10B981',
    particleColor: '#10B981',
    particleOpacity: 0.35,
    hemiSky: '#FFFFFF',
    hemiGround: '#B7E4CE',
    hemiIntensity: 1.25,
    keyColor: '#FFFDF8',
    keyIntensity: 1.35,
    fillColor: '#CFF5E6',
    fillIntensity: 0.65,
    slabColor: '#FFFFFF',
    slabRoughness: 0.14,
    slabMetalness: 0.06,
    edgeColor: '#059669',
    glowColor: '#34D399',
  },
  dark: {
    bg: '#040B09',
    fog: '#040B09',
    skyZenith: '#020706',
    skyMid: '#061812',
    skyHorizon: '#0B2C21',
    auroraA: '#10B981',
    auroraB: '#2DD4BF',
    auroraOpacity: 0.54,
    floorColor: '#040D0A',
    floorRoughness: 0.38,
    floorMetalness: 0.14,
    gridMajor: '#144334',
    gridMinor: '#0A221A',
    ringColor: '#34D399',
    particleColor: '#34D399',
    particleOpacity: 0.42,
    hemiSky: '#1B3B31',
    hemiGround: '#041A13',
    hemiIntensity: 0.95,
    keyColor: '#E6FFF5',
    keyIntensity: 1.2,
    fillColor: '#10B981',
    fillIntensity: 0.48,
    slabColor: '#12261F',
    slabRoughness: 0.2,
    slabMetalness: 0.28,
    edgeColor: '#34D399',
    glowColor: '#10B981',
  },
};

function detectSoftwareWebGL(): boolean {
  try {
    const probe = document.createElement('canvas');
    const gl = probe.getContext('webgl2') || probe.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

function createExtrudedSlabGeometry(width: number, height: number, depth: number, radius: number) {
  const shape = new THREE.Shape();
  const hw = width / 2;
  const hh = height / 2;
  const r = Math.min(radius, hw * 0.25, hh * 0.25);

  shape.moveTo(-hw + r, -hh);
  shape.lineTo(hw - r, -hh);
  shape.quadraticCurveTo(hw, -hh, hw, -hh + r);
  shape.lineTo(hw, hh - r);
  shape.quadraticCurveTo(hw, hh, hw - r, hh);
  shape.lineTo(-hw + r, hh);
  shape.quadraticCurveTo(-hw, hh, -hw, hh - r);
  shape.lineTo(-hw, -hh + r);
  shape.quadraticCurveTo(-hw, -hh, -hw + r, -hh);

  const geom = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: 0.04,
    bevelSize: 0.04,
    bevelSegments: 3,
    curveSegments: 10,
  });
  geom.center();
  return geom;
}

function createRadialShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createRadialGradient(128, 128, 18, 128, 128, 128);
    grad.addColorStop(0, 'rgba(2, 22, 16, 0.34)');
    grad.addColorStop(0.55, 'rgba(2, 22, 16, 0.12)');
    grad.addColorStop(1, 'rgba(2, 22, 16, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createRadialGlowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createRadialGradient(128, 128, 8, 128, 128, 128);
    grad.addColorStop(0, 'rgba(255, 255, 255, 0.85)');
    grad.addColorStop(0.45, 'rgba(255, 255, 255, 0.28)');
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createFloorAlphaTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createRadialGradient(128, 128, 12, 128, 128, 128);
    grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
    grad.addColorStop(0.42, 'rgba(220, 220, 220, 0.92)');
    grad.addColorStop(0.74, 'rgba(110, 110, 110, 0.45)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

function createSkyDomeMaterial(palette: (typeof SPACE_PALETTES)[HubSpaceTheme]): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      uZenith: { value: new THREE.Color(palette.skyZenith) },
      uMid: { value: new THREE.Color(palette.skyMid) },
      uHorizon: { value: new THREE.Color(palette.skyHorizon) },
    },
    vertexShader: `
      varying vec3 vWorldDir;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldDir = normalize(position);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      varying vec3 vWorldDir;
      uniform vec3 uZenith;
      uniform vec3 uMid;
      uniform vec3 uHorizon;
      void main() {
        float h = clamp(vWorldDir.y * 0.5 + 0.5, 0.0, 1.0);
        vec3 col = mix(uHorizon, uMid, smoothstep(0.32, 0.58, h));
        col = mix(col, uZenith, smoothstep(0.55, 0.92, h));
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
}

function createAuroraRibbonMaterial(
  palette: (typeof SPACE_PALETTES)[HubSpaceTheme],
  phaseOffset: number
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.NormalBlending,
    uniforms: {
      uTime: { value: 0 },
      uPhase: { value: phaseOffset },
      uColorA: { value: new THREE.Color(palette.auroraA) },
      uColorB: { value: new THREE.Color(palette.auroraB) },
      uOpacity: { value: palette.auroraOpacity },
    },
    vertexShader: `
      varying vec2 vUv;
      uniform float uTime;
      uniform float uPhase;
      void main() {
        vUv = uv;
        vec3 pos = position;
        float wave = sin(pos.x * 0.08 + uTime * 0.4 + uPhase) * 2.6
                   + cos(pos.x * 0.04 - uTime * 0.22 + uPhase) * 1.5;
        pos.y += wave;
        pos.z += cos(pos.x * 0.065 + uTime * 0.28 + uPhase) * 2.0;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      uniform vec3 uColorA;
      uniform vec3 uColorB;
      uniform float uOpacity;
      uniform float uTime;
      uniform float uPhase;
      void main() {
        float edgeV = sin(vUv.y * 3.14159265);
        float edgeU = sin(vUv.x * 3.14159265);
        float fold = 0.5 + 0.5 * sin(vUv.y * 9.42477 + sin(vUv.x * 6.28318 + uPhase) * 1.6 + uTime * 0.2);
        float ribbonBody = pow(edgeV, 1.35) * pow(edgeU, 0.65) * (0.55 + 0.45 * fold);
        float crest = pow(edgeV, 3.0) * pow(fold, 4.0) * edgeU;
        vec3 baseCol = mix(uColorA, uColorB, vUv.x * 0.6 + vUv.y * 0.4);
        vec3 col = mix(baseCol, vec3(0.95, 1.0, 0.98), crest * 0.72);
        float alpha = clamp(ribbonBody * uOpacity + crest * (uOpacity * 0.68), 0.0, 0.85);
        gl_FragColor = vec4(col, alpha);
      }
    `,
  });
}

// Pre-allocated vectors for the 60fps loop (zero per-frame GC)
const _walkForward = new THREE.Vector3();
const _walkRight = new THREE.Vector3();
const _walkUp = new THREE.Vector3(0, 1, 0);
const _walkInput = new THREE.Vector3();
const _walkStep = new THREE.Vector3();
const _dragNormal = new THREE.Vector3();
const _dragHit = new THREE.Vector3();
const _tmpVec = new THREE.Vector3();
const _projVec = new THREE.Vector3();
const _camDirVec = new THREE.Vector3();
const _toBoardVec = new THREE.Vector3();

export const CanvasHub3D: React.FC<CanvasHub3DProps> = ({
  canvases,
  activeCanvasId,
  onOpenCanvas,
  onCreateBlankCanvas,
  onRenameCanvas,
  onUpdateCanvasPosition,
  onAutoArrange,
  onDeleteCanvas,
  onBackToSplash,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [spaceThemePref, setSpaceThemePref] = useState<HubSpaceThemePreference>(
    loadInitialSpaceThemePreference
  );
  const [systemIsDark, setSystemIsDark] = useState<boolean>(getSystemDarkMatches);
  const spaceTheme: HubSpaceTheme =
    spaceThemePref === 'system' ? (systemIsDark ? 'dark' : 'light') : spaceThemePref;

  const [searchQuery, setSearchQuery] = useState('');
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [closeInspectId, setCloseInspectId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [isDraggingBoard, setIsDraggingBoard] = useState(false);
  const [webglError, setWebglError] = useState(false);
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [controlsCollapsed, setControlsCollapsed] = useState(false);
  const [interactionTool, setInteractionTool] = useState<'drag' | 'orbit'>('drag');
  const [autoRotateEnabled, setAutoRotateEnabled] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [switcherIndex, setSwitcherIndex] = useState(0);
  const [hudAnchor, setHudAnchor] = useState<{ x: number; y: number; visible: boolean }>({
    x: 0,
    y: 0,
    visible: false,
  });

  const renameInputRef = useRef<HTMLInputElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const visibleCanvases = useMemo(
    () => searchCanvases(canvases, searchQuery, 'All'),
    [canvases, searchQuery]
  );
  const visibleCanvasesRef = useRef(visibleCanvases);
  visibleCanvasesRef.current = visibleCanvases;

  const activeInspectionRecord = useMemo(() => {
    const id = focusedId || closeInspectId;
    if (!id) return null;
    return canvases.find((c) => c.id === id) || null;
  }, [canvases, closeInspectId, focusedId]);

  const spaceThemeRef = useRef(spaceTheme);
  spaceThemeRef.current = spaceTheme;
  const canvasesRef = useRef(canvases);
  canvasesRef.current = canvases;
  const focusedIdRef = useRef(focusedId);
  focusedIdRef.current = focusedId;
  const hoveredIdRef = useRef(hoveredId);
  hoveredIdRef.current = hoveredId;
  const closeInspectIdRef = useRef(closeInspectId);
  closeInspectIdRef.current = closeInspectId;
  const interactionToolRef = useRef(interactionTool);
  interactionToolRef.current = interactionTool;
  const autoRotateRef = useRef(autoRotateEnabled);
  autoRotateRef.current = autoRotateEnabled;
  const onUpdateCanvasPositionRef = useRef(onUpdateCanvasPosition);
  onUpdateCanvasPositionRef.current = onUpdateCanvasPosition;

  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const boardsGroupRef = useRef<THREE.Group | null>(null);
  const boardsMapRef = useRef<Map<string, BoardRuntime>>(new Map());
  const keysPressedRef = useRef<Set<string>>(new Set());
  const walkVelocityRef = useRef(new THREE.Vector3());

  const envRefs = useRef<{
    skyMat: THREE.ShaderMaterial;
    ribbonMats: THREE.ShaderMaterial[];
    floorMesh: THREE.Mesh;
    gridHelper: THREE.GridHelper;
    ringMesh: THREE.Mesh;
    ringMeshOuter: THREE.Mesh;
    particles: THREE.Points;
    hemiLight: THREE.HemisphereLight;
    keyLight: THREE.DirectionalLight;
    fillLight: THREE.DirectionalLight;
    shadowTex: THREE.CanvasTexture;
    glowTex: THREE.CanvasTexture;
  } | null>(null);

  const sharedGeomsRef = useRef<{
    slab: THREE.ExtrudeGeometry;
    face: THREE.PlaneGeometry;
    shadow: THREE.PlaneGeometry;
    glow: THREE.PlaneGeometry;
    highlightEdgesGeom: THREE.EdgesGeometry;
    pinStem: THREE.CylinderGeometry;
    pinHead: THREE.SphereGeometry;
  } | null>(null);

  const flyTargetRef = useRef<{
    camPos: THREE.Vector3;
    targetPos: THREE.Vector3;
    active: boolean;
    startedAt: number;
    onArrive?: () => void;
  }>({
    camPos: new THREE.Vector3(0, 1.8, 31.5),
    targetPos: new THREE.Vector3(0, 0, 0),
    active: false,
    startedAt: 0,
  });

  const dragBoardRef = useRef<{
    boardId: string;
    startClientX: number;
    startClientY: number;
    hasMoved: boolean;
    plane: THREE.Plane;
    offset: THREE.Vector3;
    lastPos: THREE.Vector3;
    lastRotY: number;
  } | null>(null);

  // Follow OS prefers-color-scheme changes in real time
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    setSystemIsDark(mq.matches);
    const listener = (e: MediaQueryListEvent) => {
      setSystemIsDark(e.matches);
    };
    mq.addEventListener('change', listener);
    return () => mq.removeEventListener('change', listener);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(HUB_SPACE_THEME_KEY, spaceThemePref);
    } catch {
      // Ignore storage errors
    }
  }, [spaceThemePref]);

  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const flyToBoard = useCallback(
    (boardId: string, distance = INSPECT_DISTANCE, onArrive?: () => void) => {
      const runtime = boardsMapRef.current.get(boardId);
      if (!runtime) {
        if (onArrive) onArrive();
        return;
      }
      const boardPos = runtime.targetPos.clone();
      const normal = new THREE.Vector3(0, 0, 1).applyAxisAngle(
        new THREE.Vector3(0, 1, 0),
        runtime.targetRotY
      );
      const camPos = boardPos.clone().addScaledVector(normal, distance);
      camPos.y += 0.14;
      flyTargetRef.current = {
        camPos,
        targetPos: boardPos,
        active: true,
        startedAt: performance.now(),
        onArrive,
      };
    },
    []
  );

  const flyToOverview = useCallback(() => {
    setFocusedId(null);
    setCloseInspectId(null);
    flyTargetRef.current = {
      camPos: new THREE.Vector3(0, 1.8, 31.5),
      targetPos: new THREE.Vector3(0, 0, 0),
      active: true,
      startedAt: performance.now(),
    };
  }, []);

  const zoomCameraBy = useCallback((deltaDist: number) => {
    const cam = cameraRef.current;
    const controls = controlsRef.current;
    if (!cam || !controls) return;
    flyTargetRef.current.active = false;
    const dir = new THREE.Vector3().subVectors(controls.target, cam.position);
    const dist = dir.length();
    if (dist < 0.001) return;
    dir.normalize();
    const step = THREE.MathUtils.clamp(deltaDist, -dist + 2.8, 12);
    cam.position.addScaledVector(dir, step);
    controls.update();
  }, []);

  const toggleFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      // Ignore fullscreen denial in restricted iframes
    }
  }, []);

  const launchCanvasWithZoom = useCallback(
    (canvasId: string) => {
      const runtime = boardsMapRef.current.get(canvasId);
      if (!runtime) {
        onOpenCanvas(canvasId);
        return;
      }
      setFocusedId(canvasId);
      flyToBoard(canvasId, 3.6, () => {
        onOpenCanvas(canvasId);
      });
    },
    [flyToBoard, onOpenCanvas]
  );

  const launchCanvasWithZoomRef = useRef(launchCanvasWithZoom);
  launchCanvasWithZoomRef.current = launchCanvasWithZoom;
  const flyToBoardRef = useRef(flyToBoard);
  flyToBoardRef.current = flyToBoard;

  const cycleCanvasViaSwitcher = useCallback(
    (reverse = false, showOverlay = true) => {
      const list = visibleCanvasesRef.current;
      if (list.length === 0) return;

      const currentId = focusedIdRef.current || closeInspectIdRef.current || activeCanvasId;
      let currIdx = currentId ? list.findIndex((c) => c.id === currentId) : -1;
      if (currIdx < 0) currIdx = reverse ? 0 : -1;

      const nextIdx = (currIdx + (reverse ? -1 : 1) + list.length) % list.length;
      const nextCanvas = list[nextIdx];
      if (!nextCanvas) return;

      setSwitcherIndex(nextIdx);
      if (showOverlay) setSwitcherOpen(true);
      setFocusedId(nextCanvas.id);
      setCloseInspectId(nextCanvas.id);
      flyToBoard(nextCanvas.id, INSPECT_DISTANCE);
    },
    [activeCanvasId, flyToBoard]
  );

  const startInlineRename = useCallback((record: SpatialCanvasRecord) => {
    setEditingTitleId(record.id);
    setDraftTitle(record.title);
    setTimeout(() => {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    }, 30);
  }, []);

  const commitInlineRename = useCallback(() => {
    if (!editingTitleId) return;
    const trimmed = draftTitle.trim();
    if (trimmed) {
      onRenameCanvas(editingTitleId, trimmed);
    }
    setEditingTitleId(null);
  }, [draftTitle, editingTitleId, onRenameCanvas]);

  const handleCreateNew = useCallback(() => {
    const cam = cameraRef.current;
    let spawnPos: SpatialPosition = { x: 0, y: 0.6, z: 6, rotY: 0, pinned: true };
    if (cam) {
      const forward = new THREE.Vector3();
      cam.getWorldDirection(forward);
      const target = cam.position.clone().addScaledVector(forward, 9.5);
      target.y = Math.max(-9.5, target.y);
      const rotY = Math.atan2(cam.position.x - target.x, cam.position.z - target.z);
      spawnPos = {
        x: Number(target.x.toFixed(2)),
        y: Number(target.y.toFixed(2)),
        z: Number(target.z.toFixed(2)),
        rotY: Number(rotY.toFixed(4)),
        pinned: true,
      };
    }

    const created = onCreateBlankCanvas('Architecture', {
      canvasThemeId: spaceTheme === 'dark' ? 'black-slate' : 'emerald-minimal',
      spatialPosition: spawnPos,
    });
    setSearchQuery('');
    setFocusedId(created.id);
    setCloseInspectId(created.id);
    setEditingTitleId(created.id);
    setDraftTitle(created.title);
    setTimeout(() => {
      flyToBoard(created.id, INSPECT_DISTANCE);
      setTimeout(() => {
        renameInputRef.current?.focus();
        renameInputRef.current?.select();
      }, 60);
    }, 45);
  }, [flyToBoard, onCreateBlankCanvas, spaceTheme]);

  // Global keyboard shortcuts: Alt+Tab switcher + Ctrl+K + WASD space walking
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && (e.code === 'Tab' || e.key === 'Tab')) {
        e.preventDefault();
        e.stopPropagation();
        cycleCanvasViaSwitcher(e.shiftKey, true);
        return;
      }

      const target = e.target as HTMLElement | null;
      const isTyping =
        target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable;

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
        return;
      }

      if (e.key === 'Escape') {
        if (switcherOpen) {
          setSwitcherOpen(false);
          return;
        }
        if (editingTitleId) {
          setEditingTitleId(null);
          return;
        }
        setFocusedId(null);
        setCloseInspectId(null);
        return;
      }

      if (isTyping) return;

      const code = e.code;
      if (
        code === 'KeyW' ||
        code === 'KeyA' ||
        code === 'KeyS' ||
        code === 'KeyD' ||
        code === 'KeyQ' ||
        code === 'KeyE' ||
        code === 'ArrowUp' ||
        code === 'ArrowDown' ||
        code === 'ArrowLeft' ||
        code === 'ArrowRight' ||
        code === 'ShiftLeft' ||
        code === 'ShiftRight'
      ) {
        keysPressedRef.current.add(code);
        flyTargetRef.current.active = false;
        flyTargetRef.current.onArrive = undefined;
      }

      if (e.key === '/') {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === 'Enter' && (closeInspectId || focusedId)) {
        e.preventDefault();
        setSwitcherOpen(false);
        launchCanvasWithZoom((closeInspectId || focusedId)!);
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      keysPressedRef.current.delete(e.code);
      if (
        (e.key === 'Alt' || e.code === 'AltLeft' || e.code === 'AltRight') &&
        switcherOpen
      ) {
        setSwitcherOpen(false);
      }
    };

    const onBlur = () => {
      keysPressedRef.current.clear();
      setSwitcherOpen(false);
    };

    window.addEventListener('keydown', onKeyDown, { capture: true });
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown, { capture: true });
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [
    closeInspectId,
    cycleCanvasViaSwitcher,
    editingTitleId,
    focusedId,
    launchCanvasWithZoom,
    switcherOpen,
  ]);

  // Initialize Three.js WebGL scene once
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftware = detectSoftwareWebGL();
    const reducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftware,
        alpha: false,
        powerPreference: isSoftware ? 'default' : 'high-performance',
      });
    } catch {
      setWebglError(true);
      return;
    }

    renderer.setPixelRatio(isSoftware ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.04;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const palette = SPACE_PALETTES[spaceThemeRef.current];

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(palette.bg);
    scene.fog = new THREE.FogExp2(palette.fog, 0.0072);
    sceneRef.current = scene;

    // Volumetric gradient sky dome matching Light Mint & Obsidian Dark studio aesthetics
    const skyGeom = new THREE.SphereGeometry(145, 32, 24);
    const skyMat = createSkyDomeMaterial(palette);
    const skyMesh = new THREE.Mesh(skyGeom, skyMat);
    scene.add(skyMesh);

    // Sweeping luminous emerald aurora ribbons in 3D space
    const ribbonGeomA = new THREE.PlaneGeometry(86, 15, 48, 12);
    const ribbonMatA = createAuroraRibbonMaterial(palette, 0.0);
    const ribbonA = new THREE.Mesh(ribbonGeomA, ribbonMatA);
    ribbonA.position.set(-16, 12.2, -17);
    ribbonA.rotation.set(0.24, 0.12, -0.22);
    scene.add(ribbonA);

    const ribbonGeomB = new THREE.PlaneGeometry(80, 13, 44, 12);
    const ribbonMatB = createAuroraRibbonMaterial(palette, 2.3);
    const ribbonB = new THREE.Mesh(ribbonGeomB, ribbonMatB);
    ribbonB.position.set(17, -6.2, -16);
    ribbonB.rotation.set(-0.2, -0.14, 0.24);
    scene.add(ribbonB);

    const ribbonGeomC = new THREE.PlaneGeometry(68, 11, 36, 10);
    const ribbonMatC = createAuroraRibbonMaterial(palette, 4.1);
    const ribbonC = new THREE.Mesh(ribbonGeomC, ribbonMatC);
    ribbonC.position.set(20, 11.5, -26);
    ribbonC.rotation.set(0.18, -0.25, 0.14);
    scene.add(ribbonC);

    // Studio softbox environment reflections
    const pmrem = new THREE.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    const envTarget = pmrem.fromScene(roomEnv, 0.04);
    scene.environment = envTarget.texture;
    roomEnv.dispose();
    pmrem.dispose();

    const camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / Math.max(1, container.clientHeight),
      0.1,
      280
    );
    camera.position.set(0, 1.8, 31.5);
    cameraRef.current = camera;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftware;
    controls.dampingFactor = 0.065;
    controls.minDistance = 2.6;
    controls.maxDistance = 85;
    controls.maxPolarAngle = Math.PI * 0.85;
    controls.minPolarAngle = Math.PI * 0.12;
    controls.autoRotateSpeed = 0.75;
    controls.mouseButtons = {
      LEFT: THREE.MOUSE.ROTATE,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.PAN,
    };
    controlsRef.current = controls;

    const onControlsStart = () => {
      flyTargetRef.current.active = false;
      flyTargetRef.current.onArrive = undefined;
    };
    controls.addEventListener('start', onControlsStart);

    // Three-point studio lighting
    const hemiLight = new THREE.HemisphereLight(
      palette.hemiSky,
      palette.hemiGround,
      palette.hemiIntensity
    );
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(palette.keyColor, palette.keyIntensity);
    keyLight.position.set(16, 28, 22);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(palette.fillColor, palette.fillIntensity);
    fillLight.position.set(-18, 12, -12);
    scene.add(fillLight);

    // Smooth horizon-faded studio floor + subtle architectural grid + concentric origin rings
    const floorAlphaTex = createFloorAlphaTexture();
    const floorGeom = new THREE.CircleGeometry(110, 64);
    const floorMat = new THREE.MeshStandardMaterial({
      color: palette.floorColor,
      roughness: palette.floorRoughness,
      metalness: palette.floorMetalness,
      alphaMap: floorAlphaTex,
      transparent: true,
      envMapIntensity: 0.35,
    });
    const floorMesh = new THREE.Mesh(floorGeom, floorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.position.y = -12.8;
    scene.add(floorMesh);

    const gridHelper = new THREE.GridHelper(
      110,
      36,
      new THREE.Color(palette.gridMajor),
      new THREE.Color(palette.gridMinor)
    );
    gridHelper.position.y = -12.76;
    const gridMats = Array.isArray(gridHelper.material)
      ? gridHelper.material
      : [gridHelper.material];
    gridMats.forEach((m) => {
      m.transparent = true;
      m.opacity = 0.2;
    });
    scene.add(gridHelper);

    const ringGeom = new THREE.RingGeometry(4.8, 4.92, 72);
    const ringMat = new THREE.MeshBasicMaterial({
      color: palette.ringColor,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.28,
    });
    const ringMesh = new THREE.Mesh(ringGeom, ringMat);
    ringMesh.rotation.x = -Math.PI / 2;
    ringMesh.position.y = -12.74;
    scene.add(ringMesh);

    const ringGeomOuter = new THREE.RingGeometry(11.6, 11.72, 96);
    const ringMatOuter = new THREE.MeshBasicMaterial({
      color: palette.ringColor,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.14,
    });
    const ringMeshOuter = new THREE.Mesh(ringGeomOuter, ringMatOuter);
    ringMeshOuter.rotation.x = -Math.PI / 2;
    ringMeshOuter.position.y = -12.74;
    scene.add(ringMeshOuter);

    // Subtle spatial particles
    const particleCount = isSoftware ? 75 : 190;
    const pPositions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      pPositions[i * 3] = (Math.random() - 0.5) * 78;
      pPositions[i * 3 + 1] = (Math.random() - 0.5) * 34;
      pPositions[i * 3 + 2] = (Math.random() - 0.5) * 64;
    }
    const particleGeom = new THREE.BufferGeometry();
    particleGeom.setAttribute('position', new THREE.BufferAttribute(pPositions, 3));
    const particleMat = new THREE.PointsMaterial({
      color: palette.particleColor,
      size: 0.14,
      transparent: true,
      opacity: palette.particleOpacity,
    });
    const particles = new THREE.Points(particleGeom, particleMat);
    scene.add(particles);

    const shadowTex = createRadialShadowTexture();
    const glowTex = createRadialGlowTexture();

    envRefs.current = {
      skyMat,
      ribbonMats: [ribbonMatA, ribbonMatB, ribbonMatC],
      floorMesh,
      gridHelper,
      ringMesh,
      ringMeshOuter,
      particles,
      hemiLight,
      keyLight,
      fillLight,
      shadowTex,
      glowTex,
    };

    const boardsGroup = new THREE.Group();
    scene.add(boardsGroup);
    boardsGroupRef.current = boardsGroup;

    const slabGeom = createExtrudedSlabGeometry(BOARD_W + 0.22, BOARD_H + 0.22, 0.12, 0.2);
    sharedGeomsRef.current = {
      slab: slabGeom,
      face: new THREE.PlaneGeometry(BOARD_W, BOARD_H),
      shadow: new THREE.PlaneGeometry(BOARD_W + 1.3, BOARD_H + 1.1),
      glow: new THREE.PlaneGeometry(BOARD_W + 2.2, 2.2),
      highlightEdgesGeom: new THREE.EdgesGeometry(
        new THREE.BoxGeometry(BOARD_W + 0.3, BOARD_H + 0.3, 0.24)
      ),
      pinStem: new THREE.CylinderGeometry(0.032, 0.022, 0.24, 12),
      pinHead: new THREE.SphereGeometry(0.095, 16, 12),
    };

    // Raycasting & 3D Dragging state
    const raycaster = new THREE.Raycaster();
    const pointerNdc = new THREE.Vector2();
    let pointerDownPos = { x: 0, y: 0 };
    let lastClickTime = 0;
    let lastClickId: string | null = null;
    let lastHoverCheck = 0;

    const updateNdc = (clientX: number, clientY: number) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointerNdc.x = ((clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1;
      pointerNdc.y = -((clientY - rect.top) / Math.max(1, rect.height)) * 2 + 1;
    };

    const getIntersectedBoardId = (clientX: number, clientY: number): string | null => {
      updateNdc(clientX, clientY);
      raycaster.setFromCamera(pointerNdc, camera);
      const targets: THREE.Object3D[] = [];
      boardsMapRef.current.forEach((rt) => {
        if (rt.group.visible) {
          targets.push(rt.faceMesh, rt.frameMesh);
        }
      });
      const hits = raycaster.intersectObjects(targets, false);
      if (hits.length === 0) return null;
      return String(hits[0].object.userData.canvasId || '') || null;
    };

    const onPointerMove = (e: PointerEvent) => {
      const drag = dragBoardRef.current;
      if (drag) {
        const distPx = Math.hypot(e.clientX - drag.startClientX, e.clientY - drag.startClientY);
        if (!drag.hasMoved && distPx > 5) {
          drag.hasMoved = true;
          setIsDraggingBoard(true);
          setFocusedId(drag.boardId);
          setCloseInspectId(null);
          renderer.domElement.style.cursor = 'grabbing';
        }
        if (drag.hasMoved) {
          const rt = boardsMapRef.current.get(drag.boardId);
          if (rt) {
            updateNdc(e.clientX, e.clientY);
            raycaster.setFromCamera(pointerNdc, camera);
            if (raycaster.ray.intersectPlane(drag.plane, _dragHit)) {
              const nx = _dragHit.x + drag.offset.x;
              const ny = Math.max(-10.2, _dragHit.y + drag.offset.y);
              const nz = _dragHit.z + drag.offset.z;
              const nextRotY = Math.atan2(camera.position.x - nx, camera.position.z - nz);

              rt.targetPos.set(nx, ny, nz);
              rt.group.position.set(nx, ny, nz);
              rt.targetRotY = nextRotY;
              rt.group.rotation.y = nextRotY;
              rt.pinned = true;
              rt.pinGroup.visible = true;

              drag.lastPos.set(nx, ny, nz);
              drag.lastRotY = nextRotY;
            }
          }
        }
        return;
      }

      const now = performance.now();
      if (now - lastHoverCheck < 35) return;
      lastHoverCheck = now;

      const hitId =
        interactionToolRef.current === 'orbit' ? null : getIntersectedBoardId(e.clientX, e.clientY);
      if (hitId !== hoveredIdRef.current) {
        setHoveredId(hitId);
        renderer.domElement.style.cursor = hitId ? 'grab' : 'default';
      }
    };

    const onPointerDown = (e: PointerEvent) => {
      pointerDownPos = { x: e.clientX, y: e.clientY };
      if (e.button !== 0 || interactionToolRef.current === 'orbit') return;

      const hitId = getIntersectedBoardId(e.clientX, e.clientY);
      if (hitId) {
        const rt = boardsMapRef.current.get(hitId);
        if (rt) {
          flyTargetRef.current.active = false;
          flyTargetRef.current.onArrive = undefined;
          controls.enabled = false;

          camera.getWorldDirection(_dragNormal).negate().normalize();
          const dragPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(
            _dragNormal.clone(),
            rt.group.position
          );
          updateNdc(e.clientX, e.clientY);
          raycaster.setFromCamera(pointerNdc, camera);
          const offset = new THREE.Vector3();
          if (raycaster.ray.intersectPlane(dragPlane, _dragHit)) {
            offset.copy(rt.group.position).sub(_dragHit);
          }

          dragBoardRef.current = {
            boardId: hitId,
            startClientX: e.clientX,
            startClientY: e.clientY,
            hasMoved: false,
            plane: dragPlane,
            offset,
            lastPos: rt.group.position.clone(),
            lastRotY: rt.targetRotY,
          };
          renderer.domElement.style.cursor = 'grabbing';
        }
      }
    };

    const onWheelWhileDragging = (e: WheelEvent) => {
      const drag = dragBoardRef.current;
      if (!drag) return;
      e.preventDefault();
      e.stopPropagation();

      if (!drag.hasMoved) {
        drag.hasMoved = true;
        setIsDraggingBoard(true);
        setFocusedId(drag.boardId);
        setCloseInspectId(null);
      }

      const rt = boardsMapRef.current.get(drag.boardId);
      if (!rt) return;

      camera.getWorldDirection(_dragNormal).normalize();
      const depthDelta = THREE.MathUtils.clamp(-e.deltaY * 0.012, -3.5, 3.5);
      drag.plane.translate(_dragNormal.clone().multiplyScalar(depthDelta));
      rt.targetPos.addScaledVector(_dragNormal, depthDelta);
      rt.targetPos.y = Math.max(-10.2, rt.targetPos.y);
      rt.group.position.copy(rt.targetPos);
      rt.pinned = true;
      rt.pinGroup.visible = true;
      drag.lastPos.copy(rt.targetPos);
    };

    const onPointerUp = (e: PointerEvent) => {
      const drag = dragBoardRef.current;
      if (drag) {
        dragBoardRef.current = null;
        controls.enabled = true;
        setIsDraggingBoard(false);

        if (drag.hasMoved) {
          renderer.domElement.style.cursor = 'grab';
          onUpdateCanvasPositionRef.current(drag.boardId, {
            x: Number(drag.lastPos.x.toFixed(2)),
            y: Number(drag.lastPos.y.toFixed(2)),
            z: Number(drag.lastPos.z.toFixed(2)),
            rotY: Number(drag.lastRotY.toFixed(4)),
            pinned: true,
          });
          return;
        }
      }

      controls.enabled = true;
      const moved = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
      if (moved > 6 || e.button !== 0) return;

      const hitId = getIntersectedBoardId(e.clientX, e.clientY);
      renderer.domElement.style.cursor =
        hitId && interactionToolRef.current !== 'orbit' ? 'grab' : 'default';

      if (!hitId) {
        setFocusedId(null);
        setCloseInspectId(null);
        return;
      }

      const now = performance.now();
      if (lastClickId === hitId && now - lastClickTime < 350) {
        lastClickTime = 0;
        lastClickId = null;
        launchCanvasWithZoomRef.current(hitId);
        return;
      }

      lastClickTime = now;
      lastClickId = hitId;
      setFocusedId(hitId);
      setCloseInspectId(hitId);
      flyToBoardRef.current(hitId, INSPECT_DISTANCE);
    };

    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('wheel', onWheelWhileDragging, {
      passive: false,
      capture: true,
    });
    window.addEventListener('pointerup', onPointerUp);

    const onContextLost = (ev: Event) => {
      ev.preventDefault();
      setWebglError(true);
    };
    const onContextRestored = () => {
      setWebglError(false);
    };
    renderer.domElement.addEventListener('webglcontextlost', onContextLost);
    renderer.domElement.addEventListener('webglcontextrestored', onContextRestored);

    const onResize = () => {
      if (!container) return;
      const w = Math.max(1, container.clientWidth);
      const h = Math.max(1, container.clientHeight);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    let prevTime = performance.now();
    let rafId = 0;

    const animate = (now: number) => {
      rafId = requestAnimationFrame(animate);
      const delta = Math.min(0.05, Math.max(0.001, (now - prevTime) / 1000));
      prevTime = now;

      if (!reducedMotion) {
        particles.rotation.y += delta * 0.01;
        const tSec = now * 0.001;
        ribbonMatA.uniforms.uTime.value = tSec;
        ribbonMatB.uniforms.uTime.value = tSec;
        ribbonMatC.uniforms.uTime.value = tSec;
      }

      controls.autoRotate = Boolean(
        autoRotateRef.current && !dragBoardRef.current && !flyTargetRef.current.active
      );

      // WASD / Arrow keyboard space walking
      const keys = keysPressedRef.current;
      _walkInput.set(0, 0, 0);
      if (keys.has('KeyW') || keys.has('ArrowUp')) _walkInput.z += 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) _walkInput.z -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) _walkInput.x += 1;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) _walkInput.x -= 1;
      if (keys.has('KeyE')) _walkInput.y += 1;
      if (keys.has('KeyQ')) _walkInput.y -= 1;

      const sprint = keys.has('ShiftLeft') || keys.has('ShiftRight') ? 1.85 : 1.0;
      const walkSpeed = 14.5 * sprint;

      if (_walkInput.lengthSq() > 0) {
        _walkInput.normalize();
        camera.getWorldDirection(_walkForward);
        _walkForward.normalize();
        _walkRight.crossVectors(_walkForward, _walkUp).normalize();

        _walkStep
          .set(0, 0, 0)
          .addScaledVector(_walkForward, _walkInput.z * walkSpeed)
          .addScaledVector(_walkRight, _walkInput.x * walkSpeed)
          .addScaledVector(_walkUp, _walkInput.y * walkSpeed * 0.8);
      } else {
        _walkStep.set(0, 0, 0);
      }

      const vel = walkVelocityRef.current;
      vel.x = THREE.MathUtils.damp(vel.x, _walkStep.x, 10, delta);
      vel.y = THREE.MathUtils.damp(vel.y, _walkStep.y, 10, delta);
      vel.z = THREE.MathUtils.damp(vel.z, _walkStep.z, 10, delta);

      if (vel.lengthSq() > 0.0004) {
        const dx = vel.x * delta;
        const dy = vel.y * delta;
        const dz = vel.z * delta;
        const nextCamY = Math.max(-10.8, camera.position.y + dy);
        const clampedDy = nextCamY - camera.position.y;
        camera.position.x += dx;
        camera.position.y = nextCamY;
        camera.position.z += dz;
        controls.target.x += dx;
        controls.target.y += clampedDy;
        controls.target.z += dz;
      }

      // Smooth camera fly-to
      if (flyTargetRef.current.active) {
        const lambda = 7.5;
        camera.position.x = THREE.MathUtils.damp(
          camera.position.x,
          flyTargetRef.current.camPos.x,
          lambda,
          delta
        );
        camera.position.y = THREE.MathUtils.damp(
          camera.position.y,
          flyTargetRef.current.camPos.y,
          lambda,
          delta
        );
        camera.position.z = THREE.MathUtils.damp(
          camera.position.z,
          flyTargetRef.current.camPos.z,
          lambda,
          delta
        );

        controls.target.x = THREE.MathUtils.damp(
          controls.target.x,
          flyTargetRef.current.targetPos.x,
          lambda,
          delta
        );
        controls.target.y = THREE.MathUtils.damp(
          controls.target.y,
          flyTargetRef.current.targetPos.y,
          lambda,
          delta
        );
        controls.target.z = THREE.MathUtils.damp(
          controls.target.z,
          flyTargetRef.current.targetPos.z,
          lambda,
          delta
        );

        const dist = camera.position.distanceTo(flyTargetRef.current.camPos);
        const elapsed = now - flyTargetRef.current.startedAt;
        const arriveByTime = Boolean(flyTargetRef.current.onArrive) && elapsed > 360;
        if (dist < 0.22 || arriveByTime) {
          flyTargetRef.current.active = false;
          const cb = flyTargetRef.current.onArrive;
          flyTargetRef.current.onArrive = undefined;
          if (cb) cb();
        }
      }

      controls.update();

      // Update boards, hover/focus highlights, and Semantic Close-Zoom LOD
      let nearestCloseId: string | null = null;
      let nearestCloseDist = Infinity;
      camera.getWorldDirection(_camDirVec);

      boardsMapRef.current.forEach((rt, idxKey) => {
        if (!rt.group.visible) return;

        const isDraggingThis = dragBoardRef.current?.boardId === rt.id && dragBoardRef.current.hasMoved;
        const isHover = hoveredIdRef.current === rt.id;
        const isFocus = focusedIdRef.current === rt.id;
        const camDist = camera.position.distanceTo(rt.group.position);
        const wantInspect = camDist < CLOSE_ZOOM_THRESHOLD || isFocus;

        if (!isDraggingThis) {
          const bobAmp = wantInspect || rt.pinned || reducedMotion ? 0.0 : 0.04;
          const bob = bobAmp > 0 ? Math.sin(now * 0.0012 + idxKey.length * 0.9) * bobAmp : 0;

          rt.group.position.x = THREE.MathUtils.damp(rt.group.position.x, rt.targetPos.x, 7.5, delta);
          rt.group.position.y = THREE.MathUtils.damp(
            rt.group.position.y,
            rt.targetPos.y + bob,
            7.5,
            delta
          );
          rt.group.position.z = THREE.MathUtils.damp(rt.group.position.z, rt.targetPos.z, 7.5, delta);
          rt.group.rotation.y = THREE.MathUtils.damp(rt.group.rotation.y, rt.targetRotY, 7.5, delta);
        }

        const desiredScale = isDraggingThis ? 1.05 : isFocus ? 1.04 : isHover ? 1.02 : 1.0;
        const nextScale = THREE.MathUtils.damp(rt.group.scale.x, desiredScale, 10, delta);
        rt.group.scale.setScalar(nextScale);

        const edgeMat = rt.highlightEdges.material as THREE.LineBasicMaterial;
        edgeMat.opacity = THREE.MathUtils.damp(
          edgeMat.opacity,
          isFocus || isDraggingThis ? 0.92 : isHover ? 0.55 : 0.0,
          12,
          delta
        );

        const glowMat = rt.glowMesh.material as THREE.MeshBasicMaterial;
        glowMat.opacity = THREE.MathUtils.damp(
          glowMat.opacity,
          isFocus || isDraggingThis ? 0.52 : isHover ? 0.34 : 0.16,
          10,
          delta
        );

        const targetMode: BoardTextureMode = wantInspect ? 'inspect' : 'overview';
        if (rt.currentMode !== targetMode) {
          rt.currentMode = targetMode;
          const faceMat = rt.faceMesh.material as THREE.MeshBasicMaterial;
          faceMat.map = wantInspect ? rt.inspectTexture : rt.overviewTexture;
          faceMat.needsUpdate = true;
        }

        if (camDist < CLOSE_ZOOM_THRESHOLD) {
          _toBoardVec.copy(rt.group.position).sub(camera.position).normalize();
          const inFront = _toBoardVec.dot(_camDirVec) > 0.35;
          if (inFront && camDist < nearestCloseDist) {
            nearestCloseDist = camDist;
            nearestCloseId = rt.id;
          }
        }
      });

      const resolvedCloseId = focusedIdRef.current || nearestCloseId;
      if (resolvedCloseId !== closeInspectIdRef.current) {
        setCloseInspectId(resolvedCloseId);
      }

      // Project anchored floating HUD coordinates above the selected/close card (never obscuring the canvas)
      const anchorBoardId = !dragBoardRef.current?.hasMoved
        ? focusedIdRef.current || resolvedCloseId
        : null;
      const anchorRt = anchorBoardId ? boardsMapRef.current.get(anchorBoardId) : undefined;
      if (anchorRt && anchorRt.group.visible) {
        _tmpVec.copy(anchorRt.group.position);
        _tmpVec.y += BOARD_H * 0.55;
        _projVec.copy(_tmpVec).project(camera);
        if (_projVec.z < 1) {
          const w = container.clientWidth;
          const h = container.clientHeight;
          const sx = (_projVec.x * 0.5 + 0.5) * w;
          const sy = (-_projVec.y * 0.5 + 0.5) * h;
          const halfPad = Math.min(260, Math.floor(w * 0.42));
          const clampedX = Math.round(Math.max(halfPad, Math.min(w - halfPad, sx)));
          const clampedY = Math.round(Math.max(122, Math.min(h - 76, sy)));
          setHudAnchor((prev) =>
            Math.abs(prev.x - clampedX) > 2.5 ||
            Math.abs(prev.y - clampedY) > 2.5 ||
            !prev.visible
              ? { x: clampedX, y: clampedY, visible: true }
              : prev
          );
        } else {
          setHudAnchor((prev) => (prev.visible ? { ...prev, visible: false } : prev));
        }
      } else {
        setHudAnchor((prev) => (prev.visible ? { ...prev, visible: false } : prev));
      }

      renderer.render(scene, camera);
    };

    rafId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('pointerup', onPointerUp);
      controls.removeEventListener('start', onControlsStart);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('wheel', onWheelWhileDragging, { capture: true });
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', onContextRestored);

      boardsMapRef.current.forEach((rt) => {
        rt.overviewTexture.dispose();
        rt.inspectTexture.dispose();
        (rt.frameMesh.material as THREE.Material).dispose();
        (rt.faceMesh.material as THREE.Material).dispose();
        (rt.shadowMesh.material as THREE.Material).dispose();
        (rt.glowMesh.material as THREE.Material).dispose();
        (rt.highlightEdges.material as THREE.Material).dispose();
        rt.pinGroup.children.forEach((child) => {
          const m = child as THREE.Mesh;
          if (m.material) (m.material as THREE.Material).dispose();
        });
      });
      boardsMapRef.current.clear();

      if (sharedGeomsRef.current) {
        sharedGeomsRef.current.slab.dispose();
        sharedGeomsRef.current.face.dispose();
        sharedGeomsRef.current.shadow.dispose();
        sharedGeomsRef.current.glow.dispose();
        sharedGeomsRef.current.highlightEdgesGeom.dispose();
        sharedGeomsRef.current.pinStem.dispose();
        sharedGeomsRef.current.pinHead.dispose();
      }

      skyGeom.dispose();
      skyMat.dispose();
      ribbonGeomA.dispose();
      ribbonMatA.dispose();
      ribbonGeomB.dispose();
      ribbonMatB.dispose();
      ribbonGeomC.dispose();
      ribbonMatC.dispose();
      floorAlphaTex.dispose();
      floorGeom.dispose();
      floorMat.dispose();
      ringGeom.dispose();
      ringMat.dispose();
      ringGeomOuter.dispose();
      ringMatOuter.dispose();
      particleGeom.dispose();
      particleMat.dispose();
      gridHelper.geometry.dispose();
      gridMats.forEach((m) => m.dispose());
      shadowTex.dispose();
      glowTex.dispose();
      envTarget.dispose();
      controls.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Dynamically apply Space Theme (Light / Dark) to the 3D studio scene without resetting camera or boards
  useEffect(() => {
    const scene = sceneRef.current;
    const env = envRefs.current;
    if (!scene || !env) return;

    const palette = SPACE_PALETTES[spaceTheme];
    scene.background = new THREE.Color(palette.bg);
    scene.fog = new THREE.FogExp2(palette.fog, 0.0072);

    env.skyMat.uniforms.uZenith.value.set(palette.skyZenith);
    env.skyMat.uniforms.uMid.value.set(palette.skyMid);
    env.skyMat.uniforms.uHorizon.value.set(palette.skyHorizon);

    env.ribbonMats.forEach((rm) => {
      rm.uniforms.uColorA.value.set(palette.auroraA);
      rm.uniforms.uColorB.value.set(palette.auroraB);
      rm.uniforms.uOpacity.value = palette.auroraOpacity;
    });

    const fMat = env.floorMesh.material as THREE.MeshStandardMaterial;
    fMat.color.set(palette.floorColor);
    fMat.roughness = palette.floorRoughness;
    fMat.metalness = palette.floorMetalness;

    (env.ringMesh.material as THREE.MeshBasicMaterial).color.set(palette.ringColor);
    (env.ringMeshOuter.material as THREE.MeshBasicMaterial).color.set(palette.ringColor);

    const pMat = env.particles.material as THREE.PointsMaterial;
    pMat.color.set(palette.particleColor);
    pMat.opacity = palette.particleOpacity;

    env.hemiLight.color.set(palette.hemiSky);
    env.hemiLight.groundColor.set(palette.hemiGround);
    env.hemiLight.intensity = palette.hemiIntensity;
    env.keyLight.color.set(palette.keyColor);
    env.keyLight.intensity = palette.keyIntensity;
    env.fillLight.color.set(palette.fillColor);
    env.fillLight.intensity = palette.fillIntensity;

    scene.remove(env.gridHelper);
    env.gridHelper.geometry.dispose();
    if (Array.isArray(env.gridHelper.material)) {
      env.gridHelper.material.forEach((m) => m.dispose());
    } else {
      env.gridHelper.material.dispose();
    }
    const nextGrid = new THREE.GridHelper(
      110,
      36,
      new THREE.Color(palette.gridMajor),
      new THREE.Color(palette.gridMinor)
    );
    nextGrid.position.y = -12.76;
    const nextGridMats = Array.isArray(nextGrid.material)
      ? nextGrid.material
      : [nextGrid.material];
    nextGridMats.forEach((m) => {
      m.transparent = true;
      m.opacity = 0.2;
    });
    scene.add(nextGrid);
    env.gridHelper = nextGrid;

    boardsMapRef.current.forEach((rt) => {
      const mat = rt.frameMesh.material as THREE.MeshPhysicalMaterial;
      mat.color.set(palette.slabColor);
      mat.roughness = palette.slabRoughness;
      mat.metalness = palette.slabMetalness;
      (rt.highlightEdges.material as THREE.LineBasicMaterial).color.set(palette.edgeColor);
      (rt.glowMesh.material as THREE.MeshBasicMaterial).color.set(palette.glowColor);
    });
  }, [spaceTheme]);

  // Synchronize boards, exact canvas textures, and free-space positions
  useEffect(() => {
    const boardsGroup = boardsGroupRef.current;
    const renderer = rendererRef.current;
    const geoms = sharedGeomsRef.current;
    const env = envRefs.current;
    if (!boardsGroup || !renderer || !geoms || !env) return;

    const palette = SPACE_PALETTES[spaceTheme];
    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    const visibleIds = new Set(visibleCanvases.map((c) => c.id));
    const allIds = new Set(canvases.map((c) => c.id));

    boardsMapRef.current.forEach((rt, id) => {
      if (!allIds.has(id)) {
        boardsGroup.remove(rt.group);
        rt.overviewTexture.dispose();
        rt.inspectTexture.dispose();
        (rt.frameMesh.material as THREE.Material).dispose();
        (rt.faceMesh.material as THREE.Material).dispose();
        (rt.shadowMesh.material as THREE.Material).dispose();
        (rt.glowMesh.material as THREE.Material).dispose();
        (rt.highlightEdges.material as THREE.Material).dispose();
        rt.pinGroup.children.forEach((child) => {
          const m = child as THREE.Mesh;
          if (m.material) (m.material as THREE.Material).dispose();
        });
        boardsMapRef.current.delete(id);
      }
    });

    canvases.forEach((record) => {
      const cam = record.camera || { x: 0, y: 0, zoom: 1 };
      const signature = [
        record.title,
        record.canvasThemeId || 'emerald-minimal',
        record.updatedAt,
        record.elementCount,
        cam.x.toFixed(1),
        cam.y.toFixed(1),
        cam.zoom.toFixed(3),
        record.lastViewport?.viewportWidth || 0,
        record.lastViewport?.viewportHeight || 0,
      ].join('|');

      const pos = record.spatialPosition || { x: 0, y: 0, z: 0, rotY: 0, pinned: false };
      let rt = boardsMapRef.current.get(record.id);

      const rebuildTexturesForBoard = (targetId: string) => {
        const currentRt = boardsMapRef.current.get(targetId);
        const currentRec = canvasesRef.current.find((c) => c.id === targetId);
        if (!currentRt || !currentRec) return;
        const oldO = currentRt.overviewTexture;
        const oldI = currentRt.inspectTexture;
        currentRt.overviewTexture = createBoardCanvasTexture(currentRec, 'overview', maxAniso, false);
        currentRt.inspectTexture = createBoardCanvasTexture(currentRec, 'inspect', maxAniso, true);
        const fMat = currentRt.faceMesh.material as THREE.MeshBasicMaterial;
        fMat.map = currentRt.currentMode === 'inspect' ? currentRt.inspectTexture : currentRt.overviewTexture;
        fMat.needsUpdate = true;
        oldO.dispose();
        oldI.dispose();
      };

      if (!rt) {
        const group = new THREE.Group();

        const frameMat = new THREE.MeshPhysicalMaterial({
          color: palette.slabColor,
          roughness: palette.slabRoughness,
          metalness: palette.slabMetalness,
          clearcoat: 0.92,
          clearcoatRoughness: 0.1,
        });
        const frameMesh = new THREE.Mesh(geoms.slab, frameMat);
        frameMesh.userData.canvasId = record.id;

        const overviewTexture = createBoardCanvasTexture(record, 'overview', maxAniso, false, () =>
          rebuildTexturesForBoard(record.id)
        );
        const inspectTexture = createBoardCanvasTexture(record, 'inspect', maxAniso, true, () =>
          rebuildTexturesForBoard(record.id)
        );

        // MeshBasicMaterial with fog:false & toneMapped:false keeps canvas colors 100% accurate to where the user left off
        const faceMat = new THREE.MeshBasicMaterial({
          map: overviewTexture,
          fog: false,
          toneMapped: false,
        });
        const faceMesh = new THREE.Mesh(geoms.face, faceMat);
        faceMesh.position.z = 0.11;
        faceMesh.userData.canvasId = record.id;

        const shadowMat = new THREE.MeshBasicMaterial({
          map: env.shadowTex,
          transparent: true,
          opacity: 0.42,
          depthWrite: false,
        });
        const shadowMesh = new THREE.Mesh(geoms.shadow, shadowMat);
        shadowMesh.position.set(0.14, -0.24, -0.15);

        const glowMat = new THREE.MeshBasicMaterial({
          map: env.glowTex,
          color: palette.glowColor,
          transparent: true,
          opacity: 0.18,
          depthWrite: false,
        });
        const glowMesh = new THREE.Mesh(geoms.glow, glowMat);
        glowMesh.position.set(0, -BOARD_H * 0.56, 0.02);

        const edgeMat = new THREE.LineBasicMaterial({
          color: palette.edgeColor,
          transparent: true,
          opacity: 0,
        });
        const highlightEdges = new THREE.LineSegments(geoms.highlightEdgesGeom, edgeMat);

        // Subtle 3D pin indicator on top edge for pinned boards
        const pinGroup = new THREE.Group();
        const stemMat = new THREE.MeshStandardMaterial({
          color: '#94A3B8',
          metalness: 0.8,
          roughness: 0.25,
        });
        const headMat = new THREE.MeshStandardMaterial({
          color: '#10B981',
          metalness: 0.2,
          roughness: 0.25,
        });
        const stemMesh = new THREE.Mesh(geoms.pinStem, stemMat);
        stemMesh.position.set(0, 0.08, 0);
        const headMesh = new THREE.Mesh(geoms.pinHead, headMat);
        headMesh.position.set(0, 0.22, 0);
        pinGroup.add(stemMesh, headMesh);
        pinGroup.position.set(0, BOARD_H * 0.5 + 0.08, 0.04);
        pinGroup.visible = Boolean(pos.pinned);

        group.add(shadowMesh, glowMesh, frameMesh, faceMesh, highlightEdges, pinGroup);
        group.position.set(pos.x, pos.y, pos.z);
        group.rotation.y = pos.rotY;

        boardsGroup.add(group);
        rt = {
          id: record.id,
          group,
          frameMesh,
          faceMesh,
          pinGroup,
          shadowMesh,
          glowMesh,
          highlightEdges,
          overviewTexture,
          inspectTexture,
          currentMode: 'overview',
          targetPos: new THREE.Vector3(pos.x, pos.y, pos.z),
          targetRotY: pos.rotY,
          pinned: Boolean(pos.pinned),
          signature,
        };
        boardsMapRef.current.set(record.id, rt);
      } else {
        if (rt.signature !== signature) {
          const oldOverview = rt.overviewTexture;
          const oldInspect = rt.inspectTexture;
          rt.overviewTexture = createBoardCanvasTexture(record, 'overview', maxAniso, false, () =>
            rebuildTexturesForBoard(record.id)
          );
          rt.inspectTexture = createBoardCanvasTexture(record, 'inspect', maxAniso, true, () =>
            rebuildTexturesForBoard(record.id)
          );
          const faceMat = rt.faceMesh.material as THREE.MeshBasicMaterial;
          faceMat.map = rt.currentMode === 'inspect' ? rt.inspectTexture : rt.overviewTexture;
          faceMat.needsUpdate = true;
          oldOverview.dispose();
          oldInspect.dispose();
          rt.signature = signature;
        }

        if (!(dragBoardRef.current?.boardId === record.id && dragBoardRef.current.hasMoved)) {
          rt.targetPos.set(pos.x, pos.y, pos.z);
          rt.targetRotY = pos.rotY;
          rt.pinned = Boolean(pos.pinned);
          rt.pinGroup.visible = Boolean(pos.pinned);
        }
      }

      rt.group.visible = visibleIds.has(record.id);
    });
  }, [canvases, spaceTheme, visibleCanvases]);

  const isDark = spaceTheme === 'dark';

  // Frosted luminous surfaces without CSS backdrop-filter so WebGL software/GPU rendering stays responsive
  const hudPillClass = isDark
    ? 'bg-[#081511]/92 border-[#34D399]/24 text-[#ECFDF5] shadow-[0_8px_28px_rgba(0,0,0,0.48)]'
    : 'bg-white/94 border-[#10B981]/22 text-[#064E3B] shadow-[0_10px_28px_rgba(6,78,59,0.10)]';

  const handleTriggerAutoArrange = useCallback(() => {
    if (onAutoArrange) {
      onAutoArrange();
      return;
    }
    // Fallback if parent didn't wire onAutoArrange
    const first = visibleCanvases[0];
    if (first && !first.spatialPosition?.pinned) {
      onUpdateCanvasPosition(first.id, { x: 0, y: 0.4, z: 3, rotY: 0, pinned: false });
    }
  }, [onAutoArrange, onUpdateCanvasPosition, visibleCanvases]);

  return (
    <div
      data-testid="canvas-hub-3d"
      data-space-theme={spaceTheme}
      data-space-pref={spaceThemePref}
      className={`fixed inset-0 z-50 overflow-hidden select-none ${
        isDark ? 'bg-[#040B09] text-[#ECFDF5]' : 'bg-[#E1F4EC] text-[#064E3B]'
      }`}
    >
      {/* 3D Spatial Viewport (Always active in 3D View with zero view-mode switching) */}
      <div ref={mountRef} className="w-full h-full" />

      {/* Fallback UI if WebGL context is unavailable */}
      {webglError && (
        <div
          className={`fixed inset-0 z-30 flex items-center justify-center p-6 ${
            isDark ? 'bg-[#040B09]/95' : 'bg-[#E1F4EC]/95'
          }`}
        >
          <div className={`max-w-3xl w-full rounded-2xl p-6 border ${hudPillClass}`}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">SPARK Canvas Library</h2>
              <button
                type="button"
                onClick={handleCreateNew}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#059669] text-white text-xs font-semibold cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>New Blank Canvas</span>
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto">
              {visibleCanvases.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => onOpenCanvas(c.id)}
                  className={`text-left p-3.5 rounded-xl border cursor-pointer ${
                    isDark
                      ? 'border-white/10 bg-white/5 hover:border-[#34D399]/50'
                      : 'border-[#064E3B]/15 bg-white hover:border-[#10B981]'
                  }`}
                >
                  <div className="text-sm font-bold">{c.title}</div>
                  <div className="text-xs opacity-70 mt-1 truncate">
                    {c.elementCount} items · {formatRelativeTime(c.updatedAt)}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Top Navigation Bar (Clean 3-Zone Contract matching Light/Dark Studio Design, 3D View Only) */}
      <header className="pointer-events-none fixed top-3.5 left-4 right-4 z-20 flex flex-wrap items-center justify-between gap-3">
        {/* Zone 1: Brand Pill */}
        <div className={`pointer-events-auto flex items-center rounded-full px-2.5 py-1.5 border ${hudPillClass}`}>
          <button
            type="button"
            onClick={onBackToSplash}
            title="Back to SPARK Welcome"
            className={`flex items-center gap-2.5 px-1.5 py-0.5 rounded-full cursor-pointer ${
              isDark ? 'text-[#ECFDF5] hover:bg-white/10' : 'text-[#064E3B] hover:bg-[#ECFDF5]'
            }`}
          >
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#10B981] to-[#064E3B] text-white flex items-center justify-center font-black text-xs shadow-sm shrink-0">
              S
            </div>
            <div className="text-left pr-1">
              <div className="text-xs font-extrabold tracking-wide leading-none whitespace-nowrap">
                SPARK HUB
              </div>
              <div
                className={`text-[10px] font-medium leading-tight tabular-nums whitespace-nowrap ${
                  isDark ? 'text-[#6EE7B7]' : 'text-[#059669]'
                }`}
              >
                {canvases.length} Canvases
              </div>
            </div>
          </button>
        </div>

        {/* Zone 2: Center Search Capsule with Ctrl+K Hint */}
        <div className={`pointer-events-auto flex items-center rounded-full px-3 py-1.5 border ${hudPillClass}`}>
          <div className="relative flex items-center">
            <Search
              className={`w-3.5 h-3.5 mr-2 shrink-0 ${
                isDark ? 'text-[#34D399]' : 'text-[#059669]'
              }`}
            />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && visibleCanvases.length > 0) {
                  e.preventDefault();
                  const first = visibleCanvases[0];
                  setFocusedId(first.id);
                  setCloseInspectId(first.id);
                  flyToBoard(first.id, INSPECT_DISTANCE);
                  searchInputRef.current?.blur();
                } else if (e.key === 'Escape') {
                  setSearchQuery('');
                  searchInputRef.current?.blur();
                }
              }}
              placeholder="Search canvases, notes, formulas..."
              aria-label="Search spatial canvases"
              className={`w-48 sm:w-64 lg:w-80 bg-transparent py-1 text-xs outline-none ${
                isDark
                  ? 'text-[#ECFDF5] placeholder-[#94A3B8]'
                  : 'text-[#064E3B] placeholder-[#059669]/65'
              }`}
            />
            {searchQuery ? (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setSearchQuery('')}
                className={`ml-1.5 p-0.5 rounded-full cursor-pointer ${
                  isDark ? 'text-[#94A3B8] hover:text-white' : 'text-[#059669] hover:text-[#064E3B]'
                }`}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            ) : (
              <span
                className={`hidden sm:inline-flex items-center px-2 py-0.5 ml-2 rounded-full text-[10px] font-semibold font-mono-tabular whitespace-nowrap shrink-0 border ${
                  isDark
                    ? 'bg-white/5 border-white/10 text-[#94A3B8]'
                    : 'bg-[#F0FAF5] border-[#A7F3D0] text-[#059669]'
                }`}
              >
                Ctrl + K
              </span>
            )}
          </div>
        </div>

        {/* Zone 3: Space Theme Switcher (Light | Dark | System) + New Blank Canvas */}
        <div className="pointer-events-auto flex items-center gap-2 shrink-0">
          <div
            role="group"
            aria-label="Space theme switcher"
            className={`flex items-center p-1 rounded-full border ${hudPillClass}`}
          >
            <button
              type="button"
              data-testid="space-theme-light"
              aria-pressed={spaceThemePref === 'light'}
              onClick={() => setSpaceThemePref('light')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer ${
                spaceThemePref === 'light'
                  ? 'bg-[#064E3B] text-white shadow-sm'
                  : isDark
                    ? 'text-[#94A3B8] hover:text-white'
                    : 'text-[#064E3B] hover:bg-[#ECFDF5]'
              }`}
            >
              <Sun className="w-3.5 h-3.5" />
              <span>Light</span>
            </button>
            <button
              type="button"
              data-testid="space-theme-dark"
              aria-pressed={spaceThemePref === 'dark'}
              onClick={() => setSpaceThemePref('dark')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer ${
                spaceThemePref === 'dark'
                  ? 'bg-[#10B981] text-[#032016] shadow-sm'
                  : isDark
                    ? 'text-[#94A3B8] hover:text-white'
                    : 'text-[#064E3B] hover:bg-[#ECFDF5]'
              }`}
            >
              <Moon className="w-3.5 h-3.5" />
              <span>Dark</span>
            </button>
            <button
              type="button"
              data-testid="space-theme-system"
              aria-pressed={spaceThemePref === 'system'}
              title={`Follow System (${systemIsDark ? 'Dark' : 'Light'})`}
              onClick={() => setSpaceThemePref('system')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer ${
                spaceThemePref === 'system'
                  ? isDark
                    ? 'bg-[#10B981] text-[#032016] shadow-sm'
                    : 'bg-[#064E3B] text-white shadow-sm'
                  : isDark
                    ? 'text-[#94A3B8] hover:text-white'
                    : 'text-[#064E3B] hover:bg-[#ECFDF5]'
              }`}
            >
              <Monitor className="w-3.5 h-3.5" />
              <span>System</span>
            </button>
          </div>

          <button
            type="button"
            data-testid="hub-new-canvas-btn"
            onClick={handleCreateNew}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-gradient-to-r from-[#059669] to-[#10B981] hover:from-[#047857] hover:to-[#059669] text-white text-xs font-bold shadow-md whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New Blank Canvas</span>
          </button>
        </div>
      </header>

      {/* Top-Right Compact Collapsible Workspace Controls Panel */}
      <aside
        aria-label="Workspace Controls"
        className={`hidden md:block fixed top-18 right-4 z-20 w-48 rounded-2xl border overflow-hidden ${hudPillClass}`}
      >
        <button
          type="button"
          onClick={() => setControlsCollapsed((c) => !c)}
          className={`w-full flex items-center justify-between px-3.5 py-2.5 text-xs font-bold cursor-pointer ${
            isDark ? 'hover:bg-white/5' : 'hover:bg-[#F0FAF5]'
          }`}
        >
          <span>Workspace Controls</span>
          {controlsCollapsed ? (
            <ChevronDown className="w-3.5 h-3.5 opacity-70" />
          ) : (
            <ChevronUp className="w-3.5 h-3.5 opacity-70" />
          )}
        </button>

        {!controlsCollapsed && (
          <div
            className={`px-3 pb-3 pt-1 space-y-2 border-t text-xs ${
              isDark ? 'border-white/10' : 'border-[#10B981]/15'
            }`}
          >
            <div className="flex items-center justify-between pt-1">
              <span className="font-medium opacity-80">Zoom</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  aria-label="Zoom out 3D space"
                  onClick={() => zoomCameraBy(-4.5)}
                  className={`w-6 h-6 rounded-full flex items-center justify-center border cursor-pointer ${
                    isDark
                      ? 'border-white/15 hover:bg-white/10'
                      : 'border-[#10B981]/25 hover:bg-[#ECFDF5]'
                  }`}
                >
                  <Minus className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  aria-label="Zoom in 3D space"
                  onClick={() => zoomCameraBy(4.5)}
                  className={`w-6 h-6 rounded-full flex items-center justify-center border cursor-pointer ${
                    isDark
                      ? 'border-white/15 hover:bg-white/10'
                      : 'border-[#10B981]/25 hover:bg-[#ECFDF5]'
                  }`}
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
            </div>

            <button
              type="button"
              data-testid="hub-auto-arrange-btn"
              onClick={handleTriggerAutoArrange}
              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-xl font-medium text-left cursor-pointer ${
                isDark ? 'hover:bg-white/8' : 'hover:bg-[#ECFDF5]'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-[#10B981]" />
              <span>Auto Arrange</span>
            </button>

            <button
              type="button"
              data-testid="hub-focus-mode-btn"
              onClick={() => {
                if (focusedId || closeInspectId) {
                  flyToOverview();
                } else if (visibleCanvases.length > 0) {
                  const target =
                    visibleCanvases.find((c) => c.id === activeCanvasId) || visibleCanvases[0];
                  setFocusedId(target.id);
                  setCloseInspectId(target.id);
                  flyToBoard(target.id, INSPECT_DISTANCE);
                }
              }}
              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-xl font-medium text-left cursor-pointer ${
                isDark ? 'hover:bg-white/8' : 'hover:bg-[#ECFDF5]'
              }`}
            >
              <Crosshair className="w-3.5 h-3.5 text-[#10B981]" />
              <span>{focusedId || closeInspectId ? 'Space Overview' : 'Focus Mode'}</span>
            </button>
          </div>
        )}
      </aside>

      {/* Bottom Studio Overlay: Left Editorial Mark, Center Action Dock, Right Alt+Tab Switch */}
      <div className="pointer-events-none fixed bottom-4 left-4 right-4 z-20 flex items-center justify-between gap-3">
        {/* Bottom-Left Subtle Brand Wordmark */}
        <div className="hidden lg:flex flex-col select-none">
          <div
            className={`text-sm font-extrabold tracking-widest leading-none ${
              isDark ? 'text-[#ECFDF5]' : 'text-[#064E3B]'
            }`}
          >
            SPARK HUB
          </div>
          <div
            className={`text-[11px] font-medium mt-1 tracking-wide ${
              isDark ? 'text-[#6EE7B7]/75' : 'text-[#059669]/80'
            }`}
          >
            Dream · Plan · Create
          </div>
        </div>

        {/* Bottom-Center Interactive Dock */}
        <div
          className={`pointer-events-auto mx-auto lg:mx-0 flex items-center gap-1 p-1 rounded-full border ${hudPillClass}`}
        >
          <button
            type="button"
            data-testid="dock-drag-btn"
            aria-pressed={interactionTool === 'drag'}
            onClick={() => setInteractionTool('drag')}
            title="Click & drag any canvas card anywhere in space"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer ${
              interactionTool === 'drag'
                ? isDark
                  ? 'bg-[#10B981]/22 text-[#34D399]'
                  : 'bg-[#D1FAE5] text-[#064E3B]'
                : isDark
                  ? 'text-[#94A3B8] hover:text-white'
                  : 'text-[#064E3B]/80 hover:bg-[#ECFDF5]'
            }`}
          >
            <Move className="w-3.5 h-3.5" />
            <span>Drag</span>
          </button>

          <button
            type="button"
            data-testid="dock-rotate-btn"
            aria-pressed={autoRotateEnabled || interactionTool === 'orbit'}
            onClick={() => {
              setInteractionTool((prev) => (prev === 'orbit' ? 'drag' : 'orbit'));
              setAutoRotateEnabled((r) => !r);
            }}
            title="Toggle camera orbit mode"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer ${
              autoRotateEnabled || interactionTool === 'orbit'
                ? isDark
                  ? 'bg-[#10B981]/22 text-[#34D399]'
                  : 'bg-[#D1FAE5] text-[#064E3B]'
                : isDark
                  ? 'text-[#94A3B8] hover:text-white'
                  : 'text-[#064E3B]/80 hover:bg-[#ECFDF5]'
            }`}
          >
            <RotateCw className="w-3.5 h-3.5" />
            <span>Rotate</span>
          </button>

          <button
            type="button"
            data-testid="dock-focus-btn"
            onClick={() => cycleCanvasViaSwitcher(false, false)}
            title="Focus next canvas (or press Alt + Tab)"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer ${
              isDark
                ? 'text-[#94A3B8] hover:text-white hover:bg-white/8'
                : 'text-[#064E3B]/80 hover:bg-[#ECFDF5]'
            }`}
          >
            <Crosshair className="w-3.5 h-3.5" />
            <span>Focus</span>
          </button>

          <button
            type="button"
            data-testid="dock-fullscreen-btn"
            aria-pressed={isFullscreen}
            onClick={toggleFullscreen}
            title="Toggle fullscreen studio"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer ${
              isDark
                ? 'text-[#94A3B8] hover:text-white hover:bg-white/8'
                : 'text-[#064E3B]/80 hover:bg-[#ECFDF5]'
            }`}
          >
            {isFullscreen ? (
              <Minimize2 className="w-3.5 h-3.5" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5" />
            )}
            <span>Fullscreen</span>
          </button>
        </div>

        {/* Bottom-Right Interactive Alt+Tab Canvas Switch Pill */}
        <button
          type="button"
          data-testid="alt-tab-switch-trigger"
          onClick={() => cycleCanvasViaSwitcher(false, true)}
          className={`pointer-events-auto hidden md:flex items-center gap-2 px-3.5 py-2 rounded-full border text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer ${hudPillClass}`}
          title="Press Alt + Tab to cycle canvases"
        >
          <span
            className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono-tabular font-bold ${
              isDark ? 'bg-[#10B981]/20 text-[#34D399]' : 'bg-[#D1FAE5] text-[#064E3B]'
            }`}
          >
            Alt + Tab
          </span>
          <span>Switch Canvas</span>
        </button>
      </div>

      {/* Alt + Tab Quick Canvas Switcher Overlay */}
      {switcherOpen && visibleCanvases.length > 0 && (
        <div
          data-testid="alt-tab-switcher"
          role="dialog"
          aria-label="Canvas switcher"
          className={`fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-40 max-w-[92vw] rounded-3xl p-3 border shadow-2xl ${hudPillClass}`}
        >
          <div className="flex items-center justify-between px-2 pb-2 text-[11px] font-semibold opacity-75">
            <span>Switch Canvas</span>
            <span className="font-mono-tabular">Alt + Tab · Enter to open · Esc to close</span>
          </div>
          <div className="flex items-stretch gap-2.5 overflow-x-auto max-w-[82vw] pb-1">
            {visibleCanvases.map((c, idx) => {
              const selected = idx === switcherIndex || c.id === focusedId;
              const cTheme = CANVAS_THEMES[c.canvasThemeId || 'emerald-minimal'];
              const thumbSrc = renderBoardThumbnailDataUrl(c, 288, 160);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    setSwitcherIndex(idx);
                    setFocusedId(c.id);
                    setCloseInspectId(c.id);
                    setSwitcherOpen(false);
                    flyToBoard(c.id, INSPECT_DISTANCE);
                  }}
                  onDoubleClick={() => {
                    setSwitcherOpen(false);
                    launchCanvasWithZoom(c.id);
                  }}
                  className={`w-44 shrink-0 rounded-2xl p-2 border text-left cursor-pointer ${
                    selected
                      ? 'border-[#10B981] ring-2 ring-[#10B981]/45'
                      : isDark
                        ? 'border-white/10 hover:border-white/25'
                        : 'border-[#064E3B]/15 hover:border-[#10B981]/50'
                  }`}
                  style={{
                    backgroundColor: isDark ? '#0B1D17' : '#F6FCF9',
                  }}
                >
                  <div
                    className="h-20 rounded-xl mb-2 border overflow-hidden relative"
                    style={{
                      backgroundColor: cTheme?.canvasBg || '#f6faf8',
                      borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(6,78,59,0.12)',
                    }}
                  >
                    <img
                      src={thumbSrc}
                      alt={c.title}
                      className="w-full h-full object-cover"
                      draggable={false}
                    />
                  </div>
                  <div className="text-xs font-bold truncate">{c.title}</div>
                  <div className="text-[10px] opacity-65 mt-0.5 truncate">
                    {c.elementCount} items ·{' '}
                    {c.spatialPosition?.pinned ? 'Pinned · ' : ''}
                    {formatRelativeTime(c.updatedAt)}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Compact Floating Action Bar Above Selected / Close-Zoomed Card (never covers card face) */}
      {activeInspectionRecord && !isDraggingBoard && (closeInspectId || focusedId) && (
        <div
          data-testid="close-zoom-resume-hud"
          className={`fixed z-30 flex items-center gap-2 rounded-full px-3.5 py-1.5 border ${hudPillClass}`}
          style={{
            left: hudAnchor.visible ? `${hudAnchor.x}px` : '50%',
            top: hudAnchor.visible ? `${hudAnchor.y}px` : '82px',
            transform: hudAnchor.visible ? 'translate(-50%, -100%)' : 'translate(-50%, 0)',
          }}
        >
          {editingTitleId === activeInspectionRecord.id ? (
            <div className="flex items-center gap-1.5">
              <input
                ref={renameInputRef}
                data-testid="inline-canvas-title-input"
                type="text"
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitInlineRename();
                  if (e.key === 'Escape') setEditingTitleId(null);
                }}
                onBlur={commitInlineRename}
                aria-label="Canvas title"
                className={`w-48 px-2.5 py-1 rounded-full border text-xs font-bold outline-none ${
                  isDark
                    ? 'bg-[#040B09] border-[#34D399] text-white'
                    : 'bg-white border-[#10B981] text-[#064E3B]'
                }`}
              />
              <button
                type="button"
                aria-label="Save canvas title"
                onMouseDown={(e) => {
                  e.preventDefault();
                  commitInlineRename();
                }}
                className="p-1.5 rounded-full bg-[#059669] text-white hover:bg-[#047857]"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              data-testid="inline-canvas-title-trigger"
              onClick={() => startInlineRename(activeInspectionRecord)}
              className="group flex items-center gap-1.5 text-left max-w-[200px] cursor-pointer"
              title="Click to rename canvas"
            >
              <span className="text-xs font-bold truncate">{activeInspectionRecord.title}</span>
              <Edit3 className="w-3 h-3 opacity-60 group-hover:opacity-100 shrink-0" />
            </button>
          )}

          <span className="text-[11px] opacity-65 tabular-nums whitespace-nowrap hidden sm:inline">
            {activeInspectionRecord.elementCount} items ·{' '}
            {formatRelativeTime(activeInspectionRecord.updatedAt)}
          </span>

          <div
            className={`h-4 w-px ${isDark ? 'bg-white/15' : 'bg-[#064E3B]/15'}`}
          />

          <button
            type="button"
            data-testid="hub-pin-toggle-btn"
            title={
              activeInspectionRecord.spatialPosition?.pinned
                ? 'Pinned in free space (click to unpin)'
                : 'Pin at current position'
            }
            onClick={() => {
              const rt = boardsMapRef.current.get(activeInspectionRecord.id);
              const currPos = activeInspectionRecord.spatialPosition || {
                x: rt?.targetPos.x ?? 0,
                y: rt?.targetPos.y ?? 0,
                z: rt?.targetPos.z ?? 0,
                rotY: rt?.targetRotY ?? 0,
                pinned: false,
              };
              const nextPinned = !currPos.pinned;
              onUpdateCanvasPosition(activeInspectionRecord.id, {
                ...currPos,
                pinned: nextPinned,
              });
            }}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap shrink-0 cursor-pointer ${
              activeInspectionRecord.spatialPosition?.pinned
                ? isDark
                  ? 'bg-[#10B981]/22 text-[#34D399]'
                  : 'bg-[#D1FAE5] text-[#064E3B]'
                : isDark
                  ? 'text-[#94A3B8] hover:bg-white/10'
                  : 'text-[#047857] hover:bg-[#ECFDF5]'
            }`}
          >
            <Pin className="w-3 h-3" />
            <span>{activeInspectionRecord.spatialPosition?.pinned ? 'Pinned' : 'Pin'}</span>
          </button>

          {canvases.length > 1 && (
            <button
              type="button"
              aria-label="Delete canvas"
              onClick={() => {
                const idToDelete = activeInspectionRecord.id;
                setCloseInspectId(null);
                setFocusedId(null);
                onDeleteCanvas(idToDelete);
              }}
              className={`p-1.5 rounded-full cursor-pointer ${
                isDark
                  ? 'text-rose-400 hover:bg-rose-500/15'
                  : 'text-rose-600 hover:bg-rose-50'
              }`}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            type="button"
            data-testid="hub-open-canvas-btn"
            onClick={() => launchCanvasWithZoom(activeInspectionRecord.id)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-[#059669] to-[#10B981] hover:from-[#047857] hover:to-[#059669] text-white text-xs font-bold shadow-sm whitespace-nowrap shrink-0 cursor-pointer"
          >
            <span>Open Canvas</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};
