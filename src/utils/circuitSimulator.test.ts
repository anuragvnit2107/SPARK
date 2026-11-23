import test from 'node:test';
import assert from 'node:assert/strict';
import { createSimStarterCircuit } from '../circuitPreset';
import { buildCircuitGeometry, CIRCUIT_CATALOG } from '../engineeringComponents';
import { getSimulatedWireColor } from '../canvasRenderer';
import { WhiteboardElement } from '../types';
import {
  computePhasorResultant,
  formatComponentCompactValue,
  getComponentSliderSpec,
  getCroProbeWaveform,
  normalizeComponentValueInput,
  parseEngineeringValue,
  parseFrequencyInput,
  simulateCircuit,
  Simulator,
  sliderPosToValue,
  valueToSliderPos,
} from '../circuitSimulator';

test('parseEngineeringValue parses SI prefixes and units accurately', () => {
  assert.equal(parseEngineeringValue('10kΩ', 1000), 10000);
  assert.equal(parseEngineeringValue('47uF', 1e-6), 47e-6);
  assert.equal(parseEngineeringValue('250mH', 0.1), 0.25);
  assert.equal(parseEngineeringValue('12V', 5), 12);
});

test('simulateCircuit solves DC voltage divider with ammeter and voltmeter', () => {
  // 12V source -> ammeter -> 1kΩ -> 2kΩ -> GND; voltmeter across 2kΩ
  // Total R = 3kΩ => I = 4mA; V_load = 4mA * 2kΩ = 8V
  const elements = createSimStarterCircuit('dc-meters');
  const report = simulateCircuit(elements, 60);

  assert.equal(report.ok, true);
  assert.equal(report.mode, 'dc');

  const ammeter = report.components.find((c) => c.kind === 'ammeter');
  const voltmeter = report.components.find((c) => c.kind === 'voltmeter');
  assert.ok(ammeter);
  assert.ok(voltmeter);

  assert.ok(Math.abs(Math.abs(ammeter.dcCurrent) - 0.004) < 1e-4, `Expected 4mA, got ${ammeter.dcCurrent}`);
  assert.ok(Math.abs(Math.abs(voltmeter.dcVoltage) - 8.0) < 0.05, `Expected 8V, got ${voltmeter.dcVoltage}`);
  assert.ok(report.liveReadouts[ammeter.elementId]);
  assert.ok(report.liveReadouts[voltmeter.elementId]);
  assert.ok(report.wireVoltages && Object.keys(report.wireVoltages).length > 0);
});

test('simulateCircuit solves AC series RLC impedance, phase angle, oscilloscope channels, and phasors', () => {
  // 10V peak @ 60Hz, R=100Ω, L=250mH (X_L ≈ +94.25Ω), C=47uF (X_C ≈ -56.44Ω)
  // X_net ≈ +37.81Ω, |Z| ≈ 106.91Ω
  const elements = createSimStarterCircuit('ac-rlc');
  const report = simulateCircuit(elements, 60);

  assert.equal(report.ok, true);
  assert.equal(report.mode, 'ac');
  assert.ok(report.impedanceSummary);
  assert.ok(Math.abs(report.impedanceSummary.rOhms - 100) < 1);
  assert.ok(Math.abs(report.impedanceSummary.zMagOhms - 106.9) < 2.5);
  assert.ok(report.impedanceSummary.powerFactor > 0.85 && report.impedanceSummary.powerFactor < 0.98);
  assert.ok(report.channels.length >= 2);
  assert.ok(report.phasors.length >= 3);
});

test('simulateCircuit solves nonlinear diode half-wave rectifier clipping', () => {
  const elements = createSimStarterCircuit('diode-rectifier');
  const report = simulateCircuit(elements, 60);

  assert.equal(report.ok, true);
  assert.equal(report.mode, 'transient');

  const scopeChannel = report.channels.find((ch) => ch.unit === 'V' && ch.id !== report.channels[0]?.id) || report.channels[0];
  assert.ok(scopeChannel);
  const maxSample = Math.max(...scopeChannel.samples);
  const minSample = Math.min(...scopeChannel.samples);
  assert.ok(maxSample > 7.5, `Expected positive half > 7.5V, got ${maxSample}`);
  assert.ok(minSample > -1.0, `Expected negative half clipped near 0V, got ${minSample}`);
});

