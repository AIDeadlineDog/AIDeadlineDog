/**
 * DOM extraction: converts the live page into text blocks for the detector,
 * plus JSON-LD structured-data events. Runs in the content script only.
 */
import type { TextBlock } from './detect';
import type { DetectedDate } from '../shared/types';

const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'SVG', 'CANVAS', 'IFRAME', 'CODE', 'PRE']);
const BLOCK_TAGS = new Set(['P', 'LI', 'DD', 'DT', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE', 'FIGCAPTION', 'SUMMARY', 'TD', 'TH', 'CAPTION', 'DIV', 'SECTION', 'ARTICLE', 'MAIN', 'ASIDE', 'HEADER', 'FOOTER', 'SPAN', 'A', 'STRONG', 'B', 'EM', 'TIME', 'LABEL']);

function textOf(el: Element): string {
  if (!el.querySelector('script,style,noscript,template')) return el.textContent ?? '';
  const clone = el.cloneNode(true) as Element;
  clone.querySelectorAll('script,style,noscript,template').forEach((n) => n.remove());
  return clone.textContent ?? '';
}

function isVisible(el: Element): boolean {
  if (typeof (el as HTMLElement).checkVisibility === 'function') {
    return (el as HTMLElement).checkVisibility();
  }
  return !!(el as HTMLElement).offsetParent || el.tagName === 'BODY';
}

const MONTH_IDX: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

function firstMonthIn(text: string): number | undefined {
  const m = /\b(January|February|March|April|May|June|July|August|September|October|November|December)\b/i.exec(text);
  return m ? MONTH_IDX[m[1].toLowerCase()] : undefined;
}

/**
 * Matrix date tables (e.g. aclrollingreview.org/dates): header = stages,
 * each row = cycle. Emit one labeled block per cell with the cycle year.
 */
function matrixTableBlocks(
  table: Element,
  heading: string | undefined,
  push: (text: string, heading?: string) => void,
): boolean {
  const rows = Array.from(table.querySelectorAll('tr')).filter((r) => r.closest('table') === table);
  if (rows.length < 3) return false;
  const headers = Array.from(rows[0].children).map((c) => textOf(c).replace(/\s+/g, ' ').trim());
  if (headers.length < 3) return false;
  const stageHeaders = headers.slice(1).filter((h) => /[A-Za-z]/.test(h) && !/\d{4}/.test(h));
  if (stageHeaders.length < 2) return false;
  const dataRows = rows.slice(1);
  const labeledRows = dataRows.filter((r) => /\b20\d{2}\b/.test(textOf(r.children[0] ?? r).trim().slice(0, 40)));
  if (labeledRows.length < dataRows.length * 0.6) return false;

  for (const row of rows.slice(1)) {
    const cells = Array.from(row.children).map((c) => textOf(c).replace(/\s+/g, ' ').trim());
    if (cells.length < 2) continue;
    const rowLabel = cells[0];
    const rowYear = /\b(20\d{2})\b/.exec(rowLabel)?.[1];
    const rowMonth = firstMonthIn(rowLabel);
    for (let i = 1; i < cells.length && i < headers.length; i++) {
      let cell = cells[i];
      if (!cell || /^(?:TBA|TBD|N\/A|-|—)$/i.test(cell)) continue;
      if (rowYear && !/\b(?:19|20)\d{2}\b/.test(cell)) {
        const cellMonth = firstMonthIn(cell);
        const wraps = cellMonth !== undefined && rowMonth !== undefined && cellMonth < rowMonth;
        cell = `${cell}, ${wraps ? Number(rowYear) + 1 : rowYear}`;
      }
      push(`${headers[i]} (${rowLabel}) — ${cell}`, heading);
    }
  }
  return true;
}

export function extractBlocks(root: Document | Element = document): TextBlock[] {
  const blocks: TextBlock[] = [];
  const seen = new Set<string>();
  let currentHeading: string | undefined;

  const push = (text: string, heading?: string) => {
    const t = text
      .replace(/\s+/g, ' ')
      // Dates and their labels often live in separate elements; textContent
      // glues them ("July 28, 2026Full papers due…"). Re-insert the space.
      .replace(/((?:19|20)\d{2})(?=[A-Za-z])/g, '$1 ')
      .trim();
    if (t.length < 4) return;
    const key = t.slice(0, 200);
    if (seen.has(key)) return;
    seen.add(key);
    blocks.push({ text: t, heading });
  };

  const walk = (el: Element) => {
    if (SKIP_TAGS.has(el.tagName) || !isVisible(el)) return;

    if (/^H[1-6]$/.test(el.tagName)) {
      currentHeading = el.textContent?.trim().slice(0, 120) || currentHeading;
      push(el.textContent ?? '', currentHeading);
      return;
    }
    if (el.tagName === 'TABLE' && matrixTableBlocks(el, currentHeading, push)) {
      return;
    }
    if (el.tagName === 'TR') {
      const cells = Array.from(el.children).map((c) => textOf(c).replace(/\s+/g, ' ').trim());
      push(cells.filter(Boolean).join(' — '), currentHeading);
      return;
    }
    if (el.tagName === 'DT') {
      const dd = el.nextElementSibling;
      const value = dd?.tagName === 'DD' ? textOf(dd) : '';
      push(`${textOf(el)} — ${value}`, currentHeading);
      return;
    }
    if (el.tagName === 'DD') return;

    if ((el.tagName === 'P' || el.tagName === 'LI') && el.textContent) {
      push(textOf(el), currentHeading);
      for (const child of el.children) if (child.tagName === 'UL' || child.tagName === 'OL') walk(child);
      return;
    }

    let hasElementChildren = false;
    for (const child of el.children) {
      hasElementChildren = true;
      walk(child);
    }
    if (!hasElementChildren && BLOCK_TAGS.has(el.tagName) && el.textContent) {
      push(el.textContent, currentHeading);
    } else if (hasElementChildren && el.tagName === 'DIV') {
      const INLINE = new Set(['SPAN', 'A', 'STRONG', 'B', 'EM', 'TIME']);
      const directText = Array.from(el.childNodes)
        .filter((n) => n.nodeType === Node.TEXT_NODE || (n instanceof Element && INLINE.has(n.tagName)))
        .map((n) => n.textContent ?? '')
        .join(' ');
      if (directText.replace(/\s+/g, ' ').trim().length >= 8) push(directText, currentHeading);
    }
  };

  // SPA sites (OpenReview et al.) often ship an empty body but embed venue
  // data — including labeled deadline strings — in inline script payloads
  // (__NEXT_DATA__ or App Router stream chunks). Mine tightly-labeled date
  // fragments so deadlines are found even before the framework renders.
  const scriptDoc = root instanceof Document ? root : root.ownerDocument;
  if (scriptDoc) {
    const re = /[A-Z][\w /-]{0,40}?(?:Deadline|Start|End|Expiration|Registration|Due)s?: [A-Z][a-z]{2,8} \d{1,2},? \d{4}(?:,? \d{1,2}:\d{2}\s?(?:AM|PM)?)?(?: UTC[+-]?\d{0,2})?/g;
    const found = new Set<string>();
    for (const sc of scriptDoc.querySelectorAll('script:not([src])')) {
      const text = sc.textContent;
      if (!text || text.length < 40) continue;
      for (const frag of text.match(re) ?? []) found.add(frag.replace(/\\+n/g, ' '));
      if (found.size > 60) break;
    }
    for (const frag of found) push(frag, undefined);
  }

  // Meta descriptions often carry the key dates on JS-rendered pages
  // before any content exists in the body (e.g. SPA conference sites).
  const doc = root instanceof Document ? root : root.ownerDocument;
  for (const sel of ['meta[name="description"]', 'meta[property="og:description"]']) {
    const content = doc?.querySelector(sel)?.getAttribute('content');
    if (content) push(content, doc?.title ?? undefined);
  }

  const body = root instanceof Document ? root.body : root;
  if (body) walk(body);
  return blocks;
}

export function extractStructuredEvents(doc: Document, url: string): DetectedDate[] {
  const out: DetectedDate[] = [];
  const scripts = doc.querySelectorAll('script[type="application/ld+json"]');
  let i = 0;
  for (const script of scripts) {
    let data: unknown;
    try {
      data = JSON.parse(script.textContent ?? '');
    } catch {
      continue;
    }
    const nodes: any[] = [];
    const collect = (n: any) => {
      if (Array.isArray(n)) n.forEach(collect);
      else if (n && typeof n === 'object') {
        nodes.push(n);
        if (n['@graph']) collect(n['@graph']);
      }
    };
    collect(data);

    for (const node of nodes) {
      const type = String(node['@type'] ?? '');
      if (!/Event/i.test(type) || !node.startDate) continue;
      const start = String(node.startDate);
      const end = node.endDate ? String(node.endDate) : undefined;
      const dateOnly = (s: string) => s.slice(0, 10);
      const timePart = (s: string) => (s.length > 10 ? s.slice(11, 16) : undefined);
      const location =
        typeof node.location === 'string'
          ? node.location
          : node.location?.name ?? node.location?.address?.addressLocality;
      out.push({
        id: `dd-ld-${i++}`,
        title: String(node.name ?? 'Event'),
        category: 'conference',
        conference: undefined,
        startDate: dateOnly(start),
        endDate: end ? dateOnly(end) : undefined,
        time: timePart(start),
        rawText: String(node.name ?? start),
        context: [node.description, location && `Location: ${location}`].filter(Boolean).join(' — ').slice(0, 300),
        url,
        pageTitle: doc.title,
        confidence: 0.98,
        source: 'structured',
      });
    }
  }
  return out;
}
