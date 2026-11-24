import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildImageWhiteboardElement,
  computeFittedImagePlacement,
  extractClipboardImageFiles,
  isEditablePasteTarget,
  isSupportedImageFile,
} from './imagePaste';

test('isSupportedImageFile accepts PNG, JPEG, WebP, GIF, and SVG by MIME or extension', () => {
  assert.equal(isSupportedImageFile({ type: 'image/png', name: '' }), true);
  assert.equal(isSupportedImageFile({ type: 'image/jpeg', name: 'photo.jpg' }), true);
  assert.equal(isSupportedImageFile({ type: 'image/webp', name: 'pic.webp' }), true);
  assert.equal(isSupportedImageFile({ type: 'image/gif', name: 'anim.gif' }), true);
  assert.equal(isSupportedImageFile({ type: 'image/svg+xml', name: 'icon.svg' }), true);
  assert.equal(isSupportedImageFile({ type: '', name: 'screenshot.PNG' }), true);
  assert.equal(isSupportedImageFile({ type: '', name: 'diagram.svg' }), true);
  assert.equal(isSupportedImageFile({ type: 'text/plain', name: 'notes.txt' }), false);
  assert.equal(isSupportedImageFile({ type: 'application/json', name: 'scene.json' }), false);
});

test('extractClipboardImageFiles extracts deduplicated image files from items and files', () => {
  const pngFile = new File(['abc'], 'clipboard.png', { type: 'image/png' });
  const jpgFile = new File(['defg'], 'photo.jpeg', { type: '' });
  const textFile = new File(['hello'], 'readme.txt', { type: 'text/plain' });

  const extracted = extractClipboardImageFiles({
    items: [
      { kind: 'string', type: 'text/plain', getAsFile: () => null },
      { kind: 'file', type: 'image/png', getAsFile: () => pngFile },
    ],
    files: [pngFile, jpgFile, textFile],
  });

  assert.equal(extracted.length, 2);
  assert.equal(extracted[0].name, 'clipboard.png');
  assert.equal(extracted[1].name, 'photo.jpeg');
});

test('extractClipboardImageFiles supports raw image/svg+xml string items when no File exists', () => {
  const extracted = extractClipboardImageFiles({
    items: [],
    files: [],
    getData: (fmt) => (fmt === 'image/svg+xml' ? '<svg viewBox="0 0 10 10"></svg>' : ''),
  });

  assert.equal(extracted.length, 1);
  assert.equal(extracted[0].type, 'image/svg+xml');
});

test('isEditablePasteTarget protects text inputs, textareas, contentEditable, and active canvas editing', () => {
  assert.equal(isEditablePasteTarget({ tagName: 'INPUT', type: 'text' }, false), true);
  assert.equal(isEditablePasteTarget({ tagName: 'TEXTAREA' }, false), true);
  assert.equal(isEditablePasteTarget({ tagName: 'DIV', isContentEditable: true }, false), true);
  assert.equal(
    isEditablePasteTarget({ tagName: 'SPAN', closest: () => ({}) }, false),
    true
  );
  assert.equal(isEditablePasteTarget({ tagName: 'CANVAS' }, true), true);

  assert.equal(isEditablePasteTarget({ tagName: 'CANVAS' }, false), false);
  assert.equal(isEditablePasteTarget({ tagName: 'BODY' }, false), false);
  assert.equal(isEditablePasteTarget({ tagName: 'INPUT', type: 'button' }, false), false);
});

test('computeFittedImagePlacement scales overly large images proportionally and centers on viewport or cursor', () => {
  const huge = computeFittedImagePlacement({
    naturalWidth: 3840,
    naturalHeight: 2160,
    viewportWidth: 1440,
    viewportHeight: 900,
    camera: { x: 0, y: 0, zoom: 1 },
  });

  assert.ok(huge.width <= 1440 * 0.65 + 1);
  assert.ok(huge.height <= 900 * 0.62 + 1);
  assert.ok(Math.abs(huge.width / huge.height - 16 / 9) < 0.05);
  assert.ok(Math.abs(huge.x + huge.width / 2 - 720) <= 1);
  assert.ok(Math.abs(huge.y + huge.height / 2 - 450) <= 1);

  const atCursor = computeFittedImagePlacement({
    naturalWidth: 200,
    naturalHeight: 100,
    viewportWidth: 1440,
    viewportHeight: 900,
    camera: { x: 100, y: 50, zoom: 2 },
    cursorWorld: { x: 300, y: 200 },
  });

  assert.equal(atCursor.width, 200);
  assert.equal(atCursor.height, 100);
  assert.equal(atCursor.x, 200);
  assert.equal(atCursor.y, 150);
});

test('buildImageWhiteboardElement creates a standard image element compatible with Canvas & persistence', () => {
  const el = buildImageWhiteboardElement({
    dataUrl: 'data:image/png;base64,AAAA',
    x: 100,
    y: 200,
    width: 320,
    height: 180,
    strokeColor: '#064e3b',
  });

  assert.equal(el.type, 'image');
  assert.equal(el.imageDataUrl, 'data:image/png;base64,AAAA');
  assert.equal(el.x, 100);
  assert.equal(el.y, 200);
  assert.equal(el.width, 320);
  assert.equal(el.height, 180);
  assert.equal(el.version, 1);
  assert.ok(el.id.startsWith('img_'));
});
