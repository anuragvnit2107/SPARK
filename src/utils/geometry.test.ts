import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildOrthogonalWirePath,
  computeAdaptiveGridMetrics,
  computeResizedElement,
  computeUniformGridMetrics,
  computeWireJunctions,
  generatePolygonHachureLines,
  generateSketchyLineSegments,
  getAnchorWorldPosition,
  getNormalizedBounds,
  getWireRenderPoints,
  hitTestElement,
  rotateElementBy,
  sampleCurvedWirePoints,
  updateBoundConnectors,
} from '../sketchEngine';
import {
  CANVAS_THEMES,
  CANVAS_THEME_LIST,
  GLASS_BACKGROUND_COLLECTIONS,
  hexToGlassRgba,
  resolveWorkspaceTheme,
  THEME_LIST,
} from '../themes';
import { simulateCircuit } from '../circuitSimulator';
import { rdpSimplify, recognizeFreehandShape } from '../shapeRecognition';
import { exportToSvg } from '../exporters';
import { CanvasThemeId, WhiteboardElement } from '../types';

function makeRect(overrides: Partial<WhiteboardElement> = {}): WhiteboardElement {
  return {
    id: 'rect_1',
    type: 'rectangle',
    x: 100,
    y: 100,
    width: 120,
    height: 80,
    angle: 0,
    strokeColor: '#ffffff',
    backgroundColor: 'transparent',
    fillStyle: 'none',
    strokeWidth: 2,
    strokeStyle: 'solid',
    sloppiness: 1,
    opacity: 100,
    seed: 42,
    fontFamily: 'scribble',
    fontSize: 20,
    version: 1,
    updatedAt: 0,
    ...overrides,
  };
}

test('sketchy line generation is deterministic for the same seed', () => {
  const segA = generateSketchyLineSegments({ x: 0, y: 0 }, { x: 100, y: 50 }, 1, 777);
  const segB = generateSketchyLineSegments({ x: 0, y: 0 }, { x: 100, y: 50 }, 1, 777);
  assert.deepEqual(segA, segB);
  assert.equal(segA.length, 2); // Artist mode uses 2 passes
});

test('polygon hachure lines generate diagonal strokes inside bounds', () => {
  const poly = [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 100 },
    { x: 0, y: 100 },
  ];
  const single = generatePolygonHachureLines(poly, -45, 10, 1, 10, false);
  const cross = generatePolygonHachureLines(poly, -45, 10, 1, 10, true);
  assert.ok(single.length > 5);
  assert.ok(cross.length > single.length);
});

test('hitTestElement detects interior of rectangle and misses outside', () => {
  const rect = makeRect();
  assert.equal(hitTestElement(rect, { x: 150, y: 140 }), true);
  assert.equal(hitTestElement(rect, { x: 400, y: 400 }), false);
  assert.deepEqual(getNormalizedBounds(rect), { x: 100, y: 100, width: 120, height: 80 });
});

test('updateBoundConnectors moves bound arrow endpoints and re-routes orthogonal wires', () => {
  const box = makeRect({ id: 'box_1', x: 200, y: 100, width: 100, height: 100 });
  const arrow = makeRect({
    id: 'arr_1',
    type: 'arrow',
    x: 0,
    y: 0,
    width: 100,
    height: 50,
    points: [
      { x: 0, y: 0 },
      { x: 100, y: 50 },
    ],
    endBinding: { elementId: 'box_1', anchor: { x: 0, y: 0.5 } },
  });
  const wire = makeRect({
    id: 'wire_1',
    type: 'wire',
    wireRouting: 'orthogonal',
    x: 0,
    y: 0,
    width: 100,
    height: 50,
    points: [
      { x: 0, y: 0 },
      { x: 50, y: 0 },
      { x: 50, y: 50 },
      { x: 100, y: 50 },
    ],
    endBinding: { elementId: 'box_1', anchor: { x: 0, y: 0.5 } },
  });

  const updated = updateBoundConnectors([box, arrow, wire], new Set(['box_1']));
  const updatedArrow = updated.find((e) => e.id === 'arr_1')!;
  assert.ok(updatedArrow.points);
  const endWorld = {
    x: updatedArrow.x + updatedArrow.points[1].x,
    y: updatedArrow.y + updatedArrow.points[1].y,
  };
  assert.equal(endWorld.x, 200);
  assert.equal(endWorld.y, 150);

  const updatedWire = updated.find((e) => e.id === 'wire_1')!;
  assert.ok(updatedWire.points && updatedWire.points.length >= 3);
  const lastWirePt = updatedWire.points[updatedWire.points.length - 1];
  assert.equal(updatedWire.x + lastWirePt.x, 200);
  assert.equal(updatedWire.y + lastWirePt.y, 150);
});

