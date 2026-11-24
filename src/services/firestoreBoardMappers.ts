import {
  CANVAS_CATEGORIES,
  CanvasCategory,
  SpatialCanvasRecord,
  SpatialPosition,
  extractLastViewport,
} from '../hub/canvasHubStore';
import { CANVAS_THEMES } from '../themes';
import { CameraState, CanvasThemeId, WhiteboardElement } from '../types';
import {
  FIRESTORE_SAFE_BOARD_LIMIT_BYTES,
  canSyncBoardWithinFirestoreLimit,
} from '../utils/imageCompression';

export const BOARD_ID_REGEX = /^[a-zA-Z0-9_-]{1,128}$/;

export function isValidBoardId(id: string | null | undefined): id is string {
  return typeof id === 'string' && BOARD_ID_REGEX.test(id);
}

export function sanitizeBoardId(id: string): string {
  const cleaned = id.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 128);
  return cleaned.length > 0 ? cleaned : `board-${Date.now().toString(36)}`;
}

function finiteNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export function stripUndefinedDeep<T>(value: T): T {
  if (value === null || value === undefined) {
    return value;
  }
  if (typeof value === 'number') {
    return (Number.isFinite(value) ? value : 0) as unknown as T;
  }
  if (Array.isArray(value)) {
    return value
      .filter((item) => item !== undefined)
      .map((item) => stripUndefinedDeep(item)) as unknown as T;
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (val !== undefined) {
        out[key] = stripUndefinedDeep(val);
      }
    }
    return out as T;
  }
  return value;
}

export function sanitizeCameraForFirestore(camera?: Partial<CameraState> | null): CameraState {
  const zoomRaw = finiteNumber(camera?.zoom, 1);
  return {
    x: finiteNumber(camera?.x, 0),
    y: finiteNumber(camera?.y, 0),
    zoom: Math.min(10, Math.max(0.05, zoomRaw)),
  };
}

export function sanitizeSpatialPositionForFirestore(
  pos?: Partial<SpatialPosition> | null
): SpatialPosition | undefined {
  if (!pos || typeof pos.x !== 'number' || typeof pos.y !== 'number' || typeof pos.z !== 'number') {
    return undefined;
  }
  const clean: SpatialPosition = {
    x: finiteNumber(pos.x, 0),
    y: finiteNumber(pos.y, 0),
    z: finiteNumber(pos.z, 0),
    rotY: finiteNumber(pos.rotY, 0),
  };
  if (typeof pos.pinned === 'boolean') {
    clean.pinned = pos.pinned;
  }
  return clean;
}

export function sanitizeElementsForFirestore(elements: WhiteboardElement[]): WhiteboardElement[] {
  if (!Array.isArray(elements)) return [];
  return elements
    .filter((el) => el && typeof el === 'object' && typeof el.id === 'string' && el.id.length > 0)
    .slice(0, 1000)
    .map((el) => {
      const cleaned = stripUndefinedDeep(el);
      if (cleaned.id.length > 128) {
        cleaned.id = cleaned.id.slice(0, 128);
      }
      return cleaned;
    });
}

export function sanitizeCollaboratorsList(
  collaborators: unknown,
  ownerId: string
): string[] {
  if (!Array.isArray(collaborators)) return [];
  const unique = new Set<string>();
  for (const item of collaborators) {
    if (isValidBoardId(item) && item !== ownerId) {
      unique.add(item);
      if (unique.size >= 25) break;
    }
  }
  return Array.from(unique);
}

export function sanitizeTagsList(tags: unknown): string[] {
  if (!Array.isArray(tags)) return [];
  return tags
    .filter((tag): tag is string => typeof tag === 'string' && tag.trim().length > 0)
    .map((tag) => tag.trim().slice(0, 40))
    .slice(0, 12);
}

export interface FirestoreBoardFields {
  ownerId: string;
  title: string;
  category: CanvasCategory;
  tags: string[];
  elements: WhiteboardElement[];
  collaborators: string[];
  shareEnabled: boolean;
  camera: CameraState;
  canvasThemeId: CanvasThemeId;
  spatialPosition?: SpatialPosition;
  elementCount: number;
  lastNoteSnippet: string;
}

