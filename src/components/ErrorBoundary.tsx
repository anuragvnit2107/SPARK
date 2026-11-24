import React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    let readable = error.message || 'An unexpected application error occurred.';
    try {
      const parsed = JSON.parse(error.message) as { error?: string; operationType?: string; path?: string };
      if (parsed && typeof parsed.error === 'string') {
        readable = parsed.error.includes('Quota exceeded')
          ? 'Firestore daily free-tier quota exceeded. Your local workspace remains safe; cloud sync resumes when the quota resets.'
          : `${parsed.error}${parsed.path ? ` (${parsed.operationType || 'op'} ${parsed.path})` : ''}`;
      }
    } catch {
      // Non-JSON error message
    }
    return { hasError: true, message: readable };
  }

  override render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-screen flex items-center justify-center bg-[#061812] text-[#ECFDF5] p-6">
          <div className="max-w-md w-full rounded-2xl border border-emerald-500/30 bg-[#0A221A] p-6 space-y-4 shadow-2xl">
            <h1 className="text-lg font-bold text-emerald-300">Workspace Sync Interrupted</h1>
            <p className="text-xs leading-relaxed text-emerald-100/80 break-words">
              {this.state.message}
            </p>
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="px-4 py-2 rounded-xl bg-emerald-500 text-[#032016] text-xs font-bold hover:bg-emerald-400 cursor-pointer"
              >
                Reload Workspace
              </button>
              <button
                type="button"
                onClick={() => this.setState({ hasError: false, message: '' })}
                className="px-4 py-2 rounded-xl border border-emerald-500/30 text-emerald-200 text-xs font-semibold hover:bg-white/5 cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
