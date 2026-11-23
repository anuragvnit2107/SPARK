import * as THREE from 'three';
import { CANVAS_THEMES, resolveWorkspaceTheme } from '../themes';
import { drawElementOnContext, drawWireJunctionDots } from '../canvasRenderer';
import { computeUniformGridMetrics, computeWireJunctions } from '../sketchEngine';
import { SpatialCanvasRecord } from './canvasHubStore';

export type BoardTextureMode = 'overview' | 'inspect';

export function renderBoardCanvas(
  record: SpatialCanvasRecord,
  mode: BoardTextureMode,
  _isFocused = false,
  onImageLoad?: () => void
): HTMLCanvasElement {
  const width = mode === 'inspect' ? 1440 : 768;
  const height = mode === 'inspect' ? 900 : 480;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  const canvasThemeId = record.canvasThemeId || 'emerald-minimal';
  const canvasTheme = CANVAS_THEMES[canvasThemeId] || CANVAS_THEMES['emerald-minimal'];
  const forgeTheme = resolveWorkspaceTheme(
    canvasTheme.mode === 'dark' ? 'black-slate' : 'emerald-minimal',
    canvasTheme.id
  );

  // Exact canvas background matching the workspace theme
  ctx.fillStyle = canvasTheme.canvasBg;
  ctx.fillRect(0, 0, width, height);

  const cam = record.camera || { x: 0, y: 0, zoom: 1 };
  const safeZoom = Math.max(0.1, cam.zoom || 1);
  const refW = Math.max(320, record.lastViewport?.viewportWidth || 1280);
  const refH = Math.max(200, record.lastViewport?.viewportHeight || 800);

  const fitScale = Math.min(width / refW, height / refH);
  const padX = (width - refW * fitScale) / 2;
  const padY = (height - refH * fitScale) / 2;

  const camTexX = padX + cam.x * fitScale;
  const camTexY = padY + cam.y * fitScale;
  const effectiveZoom = safeZoom * fitScale;

  // Exact uniform graph-paper grid matching Canvas.tsx
  const { screenStep } = computeUniformGridMetrics(effectiveZoom, 24);
  if (screenStep >= 6) {
    const offsetX = ((camTexX % screenStep) + screenStep) % screenStep;
    const offsetY = ((camTexY % screenStep) + screenStep) % screenStep;

    ctx.save();
    ctx.strokeStyle = canvasTheme.gridColor;
    ctx.globalAlpha = 1;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = offsetX; x <= width + 0.5; x += screenStep) {
      const sx = Math.round(x) + 0.5;
      if (sx < -1 || sx > width + 1) continue;
      ctx.moveTo(sx, 0);
      ctx.lineTo(sx, height);
    }
    for (let y = offsetY; y <= height + 0.5; y += screenStep) {
      const sy = Math.round(y) + 0.5;
      if (sy < -1 || sy > height + 1) continue;
      ctx.moveTo(0, sy);
      ctx.lineTo(width, sy);
    }
    ctx.stroke();
    ctx.restore();
  }

  // Exact camera transform where the user left off
  ctx.save();
  ctx.translate(camTexX, camTexY);
  ctx.scale(effectiveZoom, effectiveZoom);

  const activeElements = (record.elements || []).filter((el) => !el.isDeleted);
  const frames = activeElements.filter((el) => el.type === 'frame');
  const others = activeElements.filter((el) => el.type !== 'frame');

  for (const frame of frames) {
    drawElementOnContext(ctx, frame, forgeTheme, {
      liveWebpageOverlay: false,
      onImageLoad,
    });
  }

  for (const el of others) {
    drawElementOnContext(ctx, el, forgeTheme, {
      liveWebpageOverlay: false,
      onImageLoad,
    });
  }

  const junctions = computeWireJunctions(activeElements);
  if (junctions.length > 0) {
    drawWireJunctionDots(ctx, junctions, forgeTheme.defaultInk);
  }

  ctx.restore();

  // In far overview mode only, show a minimal title strip at the bottom edge so boards
  // can be recognized across the 3D space; in close inspect mode, show 100% pure canvas.
  if (mode === 'overview') {
    const isDark = canvasTheme.mode === 'dark';
    const barH = 54;
    ctx.save();
    ctx.fillStyle = isDark ? 'rgba(10, 14, 22, 0.78)' : 'rgba(255, 255, 255, 0.84)';
    ctx.fillRect(0, height - barH, width, barH);

    ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(15, 23, 42, 0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, height - barH + 0.5);
    ctx.lineTo(width, height - barH + 0.5);
    ctx.stroke();

    ctx.fillStyle = canvasTheme.defaultInk;
    ctx.font = '700 21px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const maxTitleChars = 40;
    const titleText =
      record.title.length > maxTitleChars
        ? `${record.title.slice(0, maxTitleChars - 1)}…`
        : record.title;
    ctx.fillText(titleText, 22, height - barH / 2);

    ctx.fillStyle = isDark ? 'rgba(226, 232, 240, 0.65)' : 'rgba(71, 85, 105, 0.78)';
    ctx.font = '600 14px "JetBrains Mono", monospace';
    ctx.textAlign = 'right';
    ctx.fillText(
      `${record.elementCount} ${record.elementCount === 1 ? 'item' : 'items'}`,
      width - 22,
      height - barH / 2
    );
    ctx.restore();
  }

  return canvas;
}

export function createBoardCanvasTexture(
  record: SpatialCanvasRecord,
  mode: BoardTextureMode,
  maxAnisotropy = 4,
  isFocused = false,
  onAsyncRefresh?: () => void
): THREE.CanvasTexture {
  const canvas = renderBoardCanvas(record, mode, isFocused, onAsyncRefresh);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = Math.min(8, Math.max(1, maxAnisotropy));
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

const thumbnailCache = new Map<string, string>();

export function renderBoardThumbnailDataUrl(
  record: SpatialCanvasRecord,
  thumbWidth = 288,
  thumbHeight = 160
): string {
  const cam = record.camera || { x: 0, y: 0, zoom: 1 };
  const key = `${record.id}|${record.updatedAt}|${record.elementCount}|${record.canvasThemeId || ''}|${cam.x.toFixed(0)}|${cam.y.toFixed(0)}|${cam.zoom.toFixed(2)}|${thumbWidth}x${thumbHeight}`;
  const cached = thumbnailCache.get(key);
  if (cached) return cached;

  const src = renderBoardCanvas(record, 'inspect', false);
  const dst = document.createElement('canvas');
  dst.width = thumbWidth;
  dst.height = thumbHeight;
  const dctx = dst.getContext('2d');
  if (dctx) {
    dctx.drawImage(src, 0, 0, thumbWidth, thumbHeight);
  }
  const url = dst.toDataURL('image/png');
  if (thumbnailCache.size > 48) {
    const firstKey = thumbnailCache.keys().next().value;
    if (firstKey) thumbnailCache.delete(firstKey);
  }
  thumbnailCache.set(key, url);
  return url;
}

