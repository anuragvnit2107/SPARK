import { CameraState, Point, WhiteboardElement } from '../types';

export const SUPPORTED_IMAGE_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
  'image/svg+xml',
]);

const SUPPORTED_IMAGE_EXT_RE = /\.(png|jpe?g|webp|gif|svg)$/i;

export function isSupportedImageFile(file: { type?: string; name?: string } | null | undefined): boolean {
  if (!file) return false;
  const mime = (file.type || '').trim().toLowerCase();
  if (mime && SUPPORTED_IMAGE_MIME_TYPES.has(mime)) {
    return true;
  }
  const name = (file.name || '').trim();
  return Boolean(name && SUPPORTED_IMAGE_EXT_RE.test(name));
}

export interface ClipboardItemLike {
  kind: string;
  type: string;
  getAsFile: () => File | null;
}

export interface ClipboardDataLike {
  items?: ArrayLike<ClipboardItemLike> | null;
  files?: ArrayLike<File> | null;
  getData?: (format: string) => string;
}

export function extractClipboardImageFiles(
  clipboardData: ClipboardDataLike | null | undefined
): File[] {
  if (!clipboardData) return [];

  const collected: File[] = [];
  const seenKeys = new Set<string>();

  const pushUnique = (file: File | null | undefined) => {
    if (!file || !isSupportedImageFile(file)) return;
    const key = `${file.name || ''}::${file.size}::${file.type || ''}`;
    if (seenKeys.has(key)) return;
    seenKeys.add(key);
    collected.push(file);
  };

  if (clipboardData.items) {
    for (let i = 0; i < clipboardData.items.length; i++) {
      const item = clipboardData.items[i];
      if (!item || item.kind !== 'file') continue;
      if (item.type && !isSupportedImageFile({ type: item.type })) continue;
      pushUnique(item.getAsFile());
    }
  }

  if (clipboardData.files) {
    for (let i = 0; i < clipboardData.files.length; i++) {
      pushUnique(clipboardData.files[i]);
    }
  }

  if (collected.length === 0 && typeof clipboardData.getData === 'function' && typeof File !== 'undefined') {
    const svgText = clipboardData.getData('image/svg+xml')?.trim();
    if (svgText && svgText.includes('<svg')) {
      pushUnique(new File([svgText], 'pasted.svg', { type: 'image/svg+xml' }));
    }
  }

  return collected;
}

const NON_TEXT_INPUT_TYPES = new Set([
  'button',
  'checkbox',
  'color',
  'file',
  'hidden',
  'image',
  'radio',
  'range',
  'reset',
  'submit',
]);

export function isEditablePasteTarget(
  target: {
    tagName?: string;
    type?: string;
    isContentEditable?: boolean;
    closest?: (selector: string) => unknown;
  } | null | undefined,
  activeCanvasTextEditing = false
): boolean {
  if (activeCanvasTextEditing) return true;
  if (!target) return false;
  const tag = (target.tagName || '').toUpperCase();
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (tag === 'INPUT') {
    const inputType = (target.type || 'text').toLowerCase();
    return !NON_TEXT_INPUT_TYPES.has(inputType);
  }
  if (target.isContentEditable) return true;
  if (typeof target.closest === 'function') {
    return Boolean(target.closest('[contenteditable="true"], [contenteditable=""]'));
  }
  return false;
}

export interface ImagePlacementParams {
  naturalWidth: number;
  naturalHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  camera: CameraState;
  cursorWorld?: Point | null;
  offsetIndex?: number;
}

export function computeFittedImagePlacement({
  naturalWidth,
  naturalHeight,
  viewportWidth,
  viewportHeight,
  camera,
  cursorWorld,
  offsetIndex = 0,
}: ImagePlacementParams): { x: number; y: number; width: number; height: number } {
  const rawW = Number.isFinite(naturalWidth) && naturalWidth > 0 ? naturalWidth : 360;
  const rawH = Number.isFinite(naturalHeight) && naturalHeight > 0 ? naturalHeight : 260;

  const safeZoom = Math.max(0.05, Number.isFinite(camera.zoom) && camera.zoom > 0 ? camera.zoom : 1);
  const safeVpW = Math.max(240, viewportWidth || 1280);
  const safeVpH = Math.max(240, viewportHeight || 720);

  const maxWorldW = Math.max(180, safeVpW * 0.65) / safeZoom;
  const maxWorldH = Math.max(180, safeVpH * 0.62) / safeZoom;

  const scale = Math.min(1, maxWorldW / rawW, maxWorldH / rawH);
  const width = Math.max(16, Math.round(rawW * scale));
  const height = Math.max(16, Math.round(rawH * scale));

  const baseCenterX =
    cursorWorld && Number.isFinite(cursorWorld.x)
      ? cursorWorld.x
      : (safeVpW / 2 - camera.x) / safeZoom;
  const baseCenterY =
    cursorWorld && Number.isFinite(cursorWorld.y)
      ? cursorWorld.y
      : (safeVpH / 2 - camera.y) / safeZoom;

  const cascade = (offsetIndex || 0) * (24 / safeZoom);

  return {
    x: baseCenterX - width / 2 + cascade,
    y: baseCenterY - height / 2 + cascade,
    width,
    height,
  };
}

export function buildImageWhiteboardElement(params: {
  dataUrl: string;
  x: number;
  y: number;
  width: number;
  height: number;
  strokeColor: string;
}): WhiteboardElement {
  const now = Date.now();
  return {
    id: `img_${now.toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    type: 'image',
    x: params.x,
    y: params.y,
    width: params.width,
    height: params.height,
    angle: 0,
    strokeColor: params.strokeColor,
    backgroundColor: 'transparent',
    fillStyle: 'none',
    strokeWidth: 1,
    strokeStyle: 'solid',
    sloppiness: 0,
    opacity: 100,
    seed: Math.floor(Math.random() * 10000),
    fontFamily: 'cleansans',
    fontSize: 16,
    imageDataUrl: params.dataUrl,
    version: 1,
    updatedAt: now,
  };
}
