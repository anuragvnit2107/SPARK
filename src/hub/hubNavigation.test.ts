import assert from 'node:assert/strict';
import test from 'node:test';
import { createSeedCanvases } from './canvasHubStore';
import {
  BOTTOM_DOCK_REVEAL_ZONE_PX,
  SpatialBoardCandidate,
  filterCanvasesByTitle,
  findNearestCanvasInDirection,
  shouldRevealBottomDock,
} from './hubNavigation';

test('filterCanvasesByTitle filters by title and ranks prefix matches first', () => {
  const seeds = createSeedCanvases('#064E3B');
  const all = filterCanvasesByTitle(seeds, '   ');
  assert.equal(all.length, seeds.length);

  const filterMatches = filterCanvasesByTitle(seeds, 'active');
  assert.equal(filterMatches.length, 1);
  assert.equal(filterMatches[0].id, 'canvas-rc-filter');

  const multiMatches = filterCanvasesByTitle(seeds, '3d');
  assert.ok(multiMatches.length >= 2);
  assert.equal(multiMatches[0].id, 'canvas-spatial-hud', 'Title starting with 3D ranks first');
  assert.ok(multiMatches.every((c) => c.title.toLowerCase().includes('3d')));
});

test('findNearestCanvasInDirection selects the closest neighbor in each cardinal direction', () => {
  const boards: SpatialBoardCandidate[] = [
    { id: 'center', position: { x: 0, y: 0, z: 0 } },
    { id: 'right-near', position: { x: 6, y: 0.5, z: -1 } },
    { id: 'right-far', position: { x: 14, y: 0, z: 0 } },
    { id: 'left-near', position: { x: -7, y: -0.4, z: 1 } },
    { id: 'up-near', position: { x: 0.5, y: 5.5, z: 0 } },
    { id: 'down-near', position: { x: -0.3, y: -5.0, z: 0.5 } },
  ];

  assert.equal(
    findNearestCanvasInDirection({ currentId: 'center', direction: 'right', candidates: boards }),
    'right-near'
  );
  assert.equal(
    findNearestCanvasInDirection({ currentId: 'center', direction: 'left', candidates: boards }),
    'left-near'
  );
  assert.equal(
    findNearestCanvasInDirection({ currentId: 'center', direction: 'up', candidates: boards }),
    'up-near'
  );
  assert.equal(
    findNearestCanvasInDirection({ currentId: 'center', direction: 'down', candidates: boards }),
    'down-near'
  );
  assert.equal(
    findNearestCanvasInDirection({ currentId: 'right-near', direction: 'right', candidates: boards }),
    'right-far'
  );
  assert.equal(
    findNearestCanvasInDirection({ currentId: 'right-far', direction: 'right', candidates: boards }),
    null
  );
});

test('findNearestCanvasInDirection respects rotated camera basis vectors', () => {
  const boards: SpatialBoardCandidate[] = [
    { id: 'a', position: { x: 0, y: 0, z: 0 } },
    { id: 'b', position: { x: 0, y: 0, z: -8 } },
    { id: 'c', position: { x: 0, y: 0, z: 8 } },
  ];

  // Camera rotated 90deg so screen-right points along -Z
  const nextRight = findNearestCanvasInDirection({
    currentId: 'a',
    direction: 'right',
    candidates: boards,
    cameraRight: { x: 0, y: 0, z: -1 },
    cameraUp: { x: 0, y: 1, z: 0 },
    cameraForward: { x: -1, y: 0, z: 0 },
  });
  assert.equal(nextRight, 'b');
});

test('shouldRevealBottomDock reveals only near bottom edge unless hovering or touch device', () => {
  assert.equal(
    shouldRevealBottomDock({ clientY: 450, viewportHeight: 900 }),
    false
  );
  assert.equal(
    shouldRevealBottomDock({ clientY: 900 - BOTTOM_DOCK_REVEAL_ZONE_PX - 1, viewportHeight: 900 }),
    false
  );
  assert.equal(
    shouldRevealBottomDock({ clientY: 900 - BOTTOM_DOCK_REVEAL_ZONE_PX, viewportHeight: 900 }),
    true
  );
  assert.equal(
    shouldRevealBottomDock({ clientY: 890, viewportHeight: 900 }),
    true
  );
  assert.equal(
    shouldRevealBottomDock({ clientY: 200, viewportHeight: 900, isHoveringDock: true }),
    true
  );
  assert.equal(
    shouldRevealBottomDock({ clientY: 200, viewportHeight: 900, isTouchDevice: true }),
    true
  );
});
