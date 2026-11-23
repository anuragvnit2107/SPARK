import React, { useEffect, useState } from 'react';
import { Activity, Binary, Copy, Globe, Layers, Power, Sigma, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import {
  FillStyle,
  FontFamily,
  Sloppiness,
  StrokeStyle,
  TriangleVariant,
  WaveformType,
  WhiteboardElement,
} from '../types';
import { ForgeTheme } from '../themes';
import { Translations } from '../i18n';
import {
  formatComponentCompactValue,
  getComponentDefaultUnitLabel,
  getComponentSliderSpec,
  isTunableCircuitKind,
  normalizeComponentValueInput,
  parseEngineeringValue,
  parseFrequencyInput,
  sliderPosToValue,
  valueToSliderPos,
} from '../circuitSimulator';
import {
  DigitalCircuitReport,
  isLetterLogicInput,
  isLogicGateKind,
  normalizeLogicInputToken,
} from '../digitalLogic';

interface PropertiesPanelProps {
  theme: ForgeTheme;
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
  onUpdateStyle: (patch: Partial<PropertiesPanelProps['defaultStyle']>) => void;
  onUpdateSelected: (patch: Partial<WhiteboardElement>) => void;
  onDuplicateSelected: () => void;
  onDeleteSelected: () => void;
  onLayerChange: (direction: 'forward' | 'backward') => void;
  onInspectInstrument?: (id: string) => void;
  onInspectWebpage?: (id: string) => void;
  onAutoAssignLogicLetters?: () => void;
  onOpenMathStudio?: (id: string, tab?: 'equation' | 'matrix' | 'engineering' | 'history') => void;
  compactMobile?: boolean;
  onInteractionLockChange?: (locked: boolean) => void;
  t: Translations;
}

export const PropertiesPanel: React.FC<PropertiesPanelProps> = ({
  theme,
  selectedElements,
  digitalReport,
  defaultStyle,
  onUpdateStyle,
  onUpdateSelected,
  onDuplicateSelected,
  onDeleteSelected,
  onLayerChange,
  onInspectInstrument,
  onInspectWebpage,
  onAutoAssignLogicLetters,
  onOpenMathStudio,
  compactMobile = false,
  onInteractionLockChange,
  t,
}) => {
  const first = selectedElements[0];
  const [circuitValDraft, setCircuitValDraft] = useState<string | null>(null);
  const [freqDraft, setFreqDraft] = useState<string | null>(null);

  useEffect(() => {
    setCircuitValDraft(null);
    setFreqDraft(null);
  }, [first?.id]);

  const strokeColor = first ? first.strokeColor : defaultStyle.strokeColor;
  const backgroundColor = first ? first.backgroundColor : defaultStyle.backgroundColor;
  const fillStyle = first ? first.fillStyle : defaultStyle.fillStyle;
  const strokeWidth = first ? first.strokeWidth : defaultStyle.strokeWidth;
  const strokeStyle = first ? first.strokeStyle : defaultStyle.strokeStyle;
  const sloppiness = first ? first.sloppiness : defaultStyle.sloppiness;
  const fontFamily = first ? first.fontFamily : defaultStyle.fontFamily;
  const opacity = first ? first.opacity : defaultStyle.opacity;
  const triangleVariant = first?.triangleVariant || defaultStyle.triangleVariant;

  const setProp = (patch: Partial<WhiteboardElement>) => {
    if (selectedElements.length > 0) {
      onUpdateSelected(patch);
    }
    onUpdateStyle(patch as Partial<PropertiesPanelProps['defaultStyle']>);
  };

  return (
    <aside
      aria-label="Properties Inspector"
      onFocus={() => onInteractionLockChange?.(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          onInteractionLockChange?.(false);
        }
      }}
      className={
        compactMobile
          ? 'w-full space-y-3.5 text-xs'
          : 'rf-panel rf-scrollbar w-60 max-h-[calc(100vh-148px)] overflow-y-auto rounded-xl p-3.5 space-y-3.5 text-xs'
      }
    >
      {/* Stroke Color */}
      <div>
        <div className="font-medium text-[var(--rf-text-muted)] mb-2">{t.inspector.stroke}</div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {theme.swatches.map((color) => (
            <button
              key={color}
              type="button"
              aria-label={`Stroke color ${color}`}
              onClick={() => setProp({ strokeColor: color })}
              style={{ backgroundColor: color }}
              className={`w-6 h-6 rounded-md border transition-transform ${
                strokeColor === color
                  ? 'ring-2 ring-[var(--rf-accent)] ring-offset-1 ring-offset-[var(--rf-surface-elevated)] scale-105'
                  : 'border-[var(--rf-border)]'
              }`}
            />
          ))}
          <label
            aria-label="Custom stroke color"
            style={{
              background:
                'conic-gradient(from 0deg, #ef4444, #f59e0b, #10b981, #3b82f6, #a855f7, #ef4444)',
            }}
            className="relative w-6 h-6 rounded-md border border-[var(--rf-border)] overflow-hidden cursor-pointer flex items-center justify-center"
            title="Custom stroke color"
          >
            <span
              className="w-3 h-3 rounded-sm border border-black/30 pointer-events-none"
              style={{ backgroundColor: strokeColor }}
            />
            <input
              type="color"
              value={strokeColor}
              onClick={() => onInteractionLockChange?.(true)}
              onChange={(e) => setProp({ strokeColor: e.target.value })}
              onBlur={() => onInteractionLockChange?.(false)}
              className="absolute inset-0 opacity-0 cursor-pointer"
            />
          </label>
        </div>
      </div>

      {/* Background Fill Colors — single compact row matching previous layout + 1 Dark Glass swatch */}
      <div>
        <div className="font-medium text-[var(--rf-text-muted)] mb-2">{t.inspector.fill}</div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {theme.fillSwatches.map((bg) => {
            const isTransparent = bg === 'transparent';
            return (
              <button
                key={bg}
                type="button"
                aria-label={isTransparent ? 'Transparent background' : `Background ${bg}`}
                onClick={() =>
                  setProp({
                    backgroundColor: bg,
                    fillStyle: isTransparent ? 'none' : fillStyle === 'none' ? 'solid' : fillStyle,
                  })
                }
                style={{
                  backgroundColor: isTransparent ? 'transparent' : bg,
                  backgroundImage: isTransparent
                    ? 'linear-gradient(45deg, rgba(148,163,184,0.28) 25%, transparent 25%, transparent 75%, rgba(148,163,184,0.28) 75%)'
                    : undefined,
                  backgroundSize: '8px 8px',
                }}
                className={`w-6 h-6 rounded-md border transition-transform ${
                  backgroundColor === bg
                    ? 'ring-2 ring-[var(--rf-accent)] ring-offset-1 ring-offset-[var(--rf-surface-elevated)] scale-105'
                    : 'border-[var(--rf-border)]'
                }`}
              />
            );
          })}
          <button
            key="dark-glass"
            type="button"
            data-testid="glass-swatch-dark-obsidian"
            aria-label="Dark Glass background"
            title="Dark Glass"
            onClick={() =>
              setProp({
                backgroundColor: 'rgba(15, 23, 42, 0.34)',
                fillStyle: fillStyle === 'none' ? 'solid' : fillStyle,
              })
            }
            style={{
              backgroundColor: 'rgba(15, 23, 42, 0.34)',
              backgroundImage:
                'linear-gradient(135deg, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0.02) 100%)',
              backdropFilter: 'blur(6px)',
            }}
            className={`w-6 h-6 rounded-md border transition-transform ${
              backgroundColor === 'rgba(15, 23, 42, 0.34)'
                ? 'ring-2 ring-[var(--rf-accent)] ring-offset-1 ring-offset-[var(--rf-surface-elevated)] scale-105 border-white/60'
                : 'border-[var(--rf-border)]'
            }`}
          />
        </div>
      </div>

      {/* Fill Style */}
      <div>
        <div className="font-medium text-[var(--rf-text-muted)] mb-1.5">{t.inspector.fillStyle}</div>
        <div className="grid grid-cols-4 gap-1">
          {(
            [
              { id: 'none', label: 'None' },
              { id: 'solid', label: 'Solid' },
              { id: 'hachure', label: 'Hatch' },
              { id: 'cross-hatch', label: 'Cross' },
            ] as { id: FillStyle; label: string }[]
          ).map((fs) => (
            <button
              key={fs.id}
              type="button"
              onClick={() =>
                setProp({
                  fillStyle: fs.id,
                  backgroundColor:
                    fs.id !== 'none' && backgroundColor === 'transparent'
                      ? theme.fillSwatches[1]
                      : backgroundColor,
                })
              }
              className={`py-1.5 px-1 rounded-md text-[11px] font-medium transition-colors whitespace-nowrap ${
                fillStyle === fs.id
                  ? 'bg-[var(--rf-accent)] text-[var(--rf-accent-fg)]'
                  : 'bg-[var(--rf-surface-elevated)] text-[var(--rf-text)] hover:bg-[var(--rf-surface-hover)] border border-[var(--rf-border)]'
              }`}
            >
              {fs.label}
            </button>
          ))}
        </div>
      </div>

      {/* Stroke Width */}
      <div>
        <div className="font-medium text-[var(--rf-text-muted)] mb-1.5">{t.inspector.strokeWidth}</div>
        <div className="grid grid-cols-3 gap-1">
          {[
            { val: 1.5, label: 'Thin' },
            { val: 2.5, label: 'Medium' },
            { val: 4.2, label: 'Bold' },
          ].map((sw) => (
            <button
              key={sw.label}
              type="button"
              onClick={() => setProp({ strokeWidth: sw.val })}
              className={`py-1.5 rounded-md text-[11px] font-medium transition-colors whitespace-nowrap ${
                Math.abs(strokeWidth - sw.val) < 0.4
                  ? 'bg-[var(--rf-accent)] text-[var(--rf-accent-fg)]'
                  : 'bg-[var(--rf-surface-elevated)] text-[var(--rf-text)] hover:bg-[var(--rf-surface-hover)] border border-[var(--rf-border)]'
              }`}
            >
              {sw.label}
            </button>
          ))}
        </div>
      </div>

      {/* Stroke Style */}
      <div>
        <div className="font-medium text-[var(--rf-text-muted)] mb-1.5">{t.inspector.strokeStyle}</div>
        <div className="grid grid-cols-3 gap-1">
          {(
            [
              { id: 'solid', label: 'Solid' },
              { id: 'dashed', label: 'Dashed' },
              { id: 'dotted', label: 'Dotted' },
            ] as { id: StrokeStyle; label: string }[]
          ).map((ss) => (
            <button
              key={ss.id}
              type="button"
              onClick={() => setProp({ strokeStyle: ss.id })}
              className={`py-1.5 rounded-md text-[11px] font-medium transition-colors whitespace-nowrap ${
                strokeStyle === ss.id
                  ? 'bg-[var(--rf-accent)] text-[var(--rf-accent-fg)]'
                  : 'bg-[var(--rf-surface-elevated)] text-[var(--rf-text)] hover:bg-[var(--rf-surface-hover)] border border-[var(--rf-border)]'
              }`}
            >
              {ss.label}
            </button>
          ))}
        </div>
      </div>

      {/* Sloppiness */}
      <div>
        <div className="font-medium text-[var(--rf-text-muted)] mb-1.5">{t.inspector.sloppiness}</div>
        <div className="grid grid-cols-3 gap-1">
          {(
            [
              { val: 0, label: 'Architect' },
              { val: 1, label: 'Artist' },
              { val: 2, label: 'Cartoon' },
            ] as { val: Sloppiness; label: string }[]
          ).map((sl) => (
            <button
              key={sl.val}
              type="button"
              onClick={() => setProp({ sloppiness: sl.val })}
              className={`py-1.5 rounded-md text-[11px] font-medium transition-colors whitespace-nowrap ${
                sloppiness === sl.val
                  ? 'bg-[var(--rf-accent)] text-[var(--rf-accent-fg)]'
                  : 'bg-[var(--rf-surface-elevated)] text-[var(--rf-text)] hover:bg-[var(--rf-surface-hover)] border border-[var(--rf-border)]'
              }`}
            >
              {sl.label}
            </button>
          ))}
        </div>
      </div>

      {/* Curated Technical Font */}
      <div>
        <div className="font-medium text-[var(--rf-text-muted)] mb-1.5">{t.inspector.font}</div>
        <div className="grid grid-cols-2 gap-1">
          {(
            [
              { id: 'scribble', label: 'Scribble' },
              { id: 'casual', label: 'Casual' },
              { id: 'heavy', label: 'Heavy' },
              { id: 'cleansans', label: 'CleanSans' },
            ] as { id: FontFamily; label: string }[]
          ).map((ff) => (
            <button
              key={ff.id}
              type="button"
              onClick={() => setProp({ fontFamily: ff.id })}
              className={`py-1.5 px-2 rounded-md text-[11px] font-medium transition-colors whitespace-nowrap ${
                fontFamily === ff.id
                  ? 'bg-[var(--rf-accent)] text-[var(--rf-accent-fg)]'
                  : 'bg-[var(--rf-surface-elevated)] text-[var(--rf-text)] hover:bg-[var(--rf-surface-hover)] border border-[var(--rf-border)]'
              }`}
            >
              {ff.label}
            </button>
          ))}
        </div>
      </div>

      {/* Contextual Triangle Variant */}
      {first?.type === 'triangle' && (
        <div>
          <div className="font-medium text-[var(--rf-text-muted)] mb-1.5">{t.inspector.triangleType}</div>
          <div className="grid grid-cols-2 gap-1">
            {(
              [
                { id: 'equilateral', label: 'Equilateral' },
                { id: 'isosceles', label: 'Isosceles' },
                { id: 'right-left', label: 'Right (L)' },
                { id: 'right-right', label: 'Right (R)' },
              ] as { id: TriangleVariant; label: string }[]
            ).map((tv) => (
              <button
                key={tv.id}
                type="button"
                onClick={() => setProp({ triangleVariant: tv.id, points: undefined })}
                className={`py-1.5 px-1.5 rounded-md text-[11px] font-medium whitespace-nowrap ${
                  triangleVariant === tv.id
                    ? 'bg-[var(--rf-accent)] text-[var(--rf-accent-fg)]'
                    : 'bg-[var(--rf-surface-elevated)] text-[var(--rf-text)] border border-[var(--rf-border)]'
                }`}
              >
                {tv.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Contextual Circuit Value, Sliders, Frequency & IC Pin Config */}
      {first?.type === 'circuit' && (
        <div className="space-y-2.5 pt-1 border-t border-[var(--rf-border)]">
          {(() => {
            const kind = first.circuitKind;
            const tunable = isTunableCircuitKind(kind);
            const fallbackNum =
              kind === 'resistor'
                ? 1000
                : kind === 'capacitor'
                ? 10e-6
                : kind === 'inductor'
                ? 0.1
                : kind === 'dc-source'
                ? 12
                : 10;
            const numericVal = parseEngineeringValue(first.componentValue, fallbackNum);
            const spec = kind ? getComponentSliderSpec(kind, numericVal) : null;
            const sliderPos = spec ? Math.round(valueToSliderPos(numericVal, spec)) : 0;
            const displayVal =
              circuitValDraft !== null ? circuitValDraft : first.componentValue || '';
            const previewNorm =
              tunable && kind && circuitValDraft !== null
                ? normalizeComponentValueInput(kind, circuitValDraft).formatted
                : null;

            return (
              <>
                <label className="block">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-[var(--rf-text-muted)]">
                      {t.inspector.value}
                      {tunable && kind ? (
                        <span className="ml-1 text-[10px] opacity-80">
                          ({getComponentDefaultUnitLabel(kind)})
                        </span>
                      ) : null}
                    </span>
                    {previewNorm && previewNorm !== displayVal && (
                      <span className="text-[10px] font-mono-tabular text-[var(--rf-accent)]">
                        → {previewNorm}
                      </span>
                    )}
                  </div>
                  <input
                    type="text"
                    data-testid="inspector-value-input"
                    value={displayVal}
                    onChange={(e) => {
                      const raw = e.target.value;
                      setCircuitValDraft(raw);
                      if (tunable && kind && raw.trim()) {
                        const norm = normalizeComponentValueInput(kind, raw);
                        onUpdateSelected({ componentValue: norm.formatted });
                      } else {
                        onUpdateSelected({ componentValue: raw });
                      }
                    }}
                    onBlur={() => {
                      if (tunable && kind && circuitValDraft !== null) {
                        const norm = normalizeComponentValueInput(kind, circuitValDraft);
                        onUpdateSelected({ componentValue: norm.formatted });
                      }
                      setCircuitValDraft(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && tunable && kind) {
                        const norm = normalizeComponentValueInput(
                          kind,
                          circuitValDraft !== null ? circuitValDraft : displayVal
                        );
                        onUpdateSelected({ componentValue: norm.formatted });
                        setCircuitValDraft(null);
                        e.currentTarget.blur();
                      }
                    }}
                    className="w-full px-2.5 py-1.5 rounded-md bg-[var(--rf-surface-elevated)] border border-[var(--rf-border)] text-[var(--rf-text)] text-xs font-mono-tabular outline-none focus:border-[var(--rf-accent)]"
                    placeholder={
                      kind === 'capacitor'
                        ? 'e.g. 10 (→10µF)'
                        : kind === 'inductor'
                        ? 'e.g. 100 (→100mH)'
                        : kind === 'dc-source' || kind === 'ac-source' || kind === 'function-generator'
                        ? 'e.g. 12 (→12V)'
                        : 'e.g. 4.7k (→4.7kΩ)'
                    }
                  />
                </label>

                {tunable && kind && spec && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[10px] text-[var(--rf-text-muted)]">
                      <span>{spec.label}</span>
                      <span className="font-mono-tabular text-[var(--rf-text)]">
                        {formatComponentCompactValue(kind, numericVal)}
                      </span>
                    </div>
                    <input
                      type="range"
                      data-testid="inspector-value-slider"
                      aria-label={`${spec.label} slider`}
                      min={0}
                      max={1000}
                      step={1}
                      value={sliderPos}
                      onChange={(e) => {
                        const nextNum = sliderPosToValue(Number(e.target.value), spec);
                        setCircuitValDraft(null);
                        onUpdateSelected({
                          componentValue: formatComponentCompactValue(kind, nextNum),
                        });
                      }}
                      className="w-full accent-[var(--rf-accent)] cursor-pointer"
                    />
                  </div>
                )}
              </>
            );
          })()}

          {first.circuitKind === 'function-generator' && (
            <div>
              <div className="font-medium text-[var(--rf-text-muted)] mb-1.5">Waveform Shape</div>
              <div className="grid grid-cols-3 gap-1">
                {(
                  [
                    { id: 'sine', label: 'Sine' },
                    { id: 'triangle', label: 'Triangle' },
                    { id: 'square', label: 'Square' },
                  ] as { id: WaveformType; label: string }[]
                ).map((wf) => (
                  <button
                    key={wf.id}
                    type="button"
                    data-testid={`inspector-waveform-${wf.id}`}
                    onClick={() => onUpdateSelected({ waveformType: wf.id })}
                    className={`py-1.5 rounded-md text-[11px] font-medium whitespace-nowrap ${
                      (first.waveformType || 'sine') === wf.id
                        ? 'bg-[var(--rf-accent)] text-[var(--rf-accent-fg)]'
                        : 'bg-[var(--rf-surface-elevated)] text-[var(--rf-text)] border border-[var(--rf-border)] hover:bg-[var(--rf-surface-hover)]'
                    }`}
                  >
                    {wf.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {(first.circuitKind === 'ac-source' || first.circuitKind === 'function-generator') && (
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-medium text-[var(--rf-text-muted)]">Frequency (Hz)</span>
                <input
                  type="text"
                  data-testid="inspector-freq-input"
                  value={freqDraft !== null ? freqDraft : String(first.frequencyHz ?? 60)}
                  onChange={(e) => {
                    const raw = e.target.value;
                    setFreqDraft(raw);
                    const parsed = parseFrequencyInput(raw, -1);
                    if (parsed > 0) onUpdateSelected({ frequencyHz: parsed });
                  }}
                  onBlur={() => {
                    if (freqDraft !== null) {
                      onUpdateSelected({
                        frequencyHz: parseFrequencyInput(freqDraft, first.frequencyHz ?? 60),
                      });
                      setFreqDraft(null);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && freqDraft !== null) {
                      onUpdateSelected({
                        frequencyHz: parseFrequencyInput(freqDraft, first.frequencyHz ?? 60),
                      });
                      setFreqDraft(null);
                      e.currentTarget.blur();
                    }
                  }}
                  className="w-20 px-2 py-0.5 rounded bg-[var(--rf-surface-elevated)] border border-[var(--rf-border)] text-[var(--rf-text)] text-xs font-mono-tabular text-right outline-none focus:border-[var(--rf-accent)]"
                />
              </div>
              <input
                type="range"
                data-testid="inspector-freq-slider"
                aria-label="AC Source Frequency slider"
                min={0}
                max={1000}
                step={1}
                value={Math.round(
                  valueToSliderPos(first.frequencyHz ?? 60, {
                    min: 1,
                    max: 100_000,
                    scale: 'log',
                    label: 'Frequency',
                  })
                )}
                onChange={(e) => {
                  const nextHz = Math.max(
                    1,
                    Math.round(
                      sliderPosToValue(Number(e.target.value), {
                        min: 1,
                        max: 100_000,
                        scale: 'log',
                        label: 'Frequency',
                      })
                    )
                  );
                  setFreqDraft(null);
                  onUpdateSelected({ frequencyHz: nextHz });
                }}
                className="w-full accent-[var(--rf-accent)] cursor-pointer"
              />
            </div>
          )}

          {first.circuitKind === 'switch' && (
            <button
              type="button"
              data-testid="inspector-switch-toggle"
              onClick={() =>
                onUpdateSelected({
                  switchClosed: !first.switchClosed,
                  componentValue: !first.switchClosed ? 'CLOSED' : 'OPEN',
                })
              }
              className={`w-full flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg text-[11px] font-semibold border whitespace-nowrap ${
                first.switchClosed
                  ? 'bg-emerald-600 text-white border-transparent'
                  : 'bg-[var(--rf-surface-elevated)] text-[var(--rf-text)] border-[var(--rf-border)] hover:border-[var(--rf-accent)]'
              }`}
            >
              <Power className="w-3.5 h-3.5 shrink-0" />
              <span>{first.switchClosed ? 'Switch: CLOSED (ON)' : 'Switch: OPEN (OFF)'}</span>
            </button>
          )}

          {isLogicGateKind(first.circuitKind) && (
            (() => {
              const gateEval = digitalReport?.gateMap?.[first.id];
              const isNot = first.circuitKind === 'gate-not';
              const letterMode =
                digitalReport?.mode === 'symbolic' ||
                isLetterLogicInput(first.logicInputA) ||
                (!isNot && isLetterLogicInput(first.logicInputB));
              const valA = first.logicInputA ?? '0';
              const valB = first.logicInputB ?? '0';
              return (
                <div className="space-y-2 pt-1 border-t border-[var(--rf-border)]">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-[var(--rf-text-muted)]">Logic Inputs</span>
                    <span className="text-[10px] font-mono-tabular text-[var(--rf-accent)]">
                      {letterMode ? 'Letters Mode' : 'Binary 0/1'}
                    </span>
                  </div>

                  {digitalReport && !digitalReport.valid && (
                    <div className="p-2 rounded-lg border border-amber-500/40 bg-amber-500/12 text-[11px] text-amber-300 space-y-1.5">
                      <div>{digitalReport.validationError}</div>
                      {onAutoAssignLogicLetters && (
                        <button
                          type="button"
                          onClick={onAutoAssignLogicLetters}
                          className="w-full py-1 px-2 rounded bg-[var(--rf-accent)] text-[var(--rf-accent-fg)] font-semibold whitespace-nowrap"
                        >
                          Convert All to Letters (A, B, C...)
                        </button>
                      )}
                    </div>
                  )}

                  {/* Input A */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[10px] text-[var(--rf-text-muted)]">
                      <span>Pin A</span>
                      {gateEval?.inputAWiredFrom && (
                        <span className="font-mono-tabular text-[var(--rf-accent)]">
                          ← {gateEval.inputAWiredFrom}
                        </span>
                      )}
                    </div>
                    {gateEval?.inputAWiredFrom ? (
                      <div className="px-2 py-1 rounded bg-[var(--rf-surface-elevated)] border border-[var(--rf-border)] font-mono-tabular text-[var(--rf-text)]">
                        {gateEval.inputALabel}
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          disabled={letterMode}
                          onClick={() => onUpdateSelected({ logicInputA: '0' })}
                          className={`px-2 py-1 rounded font-mono-tabular font-semibold border disabled:opacity-35 ${
                            valA === '0'
                              ? 'bg-[var(--rf-accent)] text-[var(--rf-accent-fg)] border-transparent'
                              : 'bg-[var(--rf-surface-elevated)] border-[var(--rf-border)] text-[var(--rf-text)]'
                          }`}
                        >
                          0
                        </button>
                        <button
                          type="button"
                          disabled={letterMode}
                          onClick={() => onUpdateSelected({ logicInputA: '1' })}
                          className={`px-2 py-1 rounded font-mono-tabular font-semibold border disabled:opacity-35 ${
                            valA === '1'
                              ? 'bg-emerald-600 text-white border-transparent'
                              : 'bg-[var(--rf-surface-elevated)] border-[var(--rf-border)] text-[var(--rf-text)]'
                          }`}
                        >
                          1
                        </button>
                        <input
                          type="text"
                          data-testid="inspector-logic-a"
                          aria-label="Logic Input A"
                          value={valA}
                          maxLength={4}
                          onChange={(e) => {
                            const v = e.target.value.trim()
                              ? normalizeLogicInputToken(e.target.value)
                              : '0';
                            onUpdateSelected({ logicInputA: v });
                          }}
                          className="flex-1 min-w-0 px-2 py-1 rounded bg-[var(--rf-surface-elevated)] border border-[var(--rf-border)] text-[var(--rf-text)] font-mono-tabular text-center outline-none focus:border-[var(--rf-accent)]"
                          placeholder="0/1/A"
                        />
                      </div>
                    )}
                  </div>

                  {/* Input B */}
                  {!isNot && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[10px] text-[var(--rf-text-muted)]">
                        <span>Pin B</span>
                        {gateEval?.inputBWiredFrom && (
                          <span className="font-mono-tabular text-[var(--rf-accent)]">
                            ← {gateEval.inputBWiredFrom}
                          </span>
                        )}
                      </div>
                      {gateEval?.inputBWiredFrom ? (
                        <div className="px-2 py-1 rounded bg-[var(--rf-surface-elevated)] border border-[var(--rf-border)] font-mono-tabular text-[var(--rf-text)]">
                          {gateEval.inputBLabel}
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            disabled={letterMode}
                            onClick={() => onUpdateSelected({ logicInputB: '0' })}
                            className={`px-2 py-1 rounded font-mono-tabular font-semibold border disabled:opacity-35 ${
                              valB === '0'
                                ? 'bg-[var(--rf-accent)] text-[var(--rf-accent-fg)] border-transparent'
                                : 'bg-[var(--rf-surface-elevated)] border-[var(--rf-border)] text-[var(--rf-text)]'
                            }`}
                          >
                            0
                          </button>
                          <button
                            type="button"
                            disabled={letterMode}
                            onClick={() => onUpdateSelected({ logicInputB: '1' })}
                            className={`px-2 py-1 rounded font-mono-tabular font-semibold border disabled:opacity-35 ${
                              valB === '1'
                                ? 'bg-emerald-600 text-white border-transparent'
                                : 'bg-[var(--rf-surface-elevated)] border-[var(--rf-border)] text-[var(--rf-text)]'
                            }`}
                          >
                            1
                          </button>
                          <input
                            type="text"
                            data-testid="inspector-logic-b"
                            aria-label="Logic Input B"
                            value={valB}
                            maxLength={4}
                            onChange={(e) => {
                              const v = e.target.value.trim()
                                ? normalizeLogicInputToken(e.target.value)
                                : '0';
                              onUpdateSelected({ logicInputB: v });
                            }}
                            className="flex-1 min-w-0 px-2 py-1 rounded bg-[var(--rf-surface-elevated)] border border-[var(--rf-border)] text-[var(--rf-text)] font-mono-tabular text-center outline-none focus:border-[var(--rf-accent)]"
                            placeholder="0/1/B"
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {gateEval && (
                    <div
                      data-testid="inspector-logic-output"
                      className="px-2.5 py-1.5 rounded-lg bg-[#060d15] border border-[var(--rf-border)] font-mono-tabular text-emerald-400 flex items-center justify-between"
                    >
                      <span className="text-[10px] text-slate-400">Output Y</span>
                      <span className="font-semibold">
                        {gateEval.outputBinary !== null
                          ? gateEval.outputBinary
                          : gateEval.outputExpr}
                      </span>
                    </div>
                  )}
                </div>
              );
            })()
          )}

          {first.circuitKind === 'ic-chip' && (
            <label className="block">
              <span className="font-medium text-[var(--rf-text-muted)] block mb-1">
                {t.inspector.icPins}: <span className="font-mono-tabular">{first.icPinCount || 8}</span>
              </span>
              <input
                type="range"
                min={4}
                max={12}
                step={2}
                value={first.icPinCount || 8}
                onChange={(e) => onUpdateSelected({ icPinCount: Number(e.target.value) })}
                className="w-full accent-[var(--rf-accent)]"
              />
            </label>
          )}
          {selectedElements.length === 1 &&
            onInspectInstrument &&
            (first.circuitKind === 'voltmeter' ||
              first.circuitKind === 'ammeter' ||
              first.circuitKind === 'oscilloscope' ||
              first.circuitKind === 'function-generator' ||
              isLogicGateKind(first.circuitKind)) && (
              <button
                type="button"
                data-testid="inspector-open-instrument"
                onClick={() => onInspectInstrument(first.id)}
                className="w-full flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg text-[11px] font-semibold bg-[var(--rf-accent)] text-[var(--rf-accent-fg)] hover:opacity-95 whitespace-nowrap"
              >
                {isLogicGateKind(first.circuitKind) ? (
                  <Binary className="w-3.5 h-3.5 shrink-0" />
                ) : (
                  <Activity className="w-3.5 h-3.5 shrink-0" />
                )}
                <span>
                  {first.circuitKind === 'oscilloscope'
                    ? 'Open CRO Waveforms'
                    : first.circuitKind === 'function-generator'
                    ? 'Open Function Generator'
                    : isLogicGateKind(first.circuitKind)
                    ? 'Open Logic Study'
                    : 'Open Live Meter'}
                </span>
              </button>
            )}
        </div>
      )}

      {/* Contextual Webpage Block Inspector */}
      {first?.type === 'webpage' && selectedElements.length === 1 && (
        <div className="space-y-2.5 pt-1 border-t border-[var(--rf-border)]">
          <label className="block">
            <span className="font-medium text-[var(--rf-text-muted)] block mb-1">Webpage Title</span>
            <input
              type="text"
              value={first.webpageTitle || 'index.html'}
              onChange={(e) => onUpdateSelected({ webpageTitle: e.target.value })}
              className="w-full px-2.5 py-1.5 rounded-md bg-[var(--rf-surface-elevated)] border border-[var(--rf-border)] text-[var(--rf-text)] text-xs font-mono-tabular outline-none focus:border-[var(--rf-accent)]"
            />
          </label>
          {onInspectWebpage && (
            <button
              type="button"
              data-testid="inspector-open-webpage"
              onClick={() => onInspectWebpage(first.id)}
              className="w-full flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg text-[11px] font-semibold bg-[var(--rf-accent)] text-[var(--rf-accent-fg)] hover:opacity-95 whitespace-nowrap"
            >
              <Globe className="w-3.5 h-3.5 shrink-0" />
              <span>Open HTML / CSS / JS Studio</span>
            </button>
          )}
        </div>
      )}

      {/* Contextual Math Equation / Matrix Inspector */}
      {(first?.type === 'math-equation' || first?.type === 'math-matrix') &&
        selectedElements.length === 1 && (
          <div className="space-y-2 pt-1 border-t border-[var(--rf-border)]">
            <div className="font-medium text-[var(--rf-text-muted)]">
              {first.type === 'math-matrix' ? 'Matrix Inspector' : 'Equation Inspector'}
            </div>
            {first.type === 'math-equation' && (
              <input
                type="text"
                value={first.mathRaw || ''}
                onChange={(e) => onUpdateSelected({ mathRaw: e.target.value })}
                className="w-full px-2 py-1.5 rounded-md bg-[var(--rf-surface-elevated)] border border-[var(--rf-border)] text-[var(--rf-text)] text-xs font-mono-tabular outline-none focus:border-[var(--rf-accent)]"
                placeholder="f(x) = x^2"
              />
            )}
            {first.type === 'math-matrix' && (
              <input
                type="text"
                value={first.matrixName || 'A'}
                onChange={(e) => onUpdateSelected({ matrixName: e.target.value })}
                className="w-full px-2 py-1.5 rounded-md bg-[var(--rf-surface-elevated)] border border-[var(--rf-border)] text-[var(--rf-text)] text-xs font-mono-tabular outline-none focus:border-[var(--rf-accent)]"
                placeholder="Matrix name"
              />
            )}
            {onOpenMathStudio && (
              <button
                type="button"
                onClick={() =>
                  onOpenMathStudio(first.id, first.type === 'math-matrix' ? 'matrix' : 'equation')
                }
                className="w-full flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg text-[11px] font-semibold bg-[var(--rf-accent)] text-[var(--rf-accent-fg)] hover:opacity-95 whitespace-nowrap"
              >
                <Sigma className="w-3.5 h-3.5 shrink-0" />
                <span>Open Math Studio</span>
              </button>
            )}
          </div>
        )}

      {/* Contextual 2D Graph Limits, Equations & Style Inspector */}
      {first?.type === 'math-graph-2d' && first.graph2DConfig && selectedElements.length === 1 && (
        <div className="space-y-2.5 pt-1 border-t border-[var(--rf-border)]">
          <div className="font-medium text-[var(--rf-text-muted)]">2D Graph Bounds & Options</div>
          <div className="grid grid-cols-2 gap-1.5">
            {(
              [
                ['xMin', 'X Min'],
                ['xMax', 'X Max'],
                ['yMin', 'Y Min'],
                ['yMax', 'Y Max'],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="block">
                <span className="text-[10px] text-[var(--rf-text-muted)]">{label}</span>
                <input
                  type="number"
                  step="any"
                  value={first.graph2DConfig!.bounds[key]}
                  onChange={(e) => {
                    const num = Number(e.target.value);
                    if (!Number.isFinite(num)) return;
                    onUpdateSelected({
                      graph2DConfig: {
                        ...first.graph2DConfig!,
                        bounds: { ...first.graph2DConfig!.bounds, [key]: num },
                      },
                    });
                  }}
                  className="w-full px-1.5 py-1 rounded bg-[var(--rf-surface-elevated)] border border-[var(--rf-border)] text-[var(--rf-text)] font-mono-tabular text-[11px]"
                />
              </label>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-1">
            {(['rad', 'deg'] as const).map((unit) => (
              <button
                key={unit}
                type="button"
                onClick={() =>
                  onUpdateSelected({
                    graph2DConfig: { ...first.graph2DConfig!, angleUnit: unit },
                  })
                }
                className={`py-1 rounded text-[10px] font-semibold uppercase ${
                  first.graph2DConfig!.angleUnit === unit
                    ? 'bg-[var(--rf-accent)] text-[var(--rf-accent-fg)]'
                    : 'bg-[var(--rf-surface-elevated)] text-[var(--rf-text)] border border-[var(--rf-border)]'
                }`}
              >
                {unit}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-1 text-[10px]">
            {(
              [
                ['showGrid', 'Major Grid'],
                ['showMinorGrid', 'Minor Grid'],
                ['showAxes', 'Axes'],
                ['showLegend', 'Legend'],
                ['showIntersections', 'Intersections'],
                ['showConicFeatures', 'Conic Foci'],
              ] as const
            ).map(([flag, lbl]) => (
              <label
                key={flag}
                className="flex items-center gap-1.5 px-1.5 py-1 rounded bg-[var(--rf-surface-elevated)] border border-[var(--rf-border)] cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={Boolean(first.graph2DConfig![flag])}
                  onChange={(e) =>
                    onUpdateSelected({
                      graph2DConfig: { ...first.graph2DConfig!, [flag]: e.target.checked },
                    })
                  }
                  className="accent-[var(--rf-accent)]"
                />
                <span className="truncate text-[var(--rf-text)]">{lbl}</span>
              </label>
            ))}
          </div>

          <div className="space-y-1">
            <div className="text-[10px] font-medium text-[var(--rf-text-muted)]">
              Curves ({first.graph2DConfig.equations.length})
            </div>
            {first.graph2DConfig.equations.map((eq, idx) => (
              <div
                key={eq.id}
                className="flex items-center gap-1 px-1.5 py-1 rounded bg-[var(--rf-surface-elevated)] border border-[var(--rf-border)]"
              >
                <input
                  type="color"
                  value={eq.color}
                  onChange={(e) => {
                    const nextEqs = first.graph2DConfig!.equations.map((item, i) =>
                      i === idx ? { ...item, color: e.target.value } : item
                    );
                    onUpdateSelected({
                      graph2DConfig: { ...first.graph2DConfig!, equations: nextEqs },
                    });
                  }}
                  className="w-4 h-4 rounded border-0 bg-transparent cursor-pointer shrink-0"
                />
                <input
                  type="text"
                  value={eq.expression}
                  onChange={(e) => {
                    const nextEqs = first.graph2DConfig!.equations.map((item, i) =>
                      i === idx ? { ...item, expression: e.target.value, label: e.target.value } : item
                    );
                    onUpdateSelected({
                      graph2DConfig: { ...first.graph2DConfig!, equations: nextEqs },
                    });
                  }}
                  className="flex-1 min-w-0 bg-transparent text-[10px] font-mono-tabular text-[var(--rf-text)] outline-none"
                />
                <input
                  type="checkbox"
                  checked={eq.visible}
                  onChange={(e) => {
                    const nextEqs = first.graph2DConfig!.equations.map((item, i) =>
                      i === idx ? { ...item, visible: e.target.checked } : item
                    );
                    onUpdateSelected({
                      graph2DConfig: { ...first.graph2DConfig!, equations: nextEqs },
                    });
                  }}
                  className="accent-[var(--rf-accent)] shrink-0"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Contextual 3D & Contour Graph Inspector */}
      {first?.type === 'math-graph-3d' && first.graph3DConfig && selectedElements.length === 1 && (
        <div className="space-y-2 pt-1 border-t border-[var(--rf-border)]">
          <div className="font-medium text-[var(--rf-text-muted)]">3D Surface Options</div>
          <label className="block">
            <span className="text-[10px] text-[var(--rf-text-muted)]">f(x, y)</span>
            <input
              type="text"
              value={first.graph3DConfig.expression}
              onChange={(e) =>
                onUpdateSelected({
                  graph3DConfig: { ...first.graph3DConfig!, expression: e.target.value },
                })
              }
              className="w-full px-2 py-1 rounded bg-[var(--rf-surface-elevated)] border border-[var(--rf-border)] text-[var(--rf-text)] font-mono-tabular text-[11px]"
            />
          </label>
          <div className="grid grid-cols-3 gap-1">
            {(['coolwarm', 'viridis', 'emerald'] as const).map((cm) => (
              <button
                key={cm}
                type="button"
                onClick={() =>
                  onUpdateSelected({
                    graph3DConfig: { ...first.graph3DConfig!, colormap: cm },
                  })
                }
                className={`py-1 rounded text-[10px] font-medium capitalize ${
                  first.graph3DConfig!.colormap === cm
                    ? 'bg-[var(--rf-accent)] text-[var(--rf-accent-fg)]'
                    : 'bg-[var(--rf-surface-elevated)] text-[var(--rf-text)] border border-[var(--rf-border)]'
                }`}
              >
                {cm}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Opacity */}
      <div>
        <div className="flex items-center justify-between font-medium text-[var(--rf-text-muted)] mb-1">
          <span>{t.inspector.opacity}</span>
          <span className="font-mono-tabular">{opacity}%</span>
        </div>
        <input
          type="range"
          min={10}
          max={100}
          step={5}
          aria-label="Opacity"
          value={opacity}
          onChange={(e) => setProp({ opacity: Number(e.target.value) })}
          className="w-full accent-[var(--rf-accent)]"
        />
      </div>

      {/* Selected Element Actions */}
      {selectedElements.length > 0 && (
        <div className="pt-2 border-t border-[var(--rf-border)] space-y-1.5">
          <div className="flex items-center gap-1 text-[var(--rf-text-muted)] font-medium">
            <Layers className="w-3.5 h-3.5" />
            <span>{t.inspector.layer}</span>
          </div>
          <div className="grid grid-cols-4 gap-1">
            <button
              type="button"
              aria-label={t.inspector.sendBackward}
              title={t.inspector.sendBackward}
              onClick={() => onLayerChange('backward')}
              className="flex items-center justify-center py-1.5 rounded-md bg-[var(--rf-surface-elevated)] border border-[var(--rf-border)] hover:bg-[var(--rf-surface-hover)]"
            >
              <ArrowDown className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              aria-label={t.inspector.bringForward}
              title={t.inspector.bringForward}
              onClick={() => onLayerChange('forward')}
              className="flex items-center justify-center py-1.5 rounded-md bg-[var(--rf-surface-elevated)] border border-[var(--rf-border)] hover:bg-[var(--rf-surface-hover)]"
            >
              <ArrowUp className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              aria-label={t.inspector.duplicate}
              title={t.inspector.duplicate}
              onClick={onDuplicateSelected}
              className="flex items-center justify-center py-1.5 rounded-md bg-[var(--rf-surface-elevated)] border border-[var(--rf-border)] hover:bg-[var(--rf-surface-hover)]"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              aria-label={t.inspector.delete}
              title={t.inspector.delete}
              onClick={onDeleteSelected}
              className="flex items-center justify-center py-1.5 rounded-md bg-rose-500/15 text-rose-400 border border-rose-500/30 hover:bg-rose-500/25"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </aside>
  );
};
