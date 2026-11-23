import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  Cpu,
  Download,
  Eye,
  Lock,
  Maximize2,
  Presentation,
  Redo2,
  Sigma,
  SlidersHorizontal,
  Undo2,
  Users,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {
  CameraState,
  CanvasThemeId,
  CircuitKind,
  CollabStatus,
  FillStyle,
  FontFamily,
  Locale,
  Point,
  RemoteCursorPayload,
  Sloppiness,
  StrokeStyle,
  ThemeId,
  ToolType,
  TriangleVariant,
  WhiteboardElement,
} from './types';
import {
  applyThemeToDocument,
  CANVAS_THEMES,
  FORGE_THEMES,
  resolveWorkspaceTheme,
} from './themes';
import { TRANSLATIONS } from './i18n';
import { createDemoCircuitPreset, createSimStarterCircuit, SimPresetId } from './circuitPreset';
import {
  getCroProbeWaveform,
  PhasorVector,
  Simulator,
  SimulatorState,
  TransientIntegrationMethod,
} from './circuitSimulator';
import { CIRCUIT_CATALOG } from './engineeringComponents';
import { getNormalizedBounds, rotateElementBy, updateBoundConnectors } from './sketchEngine';
import { importSceneFromJson } from './exporters';
import {
  decryptJson,
  encryptJson,
  generateEncryptionKey,
  generateRoomId,
  importEncryptionKey,
  parseRoomHash,
} from './crypto';
import { Canvas } from './components/Canvas';
import { Toolbar } from './components/Toolbar';
import { PropertiesPanel } from './components/PropertiesPanel';
import { EngineeringSidebar } from './components/EngineeringSidebar';
import { SimulationPanel } from './components/SimulationPanel';
import { MainMenu } from './components/MainMenu';
import { PresentationController } from './components/PresentationController';
import { ExportModal } from './components/ExportModal';
import { ThemeModal } from './components/ThemeModal';
import { CollabModal } from './components/CollabModal';
import { CommandItem, CommandPalette } from './components/CommandPalette';
import { FontShowcaseModal } from './components/FontShowcaseModal';
import { RustCodeViewerModal } from './components/RustCodeViewerModal';
import { InstrumentInspectorModal } from './components/InstrumentInspectorModal';
import { WebpageBlockModal } from './components/WebpageBlockModal';
import { OpeningScreen } from './components/OpeningScreen';
import { CanvasHub3D } from './components/CanvasHub3D';
import { MobileWorkspaceHUD } from './components/MobileWorkspaceHUD';
import {
  CanvasCategory,
  SpatialCanvasRecord,
  SpatialPosition,
  createBlankSpatialCanvas,
  extractLastViewport,
  loadActiveCanvasId,
  loadHubCanvases,
  reArrangeUnpinnedCanvases,
  saveActiveCanvasId,
  saveHubCanvases,
} from './hub/canvasHubStore';
import { renderBoardThumbnailDataUrl } from './hub/boardTextureRenderer';
import { CodeRunnerBar } from './components/CodeRunnerBar';
import { CODE_LANGUAGE_LABELS, CodeLanguage, CodeRunResult, detectCodeLanguage } from './codeRunner';
import { evaluateDigitalCircuit, isLetterLogicInput, isLogicGateKind } from './digitalLogic';
import { MathStudioTab, MathWorkspacePanel } from './components/math/MathWorkspacePanel';
import { Graph2DConfig, Graph3DConfig } from './math/types';
import {
  createDefaultGraph2DConfig,
  createDefaultGraph3DConfig,
  createMathEquationElement,
  createMathGraph2DElement,
  createMathGraph3DElement,
  createMathMatrixElement,
  propagateEquationEditsToGraphs,
} from './math/MathCanvasIntegration';
import {
  expandExpression,
  factorExpression,
  simplifyExpression,
  solveEquation,
} from './math/AlgebraEngine';
import { differentiateSymbolic, integrateIndefinite } from './math/CalculusEngine';
import { canonicalToLatex, normalizeUnicodeToCanonical } from './math/SymbolConverter';

const STORAGE_SCENE_KEY = 'rustly-forge-scene-v1';
const STORAGE_PREFS_KEY = 'rustly-forge-prefs-v1';

const PEER_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4'];

function loadInitialPrefs(): {
  themeId: ThemeId;
  canvasThemeId: CanvasThemeId;
  locale: Locale;
  showGrid: boolean;
  shapeSnapEnabled: boolean;
} {
  try {
    const raw = localStorage.getItem(STORAGE_PREFS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        themeId: FORGE_THEMES[parsed.themeId as ThemeId]
          ? (parsed.themeId as ThemeId)
          : 'liquid-glass-emerald',
        canvasThemeId: CANVAS_THEMES[parsed.canvasThemeId as CanvasThemeId]
          ? (parsed.canvasThemeId as CanvasThemeId)
          : 'emerald-minimal',
        locale: TRANSLATIONS[parsed.locale as Locale] ? parsed.locale : 'en',
        showGrid: typeof parsed.showGrid === 'boolean' ? parsed.showGrid : true,
        shapeSnapEnabled:
          typeof parsed.shapeSnapEnabled === 'boolean' ? parsed.shapeSnapEnabled : true,
      };
    }
  } catch {
    // Ignore storage read errors
  }
  const prefersDark =
    typeof window !== 'undefined' &&
    Boolean(window.matchMedia?.('(prefers-color-scheme: dark)').matches);
  return {
    themeId: 'liquid-glass-emerald',
    canvasThemeId: prefersDark ? 'black-slate' : 'emerald-minimal',
    locale: 'en',
    showGrid: true,
    shapeSnapEnabled: true,
  };
}

function loadInitialElements(): WhiteboardElement[] {
  try {
    const raw = localStorage.getItem(STORAGE_SCENE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch {
    // Ignore storage read errors
  }
  return [];
}

type AppRoute = 'splash' | 'hub' | 'canvas';

function parseLocationRoute(): { route: AppRoute; canvasId: string | null } {
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1') {
      return { route: 'canvas', canvasId: null };
    }
    const path = window.location.pathname.replace(/\/+$/, '') || '/';
    if (path === '/hub') {
      return { route: 'hub', canvasId: null };
    }
    if (path.startsWith('/canvas/')) {
      const id = decodeURIComponent(path.slice('/canvas/'.length));
      if (id) return { route: 'canvas', canvasId: id };
    }
  } catch {
    // Fallback to splash
  }
  return { route: 'splash', canvasId: null };
}

