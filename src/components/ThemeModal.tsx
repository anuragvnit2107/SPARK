import React, { useMemo, useState } from 'react';
import { Check, Layers, Palette, Search, Sparkles, X } from 'lucide-react';
import { CanvasThemeId, ThemeId } from '../types';
import { CANVAS_THEME_LIST, CanvasTheme, THEME_LIST } from '../themes';

interface ThemeModalProps {
  open: boolean;
  activeUiThemeId: ThemeId;
  activeCanvasThemeId: CanvasThemeId;
  onSelectUiTheme: (id: ThemeId) => void;
  onSelectCanvasTheme: (id: CanvasThemeId) => void;
  onClose: () => void;
}

type CategoryFilter = 'All' | CanvasTheme['category'];

export const ThemeModal: React.FC<ThemeModalProps> = ({
  open,
  activeUiThemeId,
  activeCanvasThemeId,
  onSelectUiTheme,
  onSelectCanvasTheme,
  onClose,
}) => {
  const [category, setCategory] = useState<CategoryFilter>('All');
  const [query, setQuery] = useState('');

  const filteredCanvasThemes = useMemo(() => {
    const q = query.trim().toLowerCase();
    return CANVAS_THEME_LIST.filter((ct) => {
      if (category !== 'All' && ct.category !== category) return false;
      if (q && !ct.name.toLowerCase().includes(q) && !ct.id.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [category, query]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Workspace Themes"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-sm p-4"
    >
      <div className="rf-panel w-full max-w-3xl rounded-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--rf-border)] shrink-0">
          <div className="flex items-center gap-2.5">
            <Palette className="w-4 h-4 text-[var(--rf-accent)]" />
            <div>
              <h2 className="text-base font-semibold text-[var(--rf-text)]">
                Interface &amp; Canvas Themes
              </h2>
              <p className="text-xs text-[var(--rf-text-muted)]">
                Keep your Liquid Glass Emerald bars &amp; sidebars while choosing any of {CANVAS_THEME_LIST.length} canvas themes
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Close Theme Modal"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--rf-text-muted)] hover:bg-[var(--rf-surface-hover)]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto rf-scrollbar space-y-5">
          {/* Section 1: UI Chrome Style (Top Bar & Sidebars) */}
          <section className="space-y-2.5">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--rf-text-muted)]">
              <Sparkles className="w-3.5 h-3.5 text-[var(--rf-accent)]" />
              <span>Top Bar &amp; Sidebar Style</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              {THEME_LIST.map((uiTheme) => {
                const isSelected = uiTheme.id === activeUiThemeId;
                return (
                  <button
                    key={uiTheme.id}
                    type="button"
                    data-testid={`ui-theme-${uiTheme.id}`}
                    onClick={() => onSelectUiTheme(uiTheme.id)}
                    className={`flex items-center justify-between p-2.5 rounded-xl border text-left transition-all ${
                      isSelected
                        ? 'border-[var(--rf-accent)] bg-[var(--rf-accent-soft)] ring-1 ring-[var(--rf-accent)]'
                        : 'border-[var(--rf-border)] bg-[var(--rf-surface-elevated)] hover:bg-[var(--rf-surface-hover)]'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-[var(--rf-text)] truncate">
                        {uiTheme.name}
                      </div>
                      <div className="text-[10px] text-[var(--rf-text-muted)]">
                        {uiTheme.glass ? 'Liquid Glass Chrome' : `${uiTheme.mode} Chrome`}
                      </div>
                    </div>
                    {isSelected && <Check className="w-3.5 h-3.5 text-[var(--rf-accent)] shrink-0" />}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Section 2: Canvas Theme */}
          <section className="space-y-3 pt-2 border-t border-[var(--rf-border)]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--rf-text-muted)]">
                <Layers className="w-3.5 h-3.5 text-[var(--rf-accent)]" />
                <span>Canvas Theme ({CANVAS_THEME_LIST.length})</span>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                {(['All', 'Desktop & Glass', 'Catppuccin', 'Developer Palettes'] as const).map(
                  (cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setCategory(cat)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors whitespace-nowrap ${
                        category === cat
                          ? 'bg-[var(--rf-accent)] text-[var(--rf-accent-fg)]'
                          : 'bg-[var(--rf-surface-elevated)] text-[var(--rf-text-muted)] border border-[var(--rf-border)] hover:text-[var(--rf-text)]'
                      }`}
                    >
                      {cat}
                    </button>
                  )
                )}
              </div>
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[var(--rf-text-muted)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search canvas themes (e.g. Dracula, Nord, Catppuccin, Orchis, Tokyo Night...)"
                className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-[var(--rf-surface-elevated)] border border-[var(--rf-border)] text-xs text-[var(--rf-text)] placeholder:text-[var(--rf-text-muted)] outline-none focus:border-[var(--rf-accent)]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {filteredCanvasThemes.map((ct) => {
                const isSelected = ct.id === activeCanvasThemeId;
                return (
                  <button
                    key={ct.id}
                    type="button"
                    data-testid={`canvas-theme-${ct.id}`}
                    onClick={() => onSelectCanvasTheme(ct.id)}
                    className={`flex items-center justify-between p-2.5 rounded-xl border text-left transition-all ${
                      isSelected
                        ? 'border-[var(--rf-accent)] bg-[var(--rf-accent-soft)] ring-1 ring-[var(--rf-accent)]'
                        : 'border-[var(--rf-border)] bg-[var(--rf-surface-elevated)] hover:bg-[var(--rf-surface-hover)]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className="w-11 h-9 rounded-lg border border-black/20 flex items-center justify-center shrink-0 relative overflow-hidden"
                        style={{ backgroundColor: ct.canvasBg }}
                      >
                        <span className="text-xs font-bold" style={{ color: ct.defaultInk }}>
                          Aa
                        </span>
                        <span
                          className="absolute bottom-0.5 right-0.5 w-2 h-2 rounded-full"
                          style={{ backgroundColor: ct.badgeColor }}
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-[var(--rf-text)] truncate">
                          {ct.name}
                        </div>
                        <div className="text-[10px] text-[var(--rf-text-muted)] capitalize">
                          {ct.mode} · {ct.category === 'Developer Palettes' ? 'Dev' : ct.category}
                        </div>
                        <div className="flex items-center gap-1 mt-1">
                          {ct.swatches.slice(0, 5).map((sw) => (
                            <span
                              key={sw}
                              className="w-2 h-2 rounded-full border border-black/15"
                              style={{ backgroundColor: sw }}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                    {isSelected && <Check className="w-3.5 h-3.5 text-[var(--rf-accent)] shrink-0" />}
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
