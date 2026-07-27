import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { extractBlocks } from '../src/lib/extract';

function blocksOf(html: string): string[] {
  const dom = new JSDOM(`<body>${html}</body>`, { url: 'https://example.org/' });
  (dom.window.Element.prototype as any).checkVisibility = () => true;
  (globalThis as any).Node = dom.window.Node;
  (globalThis as any).Document = dom.window.Document;
  (globalThis as any).Element = dom.window.Element;
  return extractBlocks(dom.window.document).map((b) => b.text);
}

test('date and label in separate elements get a space (AAAI case)', () => {
  const blocks = blocksOf(
    '<div><p><b>July 28, 2026</b>Full papers due at 11:59 PM UTC-12</p></div>',
  );
  assert.ok(
    blocks.some((t) => t.includes('July 28, 2026 Full papers due at 11:59 PM UTC-12')),
    JSON.stringify(blocks),
  );
});

test('inline spans in a mixed div are separated by spaces', () => {
  const blocks = blocksOf(
    '<div><span>September 24, 2026</span><span>Notification of Phase 1 rejections</span></div>',
  );
  assert.ok(
    blocks.some((t) => t.includes('September 24, 2026 Notification of Phase 1 rejections')),
    JSON.stringify(blocks),
  );
});

test('ordinals are not split ("Dec 8th" stays intact)', () => {
  const blocks = blocksOf('<p>Conference Sessions — Tue Dec 8th through Thu Dec 10th</p>');
  assert.ok(blocks.some((t) => t.includes('Dec 8th through')), JSON.stringify(blocks));
});
