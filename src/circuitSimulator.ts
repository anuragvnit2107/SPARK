import { CircuitKind, Point, WaveformType, WhiteboardElement } from './types';
import { getCircuitTerminals } from './engineeringComponents';
import { getAnchorWorldPosition, getNormalizedBounds, pointToSegmentDistance } from './sketchEngine';

export interface ParsedCircuitComponent {
  elementId: string;
  kind: CircuitKind;
  label: string;
  valueNum: number;
  frequencyHz: number;
  waveformType?: WaveformType;
  switchClosed?: boolean;
  nodeA: number; // + / in / pos
  nodeB: number; // - / out / neg
}

export interface CircuitNetlist {
  nodeCount: number;
  groundNode: number;
  components: ParsedCircuitComponent[];
  wireNodeMap: Record<string, number>;
  nodePinCount: Record<number, number>;
  warnings: string[];
  hasAcSource: boolean;
  hasDcSource: boolean;
  hasFunctionGenerator: boolean;
  hasDiode: boolean;
  hasCapacitor: boolean;
  hasInductor: boolean;
  primaryFrequencyHz: number;
}

export type TransientIntegrationMethod = 'trapezoidal' | 'backward-euler';

export type OdeRegime =
  | 'dc-resistive'
  | 'first-order-rc'
  | 'first-order-rl'
  | 'underdamped'
  | 'critically-damped'
  | 'overdamped';

export interface OdeAnalysisInfo {
  order: 0 | 1 | 2;
  regime: OdeRegime;
  tauSec: number | null;
  naturalFreqRad: number | null;
  naturalFreqHz: number | null;
  dampingAlpha: number | null;
  dampingRatioZeta: number | null;
  integrationMethod: TransientIntegrationMethod;
}

export interface ComponentSimResult {
  elementId: string;
  kind: CircuitKind;
  label: string;
  dcVoltage: number;
  dcCurrent: number;
  vInst: number;
  iInst: number;
  dvDt: number;
  diDt: number;
  nodeAVoltage: number;
  nodeBVoltage: number;
  probesConnected: boolean;
  powerInst: number;
  energyJ: number;
  vRms: number;
  vPeak: number;
  vPhaseDeg: number;
  iRms: number;
  iPeak: number;
  iPhaseDeg: number;
  powerWatts: number;
  reactiveVar: number;
}

export interface WaveformChannel {
  id: string;
  label: string;
  color: string;
  unit: 'V' | 'mA';
  samples: number[];
  peak: number;
  rms: number;
}

export interface PhasorVector {
  id: string;
  label: string;
  kind: 'voltage' | 'current';
  magnitude: number;
  angleDeg: number;
  color: string;
}

export interface SimulationReport {
  ok: boolean;
  error?: string;
  warnings: string[];
  mode: 'dc' | 'ac' | 'transient';
  frequencyHz: number;
  tauSec?: number;
  odeInfo?: OdeAnalysisInfo;
  totalStoredEnergyJ?: number;
  timePointsMs: number[];
  channels: WaveformChannel[];
  components: ComponentSimResult[];
  liveReadouts: Record<string, string>;
  wireVoltages?: Record<string, number>;
  phasors: PhasorVector[];
  impedanceSummary?: {
    rOhms: number;
    xOhms: number;
    zMagOhms: number;
    zAngleDeg: number;
    powerFactor: number;
    realPowerW: number;
    reactivePowerVar: number;
    apparentPowerVa: number;
  };
}

export type SimulatorStatus = 'idle' | 'running' | 'paused';

export interface SimulatorState {
  ok: boolean;
  error?: string;
  warnings: string[];
  mode: 'dc' | 'ac' | 'transient';
  status: SimulatorStatus;
  timeSec: number;
  dtSec: number;
  stepCount: number;
  tauSec: number | null;
  odeInfo: OdeAnalysisInfo;
  totalStoredEnergyJ: number;
  frequencyHz: number;
  timeScale: number;
  nodeVoltages: number[];
  wireVoltages: Record<string, number>;
  liveReadouts: Record<string, string>;
  components: ComponentSimResult[];
  timePointsMs: number[];
  channels: WaveformChannel[];
  phasors: PhasorVector[];
  impedanceSummary?: SimulationReport['impedanceSummary'];
}

const SUFFIX_MULTIPLIERS: Record<string, number> = {
  p: 1e-12,
  n: 1e-9,
  u: 1e-6,
  'µ': 1e-6,
  m: 1e-3,
  k: 1e3,
  K: 1e3,
  M: 1e6,
  G: 1e9,
};

export function parseEngineeringValue(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const match = raw.match(/([-+]?\d*\.?\d+(?:[eE][-+]?\d+)?)\s*([pnuµmkKMG])?/);
  if (!match) return fallback;
  const num = parseFloat(match[1]);
  if (!Number.isFinite(num)) return fallback;
  const mult = match[2] ? SUFFIX_MULTIPLIERS[match[2]] ?? 1 : 1;
  return num * mult;
}

export function formatEngineering(value: number, unit: string): string {
  const abs = Math.abs(value);
  if (abs < 1e-9) return `0.00 ${unit}`;
  if (abs < 1e-6) return `${(value * 1e9).toFixed(2)} n${unit}`;
  if (abs < 1e-3) return `${(value * 1e6).toFixed(2)} µ${unit}`;
  if (abs < 1) return `${(value * 1e3).toFixed(2)} m${unit}`;
  if (abs >= 1e6) return `${(value / 1e6).toFixed(2)} M${unit}`;
  if (abs >= 1e3) return `${(value / 1e3).toFixed(2)} k${unit}`;
  return `${value.toFixed(2)} ${unit}`;
}

export function evaluateWaveformSample(
  waveform: WaveformType,
  amplitudePeak: number,
  freqHz: number,
  timeSec: number
): number {
  const safeFreq = Math.max(0.01, freqHz);
  if (waveform === 'square') {
    const cycles = safeFreq * timeSec;
    const phase = ((cycles % 1) + 1) % 1;
    // Use tiny tolerance around integer boundaries so t=0 starts cleanly high (+Vpk)
    return phase < 0.5 - 1e-12 ? amplitudePeak : -amplitudePeak;
  }
  if (waveform === 'triangle') {
    return (
      amplitudePeak *
      (2 / Math.PI) *
      Math.asin(Math.sin(2 * Math.PI * safeFreq * timeSec))
    );
  }
  return amplitudePeak * Math.sin(2 * Math.PI * safeFreq * timeSec);
}

function getDefaultNumericValue(kind: CircuitKind): number {
  switch (kind) {
    case 'resistor':
      return 1000;
    case 'capacitor':
      return 10e-6;
    case 'inductor':
      return 0.1;
    case 'dc-source':
      return 12;
    case 'ac-source':
    case 'function-generator':
      return 10;
    default:
      return 0;
  }
}

export function isTunableCircuitKind(kind: CircuitKind | undefined): boolean {
  return (
    kind === 'resistor' ||
    kind === 'capacitor' ||
    kind === 'inductor' ||
    kind === 'dc-source' ||
    kind === 'ac-source' ||
    kind === 'function-generator'
  );
}

export function getComponentBaseUnit(kind: CircuitKind): string {
  switch (kind) {
    case 'resistor':
      return 'Ω';
    case 'capacitor':
      return 'F';
    case 'inductor':
      return 'H';
    case 'dc-source':
    case 'ac-source':
    case 'function-generator':
      return 'V';
    default:
      return '';
  }
}

export function getComponentDefaultUnitLabel(kind: CircuitKind): string {
  switch (kind) {
    case 'resistor':
      return 'Ω (auto)';
    case 'capacitor':
      return 'µF (auto)';
    case 'inductor':
      return 'mH (auto)';
    case 'dc-source':
    case 'ac-source':
    case 'function-generator':
      return 'V (auto)';
    default:
      return '';
  }
}

/**
 * Formats a numeric engineering value into a concise canonical component string (e.g., 1000 -> "1kΩ", 1e-5 -> "10µF").
 */
export function formatComponentCompactValue(kind: CircuitKind, value: number): string {
  const unit = getComponentBaseUnit(kind);
  if (!unit) return String(value);
  const abs = Math.abs(value);
  if (abs === 0) return `0${unit}`;
  const trim = (n: number) => {
    const rounded = Math.abs(n) >= 100 ? Math.round(n) : Math.round(n * 100) / 100;
    return Number(rounded.toFixed(2)).toString();
  };
  if (abs < 1e-9) return `${trim(value * 1e12)}p${unit}`;
  if (abs < 1e-6) return `${trim(value * 1e9)}n${unit}`;
  if (abs < 1e-3) return `${trim(value * 1e6)}µ${unit}`;
  if (abs < 1) return `${trim(value * 1e3)}m${unit}`;
  if (abs >= 1e9) return `${trim(value / 1e9)}G${unit}`;
  if (abs >= 1e6) return `${trim(value / 1e6)}M${unit}`;
  if (abs >= 1e3) return `${trim(value / 1e3)}k${unit}`;
  return `${trim(value)}${unit}`;
}

/**
 * Auto-detects the appropriate electrical unit based on component kind when a user types a value
 * (e.g. typing "4.7k" on a resistor -> "4.7kΩ", "22" on a capacitor -> "22µF", "100" on an inductor -> "100mH", "15" on a source -> "15V").
 */
