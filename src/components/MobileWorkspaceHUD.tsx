import React, { useEffect, useRef, useState } from 'react';
import {
  Activity,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  ChevronDown,
  ChevronUp,
  Circle,
  Code2,
  Copy,
  Cpu,
  Diamond,
  Download,
  Eraser,
  Expand,
  FolderOpen,
  Frame,
  Globe,
  Grid3X3,
  Hand,
  Image as ImageIcon,
  Layers,
  LayoutGrid,
  Lock,
  Maximize2,
  Menu,
  Minus,
  MoreHorizontal,
  MousePointer2,
  Palette,
  Pencil,
  Plus,
  Presentation,
  Redo2,
  RotateCcw,
  Settings,
  Sigma,
  SlidersHorizontal,
  Sparkles,
  Square,
  Trash2,
  Triangle,
  Type,
  Undo2,
  Users,
  Waypoints,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {
  CameraState,
  FillStyle,
  FontFamily,
  Locale,
  Sloppiness,
  StrokeStyle,
  ToolType,
  TriangleVariant,
  WhiteboardElement,
} from '../types';
import { ForgeTheme } from '../themes';
import { LOCALES, Translations } from '../i18n';
import { DigitalCircuitReport } from '../digitalLogic';
import { PropertiesPanel } from './PropertiesPanel';

export type SheetDetent = 'closed' | 'collapsed' | 'half' | 'expanded';

interface MobileWorkspaceHUDProps {
  theme: ForgeTheme;
  locale: Locale;
  t: Translations;
  activeTool: ToolType;
  camera: CameraState;
  showGrid: boolean;
  shapeSnapEnabled: boolean;
  canUndo: boolean;
  canRedo: boolean;
  circuitsOpen: boolean;
  mathOpen: boolean;
  simPanelOpen: boolean;
  simActive: boolean;
  hasFrames: boolean;
  collabRoomId: string | null;
  peerCount: number;
  selectedElements: WhiteboardElement[];
  digitalReport?: DigitalCircuitReport;
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
  onSelectTool: (tool: ToolType) => void;
  onTriggerImageUpload: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onZoomBy: (factor: number) => void;
  onResetZoom: () => void;
  onFitToScreen: () => void;
  onToggleCircuits: () => void;
  onToggleMath: () => void;
  onToggleSimulate: () => void;
  onStartPresentation: () => void;
  onOpenExport: () => void;
  onOpenCollab: () => void;
  onOpenThemes: () => void;
  onOpenFonts: () => void;
  onOpenRustCode: () => void;
  onOpenCommandPalette: () => void;
  onOpenFileImport: () => void;
  onToggleGrid: () => void;
  onToggleShapeSnap: () => void;
  onChangeLocale: (loc: Locale) => void;
  onToggleZenMode: () => void;
  onLoadDemoCircuit: () => void;
  onClearCanvas: () => void;
  onQuickInsertWebpage: () => void;
  onQuickInsertFrame: () => void;
  onUpdateStyle: (patch: Partial<MobileWorkspaceHUDProps['defaultStyle']>) => void;
  onUpdateSelected: (patch: Partial<WhiteboardElement>) => void;
  onDuplicateSelected: () => void;
  onDeleteSelected: () => void;
  onLayerChange: (dir: 'forward' | 'backward') => void;
  onInspectInstrument: (id: string) => void;
  onInspectWebpage: (id: string) => void;
  onAutoAssignLogicLetters: () => void;
  onOpenMathStudio: (id: string, tab?: 'equation' | 'matrix' | 'engineering' | 'history') => void;
  onOpenCanvasHub?: () => void;
  activeCanvasTitle?: string;
}

export const MobileWorkspaceHUD: React.FC<MobileWorkspaceHUDProps> = ({
  theme,
  locale,
  t,
  activeTool,
  camera,
  showGrid,
  shapeSnapEnabled,
  canUndo,
  canRedo,
  circuitsOpen,
  mathOpen,
  simPanelOpen,
  simActive,
  hasFrames,
  collabRoomId,
  peerCount,
  selectedElements,
  digitalReport,
  defaultStyle,
  onSelectTool,
  onTriggerImageUpload,
  onUndo,
  onRedo,
  onZoomBy,
  onResetZoom,
  onFitToScreen,
  onToggleCircuits,
  onToggleMath,
  onToggleSimulate,
  onStartPresentation,
  onOpenExport,
  onOpenCollab,
  onOpenThemes,
  onOpenFonts,
  onOpenRustCode,
  onOpenCommandPalette,
  onOpenFileImport,
  onToggleGrid,
  onToggleShapeSnap,
  onChangeLocale,
  onToggleZenMode,
  onLoadDemoCircuit,
  onClearCanvas,
  onQuickInsertWebpage,
  onQuickInsertFrame,
  onUpdateStyle,
  onUpdateSelected,
  onDuplicateSelected,
  onDeleteSelected,
  onLayerChange,
  onInspectInstrument,
  onInspectWebpage,
  onAutoAssignLogicLetters,
  onOpenMathStudio,
  onOpenCanvasHub,
  activeCanvasTitle,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [moreActionsOpen, setMoreActionsOpen] = useState(false);
  const [moreToolsOpen, setMoreToolsOpen] = useState(false);
  const [activeBottomPopover, setActiveBottomPopover] = useState<
    'layers' | 'objects' | 'settings' | null
  >(null);
  const [sheetDetent, setSheetDetent] = useState<SheetDetent>('closed');
  const prevSelectionCountRef = useRef(0);
  const dragStartYRef = useRef<number | null>(null);

  // Auto-open Properties bottom sheet on mobile when element(s) become selected; hide on clear
  useEffect(() => {
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    const prevCount = prevSelectionCountRef.current;
    prevSelectionCountRef.current = selectedElements.length;
    if (!isMobile) return;
    if (prevCount === 0 && selectedElements.length > 0) {
      setSheetDetent('half');
      setActiveBottomPopover(null);
    } else if (prevCount > 0 && selectedElements.length === 0) {
      setSheetDetent('closed');
    }
  }, [selectedElements.length]);

  const coreTools: { id: ToolType; label: string; icon: React.ReactNode }[] = [
    { id: 'select', label: t.tools.select, icon: <MousePointer2 className="w-4 h-4" /> },
    { id: 'hand', label: t.tools.hand, icon: <Hand className="w-4 h-4" /> },
    { id: 'rectangle', label: t.tools.rectangle, icon: <Square className="w-4 h-4" /> },
    { id: 'diamond', label: t.tools.diamond, icon: <Diamond className="w-4 h-4" /> },
    { id: 'ellipse', label: t.tools.ellipse, icon: <Circle className="w-4 h-4" /> },
    { id: 'triangle', label: t.tools.triangle, icon: <Triangle className="w-4 h-4" /> },
    { id: 'arrow', label: t.tools.arrow, icon: <ArrowRight className="w-4 h-4" /> },
    { id: 'line', label: t.tools.line, icon: <Minus className="w-4 h-4" /> },
    { id: 'freedraw', label: t.tools.freedraw, icon: <Pencil className="w-4 h-4" /> },
    { id: 'text', label: t.tools.text, icon: <Type className="w-4 h-4" /> },
  ];

  const extraTools: {
    id: ToolType;
    label: string;
    icon: React.ReactNode;
    onClick?: () => void;
  }[] = [
    { id: 'wire', label: t.tools.wire, icon: <Waypoints className="w-4 h-4" /> },
    {
      id: 'laser',
      label: t.tools.laser,
      icon: (
        <svg
          viewBox="0 0 24 24"
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4 20 14.5 9.5" />
          <circle cx="17" cy="7" r="2.2" fill="#ef4444" stroke="#ef4444" />
        </svg>
      ),
    },
    {
      id: 'image',
      label: t.tools.image,
      icon: <ImageIcon className="w-4 h-4" />,
      onClick: onTriggerImageUpload,
    },
    { id: 'frame', label: t.tools.frame, icon: <Frame className="w-4 h-4" /> },
    { id: 'webpage', label: t.tools.webpage, icon: <Globe className="w-4 h-4" /> },
    { id: 'math', label: t.tools.math, icon: <Sigma className="w-4 h-4" /> },
    { id: 'eraser', label: t.tools.eraser, icon: <Eraser className="w-4 h-4" /> },
  ];

  const isExtraToolActive = extraTools.some((item) => item.id === activeTool);

  const handleSheetTouchStart = (e: React.TouchEvent) => {
    dragStartYRef.current = e.touches[0].clientY;
  };

  const handleSheetTouchEnd = (e: React.TouchEvent) => {
    if (dragStartYRef.current === null) return;
    const dy = e.changedTouches[0].clientY - dragStartYRef.current;
    dragStartYRef.current = null;
    if (Math.abs(dy) < 26) return;
    if (dy < 0) {
      setSheetDetent((prev) =>
        prev === 'collapsed' ? 'half' : prev === 'half' ? 'expanded' : 'expanded'
      );
    } else {
      setSheetDetent((prev) =>
        prev === 'expanded' ? 'half' : prev === 'half' ? 'collapsed' : 'closed'
      );
    }
  };

  const sheetHeightClass =
    sheetDetent === 'expanded'
      ? 'h-[74vh]'
      : sheetDetent === 'half'
      ? 'h-[42vh]'
      : sheetDetent === 'collapsed'
      ? 'h-[48px]'
      : 'h-0';

  const closeAllTopMenus = () => {
    setMenuOpen(false);
    setMoreActionsOpen(false);
    setMoreToolsOpen(false);
  };

  return (
    <div className="md:hidden pointer-events-none fixed inset-0 z-30">
      {/* 1. Sticky Compact Mobile Top Header */}
      <header
        data-testid="mobile-top-header"
        className="pointer-events-auto fixed top-0 inset-x-0 z-30 h-12 px-2 flex items-center justify-between gap-1.5 border-b border-[var(--rf-border)] bg-[var(--rf-surface)] backdrop-blur-md"
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <button
            type="button"
            aria-label="Open mobile menu"
            aria-expanded={menuOpen}
            onClick={() => {
              setMoreActionsOpen(false);
              setMoreToolsOpen(false);
              setMenuOpen((o) => !o);
            }}
            className="flex items-center justify-center w-9 h-9 rounded-lg border border-[var(--rf-border)] bg-[var(--rf-surface-elevated)] text-[var(--rf-text)] shrink-0"
          >
            <Menu className="w-4 h-4" />
          </button>
          <span className="font-bold text-sm tracking-tight text-[var(--rf-text)] truncate">
            {t.appName}
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            aria-label={t.actions.undo}
            disabled={!canUndo}
            onClick={onUndo}
            className="flex items-center justify-center w-9 h-9 rounded-lg border border-[var(--rf-border)] bg-[var(--rf-surface-elevated)] text-[var(--rf-text)] disabled:opacity-35"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            aria-label={t.actions.redo}
            disabled={!canRedo}
            onClick={onRedo}
            className="flex items-center justify-center w-9 h-9 rounded-lg border border-[var(--rf-border)] bg-[var(--rf-surface-elevated)] text-[var(--rf-text)] disabled:opacity-35"
          >
            <Redo2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            aria-label="Workspace actions"
            aria-expanded={moreActionsOpen}
            onClick={() => {
              setMenuOpen(false);
              setMoreToolsOpen(false);
              setMoreActionsOpen((o) => !o);
            }}
            style={
              circuitsOpen || mathOpen || simPanelOpen || collabRoomId
                ? { backgroundColor: 'var(--rf-accent)', color: 'var(--rf-accent-fg)' }
                : undefined
            }
            className="flex items-center gap-1 h-9 px-2.5 rounded-lg border border-[var(--rf-border)] bg-[var(--rf-surface-elevated)] text-xs font-semibold text-[var(--rf-text)]"
          >
            <MoreHorizontal className="w-4 h-4" />
            <span>Studio</span>
          </button>
        </div>
      </header>

      {/* Mobile Main Menu Drawer */}
      {menuOpen && (
        <>
          <div className="pointer-events-auto fixed inset-0 z-40 bg-black/25" onClick={closeAllTopMenus} />
          <div
            role="menu"
            data-testid="mobile-main-menu"
            className="rf-panel pointer-events-auto fixed top-13 left-2 z-50 w-64 max-w-[calc(100vw-16px)] max-h-[70vh] overflow-y-auto rf-scrollbar rounded-xl p-1.5 space-y-0.5 text-xs"
          >
            {onOpenCanvasHub && (
              <button
                type="button"
                data-testid="mobile-menu-open-canvas-hub"
                onClick={() => {
                  closeAllTopMenus();
                  onOpenCanvasHub();
                }}
                className="w-full flex items-center justify-between px-2.5 py-2.5 rounded-lg font-semibold text-[var(--rf-accent)] bg-[var(--rf-accent)]/10 hover:bg-[var(--rf-accent)]/20 text-left"
              >
                <span className="flex items-center gap-2.5">
                  <LayoutGrid className="w-4 h-4" />
                  <span>3D Canvas Hub</span>
                </span>
                {activeCanvasTitle && (
                  <span className="text-[10px] truncate max-w-[90px] opacity-80">
                    {activeCanvasTitle}
                  </span>
                )}
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                closeAllTopMenus();
                onOpenFileImport();
              }}
              className="w-full flex items-center gap-2.5 px-2.5 py-2.5 rounded-lg text-[var(--rf-text)] hover:bg-[var(--rf-surface-hover)] text-left"
            >
              <FolderOpen className="w-4 h-4 text-[var(--rf-text-muted)]" />
              <span>{t.actions.importFile}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                closeAllTopMenus();
                onOpenExport();
              }}
              className="w-full flex items-center gap-2.5 px-2.5 py-2.5 rounded-lg text-[var(--rf-text)] hover:bg-[var(--rf-surface-hover)] text-left"
            >
              <Download className="w-4 h-4 text-[var(--rf-text-muted)]" />
              <span>{t.actions.export} (PNG, SVG, JSON)</span>
            </button>
            <div className="my-1 border-t border-[var(--rf-border)]" />
            <button
              type="button"
              onClick={onToggleGrid}
              className="w-full flex items-center justify-between px-2.5 py-2.5 rounded-lg text-[var(--rf-text)] hover:bg-[var(--rf-surface-hover)]"
            >
              <span className="flex items-center gap-2.5">
                <Grid3X3 className="w-4 h-4 text-[var(--rf-text-muted)]" />
                <span>{t.actions.gridToggle}</span>
              </span>
              <span className="font-mono-tabular text-[11px] text-[var(--rf-accent)]">
                {showGrid ? 'ON' : 'OFF'}
              </span>
            </button>
            <button
              type="button"
              onClick={onToggleShapeSnap}
              className="w-full flex items-center justify-between px-2.5 py-2.5 rounded-lg text-[var(--rf-text)] hover:bg-[var(--rf-surface-hover)]"
            >
              <span className="flex items-center gap-2.5">
                <Sparkles className="w-4 h-4 text-[var(--rf-text-muted)]" />
                <span>{t.actions.shapeSnapToggle}</span>
              </span>
              <span className="font-mono-tabular text-[11px] text-[var(--rf-accent)]">
                {shapeSnapEnabled ? 'ON' : 'OFF'}
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                closeAllTopMenus();
                onOpenThemes();
              }}
              className="w-full flex items-center gap-2.5 px-2.5 py-2.5 rounded-lg text-[var(--rf-text)] hover:bg-[var(--rf-surface-hover)] text-left"
            >
              <Palette className="w-4 h-4 text-[var(--rf-text-muted)]" />
              <span>{t.actions.themes}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                closeAllTopMenus();
                onOpenFonts();
              }}
              className="w-full flex items-center gap-2.5 px-2.5 py-2.5 rounded-lg text-[var(--rf-text)] hover:bg-[var(--rf-surface-hover)] text-left"
            >
              <Type className="w-4 h-4 text-[var(--rf-text-muted)]" />
              <span>{t.actions.fonts}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                closeAllTopMenus();
                onOpenRustCode();
              }}
              className="w-full flex items-center gap-2.5 px-2.5 py-2.5 rounded-lg text-[var(--rf-text)] hover:bg-[var(--rf-surface-hover)] text-left"
            >
              <Code2 className="w-4 h-4 text-[var(--rf-text-muted)]" />
              <span>{t.actions.rustCore}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                closeAllTopMenus();
                onOpenCommandPalette();
              }}
              className="w-full flex items-center gap-2.5 px-2.5 py-2.5 rounded-lg text-[var(--rf-text)] hover:bg-[var(--rf-surface-hover)] text-left"
            >
              <Sparkles className="w-4 h-4 text-[var(--rf-text-muted)]" />
              <span>{t.actions.commands}</span>
            </button>
            <div className="flex items-center justify-between px-2.5 py-2">
              <span className="flex items-center gap-2 text-[var(--rf-text-muted)]">
                <Globe className="w-4 h-4" />
                <span>{t.actions.language}</span>
              </span>
              <select
                aria-label={t.actions.language}
                value={locale}
                onChange={(e) => onChangeLocale(e.target.value as Locale)}
                className="bg-[var(--rf-surface-elevated)] border border-[var(--rf-border)] rounded-md px-1.5 py-1 text-[11px] text-[var(--rf-text)]"
              >
                {LOCALES.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="my-1 border-t border-[var(--rf-border)]" />
            <button
              type="button"
              onClick={() => {
                closeAllTopMenus();
                onLoadDemoCircuit();
              }}
              className="w-full flex items-center gap-2.5 px-2.5 py-2.5 rounded-lg text-[var(--rf-text)] hover:bg-[var(--rf-surface-hover)] text-left"
            >
              <RotateCcw className="w-4 h-4 text-[var(--rf-text-muted)]" />
              <span>{t.actions.loadDemo}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                closeAllTopMenus();
                onClearCanvas();
              }}
              className="w-full flex items-center gap-2.5 px-2.5 py-2.5 rounded-lg text-rose-400 hover:bg-rose-500/15 text-left"
            >
              <Trash2 className="w-4 h-4" />
              <span>{t.actions.clearCanvas}</span>
            </button>
          </div>
        </>
      )}

      {/* Mobile Top Studio Actions Dropdown */}
      {moreActionsOpen && (
        <>
          <div className="pointer-events-auto fixed inset-0 z-40 bg-black/25" onClick={closeAllTopMenus} />
          <div
            role="menu"
            data-testid="mobile-studio-menu"
            className="rf-panel pointer-events-auto fixed top-13 right-2 z-50 w-56 max-w-[calc(100vw-16px)] rounded-xl p-1.5 space-y-1 text-xs"
          >
            <button
              type="button"
              onClick={() => {
                closeAllTopMenus();
                onToggleCircuits();
              }}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg ${
                circuitsOpen
                  ? 'bg-[var(--rf-accent)] text-[var(--rf-accent-fg)]'
                  : 'text-[var(--rf-text)] hover:bg-[var(--rf-surface-hover)]'
              }`}
            >
              <span className="flex items-center gap-2">
                <Cpu className="w-4 h-4" />
                <span>{t.actions.circuits}</span>
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                closeAllTopMenus();
                onToggleMath();
              }}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg ${
                mathOpen
                  ? 'bg-[var(--rf-accent)] text-[var(--rf-accent-fg)]'
                  : 'text-[var(--rf-text)] hover:bg-[var(--rf-surface-hover)]'
              }`}
            >
              <span className="flex items-center gap-2">
                <Sigma className="w-4 h-4" />
                <span>{t.actions.mathEngine}</span>
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                closeAllTopMenus();
                onToggleSimulate();
              }}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg ${
                simPanelOpen || simActive
                  ? 'bg-emerald-600 text-white'
                  : 'text-[var(--rf-text)] hover:bg-[var(--rf-surface-hover)]'
              }`}
            >
              <span className="flex items-center gap-2">
                <Activity className="w-4 h-4" />
                <span>Simulate Circuit</span>
              </span>
            </button>
            {hasFrames && (
              <button
                type="button"
                onClick={() => {
                  closeAllTopMenus();
                  onStartPresentation();
                }}
                className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-[var(--rf-text)] hover:bg-[var(--rf-surface-hover)]"
              >
                <Presentation className="w-4 h-4" />
                <span>{t.actions.present}</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                closeAllTopMenus();
                onOpenExport();
              }}
              className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-[var(--rf-text)] hover:bg-[var(--rf-surface-hover)]"
            >
              <Download className="w-4 h-4" />
              <span>{t.actions.export}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                closeAllTopMenus();
                onOpenThemes();
              }}
              className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-[var(--rf-text)] hover:bg-[var(--rf-surface-hover)]"
            >
              <Palette className="w-4 h-4" />
              <span>{t.actions.themes}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                closeAllTopMenus();
                onOpenCollab();
              }}
              className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-[var(--rf-text)] hover:bg-[var(--rf-surface-hover)]"
            >
              {collabRoomId ? (
                <Lock className="w-4 h-4 text-emerald-400" />
              ) : (
                <Users className="w-4 h-4" />
              )}
              <span>
                {collabRoomId ? `E2EE (${peerCount + 1})` : t.actions.collaborate}
              </span>
            </button>
          </div>
        </>
      )}

      {/* 2. Mobile Floating Drawing Toolbar */}
      <div className="pointer-events-none fixed top-[54px] inset-x-2 z-20 flex flex-col items-center">
        <nav
          data-testid="mobile-drawing-toolbar"
          aria-label="Mobile Drawing Tools"
          className="rf-panel pointer-events-auto flex items-center gap-1 px-1.5 py-1 rounded-xl max-w-full overflow-x-auto rf-scrollbar"
        >
          {coreTools.map((tool) => {
            const active = activeTool === tool.id;
            return (
              <button
                key={tool.id}
                type="button"
                aria-label={tool.label}
                aria-pressed={active}
                onClick={() => {
                  onSelectTool(tool.id);
                  setMoreToolsOpen(false);
                }}
                style={
                  active
                    ? { backgroundColor: 'var(--rf-accent)', color: 'var(--rf-accent-fg)' }
                    : undefined
                }
                className={`flex items-center justify-center min-w-[38px] min-h-[38px] rounded-lg transition-colors shrink-0 ${
                  active
                    ? 'shadow-sm'
                    : 'text-[var(--rf-text)] hover:bg-[var(--rf-surface-hover)]'
                }`}
              >
                {tool.icon}
              </button>
            );
          })}
          <button
            type="button"
            aria-label="More drawing tools"
            aria-expanded={moreToolsOpen}
            onClick={() => setMoreToolsOpen((o) => !o)}
            style={
              moreToolsOpen || isExtraToolActive
                ? { backgroundColor: 'var(--rf-accent)', color: 'var(--rf-accent-fg)' }
                : undefined
            }
            className="flex items-center justify-center min-w-[38px] min-h-[38px] rounded-lg transition-colors shrink-0 text-[var(--rf-text)] hover:bg-[var(--rf-surface-hover)]"
          >
            <Plus className="w-4 h-4" />
          </button>
        </nav>

        {moreToolsOpen && (
          <div
            data-testid="mobile-more-tools-drawer"
            className="rf-panel pointer-events-auto mt-1.5 p-1.5 rounded-xl grid grid-cols-4 gap-1 max-w-full shadow-lg"
          >
            {extraTools.map((tool) => {
              const active = activeTool === tool.id;
              return (
                <button
                  key={tool.id}
                  type="button"
                  onClick={() => {
                    setMoreToolsOpen(false);
                    if (tool.onClick) tool.onClick();
                    else onSelectTool(tool.id);
                  }}
                  style={
                    active
                      ? { backgroundColor: 'var(--rf-accent)', color: 'var(--rf-accent-fg)' }
                      : undefined
                  }
                  className="flex flex-col items-center justify-center gap-1 min-w-[64px] py-2 px-1.5 rounded-lg text-[10px] font-medium text-[var(--rf-text)] hover:bg-[var(--rf-surface-hover)]"
                >
                  {tool.icon}
                  <span className="truncate max-w-full">{tool.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 3. Draggable Mobile Properties Bottom Sheet */}
      {sheetDetent !== 'closed' && (
        <div
          data-testid="mobile-properties-sheet"
          aria-label="Mobile Properties Sheet"
          className={`rf-panel pointer-events-auto fixed inset-x-2 bottom-[60px] z-30 rounded-2xl flex flex-col overflow-hidden transition-all duration-200 ease-out shadow-2xl ${sheetHeightClass}`}
        >
          <div
            onTouchStart={handleSheetTouchStart}
            onTouchEnd={handleSheetTouchEnd}
            className="flex items-center justify-between px-3 py-2 border-b border-[var(--rf-border)] bg-[var(--rf-surface-elevated)] shrink-0 touch-none"
          >
            <button
              type="button"
              aria-label="Toggle properties sheet size"
              onClick={() =>
                setSheetDetent((prev) =>
                  prev === 'collapsed' ? 'half' : prev === 'half' ? 'expanded' : 'half'
                )
              }
              className="flex items-center gap-2 text-xs font-semibold text-[var(--rf-text)]"
            >
              <span className="w-8 h-1 rounded-full bg-[var(--rf-border)] inline-block" />
              <span>
                {selectedElements.length > 0
                  ? `Style (${selectedElements.length} selected)`
                  : 'Default Style'}
              </span>
              {sheetDetent === 'expanded' ? (
                <ChevronDown className="w-3.5 h-3.5 text-[var(--rf-text-muted)]" />
              ) : (
                <ChevronUp className="w-3.5 h-3.5 text-[var(--rf-text-muted)]" />
              )}
            </button>
            <button
              type="button"
              aria-label="Close properties sheet"
              onClick={() => setSheetDetent('closed')}
              className="p-1.5 rounded-lg text-[var(--rf-text-muted)] hover:bg-[var(--rf-surface-hover)]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          {sheetDetent !== 'collapsed' && (
            <div className="flex-1 overflow-y-auto rf-scrollbar p-3">
              <PropertiesPanel
                theme={theme}
                selectedElements={selectedElements}
                digitalReport={digitalReport}
                defaultStyle={defaultStyle}
                onUpdateStyle={onUpdateStyle}
                onUpdateSelected={onUpdateSelected}
                onDuplicateSelected={onDuplicateSelected}
                onDeleteSelected={onDeleteSelected}
                onLayerChange={onLayerChange}
                onInspectInstrument={onInspectInstrument}
                onInspectWebpage={onInspectWebpage}
                onAutoAssignLogicLetters={onAutoAssignLogicLetters}
                onOpenMathStudio={onOpenMathStudio}
                compactMobile
                t={t}
              />
            </div>
          )}
        </div>
      )}

      {/* Bottom Popovers for Layers / Objects / Settings */}
      {activeBottomPopover && (
        <>
          <div
            className="pointer-events-auto fixed inset-0 z-20"
            onClick={() => setActiveBottomPopover(null)}
          />
          <div
            data-testid={`mobile-popover-${activeBottomPopover}`}
            className="rf-panel pointer-events-auto fixed bottom-[62px] inset-x-2 z-30 rounded-xl p-2.5 text-xs shadow-xl"
          >
            {activeBottomPopover === 'layers' && (
              <div className="space-y-2">
                <div className="font-semibold text-[var(--rf-text-muted)] px-1">
                  {selectedElements.length > 0
                    ? `Layer & Selection (${selectedElements.length})`
                    : 'Select an element on canvas to reorder or edit'}
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  <button
                    type="button"
                    disabled={selectedElements.length === 0}
                    onClick={() => onLayerChange('forward')}
                    className="flex flex-col items-center gap-1 py-2 rounded-lg border border-[var(--rf-border)] bg-[var(--rf-surface-elevated)] text-[var(--rf-text)] disabled:opacity-40"
                  >
                    <ArrowUp className="w-4 h-4" />
                    <span>Forward</span>
                  </button>
                  <button
                    type="button"
                    disabled={selectedElements.length === 0}
                    onClick={() => onLayerChange('backward')}
                    className="flex flex-col items-center gap-1 py-2 rounded-lg border border-[var(--rf-border)] bg-[var(--rf-surface-elevated)] text-[var(--rf-text)] disabled:opacity-40"
                  >
                    <ArrowDown className="w-4 h-4" />
                    <span>Back</span>
                  </button>
                  <button
                    type="button"
                    disabled={selectedElements.length === 0}
                    onClick={onDuplicateSelected}
                    className="flex flex-col items-center gap-1 py-2 rounded-lg border border-[var(--rf-border)] bg-[var(--rf-surface-elevated)] text-[var(--rf-text)] disabled:opacity-40"
                  >
                    <Copy className="w-4 h-4" />
                    <span>Copy</span>
                  </button>
                  <button
                    type="button"
                    disabled={selectedElements.length === 0}
                    onClick={() => {
                      onDeleteSelected();
                      setActiveBottomPopover(null);
                    }}
                    className="flex flex-col items-center gap-1 py-2 rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-400 disabled:opacity-40"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Delete</span>
                  </button>
                </div>
              </div>
            )}

            {activeBottomPopover === 'objects' && (
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setActiveBottomPopover(null);
                    onToggleMath();
                  }}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-[var(--rf-border)] bg-[var(--rf-surface-elevated)] text-[var(--rf-text)]"
                >
                  <Sigma className="w-4 h-4 text-[var(--rf-accent)]" />
                  <span>Math Studio</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveBottomPopover(null);
                    onToggleCircuits();
                  }}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-[var(--rf-border)] bg-[var(--rf-surface-elevated)] text-[var(--rf-text)]"
                >
                  <Cpu className="w-4 h-4 text-[var(--rf-accent)]" />
                  <span>Circuits</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveBottomPopover(null);
                    onQuickInsertWebpage();
                  }}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-[var(--rf-border)] bg-[var(--rf-surface-elevated)] text-[var(--rf-text)]"
                >
                  <Globe className="w-4 h-4 text-[var(--rf-accent)]" />
                  <span>Webpage Box</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveBottomPopover(null);
                    onQuickInsertFrame();
                  }}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-[var(--rf-border)] bg-[var(--rf-surface-elevated)] text-[var(--rf-text)]"
                >
                  <Frame className="w-4 h-4 text-[var(--rf-accent)]" />
                  <span>Slide Frame</span>
                </button>
              </div>
            )}

            {activeBottomPopover === 'settings' && (
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={onToggleGrid}
                  className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-[var(--rf-border)] bg-[var(--rf-surface-elevated)] text-[var(--rf-text)]"
                >
                  <span>Canvas Grid</span>
                  <span className="font-mono-tabular text-[var(--rf-accent)]">
                    {showGrid ? 'ON' : 'OFF'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={onToggleShapeSnap}
                  className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-[var(--rf-border)] bg-[var(--rf-surface-elevated)] text-[var(--rf-text)]"
                >
                  <span>Shape Snap</span>
                  <span className="font-mono-tabular text-[var(--rf-accent)]">
                    {shapeSnapEnabled ? 'ON' : 'OFF'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveBottomPopover(null);
                    onOpenThemes();
                  }}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-[var(--rf-border)] bg-[var(--rf-surface-elevated)] text-[var(--rf-text)]"
                >
                  <Palette className="w-4 h-4 text-[var(--rf-accent)]" />
                  <span>Themes (22+)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveBottomPopover(null);
                    onOpenExport();
                  }}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-[var(--rf-border)] bg-[var(--rf-surface-elevated)] text-[var(--rf-text)]"
                >
                  <Download className="w-4 h-4 text-[var(--rf-accent)]" />
                  <span>Export Scene</span>
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {/* 4. Floating Corner Zoom Pill (clear of bottom bar) */}
      {sheetDetent === 'closed' && !activeBottomPopover && (
        <div
          data-testid="mobile-zoom-pill"
          className="rf-panel pointer-events-auto fixed bottom-[62px] right-2 z-20 flex items-center gap-0.5 p-1 rounded-xl text-xs"
        >
          <button
            type="button"
            aria-label="Mobile zoom out"
            onClick={() => onZoomBy(0.85)}
            className="p-2 rounded-lg text-[var(--rf-text)] hover:bg-[var(--rf-surface-hover)]"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            aria-label="Mobile reset zoom"
            onClick={onResetZoom}
            className="px-1.5 py-1 rounded-lg font-mono-tabular text-[11px] font-medium text-[var(--rf-text)]"
          >
            {Math.round(camera.zoom * 100)}%
          </button>
          <button
            type="button"
            aria-label="Mobile zoom in"
            onClick={() => onZoomBy(1.18)}
            className="p-2 rounded-lg text-[var(--rf-text)] hover:bg-[var(--rf-surface-hover)]"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            aria-label="Mobile fit canvas"
            onClick={onFitToScreen}
            className="p-2 rounded-lg text-[var(--rf-text)] hover:bg-[var(--rf-surface-hover)]"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 5. Compact Bottom Mobile Navigation Bar */}
      <nav
        data-testid="mobile-bottom-nav"
        aria-label="Mobile Workspace Navigation"
        className="pointer-events-auto fixed bottom-0 inset-x-0 z-30 h-14 px-2 pb-safe grid grid-cols-5 items-center border-t border-[var(--rf-border)] bg-[var(--rf-surface)] backdrop-blur-md text-[10px] font-medium"
      >
        <button
          type="button"
          onClick={() =>
            setActiveBottomPopover((prev) => (prev === 'layers' ? null : 'layers'))
          }
          className={`flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-lg ${
            activeBottomPopover === 'layers'
              ? 'text-[var(--rf-accent)]'
              : 'text-[var(--rf-text-muted)]'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Layers</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveBottomPopover(null);
            setSheetDetent((prev) => (prev === 'closed' ? 'half' : 'closed'));
          }}
          className={`flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-lg ${
            sheetDetent !== 'closed'
              ? 'text-[var(--rf-accent)]'
              : 'text-[var(--rf-text-muted)]'
          }`}
        >
          <SlidersHorizontal className="w-4 h-4" />
          <span>Style</span>
        </button>

        <button
          type="button"
          onClick={() =>
            setActiveBottomPopover((prev) => (prev === 'objects' ? null : 'objects'))
          }
          className={`flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-lg ${
            activeBottomPopover === 'objects'
              ? 'text-[var(--rf-accent)]'
              : 'text-[var(--rf-text-muted)]'
          }`}
        >
          <Plus className="w-4 h-4" />
          <span>Objects</span>
        </button>

        <button
          type="button"
          onClick={() =>
            setActiveBottomPopover((prev) => (prev === 'settings' ? null : 'settings'))
          }
          className={`flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-lg ${
            activeBottomPopover === 'settings'
              ? 'text-[var(--rf-accent)]'
              : 'text-[var(--rf-text-muted)]'
          }`}
        >
          <Settings className="w-4 h-4" />
          <span>Settings</span>
        </button>

        <button
          type="button"
          onClick={onToggleZenMode}
          className="flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-lg text-[var(--rf-text-muted)]"
        >
          <Expand className="w-4 h-4" />
          <span>Expand</span>
        </button>
      </nav>
    </div>
  );
};
