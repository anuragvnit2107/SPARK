import { MathHistoryEntry } from './types';

const STORAGE_KEY = 'spark_math_history_v1';
const MAX_ENTRIES = 120;

export function loadMathHistory(): MathHistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveMathHistory(entries: MathHistoryEntry[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)));
  } catch {
    // Ignore storage quota errors
  }
}

export function appendMathHistory(
  entry: Omit<MathHistoryEntry, 'id' | 'timestamp'>
): MathHistoryEntry[] {
  const existing = loadMathHistory();
  const nextItem: MathHistoryEntry = {
    ...entry,
    id: `mhist_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    timestamp: Date.now(),
  };
  const next = [nextItem, ...existing].slice(0, MAX_ENTRIES);
  saveMathHistory(next);
  return next;
}

export function deleteMathHistoryEntry(id: string): MathHistoryEntry[] {
  const next = loadMathHistory().filter((item) => item.id !== id);
  saveMathHistory(next);
  return next;
}

export function clearMathHistory(): MathHistoryEntry[] {
  saveMathHistory([]);
  return [];
}
