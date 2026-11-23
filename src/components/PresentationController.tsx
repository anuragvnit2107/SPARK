import React, { useEffect } from 'react';
import { ChevronLeft, ChevronRight, Presentation, Wand2, X } from 'lucide-react';
import { WhiteboardElement } from '../types';

interface PresentationControllerProps {
  frames: WhiteboardElement[];
  currentIndex: number;
  laserActive: boolean;
  onToggleLaser: () => void;
  onNavigateFrame: (index: number) => void;
  onExit: () => void;
}

export const PresentationController: React.FC<PresentationControllerProps> = ({
  frames,
  currentIndex,
  laserActive,
  onToggleLaser,
  onNavigateFrame,
  onExit,
}) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        e.preventDefault();
        onNavigateFrame(Math.min(frames.length - 1, currentIndex + 1));
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        onNavigateFrame(Math.max(0, currentIndex - 1));
      } else if (e.key === 'q' || e.key === 'Q') {
        e.preventDefault();
        onToggleLaser();
      } else if (e.key === 'Escape') {
        onExit();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [currentIndex, frames.length, onExit, onNavigateFrame, onToggleLaser]);

  const activeFrame = frames[currentIndex];

  return (
    <div
      role="region"
      aria-label="Presentation Controls"
      className="rf-panel fixed bottom-5 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 px-4 py-2 rounded-xl"
    >
      <Presentation className="w-4 h-4 text-[var(--rf-accent)] shrink-0" />
      <div className="text-xs font-medium text-[var(--rf-text)] whitespace-nowrap">
        Slide <span className="font-mono-tabular">{currentIndex + 1}</span> /{' '}
        <span className="font-mono-tabular">{frames.length}</span>
        {activeFrame?.frameTitle ? ` · ${activeFrame.frameTitle}` : ''}
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-label="Previous slide"
          disabled={currentIndex <= 0}
          onClick={() => onNavigateFrame(currentIndex - 1)}
          className="p-1.5 rounded-lg border border-[var(--rf-border)] text-[var(--rf-text)] hover:bg-[var(--rf-surface-hover)] disabled:opacity-40"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <button
          type="button"
          aria-label="Next slide"
          disabled={currentIndex >= frames.length - 1}
          onClick={() => onNavigateFrame(currentIndex + 1)}
          className="p-1.5 rounded-lg border border-[var(--rf-border)] text-[var(--rf-text)] hover:bg-[var(--rf-surface-hover)] disabled:opacity-40"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
      <button
        type="button"
        data-testid="presentation-laser-toggle"
        aria-pressed={laserActive}
        title="Toggle Laser Pointer (Q)"
        onClick={onToggleLaser}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap border transition-colors ${
          laserActive
            ? 'bg-rose-500 text-white border-rose-500 shadow-sm'
            : 'border-[var(--rf-border)] text-[var(--rf-text)] hover:bg-[var(--rf-surface-hover)]'
        }`}
      >
        <Wand2 className="w-3.5 h-3.5" />
        <span>Laser (Q)</span>
      </button>
      <button
        type="button"
        onClick={onExit}
        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-500/15 text-rose-400 hover:bg-rose-500/25 text-xs font-medium whitespace-nowrap"
      >
        <X className="w-3.5 h-3.5" />
        <span>Exit</span>
      </button>
    </div>
  );
};
