import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateDigitalCircuit,
  isBinaryLogicInput,
  isLetterLogicInput,
  normalizeLogicInputToken,
} from '../digitalLogic';
import { CircuitKind, WhiteboardElement } from '../types';

function makeGate(
  id: string,
  kind: CircuitKind,
  x: number,
  y: number,
  logicInputA?: string,
  logicInputB?: string
): WhiteboardElement {
  return {
    id,
    type: 'circuit',
    circuitKind: kind,
    componentValue: '',
    logicInputA,
    logicInputB,
    x,
    y,
    width: 96,
    height: 60,
    angle: 0,
    strokeColor: '#e2e8f0',
    backgroundColor: 'transparent',
    fillStyle: 'none',
    strokeWidth: 2,
    strokeStyle: 'solid',
    sloppiness: 0,
    opacity: 100,
    seed: 1,
    fontFamily: 'cleansans',
    fontSize: 16,
    version: 1,
    updatedAt: 0,
  };
}

function makeWire(id: string, p1: { x: number; y: number }, p2: { x: number; y: number }): WhiteboardElement {
  return {
    id,
    type: 'wire',
    wireRouting: 'straight',
    x: p1.x,
    y: p1.y,
    width: Math.max(1, Math.abs(p2.x - p1.x)),
    height: Math.max(1, Math.abs(p2.y - p1.y)),
    points: [
      { x: 0, y: 0 },
      { x: p2.x - p1.x, y: p2.y - p1.y },
    ],
    angle: 0,
    strokeColor: '#e2e8f0',
    backgroundColor: 'transparent',
    fillStyle: 'none',
    strokeWidth: 2,
    strokeStyle: 'solid',
    sloppiness: 0,
    opacity: 100,
    seed: 2,
    fontFamily: 'cleansans',
    fontSize: 14,
    version: 1,
    updatedAt: 0,
  };
}

test('normalizeLogicInputToken and input validators distinguish binary 0/1 and letters A-Z', () => {
  assert.equal(normalizeLogicInputToken('0'), '0');
  assert.equal(normalizeLogicInputToken('1'), '1');
  assert.equal(normalizeLogicInputToken('a'), 'A');
  assert.equal(normalizeLogicInputToken('d '), 'D');
  assert.equal(isBinaryLogicInput('1'), true);
  assert.equal(isBinaryLogicInput('99'), false);
  assert.equal(isLetterLogicInput('A'), true);
  assert.equal(isLetterLogicInput('99'), false);
});

test('evaluateDigitalCircuit computes Binary 0/1 outputs across wired gate cascade and SPST switch', () => {
  // gate1 (AND) at (100, 100): A=1, B=1 => Y=1; out=(196, 130)
  // switch at (220, 102): w=88, h=56 => in=(220, 130), out=(308, 130)
  // gate2 (NOT) at (340, 100): in=(340, 130), out=(436, 130)
  const g1 = makeGate('g_and', 'gate-and', 100, 100, '1', '1');
  const sw: WhiteboardElement = {
    ...makeGate('sw_1', 'switch', 220, 102),
    width: 88,
    height: 56,
    switchClosed: true,
    componentValue: 'CLOSED',
  };
  const g2 = makeGate('g_not', 'gate-not', 340, 100, '0');

  const wiredClosed = [
    g1,
    sw,
    g2,
    makeWire('w1', { x: 196, y: 130 }, { x: 220, y: 130 }),
    makeWire('w2', { x: 308, y: 130 }, { x: 340, y: 130 }),
  ];

  const reportClosed = evaluateDigitalCircuit(wiredClosed);
  assert.equal(reportClosed.valid, true);
  assert.equal(reportClosed.mode, 'binary');
  assert.equal(reportClosed.gateMap['g_and'].outputBinary, 1);
  assert.ok(reportClosed.gateMap['g_not'].inputAWiredFrom);
  assert.equal(reportClosed.gateMap['g_not'].outputBinary, 0); // NOT(1) = 0

  // Open switch breaks wired conduction so gate2 falls back to its local pin value ('0') -> NOT(0) = 1
  const wiredOpen = wiredClosed.map((el) =>
    el.id === 'sw_1' ? { ...el, switchClosed: false, componentValue: 'OPEN' } : el
  );
  const reportOpen = evaluateDigitalCircuit(wiredOpen);
  assert.equal(reportOpen.valid, true);
  assert.equal(reportOpen.gateMap['g_not'].inputAWiredFrom, undefined);
  assert.equal(reportOpen.gateMap['g_not'].outputBinary, 1);
});

test('evaluateDigitalCircuit computes symbolic Boolean expression and 2^n truth table for letter inputs', () => {
  // gate1 (AND): A, B -> out=(196, 130)
  // gate2 (OR) at (260, 118): inA=(260, 136), inB=(260, 160); wire gate1 out to gate2 inA and set inB='C'
  const g1 = makeGate('g1', 'gate-and', 100, 100, 'A', 'B');
  const g2 = makeGate('g2', 'gate-or', 260, 118, 'A', 'C');
  const w = makeWire('w1', { x: 196, y: 130 }, { x: 260, y: 136 });

  const report = evaluateDigitalCircuit([g1, g2, w]);
  assert.equal(report.valid, true);
  assert.equal(report.mode, 'symbolic');
  assert.deepEqual(report.variables, ['A', 'B', 'C']);
  assert.equal(report.gateMap['g1'].outputExpr, 'A · B');
  assert.equal(report.gateMap['g2'].outputExpr, 'A · B + C');
  assert.equal(report.truthTable.length, 8); // 2^3 = 8 combinations

  // Verify row A=0, B=1, C=0 -> g1=0, g2=0
  const row010 = report.truthTable.find(
    (r) => r.inputs.A === 0 && r.inputs.B === 1 && r.inputs.C === 0
  )!;
  assert.equal(row010.outputs['g1'], 0);
  assert.equal(row010.outputs['g2'], 0);

  // Verify row A=1, B=1, C=0 -> g1=1, g2=1
  const row110 = report.truthTable.find(
    (r) => r.inputs.A === 1 && r.inputs.B === 1 && r.inputs.C === 0
  )!;
  assert.equal(row110.outputs['g1'], 1);
  assert.equal(row110.outputs['g2'], 1);
});

test('evaluateDigitalCircuit enforces all-letters rule when any gate input uses a letter', () => {
  const g1 = makeGate('g1', 'gate-and', 100, 100, 'A', '1');
  const g2 = makeGate('g2', 'gate-xor', 300, 100, '0', 'B');

  const report = evaluateDigitalCircuit([g1, g2]);
  assert.equal(report.valid, false);
  assert.equal(report.mode, 'symbolic');
  assert.ok(report.validationError);
  assert.ok(report.invalidSlots.some((s) => s.elementId === 'g1' && s.pin === 'B'));
  assert.ok(report.invalidSlots.some((s) => s.elementId === 'g2' && s.pin === 'A'));
});