test('Simulator solves Series RC transient step response matching V(1 - e^-t/RC)', () => {
  // 10V DC, R = 1kΩ, C = 10uF => tau = 10ms
  const elements = createSimStarterCircuit('series-rc');
  const sim = new Simulator(elements);
  const s0 = sim.getState();
  assert.equal(s0.ok, true);
  assert.equal(s0.mode, 'transient');
  assert.ok(s0.tauSec && Math.abs(s0.tauSec - 0.01) < 1e-4, `Expected tau=10ms, got ${s0.tauSec}`);

  const cap0 = s0.components.find((c) => c.kind === 'capacitor')!;
  assert.ok(Math.abs(cap0.vInst) < 0.05, 'Initial capacitor voltage must start at 0V');

  // Step forward to t ≈ tau (around 33 steps of 5.5*tau/180)
  const stepsToTau = Math.round(0.01 / s0.dtSec);
  const sTau = sim.step(stepsToTau);
  const capTau = sTau.components.find((c) => c.kind === 'capacitor')!;
  const expectedTau = 10 * (1 - Math.exp(-sTau.timeSec / 0.01));
  assert.ok(
    Math.abs(capTau.vInst - expectedTau) < 0.25,
    `Expected Vc(tau) ≈ ${expectedTau.toFixed(2)}V, got ${capTau.vInst.toFixed(2)}V`
  );

  // Step forward to steady state (~5.5 tau)
  const sSteady = sim.step(150);
  const capSteady = sSteady.components.find((c) => c.kind === 'capacitor')!;
  assert.ok(capSteady.vInst > 9.9, `Expected steady Vc ≈ 10V, got ${capSteady.vInst}`);
  assert.ok(Math.abs(capSteady.iInst) < 0.0002, 'Steady-state capacitor current must approach 0A');
});

test('Simulator solves Parallel RC transient response with Thévenin time constant', () => {
  // 12V -> 1kΩ feed -> (1kΩ load || 22uF) => R_th = 500Ω, tau = 11ms, V_steady = 6V
  const elements = createSimStarterCircuit('parallel-rc');
  const sim = new Simulator(elements);
  const s0 = sim.getState();
  assert.equal(s0.ok, true);
  assert.ok(s0.tauSec && Math.abs(s0.tauSec - 0.011) < 5e-4, `Expected tau ≈ 11ms, got ${s0.tauSec}`);

  const sSteady = sim.step(190);
  const capSteady = sSteady.components.find((c) => c.kind === 'capacitor')!;
  assert.ok(
    Math.abs(capSteady.vInst - 6.0) < 0.15,
    `Expected parallel RC steady voltage ≈ 6.0V, got ${capSteady.vInst.toFixed(3)}V`
  );
  assert.ok(Object.keys(sSteady.wireVoltages).length >= 6);
});

test('Simulator solves Series RL transient current buildup I(t) = (V/R)(1 - e^-t/(L/R))', () => {
  // 12V -> 100Ω -> 100mH => tau = 1ms, I_max = 120mA
  const elements = createSimStarterCircuit('series-rl');
  const sim = new Simulator(elements);
  const s0 = sim.getState();
  assert.equal(s0.ok, true);
  assert.ok(s0.tauSec && Math.abs(s0.tauSec - 0.001) < 5e-5, `Expected tau ≈ 1ms, got ${s0.tauSec}`);

  const ind0 = s0.components.find((c) => c.kind === 'inductor')!;
  assert.ok(Math.abs(ind0.iInst) < 1e-4, 'Initial inductor current must start at 0A');

  const stepsToTau = Math.round(0.001 / s0.dtSec);
  const sTau = sim.step(stepsToTau);
  const indTau = sTau.components.find((c) => c.kind === 'inductor')!;
  const expectedI = 0.12 * (1 - Math.exp(-sTau.timeSec / 0.001));
  assert.ok(
    Math.abs(indTau.iInst - expectedI) < 0.004,
    `Expected IL(tau) ≈ ${(expectedI * 1000).toFixed(1)}mA, got ${(indTau.iInst * 1000).toFixed(1)}mA`
  );

  const sSteady = sim.step(160);
  const indSteady = sSteady.components.find((c) => c.kind === 'inductor')!;
  assert.ok(Math.abs(indSteady.iInst - 0.12) < 0.002, `Expected steady IL ≈ 120mA, got ${indSteady.iInst}`);
});

