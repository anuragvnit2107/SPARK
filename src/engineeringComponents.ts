import { CircuitKind, Point, TerminalPin, WhiteboardElement } from './types';
import { getAnchorWorldPosition, getNormalizedBounds } from './sketchEngine';

export interface CircuitCatalogItem {
  kind: CircuitKind;
  name: string;
  category:
    | 'Passives'
    | 'Sources & Ground'
    | 'Semiconductors'
    | 'Instruments'
    | 'Logic Gates'
    | 'Integrated Circuits';
  defaultWidth: number;
  defaultHeight: number;
  defaultValue: string;
  defaultFrequencyHz?: number;
  defaultWaveform?: 'sine' | 'triangle' | 'square';
  description: string;
}

export const CIRCUIT_CATALOG: CircuitCatalogItem[] = [
  {
    kind: 'resistor',
    name: 'Resistor (IEEE)',
    category: 'Passives',
    defaultWidth: 120,
    defaultHeight: 48,
    defaultValue: '1kΩ',
    description: 'Zigzag resistive element with left/right terminals',
  },
  {
    kind: 'capacitor',
    name: 'Capacitor',
    category: 'Passives',
    defaultWidth: 100,
    defaultHeight: 56,
    defaultValue: '10uF',
    description: 'Parallel-plate capacitor with anode/cathode leads',
  },
  {
    kind: 'inductor',
    name: 'Inductor (4-Turn)',
    category: 'Passives',
    defaultWidth: 128,
    defaultHeight: 48,
    defaultValue: '100mH',
    description: '4-turn magnetic coil inductor',
  },
  {
    kind: 'switch',
    name: 'Toggle Switch (SPST)',
    category: 'Passives',
    defaultWidth: 112,
    defaultHeight: 52,
    defaultValue: 'OPEN',
    description: 'SPST knife switch (click on canvas or toggle in inspector to open/close)',
  },
  {
    kind: 'dc-source',
    name: 'DC Voltage Source',
    category: 'Sources & Ground',
    defaultWidth: 68,
    defaultHeight: 110,
    defaultValue: '12V',
    description: 'Polarized +/- DC voltage rail source',
  },
  {
    kind: 'ac-source',
    name: 'AC Sine Source',
    category: 'Sources & Ground',
    defaultWidth: 74,
    defaultHeight: 110,
    defaultValue: '10V',
    defaultFrequencyHz: 60,
    description: 'Sinusoidal AC voltage source (configurable Hz)',
  },
  {
    kind: 'function-generator',
    name: 'Function Generator',
    category: 'Sources & Ground',
    defaultWidth: 138,
    defaultHeight: 96,
    defaultValue: '10V',
    defaultFrequencyHz: 60,
    defaultWaveform: 'sine',
    description: 'Benchtop Sine, Triangle & Square wave signal generator (click to tune)',
  },
  {
    kind: 'ground',
    name: 'Earth Ground',
    category: 'Sources & Ground',
    defaultWidth: 56,
    defaultHeight: 60,
    defaultValue: 'GND',
    description: '0V Reference ground node',
  },
  {
    kind: 'diode',
    name: 'Diode',
    category: 'Semiconductors',
    defaultWidth: 104,
    defaultHeight: 52,
    defaultValue: '1N4148',
    description: 'PN junction diode (anode left, cathode right)',
  },
  {
    kind: 'opamp',
    name: 'Op-Amp',
    category: 'Semiconductors',
    defaultWidth: 132,
    defaultHeight: 108,
    defaultValue: 'LM358',
    description: 'Operational amplifier (+ / - inputs and output)',
  },
  {
    kind: 'voltmeter',
    name: 'Voltmeter Box',
    category: 'Instruments',
    defaultWidth: 112,
    defaultHeight: 84,
    defaultValue: '',
    description: 'Box voltmeter with + / - test probes (click for live dial & reading)',
  },
  {
    kind: 'ammeter',
    name: 'Ammeter Box',
    category: 'Instruments',
    defaultWidth: 112,
    defaultHeight: 84,
    defaultValue: '',
    description: 'Box ammeter with + / - series probes (click for live dial & reading)',
  },
  {
    kind: 'oscilloscope',
    name: 'CRO (Oscilloscope)',
    category: 'Instruments',
    defaultWidth: 138,
    defaultHeight: 96,
    defaultValue: '',
    description: 'Cathode-Ray Oscilloscope box with CH1+ / REF- probes (click for waveforms)',
  },
  {
    kind: 'gate-and',
    name: 'AND Gate',
    category: 'Logic Gates',
    defaultWidth: 116,
    defaultHeight: 72,
    defaultValue: 'AND',
    description: '2-input IEEE logical conjunction gate',
  },
  {
    kind: 'gate-or',
    name: 'OR Gate',
    category: 'Logic Gates',
    defaultWidth: 116,
    defaultHeight: 72,
    defaultValue: 'OR',
    description: '2-input IEEE logical disjunction gate',
  },
  {
    kind: 'gate-not',
    name: 'NOT Inverter',
    category: 'Logic Gates',
    defaultWidth: 106,
    defaultHeight: 64,
    defaultValue: 'INV',
    description: 'Inverting buffer with output bubble',
  },
  {
    kind: 'gate-nand',
    name: 'NAND Gate',
    category: 'Logic Gates',
    defaultWidth: 120,
    defaultHeight: 72,
    defaultValue: 'NAND',
    description: '2-input negated AND logic gate',
  },
  {
    kind: 'gate-xor',
    name: 'XOR Gate',
    category: 'Logic Gates',
    defaultWidth: 120,
    defaultHeight: 72,
    defaultValue: 'XOR',
    description: '2-input exclusive OR gate',
  },
  {
    kind: 'ic-chip',
    name: 'Multi-Pin IC',
    category: 'Integrated Circuits',
    defaultWidth: 150,
    defaultHeight: 136,
    defaultValue: '555 TIMER',
    description: 'Configurable DIP integrated circuit package',
  },
];

