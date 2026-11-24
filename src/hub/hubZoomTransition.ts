export const CLOSE_ZOOM_THRESHOLD = 10.5;
export const UNFOCUS_ZOOM_THRESHOLD = 12.2;
export const INSPECT_DISTANCE = 7.4;
export const ENTER_CANVAS_DISTANCE = 5.25;
export const ENTER_TARGET_DISTANCE = 3.85;
export const EXIT_START_DISTANCE = 4.35;
export const CANVAS_EXIT_ZOOM_FLOOR = 0.06;

export interface HubZoomEvalInput {
  focusedId: string | null;
  nearestCloseId: string | null;
  nearestCloseDist: number;
  focusedBoardDist: number;
  focusedBoardDot: number;
  nearestBoardDot: number;
  isFlying: boolean;
  isDragging: boolean;
  isEditingTitle: boolean;
  isEntering: boolean;
  suppressAutoEnter: boolean;
}

export interface HubZoomEvalResult {
  shouldUnfocus: boolean;
  enterCandidateId: string | null;
  closeInspectId: string | null;
}

export function evaluateHubZoomState(input: HubZoomEvalInput): HubZoomEvalResult {
  const shouldUnfocus = Boolean(
    input.focusedId &&
      !input.isFlying &&
      !input.isDragging &&
      !input.isEntering &&
      Number.isFinite(input.focusedBoardDist) &&
      input.focusedBoardDist > UNFOCUS_ZOOM_THRESHOLD
  );

  let enterCandidateId: string | null = null;
  if (
    !input.isFlying &&
    !input.isDragging &&
    !input.isEditingTitle &&
    !input.isEntering &&
    !input.suppressAutoEnter
  ) {
    if (
      input.focusedId &&
      Number.isFinite(input.focusedBoardDist) &&
      input.focusedBoardDist <= ENTER_CANVAS_DISTANCE &&
      input.focusedBoardDot >= 0.55
    ) {
      enterCandidateId = input.focusedId;
    } else if (
      !input.focusedId &&
      input.nearestCloseId &&
      Number.isFinite(input.nearestCloseDist) &&
      input.nearestCloseDist <= ENTER_CANVAS_DISTANCE &&
      input.nearestBoardDot >= 0.78
    ) {
      enterCandidateId = input.nearestCloseId;
    }
  }

  const effectiveFocusedId = shouldUnfocus ? null : input.focusedId;
  const closeInspectId =
    effectiveFocusedId ||
    (input.nearestCloseId && input.nearestCloseDist < CLOSE_ZOOM_THRESHOLD
      ? input.nearestCloseId
      : null);

  return {
    shouldUnfocus,
    enterCandidateId,
    closeInspectId,
  };
}

export function computeEnterDurationMs(startDistance: number): number {
  if (!Number.isFinite(startDistance) || startDistance <= INSPECT_DISTANCE) {
    return 280;
  }
  const extra = (startDistance - INSPECT_DISTANCE) * 12;
  return Math.round(Math.min(520, Math.max(280, 280 + extra)));
}

function smoothstep01(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
}

export function computeEnterTransitionVisuals(progress01: number): {
  progress: number;
  hudOpacity: number;
  hubOpacity: number;
} {
  const progress = Math.max(0, Math.min(1, progress01));
  const hudOpacity = 1 - smoothstep01(progress / 0.38);
  const fadeT = (progress - 0.35) / 0.65;
  const hubOpacity = 1 - smoothstep01(fadeT);
  return { progress, hudOpacity, hubOpacity };
}

export function computeReturnFadeInOpacity(elapsedMs: number, durationMs = 220): number {
  if (durationMs <= 0) return 1;
  return smoothstep01(elapsedMs / durationMs);
}

export interface CanvasZoomOutFloorState {
  floorHitCount: number;
  lastHitAt: number;
}

export function evaluateCanvasZoomOutExit(
  currentZoom: number,
  isZoomingOut: boolean,
  nowMs: number,
  prevState: CanvasZoomOutFloorState
): { shouldExitToHub: boolean; nextState: CanvasZoomOutFloorState } {
  if (!isZoomingOut) {
    return {
      shouldExitToHub: false,
      nextState: { floorHitCount: 0, lastHitAt: 0 },
    };
  }

  if (currentZoom > CANVAS_EXIT_ZOOM_FLOOR) {
    return {
      shouldExitToHub: false,
      nextState: { floorHitCount: 0, lastHitAt: 0 },
    };
  }

  const withinWindow = prevState.lastHitAt > 0 && nowMs - prevState.lastHitAt <= 1400;
  const nextCount = withinWindow ? prevState.floorHitCount + 1 : 1;
  if (nextCount >= 2) {
    return {
      shouldExitToHub: true,
      nextState: { floorHitCount: 0, lastHitAt: 0 },
    };
  }

  return {
    shouldExitToHub: false,
    nextState: { floorHitCount: nextCount, lastHitAt: nowMs },
  };
}
