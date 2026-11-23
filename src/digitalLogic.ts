import { CircuitKind, Point, WhiteboardElement } from './types';
import { getCircuitTerminals } from './engineeringComponents';
import { getAnchorWorldPosition, pointToSegmentDistance } from './sketchEngine';

export type LogicMode = 'binary' | 'symbolic';

export type LogicExprNode =
  | { kind: 'const'; value: 0 | 1 }
  | { kind: 'var'; name: string }
  | { kind: 'not'; child: LogicExprNode }
  | { kind: 'binary'; op: 'AND' | 'OR' | 'NAND' | 'XOR'; left: LogicExprNode; right: LogicExprNode };

export interface GateLogicEvaluation {
  elementId: string;
  kind: CircuitKind;
  gateLabel: string;
  inputALabel: string;
  inputBLabel?: string;
  inputAWiredFrom?: string;
  inputBWiredFrom?: string;
  isSingleInput: boolean;
  outputExpr: string;
  outputBinary: 0 | 1 | null;
  ast: LogicExprNode;
}

export interface TruthTableRow {
  inputs: Record<string, 0 | 1>;
  outputs: Record<string, 0 | 1>;
}

export interface DigitalCircuitReport {
  mode: LogicMode;
  valid: boolean;
  validationError: string | null;
  invalidSlots: { elementId: string; pin: 'A' | 'B'; value: string }[];
  variables: string[];
  gates: GateLogicEvaluation[];
  gateMap: Record<string, GateLogicEvaluation>;
  truthTable: TruthTableRow[];
}

export function isLogicGateKind(kind: CircuitKind | undefined): boolean {
  return (
    kind === 'gate-and' ||
    kind === 'gate-or' ||
    kind === 'gate-not' ||
    kind === 'gate-nand' ||
    kind === 'gate-xor'
  );
}

export function isBinaryLogicInput(raw: string | undefined): boolean {
  const s = (raw ?? '').trim();
  return s === '0' || s === '1';
}