export function normalizeComponentValueInput(
  kind: CircuitKind,
  rawInput: string
): { formatted: string; numericValue: number; unit: string } {
  const trimmed = rawInput.trim();
  const baseUnit = getComponentBaseUnit(kind);
  if (!baseUnit) {
    return { formatted: trimmed, numericValue: 0, unit: '' };
  }
  const fallback = getDefaultNumericValue(kind);
  if (!trimmed) {
    return {
      formatted: formatComponentCompactValue(kind, fallback),
      numericValue: fallback,
      unit: baseUnit,
    };
  }

  // Match number + optional SI prefix (p, n, u, µ, m, k, K, M, G) + optional unit text
  const m = trimmed.match(
    /^([-+]?\d*\.?\d+(?:[eE][-+]?\d+)?)\s*([pnuµmkKMG])?\s*(ohms?|ohm|ω|Ω|farads?|f|henrys?|henries|h|volts?|v)?$/i
  );

  if (!m) {
    const parsed = parseEngineeringValue(trimmed, fallback);
    return {
      formatted: formatComponentCompactValue(kind, parsed),
      numericValue: parsed,
      unit: baseUnit,
    };
  }

  const num = parseFloat(m[1]);
  if (!Number.isFinite(num)) {
    return {
      formatted: formatComponentCompactValue(kind, fallback),
      numericValue: fallback,
      unit: baseUnit,
    };
  }

  let prefix = m[2] || '';
  const rawUnit = (m[3] || '').toLowerCase();

  // Distinguish milli (m) vs Mega (M) cleanly; preserve case for k/K/M
  if (prefix === 'u') prefix = 'µ';
  if (prefix === 'K') prefix = 'k';

  // If user typed bare number WITHOUT prefix AND WITHOUT explicit unit on Capacitor or Inductor,
  // auto-detect the practical engineering unit (µF for capacitors, mH for inductors).
  if (!prefix && !rawUnit) {
    if (kind === 'capacitor') prefix = 'µ';
    else if (kind === 'inductor') prefix = 'm';
  }

  // Handle Megaohm typed as "mohm" vs milliohm — in resistor inputs "1M" or "1Mohm" is Mega (uppercase M), "1m" is milli
  const mult = prefix ? SUFFIX_MULTIPLIERS[prefix] ?? 1 : 1;
  const numericValue = Math.max(
    kind === 'dc-source' || kind === 'ac-source' || kind === 'function-generator' ? 0 : 1e-12,
    num * mult
  );
  const formattedNum = Number(num.toPrecision(6)).toString();
  return {
    formatted: `${formattedNum}${prefix}${baseUnit}`,
    numericValue,
    unit: `${prefix}${baseUnit}`,
  };
}

/**
 * Parses frequency input strings with SI prefixes/units (e.g. "60", "1k", "2.5kHz", "1MHz") into Hz.
 */
export function parseFrequencyInput(rawInput: string, fallbackHz = 60): number {
  const trimmed = rawInput.trim();
  if (!trimmed) return fallbackHz;
  const m = trimmed.match(/^([-+]?\d*\.?\d+(?:[eE][-+]?\d+)?)\s*([kKMGm])?\s*(hz)?$/i);
  if (!m) return fallbackHz;
  const num = parseFloat(m[1]);
  if (!Number.isFinite(num) || num <= 0) return fallbackHz;
  const p = m[2] || '';
  const mult = p === 'k' || p === 'K' ? 1e3 : p === 'M' ? 1e6 : p === 'G' ? 1e9 : p === 'm' ? 1e-3 : 1;
  return Math.max(1, Math.min(1_000_000, Math.round(num * mult * 100) / 100));
}

export interface ComponentSliderSpec {
  min: number;
  max: number;
  scale: 'log' | 'linear';
  step?: number;
  label: string;
}

export function getComponentSliderSpec(
  kind: CircuitKind,
  currentVal?: number
): ComponentSliderSpec {
  switch (kind) {
    case 'resistor':
      return { min: 1, max: 1_000_000, scale: 'log', label: 'Resistance' };
    case 'capacitor':
      return { min: 1e-9, max: 1e-2, scale: 'log', label: 'Capacitance' };
    case 'inductor':
      return { min: 1e-5, max: 10, scale: 'log', label: 'Inductance' };
    case 'dc-source':
    case 'ac-source':
    case 'function-generator': {
      const vmax = Math.max(50, Math.ceil((currentVal || 12) / 25) * 25, 100);
      return { min: 0, max: vmax, scale: 'linear', step: 0.5, label: 'Voltage Magnitude' };
    }
    default:
      return { min: 0, max: 100, scale: 'linear', step: 1, label: 'Value' };
  }
}

export function valueToSliderPos(val: number, spec: ComponentSliderSpec): number {
  const clamped = Math.max(spec.min, Math.min(spec.max, val));
  if (spec.scale === 'linear') {
    return ((clamped - spec.min) / Math.max(1e-12, spec.max - spec.min)) * 1000;
  }
  const logMin = Math.log10(Math.max(1e-15, spec.min));
  const logMax = Math.log10(Math.max(1e-14, spec.max));
  const logVal = Math.log10(Math.max(1e-15, clamped));
  return Math.max(0, Math.min(1000, ((logVal - logMin) / (logMax - logMin)) * 1000));
}

export function sliderPosToValue(pos: number, spec: ComponentSliderSpec): number {
  const t = Math.max(0, Math.min(1, pos / 1000));
  if (spec.scale === 'linear') {
    const raw = spec.min + t * (spec.max - spec.min);
    const step = spec.step || 0.5;
    return Math.round(raw / step) * step;
  }
  const logMin = Math.log10(Math.max(1e-15, spec.min));
  const logMax = Math.log10(Math.max(1e-14, spec.max));
  const raw = Math.pow(10, logMin + t * (logMax - logMin));
  // Snap to clean 2-significant-digit engineering value so dragging shows tidy readings
  const mag = Math.pow(10, Math.floor(Math.log10(raw)) - 1);
  return Math.round(raw / mag) * mag;
}

class UnionFind {
  parent: number[];
  constructor(n: number) {
    this.parent = Array.from({ length: n }, (_, i) => i);
  }
  find(x: number): number {
    while (this.parent[x] !== x) {
      this.parent[x] = this.parent[this.parent[x]];
      x = this.parent[x];
    }
    return x;
  }
  union(a: number, b: number) {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.parent[rb] = ra;
  }
}