test('buildOrthogonalWirePath produces clean 90-degree Manhattan bends and computeWireJunctions finds T-junctions', () => {
  const path = buildOrthogonalWirePath({ x: 0, y: 0 }, { x: 120, y: 80 }, 'right', 'left');
  assert.equal(path.length, 4);
  for (let i = 0; i < path.length - 1; i++) {
    const dx = Math.abs(path[i + 1].x - path[i].x);
    const dy = Math.abs(path[i + 1].y - path[i].y);
    assert.ok(dx < 0.01 || dy < 0.01, 'Every wire segment must be horizontal or vertical');
  }

  const wMain = makeRect({
    id: 'w_main',
    type: 'wire',
    x: 0,
    y: 100,
    width: 200,
    height: 1,
    points: [
      { x: 0, y: 0 },
      { x: 200, y: 0 },
    ],
  });
  const wBranch = makeRect({
    id: 'w_branch',
    type: 'wire',
    x: 100,
    y: 100,
    width: 1,
    height: 80,
    points: [
      { x: 0, y: 0 },
      { x: 0, y: 80 },
    ],
  });
  const dots = computeWireJunctions([wMain, wBranch]);
  assert.equal(dots.length, 1);
  assert.equal(dots[0].x, 100);
  assert.equal(dots[0].y, 100);
});

test('rdpSimplify reduces collinear points and recognizeFreehandShape classifies circles', () => {
  const linePts = [
    { x: 0, y: 0 },
    { x: 25, y: 0.2 },
    { x: 50, y: -0.1 },
    { x: 100, y: 0 },
  ];
  const simplified = rdpSimplify(linePts, 2);
  assert.equal(simplified.length, 2);

  // Generate noisy circle
  const circlePts = [];
  for (let i = 0; i <= 32; i++) {
    const t = (i / 32) * Math.PI * 2;
    circlePts.push({ x: 200 + 60 * Math.cos(t), y: 200 + 60 * Math.sin(t) });
  }
  const recognized = recognizeFreehandShape(circlePts);
  assert.ok(recognized);
  assert.equal(recognized.type, 'ellipse');
});

function sampleClosedPoly(corners: { x: number; y: number }[], stepsPerEdge = 8) {
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i < corners.length; i++) {
    const a = corners[i];
    const b = corners[(i + 1) % corners.length];
    for (let s = 0; s < stepsPerEdge; s++) {
      const t = s / stepsPerEdge;
      pts.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    }
  }
  pts.push({ ...corners[0] });
  return pts;
}

test('recognizeFreehandShape distinguishes equilateral, right-left, and right-right triangles', () => {
  const rightLeft = sampleClosedPoly([
    { x: 100, y: 100 },
    { x: 100, y: 240 },
    { x: 260, y: 240 },
  ]);
  const resLeft = recognizeFreehandShape(rightLeft);
  assert.ok(resLeft);
  assert.equal(resLeft.type, 'triangle');
  assert.equal(resLeft.triangleVariant, 'right-left');

  const rightRight = sampleClosedPoly([
    { x: 260, y: 100 },
    { x: 260, y: 240 },
    { x: 100, y: 240 },
  ]);
  const resRight = recognizeFreehandShape(rightRight);
  assert.ok(resRight);
  assert.equal(resRight.type, 'triangle');
  assert.equal(resRight.triangleVariant, 'right-right');

  const equil = sampleClosedPoly([
    { x: 180, y: 100 },
    { x: 100, y: 240 },
    { x: 260, y: 240 },
  ]);
  const resEquil = recognizeFreehandShape(equil);
  assert.ok(resEquil);
  assert.equal(resEquil.type, 'triangle');
  assert.equal(resEquil.triangleVariant, 'isosceles');
});