export function getCircuitTerminals(el: WhiteboardElement): TerminalPin[] {
  if (el.type !== 'circuit' || !el.circuitKind) {
    return [
      { id: 'top', label: 'N', nx: 0.5, ny: 0 },
      { id: 'right', label: 'E', nx: 1, ny: 0.5 },
      { id: 'bottom', label: 'S', nx: 0.5, ny: 1 },
      { id: 'left', label: 'W', nx: 0, ny: 0.5 },
    ];
  }

  switch (el.circuitKind) {
    case 'resistor':
    case 'capacitor':
    case 'inductor':
    case 'switch':
    case 'diode':
    case 'ammeter':
      return [
        { id: 'in', label: '+', nx: 0, ny: 0.5 },
        { id: 'out', label: '-', nx: 1, ny: 0.5 },
      ];
    case 'voltmeter':
    case 'oscilloscope':
      return [
        { id: 'pos', label: '+', nx: 0, ny: 0.5 },
        { id: 'neg', label: '-', nx: 1, ny: 0.5 },
      ];
    case 'dc-source':
    case 'ac-source':
      return [
        { id: 'pos', label: '+', nx: 0.5, ny: 0 },
        { id: 'neg', label: '-', nx: 0.5, ny: 1 },
      ];
    case 'function-generator':
      return [
        { id: 'pos', label: '+', nx: 1, ny: 0.5 },
        { id: 'neg', label: '-', nx: 0, ny: 0.5 },
      ];
    case 'ground':
      return [{ id: 'gnd', label: 'GND', nx: 0.5, ny: 0 }];
    case 'opamp':
    case 'gate-and':
    case 'gate-or':
    case 'gate-nand':
    case 'gate-xor':
      return [
        { id: 'in-a', label: 'A', nx: 0, ny: 0.3 },
        { id: 'in-b', label: 'B', nx: 0, ny: 0.7 },
        { id: 'out', label: 'Y', nx: 1, ny: 0.5 },
      ];
    case 'gate-not':
      return [
        { id: 'in', label: 'A', nx: 0, ny: 0.5 },
        { id: 'out', label: 'Y', nx: 1, ny: 0.5 },
      ];
    case 'ic-chip': {
      const count = Math.max(4, Math.min(12, el.icPinCount || 8));
      const perSide = Math.ceil(count / 2);
      const pins: TerminalPin[] = [];
      for (let i = 0; i < perSide; i++) {
        const ny = (i + 1) / (perSide + 1);
        pins.push({
          id: `pin-l-${i + 1}`,
          label: el.icPinLabels?.[i] || `${i + 1}`,
          nx: 0,
          ny,
        });
        const rightIndex = perSide + i;
        if (rightIndex < count) {
          pins.push({
            id: `pin-r-${rightIndex + 1}`,
            label: el.icPinLabels?.[rightIndex] || `${count - i}`,
            nx: 1,
            ny,
          });
        }
      }
      return pins;
    }
  }
}

