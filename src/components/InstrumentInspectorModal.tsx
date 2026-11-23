import React, { useMemo, useState } from 'react';
import {
  Binary,
  Activity,
  Gauge,
  Pause,
  Play,
  RotateCcw,
  SlidersHorizontal,
  StepForward,
  Waves,
  X,
} from 'lucide-react';
import {
  evaluateWaveformSample,
  formatComponentCompactValue,
  formatEngineering,
  getComponentSliderSpec,
  getCroProbeWaveform,
  normalizeComponentValueInput,
  parseEngineeringValue,
  parseFrequencyInput,
  SimulatorState,
  sliderPosToValue,
  valueToSliderPos,
  WaveformChannel,
} from '../circuitSimulator';
import {
  DigitalCircuitReport,
  isLetterLogicInput,
  isLogicGateKind,
  normalizeLogicInputToken,
} from '../digitalLogic';
import { WaveformType, WhiteboardElement } from '../types';

interface InstrumentInspectorModalProps {
  element: WhiteboardElement | null;
  simState: SimulatorState | null;
  digitalReport?: DigitalCircuitReport | null;
  simRunning: boolean;
  simSpeed: number;
  onUpdateElement: (id: string, patch: Partial<WhiteboardElement>, commitHistory?: boolean) => void;
  onAutoAssignLogicLetters?: () => void;
  onToggleRunning: () => void;
  onStepSim: () => void;
  onResetSim: () => void;
  onChangeSpeed: (speed: number) => void;
  onOpenFullSimulator: () => void;
  onClose: () => void;
}

function AnalogMeterGauge({
  value,
  maxRange,
  unit,
  modeLabel,
  connected,
}: {
  value: number;
  maxRange: number;
  unit: string;
  modeLabel: string;
  connected: boolean;
}) {
  const safeMax = Math.max(1e-6, maxRange);
  const clamped = Math.max(-1, Math.min(1, value / safeMax));
  const angleDeg = clamped * 62; // -62 deg (left) to +62 deg (right)
  const cx = 140;
  const cy = 122;
  const r = 92;

  const polar = (degFromTop: number, rad: number) => {
    const a = ((degFromTop - 90) * Math.PI) / 180;
    return {
      x: cx + Math.cos(a) * rad,
      y: cy + Math.sin(a) * rad,
    };
  };

  const arcStart = polar(-62, r);
  const arcEnd = polar(62, r);
  const needleTip = polar(angleDeg, r - 10);

  const ticks = [-60, -45, -30, -15, 0, 15, 30, 45, 60];

  return (
    <div className="rounded-xl border border-[var(--rf-border)] bg-[#060d15] p-3 flex flex-col items-center">
      <svg viewBox="0 0 280 142" className="w-full max-w-[300px] h-auto">
        {/* Scale background arc */}
        <path
          d={`M ${arcStart.x.toFixed(1)} ${arcStart.y.toFixed(1)} A ${r} ${r} 0 0 1 ${arcEnd.x.toFixed(1)} ${arcEnd.y.toFixed(1)}`}
          fill="none"
          stroke="rgba(148, 163, 184, 0.25)"
          strokeWidth="6"
          strokeLinecap="round"
        />
        {/* Active deflection arc from center zero */}
        {connected && Math.abs(angleDeg) > 0.8 && (
          <path
            d={
              angleDeg >= 0
                ? `M ${cx} ${cy - r} A ${r} ${r} 0 0 1 ${polar(angleDeg, r).x.toFixed(1)} ${polar(angleDeg, r).y.toFixed(1)}`
                : `M ${polar(angleDeg, r).x.toFixed(1)} ${polar(angleDeg, r).y.toFixed(1)} A ${r} ${r} 0 0 1 ${cx} ${cy - r}`
            }
            fill="none"
            stroke="#10b981"
            strokeWidth="4"
            strokeLinecap="round"
          />
        )}

        {/* Graduated scale ticks */}
        {ticks.map((deg) => {
          const isMajor = deg % 30 === 0;
          const pOut = polar(deg, r + 4);
          const pIn = polar(deg, r - (isMajor ? 10 : 5));
          return (
            <line
              key={deg}
              x1={pIn.x}
              y1={pIn.y}
              x2={pOut.x}
              y2={pOut.y}
              stroke={deg === 0 ? '#38bdf8' : 'rgba(226, 232, 240, 0.55)'}
              strokeWidth={isMajor ? 1.8 : 1}
            />
          );
        })}

        {/* Scale labels */}
        <text x={polar(-62, r + 15).x - 6} y={polar(-62, r + 15).y + 4} fontSize="9" fill="#94a3b8" textAnchor="end">
          -{maxRange.toFixed(1)}{unit}
        </text>
        <text x={cx} y={cy - r - 10} fontSize="9" fill="#38bdf8" textAnchor="middle" fontWeight="600">
          0
        </text>
        <text x={polar(62, r + 15).x + 6} y={polar(62, r + 15).y + 4} fontSize="9" fill="#94a3b8" textAnchor="start">
          +{maxRange.toFixed(1)}{unit}
        </text>

        <text x={cx} y={cy - 34} fontSize="10" fill="#64748b" textAnchor="middle" fontWeight="600">
          {modeLabel}
        </text>

        {/* Needle */}
        <line
          x1={cx}
          y1={cy}
          x2={needleTip.x}
          y2={needleTip.y}
          stroke={connected ? '#34d399' : '#64748b'}
          strokeWidth="2.6"
          strokeLinecap="round"
        />
        <circle cx={cx} cy={cy} r="6" fill="#0f172a" stroke="#e2e8f0" strokeWidth="2" />
      </svg>
    </div>
  );
}

