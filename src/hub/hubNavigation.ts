import { SpatialCanvasRecord } from './canvasHubStore';

export type SpatialDirection = 'up' | 'down' | 'left' | 'right';

export interface Vec3Like {
  x: number;
  y: number;
  z: number;
}

export interface SpatialBoardCandidate {
  id: string;
  position: Vec3Like;
}

function dot3(a: Vec3Like, b: Vec3Like): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

export function filterCanvasesByTitle(
  canvases: SpatialCanvasRecord[],
  query: string
): SpatialCanvasRecord[] {
  const q = query.trim().toLowerCase();
  if (!q) return canvases;

  const indexedMatches: Array<{ canvas: SpatialCanvasRecord; idx: number; matchIdx: number; starts: boolean }> = [];
  canvases.forEach((canvas, idx) => {
    const lowerTitle = canvas.title.toLowerCase();
    const matchIdx = lowerTitle.indexOf(q);
    if (matchIdx !== -1) {
      indexedMatches.push({
        canvas,
        idx,
        matchIdx,
        starts: matchIdx === 0,
      });
    }
  });

  indexedMatches.sort((a, b) => {
    if (a.starts !== b.starts) return a.starts ? -1 : 1;
    if (a.matchIdx !== b.matchIdx) return a.matchIdx - b.matchIdx;
    return a.idx - b.idx;
  });

  return indexedMatches.map((m) => m.canvas);
}

export function findNearestCanvasInDirection(params: {
  currentId: string;
  direction: SpatialDirection;
  candidates: SpatialBoardCandidate[];
  cameraRight?: Vec3Like;
  cameraUp?: Vec3Like;
  cameraForward?: Vec3Like;
}): string | null {
  const {
    currentId,
    direction,
    candidates,
    cameraRight = { x: 1, y: 0, z: 0 },
    cameraUp = { x: 0, y: 1, z: 0 },
    cameraForward = { x: 0, y: 0, z: -1 },
  } = params;

  const current = candidates.find((c) => c.id === currentId);
  if (!current || candidates.length < 2) return null;

  const scored: Array<{ id: string; along: number; perp: number; score: number }> = [];

  for (const cand of candidates) {
    if (cand.id === currentId) continue;
    const delta: Vec3Like = {
      x: cand.position.x - current.position.x,
      y: cand.position.y - current.position.y,
      z: cand.position.z - current.position.z,
    };

    const dx = dot3(delta, cameraRight);
    const dy = dot3(delta, cameraUp);
    const dz = dot3(delta, cameraForward);

    let along = 0;
    let perp = 0;
    if (direction === 'right') {
      along = dx;
      perp = Math.abs(dy);
    } else if (direction === 'left') {
      along = -dx;
      perp = Math.abs(dy);
    } else if (direction === 'up') {
      along = dy;
      perp = Math.abs(dx);
    } else {
      along = -dy;
      perp = Math.abs(dx);
    }

    if (along <= 0.15) continue;

    const score = along + perp * 1.85 + Math.abs(dz) * 0.25;
    scored.push({ id: cand.id, along, perp, score });
  }

  if (scored.length === 0) return null;

  const strictCone = scored.filter((item) => item.along >= 0.25 && item.along >= item.perp * 0.35);
  const pool = strictCone.length > 0 ? strictCone : scored;
  pool.sort((a, b) => a.score - b.score);

  return pool[0]?.id ?? null;
}

export const BOTTOM_DOCK_REVEAL_ZONE_PX = 96;

export function shouldRevealBottomDock(params: {
  clientY: number;
  viewportHeight: number;
  isHoveringDock?: boolean;
  isTouchDevice?: boolean;
}): boolean {
  if (params.isTouchDevice || params.isHoveringDock) return true;
  if (!Number.isFinite(params.clientY) || !Number.isFinite(params.viewportHeight)) return false;
  if (params.viewportHeight <= 0) return false;
  return params.clientY >= params.viewportHeight - BOTTOM_DOCK_REVEAL_ZONE_PX;
}

