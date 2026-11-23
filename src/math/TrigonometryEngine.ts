import { TrigAnalysis } from './types';
import { normalizeUnicodeToCanonical } from './SymbolConverter';

export function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function radToDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

/**
 * Analyzes common trigonometric forms A*fn(B*x + C) + D for amplitude,
 * period, frequency, phase shift, vertical shift, asymptotes, and domain.
 */
export function analyzeTrigExpression(raw: string): TrigAnalysis | null {
  const clean = normalizeUnicodeToCanonical(raw).replace(/^y\s*=\s*/i, '').replace(/\s+/g, '');
  const fnMatch = clean.match(
    /^([+-]?\d*\.?\d*)?\*?(sin|cos|tan|cot|sec|csc)\(([^)]+)\)([+-]\d+\.?\d*)?$/i
  );
  if (!fnMatch) return null;

  const ampRaw = fnMatch[1];
  const fn = fnMatch[2].toLowerCase();
  const arg = fnMatch[3];
  const dRaw = fnMatch[4];

  const A =
    !ampRaw || ampRaw === '+'
      ? 1
      : ampRaw === '-'
      ? -1
      : parseFloat(ampRaw);
  const D = dRaw ? parseFloat(dRaw) : 0;

  // Parse linear inner argument B*x + C
  let B = 1;
  let C = 0;
  const innerMatch = arg.match(/^([+-]?\d*\.?\d*)?\*?x([+-]\d+\.?\d*(?:\*?pi)?)?$/i);
  if (innerMatch) {
    const bStr = innerMatch[1];
    B = !bStr || bStr === '+' ? 1 : bStr === '-' ? -1 : parseFloat(bStr);
    if (innerMatch[2]) {
      const cStr = innerMatch[2].replace(/\*?pi/gi, `*${Math.PI}`);
      if (/^[+-]?\d+(\.\d+)?$/.test(cStr)) C = parseFloat(cStr);
    }
  }

  const absB = Math.abs(B) || 1;
  const basePeriod = fn === 'tan' || fn === 'cot' ? Math.PI : 2 * Math.PI;
  const period = basePeriod / absB;
  const frequency = 1 / period;
  const phaseShift = -C / (B || 1);

  const hasAmplitude = fn === 'sin' || fn === 'cos';
  let asymptotesDescription: string | undefined;
  let domainDescription = 'ℝ (all real numbers)';

  if (fn === 'tan' || fn === 'sec') {
    asymptotesDescription = `x = π/(2·${absB}) + k·π/${absB}, k ∈ ℤ`;
    domainDescription = `x ≠ π/(2·${absB}) + k·π/${absB}`;
  } else if (fn === 'cot' || fn === 'csc') {
    asymptotesDescription = `x = k·π/${absB}, k ∈ ℤ`;
    domainDescription = `x ≠ k·π/${absB}`;
  }

  return {
    functionName: fn,
    amplitude: hasAmplitude ? Math.abs(A) : undefined,
    period,
    frequency,
    phaseShift,
    verticalShift: D,
    asymptotesDescription,
    domainDescription,
  };
}
