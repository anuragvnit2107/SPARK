import React, { useMemo, useState } from 'react';
import { Check, Copy, Download, FileCode, FileJson, Image as ImageIcon, X } from 'lucide-react';
import { WhiteboardElement } from '../types';
import { ForgeTheme } from '../themes';
import { renderSceneToPngDataUrl } from '../canvasRenderer';
import { exportToExcalidrawJson, exportToSvg } from '../exporters';

interface ExportModalProps {
  open: boolean;
  elements: WhiteboardElement[];
  theme: ForgeTheme;
  onClose: () => void;
}

function downloadBlob(content: string | Blob, filename: string, mimeType: string) {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export const ExportModal: React.FC<ExportModalProps> = ({ open, elements, theme, onClose }) => {
  const [scale, setScale] = useState<1 | 2 | 3>(2);
  const [includeBg, setIncludeBg] = useState(true);
  const [copiedMsg, setCopiedMsg] = useState<string | null>(null);

  const previewUrl = useMemo(() => {
    if (!open) return '';
    return renderSceneToPngDataUrl(elements, theme, 1, includeBg);
  }, [open, elements, theme, includeBg]);

  if (!open) return null;

  const activeCount = elements.filter((e) => !e.isDeleted).length;

  const showCopied = (label: string) => {
    setCopiedMsg(label);
    setTimeout(() => setCopiedMsg(null), 2200);
  };

  const handleDownloadPng = () => {
    const dataUrl = renderSceneToPngDataUrl(elements, theme, scale, includeBg);
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `spark-${scale}x.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const handleCopyPng = async () => {
    try {
      const dataUrl = renderSceneToPngDataUrl(elements, theme, scale, includeBg);
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      showCopied('PNG copied to clipboard');
    } catch {
      showCopied('Clipboard image copy unavailable in this browser');
    }
  };

  const handleDownloadSvg = () => {
    const svg = exportToSvg(elements, theme, includeBg);
    downloadBlob(svg, 'spark.svg', 'image/svg+xml');
  };

  const handleCopySvg = async () => {
    try {
      const svg = exportToSvg(elements, theme, includeBg);
      await navigator.clipboard.writeText(svg);
      showCopied('SVG markup copied');
    } catch {
      showCopied('Clipboard unavailable');
    }
  };

  const handleDownloadExcalidraw = () => {
    const doc = exportToExcalidrawJson(elements, theme);
    downloadBlob(JSON.stringify(doc, null, 2), 'spark.excalidraw', 'application/json');
  };

  const handleDownloadSceneJson = () => {
    downloadBlob(
      JSON.stringify({ app: 'spark', version: 1, theme: theme.id, elements }, null, 2),
      'spark-scene.json',
      'application/json'
    );
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Export Drawing"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-sm p-4"
    >
      <div className="rf-panel w-full max-w-2xl rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--rf-border)]">
          <div>
            <h2 className="text-base font-semibold text-[var(--rf-text)]">Export & Open Format</h2>
            <p className="text-xs text-[var(--rf-text-muted)]">
              <span className="font-mono-tabular">{activeCount}</span> elements ready for PNG, SVG, or .excalidraw JSON
            </p>
          </div>
          <button
            type="button"
            aria-label="Close Export Modal"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--rf-text-muted)] hover:bg-[var(--rf-surface-hover)]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Preview Column */}
          <div className="space-y-3">
            <div
              className="aspect-[4/3] w-full rounded-xl border border-[var(--rf-border)] flex items-center justify-center overflow-hidden p-2"
              style={{
                backgroundColor: includeBg ? theme.canvasBg : 'transparent',
                backgroundImage: !includeBg
                  ? 'linear-gradient(45deg, rgba(148,163,184,0.18) 25%, transparent 25%, transparent 75%, rgba(148,163,184,0.18) 75%)'
                  : undefined,
                backgroundSize: '16px 16px',
              }}
            >
              {previewUrl && (
                <img
                  src={previewUrl}
                  alt="Canvas Export Preview"
                  className="max-w-full max-h-full object-contain"
                />
              )}
            </div>

            <div className="flex items-center justify-between gap-2 text-xs">
              <label className="flex items-center gap-2 text-[var(--rf-text)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeBg}
                  onChange={(e) => setIncludeBg(e.target.checked)}
                  className="accent-[var(--rf-accent)] rounded"
                />
                <span>Include canvas background</span>
              </label>

              <div className="flex items-center gap-1">
                {([1, 2, 3] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setScale(s)}
                    className={`px-2 py-1 rounded-md font-mono-tabular text-[11px] border ${
                      scale === s
                        ? 'bg-[var(--rf-accent)] text-[var(--rf-accent-fg)] border-transparent'
                        : 'border-[var(--rf-border)] text-[var(--rf-text)] hover:bg-[var(--rf-surface-hover)]'
                    }`}
                  >
                    {s}x
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Actions Column */}
          <div className="space-y-2.5">
            <button
              type="button"
              onClick={handleDownloadPng}
              className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-[var(--rf-accent)] text-[var(--rf-accent-fg)] text-xs font-semibold hover:opacity-95"
            >
              <span className="flex items-center gap-2">
                <ImageIcon className="w-4 h-4" />
                <span>Download PNG ({scale}x)</span>
              </span>
              <Download className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={handleCopyPng}
              className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-[var(--rf-surface-elevated)] border border-[var(--rf-border)] text-[var(--rf-text)] text-xs font-medium hover:bg-[var(--rf-surface-hover)]"
            >
              <span className="flex items-center gap-2">
                <Copy className="w-4 h-4 text-[var(--rf-text-muted)]" />
                <span>Copy PNG to Clipboard</span>
              </span>
            </button>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleDownloadSvg}
                className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-[var(--rf-surface-elevated)] border border-[var(--rf-border)] text-[var(--rf-text)] text-xs font-medium hover:bg-[var(--rf-surface-hover)]"
              >
                <FileCode className="w-4 h-4 text-[var(--rf-text-muted)]" />
                <span>Download SVG</span>
              </button>
              <button
                type="button"
                onClick={handleCopySvg}
                className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-[var(--rf-surface-elevated)] border border-[var(--rf-border)] text-[var(--rf-text)] text-xs font-medium hover:bg-[var(--rf-surface-hover)]"
              >
                <Copy className="w-4 h-4 text-[var(--rf-text-muted)]" />
                <span>Copy SVG</span>
              </button>
            </div>

            <div className="pt-2 border-t border-[var(--rf-border)] space-y-2">
              <button
                type="button"
                onClick={handleDownloadExcalidraw}
                className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-[var(--rf-surface-elevated)] border border-[var(--rf-border)] text-[var(--rf-text)] text-xs font-medium hover:bg-[var(--rf-surface-hover)]"
              >
                <span className="flex items-center gap-2">
                  <FileJson className="w-4 h-4 text-[var(--rf-accent)]" />
                  <span>Export .excalidraw Open Format</span>
                </span>
                <Download className="w-3.5 h-3.5 text-[var(--rf-text-muted)]" />
              </button>

              <button
                type="button"
                onClick={handleDownloadSceneJson}
                className="w-full flex items-center justify-between px-3.5 py-2 rounded-xl bg-[var(--rf-surface-elevated)] border border-[var(--rf-border)] text-[var(--rf-text-muted)] text-xs font-medium hover:text-[var(--rf-text)] hover:bg-[var(--rf-surface-hover)]"
              >
                <span>Export Scene Graph (.json)</span>
                <Download className="w-3.5 h-3.5" />
              </button>
            </div>

            {copiedMsg && (
              <div className="flex items-center gap-1.5 text-xs text-emerald-400 pt-1">
                <Check className="w-3.5 h-3.5" />
                <span>{copiedMsg}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