/** Extracts an electrical netlist from canvas components and wires via bindings + spatial proximity */
export function extractNetlistFromCanvas(
  elements: WhiteboardElement[],
  overrideFrequencyHz?: number
): CircuitNetlist {
  const active = elements.filter((e) => !e.isDeleted);
  const circuits = active.filter((e) => e.type === 'circuit' && e.circuitKind);
  const wires = active.filter(
    (e) =>
      (e.type === 'wire' || e.type === 'line' || e.type === 'arrow') &&
      e.points &&
      e.points.length >= 2
  );

  interface PinPoint {
    pt: Point;
    elementId: string;
    terminalId: string;
    kind: 'terminal' | 'wireEnd';
  }

  const probeElementIds = new Set(
    circuits
      .filter((c) => c.circuitKind === 'oscilloscope' || c.circuitKind === 'voltmeter')
      .map((c) => c.id)
  );

  const allPoints: PinPoint[] = [];
  const terminalIndexMap = new Map<string, number>();

  for (const c of circuits) {
    const pins = getCircuitTerminals(c);
    for (const pin of pins) {
      const idx = allPoints.length;
      allPoints.push({
        pt: getAnchorWorldPosition(c, { x: pin.nx, y: pin.ny }),
        elementId: c.id,
        terminalId: pin.id,
        kind: 'terminal',
      });
      terminalIndexMap.set(`${c.id}:${pin.id}`, idx);
    }
  }

  const wireEndpoints: { wireId: string; startIdx: number; endIdx: number; pts: Point[] }[] = [];
  for (const w of wires) {
    const worldPts = w.points!.map((p) => ({ x: w.x + p.x, y: w.y + p.y }));
    const startIdx = allPoints.length;
    allPoints.push({
      pt: worldPts[0],
      elementId: w.id,
      terminalId: 'start',
      kind: 'wireEnd',
    });
    const endIdx = allPoints.length;
    allPoints.push({
      pt: worldPts[worldPts.length - 1],
      elementId: w.id,
      terminalId: 'end',
      kind: 'wireEnd',
    });
    wireEndpoints.push({ wireId: w.id, startIdx, endIdx, pts: worldPts });
  }

  const uf = new UnionFind(allPoints.length);

  for (const we of wireEndpoints) {
    uf.union(we.startIdx, we.endIdx);
  }

  const boundWireEnds = new Set<number>();
  for (let i = 0; i < wires.length; i++) {
    const w = wires[i];
    const we = wireEndpoints[i];
    if (w.startBinding?.elementId && w.startBinding.terminalId) {
      const targetIdx = terminalIndexMap.get(
        `${w.startBinding.elementId}:${w.startBinding.terminalId}`
      );
      if (targetIdx !== undefined) {
        uf.union(we.startIdx, targetIdx);
        boundWireEnds.add(we.startIdx);
      }
    }
    if (w.endBinding?.elementId && w.endBinding.terminalId) {
      const targetIdx = terminalIndexMap.get(
        `${w.endBinding.elementId}:${w.endBinding.terminalId}`
      );
      if (targetIdx !== undefined) {
        uf.union(we.endIdx, targetIdx);
        boundWireEnds.add(we.endIdx);
      }
    }
  }

  const SNAP_RADIUS = 24;
  for (let i = 0; i < allPoints.length; i++) {
    for (let j = i + 1; j < allPoints.length; j++) {
      if (
        allPoints[i].kind === 'terminal' &&
        allPoints[j].kind === 'terminal' &&
        allPoints[i].elementId === allPoints[j].elementId
      ) {
        continue;
      }
      if (
        (boundWireEnds.has(i) && allPoints[j].kind === 'terminal') ||
        (boundWireEnds.has(j) && allPoints[i].kind === 'terminal')
      ) {
        continue;
      }
      const d = Math.hypot(
        allPoints[i].pt.x - allPoints[j].pt.x,
        allPoints[i].pt.y - allPoints[j].pt.y
      );
      if (d <= SNAP_RADIUS) {
        uf.union(i, j);
      }
    }
  }

  for (let i = 0; i < allPoints.length; i++) {
    const isWireEnd = allPoints[i].kind === 'wireEnd' && !boundWireEnds.has(i);
    const isProbeTip =
      allPoints[i].kind === 'terminal' && probeElementIds.has(allPoints[i].elementId);
    if (!isWireEnd && !isProbeTip) continue;
    for (const we of wireEndpoints) {
      if (allPoints[i].elementId === we.wireId) continue;
      for (let s = 0; s < we.pts.length - 1; s++) {
        if (pointToSegmentDistance(allPoints[i].pt, we.pts[s], we.pts[s + 1]) <= 12) {
          uf.union(i, we.startIdx);
          break;
        }
      }
    }
  }

  const rootToNode = new Map<number, number>();
  const getCompactNode = (ptIdx: number): number => {
    const r = uf.find(ptIdx);
    let node = rootToNode.get(r);
    if (node === undefined) {
      node = rootToNode.size;
      rootToNode.set(r, node);
    }
    return node;
  };

  const nodePinCount: Record<number, number> = {};
  for (let i = 0; i < allPoints.length; i++) {
    const n = getCompactNode(i);
    nodePinCount[n] = (nodePinCount[n] || 0) + 1;
  }

  const warnings: string[] = [];
  let groundCompact: number | null = null;
  for (const c of circuits) {
    if (c.circuitKind === 'ground') {
      const idx = terminalIndexMap.get(`${c.id}:gnd`);
      if (idx !== undefined) {
        groundCompact = getCompactNode(idx);
        break;
      }
    }
  }

  const parsed: ParsedCircuitComponent[] = [];
  let hasAcSource = false;
  let hasDcSource = false;
  let hasFunctionGenerator = false;
  let hasDiode = false;
  let hasCapacitor = false;
  let hasInductor = false;
  let primaryFreq = overrideFrequencyHz || 60;

  let resIdx = 1;
  let capIdx = 1;
  let indIdx = 1;
  let srcIdx = 1;
  let dioIdx = 1;
  let swIdx = 1;
  let vmIdx = 1;
  let amIdx = 1;
  let scIdx = 1;

  for (const c of circuits) {
    const kind = c.circuitKind!;
    if (kind === 'ground') continue;

    const pins = getCircuitTerminals(c);
    if (pins.length < 2) continue;

    const idxA = terminalIndexMap.get(`${c.id}:${pins[0].id}`);
    const idxB = terminalIndexMap.get(`${c.id}:${pins[1].id}`);
    if (idxA === undefined || idxB === undefined) continue;

    const nA = getCompactNode(idxA);
    const nB = getCompactNode(idxB);

    const val = parseEngineeringValue(c.componentValue, getDefaultNumericValue(kind));
    const freq = overrideFrequencyHz || c.frequencyHz || primaryFreq;
    const wf: WaveformType = c.waveformType || 'sine';
    const switchClosed = Boolean(c.switchClosed);

    let label = c.componentValue || kind;
    if (kind === 'resistor') label = `R${resIdx++} (${c.componentValue || formatEngineering(val, 'Ω')})`;
    else if (kind === 'capacitor') {
      hasCapacitor = true;
      label = `C${capIdx++} (${c.componentValue || formatEngineering(val, 'F')})`;
    } else if (kind === 'inductor') {
      hasInductor = true;
      label = `L${indIdx++} (${c.componentValue || formatEngineering(val, 'H')})`;
    } else if (kind === 'switch') {
      label = `SW${swIdx++} (${switchClosed ? 'CLOSED' : 'OPEN'})`;
    } else if (kind === 'dc-source') {
      hasDcSource = true;
      label = `Vdc${srcIdx++} (${val}V)`;
    } else if (kind === 'ac-source') {
      hasAcSource = true;
      if (!overrideFrequencyHz && c.frequencyHz) primaryFreq = c.frequencyHz;
      label = `Vac${srcIdx++} (${val}V @ ${freq}Hz)`;
    } else if (kind === 'function-generator') {
      hasAcSource = true;
      hasFunctionGenerator = true;
      if (!overrideFrequencyHz && c.frequencyHz) primaryFreq = c.frequencyHz;
      const wfShort = wf === 'triangle' ? 'Tri' : wf === 'square' ? 'Sqr' : 'Sine';
      label = `FGen${srcIdx++} (${val}V ${wfShort} @ ${freq}Hz)`;
    } else if (kind === 'diode') {
      hasDiode = true;
      label = `D${dioIdx++} (${c.componentValue || '1N4148'})`;
    } else if (kind === 'voltmeter') label = `VM${vmIdx++}`;
    else if (kind === 'ammeter') label = `AM${amIdx++}`;
    else if (kind === 'oscilloscope') label = `Scope ${scIdx++}`;

    parsed.push({
      elementId: c.id,
      kind,
      label,
      valueNum: val,
      frequencyHz: freq,
      waveformType: kind === 'function-generator' ? wf : undefined,
      switchClosed: kind === 'switch' ? switchClosed : undefined,
      nodeA: nA,
      nodeB: nB,
    });

    if (
      groundCompact === null &&
      (kind === 'dc-source' || kind === 'ac-source' || kind === 'function-generator')
    ) {
      groundCompact = nB;
    }
  }

  if (groundCompact === null) {
    groundCompact = 0;
  } else if (!circuits.some((c) => c.circuitKind === 'ground') && parsed.length > 0) {
    warnings.push('No Ground symbol placed — using primary source (−) terminal as 0V reference.');
  }

  const remapNode = (n: number): number => {
    if (n === groundCompact) return 0;
    if (n === 0) return groundCompact!;
    return n;
  };

  for (const comp of parsed) {
    comp.nodeA = remapNode(comp.nodeA);
    comp.nodeB = remapNode(comp.nodeB);
  }

  const terminalConnectedNodes = new Set<number>();
  for (let i = 0; i < allPoints.length; i++) {
    if (allPoints[i].kind === 'terminal') {
      terminalConnectedNodes.add(remapNode(getCompactNode(i)));
    }
  }

  const wireNodeMap: Record<string, number> = {};
  for (const we of wireEndpoints) {
    const mapped = remapNode(getCompactNode(we.startIdx));
    if (terminalConnectedNodes.has(mapped)) {
      wireNodeMap[we.wireId] = mapped;
    }
  }

  const remappedPinCount: Record<number, number> = {};
  for (const [origNodeStr, count] of Object.entries(nodePinCount)) {
    const mapped = remapNode(Number(origNodeStr));
    remappedPinCount[mapped] = (remappedPinCount[mapped] || 0) + count;
  }

  return {
    nodeCount: Math.max(1, rootToNode.size),
    groundNode: 0,
    components: parsed,
    wireNodeMap,
    nodePinCount: remappedPinCount,
    warnings,
    hasAcSource,
    hasDcSource,
    hasFunctionGenerator,
    hasDiode,
    hasCapacitor,
    hasInductor,
    primaryFrequencyHz: primaryFreq,
  };
}

function solveLinearReal(A: number[][], b: number[]): number[] | null {
  const n = b.length;
  if (n === 0) return [];
  const M = A.map((row, i) => [...row, b[i]]);

  for (let col = 0; col < n; col++) {
    let pivotRow = col;
    let maxVal = Math.abs(M[col][col]);
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(M[r][col]) > maxVal) {
        maxVal = Math.abs(M[r][col]);
        pivotRow = r;
      }
    }
    if (maxVal < 1e-14) return null;
    if (pivotRow !== col) {
      const tmp = M[col];
      M[col] = M[pivotRow];
      M[pivotRow] = tmp;
    }
    const pivot = M[col][col];
    for (let c = col; c <= n; c++) M[col][c] /= pivot;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const factor = M[r][col];
      if (Math.abs(factor) < 1e-16) continue;
      for (let c = col; c <= n; c++) {
        M[r][c] -= factor * M[col][c];
      }
    }
  }
  return M.map((row) => row[n]);
}

interface Complex {
  re: number;
  im: number;
}

function cAdd(a: Complex, b: Complex): Complex {
  return { re: a.re + b.re, im: a.im + b.im };
}
function cSub(a: Complex, b: Complex): Complex {
  return { re: a.re - b.re, im: a.im - b.im };
}
function cMul(a: Complex, b: Complex): Complex {
  return { re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re };
}
function cDiv(a: Complex, b: Complex): Complex {
  const denom = b.re * b.re + b.im * b.im;
  if (denom < 1e-24) return { re: 0, im: 0 };
  return {
    re: (a.re * b.re + a.im * b.im) / denom,
    im: (a.im * b.re - a.re * b.im) / denom,
  };
}
function cAbs(a: Complex): number {
  return Math.hypot(a.re, a.im);
}
function cDeg(a: Complex): number {
  return (Math.atan2(a.im, a.re) * 180) / Math.PI;
}

