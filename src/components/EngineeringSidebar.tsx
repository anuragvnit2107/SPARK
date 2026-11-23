import React, { useMemo, useState } from 'react';
import { Cpu, Search, X } from 'lucide-react';
import { CircuitKind } from '../types';
import { CIRCUIT_CATALOG, buildCircuitGeometry } from '../engineeringComponents';

interface EngineeringSidebarProps {
  open: boolean;
  pendingCircuitKind: CircuitKind | null;
  onSelectCircuit: (kind: CircuitKind) => void;
  onQuickInsertCircuit: (kind: CircuitKind) => void;
  onClose: () => void;
}

const CATEGORIES = [
  'All',
  'Passives',
  'Sources & Ground',
  'Instruments',
  'Semiconductors',
  'Logic Gates',
  'Integrated Circuits',
] as const;

function CircuitPreviewSvg({ kind }: { kind: CircuitKind }) {
  const geom = useMemo(
    () =>
      buildCircuitGeometry({
        id: 'preview',
        type: 'circuit',
        circuitKind: kind,
        icPinCount: 6,
        x: 8,
        y: 6,
        width: 56,
        height: 36,
        angle: 0,
        strokeColor: 'currentColor',
        backgroundColor: 'transparent',
        fillStyle: 'none',
        strokeWidth: 1.5,
        strokeStyle: 'solid',
        sloppiness: 0,
        opacity: 100,
        seed: 1,
        fontFamily: 'cleansans',
        fontSize: 12,
        version: 1,
        updatedAt: 0,
      }),
    [kind]
  );

  return (
    <svg viewBox="0 0 72 48" className="w-14 h-10 text-[var(--rf-text)] shrink-0">
      {geom.screenRect && (
        <rect
          x={geom.screenRect.x}
          y={geom.screenRect.y}
          width={geom.screenRect.width}
          height={geom.screenRect.height}
          fill="rgba(16, 185, 129, 0.14)"
        />
      )}
      {geom.polylines.map((poly, idx) => (
        <polyline
          key={idx}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={poly.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')}
        />
      ))}
      {geom.circles.map((c, idx) => (
        <circle
          key={idx}
          cx={c.cx}
          cy={c.cy}
          r={c.r}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
        />
      ))}
      {geom.dialArc && (
        <path
          d={`M ${geom.dialArc.cx - geom.dialArc.r * 0.85} ${geom.dialArc.cy - geom.dialArc.r * 0.25} A ${geom.dialArc.r} ${geom.dialArc.r} 0 0 1 ${geom.dialArc.cx + geom.dialArc.r * 0.85} ${geom.dialArc.cy - geom.dialArc.r * 0.25}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.3"
        />
      )}
      {geom.probes?.map((pr, idx) => (
        <g key={idx}>
          <line
            x1={pr.leadFrom.x}
            y1={pr.leadFrom.y}
            x2={pr.leadTo.x}
            y2={pr.leadTo.y}
            stroke={pr.color}
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          <circle cx={pr.tip.x} cy={pr.tip.y} r="1.8" fill={pr.color} />
        </g>
      ))}
    </svg>
  );
}

export const EngineeringSidebar: React.FC<EngineeringSidebarProps> = ({
  open,
  pendingCircuitKind,
  onSelectCircuit,
  onQuickInsertCircuit,
  onClose,
}) => {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string>('All');

  if (!open) return null;

  const filtered = CIRCUIT_CATALOG.filter((item) => {
    const matchesCat = category === 'All' || item.category === category;
    const matchesSearch =
      !query.trim() ||
      item.name.toLowerCase().includes(query.toLowerCase()) ||
      item.category.toLowerCase().includes(query.toLowerCase());
    return matchesCat && matchesSearch;
  });

  return (
    <aside
      aria-label="Engineering Circuit Drawer"
      className="rf-panel w-72 max-w-[calc(100vw-16px)] max-h-[calc(100vh-172px)] md:max-h-[calc(100vh-110px)] flex flex-col rounded-xl overflow-hidden"
    >
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-[var(--rf-border)]">
        <div className="flex items-center gap-2">
          <Cpu className="w-4 h-4 text-[var(--rf-accent)]" />
          <h2 className="text-sm font-semibold text-[var(--rf-text)]">Circuit Components</h2>
        </div>
        <button
          type="button"
          aria-label="Close Circuit Drawer"
          onClick={onClose}
          className="p-1 rounded-md text-[var(--rf-text-muted)] hover:bg-[var(--rf-surface-hover)] hover:text-[var(--rf-text)]"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-3 space-y-2.5 border-b border-[var(--rf-border)]">
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--rf-text-muted)]" />
          <input
            type="text"
            aria-label="Search circuit components"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search IEEE symbols..."
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg bg-[var(--rf-surface-elevated)] border border-[var(--rf-border)] text-[var(--rf-text)] outline-none focus:border-[var(--rf-accent)]"
          />
        </div>
        <div className="flex items-center gap-1 overflow-x-auto rf-scrollbar pb-1">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategory(cat)}
              className={`px-2 py-1 rounded-md text-[11px] font-medium whitespace-nowrap shrink-0 transition-colors ${
                category === cat
                  ? 'bg-[var(--rf-accent)] text-[var(--rf-accent-fg)]'
                  : 'text-[var(--rf-text-muted)] hover:bg-[var(--rf-surface-hover)]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto rf-scrollbar p-2.5 space-y-2">
        {pendingCircuitKind && (
          <div className="px-2.5 py-2 rounded-lg text-xs bg-[var(--rf-accent-soft)] text-[var(--rf-text)] border border-[var(--rf-accent)]/40">
            Click anywhere on the canvas to place{' '}
            <span className="font-semibold">
              {CIRCUIT_CATALOG.find((c) => c.kind === pendingCircuitKind)?.name}
            </span>
            .
          </div>
        )}

        {filtered.map((item) => {
          const isArmed = pendingCircuitKind === item.kind;
          return (
            <div
              key={item.kind}
              className={`p-2 rounded-lg border transition-colors ${
                isArmed
                  ? 'border-[var(--rf-accent)] bg-[var(--rf-accent-soft)]'
                  : 'border-[var(--rf-border)] bg-[var(--rf-surface-elevated)] hover:bg-[var(--rf-surface-hover)]'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <CircuitPreviewSvg kind={item.kind} />
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-[var(--rf-text)] truncate">
                    {item.name}
                  </div>
                  <div className="text-[11px] text-[var(--rf-text-muted)] truncate">
                    {item.category}
                    {item.defaultValue ? ` · ${item.defaultValue}` : ' · + / − Probes'}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1.5 mt-2">
                <button
                  type="button"
                  onClick={() => onSelectCircuit(item.kind)}
                  className="flex-1 py-1 px-2 rounded-md text-[11px] font-medium bg-[var(--rf-surface)] border border-[var(--rf-border)] text-[var(--rf-text)] hover:border-[var(--rf-accent)] whitespace-nowrap"
                >
                  {isArmed ? 'Click Canvas...' : 'Place Tool'}
                </button>
                <button
                  type="button"
                  onClick={() => onQuickInsertCircuit(item.kind)}
                  className="py-1 px-2.5 rounded-md text-[11px] font-medium bg-[var(--rf-accent)] text-[var(--rf-accent-fg)] hover:opacity-90 whitespace-nowrap"
                >
                  Insert
                </button>
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="py-8 text-center text-xs text-[var(--rf-text-muted)]">
            No matching circuit symbols.
          </div>
        )}
      </div>
    </aside>
  );
};
