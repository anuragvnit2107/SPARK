import React, { useMemo } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { canonicalToLatex } from './SymbolConverter';

interface MathFormulaProps {
  expression?: string;
  latex?: string;
  displayMode?: boolean;
  className?: string;
}

/**
 * Safe KaTeX renderer (trust: false) that never injects arbitrary HTML/scripts.
 */
export const MathFormula: React.FC<MathFormulaProps> = ({
  expression = '',
  latex,
  displayMode = false,
  className = '',
}) => {
  const html = useMemo(() => {
    const tex = (latex ?? canonicalToLatex(expression)).trim();
    if (!tex) return '';
    try {
      return katex.renderToString(tex, {
        displayMode,
        throwOnError: false,
        strict: false,
        trust: false,
      });
    } catch {
      return '';
    }
  }, [expression, latex, displayMode]);

  if (!html) {
    return <span className={`font-mono-tabular ${className}`}>{expression || latex || ''}</span>;
  }

  return (
    <span
      className={`math-katex-render inline-block align-middle ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};
