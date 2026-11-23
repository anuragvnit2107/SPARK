import React, { useState } from 'react';
import { CheckCircle2, Code2, Play, Terminal, Wrench, X, AlertTriangle } from 'lucide-react';
import { CODE_LANGUAGE_LABELS, CodeLanguage, CodeRunResult } from '../codeRunner';

interface CodeRunnerBarProps {
  visible: boolean;
  anchorRect: { x: number; y: number; width: number; height: number } | null;
  selectedLanguage: CodeLanguage;
  onChangeLanguage: (lang: CodeLanguage) => void;
  stdinValue?: string;
  onChangeStdin?: (input: string) => void;
  running: boolean;
  result: CodeRunResult | null;
  onCompile: () => void;
  onCompileAndRun: () => void;
  onClearOutput: () => void;
}

const LANGUAGES: { id: CodeLanguage; short: string }[] = [
  { id: 'python', short: 'Python' },
  { id: 'cpp', short: 'C++' },
  { id: 'node', short: 'Node' },
  { id: 'js', short: 'JS' },
  { id: 'java', short: 'Java' },
];

export const CodeRunnerBar: React.FC<CodeRunnerBarProps> = ({
  visible,
  anchorRect,
  selectedLanguage,
  onChangeLanguage,
  stdinValue = '',
  onChangeStdin,
  running,
  result,
  onCompile,
  onCompileAndRun,
  onClearOutput,
}) => {
  const [showStdin, setShowStdin] = useState(false);

  if (!visible || !anchorRect) return null;

  const vw = typeof window !== 'undefined' ? window.innerWidth : 1440;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 900;
  const barWidth = Math.min(540, vw - 24);
  const minLeft = vw >= 768 ? 268 : 12;
  const maxLeft = Math.max(minLeft, vw - barWidth - 16);

  // Keep selector bar + output box together as a vertical stack WITHOUT overlapping the selected code text.
  const estimatedStackHeight = result || running ? 256 : showStdin ? 104 : 56;
  const belowTop = anchorRect.y + anchorRect.height + 14;
  const aboveTop = anchorRect.y - estimatedStackHeight - 14;
  const rightLeft = anchorRect.x + anchorRect.width + 18;

  let left = Math.max(minLeft, Math.min(maxLeft, anchorRect.x));
  let top: number;

  if (belowTop + estimatedStackHeight <= vh - 64) {
    top = Math.max(72, belowTop);
  } else if (aboveTop >= 72) {
    top = aboveTop;
  } else if (rightLeft + barWidth <= vw - 16) {
    left = rightLeft;
    top = Math.max(72, Math.min(vh - estimatedStackHeight - 64, anchorRect.y));
  } else {
    top = Math.max(72, vh - estimatedStackHeight - 64);
  }

  const timeDisplay =
    result?.timeLabel !== undefined && result.timeLabel !== ''
      ? result.timeLabel
      : `${result?.durationMs ?? 0}ms`;

  const hasErrorText = Boolean(result?.stderr && result.stderr.trim());
  const isSuccess = Boolean(result && result.exitCode === 0 && !hasErrorText && result.ok);

  return (
    <div
      data-testid="code-runner-container"
      style={{ left: `${left}px`, top: `${top}px`, width: `${barWidth}px` }}
      className="fixed z-30 flex flex-col gap-2 pointer-events-auto"
      onPointerDown={(e) => e.stopPropagation()}
    >
      {/* Floating Code Selector Bar */}
      <div
        data-testid="code-selector-bar"
        role="toolbar"
        aria-label="Code Execution Selector Bar"
        className="rf-panel flex flex-col gap-2 px-3 py-2 rounded-xl"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <Code2 className="w-4 h-4 text-[var(--rf-accent)] shrink-0" />
            <div className="flex items-center gap-0.5 bg-[var(--rf-surface-elevated)] border border-[var(--rf-border)] rounded-lg p-0.5">
              {LANGUAGES.map((lang) => (
                <button
                  key={lang.id}
                  type="button"
                  onClick={() => onChangeLanguage(lang.id)}
                  className={`px-2 py-1 rounded-md text-[11px] font-medium transition-colors whitespace-nowrap ${
                    selectedLanguage === lang.id
                      ? 'bg-[var(--rf-accent)] text-[var(--rf-accent-fg)]'
                      : 'text-[var(--rf-text-muted)] hover:text-[var(--rf-text)]'
                  }`}
                >
                  {lang.short}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {onChangeStdin && (
              <button
                type="button"
                data-testid="code-stdin-toggle"
                onClick={() => setShowStdin((v) => !v)}
                className={`px-2 py-1.5 rounded-lg border text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 ${
                  showStdin || stdinValue
                    ? 'border-[var(--rf-accent)] bg-[var(--rf-surface-elevated)] text-[var(--rf-accent)]'
                    : 'border-[var(--rf-border)] bg-[var(--rf-surface-elevated)] text-[var(--rf-text-muted)] hover:text-[var(--rf-text)]'
                }`}
              >
                stdin
              </button>
            )}
            <button
              type="button"
              data-testid="code-compile-btn"
              disabled={running}
              onClick={onCompile}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[var(--rf-border)] bg-[var(--rf-surface-elevated)] text-xs font-semibold text-[var(--rf-text)] hover:border-[var(--rf-accent)] disabled:opacity-50 whitespace-nowrap shrink-0"
            >
              <Wrench className="w-3.5 h-3.5 text-[var(--rf-accent)]" />
              <span>Compile</span>
            </button>
            <button
              type="button"
              data-testid="code-compile-run-btn"
              disabled={running}
              onClick={onCompileAndRun}
              style={{ backgroundColor: '#059669', color: '#ffffff' }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold shadow-sm hover:opacity-95 disabled:opacity-50 whitespace-nowrap shrink-0"
            >
              <Play className="w-3.5 h-3.5" />
              <span>{running ? 'Running...' : 'Compile + Run'}</span>
            </button>
          </div>
        </div>

        {showStdin && onChangeStdin && (
          <div className="flex items-center gap-2 pt-1 border-t border-[var(--rf-border)]">
            <label
              htmlFor="code-stdin-input"
              className="text-[11px] font-mono-tabular text-[var(--rf-text-muted)] whitespace-nowrap"
            >
              stdin:
            </label>
            <input
              id="code-stdin-input"
              data-testid="code-stdin-input"
              type="text"
              value={stdinValue}
              onChange={(e) => onChangeStdin(e.target.value)}
              placeholder="Optional standard input..."
              className="flex-1 min-w-0 px-2 py-1 rounded-md bg-[var(--rf-surface-elevated)] border border-[var(--rf-border)] text-xs text-[var(--rf-text)] font-mono-tabular outline-none focus:border-[var(--rf-accent)]"
            />
          </div>
        )}
      </div>

      {/* Instant Output Box Directly Below Selector */}
      {(result || running) && (
        <div
          data-testid="code-output-box"
          role="region"
          aria-label="Code Execution Output"
          className="rf-panel rounded-xl overflow-hidden"
        >
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-[var(--rf-border)] bg-[var(--rf-surface-elevated)] text-[11px]">
            <div className="flex items-center gap-2 min-w-0">
              <Terminal className="w-3.5 h-3.5 text-[var(--rf-accent)] shrink-0" />
              {running ? (
                <span className="font-medium text-[var(--rf-text)]">
                  Executing {CODE_LANGUAGE_LABELS[selectedLanguage]}...
                </span>
              ) : result ? (
                <>
                  <span
                    className={`flex items-center gap-1 font-semibold whitespace-nowrap ${
                      isSuccess ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {isSuccess ? (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    ) : (
                      <AlertTriangle className="w-3.5 h-3.5" />
                    )}
                    {isSuccess
                      ? result.mode === 'compile'
                        ? 'Compiled'
                        : 'Output'
                      : 'Error'}
                  </span>
                  <span
                    data-testid="code-output-meta"
                    className="text-[var(--rf-text-muted)] font-mono-tabular truncate"
                  >
                    {result.runtimeLabel} · time {timeDisplay} · exit_code {result.exitCode}
                  </span>
                </>
              ) : null}
            </div>
            {result && !running && (
              <button
                type="button"
                aria-label="Clear code output"
                onClick={onClearOutput}
                className="p-0.5 rounded text-[var(--rf-text-muted)] hover:text-[var(--rf-text)]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {result && !running && (
            <div className="p-3 max-h-48 overflow-y-auto rf-scrollbar bg-[#070b12] text-slate-100 font-mono-tabular text-xs space-y-1.5">
              {result.compileMessage && (
                <div
                  className={`text-[11px] ${
                    isSuccess ? 'text-emerald-400/90' : 'text-rose-400'
                  }`}
                >
                  {result.compileMessage}
                </div>
              )}
              {result.exitCode === 0 && !hasErrorText ? (
                result.stdout ? (
                  <pre className="whitespace-pre-wrap break-words text-slate-100 leading-relaxed m-0">
                    {result.stdout}
                  </pre>
                ) : (
                  <div className="text-[11px] text-slate-400 italic">
                    (program exited with code 0, no output)
                  </div>
                )
              ) : (
                <>
                  {result.stdout && (
                    <pre className="whitespace-pre-wrap break-words text-slate-300 leading-relaxed m-0">
                      {result.stdout}
                    </pre>
                  )}
                  {result.stderr && result.stderr.trim() !== result.compileMessage.trim() && (
                    <pre className="whitespace-pre-wrap break-words text-rose-400 leading-relaxed m-0">
                      {result.stderr}
                    </pre>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
