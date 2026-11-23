import React, { useState } from 'react';
import {
  Code2,
  Command,
  Download,
  Edit3,
  EyeOff,
  FolderOpen,
  Globe,
  Grid3X3,
  LayoutGrid,
  Menu,
  Palette,
  RotateCcw,
  Sparkles,
  Trash2,
  Type,
} from 'lucide-react';
import { Locale } from '../types';
import { LOCALES, Translations } from '../i18n';

interface MainMenuProps {
  showGrid: boolean;
  shapeSnapEnabled: boolean;
  locale: Locale;
  t: Translations;
  onToggleGrid: () => void;
  onToggleShapeSnap: () => void;
  onChangeLocale: (loc: Locale) => void;
  onOpenFileImport: () => void;
  onOpenExport: () => void;
  onOpenThemes: () => void;
  onOpenFonts: () => void;
  onOpenRustCode: () => void;
  onOpenCommandPalette: () => void;
  onToggleZenMode: () => void;
  onLoadDemoCircuit: () => void;
  onClearCanvas: () => void;
  onOpenCanvasHub?: () => void;
  activeCanvasTitle?: string;
  onRenameActiveCanvas?: (nextTitle: string) => void;
}

export const MainMenu: React.FC<MainMenuProps> = ({
  showGrid,
  shapeSnapEnabled,
  locale,
  t,
  onToggleGrid,
  onToggleShapeSnap,
  onChangeLocale,
  onOpenFileImport,
  onOpenExport,
  onOpenThemes,
  onOpenFonts,
  onOpenRustCode,
  onOpenCommandPalette,
  onToggleZenMode,
  onLoadDemoCircuit,
  onClearCanvas,
  onOpenCanvasHub,
  activeCanvasTitle,
  onRenameActiveCanvas,
}) => {
  const [open, setOpen] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');

  return (
    <div className="relative">
      <button
        type="button"
        aria-label={t.actions.menu}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="rf-panel flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold text-[var(--rf-text)] hover:bg-[var(--rf-surface-hover)] transition-colors whitespace-nowrap shrink-0"
      >
        <Menu className="w-4 h-4" />
        <span>{t.appName}</span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            role="menu"
            className="rf-panel absolute left-0 top-12 z-50 w-64 rounded-xl p-1.5 space-y-0.5 text-xs"
          >
            {activeCanvasTitle && (
              <div className="px-2.5 py-1.5 mb-0.5 rounded-lg bg-[var(--rf-surface-elevated)] border border-[var(--rf-border)]">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--rf-text-muted)]">
                  Active Canvas
                </div>
                {editingTitle && onRenameActiveCanvas ? (
                  <input
                    type="text"
                    autoFocus
                    value={draftTitle}
                    onChange={(e) => setDraftTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        if (draftTitle.trim()) onRenameActiveCanvas(draftTitle.trim());
                        setEditingTitle(false);
                      } else if (e.key === 'Escape') {
                        setEditingTitle(false);
                      }
                    }}
                    onBlur={() => {
                      if (draftTitle.trim()) onRenameActiveCanvas(draftTitle.trim());
                      setEditingTitle(false);
                    }}
                    className="mt-1 w-full px-1.5 py-1 rounded bg-[var(--rf-bg)] border border-[var(--rf-accent)] text-xs font-semibold text-[var(--rf-text)] outline-none"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      if (!onRenameActiveCanvas) return;
                      setDraftTitle(activeCanvasTitle);
                      setEditingTitle(true);
                    }}
                    className="mt-0.5 w-full flex items-center justify-between gap-1.5 text-left font-semibold text-[var(--rf-text)] hover:text-[var(--rf-accent)]"
                  >
                    <span className="truncate">{activeCanvasTitle}</span>
                    {onRenameActiveCanvas && <Edit3 className="w-3 h-3 shrink-0 opacity-70" />}
                  </button>
                )}
              </div>
            )}
            {onOpenCanvasHub && (
              <button
                type="button"
                data-testid="menu-open-canvas-hub"
                onClick={() => {
                  setOpen(false);
                  onOpenCanvasHub();
                }}
                className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg font-semibold text-[var(--rf-accent)] bg-[var(--rf-accent)]/10 hover:bg-[var(--rf-accent)]/20 text-left"
              >
                <span className="flex items-center gap-2.5">
                  <LayoutGrid className="w-4 h-4" />
                  <span>3D Canvas Hub</span>
                </span>
                <span className="text-[10px] opacity-80">Spatial</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onOpenFileImport();
              }}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[var(--rf-text)] hover:bg-[var(--rf-surface-hover)] text-left"
            >
              <FolderOpen className="w-4 h-4 text-[var(--rf-text-muted)]" />
              <span>{t.actions.importFile}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onOpenExport();
              }}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[var(--rf-text)] hover:bg-[var(--rf-surface-hover)] text-left"
            >
              <Download className="w-4 h-4 text-[var(--rf-text-muted)]" />
              <span>{t.actions.export} (PNG, SVG, JSON)</span>
            </button>

            <div className="my-1 border-t border-[var(--rf-border)]" />

            <button
              type="button"
              onClick={onToggleGrid}
              className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-[var(--rf-text)] hover:bg-[var(--rf-surface-hover)] text-left"
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
              className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-[var(--rf-text)] hover:bg-[var(--rf-surface-hover)] text-left"
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
                setOpen(false);
                onOpenThemes();
              }}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[var(--rf-text)] hover:bg-[var(--rf-surface-hover)] text-left"
            >
              <Palette className="w-4 h-4 text-[var(--rf-text-muted)]" />
              <span>{t.actions.themes} (10)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onOpenFonts();
              }}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[var(--rf-text)] hover:bg-[var(--rf-surface-hover)] text-left"
            >
              <Type className="w-4 h-4 text-[var(--rf-text-muted)]" />
              <span>{t.actions.fonts}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onOpenRustCode();
              }}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[var(--rf-text)] hover:bg-[var(--rf-surface-hover)] text-left"
            >
              <Code2 className="w-4 h-4 text-[var(--rf-text-muted)]" />
              <span>{t.actions.rustCore}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onOpenCommandPalette();
              }}
              className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-[var(--rf-text)] hover:bg-[var(--rf-surface-hover)] text-left"
            >
              <span className="flex items-center gap-2.5">
                <Command className="w-4 h-4 text-[var(--rf-text-muted)]" />
                <span>{t.actions.commands}</span>
              </span>
              <span className="font-mono-tabular text-[10px] text-[var(--rf-text-muted)]">Ctrl+K</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onToggleZenMode();
              }}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[var(--rf-text)] hover:bg-[var(--rf-surface-hover)] text-left"
            >
              <EyeOff className="w-4 h-4 text-[var(--rf-text-muted)]" />
              <span>{t.actions.zenMode}</span>
            </button>

            <div className="my-1 border-t border-[var(--rf-border)]" />

            <div className="flex items-center justify-between px-2.5 py-1.5">
              <span className="flex items-center gap-2 text-[var(--rf-text-muted)]">
                <Globe className="w-4 h-4" />
                <span>{t.actions.language}</span>
              </span>
              <select
                aria-label={t.actions.language}
                value={locale}
                onChange={(e) => onChangeLocale(e.target.value as Locale)}
                className="bg-[var(--rf-surface-elevated)] border border-[var(--rf-border)] rounded-md px-1.5 py-1 text-[11px] text-[var(--rf-text)] outline-none"
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
                setOpen(false);
                onLoadDemoCircuit();
              }}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[var(--rf-text)] hover:bg-[var(--rf-surface-hover)] text-left"
            >
              <RotateCcw className="w-4 h-4 text-[var(--rf-text-muted)]" />
              <span>{t.actions.loadDemo}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onClearCanvas();
              }}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-rose-400 hover:bg-rose-500/15 text-left"
            >
              <Trash2 className="w-4 h-4" />
              <span>{t.actions.clearCanvas}</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
};
