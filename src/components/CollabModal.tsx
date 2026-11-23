import React, { useState } from 'react';
import { Check, Copy, Lock, ShieldCheck, Users, WifiOff, X } from 'lucide-react';
import { CollabStatus } from '../types';
import { buildRoomShareUrl } from '../crypto';

interface CollabModalProps {
  open: boolean;
  collab: CollabStatus;
  onStartSession: (peerName: string) => void;
  onStopSession: () => void;
  onUpdatePeerName: (name: string) => void;
  onClose: () => void;
}

export const CollabModal: React.FC<CollabModalProps> = ({
  open,
  collab,
  onStartSession,
  onStopSession,
  onUpdatePeerName,
  onClose,
}) => {
  const [nameInput, setNameInput] = useState(collab.peerName);
  const [copied, setCopied] = useState(false);

  if (!open) return null;

  const shareUrl =
    collab.roomId && collab.keyString
      ? buildRoomShareUrl(window.location.origin, collab.roomId, collab.keyString)
      : '';

  const peerList = Object.values(collab.peers);

  const handleCopy = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback copy unavailable
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Live Encrypted Collaboration"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-sm p-4"
    >
      <div className="rf-panel w-full max-w-lg rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--rf-border)]">
          <div className="flex items-center gap-2.5">
            <Lock className="w-4 h-4 text-emerald-400" />
            <div>
              <h2 className="text-base font-semibold text-[var(--rf-text)]">
                End-to-End Encrypted Collaboration
              </h2>
              <p className="text-xs text-[var(--rf-text-muted)]">
                AES-256-GCM encrypted in your browser before WebSocket relay
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Close Collaboration Modal"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--rf-text-muted)] hover:bg-[var(--rf-surface-hover)]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="p-3 rounded-xl bg-[var(--rf-surface-elevated)] border border-[var(--rf-border)] flex items-start gap-2.5 text-xs text-[var(--rf-text-muted)]">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <p>
              The 256-bit room encryption key lives strictly in the URL{' '}
              <span className="font-mono-tabular text-[var(--rf-text)]">#room=</span> fragment and is never transmitted to the server.
            </p>
          </div>

          <label className="block text-xs">
            <span className="font-medium text-[var(--rf-text-muted)] block mb-1.5">
              Your Display Name
            </span>
            <input
              type="text"
              value={nameInput}
              onChange={(e) => {
                setNameInput(e.target.value);
                onUpdatePeerName(e.target.value);
              }}
              placeholder="Engineer name..."
              className="w-full px-3 py-2 rounded-xl bg-[var(--rf-surface-elevated)] border border-[var(--rf-border)] text-[var(--rf-text)] text-xs outline-none focus:border-[var(--rf-accent)]"
            />
          </label>

          {!collab.roomId ? (
            <button
              type="button"
              onClick={() => onStartSession(nameInput.trim() || 'Engineer')}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[var(--rf-accent)] text-[var(--rf-accent-fg)] text-xs font-semibold hover:opacity-95"
            >
              <Users className="w-4 h-4" />
              <span>Start Encrypted Live Session</span>
            </button>
          ) : (
            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="font-medium text-[var(--rf-text-muted)]">Shareable E2EE Room Link</span>
                  <span className="font-mono-tabular text-[11px] text-emerald-400">
                    {collab.connected ? 'WebSocket Connected' : 'Reconnecting...'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    aria-label="Room Share URL"
                    value={shareUrl}
                    className="flex-1 px-3 py-2 rounded-xl bg-[var(--rf-surface-elevated)] border border-[var(--rf-border)] text-[var(--rf-text)] font-mono-tabular text-[11px] outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[var(--rf-accent)] text-[var(--rf-accent-fg)] text-xs font-semibold shrink-0"
                  >
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>

              <div className="text-xs text-[var(--rf-text-muted)]">
                Active peers in room:{' '}
                <span className="font-mono-tabular text-[var(--rf-text)]">{peerList.length + 1}</span>
                {peerList.length > 0 && (
                  <span className="ml-2">
                    ({peerList.map((p) => p.name).join(', ')})
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={onStopSession}
                className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-xl bg-rose-500/15 text-rose-400 border border-rose-500/30 text-xs font-semibold hover:bg-rose-500/25"
              >
                <WifiOff className="w-4 h-4" />
                <span>Stop Live Session</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
