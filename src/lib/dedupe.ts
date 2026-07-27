/**
 * Duplicate detection: merges near-identical detections on a page and
 * compares against existing Google Calendar events.
 */
import type { DetectedDate } from '../shared/types';

/** Normalize a title for fuzzy comparison. */
export function normalizeTitle(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Tokenize with light plural stemming so "papers" matches "paper". */
function tokens(s: string): Set<string> {
  return new Set(
    normalizeTitle(s)
      .split(' ')
      .filter(Boolean)
      .map((t) => (t.length > 3 ? t.replace(/s$/, '') : t)),
  );
}

/** Token-set Jaccard similarity, 0..1. */
export function titleSimilarity(a: string, b: string): number {
  const ta = tokens(a);
  const tb = tokens(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  return inter / (ta.size + tb.size - inter);
}

/** True if two detections describe the same real-world date. */
export function isSameEvent(a: Pick<DetectedDate, 'title' | 'startDate'>, b: Pick<DetectedDate, 'title' | 'startDate'>): boolean {
  return a.startDate === b.startDate && titleSimilarity(a.title, b.title) >= 0.5;
}

/**
 * Merge duplicate detections, keeping the highest-confidence one. Besides
 * fuzzy-title duplicates, an unclassified ("other") match is folded into any
 * classified match with the same date — overlapping DOM blocks often produce
 * both a labeled row and a bare date for the same deadline.
 */
export function mergeDetections(items: DetectedDate[]): DetectedDate[] {
  const out: DetectedDate[] = [];
  for (const item of items.slice().sort((a, b) => b.confidence - a.confidence)) {
    const dup = out.find(
      (o) =>
        isSameEvent(o, item) ||
        (o.startDate === item.startDate &&
          (o.endDate ?? '') === (item.endDate ?? '') &&
          (o.category === 'other' || item.category === 'other')),
    );
    if (!dup) out.push(item);
    else if (item.context.length > dup.context.length && item.category === dup.category) {
      dup.context = item.context; // keep richer context
    }
  }
  return out.sort((a, b) => a.startDate.localeCompare(b.startDate));
}