test('Simulator solves Parallel RL transient branch splitting', () => {
  // 12V -> 100Ω feed -> (100Ω load || 100mH) => R_th = 50Ω, tau = 2ms, steady inductor shorts load => IL -> 120mA
  const elements = createSimStarterCircuit('parallel-rl');
  const sim = new Simulator(elements);
  const s0 = sim.getState();
  assert.equal(s0.ok, true);
  assert.ok(s0.tauSec && Math.abs(s0.tauSec - 0.002) < 1e-4, `Expected tau ≈ 2ms, got ${s0.tauSec}`);

  const sSteady = sim.step(200);
  const indSteady = sSteady.components.find((c) => c.kind === 'inductor')!;
  const vmSteady = sSteady.components.find((c) => c.kind === 'voltmeter')!;
  assert.ok(indSteady.iInst > 0.115, `Expected steady parallel RL inductor current ≈ 120mA, got ${indSteady.iInst}`);
  assert.ok(Math.abs(vmSteady.vInst) < 0.4, `Expected steady inductor to pull parallel node near 0V, got ${vmSteady.vInst}`);
});

test('computePhasorResultant computes orthogonal vector sum correctly', () => {
  const res = computePhasorResultant([
    { id: '1', label: 'V_R', kind: 'voltage', magnitude: 3, angleDeg: 0, color: '#3b82f6' },
    { id: '2', label: 'V_L', kind: 'voltage', magnitude: 4, angleDeg: 90, color: '#10b981' },
  ]);
  assert.ok(Math.abs(res.magnitude - 5) < 1e-6);
  assert.ok(Math.abs(res.angleDeg - 53.1301) < 1e-2);
});

test('Simulator solves 2nd-order underdamped RLC step ODE with overshoot, derivatives, energy, and V/mA channels', () => {
  // 10V DC, R=25Ω, L=100mH, C=10uF => ω₀ = 1000 rad/s (f₀ ≈ 159.15Hz), ζ = 0.125, analytical peak ≈ 16.73V
  const elements = createSimStarterCircuit('dc-rlc');
  const sim = new Simulator(elements, 60, 'trapezoidal');
  const s0 = sim.getState();

  assert.equal(s0.ok, true);
  assert.equal(s0.mode, 'transient');
  assert.equal(s0.odeInfo.order, 2);
  assert.equal(s0.odeInfo.regime, 'underdamped');
  assert.ok(
    s0.odeInfo.naturalFreqHz !== null && Math.abs(s0.odeInfo.naturalFreqHz - 159.155) < 0.5,
    `Expected f0 ≈ 159.15Hz, got ${s0.odeInfo.naturalFreqHz}`
  );
  assert.ok(
    s0.odeInfo.dampingRatioZeta !== null && Math.abs(s0.odeInfo.dampingRatioZeta - 0.125) < 0.005,
    `Expected zeta ≈ 0.125, got ${s0.odeInfo.dampingRatioZeta}`
  );

  // Advance across the first natural half-period (~3.14ms) and full settling window
  let maxCapV = 0;
  let maxStoredE = 0;
  let maxDvDt = 0;
  let maxDiDt = 0;
  let finalState = s0;

  for (let i = 0; i < 220; i++) {
    finalState = sim.step(1);
    const cap = finalState.components.find((c) => c.kind === 'capacitor')!;
    const ind = finalState.components.find((c) => c.kind === 'inductor')!;
    if (cap.vInst > maxCapV) maxCapV = cap.vInst;
    if (finalState.totalStoredEnergyJ > maxStoredE) maxStoredE = finalState.totalStoredEnergyJ;
    if (Math.abs(cap.dvDt) > maxDvDt) maxDvDt = Math.abs(cap.dvDt);
    if (Math.abs(ind.diDt) > maxDiDt) maxDiDt = Math.abs(ind.diDt);
  }

  assert.ok(
    maxCapV > 15.0 && maxCapV < 18.0,
    `Expected underdamped capacitor peak overshoot ≈ 16.73V, got ${maxCapV.toFixed(3)}V`
  );
  assert.ok(maxStoredE > 4e-4, `Expected significant reactive energy storage, got ${maxStoredE}`);
  assert.ok(maxDvDt > 1000, `Expected non-trivial capacitor dv/dt derivative, got ${maxDvDt}`);
  assert.ok(maxDiDt > 50, `Expected non-trivial inductor di/dt derivative, got ${maxDiDt}`);

  const hasVoltChannel = finalState.channels.some((ch) => ch.unit === 'V');
  const hasCurrChannel = finalState.channels.some((ch) => ch.unit === 'mA');
  assert.ok(hasVoltChannel && hasCurrChannel, 'Expected simultaneous V and mA oscilloscope channels');
});

