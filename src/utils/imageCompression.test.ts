import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canSyncBoardWithinFirestoreLimit,
  computeCompressedImageDimensions,
  estimateUtf8ByteLength,
  FIRESTORE_SAFE_BOARD_LIMIT_BYTES,
  selectSmallestCompressedDataUrl,
} from './imageCompression';

test('computeCompressedImageDimensions caps large images proportionally at maxDimension', () => {
  const landscape = computeCompressedImageDimensions(3840, 2160, 1280);
  assert.equal(landscape.width, 1280);
  assert.equal(landscape.height, 720);

  const portrait = computeCompressedImageDimensions(1600, 3200, 1280);
  assert.equal(portrait.width, 640);
  assert.equal(portrait.height, 1280);

  const small = computeCompressedImageDimensions(400, 300, 1280);
  assert.equal(small.width, 400);
  assert.equal(small.height, 300);
});

test('selectSmallestCompressedDataUrl picks the lightest valid image encoding', () => {
  const tinyWebp = 'data:image/webp;base64,UklGRh4AAABXRUJQ';
  const largerJpeg = `data:image/jpeg;base64,${'A'.repeat(200)}`;
  const invalid = 'not-a-data-url';

  const picked = selectSmallestCompressedDataUrl([invalid, largerJpeg, tinyWebp]);
  assert.equal(picked, tinyWebp);
  assert.equal(selectSmallestCompressedDataUrl([invalid]), '');
});

test('canSyncBoardWithinFirestoreLimit enforces safe margin below Firestore 1MB limit', () => {
  const okBoard = {
    title: 'Small Circuit',
    elements: [{ id: 'el_1', type: 'rectangle' }],
  };
  const okRes = canSyncBoardWithinFirestoreLimit(okBoard);
  assert.equal(okRes.ok, true);
  assert.ok(okRes.bytes < 500);
  assert.equal(okRes.limitBytes, FIRESTORE_SAFE_BOARD_LIMIT_BYTES);

  const oversizedBoard = {
    title: 'Huge Board',
    elements: [
      {
        id: 'img_1',
        type: 'image',
        imageDataUrl: `data:image/webp;base64,${'X'.repeat(920_000)}`,
      },
    ],
  };
  const failRes = canSyncBoardWithinFirestoreLimit(oversizedBoard);
  assert.equal(failRes.ok, false);
  assert.ok(failRes.bytes > FIRESTORE_SAFE_BOARD_LIMIT_BYTES);
  assert.ok(estimateUtf8ByteLength('hello') === 5);
});