export interface WorldTerminal {
  elementId: string;
  terminalId: string;
  label: string;
  x: number;
  y: number;
  anchor: Point;
}

export function findNearestSnapTerminal(
  elements: WhiteboardElement[],
  worldPt: Point,
  excludeElementId?: string,
  maxDist = 18
): WorldTerminal | null {
  let best: WorldTerminal | null = null;
  let bestDist = maxDist;

  for (const el of elements) {
    if (
      el.isDeleted ||
      el.id === excludeElementId ||
      el.type === 'arrow' ||
      el.type === 'line' ||
      el.type === 'freedraw' ||
      el.type === 'frame' ||
      el.type === 'webpage' ||
      el.type === 'math-equation' ||
      el.type === 'math-matrix' ||
      el.type === 'math-graph-2d' ||
      el.type === 'math-graph-3d'
    ) {
      continue;
    }
    const pins = getCircuitTerminals(el);
    for (const pin of pins) {
      const worldPin = getAnchorWorldPosition(el, { x: pin.nx, y: pin.ny });
      const d = Math.hypot(worldPt.x - worldPin.x, worldPt.y - worldPin.y);
      if (d < bestDist) {
        bestDist = d;
        best = {
          elementId: el.id,
          terminalId: pin.id,
          label: pin.label,
          x: worldPin.x,
          y: worldPin.y,
          anchor: { x: pin.nx, y: pin.ny },
        };
      }
    }
  }
  return best;
}

export interface InstrumentProbeGeom {
  leadFrom: Point;
  leadTo: Point;
  tip: Point;
  color: string;
  sign: string;
}

export interface CircuitVectorGeometry {
  polylines: Point[][];
  circles: { cx: number; cy: number; r: number }[];
  labels: { text: string; x: number; y: number; size: number }[];
  probes?: InstrumentProbeGeom[];
  screenRect?: { x: number; y: number; width: number; height: number };
  dialArc?: { cx: number; cy: number; r: number; kind: 'voltmeter' | 'ammeter' };
}