test('Simulator classifies overdamped RLC and supports Backward Euler solver switching', () => {
  // Increase R from 25Ω to 500Ω => ζ = 500 / (2 * 100) = 2.5 (overdamped)
  const elements = createSimStarterCircuit('dc-rlc').map((el) =>
    el.id === 'drlc_r1' ? { ...el, componentValue: '500Ω' } : el
  );
  const sim = new Simulator(elements, 60, 'backward-euler');
  const s0 = sim.getState();
  assert.equal(s0.ok, true);
  assert.equal(s0.odeInfo.order, 2);
  assert.equal(s0.odeInfo.regime, 'overdamped');
  assert.ok(s0.odeInfo.dampingRatioZeta && s0.odeInfo.dampingRatioZeta > 2.0);

  let maxCapV = 0;
  for (let i = 0; i < 120; i++) {
    const s = sim.step(1);
    const cap = s.components.find((c) => c.kind === 'capacitor')!;
    if (cap.vInst > maxCapV) maxCapV = cap.vInst;
  }
  assert.ok(maxCapV <= 10.05, `Overdamped response must not overshoot 10V, got ${maxCapV.toFixed(3)}V`);
});

test('Instrument boxes (CRO, Voltmeter, Ammeter) include probe geometry and zero pre-installed label text', () => {
  const baseEl = {
    type: 'circuit' as const,
    x: 100,
    y: 100,
    width: 120,
    height: 90,
    angle: 0,
    strokeColor: '#e2e8f0',
    backgroundColor: 'transparent',
    fillStyle: 'none' as const,
    strokeWidth: 2,
    strokeStyle: 'solid' as const,
    sloppiness: 0 as const,
    opacity: 100,
    seed: 1,
    fontFamily: 'scribble' as const,
    fontSize: 16,
    version: 1,
    updatedAt: 0,
  };

  for (const kind of ['voltmeter', 'ammeter', 'oscilloscope'] as const) {
    const spec = CIRCUIT_CATALOG.find((c) => c.kind === kind)!;
    assert.equal(spec.defaultValue, '', `Expected no pre-installed text for ${kind}`);

    const geom = buildCircuitGeometry({ ...baseEl, id: `inst_${kind}`, circuitKind: kind });
    assert.ok(geom.probes && geom.probes.length === 2, `Expected + and - probes on ${kind}`);
    assert.equal(geom.probes[0].sign, '+');
    assert.equal(geom.probes[1].sign, '−');
    if (kind === 'oscilloscope') {
      assert.ok(geom.screenRect, 'Expected CRT screenRect on CRO box');
    } else {
      assert.ok(geom.dialArc, `Expected analog dialArc on ${kind} box`);
    }
  }
});

test('Simulator reports probesConnected and node voltages accurately for wired vs floating instruments', () => {
  const baseEls = createSimStarterCircuit('dc-meters');
  const floatingCro: WhiteboardElement = {
    id: 'floating_cro',
    type: 'circuit',
    circuitKind: 'oscilloscope',
    componentValue: '',
    x: 900,
    y: 500,
    width: 138,
    height: 96,
    angle: 0,
    strokeColor: '#e2e8f0',
    backgroundColor: 'transparent',
    fillStyle: 'none',
    strokeWidth: 2,
    strokeStyle: 'solid',
    sloppiness: 0,
    opacity: 100,
    seed: 77,
    fontFamily: 'scribble',
    fontSize: 16,
    version: 1,
    updatedAt: 0,
  };

  const sim = new Simulator([...baseEls, floatingCro]);
  const state = sim.step(1);
  assert.equal(state.ok, true);

  const vm = state.components.find((c) => c.kind === 'voltmeter')!;
  const amm = state.components.find((c) => c.kind === 'ammeter')!;
  const cro = state.components.find((c) => c.elementId === 'floating_cro')!;

  assert.equal(vm.probesConnected, true);
  assert.equal(amm.probesConnected, true);
  assert.ok(Math.abs(vm.nodeAVoltage - 8.0) < 0.05);
  assert.ok(Math.abs(vm.nodeBVoltage) < 0.05);
  assert.equal(cro.probesConnected, false);
});