export function isLetterLogicInput(raw: string | undefined): boolean {
  const s = (raw ?? '').trim();
  return /^[A-Za-z][A-Za-z0-9']*$/.test(s);
}

export function normalizeLogicInputToken(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '0';
  if (trimmed === '0' || trimmed === '1') return trimmed;
  if (/^[A-Za-z]/.test(trimmed)) {
    return trimmed[0].toUpperCase() + trimmed.slice(1);
  }
  return trimmed;
}

export function formatLogicExpr(node: LogicExprNode, parentOp?: string): string {
  switch (node.kind) {
    case 'const':
      return String(node.value);
    case 'var':
      return node.name;
    case 'not': {
      if (node.child.kind === 'var' || node.child.kind === 'const') {
        return `${formatLogicExpr(node.child)}'`;
      }
      if (node.child.kind === 'not') {
        return formatLogicExpr(node.child.child, parentOp);
      }
      return `(${formatLogicExpr(node.child)})'`;
    }
    case 'binary': {
      if (node.op === 'NAND') {
        const inner = `${formatLogicExpr(node.left, 'AND')} · ${formatLogicExpr(node.right, 'AND')}`;
        return `(${inner})'`;
      }
      const sym = node.op === 'AND' ? '·' : node.op === 'OR' ? '+' : '⊕';
      const leftStr = formatLogicExpr(node.left, node.op);
      const rightStr = formatLogicExpr(node.right, node.op);
      const combined = `${leftStr} ${sym} ${rightStr}`;
      if (parentOp === 'AND' && (node.op === 'OR' || node.op === 'XOR')) {
        return `(${combined})`;
      }
      if (parentOp === 'XOR' && node.op === 'OR') {
        return `(${combined})`;
      }
      return combined;
    }
  }
}

export function evalLogicAst(node: LogicExprNode, env: Record<string, 0 | 1>): 0 | 1 {
  switch (node.kind) {
    case 'const':
      return node.value;
    case 'var':
      return env[node.name] ? 1 : 0;
    case 'not':
      return evalLogicAst(node.child, env) ? 0 : 1;
    case 'binary': {
      const l = evalLogicAst(node.left, env);
      const r = evalLogicAst(node.right, env);
      if (node.op === 'AND') return l & r ? 1 : 0;
      if (node.op === 'OR') return l | r ? 1 : 0;
      if (node.op === 'NAND') return l & r ? 0 : 1;
      return l ^ r ? 1 : 0;
    }
  }
}

function collectAstVars(node: LogicExprNode, vars: Set<string>) {
  if (node.kind === 'var') {
    vars.add(node.name);
  } else if (node.kind === 'not') {
    collectAstVars(node.child, vars);
  } else if (node.kind === 'binary') {
    collectAstVars(node.left, vars);
    collectAstVars(node.right, vars);
  }
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

function shortGateKindName(kind: CircuitKind | undefined, idx: number): string {
  switch (kind) {
    case 'gate-and':
      return `AND${idx}`;
    case 'gate-or':
      return `OR${idx}`;
    case 'gate-not':
      return `NOT${idx}`;
    case 'gate-nand':
      return `NAND${idx}`;
    case 'gate-xor':
      return `XOR${idx}`;
    default:
      return `G${idx}`;
  }
}

export function evaluateDigitalCircuit(elements: WhiteboardElement[]): DigitalCircuitReport {
  const active = elements.filter((e) => !e.isDeleted);
  const gates = active.filter((e) => e.type === 'circuit' && isLogicGateKind(e.circuitKind));
  if (gates.length === 0) {
    return {
      mode: 'binary',
      valid: true,
      validationError: null,
      invalidSlots: [],
      variables: [],
      gates: [],
      gateMap: {},
      truthTable: [],
    };
  }

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
    allPoints.push({ pt: worldPts[0], elementId: w.id, terminalId: 'start', kind: 'wireEnd' });
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

  // A closed switch conducts signals across its terminals; an open switch isolates them
  for (const c of circuits) {
    if (c.circuitKind === 'switch' && c.switchClosed === true) {
      const iIn = terminalIndexMap.get(`${c.id}:in`);
      const iOut = terminalIndexMap.get(`${c.id}:out`);
      if (iIn !== undefined && iOut !== undefined) {
        uf.union(iIn, iOut);
      }
    }
  }

  const boundWireEnds = new Set<number>();
  for (let i = 0; i < wires.length; i++) {
    const w = wires[i];
    const we = wireEndpoints[i];
    if (w.startBinding?.elementId && w.startBinding.terminalId) {
      const tIdx = terminalIndexMap.get(`${w.startBinding.elementId}:${w.startBinding.terminalId}`);
      if (tIdx !== undefined) {
        uf.union(we.startIdx, tIdx);
        boundWireEnds.add(we.startIdx);
      }
    }
    if (w.endBinding?.elementId && w.endBinding.terminalId) {
      const tIdx = terminalIndexMap.get(`${w.endBinding.elementId}:${w.endBinding.terminalId}`);
      if (tIdx !== undefined) {
        uf.union(we.endIdx, tIdx);
        boundWireEnds.add(we.endIdx);
      }
    }
  }

  const SNAP_RADIUS = 14;
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
      const d = Math.hypot(allPoints[i].pt.x - allPoints[j].pt.x, allPoints[i].pt.y - allPoints[j].pt.y);
      if (d <= SNAP_RADIUS) {
        uf.union(i, j);
      }
    }
  }

  for (let i = 0; i < allPoints.length; i++) {
    if (allPoints[i].kind !== 'wireEnd' || boundWireEnds.has(i)) continue;
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

  // Map output nodes from gate outputs (and active DC sources)
  const gateLabelById = new Map<string, string>();
  gates.forEach((g, idx) => gateLabelById.set(g.id, shortGateKindName(g.circuitKind, idx + 1)));

  const outputNetToGate = new Map<number, string>();
  for (const g of gates) {
    const outIdx = terminalIndexMap.get(`${g.id}:out`);
    if (outIdx !== undefined) {
      outputNetToGate.set(uf.find(outIdx), g.id);
    }
  }

  // Also detect DC voltage sources & ground driving a gate input net directly
  const dcSourceHighNets = new Set<number>();
  const groundNets = new Set<number>();
  for (const c of circuits) {
    if (c.circuitKind === 'dc-source') {
      const posIdx = terminalIndexMap.get(`${c.id}:pos`);
      if (posIdx !== undefined) dcSourceHighNets.add(uf.find(posIdx));
    } else if (c.circuitKind === 'ground') {
      const gIdx = terminalIndexMap.get(`${c.id}:gnd`);
      if (gIdx !== undefined) groundNets.add(uf.find(gIdx));
    }
  }

  const getDriverForPin = (gateId: string, terminalId: string): string | undefined => {
    const pinIdx = terminalIndexMap.get(`${gateId}:${terminalId}`);
    if (pinIdx === undefined) return undefined;
    const net = uf.find(pinIdx);
    const srcGate = outputNetToGate.get(net);
    if (srcGate && srcGate !== gateId) return srcGate;
    return undefined;
  };

  // Detect external (unwired) input values & check binary vs letter mode rule
  const externalSlots: {
    elementId: string;
    pin: 'A' | 'B';
    raw: string;
    wired: boolean;
  }[] = [];

  for (const g of gates) {
    const isNot = g.circuitKind === 'gate-not';
    const driverA = getDriverForPin(g.id, isNot ? 'in' : 'in-a');
    externalSlots.push({
      elementId: g.id,
      pin: 'A',
      raw: (g.logicInputA ?? '0').trim() || '0',
      wired: Boolean(driverA),
    });
    if (!isNot) {
      const driverB = getDriverForPin(g.id, 'in-b');
      externalSlots.push({
        elementId: g.id,
        pin: 'B',
        raw: (g.logicInputB ?? '0').trim() || '0',
        wired: Boolean(driverB),
      });
    }
  }

  const unwiredSlots = externalSlots.filter((s) => !s.wired);
  const hasAnyLetter = unwiredSlots.some((s) => isLetterLogicInput(s.raw));
  const mode: LogicMode = hasAnyLetter ? 'symbolic' : 'binary';

  const invalidSlots: { elementId: string; pin: 'A' | 'B'; value: string }[] = [];
  if (mode === 'symbolic') {
    for (const s of unwiredSlots) {
      if (!isLetterLogicInput(s.raw)) {
        invalidSlots.push({ elementId: s.elementId, pin: s.pin, value: s.raw });
      }
    }
  } else {
    for (const s of unwiredSlots) {
      if (!isBinaryLogicInput(s.raw)) {
        invalidSlots.push({ elementId: s.elementId, pin: s.pin, value: s.raw });
      }
    }
  }

  const valid = invalidSlots.length === 0;
  const validationError = !valid
    ? mode === 'symbolic'
      ? 'Letter input mode active: all following gate inputs must be letters (e.g. A, B, C, D).'
      : 'Binary mode expects 0 or 1 inputs.'
    : null;

  const gateById = new Map(gates.map((g) => [g.id, g]));
  const memo = new Map<string, LogicExprNode>();
  const visiting = new Set<string>();

  const buildInputNode = (
    gate: WhiteboardElement,
    pinId: 'in' | 'in-a' | 'in-b',
    explicitRaw: string | undefined
  ): { node: LogicExprNode; label: string; wiredFrom?: string } => {
    const driverGateId = getDriverForPin(gate.id, pinId);
    if (driverGateId && !visiting.has(driverGateId)) {
      const upstreamNode = buildGateAst(driverGateId);
      const upstreamLabel = formatLogicExpr(upstreamNode);
      return {
        node: upstreamNode,
        label: upstreamLabel,
        wiredFrom: gateLabelById.get(driverGateId),
      };
    }

    // Check if wired to DC source / ground in binary mode
    const pinIdx = terminalIndexMap.get(`${gate.id}:${pinId}`);
    if (pinIdx !== undefined) {
      const net = uf.find(pinIdx);
      if (mode === 'binary') {
        if (dcSourceHighNets.has(net) && !explicitRaw) {
          return { node: { kind: 'const', value: 1 }, label: '1' };
        }
        if (groundNets.has(net) && !explicitRaw) {
          return { node: { kind: 'const', value: 0 }, label: '0' };
        }
      }
    }

    const tok = normalizeLogicInputToken(explicitRaw ?? '0');
    if (isLetterLogicInput(tok)) {
      return { node: { kind: 'var', name: tok }, label: tok };
    }
    const bit: 0 | 1 = tok === '1' ? 1 : 0;
    return { node: { kind: 'const', value: bit }, label: String(bit) };
  };

  const buildGateAst = (gateId: string): LogicExprNode => {
    const cached = memo.get(gateId);
    if (cached) return cached;
    const gate = gateById.get(gateId);
    if (!gate) return { kind: 'const', value: 0 };

    visiting.add(gateId);
    let node: LogicExprNode;
    if (gate.circuitKind === 'gate-not') {
      const a = buildInputNode(gate, 'in', gate.logicInputA);
      node = { kind: 'not', child: a.node };
    } else {
      const a = buildInputNode(gate, 'in-a', gate.logicInputA);
      const b = buildInputNode(gate, 'in-b', gate.logicInputB);
      const op =
        gate.circuitKind === 'gate-or'
          ? 'OR'
          : gate.circuitKind === 'gate-nand'
          ? 'NAND'
          : gate.circuitKind === 'gate-xor'
          ? 'XOR'
          : 'AND';
      node = { kind: 'binary', op, left: a.node, right: b.node };
    }
    visiting.delete(gateId);
    memo.set(gateId, node);
    return node;
  };

  const evaluations: GateLogicEvaluation[] = [];
  const gateMap: Record<string, GateLogicEvaluation> = {};
  const varSet = new Set<string>();

  for (const g of gates) {
    const ast = buildGateAst(g.id);
    collectAstVars(ast, varSet);
    const isNot = g.circuitKind === 'gate-not';
    const inA = buildInputNode(g, isNot ? 'in' : 'in-a', g.logicInputA);
    const inB = isNot ? null : buildInputNode(g, 'in-b', g.logicInputB);
    const outputExpr = formatLogicExpr(ast);
    const outputBinary =
      mode === 'binary' && valid ? evalLogicAst(ast, {}) : null;

    const evalItem: GateLogicEvaluation = {
      elementId: g.id,
      kind: g.circuitKind!,
      gateLabel: gateLabelById.get(g.id) || 'GATE',
      inputALabel: inA.label,
      inputBLabel: inB?.label,
      inputAWiredFrom: inA.wiredFrom,
      inputBWiredFrom: inB?.wiredFrom,
      isSingleInput: isNot,
      outputExpr,
      outputBinary,
      ast,
    };
    evaluations.push(evalItem);
    gateMap[g.id] = evalItem;
  }

  const variables = Array.from(varSet).sort();
  const truthTable: TruthTableRow[] = [];
  if (mode === 'symbolic' && valid && variables.length > 0 && variables.length <= 5) {
    const rows = 1 << variables.length;
    for (let mask = 0; mask < rows; mask++) {
      const env: Record<string, 0 | 1> = {};
      variables.forEach((v, idx) => {
        const bitPos = variables.length - 1 - idx;
        env[v] = ((mask >> bitPos) & 1) as 0 | 1;
      });
      const outputs: Record<string, 0 | 1> = {};
      for (const ge of evaluations) {
        outputs[ge.elementId] = evalLogicAst(ge.ast, env);
      }
      truthTable.push({ inputs: env, outputs });
    }
  }

  return {
    mode,
    valid,
    validationError,
    invalidSlots,
    variables,
    gates: evaluations,
    gateMap,
    truthTable,
  };
}
