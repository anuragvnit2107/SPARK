import React from 'react';
import { Check, Type, X } from 'lucide-react';
import { FontFamily } from '../types';

interface FontShowcaseModalProps {
  open: boolean;
  activeFont: FontFamily;
  onSelectFont: (font: FontFamily) => void;
  onClose: () => void;
}

const FONT_CARDS: {
  id: FontFamily;
  title: string;
  family: string;
  cssFont: string;
  description: string;
  sample: string;
}[] = [
  {
    id: 'scribble',
    title: 'Scribble',
    family: 'Caveat',
    cssFont: '"Caveat", cursive',
    description: 'Organic engineering handwriting for schematic callouts and signal notes.',
    sample: 'V_out = V_in · (1 / (1 + jωRC))  —  fc = 1.59 kHz',
  },
  {
    id: 'casual',
    title: 'Casual',
    family: 'Comic Neue',
    cssFont: '"Comic Neue", cursive',
    description: 'Clean architectural lettering with balanced stroke weight.',
    sample: 'Unity-Gain Buffer Stage · Z_out < 0.1 Ω',
  },
  {
    id: 'heavy',
    title: 'Heavy',
    family: 'Lilita One',
    cssFont: '"Lilita One", sans-serif',
    description: 'Punchy display headers for frame titles and block diagram headers.',
    sample: 'STAGE 01: SIGNAL CONDITIONING',
  },
  {
    id: 'cleansans',
    title: 'CleanSans',
    family: 'Nunito',
    cssFont: '"Nunito", sans-serif',
    description: 'High-legibility technical specification typography for dense diagrams.',
    sample: 'NE555 Precision Timer · VCC = 5.0V · Duty Cycle 50%',
  },
];

export const FontShowcaseModal: React.FC<FontShowcaseModalProps> = ({
  open,
  activeFont,
  onSelectFont,
  onClose,
}) => {
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Typography Showcase"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-sm p-4"
    >
      <div className="rf-panel w-full max-w-2xl rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--rf-border)]">
          <div className="flex items-center gap-2.5">
            <Type className="w-4 h-4 text-[var(--rf-accent)]" />
            <div>
              <h2 className="text-base font-semibold text-[var(--rf-text)]">Technical Typography</h2>
              <p className="text-xs text-[var(--rf-text-muted)]">
                Select a typeface for new labels and selected annotations
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Close Typography Modal"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--rf-text-muted)] hover:bg-[var(--rf-surface-hover)]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 grid grid-cols-1 gap-3 max-h-[70vh] overflow-y-auto rf-scrollbar">
          {FONT_CARDS.map((card) => {
            const isSelected = activeFont === card.id;
            return (
              <button
                key={card.id}
                type="button"
                onClick={() => {
                  onSelectFont(card.id);
                  onClose();
                }}
                className={`p-4 rounded-xl border text-left transition-colors ${
                  isSelected
                    ? 'border-[var(--rf-accent)] bg-[var(--rf-accent-soft)]'
                    : 'border-[var(--rf-border)] bg-[var(--rf-surface-elevated)] hover:bg-[var(--rf-surface-hover)]'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="text-xs font-semibold text-[var(--rf-text)]">
                    {card.title} · <span className="text-[var(--rf-text-muted)]">{card.family}</span>
                  </div>
                  {isSelected && <Check className="w-4 h-4 text-[var(--rf-accent)]" />}
                </div>
                <p className="text-xs text-[var(--rf-text-muted)] mb-2.5">{card.description}</p>
                <div
                  className="text-xl text-[var(--rf-text)] truncate"
                  style={{ fontFamily: card.cssFont }}
                >
                  {card.sample}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
