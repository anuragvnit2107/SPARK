export const FIRESTORE_HARD_LIMIT_BYTES = 1_048_576;
export const FIRESTORE_SAFE_BOARD_LIMIT_BYTES = 900_000;
export const DEFAULT_IMAGE_MAX_DIM = 1280;
export const DEFAULT_IMAGE_TARGET_BYTES = 150_000;
export const DEFAULT_IMAGE_QUALITY = 0.75;

export function estimateUtf8ByteLength(input: string): number {
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(input).length;
  }
  return input.length * 2;
}

export function estimateFirestorePayloadBytes(docData: unknown): number {
  try {
    return estimateUtf8ByteLength(JSON.stringify(docData));
  } catch {
    return FIRESTORE_HARD_LIMIT_BYTES;
  }
}

export function canSyncBoardWithinFirestoreLimit(
  docData: unknown,
  maxBytes = FIRESTORE_SAFE_BOARD_LIMIT_BYTES
): { ok: boolean; bytes: number; limitBytes: number } {
  const bytes = estimateFirestorePayloadBytes(docData);
  return {
    ok: bytes <= maxBytes,
    bytes,
    limitBytes: maxBytes,
  };
}

export function computeCompressedImageDimensions(
  naturalWidth: number,
  naturalHeight: number,
  maxDimension = DEFAULT_IMAGE_MAX_DIM
): { width: number; height: number } {
  const safeW = Number.isFinite(naturalWidth) && naturalWidth > 0 ? naturalWidth : 640;
  const safeH = Number.isFinite(naturalHeight) && naturalHeight > 0 ? naturalHeight : 480;
  const maxSide = Math.max(safeW, safeH);
  if (maxSide <= maxDimension) {
    return {
      width: Math.max(1, Math.round(safeW)),
      height: Math.max(1, Math.round(safeH)),
    };
  }
  const scale = maxDimension / maxSide;
  return {
    width: Math.max(1, Math.round(safeW * scale)),
    height: Math.max(1, Math.round(safeH * scale)),
  };
}

export function selectSmallestCompressedDataUrl(candidates: string[]): string {
  const valid = candidates.filter((c) => typeof c === 'string' && c.startsWith('data:image/'));
  if (valid.length === 0) return '';
  let best = valid[0];
  let bestBytes = estimateUtf8ByteLength(best);
  for (let i = 1; i < valid.length; i++) {
    const candidateBytes = estimateUtf8ByteLength(valid[i]);
    if (candidateBytes < bestBytes) {
      best = valid[i];
      bestBytes = candidateBytes;
    }
  }
  return best;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.onload = () => resolve(String(reader.result || ''));
    reader.readAsDataURL(file);
  });
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onerror = () => reject(new Error('Failed to decode image'));
    img.onload = () => resolve(img);
    img.src = src;
  });
}

function canvasHasTransparency(ctx: CanvasRenderingContext2D, width: number, height: number): boolean {
  try {
    // Sample a small grid of pixels cleanly without scanning millions of pixels
    const sampleW = Math.min(width, 64);
    const sampleH = Math.min(height, 64);
    const stepX = Math.max(1, Math.floor(width / sampleW));
    const stepY = Math.max(1, Math.floor(height / sampleH));
    const data = ctx.getImageData(0, 0, width, height).data;
    for (let y = 0; y < height; y += stepY) {
      for (let x = 0; x < width; x += stepX) {
        if (data[(y * width + x) * 4 + 3] < 250) {
          return true;
        }
      }
    }
    return false;
  } catch {
    return true;
  }
}

export interface CompressedImageResult {
  dataUrl: string;
  naturalWidth: number;
  naturalHeight: number;
  byteLength: number;
  wasCompressed: boolean;
}

export async function compressImageFileToDataUrl(
  file: File,
  options?: {
    maxDimension?: number;
    quality?: number;
    targetBytes?: number;
  }
): Promise<CompressedImageResult | null> {
  const maxDimension = options?.maxDimension ?? DEFAULT_IMAGE_MAX_DIM;
  const quality = options?.quality ?? DEFAULT_IMAGE_QUALITY;
  const targetBytes = options?.targetBytes ?? DEFAULT_IMAGE_TARGET_BYTES;

  let rawDataUrl = '';
  try {
    rawDataUrl = await readFileAsDataUrl(file);
  } catch {
    return null;
  }
  if (!rawDataUrl) return null;

  let img: HTMLImageElement;
  try {
    img = await loadImageElement(rawDataUrl);
  } catch {
    return null;
  }

  const naturalWidth = img.naturalWidth || img.width || 360;
  const naturalHeight = img.naturalHeight || img.height || 260;
  const rawBytes = estimateUtf8ByteLength(rawDataUrl);

  // Preserve lightweight SVGs and small animated GIFs verbatim if already within budget
  const mime = (file.type || '').toLowerCase();
  if ((mime === 'image/svg+xml' || mime === 'image/gif') && rawBytes <= targetBytes) {
    return {
      dataUrl: rawDataUrl,
      naturalWidth,
      naturalHeight,
      byteLength: rawBytes,
      wasCompressed: false,
    };
  }

  if (typeof document === 'undefined') {
    return {
      dataUrl: rawDataUrl,
      naturalWidth,
      naturalHeight,
      byteLength: rawBytes,
      wasCompressed: false,
    };
  }

  const encodeAt = (maxDim: number, q: number): string => {
    const dims = computeCompressedImageDimensions(naturalWidth, naturalHeight, maxDim);
    const canvas = document.createElement('canvas');
    canvas.width = dims.width;
    canvas.height = dims.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    ctx.drawImage(img, 0, 0, dims.width, dims.height);

    const candidates: string[] = [];
    const webp = canvas.toDataURL('image/webp', q);
    if (webp.startsWith('data:image/webp')) {
      candidates.push(webp);
    }

    const hasAlpha = canvasHasTransparency(ctx, dims.width, dims.height);
    if (!hasAlpha) {
      const jpeg = canvas.toDataURL('image/jpeg', q);
      if (jpeg.startsWith('data:image/jpeg')) {
        candidates.push(jpeg);
      }
    } else if (candidates.length === 0) {
      const png = canvas.toDataURL('image/png');
      if (png.startsWith('data:image/png')) {
        candidates.push(png);
      }
    }

    return selectSmallestCompressedDataUrl(candidates);
  };

  let bestUrl = encodeAt(maxDimension, quality);
  if (bestUrl && estimateUtf8ByteLength(bestUrl) > targetBytes) {
    const stepped = encodeAt(Math.min(maxDimension, 960), Math.max(0.55, quality - 0.15));
    if (stepped) {
      bestUrl = selectSmallestCompressedDataUrl([bestUrl, stepped]);
    }
  }
  if (bestUrl && estimateUtf8ByteLength(bestUrl) > targetBytes) {
    const tighter = encodeAt(Math.min(maxDimension, 720), 0.52);
    if (tighter) {
      bestUrl = selectSmallestCompressedDataUrl([bestUrl, tighter]);
    }
  }

  // Keep original only if original is already small and smaller than compressed output
  const finalUrl =
    bestUrl && (estimateUtf8ByteLength(bestUrl) < rawBytes || rawBytes > targetBytes)
      ? bestUrl
      : rawDataUrl;

  return {
    dataUrl: finalUrl,
    naturalWidth,
    naturalHeight,
    byteLength: estimateUtf8ByteLength(finalUrl),
    wasCompressed: finalUrl !== rawDataUrl,
  };
}