test('normalizeComponentValueInput auto-detects component-specific electrical units', () => {
  const res1 = normalizeComponentValueInput('resistor', '4.7k');
  assert.equal(res1.formatted, '4.7kΩ');
  assert.equal(res1.numericValue, 4700);

  const res2 = normalizeComponentValueInput('resistor', '470');
  assert.equal(res2.formatted, '470Ω');
  assert.equal(res2.numericValue, 470);

  const cap1 = normalizeComponentValueInput('capacitor', '22');
  assert.equal(cap1.formatted, '22µF');
  assert.ok(Math.abs(cap1.numericValue - 22e-6) < 1e-12);

  const cap2 = normalizeComponentValueInput('capacitor', '10n');
  assert.equal(cap2.formatted, '10nF');
  assert.ok(Math.abs(cap2.numericValue - 10e-9) < 1e-15);

  const ind1 = normalizeComponentValueInput('inductor', '100');
  assert.equal(ind1.formatted, '100mH');
  assert.ok(Math.abs(ind1.numericValue - 0.1) < 1e-9);

  const dc1 = normalizeComponentValueInput('dc-source', '15');
  assert.equal(dc1.formatted, '15V');
  assert.equal(dc1.numericValue, 15);

  const ac1 = normalizeComponentValueInput('ac-source', '24.5');
  assert.equal(ac1.formatted, '24.5V');
  assert.equal(ac1.numericValue, 24.5);
});

test('parseFrequencyInput and sliderPosToValue/valueToSliderPos handle frequencies and log/linear scaling accurately', () => {
  assert.equal(parseFrequencyInput('60', 60), 60);
  assert.equal(parseFrequencyInput('1k', 60), 1000);
  assert.equal(parseFrequencyInput('2.5kHz', 60), 2500);
  assert.equal(parseFrequencyInput('1MHz', 60), 1000000);

  const rSpec = getComponentSliderSpec('resistor', 1000);
  const posR = valueToSliderPos(10000, rSpec);
  const roundR = sliderPosToValue(posR, rSpec);
  assert.ok(Math.abs(roundR - 10000) < 200, `Expected ~10000, got ${roundR}`);
  assert.equal(formatComponentCompactValue('resistor', 4700), '4.7kΩ');
  assert.equal(formatComponentCompactValue('capacitor', 22e-6), '22µF');
  assert.equal(formatComponentCompactValue('inductor', 0.1), '100mH');

  const vSpec = getComponentSliderSpec('ac-source', 12);
  const posV = valueToSliderPos(24, vSpec);
  const roundV = sliderPosToValue(posV, vSpec);
  assert.ok(Math.abs(roundV - 24) < 0.01);
});

test('getCroProbeWaveform returns only the waveform where the CRO probe is attached and null when unattached', () => {
  // AC RLC has wired CRO 'sim_ac_scope' attached across L+C node to GND
  const acEls = createSimStarterCircuit('ac-rlc');
  const floatingCro: WhiteboardElement = {
    id: 'floating_cro_2',
    type: 'circuit',
    circuitKind: 'oscilloscope',
    componentValue: '',
    x: 920,
    y: 520,
    width: 138,
    height: 96,
    angle: 0,
    strokeColor: '#e2e8f0',
    backgroundColor: 'transparent',
    fillStyle: 'none',
    strokeWidth: 2,
    strokeStyle: 'solid',
    sloppiness: 0,
    opacity: 100,
    seed: 91,
    fontFamily: 'scribble',
    fontSize: 16,
    version: 1,
    updatedAt: 0,
  };

  const sim = new Simulator([...acEls, floatingCro], 60);
  const state = sim.step(60);
  assert.equal(state.ok, true);

  // Full simulator still tracks multiple circuit channels, while CRO helper isolates only the attached CRO
  assert.ok(state.channels.length >= 3);

  const attachedTrace = getCroProbeWaveform(state, 'sim_ac_scope');
  assert.ok(attachedTrace, 'Attached CRO must return its probe waveform');
  assert.equal(attachedTrace.id, 'sim_ac_scope');
  assert.equal(attachedTrace.unit, 'V');
  assert.ok(Math.max(...attachedTrace.samples.map(Math.abs)) > 1.0);

  // Floating CRO must return null and emit no channel + show 'No Probe' readout
  const floatingTrace = getCroProbeWaveform(state, 'floating_cro_2');
  assert.equal(floatingTrace, null);
  assert.equal(state.channels.some((ch) => ch.id === 'floating_cro_2'), false);
  assert.equal(state.liveReadouts['floating_cro_2'], 'No Probe');
});