export default function App() {
  const initialPrefs = useMemo(() => loadInitialPrefs(), []);
  const [themeId, setThemeId] = useState<ThemeId>(initialPrefs.themeId);
  const [canvasThemeId, setCanvasThemeId] = useState<CanvasThemeId>(initialPrefs.canvasThemeId);
  const [locale, setLocale] = useState<Locale>(initialPrefs.locale);
  const [showGrid, setShowGrid] = useState(initialPrefs.showGrid);
  const [shapeSnapEnabled, setShapeSnapEnabled] = useState(initialPrefs.shapeSnapEnabled);

  const theme = useMemo(
    () => resolveWorkspaceTheme(themeId, canvasThemeId),
    [themeId, canvasThemeId]
  );
  const t = TRANSLATIONS[locale];

  const initialBoot = useMemo(() => {
    const legacy = loadInitialElements();
    const loadedHub = loadHubCanvases(legacy);
    const parsedRoute = parseLocationRoute();
    const storedActiveId = loadActiveCanvasId();
    const resolvedId =
      parsedRoute.canvasId && loadedHub.some((c) => c.id === parsedRoute.canvasId)
        ? parsedRoute.canvasId
        : storedActiveId && loadedHub.some((c) => c.id === storedActiveId)
          ? storedActiveId
          : loadedHub[0]?.id || null;
    const activeRec = loadedHub.find((c) => c.id === resolvedId) || loadedHub[0] || null;
    return {
      hubCanvases: loadedHub,
      route: parsedRoute.route,
      activeId: activeRec?.id || null,
      initialElements: activeRec ? activeRec.elements : legacy,
      initialCamera: activeRec ? activeRec.camera : { x: 0, y: 0, zoom: 1 },
    };
  }, []);

  const [hubCanvases, setHubCanvases] = useState<SpatialCanvasRecord[]>(initialBoot.hubCanvases);
  const [activeCanvasId, setActiveCanvasId] = useState<string | null>(initialBoot.activeId);
  const [appRoute, setAppRoute] = useState<AppRoute>(initialBoot.route);

  const [elements, setElements] = useState<WhiteboardElement[]>(initialBoot.initialElements);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeTool, setActiveTool] = useState<ToolType>('select');
  const [pendingCircuitKind, setPendingCircuitKind] = useState<CircuitKind | null>(null);
  const [camera, setCamera] = useState<CameraState>(initialBoot.initialCamera);

  const [defaultStyle, setDefaultStyle] = useState<{
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
  }>({
    strokeColor: theme.defaultInk,
    backgroundColor: 'transparent',
    fillStyle: 'none',
    strokeWidth: 2.2,
    strokeStyle: 'solid',
    sloppiness: 1,
    fontFamily: 'scribble',
    fontSize: 20,
    opacity: 100,
    triangleVariant: 'equilateral',
  });

  // Drawers & Modals
  const showOpeningScreen = appRoute === 'splash';
  const showCanvasHub = appRoute === 'hub';
  const [circuitsOpen, setCircuitsOpen] = useState(false);
  const [simPanelOpen, setSimPanelOpen] = useState(false);
  const [mathOpen, setMathOpen] = useState(false);
  const [mathTab, setMathTab] = useState<MathStudioTab>('equation');
  const [simActive, setSimActive] = useState(false);
  const [simRunning, setSimRunning] = useState(false);
  const [simSpeed, setSimSpeed] = useState(1);
  const [simFrequencyHz, setSimFrequencyHz] = useState(60);
  const [simIntegrationMethod, setSimIntegrationMethod] =
    useState<TransientIntegrationMethod>('trapezoidal');
  const simulatorRef = useRef<Simulator | null>(null);
  const [simState, setSimState] = useState<SimulatorState | null>(null);
  const [inspectedInstrumentId, setInspectedInstrumentId] = useState<string | null>(null);
  const [editingWebpageId, setEditingWebpageId] = useState<string | null>(null);
  const [codeLangOverride, setCodeLangOverride] = useState<CodeLanguage | null>(null);
  const [codeStdin, setCodeStdin] = useState('');
  const [codeRunning, setCodeRunning] = useState(false);
  const [codeRunResult, setCodeRunResult] = useState<CodeRunResult | null>(null);
  const [zenMode, setZenMode] = useState(false);
  const [presentationIndex, setPresentationIndex] = useState<number | null>(null);
  const prePresentationToolRef = useRef<ToolType>('select');
  const [sidePanelEdgeHovered, setSidePanelEdgeHovered] = useState(false);
  const [sidePanelLocked, setSidePanelLocked] = useState(false);
  const sidePanelHideTimerRef = useRef<number | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [themeModalOpen, setThemeModalOpen] = useState(false);
  const [collabModalOpen, setCollabModalOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [fontModalOpen, setFontModalOpen] = useState(false);
  const [rustModalOpen, setRustModalOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [workspaceSwitcherOpen, setWorkspaceSwitcherOpen] = useState(false);
  const [workspaceSwitcherIndex, setWorkspaceSwitcherIndex] = useState(0);

  const clearSidePanelHideTimer = useCallback(() => {
    if (sidePanelHideTimerRef.current !== null) {
      window.clearTimeout(sidePanelHideTimerRef.current);
      sidePanelHideTimerRef.current = null;
    }
  }, []);

  const handleSidePanelEnter = useCallback(() => {
    clearSidePanelHideTimer();
    setSidePanelEdgeHovered(true);
  }, [clearSidePanelHideTimer]);

  const handleSidePanelLeave = useCallback(() => {
    clearSidePanelHideTimer();
    sidePanelHideTimerRef.current = window.setTimeout(() => {
      setSidePanelEdgeHovered(false);
    }, 400);
  }, [clearSidePanelHideTimer]);

  useEffect(() => {
    return () => clearSidePanelHideTimer();
  }, [clearSidePanelHideTimer]);

  const isDrawingOrCreationTool =
    pendingCircuitKind !== null ||
    !['select', 'hand', 'laser', 'eraser'].includes(activeTool);
  const showDesktopSidePanel =
    isDrawingOrCreationTool || sidePanelEdgeHovered || sidePanelLocked;

  // Undo / Redo History
  const historyRef = useRef<WhiteboardElement[][]>([elements]);
  const historyIdxRef = useRef<number>(0);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // File Inputs
  const imageInputRef = useRef<HTMLInputElement>(null);
  const sceneFileInputRef = useRef<HTMLInputElement>(null);

  // E2EE Collaboration State
  const peerIdRef = useRef<string>(`peer_${Math.random().toString(36).slice(2, 9)}`);
  const peerColorRef = useRef<string>(
    PEER_COLORS[Math.floor(Math.random() * PEER_COLORS.length)]
  );
  const cryptoKeyRef = useRef<CryptoKey | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const isRemoteUpdateRef = useRef(false);
  const sceneVersionRef = useRef(1);
  const lastCursorSentRef = useRef(0);

  const [collab, setCollab] = useState<CollabStatus>({
    connected: false,
    roomId: null,
    keyString: null,
    peerId: peerIdRef.current,
    peerName: 'Engineer',
    peerColor: peerColorRef.current,
    peers: {},
  });

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg((curr) => (curr === msg ? null : curr)), 2600);
  }, []);

  // Apply theme CSS variables and sync default ink
  useEffect(() => {
    applyThemeToDocument(theme);
    setDefaultStyle((prev) => ({
      ...prev,
      strokeColor: theme.defaultInk,
    }));
  }, [theme]);

  // Persist scene, hub records & preferences locally
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_SCENE_KEY, JSON.stringify(elements));
    } catch {
      // Ignore quota errors
    }
  }, [elements]);

  useEffect(() => {
    saveHubCanvases(hubCanvases);
  }, [hubCanvases]);

  useEffect(() => {
    saveActiveCanvasId(activeCanvasId);
  }, [activeCanvasId]);

  const syncActiveCanvasIntoHub = useCallback(
    (
      nextEls: WhiteboardElement[] = elements,
      nextCam: CameraState = camera,
      targetId: string | null = activeCanvasId,
      nextCanvasThemeId: CanvasThemeId = canvasThemeId
    ) => {
      if (!targetId) return;
      const w = typeof window !== 'undefined' ? window.innerWidth : 1280;
      const h = typeof window !== 'undefined' ? window.innerHeight : 800;
      const snapshot = extractLastViewport(nextEls, nextCam, w, h);
      const count = nextEls.filter((el) => !el.isDeleted).length;
      const now = Date.now();
      setHubCanvases((prev) =>
        prev.map((rec) =>
          rec.id === targetId
            ? {
                ...rec,
                canvasThemeId: nextCanvasThemeId,
                elements: nextEls,
                elementCount: count,
                camera: nextCam,
                updatedAt: now,
                lastViewport: snapshot,
              }
            : rec
        )
      );
    },
    [activeCanvasId, camera, canvasThemeId, elements]
  );

  // Sync active workspace edits, theme, and camera pan/zoom back into the active hub board record
  useEffect(() => {
    if (appRoute !== 'canvas' || !activeCanvasId) return;
    const timer = window.setTimeout(() => {
      syncActiveCanvasIntoHub(elements, camera, activeCanvasId, canvasThemeId);
    }, 180);
    return () => window.clearTimeout(timer);
  }, [activeCanvasId, appRoute, camera, canvasThemeId, elements, syncActiveCanvasIntoHub]);

  const navigateRoute = useCallback(
    (nextRoute: AppRoute, canvasId?: string | null) => {
      setAppRoute(nextRoute);
      try {
        const nextUrl =
          nextRoute === 'splash'
            ? '/'
            : nextRoute === 'hub'
              ? '/hub'
              : `/canvas/${encodeURIComponent(canvasId || activeCanvasId || 'workspace')}`;
        if (window.location.pathname !== nextUrl) {
          window.history.pushState({ route: nextRoute, canvasId }, '', nextUrl);
        }
      } catch {
        // Ignore history pushState restrictions
      }
    },
    [activeCanvasId]
  );

  const handleOpenCanvasFromHub = useCallback(
    (canvasId: string) => {
      const target = hubCanvases.find((c) => c.id === canvasId);
      if (!target) return;
      setActiveCanvasId(target.id);
      setElements(target.elements);
      setCamera(target.camera || { x: 0, y: 0, zoom: 1 });
      if (target.canvasThemeId && CANVAS_THEMES[target.canvasThemeId]) {
        setCanvasThemeId(target.canvasThemeId);
      }
      setSelectedIds([]);
      setInspectedInstrumentId(null);
      setEditingWebpageId(null);
      setSimActive(false);
      setSimRunning(false);
      setSimState(null);
      historyRef.current = [target.elements];
      historyIdxRef.current = 0;
      setCanUndo(false);
      setCanRedo(false);
      navigateRoute('canvas', target.id);
    },
    [hubCanvases, navigateRoute]
  );

  const handleOpenHubFromWorkspace = useCallback(() => {
    if (appRoute === 'canvas' && activeCanvasId) {
      syncActiveCanvasIntoHub(elements, camera, activeCanvasId, canvasThemeId);
    }
    setCircuitsOpen(false);
    setMathOpen(false);
    setSimPanelOpen(false);
    setCommandOpen(false);
    navigateRoute('hub');
  }, [activeCanvasId, appRoute, camera, canvasThemeId, elements, navigateRoute, syncActiveCanvasIntoHub]);

  const handleCreateBlankHubCanvas = useCallback(
    (
      category: CanvasCategory = 'Architecture',
      options?: { canvasThemeId?: CanvasThemeId; spatialPosition?: SpatialPosition }
    ) => {
      const created = createBlankSpatialCanvas('Untitled Canvas', category, options);
      setHubCanvases((prev) => [created, ...prev]);
      return created;
    },
    []
  );

  const handleRenameHubCanvas = useCallback((canvasId: string, nextTitle: string) => {
    const clean = nextTitle.trim();
    if (!clean) return;
    setHubCanvases((prev) =>
      prev.map((rec) => (rec.id === canvasId ? { ...rec, title: clean, updatedAt: Date.now() } : rec))
    );
  }, []);

  const handleUpdateCanvasPosition = useCallback(
    (canvasId: string, spatialPosition: SpatialPosition) => {
      setHubCanvases((prev) =>
        prev.map((rec) =>
          rec.id === canvasId ? { ...rec, spatialPosition } : rec
        )
      );
    },
    []
  );

  const handleAutoArrangeCanvases = useCallback(() => {
    setHubCanvases((prev) => reArrangeUnpinnedCanvases(prev, Date.now()));
  }, []);

  const handleDeleteHubCanvas = useCallback(
    (canvasId: string) => {
      setHubCanvases((prev) => {
        if (prev.length <= 1) return prev;
        const filtered = prev.filter((rec) => rec.id !== canvasId);
        if (activeCanvasId === canvasId && filtered[0]) {
          setActiveCanvasId(filtered[0].id);
          setElements(filtered[0].elements);
          setCamera(filtered[0].camera || { x: 0, y: 0, zoom: 1 });
          if (filtered[0].canvasThemeId && CANVAS_THEMES[filtered[0].canvasThemeId]) {
            setCanvasThemeId(filtered[0].canvasThemeId);
          }
        }
        return filtered;
      });
    },
    [activeCanvasId]
  );

  // Sync browser Back/Forward buttons with /, /hub, /canvas/:id
  useEffect(() => {
    const onPopState = () => {
      const parsed = parseLocationRoute();
      if (parsed.route === 'canvas' && parsed.canvasId) {
        const match = hubCanvases.find((c) => c.id === parsed.canvasId);
        if (match) {
          setActiveCanvasId(match.id);
          setElements(match.elements);
          setCamera(match.camera || { x: 0, y: 0, zoom: 1 });
          if (match.canvasThemeId && CANVAS_THEMES[match.canvasThemeId]) {
            setCanvasThemeId(match.canvasThemeId);
          }
          setSelectedIds([]);
          historyRef.current = [match.elements];
          historyIdxRef.current = 0;
        }
      }
      setAppRoute(parsed.route);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [hubCanvases]);

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_PREFS_KEY,
        JSON.stringify({ themeId, canvasThemeId, locale, showGrid, shapeSnapEnabled })
      );
    } catch {
      // Ignore storage errors
    }
  }, [themeId, canvasThemeId, locale, showGrid, shapeSnapEnabled]);

  const syncHistoryFlags = useCallback(() => {
    setCanUndo(historyIdxRef.current > 0);
    setCanRedo(historyIdxRef.current < historyRef.current.length - 1);
  }, []);

  const broadcastEncryptedScene = useCallback(async (nextElements: WhiteboardElement[]) => {
    const ws = wsRef.current;
    const key = cryptoKeyRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN || !key || !collab.roomId) return;
    try {
      sceneVersionRef.current += 1;
      const envelope = await encryptJson({ elements: nextElements }, key);
      ws.send(
        JSON.stringify({
          type: 'scene:update',
          roomId: collab.roomId,
          peerId: peerIdRef.current,
          version: sceneVersionRef.current,
          envelope,
        })
      );
    } catch {
      // Ignore transient encryption/socket errors
    }
  }, [collab.roomId]);

  const handleElementsChange = useCallback(
    (next: WhiteboardElement[], commitHistory = true) => {
      setElements(next);
      if (commitHistory) {
        const sliced = historyRef.current.slice(0, historyIdxRef.current + 1);
        sliced.push(next);
        if (sliced.length > 60) sliced.shift();
        historyRef.current = sliced;
        historyIdxRef.current = sliced.length - 1;
        syncHistoryFlags();
      }
      if (!isRemoteUpdateRef.current) {
        void broadcastEncryptedScene(next);
      }
    },
    [broadcastEncryptedScene, syncHistoryFlags]
  );

  const handleUndo = useCallback(() => {
    if (historyIdxRef.current <= 0) return;
    historyIdxRef.current -= 1;
    const prev = historyRef.current[historyIdxRef.current];
    setElements(prev);
    setSelectedIds([]);
    syncHistoryFlags();
    void broadcastEncryptedScene(prev);
  }, [broadcastEncryptedScene, syncHistoryFlags]);

  const handleRedo = useCallback(() => {
    if (historyIdxRef.current >= historyRef.current.length - 1) return;
    historyIdxRef.current += 1;
    const next = historyRef.current[historyIdxRef.current];
    setElements(next);
    setSelectedIds([]);
    syncHistoryFlags();
    void broadcastEncryptedScene(next);
  }, [broadcastEncryptedScene, syncHistoryFlags]);

  // Connect to E2EE WebSocket room
  const connectToRoom = useCallback(
    async (roomId: string, keyString: string, peerNameOverride?: string) => {
      try {
        const key = await importEncryptionKey(keyString);
        cryptoKeyRef.current = key;
        if (wsRef.current) {
          wsRef.current.close();
          wsRef.current = null;
        }

        const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const ws = new WebSocket(`${proto}//${window.location.host}/ws`);
        wsRef.current = ws;

        setCollab((prev) => ({
          ...prev,
          roomId,
          keyString,
          peerName: peerNameOverride || prev.peerName,
          connected: false,
        }));

        ws.onopen = () => {
          setCollab((prev) => ({ ...prev, connected: true }));
          ws.send(
            JSON.stringify({
              type: 'join',
              roomId,
              peerId: peerIdRef.current,
            })
          );
          // Push current local scene if room was just created
          void broadcastEncryptedScene(elements);
        };

        ws.onmessage = async (event) => {
          try {
            const msg = JSON.parse(event.data);
            if ((msg.type === 'room:init' || msg.type === 'scene:update') && msg.envelope) {
              if (msg.peerId === peerIdRef.current) return;
              const decrypted = await decryptJson<{ elements: WhiteboardElement[] }>(
                msg.envelope,
                key
              );
              if (Array.isArray(decrypted.elements)) {
                isRemoteUpdateRef.current = true;
                setElements(decrypted.elements);
                isRemoteUpdateRef.current = false;
              }
            } else if (msg.type === 'cursor:update' && msg.envelope && msg.peerId !== peerIdRef.current) {
              const cursor = await decryptJson<RemoteCursorPayload>(msg.envelope, key);
              setCollab((prev) => ({
                ...prev,
                peers: {
                  ...prev.peers,
                  [cursor.peerId]: cursor,
                },
              }));
            } else if (msg.type === 'peer:left' && msg.peerId) {
              setCollab((prev) => {
                const nextPeers = { ...prev.peers };
                delete nextPeers[msg.peerId];
                return { ...prev, peers: nextPeers };
              });
            }
          } catch {
            // Ignore undecryptable or malformed frames
          }
        };

        ws.onclose = () => {
          setCollab((prev) => ({ ...prev, connected: false }));
        };
      } catch {
        showToast('Failed to initialize room encryption key');
      }
    },
    [broadcastEncryptedScene, elements, showToast]
  );

  // Auto-join if URL contains #room=<id>,<key>
  useEffect(() => {
    const checkHash = () => {
      const parsed = parseRoomHash(window.location.hash);
      if (parsed && parsed.roomId !== collab.roomId) {
        void connectToRoom(parsed.roomId, parsed.keyString);
        showToast('Joined end-to-end encrypted room');
      }
    };
    checkHash();
    window.addEventListener('hashchange', checkHash);
    return () => window.removeEventListener('hashchange', checkHash);
  }, [collab.roomId, connectToRoom, showToast]);

  const handleStartCollabSession = async (peerName: string) => {
    const roomId = generateRoomId();
    const { keyString } = await generateEncryptionKey();
    window.history.replaceState(null, '', `/#room=${roomId},${keyString}`);
    await connectToRoom(roomId, keyString, peerName);
    showToast('E2EE session live');
  };

  const handleStopCollabSession = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    cryptoKeyRef.current = null;
    window.history.replaceState(null, '', '/');
    setCollab((prev) => ({
      ...prev,
      connected: false,
      roomId: null,
      keyString: null,
      peers: {},
    }));
  };

  const handleCursorMove = useCallback(
    (worldPt: Point) => {
      const ws = wsRef.current;
      const key = cryptoKeyRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN || !key || !collab.roomId) return;
      const now = Date.now();
      if (now - lastCursorSentRef.current < 60) return;
      lastCursorSentRef.current = now;
      const payload: RemoteCursorPayload = {
        peerId: peerIdRef.current,
        name: collab.peerName,
        color: collab.peerColor,
        x: worldPt.x,
        y: worldPt.y,
        tool: activeTool,
        updatedAt: now,
      };
      void encryptJson(payload, key).then((envelope) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(
            JSON.stringify({
              type: 'cursor:update',
              roomId: collab.roomId,
              peerId: peerIdRef.current,
              envelope,
            })
          );
        }
      });
    },
    [activeTool, collab.peerColor, collab.peerName, collab.roomId]
  );

  const selectedElements = useMemo(
    () => elements.filter((e) => !e.isDeleted && selectedIds.includes(e.id)),
    [elements, selectedIds]
  );

  const frames = useMemo(
    () =>
      elements
        .filter((e) => !e.isDeleted && e.type === 'frame')
        .sort((a, b) => (a.frameIndex || 0) - (b.frameIndex || 0)),
    [elements]
  );

  const handleUpdateSelected = useCallback(
    (patch: Partial<WhiteboardElement>) => {
      if (selectedIds.length === 0) return;
      const computedPatch: Partial<WhiteboardElement> =
        typeof patch.mathRaw === 'string' && !patch.mathLatex
          ? { ...patch, mathLatex: canonicalToLatex(normalizeUnicodeToCanonical(patch.mathRaw)) }
          : patch;
      let next = elements.map((el) =>
        selectedIds.includes(el.id)
          ? { ...el, ...computedPatch, version: el.version + 1, updatedAt: Date.now() }
          : el
      );
      if (typeof patch.mathRaw === 'string') {
        for (const id of selectedIds) {
          const target = next.find((e) => e.id === id);
          if (target?.type === 'math-equation') {
            next = propagateEquationEditsToGraphs(next, id, patch.mathRaw);
          }
        }
      }
      handleElementsChange(next, true);
    },
    [elements, handleElementsChange, selectedIds]
  );

  const handleUpdateElementById = useCallback(
    (id: string, patch: Partial<WhiteboardElement>, commitHistory = true) => {
      const computedPatch: Partial<WhiteboardElement> =
        typeof patch.mathRaw === 'string' && !patch.mathLatex
          ? { ...patch, mathLatex: canonicalToLatex(normalizeUnicodeToCanonical(patch.mathRaw)) }
          : patch;
      let next = elements.map((el) =>
        el.id === id ? { ...el, ...computedPatch, version: el.version + 1, updatedAt: Date.now() } : el
      );
      if (typeof patch.mathRaw === 'string') {
        const target = next.find((e) => e.id === id);
        if (target?.type === 'math-equation') {
          next = propagateEquationEditsToGraphs(next, id, patch.mathRaw);
        }
      }
      handleElementsChange(next, commitHistory);
      if (typeof patch.frequencyHz === 'number') {
        setSimFrequencyHz(patch.frequencyHz);
      }
    },
    [elements, handleElementsChange]
  );

  const getViewportWorldCenter = useCallback(() => {
    return {
      x: (window.innerWidth / 2 - camera.x) / camera.zoom,
      y: (window.innerHeight / 2 - camera.y) / camera.zoom,
    };
  }, [camera.x, camera.y, camera.zoom]);

  const handleStampEquation = useCallback(
    (raw: string, result?: { text: string; latex?: string; operation?: string }) => {
      const { x, y } = getViewportWorldCenter();
      const el = createMathEquationElement(raw, x - 140, y - 40, theme.defaultInk, result);
      handleElementsChange([...elements, el], true);
      setSelectedIds([el.id]);
      showToast('Stamped mathematical equation on canvas');
    },
    [elements, getViewportWorldCenter, handleElementsChange, showToast, theme.defaultInk]
  );

  const handleStampMatrix = useCallback(
    (matrix: number[][], name: string) => {
      const { x, y } = getViewportWorldCenter();
      const el = createMathMatrixElement(matrix, name, x - 130, y - 70, theme.defaultInk);
      handleElementsChange([...elements, el], true);
      setSelectedIds([el.id]);
      showToast(`Stamped Matrix ${name} on canvas`);
    },
    [elements, getViewportWorldCenter, handleElementsChange, showToast, theme.defaultInk]
  );

  const handleStampGraph2D = useCallback(
    (config: Graph2DConfig) => {
      const { x, y } = getViewportWorldCenter();
      const el = createMathGraph2DElement(config, x - 220, y - 160, theme.defaultInk);
      handleElementsChange([...elements, el], true);
      setSelectedIds([el.id]);
      showToast('Stamped interactive 2D graph on canvas');
    },
    [elements, getViewportWorldCenter, handleElementsChange, showToast, theme.defaultInk]
  );

  const handleStampGraph3D = useCallback(
    (config: Graph3DConfig) => {
      const { x, y } = getViewportWorldCenter();
      const el = createMathGraph3DElement(config, x - 280, y - 205, theme.defaultInk);
      handleElementsChange([...elements, el], true);
      setSelectedIds([el.id]);
      showToast('Stamped interactive 3D & Contour plot on canvas');
    },
    [elements, getViewportWorldCenter, handleElementsChange, showToast, theme.defaultInk]
  );

  const handleOpenMathStudio = useCallback((elementId?: string, tab?: MathStudioTab) => {
    if (elementId) setSelectedIds([elementId]);
    if (tab) setMathTab(tab);
    setCircuitsOpen(false);
    setSimPanelOpen(false);
    setMathOpen(true);
  }, []);

  const handlePlotEquation2D = useCallback(
    (el: WhiteboardElement) => {
      const expr = el.mathRaw || 'x^2';
      const cfg = createDefaultGraph2DConfig([
        { expression: expr, label: expr, sourceElementId: el.id },
      ]);
      const graphEl = createMathGraph2DElement(cfg, el.x, el.y + el.height + 24, theme.defaultInk);
      handleElementsChange([...elements, graphEl], true);
      setSelectedIds([graphEl.id]);
      showToast('Created linked 2D plot');
    },
    [elements, handleElementsChange, showToast, theme.defaultInk]
  );

  const handlePlotEquation3D = useCallback(
    (el: WhiteboardElement) => {
      const raw = normalizeUnicodeToCanonical(el.mathRaw || 'a*x^2 + b*y^2 + c*x*y + d*x').replace(
        /^z\s*=\s*/i,
        ''
      );
      const cfg = createDefaultGraph3DConfig(raw, el.id);
      const graphEl = createMathGraph3DElement(cfg, el.x, el.y + el.height + 24, theme.defaultInk);
      handleElementsChange([...elements, graphEl], true);
      setSelectedIds([graphEl.id]);
      showToast('Created linked 3D & Contour plot');
    },
    [elements, handleElementsChange, showToast, theme.defaultInk]
  );

  const handleQuickMathAction = useCallback(
    (el: WhiteboardElement, op: 'simplify' | 'expand' | 'factor' | 'diff' | 'integrate' | 'solve') => {
      const raw = el.mathRaw || '';
      if (!raw.trim()) return;
      const res =
        op === 'simplify'
          ? simplifyExpression(raw)
          : op === 'expand'
          ? expandExpression(raw)
          : op === 'factor'
          ? factorExpression(raw)
          : op === 'diff'
          ? differentiateSymbolic(raw, 'x', 1)
          : op === 'integrate'
          ? integrateIndefinite(raw, 'x')
          : solveEquation(raw, 'x');
      if (!res.ok) {
        showToast(res.error || 'Symbolic computation failed');
        return;
      }
      const resultStr = 'resultText' in res ? res.resultText : res.resultCanonical;
      const label =
        op === 'diff'
          ? 'd/dx'
          : op === 'integrate'
          ? '∫ dx'
          : op.charAt(0).toUpperCase() + op.slice(1);
      handleUpdateElementById(
        el.id,
        {
          mathResult: resultStr,
          mathResultLatex: res.resultLatex,
          mathOperation: label,
          height: Math.max(el.height, 96),
        },
        true
      );
      showToast(`${label}: ${resultStr}`);
    },
    [handleUpdateElementById, showToast]
  );

  const digitalReport = useMemo(() => evaluateDigitalCircuit(elements), [elements]);

  const handleSwitchToggle = useCallback(
    (elementId: string) => {
      const target = elements.find((el) => !el.isDeleted && el.id === elementId);
      if (!target || target.circuitKind !== 'switch') return;
      const nextClosed = !Boolean(target.switchClosed);
      handleUpdateElementById(
        elementId,
        {
          switchClosed: nextClosed,
          componentValue: nextClosed ? 'CLOSED' : 'OPEN',
        },
        true
      );
      showToast(`Switch ${nextClosed ? 'CLOSED (ON)' : 'OPEN (OFF)'}`);
    },
    [elements, handleUpdateElementById, showToast]
  );

  const handleAutoAssignLogicLetters = useCallback(() => {
    const usedLetters = new Set<string>();
    const gateIds = new Set<string>();
    for (const el of elements) {
      if (el.isDeleted || el.type !== 'circuit' || !isLogicGateKind(el.circuitKind)) continue;
      gateIds.add(el.id);
      if (isLetterLogicInput(el.logicInputA)) usedLetters.add((el.logicInputA || '').toUpperCase());
      if (el.circuitKind !== 'gate-not' && isLetterLogicInput(el.logicInputB)) {
        usedLetters.add((el.logicInputB || '').toUpperCase());
      }
    }
    if (gateIds.size === 0) return;

    let letterIdx = 0;
    const nextFreeLetter = (): string => {
      while (letterIdx < 26) {
        const ch = String.fromCharCode(65 + letterIdx);
        letterIdx += 1;
        if (!usedLetters.has(ch)) {
          usedLetters.add(ch);
          return ch;
        }
      }
      return 'Z';
    };

    const next = elements.map((el) => {
      if (!gateIds.has(el.id)) return el;
      const gateEval = digitalReport.gateMap[el.id];
      const nextA = gateEval?.inputAWiredFrom
        ? el.logicInputA
        : isLetterLogicInput(el.logicInputA)
        ? (el.logicInputA || '').toUpperCase()
        : nextFreeLetter();
      const nextB =
        el.circuitKind === 'gate-not'
          ? el.logicInputB
          : gateEval?.inputBWiredFrom
          ? el.logicInputB
          : isLetterLogicInput(el.logicInputB)
          ? (el.logicInputB || '').toUpperCase()
          : nextFreeLetter();
      return {
        ...el,
        logicInputA: nextA,
        logicInputB: nextB,
        version: el.version + 1,
        updatedAt: Date.now(),
      };
    });
    handleElementsChange(next, true);
    showToast('Converted all free logic inputs to sequential letters (A, B, C...)');
  }, [digitalReport.gateMap, elements, handleElementsChange, showToast]);

  const handleResetLogicBinary = useCallback(() => {
    const next = elements.map((el) => {
      if (el.isDeleted || el.type !== 'circuit' || !isLogicGateKind(el.circuitKind)) return el;
      return {
        ...el,
        logicInputA: '0',
        logicInputB: el.circuitKind === 'gate-not' ? undefined : '0',
        version: el.version + 1,
        updatedAt: Date.now(),
      };
    });
    handleElementsChange(next, true);
    showToast('Reset logic gate inputs to Binary (0 / 1)');
  }, [elements, handleElementsChange, showToast]);

  const handleDuplicateSelected = useCallback(() => {
    if (selectedIds.length === 0) return;
    const clones: WhiteboardElement[] = [];
    const newIds: string[] = [];
    for (const el of elements) {
      if (selectedIds.includes(el.id)) {
        const cid = `dup_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
        newIds.push(cid);
        clones.push({
          ...structuredClone(el),
          id: cid,
          x: el.x + 28,
          y: el.y + 28,
          seed: Math.floor(Math.random() * 100000),
          version: 1,
          updatedAt: Date.now(),
        });
      }
    }
    handleElementsChange([...elements, ...clones], true);
    setSelectedIds(newIds);
  }, [elements, handleElementsChange, selectedIds]);

  const handleDeleteSelected = useCallback(() => {
    if (selectedIds.length === 0) return;
    handleElementsChange(
      elements.filter((el) => !selectedIds.includes(el.id)),
      true
    );
    setSelectedIds([]);
  }, [elements, handleElementsChange, selectedIds]);

  const handleLayerChange = useCallback(
    (direction: 'forward' | 'backward') => {
      if (selectedIds.length === 0) return;
      const selSet = new Set(selectedIds);
      const selected = elements.filter((e) => selSet.has(e.id));
      const rest = elements.filter((e) => !selSet.has(e.id));
      const next = direction === 'forward' ? [...rest, ...selected] : [...selected, ...rest];
      handleElementsChange(next, true);
    },
    [elements, handleElementsChange, selectedIds]
  );

  const handleRotateSelected = useCallback(
    (deltaRad: number) => {
      if (selectedIds.length === 0) return;
      const selSet = new Set(selectedIds);
      const rotated = elements.map((el) => (selSet.has(el.id) ? rotateElementBy(el, deltaRad) : el));
      const next = updateBoundConnectors(rotated, selSet);
      handleElementsChange(next, true);
    },
    [elements, handleElementsChange, selectedIds]
  );

  const handleResetRotationSelected = useCallback(() => {
    if (selectedIds.length === 0) return;
    const selSet = new Set(selectedIds);
    const reset = elements.map((el) =>
      selSet.has(el.id) ? { ...el, angle: 0, version: el.version + 1, updatedAt: Date.now() } : el
    );
    const next = updateBoundConnectors(reset, selSet);
    handleElementsChange(next, true);
  }, [elements, handleElementsChange, selectedIds]);

  const handleZoomBy = useCallback((factor: number) => {
    setCamera((prev) => {
      const nextZoom = Math.min(6, Math.max(0.05, prev.zoom * factor));
      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2;
      const wx = (cx - prev.x) / prev.zoom;
      const wy = (cy - prev.y) / prev.zoom;
      return {
        zoom: nextZoom,
        x: cx - wx * nextZoom,
        y: cy - wy * nextZoom,
      };
    });
  }, []);

  const handleFitToScreen = useCallback(() => {
    const active = elements.filter((e) => !e.isDeleted);
    if (active.length === 0) {
      setCamera({ x: 0, y: 0, zoom: 1 });
      return;
    }
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const el of active) {
      const b = getNormalizedBounds(el);
      minX = Math.min(minX, b.x);
      minY = Math.min(minY, b.y);
      maxX = Math.max(maxX, b.x + b.width);
      maxY = Math.max(maxY, b.y + b.height);
    }
    const contentW = Math.max(100, maxX - minX);
    const contentH = Math.max(100, maxY - minY);
    const pad = 120;
    const zoom = Math.min(
      1.6,
      Math.max(0.15, Math.min((window.innerWidth - pad) / contentW, (window.innerHeight - pad) / contentH))
    );
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    setCamera({
      zoom,
      x: window.innerWidth / 2 - cx * zoom,
      y: window.innerHeight / 2 - cy * zoom,
    });
  }, [elements]);

  const navigateToFrame = useCallback(
    (idx: number) => {
      const target = frames[idx];
      if (!target) return;
      if (presentationIndex === null) {
        prePresentationToolRef.current = activeTool;
      }
      const b = getNormalizedBounds(target);
      const pad = 110;
      const zoom = Math.min(
        1.8,
        Math.max(0.3, Math.min((window.innerWidth - pad) / b.width, (window.innerHeight - pad) / b.height))
      );
      setCamera({
        zoom,
        x: window.innerWidth / 2 - (b.x + b.width / 2) * zoom,
        y: window.innerHeight / 2 - (b.y + b.height / 2) * zoom,
      });
      setPresentationIndex(idx);
    },
    [activeTool, frames, presentationIndex]
  );

  const handleQuickInsertWebpage = useCallback(() => {
    const cx = (window.innerWidth / 2 - camera.x) / camera.zoom;
    const cy = (window.innerHeight / 2 - camera.y) / camera.zoom;
    const wp: WhiteboardElement = {
      id: `webpage_${Date.now().toString(36)}`,
      type: 'webpage',
      x: cx - 230,
      y: cy - 170,
      width: 460,
      height: 340,
      angle: 0,
      strokeColor: defaultStyle.strokeColor,
      backgroundColor: defaultStyle.backgroundColor,
      fillStyle: defaultStyle.fillStyle,
      strokeWidth: 2,
      strokeStyle: 'solid',
      sloppiness: 0,
      opacity: 100,
      seed: Math.floor(Math.random() * 100000),
      fontFamily: 'cleansans',
      fontSize: 16,
      webpageTitle: 'index.html',
      htmlCode: '',
      cssCode: '',
      jsCode: '',
      webpageAutoPolish: false,
      version: 1,
      updatedAt: Date.now(),
    };
    handleElementsChange([...elements, wp], true);
    setSelectedIds([wp.id]);
    setActiveTool('select');
    showToast('Placed webpage box — click it to write HTML, CSS & JS');
  }, [camera.x, camera.y, camera.zoom, defaultStyle.backgroundColor, defaultStyle.fillStyle, defaultStyle.strokeColor, elements, handleElementsChange, showToast]);

  const handleQuickInsertFrame = useCallback(() => {
    const cx = (window.innerWidth / 2 - camera.x) / camera.zoom;
    const cy = (window.innerHeight / 2 - camera.y) / camera.zoom;
    const frameCount = elements.filter((el) => !el.isDeleted && el.type === 'frame').length;
    const fr: WhiteboardElement = {
      id: `frame_${Date.now().toString(36)}`,
      type: 'frame',
      x: cx - 240,
      y: cy - 150,
      width: 480,
      height: 300,
      angle: 0,
      strokeColor: defaultStyle.strokeColor,
      backgroundColor: 'transparent',
      fillStyle: 'none',
      strokeWidth: 2,
      strokeStyle: 'dashed',
      sloppiness: 0,
      opacity: 100,
      seed: Math.floor(Math.random() * 100000),
      fontFamily: 'cleansans',
      fontSize: 16,
      frameIndex: frameCount + 1,
      frameTitle: `Slide ${frameCount + 1}`,
      version: 1,
      updatedAt: Date.now(),
    };
    handleElementsChange([...elements, fr], true);
    setSelectedIds([fr.id]);
    setActiveTool('select');
    showToast(`Inserted Slide ${frameCount + 1}`);
  }, [camera.x, camera.y, camera.zoom, defaultStyle.strokeColor, elements, handleElementsChange, showToast]);

  // Sync stateful MNA Simulator whenever circuit elements or frequency change while active
  useEffect(() => {
    if (!simActive) {
      setSimState(null);
      return;
    }
    if (!simulatorRef.current) {
      simulatorRef.current = new Simulator(elements, simFrequencyHz, simIntegrationMethod);
    } else {
      simulatorRef.current.setIntegrationMethod(simIntegrationMethod);
    }
    const next = simulatorRef.current.reset(elements, simFrequencyHz);
    simulatorRef.current.setTimeScale(simSpeed);
    simulatorRef.current.setStatus(simRunning ? 'running' : 'paused');
    setSimState(next);
  }, [simActive, elements, simFrequencyHz]);

  // Real-time transient playback ticker
  useEffect(() => {
    if (!simActive || !simRunning || !simulatorRef.current) return;
    const intervalMs = simSpeed < 1 ? 65 : 40;
    const stepsPerTick = simSpeed < 1 ? 1 : Math.round(2 * simSpeed);
    const id = window.setInterval(() => {
      if (!simulatorRef.current) return;
      const next = simulatorRef.current.step(stepsPerTick);
      setSimState(next);
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [simActive, simRunning, simSpeed]);

  const handleToggleRunning = useCallback(() => {
    if (!simActive) {
      setSimActive(true);
      setSimRunning(true);
      return;
    }
    setSimRunning((r) => {
      const nextRun = !r;
      simulatorRef.current?.setStatus(nextRun ? 'running' : 'paused');
      return nextRun;
    });
  }, [simActive]);

  const handleStepSim = useCallback(() => {
    setSimRunning(false);
    if (!simActive) {
      setSimActive(true);
    }
    if (!simulatorRef.current) {
      simulatorRef.current = new Simulator(elements, simFrequencyHz, simIntegrationMethod);
    }
    simulatorRef.current.setStatus('paused');
    setSimState(simulatorRef.current.step(1));
  }, [elements, simActive, simFrequencyHz, simIntegrationMethod]);

  const handleResetSim = useCallback(() => {
    setSimRunning(false);
    setSimActive(true);
    if (!simulatorRef.current) {
      simulatorRef.current = new Simulator(elements, simFrequencyHz, simIntegrationMethod);
    }
    simulatorRef.current.setStatus('paused');
    setSimState(simulatorRef.current.reset(elements, simFrequencyHz));
  }, [elements, simFrequencyHz, simIntegrationMethod]);

  const handleLoadStarterCircuit = useCallback(
    (preset: SimPresetId) => {
      const next = createSimStarterCircuit(preset, theme.defaultInk);
      handleElementsChange(next, true);
      setSelectedIds([]);
      setSimActive(true);
      setSimRunning(true);

      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (const el of next) {
        const b = getNormalizedBounds(el);
        minX = Math.min(minX, b.x);
        minY = Math.min(minY, b.y);
        maxX = Math.max(maxX, b.x + b.width);
        maxY = Math.max(maxY, b.y + b.height);
      }
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const padMinX = minX - 48;
      const leftGutter = vw >= 768 ? 272 : 20;
      const rightGutter = vw >= 1024 ? 568 : 20;
      const availW = Math.max(260, vw - leftGutter - rightGutter);
      const availH = Math.max(260, vh - 160);
      const contentW = Math.max(120, maxX - padMinX);
      const contentH = Math.max(120, maxY - minY);
      const zoom = Math.min(0.95, Math.max(0.45, Math.min(availW / contentW, availH / contentH) * 0.92));
      const cx = (padMinX + maxX) / 2;
      const cy = (minY + maxY) / 2;
      const corridorCenterX = leftGutter + availW / 2;
      const corridorCenterY = 82 + availH / 2;
      setCamera({
        zoom,
        x: corridorCenterX - cx * zoom,
        y: corridorCenterY - cy * zoom,
      });
      showToast(`Loaded ${preset.toUpperCase()} simulation circuit`);
    },
    [handleElementsChange, showToast, theme.defaultInk]
  );

  const handleStampPhasorDiagram = useCallback(
    (phasors: PhasorVector[], resultant: { magnitude: number; angleDeg: number }) => {
      const visibleEls = elements.filter((e) => !e.isDeleted);
      let cx = (window.innerWidth / 2 - camera.x) / camera.zoom;
      let cy = (window.innerHeight / 2 - camera.y) / camera.zoom;
      const radius = 135;

      // Place cleanly below existing schematic if any elements already exist on canvas
      if (visibleEls.length > 0) {
        let minX = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;
        for (const el of visibleEls) {
          const b = getNormalizedBounds(el);
          minX = Math.min(minX, b.x);
          maxX = Math.max(maxX, b.x + b.width);
          maxY = Math.max(maxY, b.y + b.height);
        }
        cx = (minX + maxX) / 2;
        cy = maxY + radius + 90;
      }

      const maxVoltage = Math.max(
        1,
        resultant.magnitude,
        ...phasors.filter((p) => p.kind === 'voltage').map((p) => p.magnitude)
      );
      const maxCurrent = Math.max(
        1e-6,
        ...phasors.filter((p) => p.kind === 'current').map((p) => p.magnitude)
      );
      const voltageScale = (radius * 0.86) / maxVoltage;
      const currentScale = (radius * 0.56) / maxCurrent;
      const now = Date.now();
      const baseSeed = Math.floor(Math.random() * 90000);

      const newEls: WhiteboardElement[] = [
        {
          id: `ph_circle_${now}`,
          type: 'ellipse',
          x: cx - radius,
          y: cy - radius,
          width: radius * 2,
          height: radius * 2,
          angle: 0,
          strokeColor: theme.defaultInk,
          backgroundColor: 'transparent',
          fillStyle: 'none',
          strokeWidth: 1.6,
          strokeStyle: 'dashed',
          sloppiness: 1,
          opacity: 75,
          seed: baseSeed + 1,
          fontFamily: defaultStyle.fontFamily,
          fontSize: 16,
          version: 1,
          updatedAt: now,
        },
        {
          id: `ph_axis_x_${now}`,
          type: 'line',
          x: cx - radius - 18,
          y: cy,
          width: (radius + 18) * 2,
          height: 1,
          angle: 0,
          strokeColor: theme.defaultInk,
          backgroundColor: 'transparent',
          fillStyle: 'none',
          strokeWidth: 1.2,
          strokeStyle: 'dotted',
          sloppiness: 0,
          opacity: 55,
          points: [
            { x: 0, y: 0 },
            { x: (radius + 18) * 2, y: 0 },
          ],
          seed: baseSeed + 2,
          fontFamily: 'cleansans',
          fontSize: 14,
          version: 1,
          updatedAt: now,
        },
        {
          id: `ph_axis_y_${now}`,
          type: 'line',
          x: cx,
          y: cy - radius - 18,
          width: 1,
          height: (radius + 18) * 2,
          angle: 0,
          strokeColor: theme.defaultInk,
          backgroundColor: 'transparent',
          fillStyle: 'none',
          strokeWidth: 1.2,
          strokeStyle: 'dotted',
          sloppiness: 0,
          opacity: 55,
          points: [
            { x: 0, y: 0 },
            { x: 0, y: (radius + 18) * 2 },
          ],
          seed: baseSeed + 3,
          fontFamily: 'cleansans',
          fontSize: 14,
          version: 1,
          updatedAt: now,
        },
      ];

      phasors.forEach((p, idx) => {
        const rad = (p.angleDeg * Math.PI) / 180;
        const vecScale = p.kind === 'current' ? currentScale : voltageScale;
        const dx = Math.cos(rad) * p.magnitude * vecScale;
        const dy = -Math.sin(rad) * p.magnitude * vecScale;
        const unitLabel = p.kind === 'current' ? 'A' : 'V';
        const tipText = `${p.label} (${p.magnitude.toFixed(2)}${unitLabel} ∠${p.angleDeg.toFixed(0)}°)`;
        newEls.push({
          id: `ph_vec_${now}_${idx}`,
          type: 'arrow',
          x: cx,
          y: cy,
          width: Math.max(4, Math.abs(dx)),
          height: Math.max(4, Math.abs(dy)),
          angle: 0,
          strokeColor: p.color,
          backgroundColor: 'transparent',
          fillStyle: 'none',
          strokeWidth: 2.8,
          strokeStyle: p.kind === 'current' ? 'dashed' : 'solid',
          sloppiness: 1,
          opacity: 100,
          points: [
            { x: 0, y: 0 },
            { x: dx, y: dy },
          ],
          endArrowhead: true,
          fontFamily: 'cleansans',
          fontSize: 14,
          seed: baseSeed + 10 + idx,
          version: 1,
          updatedAt: now,
        });
        newEls.push({
          id: `ph_lbl_${now}_${idx}`,
          type: 'text',
          x: cx + dx * 1.12 + (dx >= 0 ? 4 : -110),
          y: cy + dy * 1.12 + (dy >= 0 ? 4 : -20),
          width: 130,
          height: 22,
          angle: 0,
          strokeColor: p.color,
          backgroundColor: 'transparent',
          fillStyle: 'none',
          strokeWidth: 1.5,
          strokeStyle: 'solid',
          sloppiness: 0,
          opacity: 100,
          text: tipText,
          fontFamily: 'cleansans',
          fontSize: 13,
          seed: baseSeed + 40 + idx,
          version: 1,
          updatedAt: now,
        });
      });

      if (phasors.filter((p) => p.kind === 'voltage').length > 1 && resultant.magnitude > 0.01) {
        const rRad = (resultant.angleDeg * Math.PI) / 180;
        const rdx = Math.cos(rRad) * resultant.magnitude * voltageScale;
        const rdy = -Math.sin(rRad) * resultant.magnitude * voltageScale;
        newEls.push({
          id: `ph_res_${now}`,
          type: 'arrow',
          x: cx,
          y: cy,
          width: Math.max(4, Math.abs(rdx)),
          height: Math.max(4, Math.abs(rdy)),
          angle: 0,
          strokeColor: '#f59e0b',
          backgroundColor: 'transparent',
          fillStyle: 'none',
          strokeWidth: 3.4,
          strokeStyle: 'dashed',
          sloppiness: 1,
          opacity: 100,
          points: [
            { x: 0, y: 0 },
            { x: rdx, y: rdy },
          ],
          endArrowhead: true,
          fontFamily: 'cleansans',
          fontSize: 15,
          seed: baseSeed + 99,
          version: 1,
          updatedAt: now,
        });
        newEls.push({
          id: `ph_res_lbl_${now}`,
          type: 'text',
          x: cx + rdx * 1.08 + (rdx >= 0 ? 6 : -120),
          y: cy + rdy * 1.08 + 16,
          width: 140,
          height: 22,
          angle: 0,
          strokeColor: '#f59e0b',
          backgroundColor: 'transparent',
          fillStyle: 'none',
          strokeWidth: 1.5,
          strokeStyle: 'solid',
          sloppiness: 0,
          opacity: 100,
          text: `ΣV ${resultant.magnitude.toFixed(2)}V ∠${resultant.angleDeg.toFixed(1)}°`,
          fontFamily: 'cleansans',
          fontSize: 13,
          seed: baseSeed + 100,
          version: 1,
          updatedAt: now,
        });
      }

      handleElementsChange([...elements, ...newEls], true);
      setSelectedIds(newEls.map((e) => e.id));
      setActiveTool('select');
      if (visibleEls.length > 0) {
        setCamera((prev) => ({ ...prev, y: Math.min(prev.y, 40), zoom: 0.72 }));
      }
      showToast('Stamped phasor diagram onto canvas');
    },
    [camera, defaultStyle.fontFamily, elements, handleElementsChange, showToast, theme.defaultInk]
  );

  const handleQuickInsertCircuit = useCallback(
    (kind: CircuitKind) => {
      const spec = CIRCUIT_CATALOG.find((c) => c.kind === kind);
      if (!spec) return;
      const worldCenterX = (window.innerWidth / 2 - camera.x) / camera.zoom;
      const worldCenterY = (window.innerHeight / 2 - camera.y) / camera.zoom;
      const newCircuit: WhiteboardElement = {
        id: `circuit_${Date.now().toString(36)}`,
        type: 'circuit',
        circuitKind: spec.kind,
        componentValue: spec.defaultValue,
        frequencyHz: spec.defaultFrequencyHz,
        waveformType: spec.defaultWaveform,
        switchClosed: spec.kind === 'switch' ? false : undefined,
        logicInputA: isLogicGateKind(spec.kind) ? '0' : undefined,
        logicInputB: isLogicGateKind(spec.kind) && spec.kind !== 'gate-not' ? '0' : undefined,
        icPinCount: spec.kind === 'ic-chip' ? 8 : undefined,
        x: worldCenterX - spec.defaultWidth / 2,
        y: worldCenterY - spec.defaultHeight / 2,
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
      handleElementsChange([...elements, newCircuit], true);
      setSelectedIds([newCircuit.id]);
      setActiveTool('select');
      setPendingCircuitKind(null);
      showToast(`Inserted ${spec.name}`);
    },
    [camera, defaultStyle, elements, handleElementsChange, showToast]
  );

  // Image Stamping Handler
  const handleImageFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      const img = new Image();
      img.onload = () => {
        const maxDim = 380;
        const ratio = Math.min(1, maxDim / Math.max(img.width, img.height));
        const w = Math.round(img.width * ratio);
        const h = Math.round(img.height * ratio);
        const cx = (window.innerWidth / 2 - camera.x) / camera.zoom;
        const cy = (window.innerHeight / 2 - camera.y) / camera.zoom;
        const imgEl: WhiteboardElement = {
          id: `img_${Date.now().toString(36)}`,
          type: 'image',
          x: cx - w / 2,
          y: cy - h / 2,
          width: w,
          height: h,
          angle: 0,
          strokeColor: defaultStyle.strokeColor,
          backgroundColor: 'transparent',
          fillStyle: 'none',
          strokeWidth: 1,
          strokeStyle: 'solid',
          sloppiness: 0,
          opacity: 100,
          seed: Math.floor(Math.random() * 10000),
          fontFamily: 'cleansans',
          fontSize: 16,
          imageDataUrl: dataUrl,
          version: 1,
          updatedAt: Date.now(),
        };
        handleElementsChange([...elements, imgEl], true);
        setSelectedIds([imgEl.id]);
        setActiveTool('select');
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  // .excalidraw / .json Scene Importer
  const handleSceneFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imported = importSceneFromJson(String(reader.result || ''), theme.defaultInk);
        if (imported.themeId && FORGE_THEMES[imported.themeId]) {
          setThemeId(imported.themeId);
        }
        if (imported.canvasThemeId && CANVAS_THEMES[imported.canvasThemeId]) {
          setCanvasThemeId(imported.canvasThemeId);
        }
        handleElementsChange(imported.elements, true);
        setSelectedIds([]);
        showToast(`Imported ${imported.elements.length} elements`);
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Failed to parse file');
      }
    };
    reader.readAsText(file);
  };

  // Global Keyboard Shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (showOpeningScreen) return;
      const target = e.target as HTMLElement | null;
      const isEditingText =
        target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable;

      // App-level zoom shortcuts: Ctrl++ / Ctrl+= zooms in, Ctrl+- zooms out, Ctrl+0 resets
      if (e.ctrlKey || e.metaKey) {
        if (e.key === '+' || e.key === '=' || e.code === 'Equal' || e.code === 'NumpadAdd') {
          e.preventDefault();
          handleZoomBy(1.18);
          return;
        }
        if (e.key === '-' || e.key === '_' || e.code === 'Minus' || e.code === 'NumpadSubtract') {
          e.preventDefault();
          handleZoomBy(0.85);
          return;
        }
        if (e.key === '0' || e.code === 'Digit0' || e.code === 'Numpad0') {
          e.preventDefault();
          setCamera({ x: 0, y: 0, zoom: 1 });
          return;
        }
      }

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        if (showCanvasHub) return;
        e.preventDefault();
        setCommandOpen((o) => !o);
        return;
      }

      if (showCanvasHub) return;

      if (isEditingText) return;

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        handleDuplicateSelected();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        setSelectedIds(elements.filter((el) => !el.isDeleted).map((el) => el.id));
        return;
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedIds.length > 0) {
          e.preventDefault();
          handleDeleteSelected();
        }
        return;
      }

      if (e.key === 'Escape') {
        setPendingCircuitKind(null);
        setSelectedIds([]);
        setInspectedInstrumentId(null);
        setZenMode(false);
        return;
      }

      const keyMap: Record<string, ToolType> = {
        v: 'select',
        '1': 'select',
        h: 'hand',
        r: 'rectangle',
        '2': 'rectangle',
        d: 'diamond',
        '3': 'diamond',
        o: 'ellipse',
        '4': 'ellipse',
        t: 'triangle',
        '5': 'triangle',
        a: 'arrow',
        '6': 'arrow',
        l: 'line',
        '7': 'line',
        w: 'wire',
        p: 'freedraw',
        '8': 'freedraw',
        q: 'laser',
        x: 'text',
        '9': 'text',
        f: 'frame',
        g: 'webpage',
        m: 'math',
        e: 'eraser',
      };
      const mapped = keyMap[e.key.toLowerCase()];
      if (mapped && !e.metaKey && !e.ctrlKey && !e.altKey) {
        setPendingCircuitKind(null);
        setActiveTool(mapped);
      } else if (e.key.toLowerCase() === 'i' && !e.metaKey && !e.ctrlKey) {
        imageInputRef.current?.click();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    elements,
    handleDeleteSelected,
    handleDuplicateSelected,
    handleRedo,
    handleUndo,
    handleZoomBy,
    selectedIds.length,
    showCanvasHub,
    showOpeningScreen,
  ]);

  // Global Alt+Tab canvas switcher while actively editing inside a 2D canvas
  const workspaceSwitcherRef = useRef({ open: false, index: 0 });
  workspaceSwitcherRef.current.open = workspaceSwitcherOpen;
  workspaceSwitcherRef.current.index = workspaceSwitcherIndex;

  useEffect(() => {
    if (showCanvasHub || showOpeningScreen || hubCanvases.length === 0) {
      setWorkspaceSwitcherOpen(false);
      return;
    }

    const onAltTabKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && (e.code === 'Tab' || e.key === 'Tab')) {
        e.preventDefault();
        e.stopPropagation();
        const curr = workspaceSwitcherRef.current;
        const baseIdx = curr.open
          ? curr.index
          : Math.max(0, hubCanvases.findIndex((c) => c.id === activeCanvasId));
        const delta = e.shiftKey ? -1 : 1;
        const nextIdx = (baseIdx + delta + hubCanvases.length) % hubCanvases.length;
        workspaceSwitcherRef.current.open = true;
        workspaceSwitcherRef.current.index = nextIdx;
        setWorkspaceSwitcherIndex(nextIdx);
        setWorkspaceSwitcherOpen(true);
      } else if (e.key === 'Escape' && workspaceSwitcherRef.current.open) {
        workspaceSwitcherRef.current.open = false;
        setWorkspaceSwitcherOpen(false);
      }
    };

    const onAltRelease = (e: KeyboardEvent) => {
      if (
        (e.key === 'Alt' || e.code === 'AltLeft' || e.code === 'AltRight') &&
        workspaceSwitcherRef.current.open
      ) {
        const picked = hubCanvases[workspaceSwitcherRef.current.index];
        workspaceSwitcherRef.current.open = false;
        setWorkspaceSwitcherOpen(false);
        if (picked && picked.id !== activeCanvasId) {
          if (activeCanvasId) {
            syncActiveCanvasIntoHub(elements, camera, activeCanvasId, canvasThemeId);
          }
          handleOpenCanvasFromHub(picked.id);
        }
      }
    };

    const onWinBlur = () => {
      workspaceSwitcherRef.current.open = false;
      setWorkspaceSwitcherOpen(false);
    };

    window.addEventListener('keydown', onAltTabKeyDown, { capture: true });
    window.addEventListener('keyup', onAltRelease);
    window.addEventListener('blur', onWinBlur);
    return () => {
      window.removeEventListener('keydown', onAltTabKeyDown, { capture: true });
      window.removeEventListener('keyup', onAltRelease);
      window.removeEventListener('blur', onWinBlur);
    };
  }, [
    activeCanvasId,
    camera,
    canvasThemeId,
    elements,
    handleOpenCanvasFromHub,
    hubCanvases,
    showCanvasHub,
    showOpeningScreen,
    syncActiveCanvasIntoHub,
  ]);

  const activeCanvasRecord = useMemo(
    () => hubCanvases.find((c) => c.id === activeCanvasId) || null,
    [activeCanvasId, hubCanvases]
  );

  const commands: CommandItem[] = useMemo(
    () => [
      {
        id: 'hub',
        label: 'Open 3D Universal Canvas Hub',
        category: 'Workspace',
        action: handleOpenHubFromWorkspace,
      },
      { id: 'export', label: 'Export PNG / SVG / .excalidraw', category: 'File', action: () => setExportOpen(true) },
      { id: 'import', label: 'Open .excalidraw or .json file', category: 'File', action: () => sceneFileInputRef.current?.click() },
      { id: 'collab', label: 'End-to-End Encrypted Collaboration', category: 'Share', action: () => setCollabModalOpen(true) },
      { id: 'circuits', label: 'Toggle Circuit Components Drawer', category: 'Engineering', action: () => { setSimPanelOpen(false); setMathOpen(false); setCircuitsOpen((o) => !o); } },
      { id: 'math', label: 'Open Smart Mathematics Engine (Algebra / Calculus / 2D & 3D)', category: 'Mathematics', action: () => { setCircuitsOpen(false); setSimPanelOpen(false); setMathOpen((o) => !o); } },
      { id: 'fgen', label: 'Insert Function Generator (Sine / Triangle / Square)', category: 'Engineering', action: () => handleQuickInsertCircuit('function-generator') },
      { id: 'switch', label: 'Insert SPST Toggle Switch', category: 'Engineering', action: () => handleQuickInsertCircuit('switch') },
      {
        id: 'webpage',
        label: 'Create Webpage Block (HTML / CSS / JS)',
        category: 'Web Studio',
        action: () => {
          const cx = (window.innerWidth / 2 - camera.x) / camera.zoom;
          const cy = (window.innerHeight / 2 - camera.y) / camera.zoom;
          const wp: WhiteboardElement = {
            id: `webpage_${Date.now().toString(36)}`,
            type: 'webpage',
            x: cx - 230,
            y: cy - 170,
            width: 460,
            height: 340,
            angle: 0,
            strokeColor: defaultStyle.strokeColor,
            backgroundColor: defaultStyle.backgroundColor,
            fillStyle: defaultStyle.fillStyle,
            strokeWidth: 2,
            strokeStyle: 'solid',
            sloppiness: 0,
            opacity: 100,
            seed: Math.floor(Math.random() * 100000),
            fontFamily: 'cleansans',
            fontSize: 16,
            webpageTitle: 'index.html',
            htmlCode: '',
            cssCode: '',
            jsCode: '',
            webpageAutoPolish: false,
            version: 1,
            updatedAt: Date.now(),
          };
          handleElementsChange([...elements, wp], true);
          setSelectedIds([wp.id]);
          setActiveTool('select');
          showToast('Placed webpage box — click it to write HTML, CSS & JS');
        },
      },
      { id: 'simulate', label: 'Open Circuit Simulator, Scope & Phasor Lab', category: 'Engineering', action: () => { setCircuitsOpen(false); setSimPanelOpen(true); setSimActive(true); setSimRunning(true); } },
      { id: 'present', label: 'Start Slide Presentation', category: 'View', action: () => frames.length > 0 && navigateToFrame(0) },
      { id: 'themes', label: 'Switch Interface & Canvas Theme (22+)', category: 'Appearance', action: () => setThemeModalOpen(true) },
      { id: 'laser', label: 'Activate Laser Pointer (Q)', category: 'Tools', action: () => { setPendingCircuitKind(null); setActiveTool('laser'); } },
      { id: 'fonts', label: 'Technical Typography Showcase', category: 'Appearance', action: () => setFontModalOpen(true) },
      { id: 'rust', label: 'Inspect Rust & WASM Core Architecture', category: 'Developer', action: () => setRustModalOpen(true) },
      { id: 'grid', label: `Toggle Canvas Grid (${showGrid ? 'On' : 'Off'})`, category: 'View', action: () => setShowGrid((g) => !g) },
      { id: 'snap', label: `Toggle Freehand Shape Recognition (${shapeSnapEnabled ? 'On' : 'Off'})`, category: 'Tools', action: () => setShapeSnapEnabled((s) => !s) },
      { id: 'fit', label: 'Zoom to Fit All Elements', category: 'View', action: handleFitToScreen },
      { id: 'zen', label: 'Toggle Zen Mode', category: 'View', action: () => setZenMode((z) => !z) },
      {
        id: 'demo',
        label: 'Load Demo Circuit Schematic',
        category: 'Engineering',
        action: () => {
          handleElementsChange(createDemoCircuitPreset(theme.defaultInk), true);
          showToast('Loaded demo circuit schematic');
        },
      },
      {
        id: 'clear',
        label: 'Clear Canvas',
        category: 'File',
        action: () => {
          handleElementsChange([], true);
          setSelectedIds([]);
        },
      },
    ],
    [
      camera.x,
      camera.y,
      camera.zoom,
      defaultStyle,
      elements,
      frames.length,
      handleElementsChange,
      handleFitToScreen,
      handleQuickInsertCircuit,
      navigateToFrame,
      shapeSnapEnabled,
      showGrid,
      showToast,
      theme.defaultInk,
    ]
  );

  const selectedCodeInfo = useMemo(() => {
    if (selectedElements.length === 0) return null;
    if (!selectedElements.every((el) => el.type === 'text' && (el.text || '').trim().length > 0)) {
      return null;
    }
    const sorted = [...selectedElements].sort((a, b) => (a.y !== b.y ? a.y - b.y : a.x - b.x));
    const code = sorted.map((el) => el.text || '').join('\n');
    const detected = detectCodeLanguage(code);
    if (!detected) return null;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const el of sorted) {
      const b = getNormalizedBounds(el);
      minX = Math.min(minX, b.x);
      minY = Math.min(minY, b.y);
      maxX = Math.max(maxX, b.x + b.width);
      maxY = Math.max(maxY, b.y + b.height);
    }

    return {
      key: sorted.map((e) => `${e.id}:${e.version}`).join('|'),
      code,
      detectedLanguage: detected,
      idSet: new Set(sorted.map((e) => e.id)),
      anchorRect: {
        x: camera.x + minX * camera.zoom,
        y: camera.y + minY * camera.zoom,
        width: Math.max(80, (maxX - minX) * camera.zoom),
        height: Math.max(32, (maxY - minY) * camera.zoom),
      },
    };
  }, [camera.x, camera.y, camera.zoom, selectedElements]);

  const selectedCodeKey = selectedCodeInfo?.key || '';
  useEffect(() => {
    setCodeRunResult(null);
    setCodeLangOverride(null);
  }, [selectedCodeKey]);

  const activeCodeLanguage = codeLangOverride || selectedCodeInfo?.detectedLanguage || 'python';

  const handleExecuteSelectedCode = useCallback(
    async (mode: 'compile' | 'run') => {
      if (!selectedCodeInfo) return;
      const started = performance.now();
      const runtimeLabel = CODE_LANGUAGE_LABELS[activeCodeLanguage] || activeCodeLanguage;
      setCodeRunning(true);
      try {
        const response = await fetch('/api/run', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            language: activeCodeLanguage,
            code: selectedCodeInfo.code,
            input: codeStdin,
          }),
        });

        const rawText = await response.text();
        let parsed: Record<string, unknown> | null = null;
        if (rawText.trim()) {
          try {
            parsed = JSON.parse(rawText) as Record<string, unknown>;
          } catch {
            parsed = null;
          }
        }

        const elapsedMs = Math.max(1, Math.round(performance.now() - started));

        if (!response.ok) {
          const readableError =
            (parsed && typeof parsed.error === 'string' && parsed.error.trim()) ||
            (parsed && typeof parsed.message === 'string' && parsed.message.trim()) ||
            rawText
              .replace(/<[^>]+>/g, ' ')
              .replace(/\s+/g, ' ')
              .trim()
              .slice(0, 280) ||
            `Server returned HTTP ${response.status}${response.statusText ? ` (${response.statusText})` : ''}`;
          const exitCode =
            parsed && typeof parsed.exit_code === 'number' ? parsed.exit_code : 1;

          setCodeRunResult({
            ok: false,
            language: activeCodeLanguage,
            mode,
            compiled: false,
            compileMessage: '',
            stdout: '',
            stderr: readableError,
            exitCode,
            durationMs: elapsedMs,
            timeLabel: `${elapsedMs}ms`,
            runtimeLabel,
          });
          return;
        }

        if (!parsed) {
          setCodeRunResult({
            ok: false,
            language: activeCodeLanguage,
            mode,
            compiled: false,
            compileMessage: '',
            stdout: '',
            stderr:
              rawText.trim().slice(0, 280) ||
              'Execution server returned a non-JSON response.',
            exitCode: 1,
            durationMs: elapsedMs,
            timeLabel: `${elapsedMs}ms`,
            runtimeLabel,
          });
          return;
        }

        const outputText = typeof parsed.output === 'string' ? parsed.output : '';
        const errorText = typeof parsed.error === 'string' ? parsed.error : '';
        const statusText = typeof parsed.status === 'string' ? parsed.status : '';
        const exitCode =
          typeof parsed.exit_code === 'number'
            ? parsed.exit_code
            : Number.isFinite(Number(parsed.exit_code)) && parsed.exit_code !== null && parsed.exit_code !== undefined
            ? Number(parsed.exit_code)
            : 0;

        let timeLabel = `${elapsedMs}ms`;
        if (typeof parsed.time === 'number' && Number.isFinite(parsed.time)) {
          timeLabel = `${parsed.time}s`;
        } else if (typeof parsed.time === 'string' && parsed.time.trim()) {
          const rawTime = parsed.time.trim();
          timeLabel = /^\d+(\.\d+)?$/.test(rawTime) ? `${rawTime}s` : rawTime;
        }

        const hasError = Boolean(errorText.trim()) || exitCode !== 0;

        setCodeRunResult({
          ok: !hasError,
          language: activeCodeLanguage,
          mode,
          compiled: exitCode === 0,
          compileMessage: !hasError && mode === 'compile' ? statusText || 'Compiled cleanly' : '',
          stdout: outputText,
          stderr: hasError ? errorText || statusText || `Process exited with code ${exitCode}` : '',
          exitCode,
          durationMs: elapsedMs,
          timeLabel,
          statusText,
          runtimeLabel,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Network error running code';
        const elapsedMs = Math.max(1, Math.round(performance.now() - started));
        setCodeRunResult({
          ok: false,
          language: activeCodeLanguage,
          mode,
          compiled: false,
          compileMessage: '',
          stdout: '',
          stderr: msg,
          exitCode: 1,
          durationMs: elapsedMs,
          timeLabel: `${elapsedMs}ms`,
          runtimeLabel,
        });
      } finally {
        setCodeRunning(false);
      }
    },
    [activeCodeLanguage, codeStdin, selectedCodeInfo]
  );

  const activeCount = elements.filter((e) => !e.isDeleted).length;
  const peerCount = Object.keys(collab.peers).length;

  const croWaveforms = useMemo(() => {
    if (!simActive || !simState?.ok) return undefined;
    const map: Record<string, { samples: number[]; connected: boolean }> = {};
    for (const comp of simState.components) {
      if (comp.kind !== 'oscilloscope') continue;
      const ch = getCroProbeWaveform(simState, comp.elementId);
      map[comp.elementId] = {
        samples: ch?.samples || [],
        connected: Boolean(ch && comp.probesConnected),
      };
    }
    return map;
  }, [simActive, simState]);

  return (
    <div
      data-testid="rustly-forge-app"
      data-theme={themeId}
      data-canvas-theme={canvasThemeId}
      className="relative w-screen h-screen overflow-hidden select-none"
    >
      {showOpeningScreen && (
        <OpeningScreen onContinue={() => navigateRoute('hub')} />
      )}
      {showCanvasHub && (
        <CanvasHub3D
          canvases={hubCanvases}
          activeCanvasId={activeCanvasId}
          onOpenCanvas={handleOpenCanvasFromHub}
          onCreateBlankCanvas={handleCreateBlankHubCanvas}
          onRenameCanvas={handleRenameHubCanvas}
          onUpdateCanvasPosition={handleUpdateCanvasPosition}
          onAutoArrange={handleAutoArrangeCanvases}
          onDeleteCanvas={handleDeleteHubCanvas}
          onBackToSplash={() => navigateRoute('splash')}
        />
      )}

      {/* Hidden File Inputs */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleImageFileSelected}
      />
      <input
        ref={sceneFileInputRef}
        type="file"
        accept=".excalidraw,.json,application/json"
        className="hidden"
        onChange={handleSceneFileSelected}
      />

      {/* Full-Viewport Interactive Canvas */}
      <Canvas
        elements={elements}
        selectedIds={selectedIds}
        activeTool={activeTool}
        pendingCircuitKind={pendingCircuitKind}
        camera={camera}
        theme={theme}
        showGrid={showGrid}
        shapeSnapEnabled={shapeSnapEnabled}
        remoteCursors={collab.peers}
        liveReadouts={simActive ? simState?.liveReadouts : undefined}
        wireVoltages={simActive ? simState?.wireVoltages : undefined}
        croWaveforms={croWaveforms}
        logicResults={digitalReport.gateMap}
        simActive={simActive}
        selectedCodeIds={selectedCodeInfo?.idSet}
        defaultStyle={defaultStyle}
        onCameraChange={setCamera}
        onSelectIds={setSelectedIds}
        onElementsChange={handleElementsChange}
        onToolComplete={(next) => {
          setPendingCircuitKind(null);
          if (next) setActiveTool(next);
        }}
        onInstrumentClick={(elementId) => {
          const clicked = elements.find((el) => !el.isDeleted && el.id === elementId);
          setInspectedInstrumentId(elementId);
          if (clicked && !isLogicGateKind(clicked.circuitKind) && !simActive) {
            setSimActive(true);
            setSimRunning(true);
          }
        }}
        onSwitchToggle={handleSwitchToggle}
        onWebpageClick={(elementId) => setEditingWebpageId(elementId)}
        onCursorMove={handleCursorMove}
        onStatusToast={showToast}
        onRotateSelected={handleRotateSelected}
        onResetRotationSelected={handleResetRotationSelected}
        onDuplicateSelected={handleDuplicateSelected}
        onDeleteSelected={handleDeleteSelected}
        onLayerChange={handleLayerChange}
        onSelectAll={() => setSelectedIds(elements.filter((el) => !el.isDeleted).map((el) => el.id))}
        onFitToScreen={handleFitToScreen}
        onResetZoom={() => setCamera({ x: 0, y: 0, zoom: 1 })}
        onSelectTool={(tool) => {
          setPendingCircuitKind(null);
          setActiveTool(tool);
        }}
        onUpdateElementById={handleUpdateElementById}
        onOpenMathStudio={handleOpenMathStudio}
        onPlotEquation2D={handlePlotEquation2D}
        onPlotEquation3D={handlePlotEquation3D}
        onQuickMathAction={handleQuickMathAction}
      />

      {/* Desktop Top HUD Bar (hidden on mobile <768px where MobileWorkspaceHUD renders) */}
      {!zenMode && presentationIndex === null && (
        <header className="hidden md:flex pointer-events-none fixed top-3 left-3 right-3 z-30 items-center justify-between gap-4">
          <div className="pointer-events-auto shrink-0">
            <MainMenu
              showGrid={showGrid}
              shapeSnapEnabled={shapeSnapEnabled}
              locale={locale}
              t={t}
              onToggleGrid={() => setShowGrid((g) => !g)}
              onToggleShapeSnap={() => setShapeSnapEnabled((s) => !s)}
              onChangeLocale={setLocale}
              onOpenFileImport={() => sceneFileInputRef.current?.click()}
              onOpenExport={() => setExportOpen(true)}
              onOpenThemes={() => setThemeModalOpen(true)}
              onOpenFonts={() => setFontModalOpen(true)}
              onOpenRustCode={() => setRustModalOpen(true)}
              onOpenCommandPalette={() => setCommandOpen(true)}
              onToggleZenMode={() => setZenMode(true)}
              onLoadDemoCircuit={() => {
                handleElementsChange(createDemoCircuitPreset(theme.defaultInk), true);
                showToast('Loaded demo circuit schematic');
              }}
              onClearCanvas={() => {
                handleElementsChange([], true);
                setSelectedIds([]);
              }}
              onOpenCanvasHub={handleOpenHubFromWorkspace}
              activeCanvasTitle={activeCanvasRecord?.title}
              onRenameActiveCanvas={(nextTitle) => {
                if (activeCanvasId) handleRenameHubCanvas(activeCanvasId, nextTitle);
              }}
            />
          </div>

          <div className="pointer-events-auto">
            <Toolbar
              activeTool={activeTool}
              onSelectTool={(tool) => {
                setPendingCircuitKind(null);
                setActiveTool(tool);
              }}
              onTriggerImageUpload={() => imageInputRef.current?.click()}
              t={t}
            />
          </div>

          <div className="pointer-events-auto flex items-center gap-2 shrink-0">
            <button
              type="button"
              aria-label={t.actions.circuits}
              aria-pressed={circuitsOpen}
              onClick={() => {
                setCircuitsOpen((o) => {
                  if (!o) {
                    setSimPanelOpen(false);
                    setMathOpen(false);
                  }
                  return !o;
                });
              }}
              className={`rf-panel flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                circuitsOpen
                  ? 'bg-[var(--rf-accent)] text-[var(--rf-accent-fg)] border-transparent'
                  : 'text-[var(--rf-text)] hover:bg-[var(--rf-surface-hover)]'
              }`}
              style={
                circuitsOpen
                  ? { backgroundColor: 'var(--rf-accent)', color: 'var(--rf-accent-fg)' }
                  : undefined
              }
            >
              <Cpu className="w-4 h-4" />
              <span className="hidden lg:inline">{t.actions.circuits}</span>
            </button>

            <button
              type="button"
              data-testid="toggle-math-studio"
              aria-label={t.actions.mathEngine}
              aria-pressed={mathOpen}
              onClick={() => {
                setMathOpen((o) => {
                  if (!o) {
                    setCircuitsOpen(false);
                    setSimPanelOpen(false);
                  }
                  return !o;
                });
              }}
              className={`rf-panel flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                mathOpen
                  ? 'bg-[var(--rf-accent)] text-[var(--rf-accent-fg)] border-transparent'
                  : 'text-[var(--rf-text)] hover:bg-[var(--rf-surface-hover)]'
              }`}
              style={
                mathOpen
                  ? { backgroundColor: 'var(--rf-accent)', color: 'var(--rf-accent-fg)' }
                  : undefined
              }
            >
              <Sigma className="w-4 h-4" />
              <span className="hidden lg:inline">{t.actions.mathEngine}</span>
            </button>

            <button
              type="button"
              aria-label="Simulate"
              aria-pressed={simPanelOpen}
              onClick={() => {
                setSimPanelOpen((o) => {
                  if (!o) {
                    setCircuitsOpen(false);
                    setMathOpen(false);
                    setSimActive(true);
                    setSimRunning(true);
                  }
                  return !o;
                });
              }}
              className={`rf-panel flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                simPanelOpen || simActive
                  ? 'border-emerald-500/50 text-emerald-400'
                  : 'text-[var(--rf-text)] hover:bg-[var(--rf-surface-hover)]'
              }`}
              style={
                simPanelOpen
                  ? { backgroundColor: '#059669', color: '#ffffff' }
                  : undefined
              }
            >
              <Activity className="w-4 h-4" />
              <span className="hidden lg:inline">Simulate</span>
            </button>

            {frames.length > 0 && (
              <button
                type="button"
                aria-label={t.actions.present}
                onClick={() => navigateToFrame(0)}
                className="rf-panel hidden lg:flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-[var(--rf-text)] hover:bg-[var(--rf-surface-hover)] whitespace-nowrap shrink-0"
              >
                <Presentation className="w-4 h-4" />
                <span>{t.actions.present}</span>
              </button>
            )}

            <button
              type="button"
              aria-label={t.actions.export}
              onClick={() => setExportOpen(true)}
              className="rf-panel flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-[var(--rf-text)] hover:bg-[var(--rf-surface-hover)] whitespace-nowrap shrink-0"
            >
              <Download className="w-4 h-4" />
              <span className="hidden xl:inline">{t.actions.export}</span>
            </button>

            <button
              type="button"
              aria-label={t.actions.collaborate}
              onClick={() => setCollabModalOpen(true)}
              style={
                collab.roomId
                  ? { backgroundColor: '#059669', color: '#ffffff' }
                  : { backgroundColor: 'var(--rf-accent)', color: 'var(--rf-accent-fg)' }
              }
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold shadow-sm hover:opacity-95 whitespace-nowrap shrink-0"
            >
              {collab.roomId ? <Lock className="w-3.5 h-3.5" /> : <Users className="w-3.5 h-3.5" />}
              <span className="hidden xl:inline">
                {collab.roomId ? `E2EE (${peerCount + 1})` : t.actions.collaborate}
              </span>
            </button>
          </div>
        </header>
      )}

      {/* Mobile HUD (<768px): Sticky Header, Top Drawing Pill, Bottom Nav, Corner Zoom & Draggable Properties Sheet */}
      {!zenMode && presentationIndex === null && (
        <MobileWorkspaceHUD
          theme={theme}
          locale={locale}
          t={t}
          activeTool={activeTool}
          camera={camera}
          showGrid={showGrid}
          shapeSnapEnabled={shapeSnapEnabled}
          canUndo={canUndo}
          canRedo={canRedo}
          circuitsOpen={circuitsOpen}
          mathOpen={mathOpen}
          simPanelOpen={simPanelOpen}
          simActive={simActive}
          hasFrames={frames.length > 0}
          collabRoomId={collab.roomId}
          peerCount={peerCount}
          selectedElements={selectedElements}
          digitalReport={digitalReport}
          defaultStyle={defaultStyle}
          onSelectTool={(tool) => {
            setPendingCircuitKind(null);
            setActiveTool(tool);
          }}
          onTriggerImageUpload={() => imageInputRef.current?.click()}
          onUndo={handleUndo}
          onRedo={handleRedo}
          onZoomBy={handleZoomBy}
          onResetZoom={() => setCamera({ x: 0, y: 0, zoom: 1 })}
          onFitToScreen={handleFitToScreen}
          onToggleCircuits={() => {
            setCircuitsOpen((o) => {
              if (!o) {
                setSimPanelOpen(false);
                setMathOpen(false);
              }
              return !o;
            });
          }}
          onToggleMath={() => {
            setMathOpen((o) => {
              if (!o) {
                setCircuitsOpen(false);
                setSimPanelOpen(false);
              }
              return !o;
            });
          }}
          onToggleSimulate={() => {
            setSimPanelOpen((o) => {
              if (!o) {
                setCircuitsOpen(false);
                setMathOpen(false);
                setSimActive(true);
                setSimRunning(true);
              }
              return !o;
            });
          }}
          onStartPresentation={() => navigateToFrame(0)}
          onOpenExport={() => setExportOpen(true)}
          onOpenCollab={() => setCollabModalOpen(true)}
          onOpenThemes={() => setThemeModalOpen(true)}
          onOpenFonts={() => setFontModalOpen(true)}
          onOpenRustCode={() => setRustModalOpen(true)}
          onOpenCommandPalette={() => setCommandOpen(true)}
          onOpenFileImport={() => sceneFileInputRef.current?.click()}
          onToggleGrid={() => setShowGrid((g) => !g)}
          onToggleShapeSnap={() => setShapeSnapEnabled((s) => !s)}
          onChangeLocale={setLocale}
          onToggleZenMode={() => setZenMode(true)}
          onLoadDemoCircuit={() => {
            handleElementsChange(createDemoCircuitPreset(theme.defaultInk), true);
            showToast('Loaded demo circuit schematic');
          }}
          onClearCanvas={() => {
            handleElementsChange([], true);
            setSelectedIds([]);
          }}
          onQuickInsertWebpage={handleQuickInsertWebpage}
          onQuickInsertFrame={handleQuickInsertFrame}
          onUpdateStyle={(patch) => setDefaultStyle((prev) => ({ ...prev, ...patch }))}
          onUpdateSelected={handleUpdateSelected}
          onDuplicateSelected={handleDuplicateSelected}
          onDeleteSelected={handleDeleteSelected}
          onLayerChange={handleLayerChange}
          onInspectInstrument={(id) => {
            const target = elements.find((el) => !el.isDeleted && el.id === id);
            if (target && !isLogicGateKind(target.circuitKind)) {
              if (!simActive) setSimActive(true);
              if (!simRunning) setSimRunning(true);
            }
            setInspectedInstrumentId(id);
          }}
          onInspectWebpage={(id) => setEditingWebpageId(id)}
          onAutoAssignLogicLetters={handleAutoAssignLogicLetters}
          onOpenMathStudio={handleOpenMathStudio}
          onOpenCanvasHub={handleOpenHubFromWorkspace}
          activeCanvasTitle={activeCanvasRecord?.title}
        />
      )}

      {/* Intelligent Auto-Hiding Left Properties Inspector (Desktop >=768px) */}
      {!zenMode && presentationIndex === null && (
        <>
          {/* Subtle left-edge hover trigger strip + visual tab when panel is collapsed */}
          <div
            data-testid="side-panel-edge-trigger"
            onMouseEnter={handleSidePanelEnter}
            onMouseLeave={handleSidePanelLeave}
            className="hidden md:flex fixed left-0 top-20 bottom-20 w-4 z-20 items-center"
          >
            {!showDesktopSidePanel && (
              <button
                type="button"
                aria-label="Show style properties panel"
                title="Hover or click to show style properties"
                onClick={handleSidePanelEnter}
                className="rf-panel ml-1.5 px-1 py-2.5 rounded-lg flex flex-col items-center gap-1 text-[10px] font-semibold text-[var(--rf-text-muted)] hover:text-[var(--rf-text)] transition-opacity"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-[var(--rf-accent)]" />
              </button>
            )}
          </div>

          <div
            data-testid="desktop-side-panel-container"
            data-visible={showDesktopSidePanel ? 'true' : 'false'}
            onMouseEnter={handleSidePanelEnter}
            onMouseLeave={handleSidePanelLeave}
            className={`hidden md:block fixed left-3 top-16 z-20 rf-side-panel-transition ${
              showDesktopSidePanel
                ? 'translate-x-0 opacity-100 pointer-events-auto'
                : '-translate-x-[calc(100%+20px)] opacity-0 pointer-events-none'
            }`}
          >
            <PropertiesPanel
              theme={theme}
              selectedElements={selectedElements}
              digitalReport={digitalReport}
              defaultStyle={defaultStyle}
              onUpdateStyle={(patch) => setDefaultStyle((prev) => ({ ...prev, ...patch }))}
              onUpdateSelected={handleUpdateSelected}
              onDuplicateSelected={handleDuplicateSelected}
              onDeleteSelected={handleDeleteSelected}
              onLayerChange={handleLayerChange}
              onInspectInstrument={(id) => {
                const target = elements.find((el) => !el.isDeleted && el.id === id);
                if (target && !isLogicGateKind(target.circuitKind)) {
                  if (!simActive) setSimActive(true);
                  if (!simRunning) setSimRunning(true);
                }
                setInspectedInstrumentId(id);
              }}
              onInspectWebpage={(id) => setEditingWebpageId(id)}
              onAutoAssignLogicLetters={handleAutoAssignLogicLetters}
              onOpenMathStudio={handleOpenMathStudio}
              onInteractionLockChange={setSidePanelLocked}
              t={t}
            />
          </div>
        </>
      )}

      {/* Right Collapsible Engineering Component Drawer & Circuit Simulator */}
      {!zenMode && presentationIndex === null && (
        <div className="fixed right-2 md:right-3 top-[106px] md:top-16 z-30 md:z-20">
          <EngineeringSidebar
            open={circuitsOpen}
            pendingCircuitKind={pendingCircuitKind}
            onSelectCircuit={(kind) => {
              setPendingCircuitKind(kind);
              setActiveTool('select');
            }}
            onQuickInsertCircuit={handleQuickInsertCircuit}
            onClose={() => {
              setCircuitsOpen(false);
              setPendingCircuitKind(null);
            }}
          />
          <SimulationPanel
            open={simPanelOpen}
            simActive={simActive}
            simRunning={simRunning}
            simSpeed={simSpeed}
            frequencyHz={simFrequencyHz}
            integrationMethod={simIntegrationMethod}
            elements={elements}
            simState={simState}
            digitalReport={digitalReport}
            onToggleRunning={handleToggleRunning}
            onStepSim={handleStepSim}
            onResetSim={handleResetSim}
            onChangeSpeed={(spd) => {
              setSimSpeed(spd);
              simulatorRef.current?.setTimeScale(spd);
            }}
            onChangeFrequency={(hz) => {
              setSimFrequencyHz(hz);
              const hasAcSources = elements.some(
                (el) =>
                  !el.isDeleted &&
                  el.type === 'circuit' &&
                  (el.circuitKind === 'ac-source' || el.circuitKind === 'function-generator')
              );
              if (hasAcSources) {
                const next = elements.map((el) =>
                  !el.isDeleted &&
                  el.type === 'circuit' &&
                  (el.circuitKind === 'ac-source' || el.circuitKind === 'function-generator')
                    ? { ...el, frequencyHz: hz, version: el.version + 1, updatedAt: Date.now() }
                    : el
                );
                handleElementsChange(next, false);
              }
            }}
            onChangeIntegrationMethod={(method) => {
              setSimIntegrationMethod(method);
              if (simulatorRef.current) {
                setSimState(simulatorRef.current.setIntegrationMethod(method));
              }
            }}
            onUpdateElement={handleUpdateElementById}
            onAutoAssignLogicLetters={handleAutoAssignLogicLetters}
            onResetLogicBinary={handleResetLogicBinary}
            onLoadStarterCircuit={handleLoadStarterCircuit}
            onStampPhasorDiagram={handleStampPhasorDiagram}
            onClose={() => {
              setSimPanelOpen(false);
              setSimRunning(false);
            }}
          />
          <MathWorkspacePanel
            open={mathOpen}
            activeTab={mathTab}
            onChangeTab={setMathTab}
            selectedElements={selectedElements}
            theme={theme}
            onStampEquation={handleStampEquation}
            onStampMatrix={handleStampMatrix}
            onStampGraph2D={handleStampGraph2D}
            onStampGraph3D={handleStampGraph3D}
            onUpdateElement={(id, patch) => handleUpdateElementById(id, patch, true)}
            onShowToast={showToast}
            onClose={() => setMathOpen(false)}
          />
        </div>
      )}

      {/* Floating Code Selector Bar & Instant Output Box (only visible while code text is selected) */}
      {!zenMode && presentationIndex === null && selectedCodeInfo && (
        <CodeRunnerBar
          visible={Boolean(selectedCodeInfo)}
          anchorRect={selectedCodeInfo.anchorRect}
          selectedLanguage={activeCodeLanguage}
          onChangeLanguage={(lang) => {
            setCodeLangOverride(lang);
            setCodeRunResult(null);
          }}
          stdinValue={codeStdin}
          onChangeStdin={setCodeStdin}
          running={codeRunning}
          result={codeRunResult}
          onCompile={() => handleExecuteSelectedCode('compile')}
          onCompileAndRun={() => handleExecuteSelectedCode('run')}
          onClearOutput={() => setCodeRunResult(null)}
        />
      )}

      {/* Interactive Instrument Reading / CRO / Function Generator / Logic Gate Popup */}
      {!zenMode && presentationIndex === null && (
        <InstrumentInspectorModal
          element={
            elements.find((e) => !e.isDeleted && e.id === inspectedInstrumentId) || null
          }
          simState={simState}
          digitalReport={digitalReport}
          simRunning={simRunning}
          simSpeed={simSpeed}
          onUpdateElement={handleUpdateElementById}
          onAutoAssignLogicLetters={handleAutoAssignLogicLetters}
          onToggleRunning={handleToggleRunning}
          onStepSim={handleStepSim}
          onResetSim={handleResetSim}
          onChangeSpeed={(spd) => {
            setSimSpeed(spd);
            simulatorRef.current?.setTimeScale(spd);
          }}
          onOpenFullSimulator={() => {
            setInspectedInstrumentId(null);
            setCircuitsOpen(false);
            setSimPanelOpen(true);
          }}
          onClose={() => setInspectedInstrumentId(null)}
        />
      )}

      {/* Webpage Block HTML / CSS / JS Studio Modal */}
      {!zenMode && presentationIndex === null && (
        <WebpageBlockModal
          element={
            elements.find((e) => !e.isDeleted && e.id === editingWebpageId) || null
          }
          onUpdateElement={handleUpdateElementById}
          onClose={() => setEditingWebpageId(null)}
        />
      )}

      {/* Desktop Bottom-Left History & Zoom Controls */}
      {!zenMode && presentationIndex === null && (
        <div className="hidden md:flex fixed bottom-3 left-3 z-20 items-center gap-2">
          <div className="rf-panel flex items-center gap-1 p-1 rounded-xl">
            <button
              type="button"
              aria-label={t.actions.undo}
              title={`${t.actions.undo} (Ctrl+Z)`}
              disabled={!canUndo}
              onClick={handleUndo}
              className="p-2 rounded-lg text-[var(--rf-text)] hover:bg-[var(--rf-surface-hover)] disabled:opacity-35"
            >
              <Undo2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              aria-label={t.actions.redo}
              title={`${t.actions.redo} (Ctrl+Y)`}
              disabled={!canRedo}
              onClick={handleRedo}
              className="p-2 rounded-lg text-[var(--rf-text)] hover:bg-[var(--rf-surface-hover)] disabled:opacity-35"
            >
              <Redo2 className="w-4 h-4" />
            </button>
          </div>

          <div className="rf-panel flex items-center gap-1 p-1 rounded-xl text-xs">
            <button
              type="button"
              aria-label="Zoom out"
              onClick={() => handleZoomBy(0.85)}
              className="p-2 rounded-lg text-[var(--rf-text)] hover:bg-[var(--rf-surface-hover)]"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              aria-label="Reset zoom to 100%"
              onClick={() => setCamera({ x: 0, y: 0, zoom: 1 })}
              className="px-2 py-1 rounded-lg font-mono-tabular text-[11px] font-medium text-[var(--rf-text)] hover:bg-[var(--rf-surface-hover)]"
            >
              {Math.round(camera.zoom * 100)}%
            </button>
            <button
              type="button"
              aria-label="Zoom in"
              onClick={() => handleZoomBy(1.18)}
              className="p-2 rounded-lg text-[var(--rf-text)] hover:bg-[var(--rf-surface-hover)]"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              aria-label="Fit canvas to content"
              title="Fit to screen"
              onClick={handleFitToScreen}
              className="p-2 rounded-lg text-[var(--rf-text)] hover:bg-[var(--rf-surface-hover)]"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>

          <div
            data-testid="element-count"
            className="text-[11px] text-[var(--rf-text-muted)] font-mono-tabular px-2"
          >
            {activeCount} {activeCount === 1 ? 'element' : 'elements'}
          </div>
        </div>
      )}

      {/* Desktop Bottom-Right Quick Shortcuts */}
      {!zenMode && presentationIndex === null && (
        <div className="hidden md:flex fixed bottom-3 right-3 z-20 items-center gap-2">
          <button
            type="button"
            onClick={() => setCommandOpen(true)}
            className="rf-panel px-3 py-2 rounded-xl text-xs font-medium text-[var(--rf-text-muted)] hover:text-[var(--rf-text)] hover:bg-[var(--rf-surface-hover)] font-mono-tabular"
          >
            Ctrl+K
          </button>
        </div>
      )}

      {/* Zen Mode Exit Button */}
      {zenMode && (
        <button
          type="button"
          onClick={() => setZenMode(false)}
          className="rf-panel fixed top-3 right-3 z-30 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-[var(--rf-text)] hover:bg-[var(--rf-surface-hover)]"
        >
          <Eye className="w-4 h-4" />
          <span>{t.actions.exitZen}</span>
        </button>
      )}

      {/* Presentation Slide Controller with Laser Pointer Toggle */}
      {presentationIndex !== null && frames.length > 0 && (
        <PresentationController
          frames={frames}
          currentIndex={presentationIndex}
          laserActive={activeTool === 'laser'}
          onToggleLaser={() =>
            setActiveTool((prev) => (prev === 'laser' ? prePresentationToolRef.current : 'laser'))
          }
          onNavigateFrame={navigateToFrame}
          onExit={() => {
            setPresentationIndex(null);
            setActiveTool(prePresentationToolRef.current);
          }}
        />
      )}

      {/* Transient Notification Toast */}
      {toastMsg && (
        <div
          role="status"
          className="rf-panel fixed top-16 left-1/2 -translate-x-1/2 z-40 px-4 py-2 rounded-xl text-xs font-medium text-[var(--rf-text)]"
        >
          {toastMsg}
        </div>
      )}

      {/* Modals */}
      <ExportModal
        open={exportOpen}
        elements={elements}
        theme={theme}
        onClose={() => setExportOpen(false)}
      />
      <ThemeModal
        open={themeModalOpen}
        activeUiThemeId={themeId}
        activeCanvasThemeId={canvasThemeId}
        onSelectUiTheme={(nextUiId) => {
          setThemeId(nextUiId);
        }}
        onSelectCanvasTheme={(nextCanvasId) => {
          const prevCanvas = CANVAS_THEMES[canvasThemeId];
          const nextCanvas = CANVAS_THEMES[nextCanvasId];
          setElements((prevEls) =>
            prevEls.map((el) => {
              let nextStroke = el.strokeColor;
              if (
                el.strokeColor.toLowerCase() === prevCanvas.defaultInk.toLowerCase() ||
                (prevCanvas.mode !== nextCanvas.mode &&
                  prevCanvas.swatches.some((s) => s.toLowerCase() === el.strokeColor.toLowerCase()))
              ) {
                nextStroke = nextCanvas.defaultInk;
              }
              const fillIdx = prevCanvas.fillSwatches.indexOf(el.backgroundColor);
              const nextBg =
                fillIdx > 0 && nextCanvas.fillSwatches[fillIdx]
                  ? nextCanvas.fillSwatches[fillIdx]
                  : el.backgroundColor;
              return { ...el, strokeColor: nextStroke, backgroundColor: nextBg };
            })
          );
          setCanvasThemeId(nextCanvasId);
        }}
        onClose={() => setThemeModalOpen(false)}
      />
      <CollabModal
        open={collabModalOpen}
        collab={collab}
        onStartSession={handleStartCollabSession}
        onStopSession={handleStopCollabSession}
        onUpdatePeerName={(name) => setCollab((prev) => ({ ...prev, peerName: name }))}
        onClose={() => setCollabModalOpen(false)}
      />
      <CommandPalette
        open={commandOpen}
        commands={commands}
        onClose={() => setCommandOpen(false)}
      />
      <FontShowcaseModal
        open={fontModalOpen}
        activeFont={defaultStyle.fontFamily}
        onSelectFont={(font) => {
          setDefaultStyle((prev) => ({ ...prev, fontFamily: font }));
          if (selectedIds.length > 0) handleUpdateSelected({ fontFamily: font });
        }}
        onClose={() => setFontModalOpen(false)}
      />
      <RustCodeViewerModal
        open={rustModalOpen}
        onClose={() => setRustModalOpen(false)}
      />

      {/* Workspace Alt+Tab Quick Canvas Switcher */}
      {!showCanvasHub && !showOpeningScreen && workspaceSwitcherOpen && hubCanvases.length > 0 && (
        <div
          data-testid="workspace-alt-tab-switcher"
          role="dialog"
          aria-label="Workspace canvas switcher"
          className="rf-panel fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 max-w-[92vw] rounded-3xl p-3.5 shadow-2xl border border-[var(--rf-border)]"
        >
          <div className="flex items-center justify-between px-2 pb-2 text-[11px] font-semibold text-[var(--rf-text-muted)]">
            <span>Switch Canvas</span>
            <span className="font-mono-tabular">Release Alt to switch · Esc to cancel</span>
          </div>
          <div className="flex items-stretch gap-2.5 overflow-x-auto max-w-[84vw] pb-1">
            {hubCanvases.map((c, idx) => {
              const selected = idx === workspaceSwitcherIndex;
              const cTheme = CANVAS_THEMES[c.canvasThemeId || 'emerald-minimal'];
              const thumbSrc = renderBoardThumbnailDataUrl(c, 288, 160);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    setWorkspaceSwitcherOpen(false);
                    if (c.id !== activeCanvasId) {
                      if (activeCanvasId) {
                        syncActiveCanvasIntoHub(elements, camera, activeCanvasId, canvasThemeId);
                      }
                      handleOpenCanvasFromHub(c.id);
                    }
                  }}
                  className={`w-44 shrink-0 rounded-2xl p-2 border text-left cursor-pointer ${
                    selected
                      ? 'border-[var(--rf-accent)] ring-2 ring-[var(--rf-accent)]/40 bg-[var(--rf-accent-soft)]'
                      : 'border-[var(--rf-border)] bg-[var(--rf-surface-elevated)] hover:border-[var(--rf-accent)]/50'
                  }`}
                >
                  <div
                    className="h-20 rounded-xl mb-2 border border-black/15 overflow-hidden relative"
                    style={{
                      backgroundColor: cTheme?.canvasBg || '#f6faf8',
                    }}
                  >
                    <img
                      src={thumbSrc}
                      alt={c.title}
                      className="w-full h-full object-cover"
                      draggable={false}
                    />
                  </div>
                  <div className="text-xs font-bold text-[var(--rf-text)] truncate">{c.title}</div>
                  <div className="text-[10px] text-[var(--rf-text-muted)] mt-0.5 truncate">
                    {c.elementCount} items
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
