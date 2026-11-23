import React, { useMemo, useState } from 'react';
import {
  Check,
  Copy,
  Download,
  Eye,
  EyeOff,
  Globe,
  X,
} from 'lucide-react';
import { WhiteboardElement } from '../types';
import { buildWebpageDocument } from '../webpageTemplates';

interface WebpageBlockModalProps {
  element: WhiteboardElement | null;
  onUpdateElement: (id: string, patch: Partial<WhiteboardElement>, commitHistory?: boolean) => void;
  onClose: () => void;
}

export const WebpageBlockModal: React.FC<WebpageBlockModalProps> = ({
  element,
  onUpdateElement,
  onClose,
}) => {
  const [showPreview, setShowPreview] = useState(false);
  const [copied, setCopied] = useState(false);

  const fullDoc = useMemo(() => {
    if (!element) return '';
    return buildWebpageDocument({
      title: element.webpageTitle,
      htmlCode: element.htmlCode ?? '',
      cssCode: element.cssCode ?? '',
      jsCode: element.jsCode ?? '',
      autoPolish: element.webpageAutoPolish ?? false,
    });
  }, [
    element?.webpageTitle,
    element?.htmlCode,
    element?.cssCode,
    element?.jsCode,
    element?.webpageAutoPolish,
  ]);

  if (!element || element.type !== 'webpage') return null;

  const htmlCode = element.htmlCode ?? '';
  const cssCode = element.cssCode ?? '';
  const jsCode = element.jsCode ?? '';

  const handleCopyHtml = async () => {
    try {
      await navigator.clipboard.writeText(fullDoc);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Ignore clipboard failures
    }
  };

  const handleDownloadHtml = () => {
    const rawName = (element.webpageTitle || 'index.html').trim() || 'index.html';
    const fileName = rawName.endsWith('.html') ? rawName : `${rawName}.html`;
    const blob = new Blob([fullDoc], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Webpage Code Editor (HTML / CSS / JS)"
      data-testid="webpage-studio-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-sm p-3 sm:p-5"
    >
      <div className="rf-panel w-full max-w-6xl h-[82vh] rounded-2xl flex flex-col overflow-hidden border border-[var(--rf-border)] shadow-2xl">
        {/* Top Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 border-b border-[var(--rf-border)] bg-[var(--rf-surface-elevated)]">
          <div className="flex items-center gap-2.5 min-w-0">
            <Globe className="w-4 h-4 text-[var(--rf-accent)] shrink-0" />
            <input
              type="text"
              aria-label="Webpage title"
              value={element.webpageTitle ?? 'index.html'}
              onChange={(e) =>
                onUpdateElement(element.id, { webpageTitle: e.target.value }, false)
              }
              onBlur={() =>
                onUpdateElement(
                  element.id,
                  { webpageTitle: element.webpageTitle ?? 'index.html' },
                  true
                )
              }
              className="w-44 sm:w-56 px-2.5 py-1 rounded-md bg-[var(--rf-surface)] border border-[var(--rf-border)] text-xs font-mono-tabular font-semibold text-[var(--rf-text)] outline-none focus:border-[var(--rf-accent)]"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              aria-pressed={showPreview}
              onClick={() => setShowPreview((p) => !p)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium border whitespace-nowrap shrink-0 ${
                showPreview
                  ? 'bg-[var(--rf-accent)] text-[var(--rf-accent-fg)] border-transparent'
                  : 'bg-[var(--rf-surface)] border-[var(--rf-border)] text-[var(--rf-text-muted)] hover:text-[var(--rf-text)]'
              }`}
            >
              {showPreview ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              <span>{showPreview ? 'Hide Preview' : 'Preview'}</span>
            </button>

            <button
              type="button"
              onClick={handleCopyHtml}
              className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium bg-[var(--rf-surface)] border border-[var(--rf-border)] text-[var(--rf-text)] hover:border-[var(--rf-accent)] whitespace-nowrap shrink-0"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy HTML'}</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadHtml}
              className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-[var(--rf-accent)] text-[var(--rf-accent-fg)] hover:opacity-95 whitespace-nowrap shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download .html</span>
            </button>

            <button
              type="button"
              aria-label="Close Webpage Editor"
              onClick={onClose}
              className="p-1.5 rounded-md text-[var(--rf-text-muted)] hover:bg-[var(--rf-surface-hover)] hover:text-[var(--rf-text)]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 3 Simple Code Editors (HTML, CSS, JS) + Optional Toggled Preview */}
        <div className="flex-1 min-h-0 flex flex-col">
          <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-[var(--rf-border)]">
            {/* HTML File */}
            <div className="flex flex-col min-h-0 bg-[var(--rf-surface)]">
              <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--rf-border)] bg-[var(--rf-surface-elevated)]">
                <span className="text-xs font-semibold text-[var(--rf-text)]">HTML</span>
                <span className="text-[11px] font-mono-tabular text-[var(--rf-text-muted)]">index.html</span>
              </div>
              <textarea
                data-testid="webpage-editor-html"
                aria-label="HTML code editor"
                spellCheck={false}
                value={htmlCode}
                onChange={(e) =>
                  onUpdateElement(element.id, { htmlCode: e.target.value }, false)
                }
                onBlur={() =>
                  onUpdateElement(element.id, { htmlCode: element.htmlCode ?? '' }, true)
                }
                className="flex-1 w-full p-3.5 bg-[#0b1120] text-[#e2e8f0] font-mono-tabular text-xs leading-relaxed resize-none outline-none rf-scrollbar"
                placeholder={'<!-- Write HTML here -->\n<h1>Hello World</h1>'}
              />
            </div>

            {/* CSS File */}
            <div className="flex flex-col min-h-0 bg-[var(--rf-surface)]">
              <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--rf-border)] bg-[var(--rf-surface-elevated)]">
                <span className="text-xs font-semibold text-[var(--rf-text)]">CSS</span>
                <span className="text-[11px] font-mono-tabular text-[var(--rf-text-muted)]">style.css</span>
              </div>
              <textarea
                data-testid="webpage-editor-css"
                aria-label="CSS code editor"
                spellCheck={false}
                value={cssCode}
                onChange={(e) =>
                  onUpdateElement(element.id, { cssCode: e.target.value }, false)
                }
                onBlur={() =>
                  onUpdateElement(element.id, { cssCode: element.cssCode ?? '' }, true)
                }
                className="flex-1 w-full p-3.5 bg-[#0b1120] text-[#e2e8f0] font-mono-tabular text-xs leading-relaxed resize-none outline-none rf-scrollbar"
                placeholder={'/* Write CSS here */\nh1 {\n  color: #10b981;\n}'}
              />
            </div>

            {/* JavaScript File */}
            <div className="flex flex-col min-h-0 bg-[var(--rf-surface)]">
              <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--rf-border)] bg-[var(--rf-surface-elevated)]">
                <span className="text-xs font-semibold text-[var(--rf-text)]">JavaScript</span>
                <span className="text-[11px] font-mono-tabular text-[var(--rf-text-muted)]">script.js</span>
              </div>
              <textarea
                data-testid="webpage-editor-js"
                aria-label="JavaScript code editor"
                spellCheck={false}
                value={jsCode}
                onChange={(e) =>
                  onUpdateElement(element.id, { jsCode: e.target.value }, false)
                }
                onBlur={() =>
                  onUpdateElement(element.id, { jsCode: element.jsCode ?? '' }, true)
                }
                className="flex-1 w-full p-3.5 bg-[#0b1120] text-[#e2e8f0] font-mono-tabular text-xs leading-relaxed resize-none outline-none rf-scrollbar"
                placeholder={'// Write JS here\nconsole.log("Hello");'}
              />
            </div>
          </div>

          {showPreview && (
            <div className="h-64 border-t border-[var(--rf-border)] bg-white flex flex-col">
              <div className="px-3 py-1.5 border-b border-[var(--rf-border)] bg-[var(--rf-surface-elevated)] text-[11px] font-semibold text-[var(--rf-text-muted)]">
                Output Preview
              </div>
              <iframe
                data-testid="webpage-live-preview"
                title="Live Webpage Preview"
                sandbox="allow-scripts"
                srcDoc={fullDoc}
                className="flex-1 w-full border-0 bg-white"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