function solveLinearComplex(A: Complex[][], b: Complex[]): Complex[] | null {
  const n = b.length;
  if (n === 0) return [];
  const M: Complex[][] = A.map((row, i) => [...row.map((z) => ({ ...z })), { ...b[i] }]);

  for (let col = 0; col < n; col++) {
    let pivotRow = col;
    let maxMag = cAbs(M[col][col]);
    for (let r = col + 1; r < n; r++) {
      const m = cAbs(M[r][col]);
      if (m > maxMag) {
        maxMag = m;
        pivotRow = r;
      }
    }
    if (maxMag < 1e-14) return null;
    if (pivotRow !== col) {
      const tmp = M[col];
      M[col] = M[pivotRow];
      M[pivotRow] = tmp;
    }
    const pivot = M[col][col];
    for (let c = col; c <= n; c++) M[col][c] = cDiv(M[col][c], pivot);
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const factor = M[r][col];
      if (cAbs(factor) < 1e-16) continue;
      for (let c = col; c <= n; c++) {
        M[r][c] = cSub(M[r][c], cMul(factor, M[col][c]));
      }
    }
  }
  return M.map((row) => row[n]);
}

function addConductance(A: number[][], nA: number, nB: number, g: number) {
  if (nA > 0) A[nA - 1][nA - 1] += g;
  if (nB > 0) A[nB - 1][nB - 1] += g;
  if (nA > 0 && nB > 0) {
    A[nA - 1][nB - 1] -= g;
    A[nB - 1][nA - 1] -= g;
  }
}

function addCurrentSource(b: number[], nFrom: number, nTo: number, current: number) {
  if (nFrom > 0) b[nFrom - 1] -= current;
  if (nTo > 0) b[nTo - 1] += current;
}

/** Computes exact Thévenin equivalent resistance seen by a reactive component */
function computeTheveninResistance(
  netlist: CircuitNetlist,
  targetComp: ParsedCircuitComponent,
  treatCapsAsShort = false
): number | null {
  const numNodes = netlist.nodeCount;
  const unknownNodes = Math.max(0, numNodes - 1);
  const sources = netlist.components.filter(
    (c) => c.kind === 'dc-source' || c.kind === 'ac-source' || c.kind === 'function-generator'
  );
  const unknownSize = unknownNodes + sources.length;
  if (unknownSize === 0) return null;

  const A = Array.from({ length: unknownSize }, () => Array(unknownSize).fill(0));
  const rhs = Array(unknownSize).fill(0);

  for (let n = 1; n < numNodes; n++) {
    A[n - 1][n - 1] += 1e-9;
  }

  for (const c of netlist.components) {
    if (c.elementId === targetComp.elementId) continue;
    if (c.kind === 'resistor') {
      addConductance(A, c.nodeA, c.nodeB, 1 / Math.max(1e-3, c.valueNum));
    } else if (c.kind === 'ammeter') {
      addConductance(A, c.nodeA, c.nodeB, 1 / 0.01);
    } else if (c.kind === 'voltmeter' || c.kind === 'oscilloscope') {
      addConductance(A, c.nodeA, c.nodeB, 1e-7);
    } else if (c.kind === 'inductor') {
      addConductance(A, c.nodeA, c.nodeB, targetComp.kind === 'capacitor' ? 1 / 0.01 : 1e-9);
    } else if (c.kind === 'capacitor') {
      addConductance(A, c.nodeA, c.nodeB, treatCapsAsShort ? 1e5 : 1e-9);
    } else if (c.kind === 'switch') {
      addConductance(A, c.nodeA, c.nodeB, c.switchClosed ? 100 : 1e-9);
    } else if (c.kind === 'diode') {
      addConductance(A, c.nodeA, c.nodeB, 0.05);
    }
  }

  sources.forEach((src, sIdx) => {
    const row = unknownNodes + sIdx;
    if (src.nodeA > 0) {
      A[src.nodeA - 1][row] += 1;
      A[row][src.nodeA - 1] += 1;
    }
    if (src.nodeB > 0) {
      A[src.nodeB - 1][row] -= 1;
      A[row][src.nodeB - 1] -= 1;
    }
    rhs[row] = 0;
  });

  addCurrentSource(rhs, targetComp.nodeB, targetComp.nodeA, 1);

  const sol = solveLinearReal(A, rhs);
  if (!sol) return null;
  const vA = targetComp.nodeA > 0 ? sol[targetComp.nodeA - 1] : 0;
  const vB = targetComp.nodeB > 0 ? sol[targetComp.nodeB - 1] : 0;
  const rTh = Math.abs(vA - vB);
  if (!Number.isFinite(rTh) || rTh > 1e7) return null;
  return rTh;
}

export function estimateDominantTimeConstant(netlist: CircuitNetlist): number | null {
  let maxTau = 0;
  let found = false;

  for (const c of netlist.components) {
    if (c.kind === 'capacitor') {
      found = true;
      const rTh = computeTheveninResistance(netlist, c, false) ?? 1000;
      maxTau = Math.max(maxTau, Math.max(0.05, rTh) * Math.max(1e-12, c.valueNum));
    } else if (c.kind === 'inductor') {
      found = true;
      const rTh = computeTheveninResistance(netlist, c, false) ?? 1000;
      maxTau = Math.max(maxTau, Math.max(1e-9, c.valueNum) / Math.max(0.05, rTh));
    }
  }

  if (!found) return null;
  return Math.max(1e-5, Math.min(20, maxTau));
}

/**
 * Classifies 0th/1st/2nd-order differential equation dynamics (natural frequency ω₀,
 * damping factor α, damping ratio ζ, and time constant τ) and determines an accurate
 * numerical integration step Δt for real-time visualization.
 */
export function analyzeOdeDynamics(
  netlist: CircuitNetlist,
  integrationMethod: TransientIntegrationMethod = 'trapezoidal'
): { odeInfo: OdeAnalysisInfo; recommendedDtSec: number } {
  const caps = netlist.components.filter((c) => c.kind === 'capacitor');
  const inds = netlist.components.filter((c) => c.kind === 'inductor');

  if (caps.length === 0 && inds.length === 0) {
    return {
      odeInfo: {
        order: 0,
        regime: 'dc-resistive',
        tauSec: null,
        naturalFreqRad: null,
        naturalFreqHz: null,
        dampingAlpha: null,
        dampingRatioZeta: null,
        integrationMethod,
      },
      recommendedDtSec: 0.0005,
    };
  }

  if (caps.length > 0 && inds.length > 0) {
    const L = Math.max(1e-9, inds[0].valueNum);
    const C = Math.max(1e-12, caps[0].valueNum);
    const omega0 = 1 / Math.sqrt(L * C);
    const f0 = omega0 / (2 * Math.PI);
    const T0 = 1 / f0;

    // Probe series loop resistance (with C shorted) vs parallel damping resistance (with C open)
    const rSeries = computeTheveninResistance(netlist, inds[0], true);
    const rParallel = computeTheveninResistance(netlist, caps[0], false);

    let alpha = 0;
    if (rSeries !== null && rSeries >= 0.25) {
      // Series RLC: α = R / (2L)
      alpha = rSeries / (2 * L);
    } else if (rParallel !== null && rParallel >= 0.05) {
      // Parallel RLC: α = 1 / (2RC)
      alpha = 1 / (2 * rParallel * C);
    } else {
      alpha = 0.02 * omega0;
    }

    const zeta = alpha / omega0;
    let regime: OdeRegime = 'underdamped';
    let tauEnvelope = 1 / Math.max(1e-3, alpha);

    if (zeta > 1.03) {
      regime = 'overdamped';
      const sSlow = alpha - Math.sqrt(Math.max(0, alpha * alpha - omega0 * omega0));
      tauEnvelope = 1 / Math.max(1e-4, sSlow);
    } else if (zeta >= 0.97) {
      regime = 'critically-damped';
      tauEnvelope = 1 / Math.max(1e-3, alpha);
    } else {
      regime = 'underdamped';
      tauEnvelope = 1 / Math.max(1e-3, alpha);
    }

    const clampedTau = Math.max(1e-5, Math.min(20, tauEnvelope));
    // Resolve at least 48 samples per natural period T0 when underdamped, covering ~4.5*tau
    const dtFromPeriod = T0 / 48;
    const dtFromEnvelope = (4.5 * clampedTau) / 180;
    const recommendedDtSec =
      regime === 'underdamped'
        ? Math.max(1e-7, Math.min(dtFromPeriod, dtFromEnvelope * 1.5))
        : Math.max(1e-7, dtFromEnvelope);

    return {
      odeInfo: {
        order: 2,
        regime,
        tauSec: clampedTau,
        naturalFreqRad: omega0,
        naturalFreqHz: f0,
        dampingAlpha: alpha,
        dampingRatioZeta: zeta,
        integrationMethod,
      },
      recommendedDtSec,
    };
  }

  // First-order RC or RL differential equation
  const tau = estimateDominantTimeConstant(netlist) ?? 0.01;
  const regime: OdeRegime = caps.length > 0 ? 'first-order-rc' : 'first-order-rl';
  return {
    odeInfo: {
      order: 1,
      regime,
      tauSec: tau,
      naturalFreqRad: null,
      naturalFreqHz: null,
      dampingAlpha: 1 / tau,
      dampingRatioZeta: null,
      integrationMethod,
    },
    recommendedDtSec: (5.5 * tau) / 180,
  };
}