export const InstrumentInspectorModal: React.FC<InstrumentInspectorModalProps> = ({
  element,
  simState,
  digitalReport,
  simRunning,
  simSpeed,
  onUpdateElement,
  onAutoAssignLogicLetters,
  onToggleRunning,
  onStepSim,
  onResetSim,
  onChangeSpeed,
  onOpenFullSimulator,
  onClose,
}) => {
  const [gain, setGain] = useState<number>(1);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [ampDraft, setAmpDraft] = useState<string | null>(null);
  const [freqDraft, setFreqDraft] = useState<string | null>(null);

  const comp = useMemo(() => {
    if (!element || !simState?.ok) return null;
    return simState.components.find((c) => c.elementId === element.id) || null;
  }, [element, simState]);

  const probeChannel = useMemo(() => {
    if (!element || element.circuitKind !== 'oscilloscope') return null;
    return getCroProbeWaveform(simState, element.id);
  }, [element, simState]);

  if (!element || element.type !== 'circuit' || !element.circuitKind) return null;
  const kind = element.circuitKind;
  const isFgen = kind === 'function-generator';
  const isGate = isLogicGateKind(kind);
  if (
    kind !== 'voltmeter' &&
    kind !== 'ammeter' &&
    kind !== 'oscilloscope' &&
    !isFgen &&
    !isGate
  ) {
    return null;
  }

  const isCro = kind === 'oscilloscope';
  const isVolt = kind === 'voltmeter';
  const isConnected = Boolean(simState?.ok && comp?.probesConnected);

  const gateEval = isGate ? digitalReport?.gateMap?.[element.id] || null : null;

  // CRO displays ONLY the waveform measured at its own attached CH1+ / REF- probe
  const visibleChannels: WaveformChannel[] = probeChannel ? [probeChannel] : [];

  // Compute probe metrics strictly from this CRO's attached probe channel
  const targetSamples = probeChannel?.samples || [];
  const vMax = targetSamples.length > 0 ? Math.max(...targetSamples) : 0;
  const vMin = targetSamples.length > 0 ? Math.min(...targetSamples) : 0;
  const vPp = vMax - vMin;
  const vRms = probeChannel?.rms ?? (isConnected ? comp?.vRms ?? 0 : 0);

  // Vertical auto-scaling for this CRO probe trace
  const scopeW = 460;
  const scopeH = 220;
  const voltChs = visibleChannels.filter((ch) => ch.unit === 'V');
  const currChs = visibleChannels.filter((ch) => ch.unit === 'mA');
  const maxVolts =
    Math.max(0.5, ...voltChs.flatMap((ch) => ch.samples.map((s) => Math.abs(s)))) / gain;
  const maxMilliamps =
    Math.max(1, ...currChs.flatMap((ch) => ch.samples.map((s) => Math.abs(s)))) / gain;

  // Analog meter auto-range for Voltmeter / Ammeter
  const rawPrimary = isVolt
    ? simState?.mode === 'ac'
      ? comp?.vRms ?? 0
      : comp?.vInst ?? 0
    : simState?.mode === 'ac'
    ? (comp?.iRms ?? 0) * 1000
    : (comp?.iInst ?? 0) * 1000;

  const peakForRange = isVolt
    ? Math.max(12, Math.ceil((comp?.vPeak ?? 12) * 1.25))
    : Math.max(20, Math.ceil(Math.max(Math.abs(rawPrimary), (comp?.iPeak ?? 0.02) * 1000) * 1.35));

  const title = isFgen
    ? 'Function Generator (Sine / Triangle / Square)'
    : isGate
    ? `Digital Logic Gate · ${gateEval?.gateLabel || kind.replace('gate-', '').toUpperCase()}`
    : isCro
    ? 'CRO (Cathode-Ray Oscilloscope)'
    : isVolt
    ? 'Digital & Analog Voltmeter'
    : 'Digital & Analog Ammeter';

  return (
    <section
      aria-label={title}
      data-testid="instrument-inspector-modal"
      className="rf-panel fixed left-1/2 bottom-16 -translate-x-1/2 z-30 w-[540px] max-w-[94vw] rounded-2xl overflow-hidden shadow-2xl"
    >
      {/* Instrument Bezel Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--rf-border)] bg-[var(--rf-surface-elevated)]">
        <div className="flex items-center gap-2 min-w-0">
          {isFgen ? (
            <Waves className="w-4 h-4 text-[var(--rf-accent)] shrink-0" />
          ) : isGate ? (
            <Binary className="w-4 h-4 text-[var(--rf-accent)] shrink-0" />
          ) : isCro ? (
            <Activity className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <Gauge className="w-4 h-4 text-[var(--rf-accent)] shrink-0" />
          )}
          <h3 className="text-xs font-semibold text-[var(--rf-text)] truncate">{title}</h3>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            aria-label={simRunning ? 'Pause instrument' : 'Run instrument'}
            onClick={onToggleRunning}
            className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold whitespace-nowrap ${
              simRunning
                ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                : 'bg-[var(--rf-accent)] text-[var(--rf-accent-fg)] hover:opacity-95'
            }`}
          >
            {simRunning ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
            <span>{simRunning ? 'Pause' : 'Run'}</span>
          </button>
          <button
            type="button"
            aria-label="Step instrument"
            onClick={onStepSim}
            className="p-1.5 rounded-md border border-[var(--rf-border)] bg-[var(--rf-surface)] text-[var(--rf-text)] hover:border-[var(--rf-accent)]"
            title="Step +Δt"
          >
            <StepForward className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            aria-label="Reset instrument time"
            onClick={onResetSim}
            className="p-1.5 rounded-md border border-[var(--rf-border)] bg-[var(--rf-surface)] text-[var(--rf-text)] hover:border-[var(--rf-accent)]"
            title="Reset t = 0"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            aria-label="Open full simulator lab"
            onClick={onOpenFullSimulator}
            className="p-1.5 rounded-md border border-[var(--rf-border)] bg-[var(--rf-surface)] text-[var(--rf-text-muted)] hover:text-[var(--rf-text)]"
            title="Open Full Simulator & Phasor Lab"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            aria-label="Close instrument view"
            onClick={onClose}
            className="p-1.5 rounded-md text-[var(--rf-text-muted)] hover:bg-[var(--rf-surface-hover)]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Probe Connection Status Bar (only for Meters & CRO) */}
      {!isFgen && !isGate && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-1.5 border-b border-[var(--rf-border)] bg-[var(--rf-surface)] text-[11px] font-mono-tabular">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-[var(--rf-text)]">
              <span className="w-2.5 h-2.5 rounded-sm bg-rose-500 inline-block" />
              <span>{isCro ? 'CH1+ Probe' : '+ Probe'}:</span>
              <strong className="text-[var(--rf-text)]">
                {comp ? `${comp.nodeAVoltage.toFixed(2)} V` : '—'}
              </strong>
            </span>
            <span className="flex items-center gap-1.5 text-[var(--rf-text)]">
              <span className="w-2.5 h-2.5 rounded-sm bg-sky-400 inline-block" />
              <span>{isCro ? 'REF− Probe' : 'COM −'}:</span>
              <strong className="text-[var(--rf-text)]">
                {comp ? `${comp.nodeBVoltage.toFixed(2)} V` : '—'}
              </strong>
            </span>
          </div>

          <span
            data-testid="instrument-probe-status"
            className={
              isConnected
                ? 'text-emerald-500 font-semibold'
                : 'text-amber-600 font-semibold'
            }
          >
            {isConnected
              ? 'Probes Locked'
              : !simState?.ok
              ? 'Wire to powered circuit'
              : 'Connect + & − probes'}
          </span>
        </div>
      )}

      <div className="p-4 space-y-3 text-xs max-h-[64vh] overflow-y-auto rf-scrollbar">
        {isFgen ? (
          /* BENCHTOP FUNCTION GENERATOR CONTROLS & WAVEFORM PREVIEW */
          (() => {
            const wf: WaveformType = element.waveformType || 'sine';
            const ampPeak = parseEngineeringValue(element.componentValue, 10);
            const freqHz = element.frequencyHz ?? 60;
            const ampSpec = getComponentSliderSpec('function-generator', ampPeak);
            const vrms =
              wf === 'square'
                ? ampPeak
                : wf === 'triangle'
                ? ampPeak / Math.sqrt(3)
                : ampPeak / Math.SQRT2;
            const pvW = 460;
            const pvH = 128;
            const samplesCount = 120;
            const periodSec = 1 / Math.max(1, freqHz);
            const pts = Array.from({ length: samplesCount }, (_, idx) => {
              const t = (idx / (samplesCount - 1)) * periodSec * 2;
              const v = evaluateWaveformSample(wf, ampPeak, freqHz, t);
              const px = (idx / (samplesCount - 1)) * pvW;
              const py = pvH / 2 - (v / Math.max(0.5, ampPeak)) * (pvH * 0.38);
              return `${px.toFixed(1)},${py.toFixed(1)}`;
            }).join(' ');

            return (
              <div className="space-y-3" data-testid="fgen-inspector-body">
                {/* Waveform Switcher */}
                <div>
                  <div className="text-[11px] font-medium text-[var(--rf-text-muted)] mb-1.5">
                    Signal Waveform Shape
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(
                      [
                        { id: 'sine', label: 'Sinusoidal' },
                        { id: 'triangle', label: 'Triangular' },
                        { id: 'square', label: 'Square Wave' },
                      ] as { id: WaveformType; label: string }[]
                    ).map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        data-testid={`fgen-wave-${item.id}`}
                        onClick={() => onUpdateElement(element.id, { waveformType: item.id }, true)}
                        className={`py-2 px-2.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                          wf === item.id
                            ? 'bg-[var(--rf-accent)] text-[var(--rf-accent-fg)]'
                            : 'bg-[var(--rf-surface-elevated)] border border-[var(--rf-border)] text-[var(--rf-text)] hover:border-[var(--rf-accent)]'
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Live 2-Cycle Output Preview */}
                <div className="rounded-xl border border-emerald-500/30 bg-[#040b0f] p-2.5">
                  <svg viewBox={`0 0 ${pvW} ${pvH}`} className="w-full h-28" data-testid="fgen-preview-svg">
                    <line x1={0} y1={pvH / 2} x2={pvW} y2={pvH / 2} stroke="rgba(52,211,153,0.3)" />
                    <line x1={pvW / 2} y1={0} x2={pvW / 2} y2={pvH} stroke="rgba(52,211,153,0.18)" strokeDasharray="3 4" />
                    <polyline
                      data-testid="fgen-preview-trace"
                      fill="none"
                      stroke="#34d399"
                      strokeWidth="2.5"
                      strokeLinejoin="round"
                      points={pts}
                    />
                  </svg>
                </div>

                {/* Amplitude & Frequency Controls */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-2.5 rounded-xl border border-[var(--rf-border)] bg-[var(--rf-surface-elevated)] space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-[var(--rf-text-muted)]">Amplitude (Vpk)</span>
                      <input
                        type="text"
                        aria-label="Function generator amplitude"
                        value={ampDraft !== null ? ampDraft : element.componentValue || '10V'}
                        onChange={(e) => {
                          const raw = e.target.value;
                          setAmpDraft(raw);
                          if (raw.trim()) {
                            const norm = normalizeComponentValueInput('function-generator', raw);
                            onUpdateElement(element.id, { componentValue: norm.formatted }, false);
                          }
                        }}
                        onBlur={() => {
                          if (ampDraft !== null) {
                            const norm = normalizeComponentValueInput('function-generator', ampDraft);
                            onUpdateElement(element.id, { componentValue: norm.formatted }, true);
                            setAmpDraft(null);
                          }
                        }}
                        className="w-20 px-2 py-0.5 rounded bg-[var(--rf-surface)] border border-[var(--rf-border)] text-[var(--rf-text)] font-mono-tabular text-xs text-right outline-none focus:border-[var(--rf-accent)]"
                      />
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={1000}
                      step={1}
                      value={Math.round(valueToSliderPos(ampPeak, ampSpec))}
                      onChange={(e) => {
                        const nextVal = sliderPosToValue(Number(e.target.value), ampSpec);
                        setAmpDraft(null);
                        onUpdateElement(
                          element.id,
                          { componentValue: formatComponentCompactValue('function-generator', nextVal) },
                          false
                        );
                      }}
                      className="w-full accent-[var(--rf-accent)] cursor-pointer"
                    />
                  </div>

                  <div className="p-2.5 rounded-xl border border-[var(--rf-border)] bg-[var(--rf-surface-elevated)] space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-[var(--rf-text-muted)]">Frequency (Hz)</span>
                      <input
                        type="text"
                        aria-label="Function generator frequency"
                        value={freqDraft !== null ? freqDraft : String(freqHz)}
                        onChange={(e) => {
                          const raw = e.target.value;
                          setFreqDraft(raw);
                          const parsed = parseFrequencyInput(raw, -1);
                          if (parsed > 0) onUpdateElement(element.id, { frequencyHz: parsed }, false);
                        }}
                        onBlur={() => {
                          if (freqDraft !== null) {
                            onUpdateElement(
                              element.id,
                              { frequencyHz: parseFrequencyInput(freqDraft, freqHz) },
                              true
                            );
                            setFreqDraft(null);
                          }
                        }}
                        className="w-20 px-2 py-0.5 rounded bg-[var(--rf-surface)] border border-[var(--rf-border)] text-[var(--rf-text)] font-mono-tabular text-xs text-right outline-none focus:border-[var(--rf-accent)]"
                      />
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={1000}
                      step={1}
                      value={Math.round(
                        valueToSliderPos(freqHz, { min: 1, max: 100_000, scale: 'log', label: 'Frequency' })
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
                        onUpdateElement(element.id, { frequencyHz: nextHz }, false);
                      }}
                      className="w-full accent-[var(--rf-accent)] cursor-pointer"
                    />
                  </div>
                </div>

                {/* Output Summary Metrics */}
                <div className="grid grid-cols-4 gap-2 font-mono-tabular">
                  <div className="p-2 rounded-lg bg-[var(--rf-surface-elevated)] border border-[var(--rf-border)]">
                    <div className="text-[10px] text-[var(--rf-text-muted)]">Waveform</div>
                    <div className="font-semibold text-[var(--rf-text)] uppercase">{wf}</div>
                  </div>
                  <div className="p-2 rounded-lg bg-[var(--rf-surface-elevated)] border border-[var(--rf-border)]">
                    <div className="text-[10px] text-[var(--rf-text-muted)]">Vpp</div>
                    <div className="font-semibold text-[var(--rf-text)]">{(ampPeak * 2).toFixed(2)} V</div>
                  </div>
                  <div className="p-2 rounded-lg bg-[var(--rf-surface-elevated)] border border-[var(--rf-border)]">
                    <div className="text-[10px] text-[var(--rf-text-muted)]">Vrms</div>
                    <div className="font-semibold text-[var(--rf-text)]">{vrms.toFixed(2)} V</div>
                  </div>
                  <div className="p-2 rounded-lg bg-[var(--rf-surface-elevated)] border border-[var(--rf-border)]">
                    <div className="text-[10px] text-[var(--rf-text-muted)]">Freq</div>
                    <div className="font-semibold text-[var(--rf-text)]">{freqHz} Hz</div>
                  </div>
                </div>
              </div>
            );
          })()
        ) : isGate ? (
          /* DIGITAL LOGIC GATE BINARY & SYMBOLIC INSPECTOR */
          (() => {
            const isNot = kind === 'gate-not';
            const inModeLetter =
              digitalReport?.mode === 'symbolic' ||
              isLetterLogicInput(element.logicInputA) ||
              (!isNot && isLetterLogicInput(element.logicInputB));
            const curA = element.logicInputA ?? '0';
            const curB = element.logicInputB ?? '0';

            return (
              <div className="space-y-3" data-testid="logic-gate-inspector">
                {digitalReport && !digitalReport.valid && (
                  <div className="p-2.5 rounded-lg border border-amber-500/40 bg-amber-500/12 text-amber-200 flex items-center justify-between gap-2">
                    <span>{digitalReport.validationError}</span>
                    {onAutoAssignLogicLetters && (
                      <button
                        type="button"
                        onClick={onAutoAssignLogicLetters}
                        className="px-2.5 py-1 rounded-md bg-[var(--rf-accent)] text-[var(--rf-accent-fg)] font-semibold whitespace-nowrap shrink-0"
                      >
                        Auto-fill Letters
                      </button>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Pin A */}
                  <div className="p-2.5 rounded-xl border border-[var(--rf-border)] bg-[var(--rf-surface-elevated)] space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-[var(--rf-text)]">Input A</span>
                      {gateEval?.inputAWiredFrom && (
                        <span className="text-[10px] font-mono-tabular text-[var(--rf-accent)]">
                          Wired ← {gateEval.inputAWiredFrom}
                        </span>
                      )}
                    </div>
                    {gateEval?.inputAWiredFrom ? (
                      <div className="px-2.5 py-1.5 rounded bg-[var(--rf-surface)] border border-[var(--rf-border)] font-mono-tabular text-[var(--rf-text)]">
                        {gateEval.inputALabel}
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          disabled={inModeLetter}
                          onClick={() => onUpdateElement(element.id, { logicInputA: '0' }, true)}
                          className={`px-2.5 py-1 rounded font-mono-tabular font-semibold border disabled:opacity-35 ${
                            curA === '0'
                              ? 'bg-[var(--rf-accent)] text-[var(--rf-accent-fg)] border-transparent'
                              : 'bg-[var(--rf-surface)] border-[var(--rf-border)] text-[var(--rf-text)]'
                          }`}
                        >
                          0
                        </button>
                        <button
                          type="button"
                          disabled={inModeLetter}
                          onClick={() => onUpdateElement(element.id, { logicInputA: '1' }, true)}
                          className={`px-2.5 py-1 rounded font-mono-tabular font-semibold border disabled:opacity-35 ${
                            curA === '1'
                              ? 'bg-emerald-600 text-white border-transparent'
                              : 'bg-[var(--rf-surface)] border-[var(--rf-border)] text-[var(--rf-text)]'
                          }`}
                        >
                          1
                        </button>
                        <input
                          type="text"
                          aria-label="Gate Input A letter or bit"
                          value={curA}
                          maxLength={4}
                          onChange={(e) => {
                            const tok = e.target.value.trim()
                              ? normalizeLogicInputToken(e.target.value)
                              : '';
                            onUpdateElement(element.id, { logicInputA: tok || '0' }, true);
                          }}
                          className="flex-1 min-w-0 px-2 py-1 rounded bg-[var(--rf-surface)] border border-[var(--rf-border)] text-[var(--rf-text)] font-mono-tabular text-center outline-none focus:border-[var(--rf-accent)]"
                          placeholder="0/1 or A"
                        />
                      </div>
                    )}
                  </div>

                  {/* Pin B */}
                  {!isNot && (
                    <div className="p-2.5 rounded-xl border border-[var(--rf-border)] bg-[var(--rf-surface-elevated)] space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-[var(--rf-text)]">Input B</span>
                        {gateEval?.inputBWiredFrom && (
                          <span className="text-[10px] font-mono-tabular text-[var(--rf-accent)]">
                            Wired ← {gateEval.inputBWiredFrom}
                          </span>
                        )}
                      </div>
                      {gateEval?.inputBWiredFrom ? (
                        <div className="px-2.5 py-1.5 rounded bg-[var(--rf-surface)] border border-[var(--rf-border)] font-mono-tabular text-[var(--rf-text)]">
                          {gateEval.inputBLabel}
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            disabled={inModeLetter}
                            onClick={() => onUpdateElement(element.id, { logicInputB: '0' }, true)}
                            className={`px-2.5 py-1 rounded font-mono-tabular font-semibold border disabled:opacity-35 ${
                              curB === '0'
                                ? 'bg-[var(--rf-accent)] text-[var(--rf-accent-fg)] border-transparent'
                                : 'bg-[var(--rf-surface)] border-[var(--rf-border)] text-[var(--rf-text)]'
                            }`}
                          >
                            0
                          </button>
                          <button
                            type="button"
                            disabled={inModeLetter}
                            onClick={() => onUpdateElement(element.id, { logicInputB: '1' }, true)}
                            className={`px-2.5 py-1 rounded font-mono-tabular font-semibold border disabled:opacity-35 ${
                              curB === '1'
                                ? 'bg-emerald-600 text-white border-transparent'
                                : 'bg-[var(--rf-surface)] border-[var(--rf-border)] text-[var(--rf-text)]'
                            }`}
                          >
                            1
                          </button>
                          <input
                            type="text"
                            aria-label="Gate Input B letter or bit"
                            value={curB}
                            maxLength={4}
                            onChange={(e) => {
                              const tok = e.target.value.trim()
                                ? normalizeLogicInputToken(e.target.value)
                                : '';
                              onUpdateElement(element.id, { logicInputB: tok || '0' }, true);
                            }}
                            className="flex-1 min-w-0 px-2 py-1 rounded bg-[var(--rf-surface)] border border-[var(--rf-border)] text-[var(--rf-text)] font-mono-tabular text-center outline-none focus:border-[var(--rf-accent)]"
                            placeholder="0/1 or B"
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Computed Output Readout */}
                <div className="p-3 rounded-xl border border-[var(--rf-border)] bg-[#060d15] flex items-center justify-between">
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-slate-400">
                      Computed Logic Output (Y)
                    </div>
                    <div
                      data-testid="logic-inspector-output"
                      className="mt-0.5 text-lg font-bold font-mono-tabular text-emerald-400"
                    >
                      {gateEval
                        ? gateEval.outputBinary !== null
                          ? `Y = ${gateEval.outputBinary}`
                          : `Y = ${gateEval.outputExpr}`
                        : '—'}
                    </div>
                  </div>
                  <div className="text-right font-mono-tabular text-[11px] text-slate-400">
                    <div>Mode: {digitalReport?.mode === 'symbolic' ? 'Letters' : 'Binary (0/1)'}</div>
                    <div>
                      {digitalReport?.variables.length
                        ? `Vars: ${digitalReport.variables.join(', ')}`
                        : 'Discrete Boolean'}
                    </div>
                  </div>
                </div>

                {/* Live Truth Table in Symbolic Mode */}
                {digitalReport?.mode === 'symbolic' &&
                  digitalReport.valid &&
                  digitalReport.truthTable.length > 0 && (
                    <div className="max-h-40 overflow-y-auto rf-scrollbar rounded-xl border border-[var(--rf-border)]">
                      <table className="w-full text-center font-mono-tabular text-[11px] border-collapse">
                        <thead>
                          <tr className="bg-[var(--rf-surface-elevated)] border-b border-[var(--rf-border)] text-[var(--rf-text-muted)]">
                            {digitalReport.variables.map((v) => (
                              <th key={v} className="py-1.5 px-2">
                                {v}
                              </th>
                            ))}
                            <th className="py-1.5 px-2 text-emerald-400">
                              Y ({gateEval?.outputExpr})
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--rf-border)]">
                          {digitalReport.truthTable.map((row, rIdx) => (
                            <tr key={rIdx} className="hover:bg-[var(--rf-surface-hover)]">
                              {digitalReport.variables.map((v) => (
                                <td key={v} className="py-1 px-2 text-[var(--rf-text)]">
                                  {row.inputs[v]}
                                </td>
                              ))}
                              <td className="py-1 px-2 font-bold text-emerald-400">
                                {row.outputs[element.id]}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
              </div>
            );
          })()
        ) : !isCro ? (
          /* VOLTMETER & AMMETER BENCHTOP VISUALS */
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-stretch">
              <AnalogMeterGauge
                value={rawPrimary}
                maxRange={peakForRange}
                unit={isVolt ? 'V' : 'mA'}
                modeLabel={isVolt ? (simState?.mode === 'ac' ? 'AC VOLTS' : 'DC / INST V') : 'CURRENT (mA)'}
                connected={isConnected}
              />

              <div className="rounded-xl border border-[var(--rf-border)] bg-[#060d15] p-3 flex flex-col justify-between">
                <div>
                  <div className="text-[11px] text-slate-400 uppercase tracking-wider">
                    {isVolt ? 'Potential Difference (ΔV)' : 'Series Branch Current (I)'}
                  </div>
                  <div
                    data-testid="instrument-digital-readout"
                    className="mt-1 text-2xl font-bold font-mono-tabular text-emerald-400"
                  >
                    {comp
                      ? isVolt
                        ? `${(comp.vInst >= 0 ? '+' : '') + comp.vInst.toFixed(3)} V`
                        : formatEngineering(comp.iInst, 'A')
                      : isVolt
                      ? '0.000 V'
                      : '0.00 A'}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800 font-mono-tabular text-[11px]">
                  <div>
                    <div className="text-slate-400">{isVolt ? 'Vrms' : 'Irms'}</div>
                    <div className="text-slate-100 font-semibold">
                      {comp
                        ? isVolt
                          ? `${comp.vRms.toFixed(3)} V`
                          : formatEngineering(comp.iRms, 'A')
                        : '—'}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-400">{isVolt ? 'Vpeak' : 'Ipeak'}</div>
                    <div className="text-slate-100 font-semibold">
                      {comp
                        ? isVolt
                          ? `${comp.vPeak.toFixed(3)} V`
                          : formatEngineering(comp.iPeak, 'A')
                        : '—'}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {!simState?.ok && (
              <div className="px-3 py-2 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-300 text-[11px]">
                {simState?.error || 'Wire a DC/AC voltage source and connect probes using Wire (W) to read live values.'}
              </div>
            )}
          </>
        ) : (
          /* CRO CATHODE-RAY OSCILLOSCOPE WAVEFORM VIEW */
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <div
                  data-testid="cro-probe-badge"
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[11px] font-medium whitespace-nowrap ${
                    probeChannel
                      ? 'border-emerald-500/60 bg-emerald-500/10 text-[var(--rf-text)]'
                      : 'border-amber-500/50 bg-amber-500/12 text-[var(--rf-text)]'
                  }`}
                >
                  <span
                    className={`w-2.5 h-2.5 rounded-sm shrink-0 ${
                      probeChannel ? 'bg-emerald-500' : 'bg-amber-500'
                    }`}
                  />
                  <span>
                    {probeChannel
                      ? 'CH1 Probe Output (CH1+ − REF−)'
                      : 'CH1 Probe Unattached'}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <div className="flex items-center gap-1">
                  <span className="text-[11px] text-[var(--rf-text-muted)]">V/div:</span>
                  {[0.5, 1, 2, 4].map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setGain(g)}
                      className={`px-1.5 py-0.5 rounded font-mono-tabular text-[11px] ${
                        gain === g
                          ? 'bg-[var(--rf-accent)] text-[var(--rf-accent-fg)]'
                          : 'bg-[var(--rf-surface-elevated)] border border-[var(--rf-border)] text-[var(--rf-text)]'
                      }`}
                    >
                      {g}x
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-1">
                  {[0.25, 1, 2].map((spd) => (
                    <button
                      key={spd}
                      type="button"
                      onClick={() => onChangeSpeed(spd)}
                      className={`px-1.5 py-0.5 rounded font-mono-tabular text-[11px] ${
                        simSpeed === spd
                          ? 'bg-emerald-600 text-white'
                          : 'bg-[var(--rf-surface-elevated)] border border-[var(--rf-border)] text-[var(--rf-text-muted)]'
                      }`}
                    >
                      {spd}x
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* CRO Phosphor CRT */}
            <div className="rounded-xl border border-emerald-500/30 bg-[#040b0f] p-2.5">
              <svg
                viewBox={`0 0 ${scopeW} ${scopeH}`}
                data-testid="cro-crt-svg"
                className="w-full h-48 cursor-crosshair"
                onMouseMove={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const relX = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                  const len = simState?.timePointsMs.length || 0;
                  if (len > 1) setHoverIdx(Math.round(relX * (len - 1)));
                }}
                onMouseLeave={() => setHoverIdx(null)}
              >
                {/* 8 horizontal CRT grid divisions */}
                {[0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875].map((f) => (
                  <line
                    key={`h_${f}`}
                    x1={0}
                    y1={scopeH * f}
                    x2={scopeW}
                    y2={scopeH * f}
                    stroke={f === 0.5 ? 'rgba(52, 211, 153, 0.38)' : 'rgba(52, 211, 153, 0.12)'}
                    strokeDasharray={f === 0.5 ? undefined : '3 4'}
                  />
                ))}
                {/* 10 vertical CRT grid divisions */}
                {[0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9].map((f) => (
                  <line
                    key={`v_${f}`}
                    x1={scopeW * f}
                    y1={0}
                    x2={scopeW * f}
                    y2={scopeH}
                    stroke={f === 0.5 ? 'rgba(52, 211, 153, 0.35)' : 'rgba(52, 211, 153, 0.12)'}
                    strokeDasharray={f === 0.5 ? undefined : '3 4'}
                  />
                ))}

                {/* Baseline flat trace when CRO probe is unattached */}
                {visibleChannels.length === 0 && (
                  <>
                    <line
                      x1={0}
                      y1={scopeH / 2}
                      x2={scopeW}
                      y2={scopeH / 2}
                      stroke="#34d399"
                      strokeWidth="2"
                      strokeOpacity="0.65"
                    />
                    <text
                      x={scopeW / 2}
                      y={scopeH / 2 - 14}
                      textAnchor="middle"
                      fontSize="11"
                      fill="rgba(148, 163, 184, 0.85)"
                      fontFamily="JetBrains Mono, monospace"
                    >
                      NO PROBE ATTACHED · 0.00 V
                    </text>
                  </>
                )}

                {visibleChannels.map((ch) => {
                  const scaleMax = ch.unit === 'V' ? maxVolts : maxMilliamps;
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
                      data-testid="cro-probe-trace"
                      fill="none"
                      stroke="#34d399"
                      strokeWidth={2.5}
                      strokeLinejoin="round"
                      points={pts}
                    />
                  );
                })}

                {hoverIdx !== null && simState?.ok && simState.timePointsMs.length > 1 && (
                  <line
                    x1={(hoverIdx / (simState.timePointsMs.length - 1)) * scopeW}
                    y1={0}
                    x2={(hoverIdx / (simState.timePointsMs.length - 1)) * scopeW}
                    y2={scopeH}
                    stroke="#f8fafc"
                    strokeWidth="1"
                    strokeDasharray="3 3"
                  />
                )}
              </svg>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 text-[11px] font-mono-tabular text-emerald-300/80">
                <span>
                  {simState?.ok
                    ? `${(simState.timePointsMs[0] || 0).toFixed(2)}–${(
                        simState.timePointsMs[simState.timePointsMs.length - 1] || 0
                      ).toFixed(2)} ms`
                    : '0.00 ms'}
                  {voltChs.length > 0 ? ` · ±${maxVolts.toFixed(1)}V` : ''}
                  {currChs.length > 0 ? ` · ±${maxMilliamps.toFixed(0)}mA` : ''}
                </span>
                {hoverIdx !== null && simState?.ok && visibleChannels.length > 0 && (
                  <span className="text-slate-100">
                    t={simState.timePointsMs[hoverIdx]?.toFixed(2)}ms ·{' '}
                    {visibleChannels
                      .map((ch) => `CH1: ${(ch.samples[hoverIdx] || 0).toFixed(2)}${ch.unit}`)
                      .join(' | ')}
                  </span>
                )}
              </div>
            </div>

            {/* CRO Measurement Readouts */}
            <div className="grid grid-cols-4 gap-2 font-mono-tabular">
              <div className="p-2 rounded-lg bg-[var(--rf-surface-elevated)] border border-[var(--rf-border)]">
                <div className="text-[10px] text-[var(--rf-text-muted)]">Vpp (Probe)</div>
                <div className="font-semibold text-[var(--rf-text)]">{vPp.toFixed(2)} V</div>
              </div>
              <div className="p-2 rounded-lg bg-[var(--rf-surface-elevated)] border border-[var(--rf-border)]">
                <div className="text-[10px] text-[var(--rf-text-muted)]">Vrms</div>
                <div className="font-semibold text-[var(--rf-text)]">{vRms.toFixed(2)} V</div>
              </div>
              <div className="p-2 rounded-lg bg-[var(--rf-surface-elevated)] border border-[var(--rf-border)]">
                <div className="text-[10px] text-[var(--rf-text-muted)]">Vmax / Vmin</div>
                <div className="font-semibold text-[var(--rf-text)]">
                  {vMax.toFixed(1)} / {vMin.toFixed(1)}V
                </div>
              </div>
              <div className="p-2 rounded-lg bg-[var(--rf-surface-elevated)] border border-[var(--rf-border)]">
                <div className="text-[10px] text-[var(--rf-text-muted)]">Freq</div>
                <div className="font-semibold text-[var(--rf-text)]">
                  {simState?.ok && probeChannel
                    ? simState.mode === 'ac'
                      ? `${simState.frequencyHz} Hz`
                      : simState.odeInfo.naturalFreqHz
                      ? `${simState.odeInfo.naturalFreqHz.toFixed(1)} Hz`
                      : 'DC Step'
                    : '—'}
                </div>
              </div>
            </div>

            {(!simState?.ok || !isConnected) && (
              <div
                data-testid="cro-unattached-hint"
                className="px-3 py-2 rounded-lg border border-amber-500/45 bg-amber-500/12 text-[var(--rf-text)] text-[11px] flex items-center gap-2"
              >
                <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                <span>
                  {!simState?.ok
                    ? simState?.error || 'Wire CH1+ and REF− probes across circuit nodes to capture live waveforms.'
                    : 'Probes not attached — wire CH1+ and REF− probes to circuit nodes to display only that node’s waveform.'}
                </span>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
};
