import React, { useState } from 'react';
import { User } from 'firebase/auth';
import {
  Check,
  Cloud,
  Copy,
  Globe,
  Link2,
  Lock,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { CollabStatus } from '../types';
import { buildShareBoardUrl, parseJoinBoardInput } from '../services/firestoreBoardMappers';

interface CollabModalProps {
  open: boolean;
  user: User | null;
  boardId: string | null;
  boardTitle: string;
  isOwner: boolean;
  shareEnabled: boolean;
  collaborators: string[];
  collab: CollabStatus;
  onSignInGoogle: () => Promise<void> | void;
  onToggleSharing: (enabled: boolean) => Promise<void> | void;
  onAddCollaboratorUid: (uid: string) => Promise<void> | void;
  onJoinBoard: (boardId: string) => Promise<void> | void;
  onStopLiveSession: () => void;
  onClose: () => void;
}

export const CollabModal: React.FC<CollabModalProps> = ({
  open,
  user,
  boardId,
  boardTitle,
  isOwner,
  shareEnabled,
  collaborators,
  collab,
  onSignInGoogle,
  onToggleSharing,
  onAddCollaboratorUid,
  onJoinBoard,
  onStopLiveSession,
  onClose,
}) => {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedRoomId, setCopiedRoomId] = useState(false);
  const [joinInput, setJoinInput] = useState('');
  const [collabUidInput, setCollabUidInput] = useState('');
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!open) return null;

  const shareUrl = boardId ? buildShareBoardUrl(window.location.origin, boardId) : '';
  const peerList = Object.values(collab.peers);

  const handleCopyLink = async () => {
    if (!shareUrl) return;
    try {
      if (isOwner && !shareEnabled) {
        await onToggleSharing(true);
      }
      await navigator.clipboard.writeText(shareUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      // Clipboard unavailable
    }
  };

  const handleCopyRoomId = async () => {
    if (!boardId) return;
    try {
      if (isOwner && !shareEnabled) {
        await onToggleSharing(true);
      }
      await navigator.clipboard.writeText(boardId);
      setCopiedRoomId(true);
      setTimeout(() => setCopiedRoomId(false), 2000);
    } catch {
      // Clipboard unavailable
    }
  };

  const handleJoinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    const parsedId = parseJoinBoardInput(joinInput);
    if (!parsedId) {
      setErrorMsg('Enter a valid Room ID or ?board= share link.');
      return;
    }
    setBusyAction('join');
    try {
      await onJoinBoard(parsedId);
      setJoinInput('');
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Unable to join board. Check permissions or link.'
      );
    } finally {
      setBusyAction(null);
    }
  };

  const handleAddCollaborator = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    const cleaned = collabUidInput.trim();
    if (!cleaned) return;
    setBusyAction('add-uid');
    try {
      await onAddCollaboratorUid(cleaned);
      setCollabUidInput('');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Could not add collaborator UID.');
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Share and Collaborate"
      data-testid="collab-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-sm p-4"
    >
      <div className="rf-panel w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--rf-border)]">
          <div className="flex items-center gap-2.5">
            <Cloud className="w-4 h-4 text-emerald-400" />
            <div>
              <h2 className="text-base font-semibold text-[var(--rf-text)]">
                Share &amp; Live Collaboration
              </h2>
              <p className="text-xs text-[var(--rf-text-muted)]">
                Real-time Firestore board sync &amp; live collaborator cursors
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Close Collaboration Modal"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--rf-text-muted)] hover:bg-[var(--rf-surface-hover)] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto rf-scrollbar">
          {!user ? (
            <div className="p-4 rounded-xl bg-[var(--rf-surface-elevated)] border border-[var(--rf-border)] space-y-3">
              <div className="flex items-start gap-2.5 text-xs text-[var(--rf-text-muted)]">
                <Lock className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-[var(--rf-text)]">
                    Sign in with Google to share or collaborate live
                  </div>
                  <p className="mt-1 leading-relaxed">
                    Your current drawings stay safe locally as Guest. Signing in saves boards to Cloud Firestore and unlocks real-time multi-user collaboration.
                  </p>
                </div>
              </div>
              <button
                type="button"
                data-testid="collab-signin-btn"
                onClick={() => void onSignInGoogle()}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[var(--rf-accent)] text-[var(--rf-accent-fg)] text-xs font-semibold hover:opacity-95 cursor-pointer"
              >
                <Users className="w-4 h-4" />
                <span>Sign in with Google</span>
              </button>
            </div>
          ) : (
            <>
              {/* Active Board Status */}
              <div className="p-3 rounded-xl bg-[var(--rf-surface-elevated)] border border-[var(--rf-border)] flex items-center justify-between gap-2 text-xs">
                <div className="min-w-0">
                  <div className="font-semibold text-[var(--rf-text)] truncate">{boardTitle}</div>
                  <div className="text-[11px] text-[var(--rf-text-muted)] flex items-center gap-1.5 mt-0.5">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        collab.connected ? 'bg-emerald-400 animate-pulse' : 'bg-slate-400'
                      }`}
                    />
                    <span>
                      {collab.connected ? 'Real-time sync connected' : 'Local sync ready'} ·{' '}
                      {isOwner ? 'Owner' : 'Collaborator'}
                    </span>
                  </div>
                </div>
                {isOwner && (
                  <button
                    type="button"
                    data-testid="collab-toggle-share-btn"
                    onClick={async () => {
                      setBusyAction('toggle-share');
                      try {
                        await onToggleSharing(!shareEnabled);
                      } finally {
                        setBusyAction(null);
                      }
                    }}
                    disabled={busyAction === 'toggle-share'}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold shrink-0 cursor-pointer border ${
                      shareEnabled
                        ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/35'
                        : 'bg-[var(--rf-surface)] text-[var(--rf-text-muted)] border-[var(--rf-border)]'
                    }`}
                  >
                    {shareEnabled ? (
                      <>
                        <Globe className="w-3.5 h-3.5" />
                        <span>Link Sharing On</span>
                      </>
                    ) : (
                      <>
                        <Lock className="w-3.5 h-3.5" />
                        <span>Private</span>
                      </>
                    )}
                  </button>
                )}
              </div>

              {/* Shareable Link & Room ID */}
              {boardId && (
                <div className="space-y-2.5">
                  <div>
                    <label className="block text-[11px] font-medium text-[var(--rf-text-muted)] mb-1">
                      Shareable Session Link
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        aria-label="Shareable Session Link"
                        value={shareUrl}
                        className="flex-1 px-3 py-2 rounded-xl bg-[var(--rf-surface-elevated)] border border-[var(--rf-border)] text-[var(--rf-text)] font-mono-tabular text-[11px] outline-none"
                      />
                      <button
                        type="button"
                        data-testid="collab-copy-link-btn"
                        onClick={() => void handleCopyLink()}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[var(--rf-accent)] text-[var(--rf-accent-fg)] text-xs font-semibold shrink-0 cursor-pointer"
                      >
                        {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Link2 className="w-3.5 h-3.5" />}
                        <span>{copiedLink ? 'Copied' : 'Copy Link'}</span>
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-[var(--rf-text-muted)] mb-1">
                      Room ID
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        aria-label="Board Room ID"
                        value={boardId}
                        className="flex-1 px-3 py-2 rounded-xl bg-[var(--rf-surface-elevated)] border border-[var(--rf-border)] text-[var(--rf-text)] font-mono-tabular text-[11px] outline-none"
                      />
                      <button
                        type="button"
                        data-testid="collab-copy-roomid-btn"
                        onClick={() => void handleCopyRoomId()}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[var(--rf-border)] bg-[var(--rf-surface-elevated)] text-[var(--rf-text)] text-xs font-semibold shrink-0 hover:bg-[var(--rf-surface-hover)] cursor-pointer"
                      >
                        {copiedRoomId ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                        <span>{copiedRoomId ? 'Copied' : 'Copy ID'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Active Collaborators & Cursors */}
              <div className="p-3 rounded-xl bg-[var(--rf-surface-elevated)] border border-[var(--rf-border)] space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-[var(--rf-text-muted)]">
                    Active Presence ({peerList.length + 1})
                  </span>
                  <span className="text-[11px] font-mono-tabular text-[var(--rf-text-muted)]">
                    {collaborators.length} invited {collaborators.length === 1 ? 'member' : 'members'}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--rf-surface)] border border-[var(--rf-border)] text-[11px] font-medium text-[var(--rf-text)]">
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: collab.peerColor }}
                    />
                    <span>{user.displayName || collab.peerName} (You)</span>
                  </span>
                  {peerList.map((peer) => (
                    <span
                      key={peer.peerId}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--rf-surface)] border border-[var(--rf-border)] text-[11px] font-medium text-[var(--rf-text)]"
                    >
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: peer.color }}
                      />
                      <span>{peer.name}</span>
                    </span>
                  ))}
                </div>
              </div>

              {/* Optional Owner Invite by UID */}
              {isOwner && boardId && (
                <form onSubmit={handleAddCollaborator} className="space-y-1.5">
                  <label className="block text-[11px] font-medium text-[var(--rf-text-muted)]">
                    Invite Collaborator by Google User ID
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={collabUidInput}
                      onChange={(e) => setCollabUidInput(e.target.value)}
                      placeholder="Paste collaborator User ID..."
                      className="flex-1 px-3 py-2 rounded-xl bg-[var(--rf-surface-elevated)] border border-[var(--rf-border)] text-[var(--rf-text)] font-mono-tabular text-[11px] outline-none focus:border-[var(--rf-accent)]"
                    />
                    <button
                      type="submit"
                      disabled={busyAction === 'add-uid' || !collabUidInput.trim()}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[var(--rf-border)] bg-[var(--rf-surface-elevated)] text-[var(--rf-text)] text-xs font-semibold hover:bg-[var(--rf-surface-hover)] disabled:opacity-40 cursor-pointer"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>Invite</span>
                    </button>
                  </div>
                </form>
              )}
            </>
          )}

          {/* Join a Shared Session by Link or Room ID */}
          <form
            onSubmit={handleJoinSubmit}
            className="pt-3 border-t border-[var(--rf-border)] space-y-1.5"
          >
            <label className="block text-[11px] font-medium text-[var(--rf-text-muted)]">
              Join a Shared Session (Paste Link or Room ID)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                data-testid="collab-join-input"
                value={joinInput}
                onChange={(e) => setJoinInput(e.target.value)}
                placeholder="https://.../?board=... or Room ID"
                className="flex-1 px-3 py-2 rounded-xl bg-[var(--rf-surface-elevated)] border border-[var(--rf-border)] text-[var(--rf-text)] text-xs outline-none focus:border-[var(--rf-accent)]"
              />
              <button
                type="submit"
                data-testid="collab-join-btn"
                disabled={busyAction === 'join' || !joinInput.trim()}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[var(--rf-accent)] text-[var(--rf-accent-fg)] text-xs font-semibold shrink-0 disabled:opacity-40 cursor-pointer"
              >
                <Users className="w-3.5 h-3.5" />
                <span>{busyAction === 'join' ? 'Joining...' : 'Join'}</span>
              </button>
            </div>
          </form>

          {errorMsg && (
            <div className="px-3 py-2 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400 text-xs">
              {errorMsg}
            </div>
          )}

          {user && shareEnabled && isOwner && (
            <button
              type="button"
              onClick={onStopLiveSession}
              className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/25 text-xs font-semibold hover:bg-rose-500/20 cursor-pointer"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Disable Public Link Sharing</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