test('recognizeFreehandShape classifies slanted parallelograms separately from rectangles', () => {
  const rightSlant = sampleClosedPoly([
    { x: 150, y: 100 },
    { x: 310, y: 100 },
    { x: 260, y: 220 },
    { x: 100, y: 220 },
  ]);
  const resPara = recognizeFreehandShape(rightSlant);
  assert.ok(resPara);
  assert.equal(resPara.type, 'parallelogram');
  assert.ok(typeof resPara.skewRatio === 'number' && Math.abs(resPara.skewRatio) > 0.1);

  const rect = sampleClosedPoly([
    { x: 100, y: 100 },
    { x: 280, y: 100 },
    { x: 280, y: 220 },
    { x: 100, y: 220 },
  ]);
  const resRect = recognizeFreehandShape(rect);
  assert.ok(resRect);
  assert.equal(resRect.type, 'rectangle');
});

test('THEME_LIST contains 4 themes: Emerald Minimal (default), Solarized Light, Black Slate, and Liquid Glass Emerald', () => {
  assert.equal(THEME_LIST.length, 4);
  assert.equal(THEME_LIST[0].id, 'emerald-minimal');
  assert.equal(THEME_LIST[0].name, 'Emerald Minimal');
  assert.equal(THEME_LIST[1].id, 'solarized-light');
  assert.equal(THEME_LIST[1].name, 'Solarized Light');
  assert.equal(THEME_LIST[2].id, 'black-slate');
  assert.equal(THEME_LIST[2].name, 'Black Slate');
  assert.equal(THEME_LIST[2].mode, 'dark');
  assert.equal(THEME_LIST[2].canvasBg, '#0B0F19');
  assert.equal(THEME_LIST[2].surfaceElevated, '#232A3B');
  assert.equal(THEME_LIST[2].accentColor, '#38BDF8');
  assert.equal(THEME_LIST[3].id, 'liquid-glass-emerald');
  assert.equal(THEME_LIST[3].name, 'Liquid Glass Emerald');
  assert.equal(THEME_LIST[3].mode, 'dark');
  assert.equal(THEME_LIST[3].glass, true);
  assert.equal(THEME_LIST[3].canvasBg, '#05130F');
  assert.equal(THEME_LIST[3].accentColor, '#10B981');
});

test('sampleCurvedWirePoints interpolates through control points and updateBoundConnectors preserves custom bends', () => {
  const ctrl = [
    { x: 0, y: 0 },
    { x: 100, y: 60 },
    { x: 200, y: 0 },
  ];
  const sampled = sampleCurvedWirePoints(ctrl, 8);
  assert.ok(sampled.length > 10);
  assert.deepEqual(sampled[0], ctrl[0]);
  assert.deepEqual(sampled[sampled.length - 1], ctrl[ctrl.length - 1]);
  assert.ok(
    sampled.some((p) => Math.abs(p.x - 100) < 0.5 && Math.abs(p.y - 60) < 0.5),
    'Curved wire spline must pass through interior arc vertex'
  );

  const box = makeRect({ id: 'box_arc', x: 200, y: 100, width: 100, height: 100 });
  const curvedWire = makeRect({
    id: 'wire_curved',
    type: 'wire',
    wireRouting: 'curved',
    x: 0,
    y: 0,
    width: 200,
    height: 150,
    points: [
      { x: 0, y: 150 },
      { x: 100, y: 60 },
      { x: 200, y: 150 },
    ],
    endBinding: { elementId: 'box_arc', anchor: { x: 0, y: 0.5 } },
  });

  const renderPts = getWireRenderPoints(curvedWire);
  assert.ok(renderPts.length > curvedWire.points!.length);

  // Move box_arc and ensure intermediate arc vertex (100, 60) is preserved
  const movedBox = { ...box, x: 260, y: 120 };
  const updated = updateBoundConnectors([movedBox, curvedWire], new Set(['box_arc']));
  const updatedWire = updated.find((e) => e.id === 'wire_curved')!;
  assert.equal(updatedWire.points?.length, 3);
  const worldMid = {
    x: updatedWire.x + updatedWire.points![1].x,
    y: updatedWire.y + updatedWire.points![1].y,
  };
  assert.deepEqual(worldMid, { x: 100, y: 60 });
  const worldEnd = {
    x: updatedWire.x + updatedWire.points![2].x,
    y: updatedWire.y + updatedWire.points![2].y,
  };
  assert.deepEqual(worldEnd, { x: 260, y: 170 });
});

