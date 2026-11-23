import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createBlankSpatialCanvas,
  createSeedCanvases,
  extractLastViewport,
  formatRelativeTime,
  reArrangeUnpinnedCanvases,
  searchCanvases,
} from '../hub/canvasHubStore';

test('createSeedCanvases builds non-empty interactive workspaces across all 4 categories', () => {
  const seeds = createSeedCanvases('#064E3B');
  assert.ok(seeds.length >= 8);
  const categories = new Set(seeds.map((s) => s.category));
  assert.deepEqual(
    categories,
    new Set(['Architecture', 'Circuits', 'Math', 'Wireframes'])
  );
  for (const seed of seeds) {
    assert.ok(seed.elements.length > 0, `Seed ${seed.id} should contain real elements`);
    assert.equal(seed.elementCount, seed.elements.length);
    assert.ok(seed.lastViewport.lastNoteSnippet.length > 0);
  }
});

test('extractLastViewport captures focus bounds and note snippet around camera viewport', () => {
  const seeds = createSeedCanvases('#064E3B');
  const mathCanvas = seeds.find((c) => c.category === 'Math');
  assert.ok(mathCanvas);
  const snapshot = extractLastViewport(mathCanvas.elements, { x: 0, y: 0, zoom: 1 }, 1280, 800);
  assert.ok(snapshot.previewElements.length > 0);
  assert.ok(snapshot.focusBounds.maxX > snapshot.focusBounds.minX);
  assert.ok(snapshot.focusBounds.maxY > snapshot.focusBounds.minY);
  assert.ok(snapshot.lastNoteSnippet.length > 0);
});

test('searchCanvases matches title, category, tags, and internal note/formula text', () => {
  const seeds = createSeedCanvases('#064E3B');
  const byFormula = searchCanvases(seeds, 'Jacobian');
  assert.ok(byFormula.some((c) => c.id === 'canvas-math-calculus'));

  const byTag = searchCanvases(seeds, 'mosfet');
  assert.ok(byTag.some((c) => c.id === 'canvas-pwm-driver'));

  const filteredCategory = searchCanvases(seeds, '', 'Circuits');
  assert.ok(filteredCategory.length >= 2);
  assert.ok(filteredCategory.every((c) => c.category === 'Circuits'));
});

test('createBlankSpatialCanvas initializes an empty canvas with valid viewport', () => {
  const blank = createBlankSpatialCanvas('My New Sketch', 'Wireframes');
  assert.equal(blank.title, 'My New Sketch');
  assert.equal(blank.category, 'Wireframes');
  assert.equal(blank.elementCount, 0);
  assert.equal(blank.elements.length, 0);
  assert.ok(blank.id.startsWith('canvas-'));
});

test('reArrangeUnpinnedCanvases keeps pinned canvases anchored while scattering unpinned ones', () => {
  const seeds = createSeedCanvases('#064E3B');
  const pinnedTarget = seeds[0];
  const pinnedPos = { x: 14.5, y: 3.25, z: -4.2, rotY: 0.25, pinned: true };
  const input = seeds.map((c, idx) =>
    idx === 0 ? { ...c, spatialPosition: pinnedPos } : { ...c, spatialPosition: { ...c.spatialPosition!, pinned: false } }
  );
  const arranged = reArrangeUnpinnedCanvases(input, 7);
  assert.deepEqual(arranged[0].spatialPosition, pinnedPos);
  assert.notDeepEqual(arranged[1].spatialPosition, input[1].spatialPosition);
});

test('formatRelativeTime returns readable relative labels', () => {
  const base = 1_700_000_000_000;
  assert.equal(formatRelativeTime(base - 10_000, base), 'Just now');
  assert.equal(formatRelativeTime(base - 5 * 60_000, base), '5m ago');
  assert.equal(formatRelativeTime(base - 3 * 3600_000, base), '3h ago');
  assert.equal(formatRelativeTime(base - 2 * 86400_000, base), '2d ago');
});