test('Function Generator produces sinusoidal, triangular, and square waveforms across load & CRO', () => {
  const makeBase = (id: string, kind: WhiteboardElement['circuitKind'], x: number, y: number, w = 88, h = 56): WhiteboardElement => ({
    id,
    type: 'circuit',
    circuitKind: kind,
    componentValue: kind === 'resistor' ? '1kΩ' : kind === 'function-generator' ? '10V' : '',
    frequencyHz: kind === 'function-generator' ? 100 : undefined,
    waveformType: kind === 'function-generator' ? 'square' : undefined,
    x,
    y,
    width: w,
    height: h,
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
    fontSize: 14,
    version: 1,
    updatedAt: 0,
  });

  const makeWire = (id: string, p1: { x: number; y: number }, p2: { x: number; y: number }): WhiteboardElement => ({
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
  });

  // FGen at (100, 100), w=76, h=76 -> neg=(100, 138), pos=(176, 138)
  const fgen = makeBase('fg1', 'function-generator', 100, 100, 76, 76);
  // Load Resistor at (260, 110), w=88, h=56 -> in=(260, 138), out=(348, 138)
  const rLoad = makeBase('r1', 'resistor', 260, 110, 88, 56);
  // Ground at (114, 210), w=48, h=48 -> gnd=(138, 210)
  const gnd = makeBase('g1', 'ground', 114, 210, 48, 48);
  // CRO at (235, 190), w=138, h=96 -> pos=(235, 238), neg=(373, 238)
  const cro = makeBase('cro1', 'oscilloscope', 235, 190, 138, 96);

  const squareEls: WhiteboardElement[] = [
    fgen,
    rLoad,
    gnd,
    cro,
    makeWire('w_pos_r', { x: 176, y: 138 }, { x: 260, y: 138 }),
    makeWire('w_r_gnd', { x: 348, y: 138 }, { x: 138, y: 210 }),
    makeWire('w_fg_gnd', { x: 100, y: 138 }, { x: 138, y: 210 }),
    makeWire('w_cro_p', { x: 235, y: 238 }, { x: 260, y: 138 }),
    makeWire('w_cro_m', { x: 373, y: 238 }, { x: 138, y: 210 }),
  ];

  const simSq = new Simulator(squareEls, 100);
  const stateSq = simSq.step(80);
  assert.equal(stateSq.ok, true);
  const sqTrace = getCroProbeWaveform(stateSq, 'cro1');
  assert.ok(sqTrace);
  assert.ok(Math.max(...sqTrace.samples) > 8.5, `Expected square positive peak > 8.5V, got ${Math.max(...sqTrace.samples)}`);
  assert.ok(Math.min(...sqTrace.samples) < -8.5, `Expected square negative trough < -8.5V, got ${Math.min(...sqTrace.samples)}`);

  const triEls = squareEls.map((el) =>
    el.id === 'fg1' ? { ...el, waveformType: 'triangle' as const } : el
  );
  const simTri = new Simulator(triEls, 100);
  const stateTri = simTri.step(80);
  const triTrace = getCroProbeWaveform(stateTri, 'cro1');
  assert.ok(triTrace);
  const midBandCount = triTrace.samples.filter((s) => Math.abs(s) > 2 && Math.abs(s) < 8).length;
  assert.ok(midBandCount > 5, 'Triangle wave must ramp smoothly through intermediate voltages');
});

