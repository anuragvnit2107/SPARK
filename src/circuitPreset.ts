import { WhiteboardElement, Point } from './types';
import { getCircuitTerminals } from './engineeringComponents';
import { buildOrthogonalWirePath, inferTerminalExitDir } from './sketchEngine';

export type SimPresetId =
  | 'series-rc'
  | 'parallel-rc'
  | 'series-rl'
  | 'parallel-rl'
  | 'dc-rlc'
  | 'dc-meters'
  | 'ac-rlc'
  | 'diode-rectifier';

export function createDemoCircuitPreset(inkColor = '#e2e8f0'): WhiteboardElement[] {
  const now = Date.now();
  const base = {
    angle: 0,
    strokeColor: inkColor,
    backgroundColor: 'transparent',
    fillStyle: 'none' as const,
    strokeWidth: 2.2,
    strokeStyle: 'solid' as const,
    sloppiness: 1 as const,
    opacity: 100,
    fontFamily: 'scribble' as const,
    fontSize: 20,
    version: 1,
    updatedAt: now,
  };

  return [
    {
      ...base,
      id: 'frame_1',
      type: 'frame',
      x: 80,
      y: 90,
      width: 680,
      height: 430,
      frameIndex: 1,
      frameTitle: 'Active RC Filter & Op-Amp Buffer',
      seed: 101,
    },
    {
      ...base,
      id: 'title_1',
      type: 'text',
      x: 110,
      y: 112,
      width: 340,
      height: 44,
      text: 'Low-Pass Filter Stage (fc = 1.59 kHz)',
      fontFamily: 'heavy',
      fontSize: 22,
      strokeColor: '#60a5fa',
      seed: 102,
    },
    {
      ...base,
      id: 'ac_src_1',
      type: 'circuit',
      circuitKind: 'ac-source',
      componentValue: 'Vin 1kHz',
      x: 120,
      y: 230,
      width: 74,
      height: 110,
      seed: 103,
    },
    {
      ...base,
      id: 'gnd_1',
      type: 'circuit',
      circuitKind: 'ground',
      componentValue: 'GND',
      x: 129,
      y: 385,
      width: 56,
      height: 60,
      seed: 104,
    },
    {
      ...base,
      id: 'res_1',
      type: 'circuit',
      circuitKind: 'resistor',
      componentValue: '10kΩ',
      x: 245,
      y: 206,
      width: 120,
      height: 48,
      seed: 105,
    },
    {
      ...base,
      id: 'cap_1',
      type: 'circuit',
      circuitKind: 'capacitor',
      componentValue: '10nF',
      x: 345,
      y: 295,
      width: 100,
      height: 56,
      seed: 106,
    },
    {
      ...base,
      id: 'opamp_1',
      type: 'circuit',
      circuitKind: 'opamp',
      componentValue: 'OPA2134',
      x: 490,
      y: 200,
      width: 132,
      height: 108,
      strokeColor: '#34d399',
      seed: 107,
    },
    {
      ...base,
      id: 'wire_src_res',
      type: 'wire',
      wireRouting: 'orthogonal',
      x: 157,
      y: 230,
      width: 88,
      height: 1,
      points: [
        { x: 0, y: 0 },
        { x: 88, y: 0 },
      ],
      startBinding: { elementId: 'ac_src_1', terminalId: 'pos', anchor: { x: 0.5, y: 0 } },
      endBinding: { elementId: 'res_1', terminalId: 'in', anchor: { x: 0, y: 0.5 } },
      seed: 108,
    },
    {
      ...base,
      id: 'wire_src_gnd',
      type: 'wire',
      wireRouting: 'orthogonal',
      x: 157,
      y: 340,
      width: 1,
      height: 45,
      points: [
        { x: 0, y: 0 },
        { x: 0, y: 45 },
      ],
      startBinding: { elementId: 'ac_src_1', terminalId: 'neg', anchor: { x: 0.5, y: 1 } },
      endBinding: { elementId: 'gnd_1', terminalId: 'gnd', anchor: { x: 0.5, y: 0 } },
      seed: 109,
    },
    {
      ...base,
      id: 'wire_res_opamp',
      type: 'wire',
      wireRouting: 'orthogonal',
      x: 365,
      y: 230,
      width: 125,
      height: 2,
      points: [
        { x: 0, y: 0 },
        { x: 125, y: 2 },
      ],
      text: 'V_filt',
      fontSize: 15,
      startBinding: { elementId: 'res_1', terminalId: 'out', anchor: { x: 1, y: 0.5 } },
      endBinding: { elementId: 'opamp_1', terminalId: 'in-a', anchor: { x: 0, y: 0.3 } },
      seed: 110,
    },
    {
      ...base,
      id: 'wire_cap_tap',
      type: 'wire',
      wireRouting: 'orthogonal',
      x: 365,
      y: 230,
      width: 20,
      height: 93,
      points: [
        { x: 0, y: 0 },
        { x: 0, y: 93 },
        { x: -20, y: 93 },
      ],
      startBinding: { elementId: 'res_1', terminalId: 'out', anchor: { x: 1, y: 0.5 } },
      endBinding: { elementId: 'cap_1', terminalId: 'in', anchor: { x: 0, y: 0.5 } },
      seed: 111,
    },
    {
      ...base,
      id: 'note_box_1',
      type: 'rectangle',
      x: 490,
      y: 356,
      width: 230,
      height: 110,
      strokeColor: '#fbbf24',
      backgroundColor: '#4a3210',
      fillStyle: 'hachure',
      text: 'Unity-Gain Buffer\nZ_out < 0.1 Ω',
      fontFamily: 'casual',
      fontSize: 18,
      seed: 112,
    },

    // Frame 2: Logic & Timing Stage
    {
      ...base,
      id: 'frame_2',
      type: 'frame',
      x: 820,
      y: 90,
      width: 620,
      height: 430,
      frameIndex: 2,
      frameTitle: 'Digital Timing & Gate Interlock',
      seed: 201,
    },
    {
      ...base,
      id: 'title_2',
      type: 'text',
      x: 850,
      y: 112,
      width: 310,
      height: 44,
      text: 'Comparator → 555 Pulse Shaper',
      fontFamily: 'heavy',
      fontSize: 22,
      strokeColor: '#34d399',
      seed: 202,
    },
    {
      ...base,
      id: 'nand_1',
      type: 'circuit',
      circuitKind: 'gate-nand',
      componentValue: '74HC00',
      x: 865,
      y: 210,
      width: 120,
      height: 72,
      seed: 203,
    },
    {
      ...base,
      id: 'not_1',
      type: 'circuit',
      circuitKind: 'gate-not',
      componentValue: 'INV',
      x: 870,
      y: 345,
      width: 106,
      height: 64,
      seed: 204,
    },
    {
      ...base,
      id: 'ic_555',
      type: 'circuit',
      circuitKind: 'ic-chip',
      componentValue: 'NE555',
      icPinCount: 8,
      icPinLabels: ['GND', 'TRIG', 'OUT', 'RST', 'VCC', 'DIS', 'THR', 'CTRL'],
      x: 1090,
      y: 205,
      width: 168,
      height: 165,
      strokeColor: '#60a5fa',
      seed: 205,
    },
    {
      ...base,
      id: 'wire_gate_ic',
      type: 'wire',
      wireRouting: 'orthogonal',
      x: 985,
      y: 246,
      width: 105,
      height: 30,
      points: [
        { x: 0, y: 0 },
        { x: 52, y: 0 },
        { x: 52, y: 25 },
        { x: 105, y: 25 },
      ],
      text: 'TRIG',
      fontSize: 15,
      startBinding: { elementId: 'nand_1', terminalId: 'out', anchor: { x: 1, y: 0.5 } },
      endBinding: { elementId: 'ic_555', terminalId: 'pin-l-2', anchor: { x: 0, y: 0.4 } },
      seed: 206,
    },
    {
      ...base,
      id: 'out_badge',
      type: 'diamond',
      x: 1300,
      y: 242,
      width: 112,
      height: 82,
      strokeColor: '#c084fc',
      backgroundColor: '#1e293b',
      fillStyle: 'cross-hatch',
      text: 'PWM\nOUT',
      fontFamily: 'cleansans',
      fontSize: 16,
      seed: 207,
    },
    {
      ...base,
      id: 'wire_ic_out',
      type: 'wire',
      wireRouting: 'orthogonal',
      x: 1258,
      y: 304,
      width: 42,
      height: 20,
      points: [
        { x: 0, y: 0 },
        { x: 21, y: 0 },
        { x: 21, y: -21 },
        { x: 42, y: -21 },
      ],
      startBinding: { elementId: 'ic_555', terminalId: 'pin-r-7', anchor: { x: 1, y: 0.6 } },
      endBinding: { elementId: 'out_badge', terminalId: 'left', anchor: { x: 0, y: 0.5 } },
      seed: 208,
    },
  ];
}

