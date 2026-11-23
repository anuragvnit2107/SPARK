import React, { useMemo, useState } from 'react';
import {
  Activity,
  Binary,
  ChevronDown,
  ChevronUp,
  Compass,
  Gauge,
  Pause,
  Play,
  Plus,
  RotateCcw,
  SlidersHorizontal,
  Stamp,
  StepForward,
  Trash2,
  X,
  Zap,
} from 'lucide-react';
import {
  computePhasorResultant,
  formatComponentCompactValue,
  formatEngineering,
  getComponentDefaultUnitLabel,
  getComponentSliderSpec,
  isTunableCircuitKind,
  normalizeComponentValueInput,
  parseEngineeringValue,
  parseFrequencyInput,
  PhasorVector,
  SimulatorState,
  sliderPosToValue,
  TransientIntegrationMethod,
  valueToSliderPos,
} from '../circuitSimulator';
import {
  DigitalCircuitReport,
  isLetterLogicInput,
  normalizeLogicInputToken,
} from '../digitalLogic';
import { SimPresetId } from '../circuitPreset';
import { CircuitKind, WaveformType, WhiteboardElement } from '../types';

interface SimulationPanelProps {
  open: boolean;
  simActive: boolean;
  simRunning: boolean;
  simSpeed: number;
  frequencyHz: number;
  integrationMethod: TransientIntegrationMethod;
  elements: WhiteboardElement[];
  simState: SimulatorState | null;
  digitalReport?: DigitalCircuitReport;
  onToggleRunning: () => void;
  onStepSim: () => void;
  onResetSim: () => void;
  onChangeSpeed: (speed: number) => void;
  onChangeFrequency: (hz: number) => void;
  onChangeIntegrationMethod: (method: TransientIntegrationMethod) => void;
  onUpdateElement: (id: string, patch: Partial<WhiteboardElement>, commitHistory?: boolean) => void;
  onAutoAssignLogicLetters?: () => void;
  onResetLogicBinary?: () => void;
  onLoadStarterCircuit: (preset: SimPresetId) => void;
  onStampPhasorDiagram: (
    phasors: PhasorVector[],
    resultant: { magnitude: number; angleDeg: number }
  ) => void;
  onClose: () => void;
}

type SimTab = 'meters' | 'oscilloscope' | 'phasor' | 'logic';

const PHASOR_PALETTE = ['#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4'];

const PRESET_LIST: { id: SimPresetId; label: string }[] = [
  { id: 'series-rc', label: 'Series RC' },
  { id: 'parallel-rc', label: 'Parallel RC' },
  { id: 'series-rl', label: 'Series RL' },
  { id: 'parallel-rl', label: 'Parallel RL' },
  { id: 'dc-rlc', label: 'RLC Step (ODE)' },
  { id: 'ac-rlc', label: 'AC RLC' },
  { id: 'dc-meters', label: 'DC Divider' },
  { id: 'diode-rectifier', label: 'Diode' },
];

function formatOdeRegimeLabel(regime: SimulatorState['odeInfo']['regime']): string {
  switch (regime) {
    case 'first-order-rc':
      return '1st-Order RC';
    case 'first-order-rl':
      return '1st-Order RL';
    case 'underdamped':
      return '2nd-Order · Underdamped';
    case 'critically-damped':
      return '2nd-Order · Critically Damped';
    case 'overdamped':
      return '2nd-Order · Overdamped';
    default:
      return '0th-Order Resistive';
  }
}

const FREQ_SLIDER_SPEC = { min: 1, max: 100_000, scale: 'log' as const, label: 'AC Frequency' };

function getTunableKindShort(kind: CircuitKind): string {
  switch (kind) {
    case 'resistor':
      return 'R · Resistor';
    case 'capacitor':
      return 'C · Capacitor';
    case 'inductor':
      return 'L · Inductor';
    case 'dc-source':
      return 'Vdc · DC Source';
    case 'ac-source':
      return 'Vac · AC Source';
    case 'function-generator':
      return 'FGen · Function Gen';
    default:
      return kind;
  }
}

