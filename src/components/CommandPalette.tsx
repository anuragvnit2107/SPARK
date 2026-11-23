import React, { useEffect, useState } from 'react';
import { Command, Search, X } from 'lucide-react';

export interface CommandItem {
  id: string;
  label: string;
  category: string;
  shortcut?: string;
  action: () => void;
}

interface CommandPaletteProps {
  open: boolean;
  commands: CommandItem[];
  onClose: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ open, commands, onClose }) => {
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (open) setQuery('');
  }, [open]);

  if (!open) return null;

  const filtered = commands.filter(
    (c) =>
      !query.trim() ||
      c.label.toLowerCase().includes(query.toLowerCase()) ||
      c.category.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Command Palette"
      className="fixed inset-0 z-50 flex items-start justify-center pt-24 bg-black/50 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="rf-panel w-full max-w-lg rounded-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5 px-4 py-3 border-b border-[var(--rf-border)]">
          <Search className="w-4 h-4 text-[var(--rf-text-muted)]" />
          <input
            autoFocus
            type="text"
            aria-label="Search commands"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') onClose();
              if (e.key === 'Enter' && filtered[0]) {
                filtered[0].action();
                onClose();
              }
            }}
            placeholder="Type a command or tool..."
            className="flex-1 bg-transparent text-sm text-[var(--rf-text)] outline-none"
          />
          <button
            type="button"
            aria-label="Close Command Palette"
            onClick={onClose}
            className="p-1 rounded-md text-[var(--rf-text-muted)] hover:bg-[var(--rf-surface-hover)]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="max-h-80 overflow-y-auto rf-scrollbar p-2 space-y-1">
          {filtered.map((cmd) => (
            <button
              key={cmd.id}
              type="button"
              onClick={() => {
                cmd.action();
                onClose();
              }}
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs hover:bg-[var(--rf-surface-hover)] text-left"
            >
              <div className="flex items-center gap-2.5">
                <Command className="w-3.5 h-3.5 text-[var(--rf-accent)]" />
                <span className="font-medium text-[var(--rf-text)]">{cmd.label}</span>
                <span className="text-[var(--rf-text-muted)]">· {cmd.category}</span>
              </div>
              {cmd.shortcut && (
                <span className="font-mono-tabular text-[11px] text-[var(--rf-text-muted)]">
                  {cmd.shortcut}
                </span>
              )}
            </button>
          ))}
          {filtered.length === 0 && (
            <div className="py-8 text-center text-xs text-[var(--rf-text-muted)]">
              No matching commands found.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