function solveComplexAcPhasors(
  netlist: CircuitNetlist,
  freqHz: number
): {
  acComplexPhasors: Map<string, { vPhasor: Complex; iPhasor: Complex; zVal: Complex }>;
  impedanceSummary?: SimulationReport['impedanceSummary'];
} {
  const omega = 2 * Math.PI * freqHz;
  const acComplexPhasors = new Map<
    string,
    { vPhasor: Complex; iPhasor: Complex; zVal: Complex }
  >();
  let impedanceSummary: SimulationReport['impedanceSummary'] = undefined;

  if (!netlist.hasAcSource) {
    return { acComplexPhasors, impedanceSummary };
  }

  const numNodes = netlist.nodeCount;
  const unknownNodes = Math.max(0, numNodes - 1);
  const sources = netlist.components.filter(
    (c) => c.kind === 'dc-source' || c.kind === 'ac-source' || c.kind === 'function-generator'
  );
  const unknownSize = unknownNodes + sources.length;

  const AcA: Complex[][] = Array.from({ length: unknownSize }, () =>
    Array.from({ length: unknownSize }, () => ({ re: 0, im: 0 }))
  );
  const AcRhs: Complex[] = Array.from({ length: unknownSize }, () => ({ re: 0, im: 0 }));

  const addComplexAdmittance = (nA: number, nB: number, Y: Complex) => {
    if (nA > 0) AcA[nA - 1][nA - 1] = cAdd(AcA[nA - 1][nA - 1], Y);
    if (nB > 0) AcA[nB - 1][nB - 1] = cAdd(AcA[nB - 1][nB - 1], Y);
    if (nA > 0 && nB > 0) {
      AcA[nA - 1][nB - 1] = cSub(AcA[nA - 1][nB - 1], Y);
      AcA[nB - 1][nA - 1] = cSub(AcA[nB - 1][nA - 1], Y);
    }
  };

  for (let n = 1; n < numNodes; n++) {
    AcA[n - 1][n - 1] = cAdd(AcA[n - 1][n - 1], { re: 1e-9, im: 0 });
  }

  for (const c of netlist.components) {
    if (c.kind === 'resistor') {
      addComplexAdmittance(c.nodeA, c.nodeB, { re: 1 / Math.max(1e-3, c.valueNum), im: 0 });
    } else if (c.kind === 'ammeter') {
      addComplexAdmittance(c.nodeA, c.nodeB, { re: 100, im: 0 });
    } else if (c.kind === 'voltmeter' || c.kind === 'oscilloscope') {
      addComplexAdmittance(c.nodeA, c.nodeB, { re: 1e-7, im: 0 });
    } else if (c.kind === 'capacitor') {
      const bSus = omega * Math.max(1e-12, c.valueNum);
      addComplexAdmittance(c.nodeA, c.nodeB, { re: 0, im: bSus });
    } else if (c.kind === 'inductor') {
      const xl = Math.max(1e-4, omega * Math.max(1e-9, c.valueNum));
      addComplexAdmittance(c.nodeA, c.nodeB, { re: 0, im: -1 / xl });
    } else if (c.kind === 'switch') {
      addComplexAdmittance(c.nodeA, c.nodeB, { re: c.switchClosed ? 100 : 1e-9, im: 0 });
    } else if (c.kind === 'diode') {
      addComplexAdmittance(c.nodeA, c.nodeB, { re: 0.05, im: 0 });
    }
  }

  sources.forEach((src, sIdx) => {
    const row = unknownNodes + sIdx;
    if (src.nodeA > 0) {
      AcA[src.nodeA - 1][row] = { re: 1, im: 0 };
      AcA[row][src.nodeA - 1] = { re: 1, im: 0 };
    }
    if (src.nodeB > 0) {
      AcA[src.nodeB - 1][row] = { re: -1, im: 0 };
      AcA[row][src.nodeB - 1] = { re: -1, im: 0 };
    }
    const rmsMag =
      src.kind === 'ac-source'
        ? src.valueNum / Math.SQRT2
        : src.kind === 'function-generator'
        ? src.waveformType === 'square'
          ? src.valueNum
          : src.waveformType === 'triangle'
          ? src.valueNum / Math.sqrt(3)
          : src.valueNum / Math.SQRT2
        : 0;
    AcRhs[row] = { re: rmsMag, im: 0 };
  });

  const acSol = solveLinearComplex(AcA, AcRhs);
  if (acSol) {
    const acNodeV: Complex[] = [{ re: 0, im: 0 }, ...acSol.slice(0, unknownNodes)];
    const acSrcI: Complex[] = acSol.slice(unknownNodes);
    let sCount = 0;

    for (const c of netlist.components) {
      const vPhasor = cSub(
        acNodeV[c.nodeA] || { re: 0, im: 0 },
        acNodeV[c.nodeB] || { re: 0, im: 0 }
      );
      let iPhasor: Complex = { re: 0, im: 0 };
      let zVal: Complex = { re: 0, im: 0 };

      if (c.kind === 'resistor') {
        const r = Math.max(1e-3, c.valueNum);
        zVal = { re: r, im: 0 };
        iPhasor = cDiv(vPhasor, zVal);
      } else if (c.kind === 'capacitor') {
        const xc = 1 / Math.max(1e-12, omega * Math.max(1e-12, c.valueNum));
        zVal = { re: 0, im: -xc };
        iPhasor = cDiv(vPhasor, zVal);
      } else if (c.kind === 'inductor') {
        const xl = omega * Math.max(1e-9, c.valueNum);
        zVal = { re: 0, im: xl };
        iPhasor = cDiv(vPhasor, zVal);
      } else if (c.kind === 'ammeter') {
        zVal = { re: 0.01, im: 0 };
        iPhasor = cDiv(vPhasor, zVal);
      } else if (c.kind === 'switch') {
        const g = c.switchClosed ? 100 : 1e-9;
        zVal = { re: 1 / g, im: 0 };
        iPhasor = { re: vPhasor.re * g, im: vPhasor.im * g };
      } else if (
        c.kind === 'ac-source' ||
        c.kind === 'dc-source' ||
        c.kind === 'function-generator'
      ) {
        const rawI = acSrcI[sCount++] || { re: 0, im: 0 };
        iPhasor = { re: -rawI.re, im: -rawI.im };
        zVal = cAbs(iPhasor) > 1e-9 ? cDiv(vPhasor, iPhasor) : { re: 0, im: 0 };
      }
      acComplexPhasors.set(c.elementId, { vPhasor, iPhasor, zVal });
    }

    const mainAc = sources.find((s) => s.kind === 'ac-source' || s.kind === 'function-generator');
    if (mainAc) {
      const acData = acComplexPhasors.get(mainAc.elementId);
      if (acData && cAbs(acData.iPhasor) > 1e-9) {
        const zEq = cDiv(acData.vPhasor, acData.iPhasor);
        const zMag = cAbs(zEq);
        const zAng = cDeg(zEq);
        const sComplex = cMul(acData.vPhasor, {
          re: acData.iPhasor.re,
          im: -acData.iPhasor.im,
        });
        impedanceSummary = {
          rOhms: zEq.re,
          xOhms: zEq.im,
          zMagOhms: zMag,
          zAngleDeg: zAng,
          powerFactor: Math.cos((zAng * Math.PI) / 180),
          realPowerW: sComplex.re,
          reactivePowerVar: sComplex.im,
          apparentPowerVa: cAbs(sComplex),
        };
      }
    }
  }

  return { acComplexPhasors, impedanceSummary };
}

const PHASOR_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4'];

/**
 * Stateful Real-Time Modified Nodal Analysis (MNA) & Differential-Equation (ODE) Simulator.
 * Solves 1st- and 2nd-order R, L, C differential equations using hybrid Backward-Euler +
 * Trapezoidal (bilinear) companion models, Newton-Raphson nonlinear Diode modeling,
 * complex AC phasors, energized wire potentials, and dual-scale oscilloscope waveforms.
 */
export class Simulator {
  private elements: WhiteboardElement[] = [];
  private overrideFreqHz?: number;
  private integrationMethod: TransientIntegrationMethod = 'trapezoidal';
  private netlist!: CircuitNetlist;
  private freqHz = 60;
  private tauSec: number | null = null;
  private odeInfo!: OdeAnalysisInfo;
  private dtSec = 0.00025;
  private timeSec = 0;
  private stepCount = 0;
  private status: SimulatorStatus = 'idle';
  private timeScale = 1;

  private capPrevV = new Map<string, number>();
  private capPrevI = new Map<string, number>();
  private indPrevI = new Map<string, number>();
  private indPrevV = new Map<string, number>();
  private diodePrevVd = new Map<string, number>();

  private dcSteadyNodeV: number[] = [];
  private dcSteadySrcI: number[] = [];
  private acComplexPhasors = new Map<
    string,
    { vPhasor: Complex; iPhasor: Complex; zVal: Complex }
  >();
  private impedanceSummary?: SimulationReport['impedanceSummary'];

  private timeHistoryMs: number[] = [];
  private vHistory = new Map<string, number[]>();
  private iHistory = new Map<string, number[]>();
  private maxHistoryPoints = 240;
  private latestState!: SimulatorState;

  constructor(
    elements: WhiteboardElement[],
    overrideFrequencyHz?: number,
    integrationMethod: TransientIntegrationMethod = 'trapezoidal'
  ) {
    this.integrationMethod = integrationMethod;
    this.reset(elements, overrideFrequencyHz);
  }

  public setIntegrationMethod(method: TransientIntegrationMethod): SimulatorState {
    if (this.integrationMethod === method) return this.latestState;
    this.integrationMethod = method;
    return this.reset(this.elements, this.overrideFreqHz);
  }