function makeWireFromWorldPoints(
  id: string,
  worldPts: Point[],
  inkColor: string,
  seed: number,
  options?: {
    startBinding?: WhiteboardElement['startBinding'];
    endBinding?: WhiteboardElement['endBinding'];
    label?: string;
  }
): WhiteboardElement {
  const origin = worldPts[0];
  const relPts = worldPts.map((p) => ({ x: p.x - origin.x, y: p.y - origin.y }));
  const xs = relPts.map((p) => p.x);
  const ys = relPts.map((p) => p.y);
  return {
    id,
    type: 'wire',
    wireRouting: 'orthogonal',
    x: origin.x,
    y: origin.y,
    width: Math.max(1, Math.max(...xs) - Math.min(...xs)),
    height: Math.max(1, Math.max(...ys) - Math.min(...ys)),
    angle: 0,
    strokeColor: inkColor,
    backgroundColor: 'transparent',
    fillStyle: 'none',
    strokeWidth: 2.2,
    strokeStyle: 'solid',
    sloppiness: 0,
    opacity: 100,
    text: options?.label,
    points: relPts,
    startBinding: options?.startBinding ?? null,
    endBinding: options?.endBinding ?? null,
    seed,
    fontFamily: 'cleansans',
    fontSize: 13,
    version: 1,
    updatedAt: Date.now(),
  };
}

