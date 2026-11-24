import React, { useEffect, useRef, useState } from 'react';
import { User } from 'firebase/auth';
import { Check, Cloud, CloudOff, Copy, LogIn, LogOut, User as UserIcon } from 'lucide-react';

interface UserProfileControlProps {
  user: User | null;
  authLoading?: boolean;
  syncState?: 'guest' | 'synced' | 'syncing' | 'error';
  variant?: 'canvas' | 'hub' | 'mobile';
  isDarkHub?: boolean;
  onSignInGoogle: () => Promise<void> | void;
  onSignOut: () => Promise<void> | void;
}

const GoogleMark: React.FC<{ className?: string }> = ({ className = 'w-3.5 h-3.5' }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
    <path
      fill="#4285F4"
      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
    />
    <path
      fill="#34A853"
      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
    />
    <path
      fill="#FBBC05"
      d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
    />
    <path
      fill="#EA4335"
      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
    />
  </svg>
);

export const UserProfileControl: React.FC<UserProfileControlProps> = ({
  user,
  authLoading = false,
  syncState = 'guest',
  variant = 'canvas',
  isDarkHub = false,
  onSignInGoogle,
  onSignOut,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [copiedUid, setCopiedUid] = useState(false);
  const [busy, setBusy] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpen]);

  const handleSignInClick = async () => {
    setBusy(true);
    try {
      await onSignInGoogle();
      setMenuOpen(false);
    } finally {
      setBusy(false);
    }
  };

  const handleSignOutClick = async () => {
    setBusy(true);
    try {
      await onSignOut();
      setMenuOpen(false);
    } finally {
      setBusy(false);
    }
  };

  const handleCopyUid = async () => {
    if (!user?.uid) return;
    try {
      await navigator.clipboard.writeText(user.uid);
      setCopiedUid(true);
      setTimeout(() => setCopiedUid(false), 1800);
    } catch {
      // Ignore clipboard restriction
    }
  };

  const triggerClass =
    variant === 'hub'
      ? `flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
          isDarkHub
            ? 'bg-[#07130F]/85 border-white/15 text-[#ECFDF5] hover:bg-white/10'
            : 'bg-white/90 border-[#10B981]/25 text-[#064E3B] hover:bg-[#ECFDF5]'
        }`
      : variant === 'mobile'
      ? 'w-full flex items-center justify-between px-2.5 py-2.5 rounded-lg text-[var(--rf-text)] hover:bg-[var(--rf-surface-hover)] text-left'
      : 'rf-panel flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-[var(--rf-text)] hover:bg-[var(--rf-surface-hover)] transition-colors whitespace-nowrap shrink-0 cursor-pointer';

  const initials = (user?.displayName || user?.email || 'G')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || '')
    .join('');

  if (variant === 'mobile') {
    return (
      <div className="space-y-1">
        {user ? (
          <div className="px-2.5 py-2 rounded-lg bg-[var(--rf-surface-elevated)] border border-[var(--rf-border)] space-y-2">
            <div className="flex items-center gap-2 min-w-0">
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName || 'User'}
                  referrerPolicy="no-referrer"
                  className="w-7 h-7 rounded-full object-cover shrink-0 border border-[var(--rf-border)]"
                />
              ) : (
                <div className="w-7 h-7 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center text-[11px] font-bold shrink-0">
                  {initials}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold text-[var(--rf-text)] truncate">
                  {user.displayName || 'Google User'}
                </div>
                <div className="text-[10px] text-[var(--rf-text-muted)] truncate">
                  {syncState === 'syncing'
                    ? 'Syncing to Cloud...'
                    : syncState === 'error'
                    ? 'Cloud sync warning'
                    : 'Cloud Workspace Active'}
                </div>
              </div>
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleSignOutClick()}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-lg border border-[var(--rf-border)] text-[11px] font-medium text-[var(--rf-text)] hover:bg-[var(--rf-surface-hover)]"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign out (Guest mode)</span>
            </button>
          </div>
        ) : (
          <button
            type="button"
            disabled={authLoading || busy}
            onClick={() => void handleSignInClick()}
            className={triggerClass}
          >
            <span className="flex items-center gap-2">
              <GoogleMark className="w-4 h-4" />
              <span>Sign in with Google</span>
            </span>
            <span className="text-[10px] text-[var(--rf-text-muted)]">Guest</span>
          </button>
        )}
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        type="button"
        data-testid="user-profile-trigger"
        aria-label={user ? `Account: ${user.displayName || 'User'}` : 'Sign in or continue as guest'}
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((o) => !o)}
        className={triggerClass}
      >
        {user ? (
          <>
            {user.photoURL ? (
              <img
                src={user.photoURL}
                alt={user.displayName || 'Profile'}
                referrerPolicy="no-referrer"
                className="w-5 h-5 rounded-full object-cover shrink-0 border border-emerald-500/40"
              />
            ) : (
              <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center text-[10px] font-bold shrink-0">
                {initials}
              </span>
            )}
            <span className="max-w-[110px] truncate hidden sm:inline">
              {user.displayName || user.email || 'Account'}
            </span>
            <span
              title={
                syncState === 'syncing'
                  ? 'Saving to Cloud Firestore'
                  : syncState === 'error'
                  ? 'Sync warning'
                  : 'Cloud synced'
              }
              className={`w-2 h-2 rounded-full shrink-0 ${
                syncState === 'syncing'
                  ? 'bg-amber-400 animate-pulse'
                  : syncState === 'error'
                  ? 'bg-rose-500'
                  : 'bg-emerald-400'
              }`}
            />
          </>
        ) : (
          <>
            <GoogleMark className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden xl:inline">{authLoading ? 'Auth...' : 'Sign in'}</span>
            <span className="text-[10px] opacity-75 hidden sm:inline xl:hidden">Guest</span>
          </>
        )}
      </button>

      {menuOpen && (
        <div
          role="dialog"
          aria-label="User Account Menu"
          data-testid="user-profile-popover"
          className="rf-panel fixed md:absolute right-3 md:right-0 top-14 md:top-full md:mt-2 z-50 w-64 rounded-2xl p-3 shadow-2xl border border-[var(--rf-border)] text-xs space-y-2.5"
        >
          {user ? (
            <>
              <div className="flex items-center gap-2.5 pb-2 border-b border-[var(--rf-border)]">
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || 'Profile'}
                    referrerPolicy="no-referrer"
                    className="w-9 h-9 rounded-full object-cover shrink-0 border border-emerald-500/35"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center font-bold text-xs shrink-0">
                    {initials}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-[var(--rf-text)] truncate">
                    {user.displayName || 'Google User'}
                  </div>
                  {user.email && (
                    <div className="text-[11px] text-[var(--rf-text-muted)] truncate">
                      {user.email}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between px-2 py-1.5 rounded-xl bg-[var(--rf-surface-elevated)] text-[11px]">
                <span className="flex items-center gap-1.5 text-[var(--rf-text-muted)]">
                  <Cloud className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Cloud Sync</span>
                </span>
                <span className="font-semibold text-emerald-400">
                  {syncState === 'syncing'
                    ? 'Saving...'
                    : syncState === 'error'
                    ? 'Attention'
                    : 'Connected'}
                </span>
              </div>

              <button
                type="button"
                onClick={() => void handleCopyUid()}
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl border border-[var(--rf-border)] text-[11px] text-[var(--rf-text-muted)] hover:text-[var(--rf-text)] hover:bg-[var(--rf-surface-hover)] cursor-pointer"
              >
                <span className="truncate font-mono-tabular">ID: {user.uid.slice(0, 12)}…</span>
                {copiedUid ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                ) : (
                  <Copy className="w-3.5 h-3.5 shrink-0" />
                )}
              </button>

              <button
                type="button"
                data-testid="auth-signout-btn"
                disabled={busy}
                onClick={() => void handleSignOutClick()}
                className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/25 font-semibold hover:bg-rose-500/20 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign out</span>
              </button>
            </>
          ) : (
            <>
              <div className="flex items-start gap-2.5 pb-2 border-b border-[var(--rf-border)]">
                <div className="w-8 h-8 rounded-full bg-[var(--rf-surface-elevated)] border border-[var(--rf-border)] flex items-center justify-center shrink-0">
                  <UserIcon className="w-4 h-4 text-[var(--rf-text-muted)]" />
                </div>
                <div>
                  <div className="font-semibold text-[var(--rf-text)]">Local Guest Mode</div>
                  <div className="text-[11px] text-[var(--rf-text-muted)] leading-snug mt-0.5">
                    Boards save locally on this device. Sign in to sync to cloud & collaborate live.
                  </div>
                </div>
              </div>

              <button
                type="button"
                data-testid="auth-google-signin-btn"
                disabled={busy || authLoading}
                onClick={() => void handleSignInClick()}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-[var(--rf-accent)] text-[var(--rf-accent-fg)] font-semibold hover:opacity-95 cursor-pointer disabled:opacity-50"
              >
                <GoogleMark className="w-4 h-4 bg-white rounded-full p-0.5" />
                <span>{busy ? 'Signing in...' : 'Sign in with Google'}</span>
              </button>

              <button
                type="button"
                data-testid="auth-continue-guest-btn"
                onClick={() => setMenuOpen(false)}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl border border-[var(--rf-border)] text-[var(--rf-text-muted)] hover:text-[var(--rf-text)] hover:bg-[var(--rf-surface-hover)] font-medium cursor-pointer"
              >
                <CloudOff className="w-3.5 h-3.5" />
                <span>Continue as Guest</span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};