export function buildFirestoreBoardFields(
  record: SpatialCanvasRecord,
  fallbackOwnerId: string
): FirestoreBoardFields {
  const ownerId = isValidBoardId(record.ownerId) ? record.ownerId : fallbackOwnerId;
  const elements = sanitizeElementsForFirestore(record.elements);
  const camera = sanitizeCameraForFirestore(record.camera);
  const viewport = extractLastViewport(elements, camera);
  const activeCount = elements.filter((el) => !el.isDeleted).length;
  const safeThemeId: CanvasThemeId =
    record.canvasThemeId && CANVAS_THEMES[record.canvasThemeId]
      ? record.canvasThemeId
      : 'emerald-minimal';
  const safeCategory: CanvasCategory = CANVAS_CATEGORIES[record.category]
    ? record.category
    : 'Architecture';

  const base: FirestoreBoardFields = {
    ownerId,
    title: (record.title || 'Untitled Canvas').trim().slice(0, 140) || 'Untitled Canvas',
    category: safeCategory,
    tags: sanitizeTagsList(record.tags),
    elements,
    collaborators: sanitizeCollaboratorsList(record.collaborators, ownerId),
    shareEnabled: Boolean(record.shareEnabled),
    camera,
    canvasThemeId: safeThemeId,
    elementCount: Math.min(1000, Math.max(0, Math.round(activeCount))),
    lastNoteSnippet: (viewport.lastNoteSnippet || '').slice(0, 200),
  };

  const spatialPos = sanitizeSpatialPositionForFirestore(record.spatialPosition);
  if (spatialPos) {
    base.spatialPosition = spatialPos;
  }

  return base;
}

export function buildFirestoreBoardUpdatePatch(
  record: SpatialCanvasRecord,
  actorUid: string
): Record<string, unknown> {
  const fields = buildFirestoreBoardFields(record, actorUid);
  const isOwner = fields.ownerId === actorUid;

  if (isOwner) {
    const ownerPatch: Record<string, unknown> = {
      title: fields.title,
      category: fields.category,
      tags: fields.tags,
      elements: fields.elements,
      collaborators: fields.collaborators,
      shareEnabled: fields.shareEnabled,
      camera: fields.camera,
      canvasThemeId: fields.canvasThemeId,
      elementCount: fields.elementCount,
      lastNoteSnippet: fields.lastNoteSnippet,
    };
    if (fields.spatialPosition) {
      ownerPatch.spatialPosition = fields.spatialPosition;
    }
    return ownerPatch;
  }

  // Collaborator updates strictly match allowed keys in firestore.rules
  return {
    title: fields.title,
    elements: fields.elements,
    camera: fields.camera,
    canvasThemeId: fields.canvasThemeId,
    elementCount: fields.elementCount,
    lastNoteSnippet: fields.lastNoteSnippet,
  };
}

export function checkBoardPayloadWithinFirestoreLimit(
  payload: unknown,
  maxBytes = FIRESTORE_SAFE_BOARD_LIMIT_BYTES
): { ok: boolean; bytes: number; limitBytes: number } {
  return canSyncBoardWithinFirestoreLimit(payload, maxBytes);
}

export function timestampToMillis(value: unknown, fallback = Date.now()): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (value && typeof value === 'object') {
    const maybe = value as { toMillis?: () => number; seconds?: number; nanoseconds?: number };
    if (typeof maybe.toMillis === 'function') {
      return maybe.toMillis();
    }
    if (typeof maybe.seconds === 'number') {
      return Math.round(maybe.seconds * 1000 + (maybe.nanoseconds || 0) / 1e6);
    }
  }
  return fallback;
}

