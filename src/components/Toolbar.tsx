import React from 'react';
import {
  ArrowRight,
  Circle,
  Diamond,
  Eraser,
  Frame,
  Globe,
  Hand,
  Image as ImageIcon,
  Minus,
  MousePointer2,
  Pencil,
  Sigma,
  Square,
  Triangle,
  Type,
  Waypoints,
} from 'lucide-react';
import { ToolType } from '../types';
import { Translations } from '../i18n';

interface ToolbarProps {
  activeTool: ToolType;
  onSelectTool: (tool: ToolType) => void;
  onTriggerImageUpload: () => void;
  t: Translations;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  activeTool,
  onSelectTool,
  onTriggerImageUpload,
  t,
}) => {
  const items: {
    id: ToolType;
    label: string;
    shortcut: string;
    icon: React.ReactNode;
    onClick?: () => void;
  }[] = [
    { id: 'select', label: t.tools.select, shortcut: 'V', icon: <MousePointer2 className="w-4 h-4" /> },
    { id: 'hand', label: t.tools.hand, shortcut: 'H', icon: <Hand className="w-4 h-4" /> },
    { id: 'rectangle', label: t.tools.rectangle, shortcut: 'R', icon: <Square className="w-4 h-4" /> },
    { id: 'diamond', label: t.tools.diamond, shortcut: 'D', icon: <Diamond className="w-4 h-4" /> },
    { id: 'ellipse', label: t.tools.ellipse, shortcut: 'O', icon: <Circle className="w-4 h-4" /> },
    { id: 'triangle', label: t.tools.triangle, shortcut: 'T', icon: <Triangle className="w-4 h-4" /> },
    { id: 'arrow', label: t.tools.arrow, shortcut: 'A', icon: <ArrowRight className="w-4 h-4" /> },
    { id: 'line', label: t.tools.line, shortcut: 'L', icon: <Minus className="w-4 h-4" /> },
    { id: 'wire', label: t.tools.wire, shortcut: 'W', icon: <Waypoints className="w-4 h-4" /> },
    { id: 'freedraw', label: t.tools.freedraw, shortcut: 'P', icon: <Pencil className="w-4 h-4" /> },
    {
      id: 'laser',
      label: t.tools.laser,
      shortcut: 'Q',
      icon: (
        <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 20 14.5 9.5" />
          <circle cx="17" cy="7" r="2.2" fill="#ef4444" stroke="#ef4444" />
          <path d="M17 2v1.5M22 7h-1.5M20.5 3.5l-1.1 1.1M13.5 3.5l1.1 1.1M20.5 10.5l-1.1-1.1" stroke="#ef4444" strokeWidth="1.6" />
        </svg>
      ),
    },
    { id: 'text', label: t.tools.text, shortcut: 'X', icon: <Type className="w-4 h-4" /> },
    {
      id: 'image',
      label: t.tools.image,
      shortcut: 'I',
      icon: <ImageIcon className="w-4 h-4" />,
      onClick: onTriggerImageUpload,
    },
    { id: 'frame', label: t.tools.frame, shortcut: 'F', icon: <Frame className="w-4 h-4" /> },
    { id: 'webpage', label: t.tools.webpage, shortcut: 'G', icon: <Globe className="w-4 h-4" /> },
    { id: 'math', label: t.tools.math, shortcut: 'M', icon: <Sigma className="w-4 h-4" /> },
    { id: 'eraser', label: t.tools.eraser, shortcut: 'E', icon: <Eraser className="w-4 h-4" /> },
  ];

  return (
    <nav
      aria-label="Drawing Tools"
      className="rf-panel flex items-center gap-1 px-2 py-1.5 rounded-xl overflow-x-auto max-w-[92vw]"
    >
      {items.map((item) => {
        const isActive = activeTool === item.id;
        return (
          <button
            key={item.id}
            type="button"
            aria-label={`${item.label} (${item.shortcut})`}
            aria-pressed={isActive}
            title={`${item.label} (${item.shortcut})`}
            onClick={() => {
              if (item.onClick) {
                item.onClick();
              } else {
                onSelectTool(item.id);
              }
            }}
            style={
              isActive
                ? {
                    backgroundColor: 'var(--rf-accent)',
                    color: 'var(--rf-accent-fg)',
                  }
                : undefined
            }
            className={`relative flex items-center justify-center w-9 h-9 rounded-lg transition-colors shrink-0 ${
              isActive
                ? 'shadow-sm'
                : 'text-[var(--rf-text)] hover:bg-[var(--rf-surface-hover)]'
            }`}
          >
            {item.icon}
            <span className="sr-only">{item.label}</span>
            <span
              aria-hidden="true"
              className="absolute bottom-0.5 right-1 text-[9px] font-mono-tabular opacity-60 leading-none"
            >
              {item.shortcut}
            </span>
          </button>
        );
      })}
    </nav>
  );
};