function connectWire(
  id: string,
  fromEl: WhiteboardElement,
  fromTerminalId: string,
  toEl: WhiteboardElement,
  toTerminalId: string,
  inkColor: string,
  seed: number,
  customWaypoints?: Point[],
  label?: string
): WhiteboardElement {
  const fromTerm = getCircuitTerminals(fromEl).find((t) => t.id === fromTerminalId)!;
  const toTerm = getCircuitTerminals(toEl).find((t) => t.id === toTerminalId)!;
  const startPt = {
    x: fromEl.x + fromTerm.nx * fromEl.width,
    y: fromEl.y + fromTerm.ny * fromEl.height,
  };
  const endPt = {
    x: toEl.x + toTerm.nx * toEl.width,
    y: toEl.y + toTerm.ny * toEl.height,
  };
  const worldPts =
    customWaypoints && customWaypoints.length >= 2
      ? customWaypoints
      : buildOrthogonalWirePath(
          startPt,
          endPt,
          inferTerminalExitDir({ x: fromTerm.nx, y: fromTerm.ny }),
          inferTerminalExitDir({ x: toTerm.nx, y: toTerm.ny })
        );

  return makeWireFromWorldPoints(id, worldPts, inkColor, seed, {
    startBinding: {
      elementId: fromEl.id,
      terminalId: fromTerm.id,
      anchor: { x: fromTerm.nx, y: fromTerm.ny },
    },
    endBinding: {
      elementId: toEl.id,
      terminalId: toTerm.id,
      anchor: { x: toTerm.nx, y: toTerm.ny },
    },
    label,
  });
}

function termPos(el: WhiteboardElement, terminalId: string): Point {
  const term = getCircuitTerminals(el).find((t) => t.id === terminalId)!;
  return { x: el.x + term.nx * el.width, y: el.y + term.ny * el.height };
}