  public getIntegrationMethod(): TransientIntegrationMethod {
    return this.integrationMethod;
  }

  public setTimeScale(scale: number) {
    this.timeScale = Math.max(0.1, Math.min(10, scale));
    this.latestState = { ...this.latestState, timeScale: this.timeScale };
  }

  public setStatus(status: SimulatorStatus) {
    this.status = status;
    this.latestState = { ...this.latestState, status: this.status };
  }

  public getState(): SimulatorState {
    return this.latestState;
  }

  private createErrorState(error: string): SimulatorState {
    return {
      ok: false,
      error,
      warnings: this.netlist?.warnings || [],
      mode: 'dc',
      status: this.status,
      timeSec: 0,
      dtSec: 0,
      stepCount: 0,
      tauSec: null,
      odeInfo: {
        order: 0,
        regime: 'dc-resistive',
        tauSec: null,
        naturalFreqRad: null,
        naturalFreqHz: null,
        dampingAlpha: null,
        dampingRatioZeta: null,
        integrationMethod: this.integrationMethod,
      },
      totalStoredEnergyJ: 0,
      frequencyHz: this.freqHz,
      timeScale: this.timeScale,
      nodeVoltages: [],
      wireVoltages: {},
      liveReadouts: {},
      components: [],
      timePointsMs: [],
      channels: [],
      phasors: [],
    };
  }

  private solveAtTime(
    t: number,
    mode: 'dc-steady' | 'initial-zero' | 'backward-euler' | 'trapezoidal'
  ): { nodeV: number[]; srcI: number[] } | null {
    const numNodes = this.netlist.nodeCount;
    const unknownNodes = Math.max(0, numNodes - 1);
    const sources = this.netlist.components.filter(
      (c) => c.kind === 'dc-source' || c.kind === 'ac-source' || c.kind === 'function-generator'
    );
    const unknownSize = unknownNodes + sources.length;
    const maxNrIters = this.netlist.hasDiode ? 28 : 1;
    let sol: number[] | null = null;

    for (let iter = 0; iter < maxNrIters; iter++) {
      const A = Array.from({ length: unknownSize }, () => Array(unknownSize).fill(0));
      const rhs = Array(unknownSize).fill(0);

      for (let n = 1; n < numNodes; n++) {
        A[n - 1][n - 1] += 1e-9;
      }

      for (const c of this.netlist.components) {
        if (c.kind === 'resistor') {
          addConductance(A, c.nodeA, c.nodeB, 1 / Math.max(1e-3, c.valueNum));
        } else if (c.kind === 'ammeter') {
          addConductance(A, c.nodeA, c.nodeB, 1 / 0.01);
        } else if (c.kind === 'voltmeter' || c.kind === 'oscilloscope') {
          addConductance(A, c.nodeA, c.nodeB, 1e-7);
        } else if (c.kind === 'switch') {
          addConductance(A, c.nodeA, c.nodeB, c.switchClosed ? 100 : 1e-9);
        } else if (c.kind === 'capacitor') {
          const cap = Math.max(1e-12, c.valueNum);
          if (mode === 'dc-steady') {
            addConductance(A, c.nodeA, c.nodeB, 1e-9);
          } else if (mode === 'initial-zero') {
            addConductance(A, c.nodeA, c.nodeB, 1e6);
          } else if (mode === 'trapezoidal') {
            const geq = (2 * cap) / this.dtSec;
            const vPrev = this.capPrevV.get(c.elementId) || 0;
            const iPrev = this.capPrevI.get(c.elementId) || 0;
            addConductance(A, c.nodeA, c.nodeB, geq);
            addCurrentSource(rhs, c.nodeB, c.nodeA, geq * vPrev + iPrev);
          } else {
            const geq = cap / this.dtSec;
            const vPrev = this.capPrevV.get(c.elementId) || 0;
            addConductance(A, c.nodeA, c.nodeB, geq);
            addCurrentSource(rhs, c.nodeB, c.nodeA, geq * vPrev);
          }
        } else if (c.kind === 'inductor') {
          const ind = Math.max(1e-9, c.valueNum);
          if (mode === 'dc-steady') {
            addConductance(A, c.nodeA, c.nodeB, 1 / 0.01);
          } else if (mode === 'initial-zero') {
            addConductance(A, c.nodeA, c.nodeB, 1e-9);
          } else if (mode === 'trapezoidal') {
            const geq = this.dtSec / (2 * ind);
            const iPrev = this.indPrevI.get(c.elementId) || 0;
            const vPrev = this.indPrevV.get(c.elementId) || 0;
            addConductance(A, c.nodeA, c.nodeB, geq);
            addCurrentSource(rhs, c.nodeA, c.nodeB, iPrev + geq * vPrev);
          } else {
            const geq = this.dtSec / ind;
            const iPrev = this.indPrevI.get(c.elementId) || 0;
            addConductance(A, c.nodeA, c.nodeB, geq);
            addCurrentSource(rhs, c.nodeA, c.nodeB, iPrev);
          }
        } else if (c.kind === 'diode') {
          const Is = 1e-11;
          const nVt = 0.038;
          const vdPrev = this.diodePrevVd.get(c.elementId) ?? 0.6;
          const vdClamped = Math.min(0.85, Math.max(-50, vdPrev));
          const expTerm = Math.exp(vdClamped / nVt);
          const id = Is * (expTerm - 1);
          const gd = (Is / nVt) * expTerm + 1e-9;
          const ieq = id - gd * vdClamped;
          addConductance(A, c.nodeA, c.nodeB, gd);
          addCurrentSource(rhs, c.nodeA, c.nodeB, ieq);
        }
      }

      sources.forEach((src, sIdx) => {
        const row = unknownNodes + sIdx;
        if (src.nodeA > 0) {
          A[src.nodeA - 1][row] += 1;
          A[row][src.nodeA - 1] += 1;
        }
        if (src.nodeB > 0) {
          A[src.nodeB - 1][row] -= 1;
          A[row][src.nodeB - 1] -= 1;
        }
        const freq = this.overrideFreqHz || src.frequencyHz;
        const vInst =
          src.kind === 'dc-source'
            ? src.valueNum
            : src.kind === 'function-generator'
            ? evaluateWaveformSample(src.waveformType || 'sine', src.valueNum, freq, t)
            : src.valueNum * Math.sin(2 * Math.PI * freq * t);
        rhs[row] = vInst;
      });

      sol = solveLinearReal(A, rhs);
      if (!sol) break;

      if (this.netlist.hasDiode) {
        let maxDiff = 0;
        for (const c of this.netlist.components) {
          if (c.kind !== 'diode') continue;
          const va = c.nodeA > 0 ? sol[c.nodeA - 1] : 0;
          const vb = c.nodeB > 0 ? sol[c.nodeB - 1] : 0;
          const vdNew = va - vb;
          const vdOld = this.diodePrevVd.get(c.elementId) ?? 0.6;
          const delta = vdNew - vdOld;
          const limited = vdOld + Math.sign(delta) * Math.min(Math.abs(delta), 0.14);
          this.diodePrevVd.set(c.elementId, limited);
          maxDiff = Math.max(maxDiff, Math.abs(vdNew - vdOld));
        }
        if (maxDiff < 1e-4) break;
      }
    }

    if (!sol) return null;
    return {
      nodeV: [0, ...sol.slice(0, unknownNodes)],
      srcI: sol.slice(unknownNodes),
    };
  }

  public reset(elements?: WhiteboardElement[], overrideFrequencyHz?: number): SimulatorState {
    if (elements) this.elements = elements;
    if (overrideFrequencyHz !== undefined) this.overrideFreqHz = overrideFrequencyHz;

    this.netlist = extractNetlistFromCanvas(this.elements, this.overrideFreqHz);
    this.freqHz = this.overrideFreqHz || this.netlist.primaryFrequencyHz || 60;
    this.timeSec = 0;
    this.stepCount = 0;
    this.timeHistoryMs = [];
    this.vHistory.clear();
    this.iHistory.clear();
    this.capPrevV.clear();
    this.capPrevI.clear();
    this.indPrevI.clear();
    this.indPrevV.clear();
    this.diodePrevVd.clear();

    for (const c of this.netlist.components) {
      this.capPrevV.set(c.elementId, 0);
      this.capPrevI.set(c.elementId, 0);
      this.indPrevI.set(c.elementId, 0);
      this.indPrevV.set(c.elementId, 0);
      this.diodePrevVd.set(c.elementId, 0.6);
      this.vHistory.set(c.elementId, []);
      this.iHistory.set(c.elementId, []);
    }

    if (this.netlist.components.length === 0) {
      this.latestState = this.createErrorState(
        'Place and wire circuit components (Source, R/L/C, Diode, or Meters) to simulate.'
      );
      return this.latestState;
    }

    const sources = this.netlist.components.filter(
      (c) => c.kind === 'dc-source' || c.kind === 'ac-source' || c.kind === 'function-generator'
    );
    if (sources.length === 0) {
      this.latestState = this.createErrorState(
        'Add a DC, AC, or Function Generator source to energize the circuit.'
      );
      return this.latestState;
    }

    const { odeInfo, recommendedDtSec } = analyzeOdeDynamics(this.netlist, this.integrationMethod);
    this.odeInfo = odeInfo;
    this.tauSec = odeInfo.tauSec;

    if (this.netlist.hasAcSource) {
      this.dtSec = 1 / (Math.max(1, this.freqHz) * 64);
    } else {
      this.dtSec = recommendedDtSec;
    }

    const dcState = this.solveAtTime(0, 'dc-steady');
    if (!dcState) {
      this.latestState = this.createErrorState(
        'Circuit topology is open or has conflicting parallel voltage sources.'
      );
      return this.latestState;
    }
    this.dcSteadyNodeV = dcState.nodeV;
    this.dcSteadySrcI = dcState.srcI;

    const acRes = solveComplexAcPhasors(this.netlist, this.freqHz);
    this.acComplexPhasors = acRes.acComplexPhasors;
    this.impedanceSummary = acRes.impedanceSummary;

    const initSol = this.solveAtTime(0, 'initial-zero') || dcState;
    this.recordAndBuildState(initSol, 'initial-zero');
    return this.latestState;
  }

