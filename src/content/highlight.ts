/**
 * Non-destructive date highlighting via the CSS Custom Highlight API.
 * Also tries year-stripped variants (ARR cells: "May 25" vs "May 25, 2026").
 */
import type { DetectedDate } from '../shared/types';

const HIGHLIGHT_NAME = 'dd-dates';

function searchTexts(raw: string): string[] {
  const texts = [raw];
  const noYear = raw.replace(/,?\s*(?:19|20)\d{2}\s*$/, '').trim();
  if (noYear.length >= 4 && noYear !== raw) texts.push(noYear);
  return texts;
}

export function applyHighlights(dates: DetectedDate[]): void {
  if (!('highlights' in CSS)) return;
  const wanted = new Set<string>();
  for (const d of dates) {
    if (!d.rawText || d.rawText.length < 4) continue;
    for (const t of searchTexts(d.rawText)) wanted.add(t);
  }
  if (wanted.size === 0) {
    CSS.highlights.delete(HIGHLIGHT_NAME);
    return;
  }

  const ranges: Range[] = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent || ['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(parent.tagName)) {
        return NodeFilter.FILTER_REJECT;
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  let node: Node | null;
  while ((node = walker.nextNode()) !== null && ranges.length < 500) {
    const text = node.textContent ?? '';
    for (const raw of wanted) {
      let idx = text.indexOf(raw);
      while (idx !== -1 && ranges.length < 500) {
        try {
          const range = new Range();
          range.setStart(node, idx);
          range.setEnd(node, idx + raw.length);
          ranges.push(range);
        } catch {
          // skip invalid ranges
        }
        idx = text.indexOf(raw, idx + raw.length);
      }
    }
  }
  if (ranges.length === 0) {
    CSS.highlights.delete(HIGHLIGHT_NAME);
    return;
  }
  CSS.highlights.set(HIGHLIGHT_NAME, new Highlight(...ranges));
}

export function clearHighlights(): void {
  if ('highlights' in CSS) CSS.highlights.delete(HIGHLIGHT_NAME);
}
