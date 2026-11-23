import test from 'node:test';
import assert from 'node:assert/strict';
import { exportToExcalidrawJson, exportToSvg, importSceneFromJson } from '../exporters';
import { FORGE_THEMES } from '../themes';
import { createDemoCircuitPreset } from '../circuitPreset';
import { buildCircuitGeometry, findNearestSnapTerminal } from '../engineeringComponents';

test('Excalidraw JSON export and import roundtrip preserves circuit and frame elements', () => {
  const theme = FORGE_THEMES['emerald-minimal'];
  const preset = createDemoCircuitPreset(theme.defaultInk);
  const doc = exportToExcalidrawJson(preset, theme);

  assert.equal(doc.type, 'excalidraw');
  assert.equal(doc.version, 2);
  assert.equal(doc.elements.length, preset.length);

  const imported = importSceneFromJson(JSON.stringify(doc), theme.defaultInk);
  assert.equal(imported.elements.length, preset.length);
  assert.equal(imported.themeId, 'emerald-minimal');
  const opamp = imported.elements.find((e) => e.id === 'opamp_1');
  assert.ok(opamp);
  assert.equal(opamp.type, 'circuit');
  assert.equal(opamp.circuitKind, 'opamp');
});

test('SVG export produces valid standalone SVG markup with elements', () => {
  const theme = FORGE_THEMES['solarized-light'];
  const preset = createDemoCircuitPreset(theme.defaultInk);
  const svg = exportToSvg(preset, theme, true);
  assert.ok(svg.startsWith('<svg '));
  assert.ok(svg.includes('</svg>'));
  assert.ok(svg.includes('Low-Pass Filter Stage'));
});

test('Circuit terminal snapping locates nearby component pin', () => {
  const preset = createDemoCircuitPreset('#ffffff');
  const resistor = preset.find((e) => e.id === 'res_1')!;
  const geom = buildCircuitGeometry(resistor);
  assert.ok(geom.polylines.length > 0);

  // Resistor left terminal is at (x, y + height/2)
  const snap = findNearestSnapTerminal(preset, { x: resistor.x + 2, y: resistor.y + resistor.height / 2 });
  assert.ok(snap);
  assert.equal(snap.elementId, 'res_1');
  assert.equal(snap.terminalId, 'in');
});

test('Excalidraw roundtrip and SVG export preserve webpage block, function-generator, switch, and logic gate fields', () => {
  const theme = FORGE_THEMES['emerald-minimal'];
  const items = [
    {
      ...createDemoCircuitPreset(theme.defaultInk)[0],
      id: 'fg_roundtrip',
      type: 'circuit' as const,
      circuitKind: 'function-generator' as const,
      componentValue: '8V',
      frequencyHz: 250,
      waveformType: 'triangle' as const,
    },
    {
      ...createDemoCircuitPreset(theme.defaultInk)[0],
      id: 'sw_roundtrip',
      type: 'circuit' as const,
      circuitKind: 'switch' as const,
      switchClosed: true,
      componentValue: 'CLOSED',
    },
    {
      ...createDemoCircuitPreset(theme.defaultInk)[0],
      id: 'gate_roundtrip',
      type: 'circuit' as const,
      circuitKind: 'gate-xor' as const,
      logicInputA: 'A',
      logicInputB: 'B',
    },
    {
      ...createDemoCircuitPreset(theme.defaultInk)[0],
      id: 'wp_roundtrip',
      type: 'webpage' as const,
      width: 380,
      height: 240,
      webpageTitle: 'Hero Showcase',
      htmlCode: '<h1>Hero Showcase</h1>',
      cssCode: 'h1 { color: emerald; }',
      jsCode: 'console.log(1);',
      webpageAutoPolish: true,
    },
  ];

  const doc = exportToExcalidrawJson(items, theme);
  const imported = importSceneFromJson(JSON.stringify(doc), theme.defaultInk);
  const fg = imported.elements.find((e) => e.id === 'fg_roundtrip')!;
  const sw = imported.elements.find((e) => e.id === 'sw_roundtrip')!;
  const gate = imported.elements.find((e) => e.id === 'gate_roundtrip')!;
  const wp = imported.elements.find((e) => e.id === 'wp_roundtrip')!;

  assert.equal(fg.waveformType, 'triangle');
  assert.equal(fg.frequencyHz, 250);
  assert.equal(sw.switchClosed, true);
  assert.equal(gate.logicInputA, 'A');
  assert.equal(gate.logicInputB, 'B');
  assert.equal(wp.type, 'webpage');
  assert.equal(wp.webpageTitle, 'Hero Showcase');
  assert.equal(wp.htmlCode, '<h1>Hero Showcase</h1>');
  assert.equal(wp.webpageAutoPolish, true);

  const svg = exportToSvg(items, theme, true);
  assert.ok(svg.includes('Hero Showcase'));
  assert.ok(svg.includes('HTML / CSS / JS Webpage'));
});

