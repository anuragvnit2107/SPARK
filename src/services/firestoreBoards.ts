import {
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { SpatialCanvasRecord } from '../hub/canvasHubStore';
import { RemoteCursorPayload, ToolType } from '../types';
import { OperationType, db, handleFirestoreError } from '../firebase';
import {
  buildFirestoreBoardFields,
  buildFirestoreBoardUpdatePatch,
  checkBoardPayloadWithinFirestoreLimit,
  firestoreDocToSpatialCanvas,
  isValidBoardId,
  mergeCloudBoards,
  sanitizeBoardId,
} from './firestoreBoardMappers';

export type SaveBoardResult =
  | { ok: true; bytes: number }
  | { ok: false; reason: 'payload_too_large' | 'unauthenticated' | 'invalid_id'; bytes?: number };

export async function createBoardInFirestore(
  record: SpatialCanvasRecord,
  ownerUid: string
): Promise<SaveBoardResult> {
  if (!ownerUid) return { ok: false, reason: 'unauthenticated' };
  const boardId = isValidBoardId(record.id) ? record.id : sanitizeBoardId(record.id);
  const fields = buildFirestoreBoardFields(record, ownerUid);

  const sizeCheck = checkBoardPayloadWithinFirestoreLimit(fields);
  if (!sizeCheck.ok) {
    return { ok: false, reason: 'payload_too_large', bytes: sizeCheck.bytes };
  }

  const boardRef = doc(db, 'boards', boardId);
  try {
    await setDoc(boardRef, {
      ...fields,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return { ok: true, bytes: sizeCheck.bytes };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `boards/${boardId}`);
  }
}

export async function saveBoardToFirestore(
  record: SpatialCanvasRecord,
  actorUid: string
): Promise<SaveBoardResult> {
  if (!actorUid) return { ok: false, reason: 'unauthenticated' };
  if (!isValidBoardId(record.id)) return { ok: false, reason: 'invalid_id' };

  const patch = buildFirestoreBoardUpdatePatch(record, actorUid);
  const sizeCheck = checkBoardPayloadWithinFirestoreLimit(patch);
  if (!sizeCheck.ok) {
    return { ok: false, reason: 'payload_too_large', bytes: sizeCheck.bytes };
  }

  const boardRef = doc(db, 'boards', record.id);
  try {
    await updateDoc(boardRef, {
      ...patch,
      updatedAt: serverTimestamp(),
    });
    return { ok: true, bytes: sizeCheck.bytes };
  } catch (error) {
    const code = (error as { code?: string })?.code;
    // If the board doesn't exist in Firestore yet and the actor is the owner, create it cleanly
    if (code === 'not-found' && (!record.ownerId || record.ownerId === actorUid)) {
      return createBoardInFirestore(record, actorUid);
    }
    handleFirestoreError(error, OperationType.UPDATE, `boards/${record.id}`);
  }
}

export async function deleteBoardFromFirestore(boardId: string): Promise<void> {
  if (!isValidBoardId(boardId)) return;
  try {
    await deleteDoc(doc(db, 'boards', boardId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `boards/${boardId}`);
  }
}

export async function setBoardSharingInFirestore(
  boardId: string,
  shareEnabled: boolean
): Promise<void> {
  if (!isValidBoardId(boardId)) return;
  try {
    await updateDoc(doc(db, 'boards', boardId), {
      shareEnabled,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `boards/${boardId}`);
  }
}

export async function addCollaboratorUidInFirestore(
  boardId: string,
  collaboratorUid: string
): Promise<void> {
  if (!isValidBoardId(boardId) || !isValidBoardId(collaboratorUid)) return;
  try {
    await updateDoc(doc(db, 'boards', boardId), {
      collaborators: arrayUnion(collaboratorUid),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `boards/${boardId}`);
  }
}

export async function joinSharedBoardInFirestore(
  boardId: string,
  uid: string
): Promise<SpatialCanvasRecord> {
  if (!isValidBoardId(boardId)) {
    throw new Error('Invalid board ID');
  }
  const boardRef = doc(db, 'boards', boardId);
  try {
    await updateDoc(boardRef, {
      collaborators: arrayUnion(uid),
      updatedAt: serverTimestamp(),
    });
  } catch (joinError) {
    // Caller may already be the board owner or an existing collaborator (where join rule rejects duplicate)
    try {
      const existingSnap = await getDoc(boardRef);
      if (existingSnap.exists()) {
        return firestoreDocToSpatialCanvas(
          existingSnap.id,
          existingSnap.data() as Record<string, unknown>
        );
      }
    } catch {
      // Throw original permission/not-found failure below
    }
    throw joinError;
  }

  try {
    const snap = await getDoc(boardRef);
    if (!snap.exists()) {
      throw new Error('Shared board not found');
    }
    return firestoreDocToSpatialCanvas(snap.id, snap.data() as Record<string, unknown>);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `boards/${boardId}`);
  }
}

export function subscribeUserBoards(
  uid: string,
  onBoards: (boards: SpatialCanvasRecord[], hasInitialOwnedSnapshot: boolean) => void,
  onError?: (error: unknown) => void
): () => void {
  let ownedBoards: SpatialCanvasRecord[] = [];
  let sharedBoards: SpatialCanvasRecord[] = [];
  let ownedLoaded = false;

  const emit = () => {
    onBoards(mergeCloudBoards(ownedBoards, sharedBoards), ownedLoaded);
  };

  const ownedQuery = query(collection(db, 'boards'), where('ownerId', '==', uid));
  const sharedQuery = query(
    collection(db, 'boards'),
    where('collaborators', 'array-contains', uid)
  );

  const unsubOwned = onSnapshot(
    ownedQuery,
    (snapshot) => {
      ownedLoaded = true;
      ownedBoards = snapshot.docs.map((d) =>
        firestoreDocToSpatialCanvas(d.id, d.data() as Record<string, unknown>)
      );
      emit();
    },
    (error) => {
      if (onError) onError(error);
      else console.error('Owned boards subscription error:', error);
    }
  );

  const unsubShared = onSnapshot(
    sharedQuery,
    (snapshot) => {
      sharedBoards = snapshot.docs.map((d) =>
        firestoreDocToSpatialCanvas(d.id, d.data() as Record<string, unknown>)
      );
      emit();
    },
    (error) => {
      if (onError) onError(error);
      else console.error('Shared boards subscription error:', error);
    }
  );

  return () => {
    unsubOwned();
    unsubShared();
  };
}

export function subscribeBoardDoc(
  boardId: string,
  onBoard: (board: SpatialCanvasRecord | null) => void,
  onError?: (error: unknown) => void
): () => void {
  if (!isValidBoardId(boardId)) return () => {};
  const boardRef = doc(db, 'boards', boardId);
  return onSnapshot(
    boardRef,
    (snapshot) => {
      if (!snapshot.exists()) {
        onBoard(null);
        return;
      }
      onBoard(
        firestoreDocToSpatialCanvas(snapshot.id, snapshot.data() as Record<string, unknown>)
      );
    },
    (error) => {
      if (onError) onError(error);
      else console.error('Board subscription error:', error);
    }
  );
}

export async function publishPresenceCursor(params: {
  boardId: string;
  uid: string;
  name: string;
  color: string;
  x: number;
  y: number;
  tool: ToolType;
}): Promise<void> {
  if (!isValidBoardId(params.boardId) || !isValidBoardId(params.uid)) return;
  const presenceRef = doc(db, 'boards', params.boardId, 'presence', params.uid);
  try {
    await setDoc(presenceRef, {
      peerId: params.uid,
      name: (params.name || 'Engineer').trim().slice(0, 80) || 'Engineer',
      color: (params.color || '#10b981').slice(0, 20),
      x: Number.isFinite(params.x) ? params.x : 0,
      y: Number.isFinite(params.y) ? params.y : 0,
      tool: (params.tool || 'select').slice(0, 32),
      updatedAt: serverTimestamp(),
    });
  } catch {
    // Presence cursor writes are best-effort ephemeral telemetry
  }
}

export async function removePresenceCursor(boardId: string, uid: string): Promise<void> {
  if (!isValidBoardId(boardId) || !isValidBoardId(uid)) return;
  try {
    await deleteDoc(doc(db, 'boards', boardId, 'presence', uid));
  } catch {
    // Best-effort presence cleanup
  }
}

export function subscribeBoardPresence(
  boardId: string,
  currentUid: string,
  onPeers: (peers: Record<string, RemoteCursorPayload>) => void,
  onError?: (error: unknown) => void
): () => void {
  if (!isValidBoardId(boardId)) return () => {};
  const presenceCol = collection(db, 'boards', boardId, 'presence');
  return onSnapshot(
    presenceCol,
    (snapshot) => {
      const peers: Record<string, RemoteCursorPayload> = {};
      const staleCutoff = Date.now() - 90_000;
      for (const docSnap of snapshot.docs) {
        if (docSnap.id === currentUid) continue;
        const data = docSnap.data() as Record<string, unknown>;
        const updatedAtObj = data.updatedAt as { toMillis?: () => number } | undefined;
        const updatedAt =
          updatedAtObj && typeof updatedAtObj.toMillis === 'function'
            ? updatedAtObj.toMillis()
            : Date.now();
        if (updatedAt < staleCutoff) continue;
        peers[docSnap.id] = {
          peerId: docSnap.id,
          name: typeof data.name === 'string' ? data.name : 'Collaborator',
          color: typeof data.color === 'string' ? data.color : '#10b981',
          x: typeof data.x === 'number' && Number.isFinite(data.x) ? data.x : 0,
          y: typeof data.y === 'number' && Number.isFinite(data.y) ? data.y : 0,
          tool: (typeof data.tool === 'string' ? data.tool : 'select') as ToolType,
          updatedAt,
        };
      }
      onPeers(peers);
    },
    (error) => {
      if (onError) onError(error);
    }
  );
}