export function firestoreDocToSpatialCanvas(
  boardId: string,
  data: Record<string, unknown>
): SpatialCanvasRecord {
  const elements = Array.isArray(data.elements) ? (data.elements as WhiteboardElement[]) : [];
  const camera = sanitizeCameraForFirestore(data.camera as Partial<CameraState>);
  const activeCount = elements.filter((e) => e && !e.isDeleted).length;
  const createdAt = timestampToMillis(data.createdAt, Date.now());
  const updatedAt = timestampToMillis(data.updatedAt, createdAt);
  const category = CANVAS_CATEGORIES[data.category as CanvasCategory]
    ? (data.category as CanvasCategory)
    : 'Architecture';
  const canvasThemeId =
    typeof data.canvasThemeId === 'string' && CANVAS_THEMES[data.canvasThemeId as CanvasThemeId]
      ? (data.canvasThemeId as CanvasThemeId)
      : 'emerald-minimal';

  return {
    id: boardId,
    ownerId: typeof data.ownerId === 'string' ? data.ownerId : undefined,
    collaborators: Array.isArray(data.collaborators)
      ? data.collaborators.filter((c): c is string => typeof c === 'string')
      : [],
    shareEnabled: Boolean(data.shareEnabled),
    title:
      typeof data.title === 'string' && data.title.trim().length > 0
        ? data.title
        : 'Untitled Canvas',
    category,
    tags: Array.isArray(data.tags)
      ? data.tags.filter((t): t is string => typeof t === 'string')
      : [],
    createdAt,
    updatedAt,
    elementCount:
      typeof data.elementCount === 'number' && Number.isFinite(data.elementCount)
        ? data.elementCount
        : activeCount,
    camera,
    canvasThemeId,
    spatialPosition: sanitizeSpatialPositionForFirestore(
      data.spatialPosition as Partial<SpatialPosition>
    ),
    elements,
    lastViewport: extractLastViewport(elements, camera),
  };
}

export function mergeCloudBoards(
  owned: SpatialCanvasRecord[],
  shared: SpatialCanvasRecord[]
): SpatialCanvasRecord[] {
  const byId = new Map<string, SpatialCanvasRecord>();
  for (const board of shared) {
    byId.set(board.id, board);
  }
  for (const board of owned) {
    byId.set(board.id, board);
  }
  return Array.from(byId.values()).sort((a, b) => b.updatedAt - a.updatedAt);
}

export function buildShareBoardUrl(origin: string, boardId: string): string {
  const cleanOrigin = origin.replace(/\/+$/, '');
  return `${cleanOrigin}/?board=${encodeURIComponent(boardId)}`;
}

export function parseJoinBoardInput(rawInput: string): string | null {
  const trimmed = rawInput.trim();
  if (!trimmed) return null;

  if (trimmed.includes('board=') || trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    try {
      const parsed = new URL(
        trimmed.startsWith('http://') || trimmed.startsWith('https://')
          ? trimmed
          : `https://spark.local/${trimmed.replace(/^\/+/, '')}`
      );
      const fromQuery = parsed.searchParams.get('board');
      if (isValidBoardId(fromQuery)) {
        return fromQuery;
      }
      const match = parsed.pathname.match(/\/canvas\/([^/]+)/);
      if (match && isValidBoardId(decodeURIComponent(match[1]))) {
        return decodeURIComponent(match[1]);
      }
    } catch {
      // Fallback to raw ID validation below
    }
  }

  return isValidBoardId(trimmed) ? trimmed : null;
}

export interface DebouncedTask {
  schedule: (fn: () => void | Promise<void>) => void;
  flush: () => void;
  cancel: () => void;
}

export function createDebouncedTask(delayMs = 450): DebouncedTask {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pendingFn: (() => void | Promise<void>) | null = null;

  const cancel = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    pendingFn = null;
  };

  const flush = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    const fn = pendingFn;
    pendingFn = null;
    if (fn) {
      void fn();
    }
  };

  const schedule = (fn: () => void | Promise<void>) => {
    pendingFn = fn;
    if (timer !== null) {
      clearTimeout(timer);
    }
    timer = setTimeout(() => {
      timer = null;
      const run = pendingFn;
      pendingFn = null;
      if (run) {
        void run();
      }
    }, delayMs);
  };

  return { schedule, flush, cancel };
}