test('CANVAS_THEME_LIST exposes all 22 requested themes and resolveWorkspaceTheme preserves canvas while styling chrome as Liquid Glass Emerald', () => {
  const expectedIds: CanvasThemeId[] = [
    'emerald-minimal',
    'orchis',
    'whitesur',
    'fluent',
    'sweet',
    'arc-dark',
    'graphite',
    'layan',
    'catppuccin-mocha',
    'catppuccin-macchiato',
    'catppuccin-frappe',
    'catppuccin-latte',
    'dracula',
    'nord',
    'tokyo-night',
    'gruvbox-dark',
    'gruvbox-light',
    'everforest',
    'solarized-dark',
    'solarized-light',
    'one-dark',
    'black-slate',
  ];
  assert.equal(CANVAS_THEME_LIST.length, 22);
  for (const id of expectedIds) {
    assert.ok(CANVAS_THEMES[id], `Missing canvas theme: ${id}`);
    const resolved = resolveWorkspaceTheme('liquid-glass-emerald', id);
    assert.equal(resolved.glass, true);
    assert.equal(resolved.backdropGradient, undefined);
    assert.equal(resolved.canvasBg, CANVAS_THEMES[id].canvasBg);
    assert.equal(resolved.canvasThemeId, id);
  }
});

test('rotating electrical elements rotates terminal pins, hit-testing, bound wires, and preserves circuit netlist connectivity', () => {
  const src: WhiteboardElement = makeRect({
    id: 'src_rot',
    type: 'circuit',
    circuitKind: 'dc-source',
    componentValue: '10V',
    x: 100,
    y: 100,
    width: 60,
    height: 100,
  });
  const res: WhiteboardElement = makeRect({
    id: 'res_rot',
    type: 'circuit',
    circuitKind: 'resistor',
    componentValue: '1kΩ',
    x: 240,
    y: 120,
    width: 100,
    height: 60,
  });
  const gnd: WhiteboardElement = makeRect({
    id: 'gnd_rot',
    type: 'circuit',
    circuitKind: 'ground',
    componentValue: '0V',
    x: 110,
    y: 230,
    width: 40,
    height: 40,
  });

  // Rotate resistor 90 deg CW around center (290, 150)
  const rotatedRes = rotateElementBy(res, Math.PI / 2);
  assert.ok(Math.abs(rotatedRes.angle - Math.PI / 2) < 0.001);

  // Rotated pin 'a' (nx=0, ny=0.5) was (240, 150), rotated +90 deg CW around (290, 150) -> (290, 100)
  const pinA = getAnchorWorldPosition(rotatedRes, { x: 0, y: 0.5 });
  const pinB = getAnchorWorldPosition(rotatedRes, { x: 1, y: 0.5 });
  assert.ok(Math.abs(pinA.x - 290) < 0.01 && Math.abs(pinA.y - 100) < 0.01);
  assert.ok(Math.abs(pinB.x - 290) < 0.01 && Math.abs(pinB.y - 200) < 0.01);

  // Hit-testing respects rotated bounds (290, 105 is inside rotated vertical resistor, outside unrotated 120..180 Y)
  assert.equal(hitTestElement(res, { x: 290, y: 105 }, 2), false);
  assert.equal(hitTestElement(rotatedRes, { x: 290, y: 105 }, 2), true);

  // Wire from source top (130, 100) -> rotated resistor top pinA (290, 100)
  const w1: WhiteboardElement = makeRect({
    id: 'w_rot_1',
    type: 'wire',
    x: 130,
    y: 100,
    width: 160,
    height: 1,
    points: [
      { x: 0, y: 0 },
      { x: pinA.x - 130, y: pinA.y - 100 },
    ],
    startBinding: { elementId: 'src_rot', terminalId: 'pos', anchor: { x: 0.5, y: 0 } },
    endBinding: { elementId: 'res_rot', terminalId: 'a', anchor: { x: 0, y: 0.5 } },
  });
  // Wire from rotated resistor bottom pinB (290, 200) -> source neg (130, 200)
  const w2: WhiteboardElement = makeRect({
    id: 'w_rot_2',
    type: 'wire',
    x: pinB.x,
    y: pinB.y,
    width: 160,
    height: 1,
    points: [
      { x: 0, y: 0 },
      { x: 130 - pinB.x, y: 200 - pinB.y },
    ],
    startBinding: { elementId: 'res_rot', terminalId: 'b', anchor: { x: 1, y: 0.5 } },
    endBinding: { elementId: 'src_rot', terminalId: 'neg', anchor: { x: 0.5, y: 1 } },
  });
  // Wire ground top (130, 230) -> source neg (130, 200)
  const w3: WhiteboardElement = makeRect({
    id: 'w_rot_3',
    type: 'wire',
    x: 130,
    y: 230,
    width: 1,
    height: 30,
    points: [
      { x: 0, y: 0 },
      { x: 0, y: -30 },
    ],
  });

  // Rotate resistor again by +90 deg -> total 180 deg, verify bound connectors re-snap cleanly
  const rotatedRes180 = rotateElementBy(rotatedRes, Math.PI / 2);
  const rewired = updateBoundConnectors([src, rotatedRes180, gnd, w1, w2, w3], new Set(['res_rot']));
  const sol180 = simulateCircuit(rewired);
  assert.equal(sol180.ok, true);
  const resReport = sol180.components.find((c) => c.elementId === 'res_rot');
  assert.ok(resReport && Math.abs(Math.abs(resReport.dcCurrent) - 0.01) < 0.0005);
});