export const SimulationPanel: React.FC<SimulationPanelProps> = ({
  open,
  simActive,
  simRunning,
  simSpeed,
  frequencyHz,
  integrationMethod,
  elements,
  simState,
  digitalReport,
  onToggleRunning,
  onStepSim,
  onResetSim,
  onChangeSpeed,
  onChangeFrequency,
  onChangeIntegrationMethod,
  onUpdateElement,
  onAutoAssignLogicLetters,
  onResetLogicBinary,
  onLoadStarterCircuit,
  onStampPhasorDiagram,
  onClose,
}) => {
  const [tab, setTab] = useState<SimTab>('meters');
  const [tunersOpen, setTunersOpen] = useState(true);
  const [draftValues, setDraftValues] = useState<Record<string, string>>({});
  const [freqDraft, setFreqDraft] = useState<string | null>(null);
  const [hiddenChannels, setHiddenChannels] = useState<Record<string, boolean>>({});
  const [scopeGain, setScopeGain] = useState<number>(1);
  const [hoverSampleIdx, setHoverSampleIdx] = useState<number | null>(null);

  const tunableComponents = useMemo(
    () =>
      elements.filter(
        (el) => !el.isDeleted && el.type === 'circuit' && isTunableCircuitKind(el.circuitKind)
      ),
    [elements]
  );

  // Phasor Diagram Maker state
  const [phasorSourceMode, setPhasorSourceMode] = useState<'circuit' | 'custom'>('circuit');
  const [customPhasors, setCustomPhasors] = useState<PhasorVector[]>([
    { id: 'ph_1', label: 'V_R', kind: 'voltage', magnitude: 8, angleDeg: 0, color: '#3b82f6' },
    { id: 'ph_2', label: 'V_L', kind: 'voltage', magnitude: 6, angleDeg: 90, color: '#10b981' },
  ]);
  const [newLabel, setNewLabel] = useState('V_C');
  const [newMag, setNewMag] = useState('4');
  const [newAngle, setNewAngle] = useState('-90');
  const [newKind, setNewKind] = useState<'voltage' | 'current'>('voltage');
  const [showResultant, setShowResultant] = useState(true);

  const activePhasors = useMemo(() => {
    if (phasorSourceMode === 'circuit' && simState?.ok && simState.phasors.length > 0) {
      return simState.phasors;
    }
    return customPhasors;
  }, [customPhasors, phasorSourceMode, simState]);

  const resultant = useMemo(
    () =>
      computePhasorResultant(
        activePhasors.filter(
          (p) =>
            p.kind === 'voltage' &&
            !(phasorSourceMode === 'circuit' && simState?.ok && simState.phasors.length > 0 && p.label === 'Vs')
        )
      ),
    [activePhasors, phasorSourceMode, simState]
  );

  if (!open) return null;

  const handleAddCustomPhasor = (e: React.FormEvent) => {
    e.preventDefault();
    const mag = parseFloat(newMag);
    const ang = parseFloat(newAngle);
    if (!Number.isFinite(mag) || !Number.isFinite(ang)) return;
    setPhasorSourceMode('custom');
    setCustomPhasors((prev) => [
      ...prev,
      {
        id: `ph_${Date.now().toString(36)}`,
        label: newLabel.trim() || `V${prev.length + 1}`,
        kind: newKind,
        magnitude: Math.max(0.01, Math.abs(mag)),
        angleDeg: ang,
        color: PHASOR_PALETTE[prev.length % PHASOR_PALETTE.length],
      },
    ]);
  };

  // Oscilloscope SVG Geometry with independent V and mA vertical scales
  const scopeW = 460;
  const scopeH = 210;
  const visibleChannels = (simState?.channels || []).filter((ch) => !hiddenChannels[ch.id]);
  const voltChannels = visibleChannels.filter((ch) => ch.unit === 'V');
  const currChannels = visibleChannels.filter((ch) => ch.unit === 'mA');
  const maxVoltsRaw = Math.max(
    0.5,
    ...voltChannels.flatMap((ch) => ch.samples.map((s) => Math.abs(s)))
  );
  const maxMilliampsRaw = Math.max(
    1,
    ...currChannels.flatMap((ch) => ch.samples.map((s) => Math.abs(s)))
  );
  const effectiveMaxVolts = maxVoltsRaw / scopeGain;
  const effectiveMaxMilliamps = maxMilliampsRaw / scopeGain;

  return (
    <aside
      aria-label="Circuit Simulator & Phasor Analyzer"
      className="rf-panel w-[540px] max-w-[95vw] max-h-[calc(100vh-172px)] md:max-h-[calc(100vh-110px)] flex flex-col rounded-2xl overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--rf-border)]">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-[var(--rf-accent)]" />
          <h2 className="text-sm font-semibold text-[var(--rf-text)] whitespace-nowrap">
            Transient Simulator & Phasor Lab
          </h2>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            aria-label={simRunning ? 'Pause simulation' : 'Play simulation'}
            onClick={onToggleRunning}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
              simRunning
                ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                : 'bg-[var(--rf-accent)] text-[var(--rf-accent-fg)] hover:opacity-95'
            }`}
          >
            {simRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span>{simRunning ? 'Pause' : simActive ? 'Play' : 'Run Sim'}</span>
          </button>
          <button
            type="button"
            aria-label="Step transient solver"
            title="Step +Δt"
            onClick={onStepSim}
            className="flex items-center gap-1 px-2 py-1.5 rounded-lg border border-[var(--rf-border)] bg-[var(--rf-surface-elevated)] text-xs font-medium text-[var(--rf-text)] hover:border-[var(--rf-accent)] whitespace-nowrap shrink-0"
          >
            <StepForward className="w-3.5 h-3.5" />
            <span>Step</span>
          </button>
          <button
            type="button"
            aria-label="Reset transient time to zero"
            title="Reset t = 0"
            onClick={onResetSim}
            className="p-1.5 rounded-lg border border-[var(--rf-border)] bg-[var(--rf-surface-elevated)] text-[var(--rf-text)] hover:border-[var(--rf-accent)] shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            aria-label="Close Simulator"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--rf-text-muted)] hover:bg-[var(--rf-surface-hover)] shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Transient Clock & ODE Solver Telemetry Bar */}
      {simState?.ok && (
        <div className="px-4 py-2 border-b border-[var(--rf-border)] bg-[var(--rf-surface)] text-[11px] font-mono-tabular space-y-1.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-3 text-[var(--rf-text)]">
              <span data-testid="sim-time-readout">
                t = <strong className="text-[var(--rf-accent)]">{formatEngineering(simState.timeSec, 's')}</strong>
              </span>
              {simState.tauSec !== null && (
                <span data-testid="sim-tau-readout" className="text-[var(--rf-text-muted)]">
                  τ = <strong className="text-[var(--rf-text)]">{formatEngineering(simState.tauSec, 's')}</strong>
                </span>
              )}
              <span className="text-[var(--rf-text-muted)]">
                Δt = {formatEngineering(simState.dtSec, 's')}
              </span>
            </div>

            <div className="flex items-center gap-1">
              {[0.25, 1, 2].map((spd) => (
                <button
                  key={spd}
                  type="button"
                  onClick={() => onChangeSpeed(spd)}
                  className={`px-1.5 py-0.5 rounded text-[11px] font-medium whitespace-nowrap ${
                    simSpeed === spd
                      ? 'bg-[var(--rf-accent)] text-[var(--rf-accent-fg)]'
                      : 'bg-[var(--rf-surface-elevated)] border border-[var(--rf-border)] text-[var(--rf-text-muted)] hover:text-[var(--rf-text)]'
                  }`}
                >
                  {spd}x
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 text-[var(--rf-text-muted)]">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 min-w-0">
              <span data-testid="sim-ode-regime" className="font-semibold text-[var(--rf-text)] whitespace-nowrap">
                {formatOdeRegimeLabel(simState.odeInfo.regime)}
              </span>
              {simState.odeInfo.order === 2 && simState.odeInfo.naturalFreqHz !== null && (
                <span className="whitespace-nowrap">
                  f₀=<strong className="text-[var(--rf-text)]">{simState.odeInfo.naturalFreqHz.toFixed(1)}Hz</strong>
                </span>
              )}
              {simState.odeInfo.order === 2 && simState.odeInfo.dampingRatioZeta !== null && (
                <span className="whitespace-nowrap">
                  ζ=<strong className="text-[var(--rf-text)]">{simState.odeInfo.dampingRatioZeta.toFixed(3)}</strong>
                </span>
              )}
              {simState.totalStoredEnergyJ > 1e-12 && (
                <span className="whitespace-nowrap">
                  E=<strong className="text-[var(--rf-text)]">{formatEngineering(simState.totalStoredEnergyJ, 'J')}</strong>
                </span>
              )}
            </div>

            <div className="flex items-center gap-1 shrink-0" title="ODE Numerical Integration Scheme">
              {(
                [
                  { id: 'trapezoidal', label: 'TR-BE' },
                  { id: 'backward-euler', label: 'BE' },
                ] as { id: TransientIntegrationMethod; label: string }[]
              ).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => onChangeIntegrationMethod(m.id)}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-medium whitespace-nowrap ${
                    integrationMethod === m.id
                      ? 'bg-[var(--rf-accent)] text-[var(--rf-accent-fg)]'
                      : 'bg-[var(--rf-surface-elevated)] border border-[var(--rf-border)] text-[var(--rf-text-muted)] hover:text-[var(--rf-text)]'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tabs & AC Frequency Slider + Unit Input */}
      <div className="flex flex-col gap-2 px-4 py-2 border-b border-[var(--rf-border)] bg-[var(--rf-surface-elevated)] text-xs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            {(
              [
                { id: 'meters', label: 'Instantaneous', icon: <Gauge className="w-3.5 h-3.5" /> },
                { id: 'oscilloscope', label: 'Oscilloscope', icon: <Activity className="w-3.5 h-3.5" /> },
                { id: 'phasor', label: 'Phasor Lab', icon: <Compass className="w-3.5 h-3.5" /> },
                { id: 'logic', label: 'Logic Study', icon: <Binary className="w-3.5 h-3.5" /> },
              ] as { id: SimTab; label: string; icon: React.ReactNode }[]
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-medium transition-colors whitespace-nowrap shrink-0 ${
                  tab === item.id
                    ? 'bg-[var(--rf-accent)] text-[var(--rf-accent-fg)]'
                    : 'text-[var(--rf-text-muted)] hover:text-[var(--rf-text)] hover:bg-[var(--rf-surface-hover)]'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5 text-[var(--rf-text-muted)]">
            <span className="whitespace-nowrap">AC Freq:</span>
            <input
              type="text"
              data-testid="sim-frequency-input"
              aria-label="AC Frequency value"
              value={freqDraft !== null ? freqDraft : String(frequencyHz)}
              onChange={(e) => {
                const raw = e.target.value;
                setFreqDraft(raw);
                const parsed = parseFrequencyInput(raw, -1);
                if (parsed > 0) onChangeFrequency(parsed);
              }}
              onBlur={() => {
                if (freqDraft !== null) {
                  onChangeFrequency(parseFrequencyInput(freqDraft, frequencyHz));
                  setFreqDraft(null);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && freqDraft !== null) {
                  onChangeFrequency(parseFrequencyInput(freqDraft, frequencyHz));
                  setFreqDraft(null);
                  e.currentTarget.blur();
                }
              }}
              placeholder="60 or 1k"
              className="w-20 px-2 py-1 rounded-md bg-[var(--rf-surface)] border border-[var(--rf-border)] text-[var(--rf-text)] font-mono-tabular text-xs outline-none focus:border-[var(--rf-accent)]"
            />
            <span>Hz</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono-tabular text-[var(--rf-text-muted)] whitespace-nowrap">
            1Hz
          </span>
          <input
            type="range"
            data-testid="sim-frequency-slider"
            aria-label="AC Frequency slider"
            min={0}
            max={1000}
            step={1}
            value={Math.round(valueToSliderPos(frequencyHz, FREQ_SLIDER_SPEC))}
            onChange={(e) => {
              const nextHz = Math.max(
                1,
                Math.round(sliderPosToValue(Number(e.target.value), FREQ_SLIDER_SPEC))
              );
              setFreqDraft(null);
              onChangeFrequency(nextHz);
            }}
            className="flex-1 accent-[var(--rf-accent)] cursor-pointer"
          />
          <span className="text-[10px] font-mono-tabular text-[var(--rf-text-muted)] whitespace-nowrap">
            100kHz
          </span>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto rf-scrollbar p-4 space-y-4 text-xs">
        {/* Quick Circuit Templates */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[var(--rf-text-muted)] mr-1">Circuits:</span>
          {PRESET_LIST.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => onLoadStarterCircuit(preset.id)}
              className="px-2.5 py-1 rounded-md border border-[var(--rf-border)] bg-[var(--rf-surface-elevated)] text-[var(--rf-text)] hover:border-[var(--rf-accent)] whitespace-nowrap shrink-0"
            >
              {preset.label}
            </button>
          ))}
        </div>

        {/* Live Component & Source Sliders + Smart Unit-Detecting Inputs */}
        {tunableComponents.length > 0 && (
          <div
            data-testid="sim-component-tuners"
            className="rounded-xl border border-[var(--rf-border)] bg-[var(--rf-surface-elevated)] overflow-hidden"
          >
            <button
              type="button"
              onClick={() => setTunersOpen((o) => !o)}
              className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-[var(--rf-surface-hover)] transition-colors"
            >
              <div className="flex items-center gap-1.5 font-semibold text-[var(--rf-text)]">
                <SlidersHorizontal className="w-3.5 h-3.5 text-[var(--rf-accent)]" />
                <span>Component &amp; Source Tuners ({tunableComponents.length})</span>
              </div>
              {tunersOpen ? (
                <ChevronUp className="w-3.5 h-3.5 text-[var(--rf-text-muted)]" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-[var(--rf-text-muted)]" />
              )}
            </button>

            {tunersOpen && (
              <div className="px-3 pb-3 pt-1 space-y-2.5 border-t border-[var(--rf-border)] max-h-56 overflow-y-auto rf-scrollbar">
                {tunableComponents.map((comp, idx) => {
                  const kind = comp.circuitKind!;
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
                  const numericVal = parseEngineeringValue(comp.componentValue, fallbackNum);
                  const spec = getComponentSliderSpec(kind, numericVal);
                  const sliderPos = Math.round(valueToSliderPos(numericVal, spec));
                  const hasDraft = Object.prototype.hasOwnProperty.call(draftValues, comp.id);
                  const displayVal = hasDraft
                    ? draftValues[comp.id]
                    : comp.componentValue || formatComponentCompactValue(kind, numericVal);
                  const previewNormalized = hasDraft
                    ? normalizeComponentValueInput(kind, draftValues[comp.id]).formatted
                    : null;

                  return (
                    <div
                      key={comp.id}
                      data-testid={`sim-tuner-${comp.id}`}
                      className="p-2 rounded-lg bg-[var(--rf-surface)] border border-[var(--rf-border)] space-y-1.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="font-semibold text-[var(--rf-text)] truncate">
                            #{idx + 1} {getTunableKindShort(kind)}
                          </span>
                          <span className="text-[10px] text-[var(--rf-text-muted)] whitespace-nowrap">
                            · {getComponentDefaultUnitLabel(kind)}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {previewNormalized && previewNormalized !== displayVal && (
                            <span className="text-[10px] font-mono-tabular text-[var(--rf-accent)]">
                              → {previewNormalized}
                            </span>
                          )}
                          <input
                            type="text"
                            data-testid={`sim-value-input-${comp.id}`}
                            aria-label={`${getTunableKindShort(kind)} value`}
                            value={displayVal}
                            onChange={(e) => {
                              const raw = e.target.value;
                              setDraftValues((prev) => ({ ...prev, [comp.id]: raw }));
                              const norm = normalizeComponentValueInput(kind, raw);
                              if (raw.trim() && Number.isFinite(norm.numericValue)) {
                                onUpdateElement(comp.id, { componentValue: norm.formatted }, false);
                              }
                            }}
                            onBlur={() => {
                              const raw = draftValues[comp.id];
                              if (raw !== undefined) {
                                const norm = normalizeComponentValueInput(kind, raw);
                                onUpdateElement(comp.id, { componentValue: norm.formatted }, true);
                                setDraftValues((prev) => {
                                  const next = { ...prev };
                                  delete next[comp.id];
                                  return next;
                                });
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                const raw = draftValues[comp.id] ?? displayVal;
                                const norm = normalizeComponentValueInput(kind, raw);
                                onUpdateElement(comp.id, { componentValue: norm.formatted }, true);
                                setDraftValues((prev) => {
                                  const next = { ...prev };
                                  delete next[comp.id];
                                  return next;
                                });
                                e.currentTarget.blur();
                              }
                            }}
                            className="w-24 px-2 py-0.5 rounded bg-[var(--rf-surface-elevated)] border border-[var(--rf-border)] text-[var(--rf-text)] font-mono-tabular text-[11px] text-right outline-none focus:border-[var(--rf-accent)]"
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono-tabular text-[var(--rf-text-muted)] w-9 shrink-0">
                          {formatComponentCompactValue(kind, spec.min)}
                        </span>
                        <input
                          type="range"
                          data-testid={`sim-slider-${comp.id}`}
                          aria-label={`${getTunableKindShort(kind)} slider`}
                          min={0}
                          max={1000}
                          step={1}
                          value={sliderPos}
                          onChange={(e) => {
                            const nextNum = sliderPosToValue(Number(e.target.value), spec);
                            const nextFormatted = formatComponentCompactValue(kind, nextNum);
                            setDraftValues((prev) => {
                              if (!prev[comp.id]) return prev;
                              const next = { ...prev };
                              delete next[comp.id];
                              return next;
                            });
                            onUpdateElement(comp.id, { componentValue: nextFormatted }, false);
                          }}
                          onPointerUp={() => {
                            onUpdateElement(
                              comp.id,
                              { componentValue: comp.componentValue || displayVal },
                              true
                            );
                          }}
                          className="flex-1 accent-[var(--rf-accent)] cursor-pointer"
                        />
                        <span className="text-[10px] font-mono-tabular text-[var(--rf-text-muted)] w-11 text-right shrink-0">
                          {formatComponentCompactValue(kind, spec.max)}
                        </span>
                      </div>

                      {kind === 'function-generator' && (
                        <div className="flex items-center gap-1 pt-0.5">
                          {(
                            [
                              { id: 'sine', label: 'Sine' },
                              { id: 'triangle', label: 'Tri' },
                              { id: 'square', label: 'Square' },
                            ] as { id: WaveformType; label: string }[]
                          ).map((w) => (
                            <button
                              key={w.id}
                              type="button"
                              onClick={() =>
                                onUpdateElement(comp.id, { waveformType: w.id }, true)
                              }
                              className={`flex-1 py-0.5 px-1.5 rounded text-[10px] font-semibold ${
                                (comp.waveformType || 'sine') === w.id
                                  ? 'bg-[var(--rf-accent)] text-[var(--rf-accent-fg)]'
                                  : 'bg-[var(--rf-surface-elevated)] border border-[var(--rf-border)] text-[var(--rf-text-muted)]'
                              }`}
                            >
                              {w.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Warnings / Errors */}
        {simState && !simState.ok && (
          <div className="p-3 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-300">
            {simState.error}
          </div>
        )}
        {simState?.ok &&
          simState.warnings.map((w, idx) => (
            <div
              key={idx}
              className="px-3 py-2 rounded-lg border border-[var(--rf-border)] bg-[var(--rf-surface-elevated)] text-[var(--rf-text-muted)]"
            >
              {w}
            </div>
          ))}

        {/* TAB 1: METERS & INSTANTANEOUS TRANSIENT READOUTS */}
        {tab === 'meters' && (
          <div className="space-y-3">
            {simState?.ok ? (
              <>
                {simState.impedanceSummary && (
                  <div className="grid grid-cols-4 gap-2 p-2.5 rounded-xl bg-[var(--rf-surface-elevated)] border border-[var(--rf-border)]">
                    <div>
                      <div className="text-[11px] text-[var(--rf-text-muted)]">|Z| Total</div>
                      <div className="font-mono-tabular font-semibold text-[var(--rf-text)]">
                        {formatEngineering(simState.impedanceSummary.zMagOhms, 'Ω')}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] text-[var(--rf-text-muted)]">Phase θ</div>
                      <div className="font-mono-tabular font-semibold text-[var(--rf-text)]">
                        {simState.impedanceSummary.zAngleDeg.toFixed(1)}°
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] text-[var(--rf-text-muted)]">Power Factor</div>
                      <div className="font-mono-tabular font-semibold text-[var(--rf-text)]">
                        {simState.impedanceSummary.powerFactor.toFixed(3)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] text-[var(--rf-text-muted)]">Real Power</div>
                      <div className="font-mono-tabular font-semibold text-[var(--rf-text)]">
                        {formatEngineering(simState.impedanceSummary.realPowerW, 'W')}
                      </div>
                    </div>
                  </div>
                )}

                <div className="overflow-x-auto rounded-xl border border-[var(--rf-border)]">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-[var(--rf-border)] bg-[var(--rf-surface-elevated)] text-[11px] text-[var(--rf-text-muted)]">
                        <th className="py-2 px-3 font-medium">Component</th>
                        <th className="py-2 px-2 font-medium text-right">
                          {simState.mode === 'ac' ? 'v(t) / Vrms' : 'v(t)'}
                        </th>
                        <th className="py-2 px-2 font-medium text-right">
                          {simState.mode === 'ac' ? 'i(t) / Irms' : 'i(t)'}
                        </th>
                        <th className="py-2 px-3 font-medium text-right">
                          {simState.mode === 'ac' ? 'Phase' : 'P(t) / E(t)'}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--rf-border)]">
                      {simState.components.map((comp) => (
                        <tr key={comp.elementId} className="hover:bg-[var(--rf-surface-hover)]">
                          <td className="py-2 px-3 font-medium text-[var(--rf-text)]">
                            <div>{comp.label}</div>
                            {comp.kind === 'capacitor' && (
                              <div className="text-[10px] font-mono-tabular text-[var(--rf-text-muted)]">
                                dv/dt = {formatEngineering(comp.dvDt, 'V/s')}
                              </div>
                            )}
                            {comp.kind === 'inductor' && (
                              <div className="text-[10px] font-mono-tabular text-[var(--rf-text-muted)]">
                                di/dt = {formatEngineering(comp.diDt, 'A/s')}
                              </div>
                            )}
                          </td>
                          <td className="py-2 px-2 text-right font-mono-tabular text-[var(--rf-text)]">
                            {simState.mode === 'ac'
                              ? `${comp.vInst.toFixed(2)}V (${comp.vRms.toFixed(1)}V)`
                              : `${comp.vInst.toFixed(3)} V`}
                          </td>
                          <td className="py-2 px-2 text-right font-mono-tabular text-[var(--rf-text)]">
                            {formatEngineering(comp.iInst, 'A')}
                          </td>
                          <td className="py-2 px-3 text-right font-mono-tabular text-[var(--rf-text-muted)]">
                            {simState.mode === 'ac'
                              ? `${comp.vPhaseDeg.toFixed(1)}°`
                              : comp.energyJ > 1e-12
                              ? formatEngineering(comp.energyJ, 'J')
                              : formatEngineering(comp.powerInst, 'W')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <div className="p-6 text-center rounded-xl border border-dashed border-[var(--rf-border)] text-[var(--rf-text-muted)]">
                Draw a circuit using <strong className="text-[var(--rf-text)]">Wire (W)</strong> and{' '}
                <strong className="text-[var(--rf-text)]">Circuits</strong> (or select Series/Parallel RC or RL above), then click{' '}
                <strong className="text-[var(--rf-text)]">Run Sim</strong>.
              </div>
            )}
          </div>
        )}

        {/* TAB 2: OSCILLOSCOPE */}
        {tab === 'oscilloscope' && (
          <div className="space-y-3">
            {simState?.ok && simState.channels.length > 0 ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {simState.channels.map((ch) => {
                      const hidden = hiddenChannels[ch.id];
                      return (
                        <button
                          key={ch.id}
                          type="button"
                          onClick={() =>
                            setHiddenChannels((prev) => ({ ...prev, [ch.id]: !prev[ch.id] }))
                          }
                          className={`flex items-center gap-1.5 px-2 py-1 rounded-md border text-[11px] font-medium ${
                            hidden
                              ? 'opacity-45 border-[var(--rf-border)]'
                              : 'border-[var(--rf-border)] bg-[var(--rf-surface-elevated)]'
                          }`}
                        >
                          <span
                            className="w-2.5 h-2.5 rounded-sm"
                            style={{ backgroundColor: ch.color }}
                          />
                          <span>{ch.label}</span>
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-[11px] text-[var(--rf-text-muted)]">Gain:</span>
                    {[0.5, 1, 2].map((g) => (
                      <button
                        key={g}
                        type="button"
                        onClick={() => setScopeGain(g)}
                        className={`px-2 py-0.5 rounded font-mono-tabular text-[11px] ${
                          scopeGain === g
                            ? 'bg-[var(--rf-accent)] text-[var(--rf-accent-fg)]'
                            : 'bg-[var(--rf-surface-elevated)] border border-[var(--rf-border)]'
                        }`}
                      >
                        {g}x
                      </button>
                    ))}
                  </div>
                </div>

                {/* Scope CRT SVG */}
                <div className="rounded-xl border border-[var(--rf-border)] bg-[#070b12] p-2">
                  <svg
                    viewBox={`0 0 ${scopeW} ${scopeH}`}
                    className="w-full h-48 cursor-crosshair"
                    onMouseMove={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const relX = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                      const idx = Math.round(
                        relX * Math.max(0, simState.timePointsMs.length - 1)
                      );
                      setHoverSampleIdx(idx);
                    }}
                    onMouseLeave={() => setHoverSampleIdx(null)}
                  >
                    {[0.25, 0.5, 0.75].map((f) => (
                      <line
                        key={`h_${f}`}
                        x1={0}
                        y1={scopeH * f}
                        x2={scopeW}
                        y2={scopeH * f}
                        stroke={f === 0.5 ? 'rgba(148,163,184,0.35)' : 'rgba(148,163,184,0.14)'}
                        strokeDasharray={f === 0.5 ? undefined : '4 4'}
                      />
                    ))}
                    {[0.2, 0.4, 0.6, 0.8].map((f) => (
                      <line
                        key={`v_${f}`}
                        x1={scopeW * f}
                        y1={0}
                        x2={scopeW * f}
                        y2={scopeH}
                        stroke="rgba(148,163,184,0.14)"
                        strokeDasharray="4 4"
                      />
                    ))}

                    {visibleChannels.map((ch) => {
                      const scaleMax = ch.unit === 'V' ? effectiveMaxVolts : effectiveMaxMilliamps;
                      const pts = ch.samples
                        .map((val, idx) => {
                          const x = (idx / Math.max(1, ch.samples.length - 1)) * scopeW;
                          const y = scopeH / 2 - (val / scaleMax) * (scopeH * 0.42);
                          return `${x.toFixed(1)},${y.toFixed(1)}`;
                        })
                        .join(' ');
                      return (
                        <polyline
                          key={ch.id}
                          fill="none"
                          stroke={ch.color}
                          strokeWidth="2"
                          strokeDasharray={ch.unit === 'mA' ? '5 2' : undefined}
                          strokeLinejoin="round"
                          points={pts}
                        />
                      );
                    })}

                    {hoverSampleIdx !== null && simState.timePointsMs.length > 1 && (
                      <line
                        x1={(hoverSampleIdx / (simState.timePointsMs.length - 1)) * scopeW}
                        y1={0}
                        x2={(hoverSampleIdx / (simState.timePointsMs.length - 1)) * scopeW}
                        y2={scopeH}
                        stroke="#f8fafc"
                        strokeWidth="1"
                        strokeDasharray="3 3"
                      />
                    )}
                  </svg>

                  <div className="flex flex-wrap items-center justify-between gap-1 px-1 pt-1.5 text-[11px] font-mono-tabular text-slate-400">
                    <span>
                      {(simState.timePointsMs[0] || 0).toFixed(2)}–
                      {(simState.timePointsMs[simState.timePointsMs.length - 1] || 0).toFixed(2)} ms
                      {voltChannels.length > 0 ? ` · ±${effectiveMaxVolts.toFixed(1)}V` : ''}
                      {currChannels.length > 0 ? ` · ±${effectiveMaxMilliamps.toFixed(0)}mA` : ''}
                    </span>
                    {hoverSampleIdx !== null && (
                      <span className="text-slate-200">
                        t = {simState.timePointsMs[hoverSampleIdx]?.toFixed(2)} ms ·{' '}
                        {visibleChannels
                          .map(
                            (ch) =>
                              `${ch.label}: ${(ch.samples[hoverSampleIdx] || 0).toFixed(2)} ${ch.unit}`
                          )
                          .join(' | ')}
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {visibleChannels.map((ch) => (
                    <div
                      key={ch.id}
                      className="p-2.5 rounded-xl bg-[var(--rf-surface-elevated)] border border-[var(--rf-border)] flex items-center justify-between"
                    >
                      <span className="font-medium text-[var(--rf-text)] truncate pr-2">
                        {ch.label}
                      </span>
                      <span className="font-mono-tabular text-[var(--rf-text-muted)] shrink-0">
                        Now {(ch.samples[ch.samples.length - 1] || 0).toFixed(2)} · Pk{' '}
                        {ch.peak.toFixed(2)} {ch.unit}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="p-6 text-center rounded-xl border border-dashed border-[var(--rf-border)] text-[var(--rf-text-muted)]">
                Add an AC/DC source and Reactive/Probe components (or select a preset) to stream live waveforms.
              </div>
            )}
          </div>
        )}

        {/* TAB 3: PHASOR ANALYZER & PHASOR DIAGRAM MAKER */}
        {tab === 'phasor' && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setPhasorSourceMode('circuit')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium ${
                    phasorSourceMode === 'circuit'
                      ? 'bg-[var(--rf-accent)] text-[var(--rf-accent-fg)]'
                      : 'bg-[var(--rf-surface-elevated)] border border-[var(--rf-border)]'
                  }`}
                >
                  From Circuit
                </button>
                <button
                  type="button"
                  onClick={() => setPhasorSourceMode('custom')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium ${
                    phasorSourceMode === 'custom'
                      ? 'bg-[var(--rf-accent)] text-[var(--rf-accent-fg)]'
                      : 'bg-[var(--rf-surface-elevated)] border border-[var(--rf-border)]'
                  }`}
                >
                  Phasor Maker
                </button>
              </div>

              <button
                type="button"
                onClick={() => onStampPhasorDiagram(activePhasors, resultant)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[var(--rf-accent)] text-[var(--rf-accent-fg)] text-[11px] font-semibold"
              >
                <Stamp className="w-3.5 h-3.5" />
                <span>Stamp to Canvas</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
              <div className="rounded-xl border border-[var(--rf-border)] bg-[var(--rf-surface-elevated)] p-2 flex flex-col items-center">
                <svg viewBox="-120 -120 240 240" className="w-52 h-52">
                  {[35, 70, 100].map((r) => (
                    <circle
                      key={r}
                      cx={0}
                      cy={0}
                      r={r}
                      fill="none"
                      stroke="currentColor"
                      strokeOpacity={0.14}
                      strokeDasharray={r === 100 ? undefined : '3 3'}
                    />
                  ))}
                  <line x1={-110} y1={0} x2={110} y2={0} stroke="currentColor" strokeOpacity={0.22} />
                  <line x1={0} y1={-110} x2={0} y2={110} stroke="currentColor" strokeOpacity={0.22} />
                  <text x={102} y={-5} fontSize="8" fill="currentColor" opacity={0.5}>0°</text>
                  <text x={4} y={-102} fontSize="8" fill="currentColor" opacity={0.5}>90°</text>

                  {(() => {
                    const vList = activePhasors.filter((p) => p.kind === 'voltage');
                    const maxV = Math.max(
                      1,
                      ...vList.map((p) => p.magnitude),
                      showResultant ? resultant.magnitude : 0
                    );
                    const iList = activePhasors.filter((p) => p.kind === 'current');
                    const maxI = Math.max(1e-6, ...iList.map((p) => p.magnitude));

                    return (
                      <>
                        {activePhasors.map((ph) => {
                          const scale = ph.kind === 'voltage' ? 92 / maxV : 72 / maxI;
                          const len = Math.max(10, ph.magnitude * scale);
                          const rad = (ph.angleDeg * Math.PI) / 180;
                          const x2 = len * Math.cos(rad);
                          const y2 = -len * Math.sin(rad);
                          const ah1x = x2 - 8 * Math.cos(rad - 0.35);
                          const ah1y = y2 + 8 * Math.sin(rad - 0.35);
                          const ah2x = x2 - 8 * Math.cos(rad + 0.35);
                          const ah2y = y2 + 8 * Math.sin(rad + 0.35);
                          return (
                            <g key={ph.id}>
                              <line
                                x1={0}
                                y1={0}
                                x2={x2}
                                y2={y2}
                                stroke={ph.color}
                                strokeWidth={ph.kind === 'voltage' ? 2.4 : 1.8}
                                strokeDasharray={ph.kind === 'current' ? '4 2' : undefined}
                              />
                              <polygon
                                points={`${x2},${y2} ${ah1x},${ah1y} ${ah2x},${ah2y}`}
                                fill={ph.color}
                              />
                              <text
                                x={x2 * 1.12}
                                y={y2 * 1.12}
                                fontSize="9"
                                fontWeight="600"
                                textAnchor="middle"
                                fill={ph.color}
                              >
                                {ph.label}
                              </text>
                            </g>
                          );
                        })}

                        {showResultant && vList.length > 1 && resultant.magnitude > 0.01 && (
                          (() => {
                            const len = Math.max(10, (resultant.magnitude / maxV) * 92);
                            const rad = (resultant.angleDeg * Math.PI) / 180;
                            const x2 = len * Math.cos(rad);
                            const y2 = -len * Math.sin(rad);
                            return (
                              <g>
                                <line
                                  x1={0}
                                  y1={0}
                                  x2={x2}
                                  y2={y2}
                                  stroke="#f8fafc"
                                  strokeWidth={2}
                                  strokeDasharray="5 3"
                                />
                                <text x={x2 * 1.1} y={y2 * 1.1} fontSize="9" fontWeight="700" fill="#f8fafc">
                                  ΣV
                                </text>
                              </g>
                            );
                          })()
                        )}
                      </>
                    );
                  })()}
                </svg>

                <label className="flex items-center gap-1.5 text-[11px] text-[var(--rf-text-muted)] cursor-pointer mt-1">
                  <input
                    type="checkbox"
                    checked={showResultant}
                    onChange={(e) => setShowResultant(e.target.checked)}
                    className="accent-[var(--rf-accent)]"
                  />
                  <span>
                    Resultant ΣV:{' '}
                    <span className="font-mono-tabular text-[var(--rf-text)]">
                      {resultant.magnitude.toFixed(2)} ∠ {resultant.angleDeg.toFixed(1)}°
                    </span>
                  </span>
                </label>
              </div>

              <div className="space-y-2">
                {phasorSourceMode === 'custom' && (
                  <form
                    onSubmit={handleAddCustomPhasor}
                    className="p-2.5 rounded-xl bg-[var(--rf-surface-elevated)] border border-[var(--rf-border)] space-y-2"
                  >
                    <div className="grid grid-cols-3 gap-1.5">
                      <input
                        type="text"
                        aria-label="Phasor label"
                        value={newLabel}
                        onChange={(e) => setNewLabel(e.target.value)}
                        placeholder="Label"
                        className="px-2 py-1 rounded bg-[var(--rf-surface)] border border-[var(--rf-border)] text-[var(--rf-text)] text-xs"
                      />
                      <input
                        type="number"
                        step="any"
                        aria-label="Phasor magnitude"
                        value={newMag}
                        onChange={(e) => setNewMag(e.target.value)}
                        placeholder="Mag"
                        className="px-2 py-1 rounded bg-[var(--rf-surface)] border border-[var(--rf-border)] text-[var(--rf-text)] font-mono-tabular text-xs"
                      />
                      <input
                        type="number"
                        step="any"
                        aria-label="Phasor angle degrees"
                        value={newAngle}
                        onChange={(e) => setNewAngle(e.target.value)}
                        placeholder="Deg °"
                        className="px-2 py-1 rounded bg-[var(--rf-surface)] border border-[var(--rf-border)] text-[var(--rf-text)] font-mono-tabular text-xs"
                      />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <select
                        aria-label="Phasor type"
                        value={newKind}
                        onChange={(e) => setNewKind(e.target.value as 'voltage' | 'current')}
                        className="px-2 py-1 rounded bg-[var(--rf-surface)] border border-[var(--rf-border)] text-[var(--rf-text)] text-xs"
                      >
                        <option value="voltage">Voltage (V)</option>
                        <option value="current">Current (A)</option>
                      </select>
                      <button
                        type="submit"
                        className="flex-1 flex items-center justify-center gap-1 py-1 px-2 rounded bg-[var(--rf-accent)] text-[var(--rf-accent-fg)] font-semibold text-xs"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Phasor</span>
                      </button>
                    </div>
                  </form>
                )}

                <div className="space-y-1.5 max-h-48 overflow-y-auto rf-scrollbar">
                  {activePhasors.map((ph) => (
                    <div
                      key={ph.id}
                      className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-[var(--rf-surface-elevated)] border border-[var(--rf-border)]"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: ph.color }}
                        />
                        <span className="font-semibold text-[var(--rf-text)] truncate">
                          {ph.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono-tabular text-[var(--rf-text-muted)]">
                          {ph.magnitude.toFixed(2)} {ph.kind === 'voltage' ? 'V' : 'A'} ∠{' '}
                          {ph.angleDeg.toFixed(1)}°
                        </span>
                        {phasorSourceMode === 'custom' && (
                          <button
                            type="button"
                            aria-label={`Remove ${ph.label}`}
                            onClick={() =>
                              setCustomPhasors((prev) => prev.filter((p) => p.id !== ph.id))
                            }
                            className="p-1 text-rose-400 hover:bg-rose-500/15 rounded"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  {activePhasors.length === 0 && (
                    <div className="p-4 text-center rounded-xl border border-dashed border-[var(--rf-border)] text-[var(--rf-text-muted)]">
                      Run an AC circuit simulation or switch to Phasor Maker to plot vectors.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: DIGITAL LOGIC STUDY (BINARY 0/1 & SYMBOLIC LETTER ALGEBRA) */}
        {tab === 'logic' && (
          <div className="space-y-3" data-testid="sim-logic-study-tab">
            <div className="p-3 rounded-xl border border-[var(--rf-border)] bg-[var(--rf-surface-elevated)] flex flex-wrap items-center justify-between gap-2">
              <div className="space-y-0.5">
                <div className="font-semibold text-[var(--rf-text)]">
                  Digital Logic Mode:{' '}
                  <span className="text-[var(--rf-accent)] font-mono-tabular">
                    {digitalReport?.mode === 'symbolic'
                      ? 'Symbolic Letters (A, B, C...)'
                      : 'Binary (0 / 1)'}
                  </span>
                </div>
                <div className="text-[11px] text-[var(--rf-text-muted)]">
                  Enter 0/1 bits or letters (A, B, C...). Assigning any letter requires all following inputs to be letters.
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {onResetLogicBinary && (
                  <button
                    type="button"
                    data-testid="logic-mode-binary-btn"
                    onClick={onResetLogicBinary}
                    className="px-2.5 py-1 rounded-md text-[11px] font-medium border border-[var(--rf-border)] bg-[var(--rf-surface)] text-[var(--rf-text)] hover:border-[var(--rf-accent)] whitespace-nowrap"
                  >
                    Use 0 / 1 Binary
                  </button>
                )}
                {onAutoAssignLogicLetters && (
                  <button
                    type="button"
                    data-testid="logic-mode-letters-btn"
                    onClick={onAutoAssignLogicLetters}
                    className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-[var(--rf-accent)] text-[var(--rf-accent-fg)] hover:opacity-95 whitespace-nowrap"
                  >
                    Assign Letters (A, B...)
                  </button>
                )}
              </div>
            </div>

            {digitalReport && !digitalReport.valid && (
              <div
                data-testid="logic-validation-error"
                className="p-2.5 rounded-xl border border-amber-500/40 bg-amber-500/12 text-amber-300 flex items-center justify-between gap-2"
              >
                <span>{digitalReport.validationError}</span>
                {onAutoAssignLogicLetters && (
                  <button
                    type="button"
                    onClick={onAutoAssignLogicLetters}
                    className="px-2 py-1 rounded bg-[var(--rf-accent)] text-[var(--rf-accent-fg)] font-semibold whitespace-nowrap shrink-0"
                  >
                    Auto-fill Letters
                  </button>
                )}
              </div>
            )}

            {digitalReport && digitalReport.gates.length > 0 ? (
              <>
                <div className="space-y-2">
                  {digitalReport.gates.map((g) => {
                    const el = elements.find((item) => item.id === g.elementId);
                    if (!el) return null;
                    const letterMode =
                      digitalReport.mode === 'symbolic' ||
                      isLetterLogicInput(el.logicInputA) ||
                      (!g.isSingleInput && isLetterLogicInput(el.logicInputB));
                    return (
                      <div
                        key={g.elementId}
                        data-testid={`logic-gate-card-${g.elementId}`}
                        className="p-2.5 rounded-xl border border-[var(--rf-border)] bg-[var(--rf-surface-elevated)] space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-[var(--rf-text)] font-mono-tabular">
                            {g.gateLabel}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-[#060d15] border border-[var(--rf-border)] font-mono-tabular font-semibold text-emerald-400">
                            {g.outputBinary !== null
                              ? `Y = ${g.outputBinary}`
                              : `Y = ${g.outputExpr}`}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] font-mono-tabular text-[var(--rf-text-muted)] w-6">
                              A:
                            </span>
                            {g.inputAWiredFrom ? (
                              <span className="flex-1 px-2 py-1 rounded bg-[var(--rf-surface)] border border-[var(--rf-border)] font-mono-tabular text-[11px] text-[var(--rf-accent)] truncate">
                                ← {g.inputAWiredFrom} ({g.inputALabel})
                              </span>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  disabled={letterMode}
                                  onClick={() => onUpdateElement(el.id, { logicInputA: '0' }, true)}
                                  className={`px-2 py-0.5 rounded font-mono-tabular text-[11px] border disabled:opacity-35 ${
                                    (el.logicInputA ?? '0') === '0'
                                      ? 'bg-[var(--rf-accent)] text-[var(--rf-accent-fg)] border-transparent'
                                      : 'bg-[var(--rf-surface)] border-[var(--rf-border)] text-[var(--rf-text)]'
                                  }`}
                                >
                                  0
                                </button>
                                <button
                                  type="button"
                                  disabled={letterMode}
                                  onClick={() => onUpdateElement(el.id, { logicInputA: '1' }, true)}
                                  className={`px-2 py-0.5 rounded font-mono-tabular text-[11px] border disabled:opacity-35 ${
                                    el.logicInputA === '1'
                                      ? 'bg-emerald-600 text-white border-transparent'
                                      : 'bg-[var(--rf-surface)] border-[var(--rf-border)] text-[var(--rf-text)]'
                                  }`}
                                >
                                  1
                                </button>
                                <input
                                  type="text"
                                  aria-label={`${g.gateLabel} Input A`}
                                  value={el.logicInputA ?? '0'}
                                  maxLength={4}
                                  onChange={(e) => {
                                    const tok = e.target.value.trim()
                                      ? normalizeLogicInputToken(e.target.value)
                                      : '0';
                                    onUpdateElement(el.id, { logicInputA: tok }, true);
                                  }}
                                  className="w-12 px-1.5 py-0.5 rounded bg-[var(--rf-surface)] border border-[var(--rf-border)] text-[var(--rf-text)] font-mono-tabular text-[11px] text-center outline-none focus:border-[var(--rf-accent)]"
                                />
                              </>
                            )}
                          </div>

                          {!g.isSingleInput && (
                            <div className="flex items-center gap-1.5">
                              <span className="text-[11px] font-mono-tabular text-[var(--rf-text-muted)] w-6">
                                B:
                              </span>
                              {g.inputBWiredFrom ? (
                                <span className="flex-1 px-2 py-1 rounded bg-[var(--rf-surface)] border border-[var(--rf-border)] font-mono-tabular text-[11px] text-[var(--rf-accent)] truncate">
                                  ← {g.inputBWiredFrom} ({g.inputBLabel})
                                </span>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    disabled={letterMode}
                                    onClick={() => onUpdateElement(el.id, { logicInputB: '0' }, true)}
                                    className={`px-2 py-0.5 rounded font-mono-tabular text-[11px] border disabled:opacity-35 ${
                                      (el.logicInputB ?? '0') === '0'
                                        ? 'bg-[var(--rf-accent)] text-[var(--rf-accent-fg)] border-transparent'
                                        : 'bg-[var(--rf-surface)] border-[var(--rf-border)] text-[var(--rf-text)]'
                                    }`}
                                  >
                                    0
                                  </button>
                                  <button
                                    type="button"
                                    disabled={letterMode}
                                    onClick={() => onUpdateElement(el.id, { logicInputB: '1' }, true)}
                                    className={`px-2 py-0.5 rounded font-mono-tabular text-[11px] border disabled:opacity-35 ${
                                      el.logicInputB === '1'
                                        ? 'bg-emerald-600 text-white border-transparent'
                                        : 'bg-[var(--rf-surface)] border-[var(--rf-border)] text-[var(--rf-text)]'
                                    }`}
                                  >
                                    1
                                  </button>
                                  <input
                                    type="text"
                                    aria-label={`${g.gateLabel} Input B`}
                                    value={el.logicInputB ?? '0'}
                                    maxLength={4}
                                    onChange={(e) => {
                                      const tok = e.target.value.trim()
                                        ? normalizeLogicInputToken(e.target.value)
                                        : '0';
                                      onUpdateElement(el.id, { logicInputB: tok }, true);
                                    }}
                                    className="w-12 px-1.5 py-0.5 rounded bg-[var(--rf-surface)] border border-[var(--rf-border)] text-[var(--rf-text)] font-mono-tabular text-[11px] text-center outline-none focus:border-[var(--rf-accent)]"
                                  />
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {digitalReport.mode === 'symbolic' &&
                  digitalReport.valid &&
                  digitalReport.truthTable.length > 0 && (
                    <div
                      data-testid="logic-truth-table"
                      className="max-h-56 overflow-auto rf-scrollbar rounded-xl border border-[var(--rf-border)]"
                    >
                      <table className="w-full text-center font-mono-tabular text-[11px] border-collapse">
                        <thead>
                          <tr className="bg-[var(--rf-surface-elevated)] border-b border-[var(--rf-border)] text-[var(--rf-text-muted)]">
                            {digitalReport.variables.map((v) => (
                              <th key={v} className="py-1.5 px-2">
                                {v}
                              </th>
                            ))}
                            {digitalReport.gates.map((g) => (
                              <th key={g.elementId} className="py-1.5 px-2 text-emerald-400">
                                {g.gateLabel}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--rf-border)]">
                          {digitalReport.truthTable.map((row, idx) => (
                            <tr key={idx} className="hover:bg-[var(--rf-surface-hover)]">
                              {digitalReport.variables.map((v) => (
                                <td key={v} className="py-1 px-2 text-[var(--rf-text)]">
                                  {row.inputs[v]}
                                </td>
                              ))}
                              {digitalReport.gates.map((g) => (
                                <td key={g.elementId} className="py-1 px-2 font-bold text-emerald-400">
                                  {row.outputs[g.elementId]}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
              </>
            ) : (
              <div className="p-6 text-center rounded-xl border border-dashed border-[var(--rf-border)] text-[var(--rf-text-muted)]">
                Place logic gates (<strong className="text-[var(--rf-text)]">AND, OR, NOT, NAND, XOR</strong>) from Circuits to study Binary (0/1) and Symbolic Letter Boolean equations.
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
};