export function buildCircuitGeometry(el: WhiteboardElement): CircuitVectorGeometry {
  const b = getNormalizedBounds(el);
  const { x, y, width: w, height: h } = b;
  const cx = x + w / 2;
  const cy = y + h / 2;
  const polylines: Point[][] = [];
  const circles: { cx: number; cy: number; r: number }[] = [];
  const labels: { text: string; x: number; y: number; size: number }[] = [];
  const probes: InstrumentProbeGeom[] = [];
  let screenRect: CircuitVectorGeometry['screenRect'];
  let dialArc: CircuitVectorGeometry['dialArc'];

  const kind = el.circuitKind || 'resistor';

  switch (kind) {
    case 'resistor': {
      const zigStart = x + w * 0.2;
      const zigEnd = x + w * 0.8;
      const amp = h * 0.34;
      const teeth = 6;
      const pts: Point[] = [{ x, y: cy }, { x: zigStart, y: cy }];
      for (let i = 0; i < teeth; i++) {
        const px = zigStart + ((i + 0.5) / teeth) * (zigEnd - zigStart);
        const py = cy + (i % 2 === 0 ? -amp : amp);
        pts.push({ x: px, y: py });
      }
      pts.push({ x: zigEnd, y: cy }, { x: x + w, y: cy });
      polylines.push(pts);
      break;
    }

    case 'capacitor': {
      const gap = Math.max(8, w * 0.14);
      const plateX1 = cx - gap / 2;
      const plateX2 = cx + gap / 2;
      polylines.push([{ x, y: cy }, { x: plateX1, y: cy }]);
      polylines.push([
        { x: plateX1, y: y + h * 0.14 },
        { x: plateX1, y: y + h * 0.86 },
      ]);
      polylines.push([
        { x: plateX2, y: y + h * 0.14 },
        { x: plateX2, y: y + h * 0.86 },
      ]);
      polylines.push([{ x: plateX2, y: cy }, { x: x + w, y: cy }]);
      break;
    }

    case 'inductor': {
      const coilStart = x + w * 0.18;
      const coilEnd = x + w * 0.82;
      const turns = 4;
      const turnW = (coilEnd - coilStart) / turns;
      const loopH = h * 0.38;
      const pts: Point[] = [{ x, y: cy }, { x: coilStart, y: cy }];
      for (let t = 0; t < turns; t++) {
        const sx = coilStart + t * turnW;
        for (let s = 1; s <= 8; s++) {
          const ang = Math.PI - (s / 8) * Math.PI;
          pts.push({
            x: sx + turnW / 2 + (turnW / 2) * Math.cos(ang),
            y: cy - loopH * Math.sin(ang),
          });
        }
      }
      pts.push({ x: x + w, y: cy });
      polylines.push(pts);
      break;
    }

    case 'switch': {
      const contactL = x + w * 0.3;
      const contactR = x + w * 0.7;
      const contactRSize = Math.max(3, Math.min(5, h * 0.09));
      polylines.push([{ x, y: cy }, { x: contactL - contactRSize, y: cy }]);
      polylines.push([{ x: contactR + contactRSize, y: cy }, { x: x + w, y: cy }]);
      circles.push({ cx: contactL, cy, r: contactRSize });
      circles.push({ cx: contactR, cy, r: contactRSize });
      if (el.switchClosed) {
        polylines.push([{ x: contactL, y: cy }, { x: contactR, y: cy }]);
      } else {
        polylines.push([{ x: contactL, y: cy }, { x: contactR - 2, y: y + h * 0.16 }]);
      }
      labels.push({
        text: el.switchClosed ? 'ON' : 'OFF',
        x: cx,
        y: y + h * 0.84,
        size: 9.5,
      });
      break;
    }

    case 'dc-source': {
      const r = Math.min(w, h) * 0.34;
      polylines.push([{ x: cx, y }, { x: cx, y: cy - r }]);
      polylines.push([{ x: cx, y: cy + r }, { x: cx, y: y + h }]);
      circles.push({ cx, cy, r });
      labels.push({ text: '+', x: cx, y: cy - r * 0.42, size: Math.max(14, r * 0.65) });
      labels.push({ text: '−', x: cx, y: cy + r * 0.48, size: Math.max(14, r * 0.65) });
      break;
    }

    case 'ac-source': {
      const r = Math.min(w, h) * 0.34;
      polylines.push([{ x: cx, y }, { x: cx, y: cy - r }]);
      polylines.push([{ x: cx, y: cy + r }, { x: cx, y: y + h }]);
      circles.push({ cx, cy, r });
      const wave: Point[] = [];
      for (let i = 0; i <= 16; i++) {
        const t = i / 16;
        wave.push({
          x: cx - r * 0.55 + t * r * 1.1,
          y: cy - Math.sin(t * Math.PI * 2) * r * 0.34,
        });
      }
      polylines.push(wave);
      break;
    }

    case 'function-generator': {
      const boxL = x + w * 0.14;
      const boxR = x + w * 0.86;
      const boxT = y + h * 0.08;
      const boxB = y + h * 0.92;
      const boxW = boxR - boxL;
      const boxH = boxB - boxT;

      // Benchtop Function Generator enclosure
      polylines.push([
        { x: boxL, y: boxT },
        { x: boxR, y: boxT },
        { x: boxR, y: boxB },
        { x: boxL, y: boxB },
        { x: boxL, y: boxT },
      ]);

      // Left REF(-) lead and Right OUT(+) lead
      const collarL = x + w * 0.06;
      const collarR = x + w * 0.94;
      polylines.push([{ x, y: cy }, { x: boxL, y: cy }]);
      polylines.push([{ x: boxR, y: cy }, { x: x + w, y: cy }]);
      probes.push(
        {
          leadFrom: { x: boxL, y: cy },
          leadTo: { x: collarL, y: cy },
          tip: { x, y: cy },
          color: '#38bdf8',
          sign: '−',
        },
        {
          leadFrom: { x: boxR, y: cy },
          leadTo: { x: collarR, y: cy },
          tip: { x: x + w, y: cy },
          color: '#ef4444',
          sign: '+',
        }
      );

      // Signal preview screen on left 64% of panel
      const scrL = boxL + boxW * 0.08;
      const scrR = boxL + boxW * 0.68;
      const scrT = boxT + boxH * 0.14;
      const scrB = boxB - boxH * 0.24;
      screenRect = { x: scrL, y: scrT, width: scrR - scrL, height: scrB - scrT };
      polylines.push([
        { x: scrL, y: scrT },
        { x: scrR, y: scrT },
        { x: scrR, y: scrB },
        { x: scrL, y: scrB },
        { x: scrL, y: scrT },
      ]);

      // Waveform preview trace inside screen based on el.waveformType
      const wf = el.waveformType || 'sine';
      const scrMidY = (scrT + scrB) / 2;
      const ampPx = (scrB - scrT) * 0.3;
      const traceStartX = scrL + 4;
      const traceW = Math.max(8, scrR - scrL - 8);
      if (wf === 'square') {
        const q1 = traceStartX + traceW * 0.33;
        const q2 = traceStartX + traceW * 0.67;
        polylines.push([
          { x: traceStartX, y: scrMidY - ampPx },
          { x: q1, y: scrMidY - ampPx },
          { x: q1, y: scrMidY + ampPx },
          { x: q2, y: scrMidY + ampPx },
          { x: q2, y: scrMidY - ampPx },
          { x: traceStartX + traceW, y: scrMidY - ampPx },
        ]);
      } else if (wf === 'triangle') {
        polylines.push([
          { x: traceStartX, y: scrMidY },
          { x: traceStartX + traceW * 0.18, y: scrMidY - ampPx },
          { x: traceStartX + traceW * 0.52, y: scrMidY + ampPx },
          { x: traceStartX + traceW * 0.85, y: scrMidY - ampPx },
          { x: traceStartX + traceW, y: scrMidY },
        ]);
      } else {
        const sineTrace: Point[] = [];
        for (let i = 0; i <= 18; i++) {
          const t = i / 18;
          sineTrace.push({
            x: traceStartX + t * traceW,
            y: scrMidY - Math.sin(t * Math.PI * 2 * 1.25) * ampPx,
          });
        }
        polylines.push(sineTrace);
      }

      // Two rotary tuning knobs on right bezel
      const knobX = boxL + boxW * 0.84;
      const knobR = Math.max(3, Math.min(6, boxW * 0.07));
      circles.push({ cx: knobX, cy: boxT + boxH * 0.3, r: knobR });
      circles.push({ cx: knobX, cy: boxT + boxH * 0.58, r: knobR });

      const wfTag = wf === 'triangle' ? 'TRI' : wf === 'square' ? 'SQR' : 'SINE';
      labels.push({ text: `FGEN · ${wfTag}`, x: (scrL + scrR) / 2, y: boxB - boxH * 0.1, size: 7.5 });
      labels.push({ text: 'OUT', x: knobX, y: boxB - boxH * 0.1, size: 7.5 });
      labels.push({ text: '−', x: collarL, y: cy - 11, size: 10 });
      labels.push({ text: '+', x: collarR, y: cy - 11, size: 10 });
      break;
    }

    case 'ground': {
      const barY1 = y + h * 0.45;
      const barY2 = y + h * 0.68;
      const barY3 = y + h * 0.91;
      polylines.push([{ x: cx, y }, { x: cx, y: barY1 }]);
      polylines.push([{ x: x + w * 0.1, y: barY1 }, { x: x + w * 0.9, y: barY1 }]);
      polylines.push([{ x: x + w * 0.25, y: barY2 }, { x: x + w * 0.75, y: barY2 }]);
      polylines.push([{ x: x + w * 0.4, y: barY3 }, { x: x + w * 0.6, y: barY3 }]);
      break;
    }

    case 'diode': {
      const leftX = x + w * 0.32;
      const rightX = x + w * 0.68;
      polylines.push([{ x, y: cy }, { x: leftX, y: cy }]);
      polylines.push([
        { x: leftX, y: y + h * 0.18 },
        { x: rightX, y: cy },
        { x: leftX, y: y + h * 0.82 },
        { x: leftX, y: y + h * 0.18 },
      ]);
      polylines.push([
        { x: rightX, y: y + h * 0.16 },
        { x: rightX, y: y + h * 0.84 },
      ]);
      polylines.push([{ x: rightX, y: cy }, { x: x + w, y: cy }]);
      break;
    }

    case 'voltmeter':
    case 'ammeter': {
      const boxL = x + w * 0.18;
      const boxR = x + w * 0.82;
      const boxT = y + h * 0.1;
      const boxB = y + h * 0.9;
      const boxW = boxR - boxL;
      const boxH = boxB - boxT;

      // Benchtop meter enclosure box
      polylines.push([
        { x: boxL, y: boxT },
        { x: boxR, y: boxT },
        { x: boxR, y: boxB },
        { x: boxL, y: boxB },
        { x: boxL, y: boxT },
      ]);

      // Probe leads extending to left (+) and right (-) terminal tips
      const collarL = x + w * 0.08;
      const collarR = x + w * 0.92;
      polylines.push([{ x, y: cy }, { x: boxL, y: cy }]);
      polylines.push([{ x: boxR, y: cy }, { x: x + w, y: cy }]);
      probes.push(
        {
          leadFrom: { x: boxL, y: cy },
          leadTo: { x: collarL, y: cy },
          tip: { x, y: cy },
          color: '#ef4444',
          sign: '+',
        },
        {
          leadFrom: { x: boxR, y: cy },
          leadTo: { x: collarR, y: cy },
          tip: { x: x + w, y: cy },
          color: '#38bdf8',
          sign: '−',
        }
      );

      // Meter dial window & analog arc
      const dialR = Math.min(boxW * 0.36, boxH * 0.42);
      const dialCx = cx;
      const dialCy = boxT + boxH * 0.56;
      dialArc = { cx: dialCx, cy: dialCy, r: dialR, kind };

      labels.push({
        text: kind === 'voltmeter' ? 'V' : 'A',
        x: cx,
        y: boxT + boxH * 0.78,
        size: Math.max(11, Math.min(15, boxH * 0.22)),
      });
      labels.push({ text: '+', x: collarL, y: cy - 11, size: 10 });
      labels.push({ text: '−', x: collarR, y: cy - 11, size: 10 });
      break;
    }

    case 'oscilloscope': {
      const boxL = x + w * 0.16;
      const boxR = x + w * 0.84;
      const boxT = y + h * 0.08;
      const boxB = y + h * 0.92;
      const boxW = boxR - boxL;
      const boxH = boxB - boxT;

      // CRO benchtop chassis box
      polylines.push([
        { x: boxL, y: boxT },
        { x: boxR, y: boxT },
        { x: boxR, y: boxB },
        { x: boxL, y: boxB },
        { x: boxL, y: boxT },
      ]);

      // Left CH1+ red probe & Right REF- cyan/black probe
      const collarL = x + w * 0.07;
      const collarR = x + w * 0.93;
      polylines.push([{ x, y: cy }, { x: boxL, y: cy }]);
      polylines.push([{ x: boxR, y: cy }, { x: x + w, y: cy }]);
      probes.push(
        {
          leadFrom: { x: boxL, y: cy },
          leadTo: { x: collarL, y: cy },
          tip: { x, y: cy },
          color: '#ef4444',
          sign: '+',
        },
        {
          leadFrom: { x: boxR, y: cy },
          leadTo: { x: collarR, y: cy },
          tip: { x: x + w, y: cy },
          color: '#38bdf8',
          sign: '−',
        }
      );

      // CRT screen frame (left 64% of chassis)
      const scrL = boxL + boxW * 0.08;
      const scrR = boxL + boxW * 0.68;
      const scrT = boxT + boxH * 0.14;
      const scrB = boxB - boxH * 0.16;
      screenRect = { x: scrL, y: scrT, width: scrR - scrL, height: scrB - scrT };
      polylines.push([
        { x: scrL, y: scrT },
        { x: scrR, y: scrT },
        { x: scrR, y: scrB },
        { x: scrL, y: scrB },
        { x: scrL, y: scrT },
      ]);

      // Two front-panel rotary knobs on the right bezel
      const knobX = boxL + boxW * 0.84;
      const knobR = Math.max(3, Math.min(6.5, boxW * 0.075));
      circles.push({ cx: knobX, cy: boxT + boxH * 0.32, r: knobR });
      circles.push({ cx: knobX, cy: boxT + boxH * 0.62, r: knobR });

      // Sine trace inside CRO CRT
      const scrMidY = (scrT + scrB) / 2;
      const trace: Point[] = [];
      for (let i = 0; i <= 14; i++) {
        const t = i / 14;
        trace.push({
          x: scrL + 4 + t * (scrR - scrL - 8),
          y: scrMidY - Math.sin(t * Math.PI * 2) * (scrB - scrT) * 0.28,
        });
      }
      polylines.push(trace);

      labels.push({ text: 'CRO', x: knobX, y: boxB - boxH * 0.12, size: 8 });
      labels.push({ text: '+', x: collarL, y: cy - 11, size: 10 });
      labels.push({ text: 'ref', x: collarR, y: cy - 11, size: 9 });
      break;
    }

    case 'opamp': {
      const bodyLeft = x + w * 0.18;
      const bodyRight = x + w * 0.84;
      polylines.push([
        { x: bodyLeft, y: y + h * 0.1 },
        { x: bodyRight, y: cy },
        { x: bodyLeft, y: y + h * 0.9 },
        { x: bodyLeft, y: y + h * 0.1 },
      ]);
      polylines.push([{ x, y: y + h * 0.3 }, { x: bodyLeft, y: y + h * 0.3 }]);
      polylines.push([{ x, y: y + h * 0.7 }, { x: bodyLeft, y: y + h * 0.7 }]);
      polylines.push([{ x: bodyRight, y: cy }, { x: x + w, y: cy }]);
      labels.push({ text: '+', x: bodyLeft + w * 0.1, y: y + h * 0.32, size: 14 });
      labels.push({ text: '−', x: bodyLeft + w * 0.1, y: y + h * 0.72, size: 14 });
      break;
    }

    case 'gate-and':
    case 'gate-nand': {
      const bodyL = x + w * 0.2;
      const bodyR = x + w * (kind === 'gate-nand' ? 0.72 : 0.8);
      const topY = y + h * 0.14;
      const botY = y + h * 0.86;
      const midX = bodyL + (bodyR - bodyL) * 0.45;
      const pts: Point[] = [
        { x: bodyL, y: topY },
        { x: midX, y: topY },
      ];
      const ry = (botY - topY) / 2;
      const rx = bodyR - midX;
      for (let i = 0; i <= 10; i++) {
        const ang = -Math.PI / 2 + (i / 10) * Math.PI;
        pts.push({ x: midX + rx * Math.cos(ang), y: cy + ry * Math.sin(ang) });
      }
      pts.push({ x: bodyL, y: botY }, { x: bodyL, y: topY });
      polylines.push(pts);
      polylines.push([{ x, y: y + h * 0.3 }, { x: bodyL, y: y + h * 0.3 }]);
      polylines.push([{ x, y: y + h * 0.7 }, { x: bodyL, y: y + h * 0.7 }]);
      if (kind === 'gate-nand') {
        const br = Math.max(4, w * 0.045);
        circles.push({ cx: bodyR + br, cy, r: br });
        polylines.push([{ x: bodyR + br * 2, y: cy }, { x: x + w, y: cy }]);
      } else {
        polylines.push([{ x: bodyR, y: cy }, { x: x + w, y: cy }]);
      }
      break;
    }

    case 'gate-or':
    case 'gate-xor': {
      const bodyL = x + w * 0.22;
      const bodyR = x + w * 0.82;
      const topY = y + h * 0.14;
      const botY = y + h * 0.86;
      const pts: Point[] = [{ x: bodyL, y: topY }];
      for (let i = 1; i <= 8; i++) {
        const t = i / 8;
        pts.push({
          x: bodyL + t * (bodyR - bodyL),
          y: topY + (cy - topY) * t * t,
        });
      }
      for (let i = 1; i <= 8; i++) {
        const t = i / 8;
        const u = 1 - t;
        pts.push({
          x: bodyL + u * (bodyR - bodyL),
          y: botY - (botY - cy) * u * u,
        });
      }
      for (let i = 1; i <= 6; i++) {
        const t = i / 6;
        const py = botY - t * (botY - topY);
        const bulge = Math.sin(t * Math.PI) * w * 0.08;
        pts.push({ x: bodyL + bulge, y: py });
      }
      polylines.push(pts);
      if (kind === 'gate-xor') {
        const backPts: Point[] = [];
        for (let i = 0; i <= 6; i++) {
          const t = i / 6;
          const py = botY - t * (botY - topY);
          const bulge = Math.sin(t * Math.PI) * w * 0.08;
          backPts.push({ x: bodyL - w * 0.07 + bulge, y: py });
        }
        polylines.push(backPts);
      }
      polylines.push([{ x, y: y + h * 0.3 }, { x: bodyL + w * 0.04, y: y + h * 0.3 }]);
      polylines.push([{ x, y: y + h * 0.7 }, { x: bodyL + w * 0.04, y: y + h * 0.7 }]);
      polylines.push([{ x: bodyR, y: cy }, { x: x + w, y: cy }]);
      break;
    }

    case 'gate-not': {
      const bodyL = x + w * 0.2;
      const bodyR = x + w * 0.68;
      const br = Math.max(4, w * 0.05);
      polylines.push([
        { x: bodyL, y: y + h * 0.16 },
        { x: bodyR, y: cy },
        { x: bodyL, y: y + h * 0.84 },
        { x: bodyL, y: y + h * 0.16 },
      ]);
      circles.push({ cx: bodyR + br, cy, r: br });
      polylines.push([{ x, y: cy }, { x: bodyL, y: cy }]);
      polylines.push([{ x: bodyR + br * 2, y: cy }, { x: x + w, y: cy }]);
      break;
    }

    case 'ic-chip': {
      const boxL = x + w * 0.16;
      const boxR = x + w * 0.84;
      const boxT = y + h * 0.08;
      const boxB = y + h * 0.92;
      polylines.push([
        { x: boxL, y: boxT },
        { x: boxR, y: boxT },
        { x: boxR, y: boxB },
        { x: boxL, y: boxB },
        { x: boxL, y: boxT },
      ]);
      const notch: Point[] = [];
      for (let i = 0; i <= 8; i++) {
        const ang = (i / 8) * Math.PI;
        notch.push({
          x: cx + Math.cos(ang) * 10,
          y: boxT + Math.sin(ang) * 8,
        });
      }
      polylines.push(notch);

      const pins = getCircuitTerminals(el);
      pins.forEach((pin) => {
        const py = y + pin.ny * h;
        if (pin.nx === 0) {
          polylines.push([{ x, y: py }, { x: boxL, y: py }]);
          labels.push({ text: pin.label, x: boxL + 16, y: py, size: 11 });
        } else {
          polylines.push([{ x: boxR, y: py }, { x: x + w, y: py }]);
          labels.push({ text: pin.label, x: boxR - 16, y: py, size: 11 });
        }
      });
      break;
    }
  }

  return {
    polylines,
    circles,
    labels,
    probes: probes.length > 0 ? probes : undefined,
    screenRect,
    dialArc,
  };
}