test('computeResizedElement scales text fontSize proportionally when dragged from corners and anchors opposite corner', () => {
  const txt = makeRect({
    id: 'txt_1',
    type: 'text',
    x: 100,
    y: 100,
    width: 200,
    height: 40,
    fontSize: 20,
    text: 'Scale me',
  });
  const ib = { x: 100, y: 100, width: 200, height: 40 };

  // Stretching SE corner to 2x width & 2x height doubles fontSize to 40 and keeps top-left at (100, 100)
  const scaledSE = computeResizedElement(txt, txt, ib, 100, 100, 400, 80, 'se', true);
  assert.equal(scaledSE.fontSize, 40);
  assert.equal(scaledSE.x, 100);
  assert.equal(scaledSE.y, 100);
  assert.equal(scaledSE.width, 400);
  assert.equal(scaledSE.height, 80);

  // Stretching NW corner outward by 1.5x keeps bottom-right corner pinned at (300, 140)
  const scaledNW = computeResizedElement(txt, txt, ib, 0, 80, 300, 60, 'nw', true);
  assert.equal(scaledNW.fontSize, 30);
  assert.equal(scaledNW.x + scaledNW.width, 300);
  assert.equal(scaledNW.y + scaledNW.height, 140);

  // Dragging E edge only widens the box without changing fontSize
  const edgeE = computeResizedElement(txt, txt, ib, 100, 100, 320, 40, 'e', true);
  assert.equal(edgeE.fontSize, 20);
  assert.equal(edgeE.width, 320);
});

test('computeResizedElement scales math-equation and math-matrix fontSize cleanly within [10, 96]', () => {
  const eq = makeRect({
    id: 'eq_1',
    type: 'math-equation',
    x: 100,
    y: 100,
    width: 240,
    height: 80,
    fontSize: 16,
    mathRaw: 'f(x)=x^2',
  });
  const ib = { x: 100, y: 100, width: 240, height: 80 };
  const enlarged = computeResizedElement(eq, eq, ib, 100, 100, 480, 160, 'se', true);
  assert.equal(enlarged.fontSize, 32);
  const clampedMax = computeResizedElement(eq, eq, ib, 100, 100, 2400, 800, 'se', true);
  assert.equal(clampedMax.fontSize, 96);
});

