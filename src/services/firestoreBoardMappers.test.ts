import assert from 'node:assert/strict';
import test from 'node:test';
import { SpatialCanvasRecord, extractLastViewport } from '../hub/canvasHubStore';
import {
  buildFirestoreBoardFields,
  buildFirestoreBoardUpdatePatch,
  buildShareBoardUrl,
  checkBoardPayloadWithinFirestoreLimit,
  createDebouncedTask,
  firestoreDocToSpatialCanvas,
  isValidBoardId,
  mergeCloudBoards,
  parseJoinBoardInput,
  stripUndefinedDeep,
} from './firestoreBoardMappers';

function makeRecord(overrides: Partial<SpatialCanvasRecord> = {}): SpatialCanvasRecord {
  const elements = overrides.elements || [
    {
      id: 'el-1',
      type: 'rectangle',
      x: 10,
      y: 20,
      width: 120,
      height: 80,
      angle: 0,
      strokeColor: '#064E3B',
      backgroundColor: 'transparent',
      fillStyle: 'none',
      strokeWidth: 2,
      strokeStyle: 'solid',
      sloppiness: 1,
      opacity: 100,
      seed: 11,
      fontFamily: 'cleansans',
      fontSize: 16,
      text: undefined,
      version: 1,
      updatedAt: 1000,
    },
  ];
  return {
    id: 'board-alpha-1',
    title: 'Filter Prototype',
    category: 'Circuits',
    tags: ['rc', 'spice'],
    createdAt: 1000,
    updatedAt: 2000,
    elementCount: elements.length,
    camera: { x: 10, y: 20, zoom: 1 },
    canvasThemeId: 'emerald-minimal',
    spatialPosition: { x: 1, y: 2, z: 3, rotY: 0.1, pinned: true },
    elements,
    lastViewport: extractLastViewport(elements),
    ownerId: 'owner-uid-1',
    collaborators: ['collab-uid-2'],
    shareEnabled: true,
    ...overrides,
  };
}

test('stripUndefinedDeep removes nested undefined properties and NaN values', () => {
  const cleaned = stripUndefinedDeep({
    id: 'rect-1',
    text: undefined,
    zoom: Number.NaN,
    nested: { a: 1, b: undefined },
    list: [1, undefined, { x: 2, y: undefined }],
  });

  assert.equal('text' in cleaned, false);
  assert.equal(cleaned.zoom, 0);
  assert.deepEqual(cleaned.nested, { a: 1 });
  assert.deepEqual(cleaned.list, [1, { x: 2 }]);
});

test('buildFirestoreBoardUpdatePatch respects owner vs collaborator allowed keys', () => {
  const record = makeRecord();

  const ownerPatch = buildFirestoreBoardUpdatePatch(record, 'owner-uid-1');
  assert.equal('collaborators' in ownerPatch, true);
  assert.equal('shareEnabled' in ownerPatch, true);
  assert.equal('category' in ownerPatch, true);
  assert.equal('ownerId' in ownerPatch, false);
  assert.equal('createdAt' in ownerPatch, false);

  const collabPatch = buildFirestoreBoardUpdatePatch(record, 'collab-uid-2');
  assert.deepEqual(Object.keys(collabPatch).sort(), [
    'camera',
    'canvasThemeId',
    'elementCount',
    'elements',
    'lastNoteSnippet',
    'title',
  ]);
});

test('buildFirestoreBoardFields clamps zoom and strips undefined from elements', () => {
  const record = makeRecord({
    camera: { x: 5, y: 6, zoom: 99 },
    collaborators: ['owner-uid-1', 'bad id with space', 'collab-uid-2', 'collab-uid-2'],
  });
  const fields = buildFirestoreBoardFields(record, 'owner-uid-1');

  assert.equal(fields.camera.zoom, 10);
  assert.deepEqual(fields.collaborators, ['collab-uid-2']);
  assert.equal('text' in fields.elements[0], false);
});

test('firestoreDocToSpatialCanvas converts Firestore timestamps cleanly', () => {
  const record = firestoreDocToSpatialCanvas('board-xyz', {
    ownerId: 'user-1',
    title: 'Shared Board',
    category: 'Math',
    tags: ['ode'],
    elements: [],
    collaborators: ['user-2'],
    shareEnabled: true,
    camera: { x: 12, y: 24, zoom: 1.2 },
    canvasThemeId: 'black-slate',
    elementCount: 0,
    createdAt: { toMillis: () => 1700000000000 },
    updatedAt: { toMillis: () => 1700000005000 },
  });

  assert.equal(record.id, 'board-xyz');
  assert.equal(record.createdAt, 1700000000000);
  assert.equal(record.updatedAt, 1700000005000);
  assert.equal(record.ownerId, 'user-1');
  assert.deepEqual(record.collaborators, ['user-2']);
  assert.equal(record.shareEnabled, true);
});

test('mergeCloudBoards deduplicates by ID and sorts descending by updatedAt', () => {
  const ownedA = makeRecord({ id: 'a', updatedAt: 100 });
  const ownedB = makeRecord({ id: 'b', updatedAt: 300 });
  const sharedB = makeRecord({ id: 'b', title: 'Stale Shared', updatedAt: 50 });
  const sharedC = makeRecord({ id: 'c', updatedAt: 250 });

  const merged = mergeCloudBoards([ownedA, ownedB], [sharedB, sharedC]);
  assert.deepEqual(
    merged.map((m) => m.id),
    ['b', 'c', 'a']
  );
  assert.equal(merged[0].title, 'Filter Prototype');
});

test('share URL and Room ID parsing handles full links and raw IDs safely', () => {
  const url = buildShareBoardUrl('https://spark.app/', 'canvas-rc-filter');
  assert.equal(url, 'https://spark.app/?board=canvas-rc-filter');
  assert.equal(parseJoinBoardInput(url), 'canvas-rc-filter');
  assert.equal(parseJoinBoardInput('  canvas-math-calculus '), 'canvas-math-calculus');
  assert.equal(parseJoinBoardInput('bad/id/here!'), null);
  assert.equal(isValidBoardId('valid_board-123'), true);
  assert.equal(isValidBoardId('invalid board'), false);
});

test('checkBoardPayloadWithinFirestoreLimit rejects payloads exceeding 900KB', () => {
  const hugeString = 'x'.repeat(920_000);
  const res = checkBoardPayloadWithinFirestoreLimit({ elements: [{ id: 'img', imageDataUrl: hugeString }] });
  assert.equal(res.ok, false);
  assert.ok(res.bytes > 900_000);
});

test('createDebouncedTask flushes pending save immediately on demand', async () => {
  const task = createDebouncedTask(5000);
  let calls = 0;
  task.schedule(() => {
    calls += 1;
  });
  assert.equal(calls, 0);
  task.flush();
  assert.equal(calls, 1);
  // Second flush is a no-op
  task.flush();
  assert.equal(calls, 1);
});
