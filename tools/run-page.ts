/**
 * Harness: run the extension's real detection pipeline (extract → detect →
 * merge) over a saved HTML page in jsdom. Usage:
 *   node .test-dist/run-page.mjs <file.html> <original-url>
 */
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { extractBlocks, extractStructuredEvents } from '../src/lib/extract';
import { detectInBlocks } from '../src/lib/detect';
import { mergeDetections } from '../src/lib/dedupe';

const [file, url] = process.argv.slice(2);
const dom = new JSDOM(readFileSync(file, 'utf8'), { url });

// jsdom does no layout; treat everything as visible (as Chrome would for
// normally-displayed content).
(dom.window.Element.prototype as any).checkVisibility = () => true;
(globalThis as any).Node = dom.window.Node;
(globalThis as any).Document = dom.window.Document;
(globalThis as any).Element = dom.window.Element;

const doc = dom.window.document;
const blocks = extractBlocks(doc);
const dates = mergeDetections([
  ...extractStructuredEvents(doc, url),
  ...detectInBlocks(blocks, { url, title: doc.title }),
]);

console.log(`page title : ${doc.title.trim().replace(/\s+/g, ' ')}`);
console.log(`text blocks : ${blocks.length}`);
console.log(`detected : ${dates.length} dates\n`);
for (const d of dates) {
  const when = d.startDate + (d.endDate ? ` → ${d.endDate}` : '') + (d.time ? ` ${d.time}` : '') + (d.timezoneLabel ? ` ${d.timezoneLabel}` : '');
  console.log(`[${(d.confidence * 100).toFixed(0).padStart(3)}%] ${d.category.padEnd(13)} ${when.padEnd(30)} ${d.title}`);
  console.log(`       context: ${d.context.slice(0, 110)}`);
}