  public step(stepsCount = 1): SimulatorState {
    if (!this.latestState?.ok) return this.latestState;
    for (let s = 0; s < stepsCount; s++) {
      this.timeSec += this.dtSec;
      this.stepCount += 1;
      // Step 1 always uses Backward Euler to damp t=0 step discontinuity;
      // subsequent steps use Trapezoidal (or Backward Euler if selected) for O(dt^2) accuracy.
      const stepMode =
        this.integrationMethod === 'trapezoidal' && this.stepCount >= 2
          ? 'trapezoidal'
          : 'backward-euler';
      const sol = this.solveAtTime(this.timeSec, stepMode);
      if (!sol) break;
      this.recordAndBuildState(sol, stepMode);
    }
    return this.latestState;
  }

  private recordAndBuildState(
    stepSol: { nodeV: number[]; srcI: number[] },
    stepMode: 'initial-zero' | 'backward-euler' | 'trapezoidal'
  ) {
    this.timeHistoryMs.push(this.timeSec * 1000);
    if (this.timeHistoryMs.length > this.maxHistoryPoints) {
      this.timeHistoryMs.shift();
    }

    let srcCounter = 0;
    const compResults: ComponentSimResult[] = [];
    const liveReadouts: Record<string, string> = {};
    const channels: WaveformChannel[] = [];
    const phasors: PhasorVector[] = [];
    let totalStoredEnergyJ = 0;

    for (const c of this.netlist.components) {
      const va = stepSol.nodeV[c.nodeA] || 0;
      const vb = stepSol.nodeV[c.nodeB] || 0;
      const vDrop = stepMode === 'initial-zero' && c.kind === 'capacitor' ? 0 : va - vb;
      let iBranch = 0;

      if (c.kind === 'resistor') {
        iBranch = vDrop / Math.max(1e-3, c.valueNum);
      } else if (c.kind === 'ammeter') {
        iBranch = vDrop / 0.01;
      } else if (c.kind === 'voltmeter' || c.kind === 'oscilloscope') {
        iBranch = vDrop * 1e-7;
      } else if (c.kind === 'switch') {
        iBranch = vDrop * (c.switchClosed ? 100 : 1e-9);
      } else if (c.kind === 'capacitor') {
        const cap = Math.max(1e-12, c.valueNum);
        if (stepMode === 'initial-zero') {
          iBranch = (va - vb) * 1e6;
          this.capPrevV.set(c.elementId, 0);
          this.capPrevI.set(c.elementId, iBranch);
        } else if (stepMode === 'trapezoidal') {
          const geq = (2 * cap) / this.dtSec;
          const vPrev = this.capPrevV.get(c.elementId) || 0;
          const iPrev = this.capPrevI.get(c.elementId) || 0;
          iBranch = geq * (vDrop - vPrev) - iPrev;
          this.capPrevV.set(c.elementId, vDrop);
          this.capPrevI.set(c.elementId, iBranch);
        } else {
          const geq = cap / this.dtSec;
          const vPrev = this.capPrevV.get(c.elementId) || 0;
          iBranch = geq * (vDrop - vPrev);
          this.capPrevV.set(c.elementId, vDrop);
          this.capPrevI.set(c.elementId, iBranch);
        }
      } else if (c.kind === 'inductor') {
        const ind = Math.max(1e-9, c.valueNum);
        if (stepMode === 'initial-zero') {
          iBranch = 0;
          this.indPrevI.set(c.elementId, 0);
          this.indPrevV.set(c.elementId, vDrop);
        } else if (stepMode === 'trapezoidal') {
          const geq = this.dtSec / (2 * ind);
          const iPrev = this.indPrevI.get(c.elementId) || 0;
          const vPrev = this.indPrevV.get(c.elementId) || 0;
          iBranch = iPrev + geq * (vDrop + vPrev);
          this.indPrevI.set(c.elementId, iBranch);
          this.indPrevV.set(c.elementId, vDrop);
        } else {
          const geq = this.dtSec / ind;
          const iPrev = this.indPrevI.get(c.elementId) || 0;
          iBranch = iPrev + geq * vDrop;
          this.indPrevI.set(c.elementId, iBranch);
          this.indPrevV.set(c.elementId, vDrop);
        }
      } else if (c.kind === 'diode') {
        const Is = 1e-11;
        const nVt = 0.038;
        const vdClamped = Math.min(0.85, Math.max(-50, vDrop));
        iBranch = Is * (Math.exp(vdClamped / nVt) - 1);
      } else if (
        c.kind === 'dc-source' ||
        c.kind === 'ac-source' ||
        c.kind === 'function-generator'
      ) {
        iBranch = -(stepSol.srcI[srcCounter++] || 0);
      }

      const vHist = this.vHistory.get(c.elementId)!;
      const iHist = this.iHistory.get(c.elementId)!;
      vHist.push(vDrop);
      iHist.push(iBranch);
      if (vHist.length > this.maxHistoryPoints) vHist.shift();
      if (iHist.length > this.maxHistoryPoints) iHist.shift();
    }

    let dcSrcCounter = 0;
    let colorIdx = 0;
    const seenChannelIds = new Set<string>();
    const pushChannel = (ch: WaveformChannel) => {
      if (seenChannelIds.has(ch.id)) return;
      seenChannelIds.add(ch.id);
      channels.push(ch);
    };

    for (const c of this.netlist.components) {
      const vSamples = this.vHistory.get(c.elementId) || [0];
      const iSamples = this.iHistory.get(c.elementId) || [0];
      const vInst = vSamples[vSamples.length - 1] ?? 0;
      const iInst = iSamples[iSamples.length - 1] ?? 0;

      const dvDt =
        c.kind === 'capacitor'
          ? iInst / Math.max(1e-12, c.valueNum)
          : vSamples.length >= 2
          ? (vInst - vSamples[vSamples.length - 2]) / this.dtSec
          : 0;
      const diDt =
        c.kind === 'inductor'
          ? vInst / Math.max(1e-9, c.valueNum)
          : iSamples.length >= 2
          ? (iInst - iSamples[iSamples.length - 2]) / this.dtSec
          : 0;

      const vRmsTime = Math.sqrt(
        vSamples.reduce((s, v) => s + v * v, 0) / Math.max(1, vSamples.length)
      );
      const iRmsTime = Math.sqrt(
        iSamples.reduce((s, i) => s + i * i, 0) / Math.max(1, iSamples.length)
      );
      const vPeak = Math.max(...vSamples.map((v) => Math.abs(v)));
      const iPeak = Math.max(...iSamples.map((i) => Math.abs(i)));

      const dcVa = this.dcSteadyNodeV[c.nodeA] || 0;
      const dcVb = this.dcSteadyNodeV[c.nodeB] || 0;
      const dcV = dcVa - dcVb;
      let dcI = 0;
      if (c.kind === 'resistor') dcI = dcV / Math.max(1e-3, c.valueNum);
      else if (c.kind === 'ammeter') dcI = dcV / 0.01;
      else if (c.kind === 'switch') dcI = dcV * (c.switchClosed ? 100 : 1e-9);
      else if (c.kind === 'inductor') dcI = dcV / 0.01;
      else if (c.kind === 'diode') {
        const vd = Math.min(0.85, Math.max(-50, dcV));
        dcI = 1e-11 * (Math.exp(vd / 0.038) - 1);
      } else if (
        c.kind === 'dc-source' ||
        c.kind === 'ac-source' ||
        c.kind === 'function-generator'
      ) {
        dcI = -(this.dcSteadySrcI[dcSrcCounter++] || 0);
      }

      const acPh = this.acComplexPhasors.get(c.elementId);
      const useTimeRms =
        this.netlist.hasDiode ||
        (this.netlist.hasFunctionGenerator && c.waveformType !== 'sine');
      const vRms =
        this.netlist.hasAcSource && !useTimeRms && acPh ? cAbs(acPh.vPhasor) : vRmsTime;
      const iRms =
        this.netlist.hasAcSource && !useTimeRms && acPh ? cAbs(acPh.iPhasor) : iRmsTime;
      const vPhaseDeg = acPh ? cDeg(acPh.vPhasor) : 0;
      const iPhaseDeg = acPh ? cDeg(acPh.iPhasor) : 0;

      const pWatts = this.netlist.hasAcSource
        ? vRms * iRms * Math.cos(((vPhaseDeg - iPhaseDeg) * Math.PI) / 180)
        : vInst * iInst;
      const qVar = this.netlist.hasAcSource
        ? vRms * iRms * Math.sin(((vPhaseDeg - iPhaseDeg) * Math.PI) / 180)
        : 0;
      const energyJ =
        c.kind === 'capacitor'
          ? 0.5 * Math.max(1e-12, c.valueNum) * vInst * vInst
          : c.kind === 'inductor'
          ? 0.5 * Math.max(1e-9, c.valueNum) * iInst * iInst
          : 0;
      totalStoredEnergyJ += energyJ;

      const pinCountA = this.netlist.nodePinCount[c.nodeA] || 0;
      const pinCountB = this.netlist.nodePinCount[c.nodeB] || 0;
      const probesConnected =
        c.nodeA !== c.nodeB && pinCountA >= 2 && pinCountB >= 2;

      compResults.push({
        elementId: c.elementId,
        kind: c.kind,
        label: c.label,
        dcVoltage: dcV,
        dcCurrent: dcI,
        vInst,
        iInst,
        dvDt,
        diDt,
        nodeAVoltage: stepSol.nodeV[c.nodeA] || 0,
        nodeBVoltage: stepSol.nodeV[c.nodeB] || 0,
        probesConnected,
        powerInst: vInst * iInst,
        energyJ,
        vRms,
        vPeak,
        vPhaseDeg,
        iRms,
        iPeak,
        iPhaseDeg,
        powerWatts: pWatts,
        reactiveVar: qVar,
      });

      if (c.kind === 'voltmeter') {
        liveReadouts[c.elementId] = this.netlist.hasAcSource
          ? `${vRms.toFixed(2)} Vrms`
          : `${vInst.toFixed(2)} V`;
      } else if (c.kind === 'ammeter') {
        liveReadouts[c.elementId] = formatEngineering(
          this.netlist.hasAcSource ? iRms : iInst,
          'A'
        );
      } else if (c.kind === 'oscilloscope') {
        liveReadouts[c.elementId] = probesConnected ? `${vInst.toFixed(2)} V` : 'No Probe';
      }

      // Voltage channels for connected probes, sources, and reactive elements
      if (
        (c.kind === 'oscilloscope' && probesConnected) ||
        c.kind === 'ac-source' ||
        c.kind === 'function-generator' ||
        (c.kind === 'voltmeter' && probesConnected) ||
        c.kind === 'capacitor' ||
        c.kind === 'inductor'
      ) {
        const col = PHASOR_COLORS[channels.length % PHASOR_COLORS.length];
        pushChannel({
          id: c.elementId,
          label:
            c.kind === 'ac-source' || c.kind === 'function-generator'
              ? 'Source V(t)'
              : `${c.label.split(' ')[0]} V(t)`,
          color: col,
          unit: 'V',
          samples: [...vSamples],
          peak: vPeak,
          rms: vRms,
        });
      }

      if (
        this.netlist.hasAcSource &&
        acPh &&
        (c.kind === 'ac-source' ||
          c.kind === 'function-generator' ||
          c.kind === 'resistor' ||
          c.kind === 'capacitor' ||
          c.kind === 'inductor')
      ) {
        const col = PHASOR_COLORS[colorIdx++ % PHASOR_COLORS.length];
        if (cAbs(acPh.vPhasor) > 1e-4) {
          phasors.push({
            id: `${c.elementId}_v`,
            label:
              c.kind === 'ac-source' || c.kind === 'function-generator'
                ? 'Vs'
                : c.label.split(' ')[0],
            kind: 'voltage',
            magnitude: cAbs(acPh.vPhasor),
            angleDeg: cDeg(acPh.vPhasor),
            color: col,
          });
        }
        if (
          (c.kind === 'ac-source' || c.kind === 'function-generator') &&
          cAbs(acPh.iPhasor) > 1e-6
        ) {
          phasors.push({
            id: `${c.elementId}_i`,
            label: 'I_total',
            kind: 'current',
            magnitude: cAbs(acPh.iPhasor),
            angleDeg: cDeg(acPh.iPhasor),
            color: '#f43f5e',
          });
        }
      }
    }

    // Include current waveforms (mA) for reactive elements and primary load
    const currentTargets = this.netlist.components.filter(
      (c) => c.kind === 'capacitor' || c.kind === 'inductor'
    );
    const loadFallback = this.netlist.components.find(
      (c) => c.kind === 'resistor' || c.kind === 'ammeter' || c.kind === 'diode'
    );
    const chosenCurrentComps =
      currentTargets.length > 0 ? currentTargets : loadFallback ? [loadFallback] : [];

    const currentColorChoices = ['#ec4899', '#06b6d4', '#f59e0b', '#a855f7', '#34d399', '#60a5fa'];
    for (const c of chosenCurrentComps) {
      const iSamplesMa = (this.iHistory.get(c.elementId) || [0]).map((i) => i * 1000);
      const iPeakMa = Math.max(...iSamplesMa.map((v) => Math.abs(v)));
      const iRmsMa = Math.sqrt(
        iSamplesMa.reduce((s, v) => s + v * v, 0) / Math.max(1, iSamplesMa.length)
      );
      const col =
        currentColorChoices.find((candidate) => !channels.some((ch) => ch.color === candidate)) ||
        currentColorChoices[channels.length % currentColorChoices.length];
      pushChannel({
        id: `${c.elementId}_i`,
        label: `I(${c.label.split(' ')[0]})`,
        color: col,
        unit: 'mA',
        samples: iSamplesMa,
        peak: iPeakMa,
        rms: iRmsMa,
      });
    }

    const wireVoltages: Record<string, number> = {};
    for (const [wireId, nodeIdx] of Object.entries(this.netlist.wireNodeMap)) {
      wireVoltages[wireId] = stepSol.nodeV[nodeIdx] || 0;
    }

    const isTransient =
      this.netlist.hasDiode || this.netlist.hasCapacitor || this.netlist.hasInductor;

    this.latestState = {
      ok: true,
      warnings: this.netlist.warnings,
      mode: this.netlist.hasDiode
        ? 'transient'
        : this.netlist.hasAcSource
        ? 'ac'
        : isTransient
        ? 'transient'
        : 'dc',
      status: this.status,
      timeSec: this.timeSec,
      dtSec: this.dtSec,
      stepCount: this.stepCount,
      tauSec: this.tauSec,
      odeInfo: this.odeInfo,
      totalStoredEnergyJ,
      frequencyHz: this.freqHz,
      timeScale: this.timeScale,
      nodeVoltages: [...stepSol.nodeV],
      wireVoltages,
      liveReadouts,
      components: compResults,
      timePointsMs: [...this.timeHistoryMs],
      channels,
      phasors,
      impedanceSummary: this.impedanceSummary,
    };
  }