test('SPST Switch blocks current when OPEN and conducts when CLOSED', () => {
  const mk = (id: string, kind: WhiteboardElement['circuitKind'], x: number, y: number, w = 88, h = 56, extra: Partial<WhiteboardElement> = {}): WhiteboardElement => ({
    id,
    type: 'circuit',
    circuitKind: kind,
    componentValue: kind === 'dc-source' ? '12V' : kind === 'resistor' ? '1kΩ' : '',
    x,
    y,
    width: w,
    height: h,
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
    fontSize: 14,
    version: 1,
    updatedAt: 0,
    ...extra,
  });

  const wire = (id: string, p1: { x: number; y: number }, p2: { x: number; y: number }): WhiteboardElement => ({
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
    seed: 3,
    fontFamily: 'cleansans',
    fontSize: 14,
    version: 1,
    updatedAt: 0,
  });

  // DC 12V: pos=(128,100), neg=(128,156)
  // Switch: in=(180,100), out=(268,100)
  // Resistor 1k: in=(300,100), out=(388,100)
  // Voltmeter across R: w=100, h=74 -> pos=(266, 207), neg=(366, 207)
  const src = mk('v1', 'dc-source', 100, 100, 56, 56);
  const swOpen = mk('sw1', 'switch', 180, 72, 88, 56, { switchClosed: false, componentValue: 'OPEN' });
  const rLoad = mk('r1', 'resistor', 300, 72, 88, 56);
  const gnd = mk('g1', 'ground', 104, 190, 48, 48); // gnd=(128,190)
  const vm = mk('vm1', 'voltmeter', 266, 170, 100, 74); // pos=(266,207), neg=(366,207)

  const openEls = [
    src,
    swOpen,
    rLoad,
    gnd,
    vm,
    wire('w1', { x: 128, y: 100 }, { x: 180, y: 100 }),
    wire('w2', { x: 268, y: 100 }, { x: 300, y: 100 }),
    wire('w3', { x: 388, y: 100 }, { x: 128, y: 190 }),
    wire('w4', { x: 128, y: 156 }, { x: 128, y: 190 }),
    wire('w5', { x: 266, y: 207 }, { x: 300, y: 100 }),
    wire('w6', { x: 366, y: 207 }, { x: 128, y: 190 }),
  ];

  const openReport = simulateCircuit(openEls, 60);
  assert.equal(openReport.ok, true);
  const openVm = openReport.components.find((c) => c.elementId === 'vm1')!;
  assert.ok(Math.abs(openVm.dcVoltage) < 0.05, `Expected ~0V with OPEN switch, got ${openVm.dcVoltage}`);

  const closedEls = openEls.map((el) =>
    el.id === 'sw1' ? { ...el, switchClosed: true, componentValue: 'CLOSED' } : el
  );
  const closedReport = simulateCircuit(closedEls, 60);
  assert.equal(closedReport.ok, true);
  const closedVm = closedReport.components.find((c) => c.elementId === 'vm1')!;
  assert.ok(Math.abs(closedVm.dcVoltage - 12.0) < 0.1, `Expected ~12V with CLOSED switch, got ${closedVm.dcVoltage}`);
});

test('Simulated circuit wires show colors on BOTH +ve and -ve terminal connections while unattached wires keep strokeColor', () => {
  const elements = createSimStarterCircuit('dc-meters');
  const strayWire: WhiteboardElement = {
    id: 'stray_wire_isolated',
    type: 'wire',
    wireRouting: 'straight',
    x: 1200,
    y: 900,
    width: 100,
    height: 1,
    points: [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ],
    angle: 0,
    strokeColor: '#94a3b8',
    backgroundColor: 'transparent',
    fillStyle: 'none',
    strokeWidth: 2,
    strokeStyle: 'solid',
    sloppiness: 0,
    opacity: 100,
    seed: 999,
    fontFamily: 'cleansans',
    fontSize: 14,
    version: 1,
    updatedAt: 0,
  };

  const report = simulateCircuit([...elements, strayWire], 60);
  assert.equal(report.ok, true);
  assert.ok(report.wireVoltages);

  const wireVoltages = report.wireVoltages!;
  // Positive rail (+12V) wire color
  const positiveWireId = Object.keys(wireVoltages).find((id) => wireVoltages[id] > 5);
  assert.ok(positiveWireId, 'Expected at least one positive-rail wire');
  assert.equal(getSimulatedWireColor(wireVoltages[positiveWireId!], '#e2e8f0'), '#38bdf8');

  // Negative / 0V GND terminal wire color (previously uncolored)
  const negativeWireId = Object.keys(wireVoltages).find((id) => Math.abs(wireVoltages[id]) < 0.02);
  assert.ok(negativeWireId, 'Expected at least one -ve/ground return wire in wireVoltages');
  assert.equal(getSimulatedWireColor(wireVoltages[negativeWireId!], '#e2e8f0'), '#fb7185');

  // Completely disconnected stray wire must NOT appear in wireVoltages and must keep default strokeColor
  assert.equal(wireVoltages['stray_wire_isolated'], undefined);
  assert.equal(getSimulatedWireColor(wireVoltages['stray_wire_isolated'], '#94a3b8'), '#94a3b8');
});
