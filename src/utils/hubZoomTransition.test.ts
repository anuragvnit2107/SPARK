import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CANVAS_EXIT_ZOOM_FLOOR,
  CLOSE_ZOOM_THRESHOLD,
  ENTER_CANVAS_DISTANCE,
  INSPECT_DISTANCE,
  UNFOCUS_ZOOM_THRESHOLD,
  computeEnterDurationMs,
  computeEnterTransitionVisuals,
  computeReturnFadeInOpacity,
  evaluateCanvasZoomOutExit,
  evaluateHubZoomState,
} from '../hub/hubZoomTransition';

test('evaluateHubZoomState stays in inspect without entering at INSPECT_DISTANCE', () => {
  const res = evaluateHubZoomState({
    focusedId: 'board-1',
    nearestCloseId: 'board-1',
    nearestCloseDist: INSPECT_DISTANCE,
    focusedBoardDist: INSPECT_DISTANCE,
    focusedBoardDot: 0.99,
    nearestBoardDot: 0.99,
    isFlying: false,
    isDragging: false,
    isEditingTitle: false,
    isEntering: false,
    suppressAutoEnter: false,
  });

  assert.equal(res.shouldUnfocus, false);
  assert.equal(res.enterCandidateId, null);
  assert.equal(res.closeInspectId, 'board-1');
});

test('evaluateHubZoomState triggers enterCandidateId when zooming past ENTER_CANVAS_DISTANCE', () => {
  const res = evaluateHubZoomState({
    focusedId: 'board-1',
    nearestCloseId: 'board-1',
    nearestCloseDist: ENTER_CANVAS_DISTANCE - 0.1,
    focusedBoardDist: ENTER_CANVAS_DISTANCE - 0.1,
    focusedBoardDot: 0.95,
    nearestBoardDot: 0.95,
    isFlying: false,
    isDragging: false,
    isEditingTitle: false,
    isEntering: false,
    suppressAutoEnter: false,
  });

  assert.equal(res.shouldUnfocus, false);
  assert.equal(res.enterCandidateId, 'board-1');
});

test('evaluateHubZoomState suppresses auto-enter while flying, dragging, editing title, or suppressed', () => {
  const base = {
    focusedId: 'board-1',
    nearestCloseId: 'board-1',
    nearestCloseDist: 3.9,
    focusedBoardDist: 3.9,
    focusedBoardDot: 0.98,
    nearestBoardDot: 0.98,
    isFlying: false,
    isDragging: false,
    isEditingTitle: false,
    isEntering: false,
    suppressAutoEnter: false,
  };

  assert.equal(evaluateHubZoomState({ ...base, isFlying: true }).enterCandidateId, null);
  assert.equal(evaluateHubZoomState({ ...base, isDragging: true }).enterCandidateId, null);
  assert.equal(evaluateHubZoomState({ ...base, isEditingTitle: true }).enterCandidateId, null);
  assert.equal(evaluateHubZoomState({ ...base, isEntering: true }).enterCandidateId, null);
  assert.equal(evaluateHubZoomState({ ...base, suppressAutoEnter: true }).enterCandidateId, null);
});

test('evaluateHubZoomState allows direct zoom-in on centered board even without prior click focus', () => {
  const res = evaluateHubZoomState({
    focusedId: null,
    nearestCloseId: 'board-2',
    nearestCloseDist: 4.2,
    focusedBoardDist: Infinity,
    focusedBoardDot: 0,
    nearestBoardDot: 0.88,
    isFlying: false,
    isDragging: false,
    isEditingTitle: false,
    isEntering: false,
    suppressAutoEnter: false,
  });

  assert.equal(res.enterCandidateId, 'board-2');

  const offAngle = evaluateHubZoomState({
    focusedId: null,
    nearestCloseId: 'board-2',
    nearestCloseDist: 4.2,
    focusedBoardDist: Infinity,
    focusedBoardDot: 0,
    nearestBoardDot: 0.5,
    isFlying: false,
    isDragging: false,
    isEditingTitle: false,
    isEntering: false,
    suppressAutoEnter: false,
  });
  assert.equal(offAngle.enterCandidateId, null);
});

test('evaluateHubZoomState unfocuses cleanly when zooming out past UNFOCUS_ZOOM_THRESHOLD', () => {
  const stillFocused = evaluateHubZoomState({
    focusedId: 'board-1',
    nearestCloseId: null,
    nearestCloseDist: Infinity,
    focusedBoardDist: CLOSE_ZOOM_THRESHOLD + 1.0,
    focusedBoardDot: 0.9,
    nearestBoardDot: 0,
    isFlying: false,
    isDragging: false,
    isEditingTitle: false,
    isEntering: false,
    suppressAutoEnter: false,
  });
  assert.equal(stillFocused.shouldUnfocus, false);
  assert.equal(stillFocused.closeInspectId, 'board-1');

  const unfocused = evaluateHubZoomState({
    focusedId: 'board-1',
    nearestCloseId: null,
    nearestCloseDist: Infinity,
    focusedBoardDist: UNFOCUS_ZOOM_THRESHOLD + 0.5,
    focusedBoardDot: 0.9,
    nearestBoardDot: 0,
    isFlying: false,
    isDragging: false,
    isEditingTitle: false,
    isEntering: false,
    suppressAutoEnter: false,
  });
  assert.equal(unfocused.shouldUnfocus, true);
  assert.equal(unfocused.closeInspectId, null);
});

test('computeEnterTransitionVisuals fades HUD early and crossfades hub smoothly', () => {
  const start = computeEnterTransitionVisuals(0);
  assert.equal(start.hudOpacity, 1);
  assert.equal(start.hubOpacity, 1);

  const mid = computeEnterTransitionVisuals(0.5);
  assert.equal(mid.hudOpacity, 0);
  assert.ok(mid.hubOpacity > 0 && mid.hubOpacity < 1);

  const end = computeEnterTransitionVisuals(1);
  assert.equal(end.hudOpacity, 0);
  assert.equal(end.hubOpacity, 0);
});

test('computeEnterDurationMs scales cleanly with distance and computeReturnFadeInOpacity clamps 0..1', () => {
  assert.equal(computeEnterDurationMs(5.0), 280);
  assert.equal(computeEnterDurationMs(INSPECT_DISTANCE), 280);
  assert.ok(computeEnterDurationMs(30) > 400);
  assert.equal(computeEnterDurationMs(100), 520);

  assert.equal(computeReturnFadeInOpacity(0, 220), 0);
  assert.equal(computeReturnFadeInOpacity(220, 220), 1);
});

test('evaluateCanvasZoomOutExit exits only after deliberate zoom-out ticks at zoom floor', () => {
  let state = { floorHitCount: 0, lastHitAt: 0 };
  const normal = evaluateCanvasZoomOutExit(0.5, true, 1000, state);
  assert.equal(normal.shouldExitToHub, false);
  state = normal.nextState;

  const firstFloor = evaluateCanvasZoomOutExit(CANVAS_EXIT_ZOOM_FLOOR, true, 1100, state);
  assert.equal(firstFloor.shouldExitToHub, false);
  assert.equal(firstFloor.nextState.floorHitCount, 1);
  state = firstFloor.nextState;

  const secondFloor = evaluateCanvasZoomOutExit(CANVAS_EXIT_ZOOM_FLOOR, true, 1400, state);
  assert.equal(secondFloor.shouldExitToHub, true);
});