  public toSimulationReport(): SimulationReport {
    const s = this.latestState;
    if (!s.ok) {
      return {
        ok: false,
        error: s.error,
        warnings: s.warnings,
        mode: s.mode,
        frequencyHz: s.frequencyHz,
        odeInfo: s.odeInfo,
        timePointsMs: [],
        channels: [],
        components: [],
        liveReadouts: {},
        phasors: [],
      };
    }
    return {
      ok: true,
      warnings: s.warnings,
      mode: s.mode,
      frequencyHz: s.frequencyHz,
      tauSec: s.tauSec ?? undefined,
      odeInfo: s.odeInfo,
      totalStoredEnergyJ: s.totalStoredEnergyJ,
      timePointsMs: s.timePointsMs,
      channels: s.channels,
      components: s.components,
      liveReadouts: s.liveReadouts,
      wireVoltages: s.wireVoltages,
      phasors: s.phasors,
      impedanceSummary: s.impedanceSummary,
    };
  }
}

/** Runs complete batch DC + ODE Transient + AC Complex Phasor Simulation */
export function simulateCircuit(
  elements: WhiteboardElement[],
  overrideFrequencyHz?: number
): SimulationReport {
  const sim = new Simulator(elements, overrideFrequencyHz, 'trapezoidal');
  if (!sim.getState().ok) {
    return sim.toSimulationReport();
  }
  const report = sim.step(180);
  const fullReport = sim.toSimulationReport();

  if (report.mode === 'dc' && !report.tauSec) {
    for (const c of fullReport.components) {
      if (c.kind === 'voltmeter') {
        fullReport.liveReadouts[c.elementId] = `${c.dcVoltage.toFixed(2)} V`;
      } else if (c.kind === 'ammeter') {
        fullReport.liveReadouts[c.elementId] = formatEngineering(c.dcCurrent, 'A');
      }
    }
  }
  return fullReport;
}

/** Computes exact vector sum of a set of phasors (Phasor Diagram Maker math) */
export function computePhasorResultant(phasors: PhasorVector[]): {
  magnitude: number;
  angleDeg: number;
  re: number;
  im: number;
} {
  let re = 0;
  let im = 0;
  for (const p of phasors) {
    const rad = (p.angleDeg * Math.PI) / 180;
    re += p.magnitude * Math.cos(rad);
    im += p.magnitude * Math.sin(rad);
  }
  return {
    magnitude: Math.hypot(re, im),
    angleDeg: (Math.atan2(im, re) * 180) / Math.PI,
    re,
    im,
  };
}

/**
 * Returns ONLY the waveform channel measured by a specific CRO block's attached probes (CH1+ / REF−).
 * Returns null if the CRO's probes are disconnected or simulation is invalid.
 */
export function getCroProbeWaveform(
  simState: SimulatorState | SimulationReport | null | undefined,
  croElementId: string
): WaveformChannel | null {
  if (!simState || !simState.ok) return null;
  const comp = simState.components.find(
    (c) => c.elementId === croElementId && c.kind === 'oscilloscope'
  );
  if (!comp || !comp.probesConnected) return null;
  return simState.channels.find((ch) => ch.id === croElementId) || null;
}