export function createSimStarterCircuit(
  preset: SimPresetId,
  inkColor = '#e2e8f0'
): WhiteboardElement[] {
  const now = Date.now();
  const base = {
    angle: 0,
    strokeColor: inkColor,
    backgroundColor: 'transparent',
    fillStyle: 'none' as const,
    strokeWidth: 2.2,
    strokeStyle: 'solid' as const,
    sloppiness: 1 as const,
    opacity: 100,
    fontFamily: 'scribble' as const,
    fontSize: 18,
    version: 1,
    updatedAt: now,
  };

  if (preset === 'series-rc') {
    // 10V DC -> Ammeter -> 1kΩ -> 10uF -> GND (tau = 10ms)
    const src: WhiteboardElement = {
      ...base,
      id: 'rc_src',
      type: 'circuit',
      circuitKind: 'dc-source',
      componentValue: '10V',
      x: 130,
      y: 230,
      width: 68,
      height: 110,
      seed: 601,
    };
    const gnd: WhiteboardElement = {
      ...base,
      id: 'rc_gnd',
      type: 'circuit',
      circuitKind: 'ground',
      componentValue: 'GND',
      x: 136,
      y: 410,
      width: 56,
      height: 60,
      seed: 602,
    };
    const amm: WhiteboardElement = {
      ...base,
      id: 'rc_amm',
      type: 'circuit',
      circuitKind: 'ammeter',
      componentValue: 'I(t)',
      x: 245,
      y: 138,
      width: 84,
      height: 84,
      seed: 603,
    };
    const r1: WhiteboardElement = {
      ...base,
      id: 'rc_r1',
      type: 'circuit',
      circuitKind: 'resistor',
      componentValue: '1kΩ',
      x: 385,
      y: 156,
      width: 120,
      height: 48,
      seed: 604,
    };
    const c1: WhiteboardElement = {
      ...base,
      id: 'rc_c1',
      type: 'circuit',
      circuitKind: 'capacitor',
      componentValue: '10uF',
      x: 565,
      y: 152,
      width: 100,
      height: 56,
      seed: 605,
    };
    const vm: WhiteboardElement = {
      ...base,
      id: 'rc_vm',
      type: 'circuit',
      circuitKind: 'voltmeter',
      componentValue: 'Vc(t)',
      x: 573,
      y: 280,
      width: 84,
      height: 84,
      seed: 606,
    };

    return [
      src,
      gnd,
      amm,
      r1,
      c1,
      vm,
      connectWire('w_rc_1', src, 'pos', amm, 'in', inkColor, 610),
      connectWire('w_rc_2', amm, 'out', r1, 'in', inkColor, 611),
      connectWire('w_rc_3', r1, 'out', c1, 'in', inkColor, 612),
      // Tap Vc+ node at (535, 180) down to voltmeter +
      makeWireFromWorldPoints(
        'w_rc_4',
        [{ x: 535, y: 180 }, { x: 535, y: 322 }, termPos(vm, 'pos')],
        inkColor,
        613,
        {
          endBinding: { elementId: vm.id, terminalId: 'pos', anchor: { x: 0, y: 0.5 } },
        }
      ),
      // Return rail from c1.out -> bottom bus -> gnd
      connectWire('w_rc_5', c1, 'out', gnd, 'gnd', inkColor, 614, [
        termPos(c1, 'out'),
        { x: 700, y: 180 },
        { x: 700, y: 392 },
        { x: 164, y: 392 },
        termPos(gnd, 'gnd'),
      ]),
      // Tap voltmeter neg down to return bus (700, 392)
      makeWireFromWorldPoints(
        'w_rc_6',
        [termPos(vm, 'neg'), { x: 700, y: 322 }],
        inkColor,
        615,
        {
          startBinding: { elementId: vm.id, terminalId: 'neg', anchor: { x: 1, y: 0.5 } },
        }
      ),
      connectWire('w_rc_7', src, 'neg', gnd, 'gnd', inkColor, 616),
    ];
  }

  if (preset === 'parallel-rc') {
    // 12V DC -> 1kΩ feed -> Parallel Branch (1kΩ || 22uF) -> GND (R_th = 500Ω, tau = 11ms)
    const src: WhiteboardElement = {
      ...base,
      id: 'prc_src',
      type: 'circuit',
      circuitKind: 'dc-source',
      componentValue: '12V',
      x: 130,
      y: 230,
      width: 68,
      height: 110,
      seed: 701,
    };
    const gnd: WhiteboardElement = {
      ...base,
      id: 'prc_gnd',
      type: 'circuit',
      circuitKind: 'ground',
      componentValue: 'GND',
      x: 136,
      y: 420,
      width: 56,
      height: 60,
      seed: 702,
    };
    const rFeed: WhiteboardElement = {
      ...base,
      id: 'prc_r1',
      type: 'circuit',
      circuitKind: 'resistor',
      componentValue: '1kΩ',
      x: 250,
      y: 156,
      width: 120,
      height: 48,
      seed: 703,
    };
    const rLoad: WhiteboardElement = {
      ...base,
      id: 'prc_r2',
      type: 'circuit',
      circuitKind: 'resistor',
      componentValue: '1kΩ',
      x: 470,
      y: 156,
      width: 120,
      height: 48,
      seed: 704,
    };
    const cap: WhiteboardElement = {
      ...base,
      id: 'prc_c1',
      type: 'circuit',
      circuitKind: 'capacitor',
      componentValue: '22uF',
      x: 480,
      y: 266,
      width: 100,
      height: 56,
      seed: 705,
    };
    const vm: WhiteboardElement = {
      ...base,
      id: 'prc_vm',
      type: 'circuit',
      circuitKind: 'voltmeter',
      componentValue: 'Vp(t)',
      x: 645,
      y: 252,
      width: 84,
      height: 84,
      seed: 706,
    };

    return [
      src,
      gnd,
      rFeed,
      rLoad,
      cap,
      vm,
      connectWire('w_prc_1', src, 'pos', rFeed, 'in', inkColor, 710),
      connectWire('w_prc_2', rFeed, 'out', rLoad, 'in', inkColor, 711),
      // Parallel tap down from node between rFeed & rLoad (x=420, y=180) to cap.in
      makeWireFromWorldPoints(
        'w_prc_3',
        [{ x: 420, y: 180 }, { x: 420, y: 294 }, termPos(cap, 'in')],
        inkColor,
        712,
        {
          endBinding: { elementId: cap.id, terminalId: 'in', anchor: { x: 0, y: 0.5 } },
        }
      ),
      // Voltmeter pos taps same node above
      makeWireFromWorldPoints(
        'w_prc_4',
        [{ x: 420, y: 294 }, { x: 420, y: 365 }, { x: 625, y: 365 }, { x: 625, y: 294 }, termPos(vm, 'pos')],
        inkColor,
        713,
        {
          endBinding: { elementId: vm.id, terminalId: 'pos', anchor: { x: 0, y: 0.5 } },
        }
      ),
      // Main ground return rail at x=755 -> y=405 -> gnd
      connectWire('w_prc_5', rLoad, 'out', gnd, 'gnd', inkColor, 714, [
        termPos(rLoad, 'out'),
        { x: 755, y: 180 },
        { x: 755, y: 405 },
        { x: 164, y: 405 },
        termPos(gnd, 'gnd'),
      ]),
      makeWireFromWorldPoints(
        'w_prc_6',
        [termPos(cap, 'out'), { x: 610, y: 294 }, { x: 610, y: 405 }],
        inkColor,
        715,
        {
          startBinding: { elementId: cap.id, terminalId: 'out', anchor: { x: 1, y: 0.5 } },
        }
      ),
      makeWireFromWorldPoints(
        'w_prc_7',
        [termPos(vm, 'neg'), { x: 755, y: 294 }],
        inkColor,
        716,
        {
          startBinding: { elementId: vm.id, terminalId: 'neg', anchor: { x: 1, y: 0.5 } },
        }
      ),
      connectWire('w_prc_8', src, 'neg', gnd, 'gnd', inkColor, 717),
    ];
  }

  if (preset === 'series-rl') {
    // 12V DC -> 100Ω -> 100mH Inductor -> Ammeter -> GND (tau = 1ms)
    const src: WhiteboardElement = {
      ...base,
      id: 'rl_src',
      type: 'circuit',
      circuitKind: 'dc-source',
      componentValue: '12V',
      x: 130,
      y: 230,
      width: 68,
      height: 110,
      seed: 801,
    };
    const gnd: WhiteboardElement = {
      ...base,
      id: 'rl_gnd',
      type: 'circuit',
      circuitKind: 'ground',
      componentValue: 'GND',
      x: 136,
      y: 410,
      width: 56,
      height: 60,
      seed: 802,
    };
    const r1: WhiteboardElement = {
      ...base,
      id: 'rl_r1',
      type: 'circuit',
      circuitKind: 'resistor',
      componentValue: '100Ω',
      x: 250,
      y: 156,
      width: 120,
      height: 48,
      seed: 803,
    };
    const l1: WhiteboardElement = {
      ...base,
      id: 'rl_l1',
      type: 'circuit',
      circuitKind: 'inductor',
      componentValue: '100mH',
      x: 425,
      y: 156,
      width: 128,
      height: 48,
      seed: 804,
    };
    const amm: WhiteboardElement = {
      ...base,
      id: 'rl_amm',
      type: 'circuit',
      circuitKind: 'ammeter',
      componentValue: 'Il(t)',
      x: 610,
      y: 138,
      width: 84,
      height: 84,
      seed: 805,
    };
    const vm: WhiteboardElement = {
      ...base,
      id: 'rl_vm',
      type: 'circuit',
      circuitKind: 'voltmeter',
      componentValue: 'VL(t)',
      x: 447,
      y: 280,
      width: 84,
      height: 84,
      seed: 806,
    };

    return [
      src,
      gnd,
      r1,
      l1,
      amm,
      vm,
      connectWire('w_rl_1', src, 'pos', r1, 'in', inkColor, 810),
      connectWire('w_rl_2', r1, 'out', l1, 'in', inkColor, 811),
      connectWire('w_rl_3', l1, 'out', amm, 'in', inkColor, 812),
      makeWireFromWorldPoints(
        'w_rl_4',
        [{ x: 398, y: 180 }, { x: 398, y: 322 }, termPos(vm, 'pos')],
        inkColor,
        813,
        {
          endBinding: { elementId: vm.id, terminalId: 'pos', anchor: { x: 0, y: 0.5 } },
        }
      ),
      makeWireFromWorldPoints(
        'w_rl_5',
        [termPos(vm, 'neg'), { x: 582, y: 322 }, { x: 582, y: 180 }],
        inkColor,
        814,
        {
          startBinding: { elementId: vm.id, terminalId: 'neg', anchor: { x: 1, y: 0.5 } },
        }
      ),
      connectWire('w_rl_6', amm, 'out', gnd, 'gnd', inkColor, 815, [
        termPos(amm, 'out'),
        { x: 730, y: 180 },
        { x: 730, y: 392 },
        { x: 164, y: 392 },
        termPos(gnd, 'gnd'),
      ]),
      connectWire('w_rl_7', src, 'neg', gnd, 'gnd', inkColor, 816),
    ];
  }

  if (preset === 'dc-rlc') {
    // 10V DC -> Ammeter -> 25Ω -> 100mH -> 10uF -> GND (ω₀ = 1000 rad/s, f₀ = 159.2 Hz, ζ = 0.125 underdamped)
    const src: WhiteboardElement = {
      ...base,
      id: 'drlc_src',
      type: 'circuit',
      circuitKind: 'dc-source',
      componentValue: '10V',
      x: 120,
      y: 230,
      width: 74,
      height: 110,
      seed: 1001,
    };
    const gnd: WhiteboardElement = {
      ...base,
      id: 'drlc_gnd',
      type: 'circuit',
      circuitKind: 'ground',
      componentValue: 'GND',
      x: 129,
      y: 405,
      width: 56,
      height: 60,
      seed: 1002,
    };
    const amm: WhiteboardElement = {
      ...base,
      id: 'drlc_amm',
      type: 'circuit',
      circuitKind: 'ammeter',
      componentValue: 'i(t)',
      x: 245,
      y: 138,
      width: 84,
      height: 84,
      seed: 1003,
    };
    const r1: WhiteboardElement = {
      ...base,
      id: 'drlc_r1',
      type: 'circuit',
      circuitKind: 'resistor',
      componentValue: '25Ω',
      x: 375,
      y: 156,
      width: 120,
      height: 48,
      seed: 1004,
    };
    const l1: WhiteboardElement = {
      ...base,
      id: 'drlc_l1',
      type: 'circuit',
      circuitKind: 'inductor',
      componentValue: '100mH',
      x: 540,
      y: 156,
      width: 128,
      height: 48,
      seed: 1005,
    };
    const c1: WhiteboardElement = {
      ...base,
      id: 'drlc_c1',
      type: 'circuit',
      circuitKind: 'capacitor',
      componentValue: '10uF',
      x: 715,
      y: 146,
      width: 88,
      height: 68,
      seed: 1006,
    };
    const vm: WhiteboardElement = {
      ...base,
      id: 'drlc_vm',
      type: 'circuit',
      circuitKind: 'voltmeter',
      componentValue: 'Vc(t)',
      x: 717,
      y: 274,
      width: 84,
      height: 84,
      seed: 1007,
    };

    return [
      src,
      gnd,
      amm,
      r1,
      l1,
      c1,
      vm,
      connectWire('w_drlc_1', src, 'pos', amm, 'in', inkColor, 1010),
      connectWire('w_drlc_2', amm, 'out', r1, 'in', inkColor, 1011),
      connectWire('w_drlc_3', r1, 'out', l1, 'in', inkColor, 1012),
      connectWire('w_drlc_4', l1, 'out', c1, 'in', inkColor, 1013),
      makeWireFromWorldPoints(
        'w_drlc_5',
        [{ x: 691, y: 180 }, { x: 691, y: 316 }, termPos(vm, 'pos')],
        inkColor,
        1014,
        {
          endBinding: { elementId: vm.id, terminalId: 'pos', anchor: { x: 0, y: 0.5 } },
        }
      ),
      makeWireFromWorldPoints(
        'w_drlc_6',
        [termPos(vm, 'neg'), { x: 835, y: 316 }],
        inkColor,
        1015,
        {
          startBinding: { elementId: vm.id, terminalId: 'neg', anchor: { x: 1, y: 0.5 } },
        }
      ),
      connectWire('w_drlc_7', c1, 'out', gnd, 'gnd', inkColor, 1016, [
        termPos(c1, 'out'),
        { x: 835, y: 180 },
        { x: 835, y: 392 },
        { x: 157, y: 392 },
        termPos(gnd, 'gnd'),
      ]),
      connectWire('w_drlc_8', src, 'neg', gnd, 'gnd', inkColor, 1017),
    ];
  }

  if (preset === 'parallel-rl') {
    // 12V DC -> 100Ω feed -> Parallel (100Ω Load || 100mH Inductor) -> GND (R_th = 50Ω, tau = 2ms)
    const src: WhiteboardElement = {
      ...base,
      id: 'prl_src',
      type: 'circuit',
      circuitKind: 'dc-source',
      componentValue: '12V',
      x: 130,
      y: 230,
      width: 68,
      height: 110,
      seed: 901,
    };
    const gnd: WhiteboardElement = {
      ...base,
      id: 'prl_gnd',
      type: 'circuit',
      circuitKind: 'ground',
      componentValue: 'GND',
      x: 136,
      y: 420,
      width: 56,
      height: 60,
      seed: 902,
    };
    const rFeed: WhiteboardElement = {
      ...base,
      id: 'prl_r1',
      type: 'circuit',
      circuitKind: 'resistor',
      componentValue: '100Ω',
      x: 250,
      y: 156,
      width: 120,
      height: 48,
      seed: 903,
    };
    const rLoad: WhiteboardElement = {
      ...base,
      id: 'prl_r2',
      type: 'circuit',
      circuitKind: 'resistor',
      componentValue: '100Ω',
      x: 470,
      y: 156,
      width: 120,
      height: 48,
      seed: 904,
    };
    const ind: WhiteboardElement = {
      ...base,
      id: 'prl_l1',
      type: 'circuit',
      circuitKind: 'inductor',
      componentValue: '100mH',
      x: 466,
      y: 270,
      width: 128,
      height: 48,
      seed: 905,
    };
    const vm: WhiteboardElement = {
      ...base,
      id: 'prl_vm',
      type: 'circuit',
      circuitKind: 'voltmeter',
      componentValue: 'Vp(t)',
      x: 645,
      y: 252,
      width: 84,
      height: 84,
      seed: 906,
    };

    return [
      src,
      gnd,
      rFeed,
      rLoad,
      ind,
      vm,
      connectWire('w_prl_1', src, 'pos', rFeed, 'in', inkColor, 910),
      connectWire('w_prl_2', rFeed, 'out', rLoad, 'in', inkColor, 911),
      makeWireFromWorldPoints(
        'w_prl_3',
        [{ x: 420, y: 180 }, { x: 420, y: 294 }, termPos(ind, 'in')],
        inkColor,
        912,
        {
          endBinding: { elementId: ind.id, terminalId: 'in', anchor: { x: 0, y: 0.5 } },
        }
      ),
      makeWireFromWorldPoints(
        'w_prl_4',
        [{ x: 420, y: 294 }, { x: 420, y: 365 }, { x: 625, y: 365 }, { x: 625, y: 294 }, termPos(vm, 'pos')],
        inkColor,
        913,
        {
          endBinding: { elementId: vm.id, terminalId: 'pos', anchor: { x: 0, y: 0.5 } },
        }
      ),
      connectWire('w_prl_5', rLoad, 'out', gnd, 'gnd', inkColor, 914, [
        termPos(rLoad, 'out'),
        { x: 755, y: 180 },
        { x: 755, y: 405 },
        { x: 164, y: 405 },
        termPos(gnd, 'gnd'),
      ]),
      makeWireFromWorldPoints(
        'w_prl_6',
        [termPos(ind, 'out'), { x: 610, y: 294 }, { x: 610, y: 405 }],
        inkColor,
        915,
        {
          startBinding: { elementId: ind.id, terminalId: 'out', anchor: { x: 1, y: 0.5 } },
        }
      ),
      makeWireFromWorldPoints(
        'w_prl_7',
        [termPos(vm, 'neg'), { x: 755, y: 294 }],
        inkColor,
        916,
        {
          startBinding: { elementId: vm.id, terminalId: 'neg', anchor: { x: 1, y: 0.5 } },
        }
      ),
      connectWire('w_prl_8', src, 'neg', gnd, 'gnd', inkColor, 917),
    ];
  }

  if (preset === 'dc-meters') {
    const src: WhiteboardElement = {
      ...base,
      id: 'sim_dc_src',
      type: 'circuit',
      circuitKind: 'dc-source',
      componentValue: '12V',
      x: 150,
      y: 230,
      width: 68,
      height: 110,
      seed: 301,
    };
    const gnd: WhiteboardElement = {
      ...base,
      id: 'sim_dc_gnd',
      type: 'circuit',
      circuitKind: 'ground',
      componentValue: 'GND',
      x: 156,
      y: 405,
      width: 56,
      height: 60,
      seed: 302,
    };
    const ammeter: WhiteboardElement = {
      ...base,
      id: 'sim_dc_amm',
      type: 'circuit',
      circuitKind: 'ammeter',
      componentValue: 'I_loop',
      x: 270,
      y: 138,
      width: 84,
      height: 84,
      seed: 303,
    };
    const r1: WhiteboardElement = {
      ...base,
      id: 'sim_dc_r1',
      type: 'circuit',
      circuitKind: 'resistor',
      componentValue: '1kΩ',
      x: 410,
      y: 156,
      width: 120,
      height: 48,
      seed: 304,
    };
    const r2: WhiteboardElement = {
      ...base,
      id: 'sim_dc_r2',
      type: 'circuit',
      circuitKind: 'resistor',
      componentValue: '2kΩ',
      x: 590,
      y: 156,
      width: 120,
      height: 48,
      seed: 305,
    };
    const voltmeter: WhiteboardElement = {
      ...base,
      id: 'sim_dc_vm',
      type: 'circuit',
      circuitKind: 'voltmeter',
      componentValue: 'V_load',
      x: 608,
      y: 276,
      width: 84,
      height: 84,
      seed: 306,
    };

    return [
      src,
      gnd,
      ammeter,
      r1,
      r2,
      voltmeter,
      connectWire('w_dc_1', src, 'pos', ammeter, 'in', inkColor, 310),
      connectWire('w_dc_2', ammeter, 'out', r1, 'in', inkColor, 311),
      connectWire('w_dc_3', r1, 'out', r2, 'in', inkColor, 312),
      makeWireFromWorldPoints(
        'w_dc_4',
        [{ x: 560, y: 180 }, { x: 560, y: 318 }, termPos(voltmeter, 'pos')],
        inkColor,
        313,
        {
          endBinding: { elementId: voltmeter.id, terminalId: 'pos', anchor: { x: 0, y: 0.5 } },
        }
      ),
      connectWire('w_dc_5', r2, 'out', gnd, 'gnd', inkColor, 314, [
        termPos(r2, 'out'),
        { x: 745, y: 180 },
        { x: 745, y: 390 },
        { x: 184, y: 390 },
        termPos(gnd, 'gnd'),
      ]),
      makeWireFromWorldPoints(
        'w_dc_6',
        [termPos(voltmeter, 'neg'), { x: 745, y: 318 }],
        inkColor,
        315,
        {
          startBinding: { elementId: voltmeter.id, terminalId: 'neg', anchor: { x: 1, y: 0.5 } },
        }
      ),
      connectWire('w_dc_7', src, 'neg', gnd, 'gnd', inkColor, 316),
    ];
  }

  if (preset === 'ac-rlc') {
    const src: WhiteboardElement = {
      ...base,
      id: 'sim_ac_src',
      type: 'circuit',
      circuitKind: 'ac-source',
      componentValue: '10V',
      frequencyHz: 60,
      x: 115,
      y: 230,
      width: 74,
      height: 110,
      seed: 401,
    };
    const gnd: WhiteboardElement = {
      ...base,
      id: 'sim_ac_gnd',
      type: 'circuit',
      circuitKind: 'ground',
      componentValue: 'GND',
      x: 124,
      y: 410,
      width: 56,
      height: 60,
      seed: 402,
    };
    const ammeter: WhiteboardElement = {
      ...base,
      id: 'sim_ac_amm',
      type: 'circuit',
      circuitKind: 'ammeter',
      componentValue: 'I_ac',
      x: 225,
      y: 138,
      width: 84,
      height: 84,
      seed: 407,
    };
    const r: WhiteboardElement = {
      ...base,
      id: 'sim_ac_r',
      type: 'circuit',
      circuitKind: 'resistor',
      componentValue: '100Ω',
      x: 345,
      y: 156,
      width: 120,
      height: 48,
      seed: 403,
    };
    const l: WhiteboardElement = {
      ...base,
      id: 'sim_ac_l',
      type: 'circuit',
      circuitKind: 'inductor',
      componentValue: '250mH',
      x: 500,
      y: 156,
      width: 128,
      height: 48,
      seed: 404,
    };
    const c: WhiteboardElement = {
      ...base,
      id: 'sim_ac_c',
      type: 'circuit',
      circuitKind: 'capacitor',
      componentValue: '47uF',
      x: 665,
      y: 152,
      width: 100,
      height: 56,
      seed: 405,
    };
    const scope: WhiteboardElement = {
      ...base,
      id: 'sim_ac_scope',
      type: 'circuit',
      circuitKind: 'oscilloscope',
      componentValue: 'CH1_LC',
      x: 565,
      y: 280,
      width: 104,
      height: 76,
      seed: 406,
    };

    return [
      src,
      gnd,
      ammeter,
      r,
      l,
      c,
      scope,
      connectWire('w_ac_1', src, 'pos', ammeter, 'in', inkColor, 410),
      connectWire('w_ac_2', ammeter, 'out', r, 'in', inkColor, 411),
      connectWire('w_ac_3', r, 'out', l, 'in', inkColor, 412),
      connectWire('w_ac_4', l, 'out', c, 'in', inkColor, 413),
      makeWireFromWorldPoints(
        'w_ac_5',
        [{ x: 482, y: 180 }, { x: 482, y: 318 }, termPos(scope, 'pos')],
        inkColor,
        414,
        {
          endBinding: { elementId: scope.id, terminalId: 'pos', anchor: { x: 0, y: 0.5 } },
        }
      ),
      makeWireFromWorldPoints(
        'w_ac_6',
        [termPos(scope, 'neg'), { x: 795, y: 318 }],
        inkColor,
        415,
        {
          startBinding: { elementId: scope.id, terminalId: 'neg', anchor: { x: 1, y: 0.5 } },
        }
      ),
      connectWire('w_ac_7', c, 'out', gnd, 'gnd', inkColor, 416, [
        termPos(c, 'out'),
        { x: 795, y: 180 },
        { x: 795, y: 392 },
        { x: 152, y: 392 },
        termPos(gnd, 'gnd'),
      ]),
      connectWire('w_ac_8', src, 'neg', gnd, 'gnd', inkColor, 417),
    ];
  }

  // diode-rectifier
  const src: WhiteboardElement = {
    ...base,
    id: 'sim_di_src',
    type: 'circuit',
    circuitKind: 'ac-source',
    componentValue: '10V',
    frequencyHz: 60,
    x: 150,
    y: 230,
    width: 74,
    height: 110,
    seed: 501,
  };
  const gnd: WhiteboardElement = {
    ...base,
    id: 'sim_di_gnd',
    type: 'circuit',
    circuitKind: 'ground',
    componentValue: 'GND',
    x: 159,
    y: 405,
    width: 56,
    height: 60,
    seed: 502,
  };
  const diode: WhiteboardElement = {
    ...base,
    id: 'sim_di_d1',
    type: 'circuit',
    circuitKind: 'diode',
    componentValue: '1N4148',
    x: 295,
    y: 154,
    width: 104,
    height: 52,
    seed: 503,
  };
  const loadR: WhiteboardElement = {
    ...base,
    id: 'sim_di_r1',
    type: 'circuit',
    circuitKind: 'resistor',
    componentValue: '1kΩ',
    x: 470,
    y: 156,
    width: 120,
    height: 48,
    seed: 504,
  };
  const scope: WhiteboardElement = {
    ...base,
    id: 'sim_di_scope',
    type: 'circuit',
    circuitKind: 'oscilloscope',
    componentValue: 'V_rect',
    x: 478,
    y: 278,
    width: 104,
    height: 76,
    seed: 505,
  };

  return [
    src,
    gnd,
    diode,
    loadR,
    scope,
    connectWire('w_di_1', src, 'pos', diode, 'in', inkColor, 510),
    connectWire('w_di_2', diode, 'out', loadR, 'in', inkColor, 511),
    makeWireFromWorldPoints(
      'w_di_3',
      [{ x: 435, y: 180 }, { x: 435, y: 316 }, termPos(scope, 'pos')],
      inkColor,
      512,
      {
        endBinding: { elementId: scope.id, terminalId: 'pos', anchor: { x: 0, y: 0.5 } },
      }
    ),
    connectWire('w_di_4', loadR, 'out', gnd, 'gnd', inkColor, 513, [
      termPos(loadR, 'out'),
      { x: 635, y: 180 },
      { x: 635, y: 390 },
      { x: 187, y: 390 },
      termPos(gnd, 'gnd'),
    ]),
    makeWireFromWorldPoints(
      'w_di_5',
      [termPos(scope, 'neg'), { x: 635, y: 316 }],
      inkColor,
      514,
      {
        startBinding: { elementId: scope.id, terminalId: 'neg', anchor: { x: 1, y: 0.5 } },
      }
    ),
    connectWire('w_di_6', src, 'neg', gnd, 'gnd', inkColor, 515),
  ];
}