test('computeAdaptiveGridMetrics keeps major spacing readable across extreme zoom levels and glass swatches are translucent', () => {
  for (const zoom of [0.05, 0.16, 0.5, 1, 2.5, 5]) {
    const metrics = computeAdaptiveGridMetrics(zoom, 24);
    assert.ok(metrics.majorScreenStep >= 40 && metrics.majorScreenStep <= 220, `zoom=${zoom} produced majorScreenStep=${metrics.majorScreenStep}`);
    assert.ok(metrics.majorWorldStep > 0 && metrics.minorWorldStep > 0);
  }

  assert.equal(GLASS_BACKGROUND_COLLECTIONS.length, 3);
  assert.equal(hexToGlassRgba('#10b981', 0.28), 'rgba(16, 185, 129, 0.28)');
});

test('computeResizedElement scales text vertical edges, all 8 handles on math cards, labeled shapes, and SVG export fonts proportionally', () => {
  const txt = makeRect({
    id: 'txt_vert',
    type: 'text',
    x: 100,
    y: 100,
    width: 200,
    height: 40,
    fontSize: 20,
    text: 'Vertical resize',
  });
  const txtBounds = { x: 100, y: 100, width: 200, height: 40 };
  const stretchedS = computeResizedElement(txt, txt, txtBounds, 100, 100, 200, 80, 's', true);
  assert.equal(stretchedS.fontSize, 40);
  assert.equal(stretchedS.width, 200);
  assert.equal(stretchedS.height, 80);

  // Math card dragged by bottom edge 's' scales fontSize proportionally and SVG matches
  const eq = makeRect({
    id: 'eq_edge',
    type: 'math-equation',
    x: 100,
    y: 100,
    width: 240,
    height: 80,
    fontSize: 20,
    mathRaw: 'x^2 + 1',
  });
  const eqBounds = { x: 100, y: 100, width: 240, height: 80 };
  const eqEdgeS = computeResizedElement(eq, eq, eqBounds, 100, 100, 240, 320, 's', true);
  assert.equal(eqEdgeS.fontSize, 40); // sqrt(1 * 4) = 2x

  // Shrinking via NW keeps opposite corner pinned even if min width clamps
  const eqShrinkNW = computeResizedElement(eq, eq, eqBounds, 320, 160, 20, 20, 'nw', true);
  assert.equal(eqShrinkNW.width, 48);
  assert.equal(eqShrinkNW.x + eqShrinkNW.width, 340);
  assert.equal(eqShrinkNW.height, 36);
  assert.equal(eqShrinkNW.y + eqShrinkNW.height, 180);

  // Labeled shape scales text proportionally with container
  const boxWithText = makeRect({
    id: 'box_lbl',
    type: 'rectangle',
    x: 50,
    y: 50,
    width: 120,
    height: 80,
    fontSize: 20,
    text: 'Node A',
  });
  const scaledBox = computeResizedElement(
    boxWithText,
    boxWithText,
    { x: 50, y: 50, width: 120, height: 80 },
    50,
    50,
    240,
    160,
    'se',
    true
  );
  assert.equal(scaledBox.fontSize, 40);

  // Exported SVG honors scaled math fontSize proportionally
  const svgTheme = resolveWorkspaceTheme('emerald-minimal', 'emerald-minimal');
  const svgBefore = exportToSvg([eq], svgTheme, false);
  const svgAfter = exportToSvg([eqEdgeS], svgTheme, false);
  assert.ok(svgBefore.includes('font-size="18"'), `Expected font-size 18 in ${svgBefore}`);
  assert.ok(svgAfter.includes('font-size="37"'), `Expected scaled font-size 37 in ${svgAfter}`);
});

test('computeUniformGridMetrics keeps grid cell screen size constant across all zoom levels', () => {
  const zooms = [0.05, 0.12, 0.25, 0.5, 0.75, 1, 1.35, 2.5, 4, 6];
  for (const zoom of zooms) {
    const metrics = computeUniformGridMetrics(zoom, 24);
    assert.equal(metrics.screenStep, 24);
    assert.ok(Math.abs(metrics.worldStep * zoom - 24) < 1e-6);
  }
});
