import test from 'node:test';
import assert from 'node:assert/strict';
import { detectInBlocks, type TextBlock } from '../src/lib/detect';

const REF = new Date('2026-01-15T12:00:00Z');
const opts = { referenceDate: REF };

test('AAAI-style numbered prose with full dates and AoE times', () => {
  const blocks: TextBlock[] = [
    { text: 'Abstracts due: August 5, 2026 at 11:59 PM UTC-12 (AoE)', heading: 'AAAI-27 Important Dates' },
    { text: 'Full papers due: August 9, 2026 at 11:59 PM UTC-12', heading: 'AAAI-27 Important Dates' },
    { text: 'Notification of final acceptance or rejection: November 12, 2026', heading: 'AAAI-27 Important Dates' },
    { text: 'AAAI-27 will be held January 26 – February 2, 2027 at the Convention Centre.', heading: 'AAAI-27' },
  ];
  const dates = detectInBlocks(blocks, { url: 'https://aaai.org/conference/aaai-27/', title: 'AAAI-27' }, opts);
  assert.equal(dates.length, 4);
  const conf = dates.find((d) => d.category === 'conference')!;
  assert.equal(conf.startDate, '2027-01-26');
  assert.equal(conf.endDate, '2027-02-02');
  const abs = dates.find((d) => d.category === 'abstract')!;
  assert.equal(abs.startDate, '2026-08-05');
  assert.equal(abs.time, '23:59');
  assert.equal(abs.timezone, 'Etc/GMT+12');
});

test('ICLR-style table rows joined by dashes', () => {
  const blocks: TextBlock[] = [
    { text: 'Abstract submission deadline — Sep 19, 2026 — 11:59pm AoE', heading: 'ICLR 2027 Dates' },
    { text: 'Paper submission deadline — Sep 24, 2026 — 11:59pm AoE', heading: 'ICLR 2027 Dates' },
    { text: 'Reviews released — Nov 10, 2026', heading: 'ICLR 2027 Dates' },
    { text: 'Author-reviewer discussion — Nov 10 – Nov 24, 2026', heading: 'ICLR 2027 Dates' },
    { text: 'Decision notification — Jan 22, 2027', heading: 'ICLR 2027 Dates' },
  ];
  const dates = detectInBlocks(blocks, { url: 'https://iclr.cc/Conferences/2027', title: 'ICLR 2027' }, opts);
  assert.equal(dates.length, 5);
  const byCat = Object.fromEntries(dates.map((d) => [d.category, d]));
  assert.equal(byCat['abstract'].startDate, '2026-09-19');
  assert.equal(byCat['submission'].startDate, '2026-09-24');
  assert.equal(byCat['review'].startDate, '2026-11-10');
  assert.equal(byCat['rebuttal'].startDate, '2026-11-10');
  assert.equal(byCat['rebuttal'].endDate, '2026-11-24');
  assert.equal(byCat['notification'].startDate, '2027-01-22');
  for (const d of dates) assert.equal(d.conference, 'ICLR 2027');
});

test('CFP with ISO dates and European formats mixed', () => {
  const blocks: TextBlock[] = [
    { text: 'Submission site opens: 2026-02-01. Papers due 15 March 2026, 23:59 CET.', heading: 'Call for Papers' },
    { text: 'Early-bird registration closes on 1 June 2026.', heading: 'Registration' },
  ];
  const dates = detectInBlocks(blocks, { url: 'https://example-workshop.eu/cfp', title: 'GreatWorkshop 2026 CFP' }, opts);
  const due = dates.find((d) => d.startDate === '2026-03-15')!;
  assert.equal(due.category, 'submission');
  assert.equal(due.time, '23:59');
  assert.equal(due.timezone, 'Europe/Paris');
  const reg = dates.find((d) => d.startDate === '2026-06-01')!;
  assert.equal(reg.category, 'registration');
});

test('non-academic page: product launch and webinar', () => {
  const blocks: TextBlock[] = [
    { text: 'Join our webinar on Tuesday, February 10, 2026 at 10:00 AM PT.' },
    { text: 'The v2.0 release ships 03/02/2026.' },
  ];
  const dates = detectInBlocks(blocks, { url: 'https://example.com/news', title: 'Product news' }, opts);
  assert.equal(dates.length, 2);
  const webinar = dates.find((d) => d.startDate === '2026-02-10')!;
  assert.equal(webinar.time, '10:00');
  assert.equal(webinar.timezone, 'America/Los_Angeles');
  // numeric date honors MDY default and is flagged low-confidence
  const release = dates.find((d) => d.startDate === '2026-03-02')!;
  assert.ok(release.confidence < 0.7);
});

test('pages with no dates produce no detections', () => {
  const blocks: TextBlock[] = [
    { text: 'Welcome to my homepage. I enjoy hiking and photography.' },
    { text: 'Contact me at someone@example.com or +1 555 0100.' },
  ];
  assert.equal(detectInBlocks(blocks, { url: 'https://example.com', title: 'Home' }, opts).length, 0);
});

// Regressions found by running the pipeline on the real neurips.cc/2026/Dates page.
test("NeurIPS-style abbreviated years \"May 04 '26\" parse to 2026, not inferred", () => {
  const blocks: TextBlock[] = [
    { text: "Paper Abstract Submission Deadline — May 04 '26 (Anywhere on Earth)", heading: 'Dates and Deadlines' },
    { text: "Full Paper Submission Deadline — May 06 '26 (Anywhere on Earth)", heading: 'Dates and Deadlines' },
  ];
  const dates = detectInBlocks(blocks, { url: 'https://neurips.cc/Conferences/2026/Dates', title: 'NeurIPS 2026 Dates' }, { referenceDate: new Date('2026-07-11') });
  assert.equal(dates.length, 2);
  assert.equal(dates[0].startDate, '2026-05-04');
  assert.equal(dates[0].category, 'abstract');
  assert.equal(dates[1].startDate, '2026-05-06');
  assert.equal(dates[1].category, 'submission');
  assert.equal(dates[0].timezone, 'Etc/GMT+12');
  assert.ok(dates[0].confidence >= 0.9);
});

test('yearless day-of-week ranges become one range event', () => {
  const blocks: TextBlock[] = [
    { text: 'Conference Sessions — Tue Dec 8th through Thu Dec 10th', heading: 'NeurIPS 2026' },
    { text: 'Workshops — Fri Dec 11th through Sat Dec 12th', heading: 'NeurIPS 2026' },
  ];
  const dates = detectInBlocks(blocks, { url: 'https://neurips.cc', title: 'NeurIPS 2026' }, { referenceDate: new Date('2026-07-11') });
  assert.equal(dates.length, 2);
  assert.equal(dates[0].startDate, '2026-12-08');
  assert.equal(dates[0].endDate, '2026-12-10');
  assert.equal(dates[1].startDate, '2026-12-11');
  assert.equal(dates[1].endDate, '2026-12-12');
});

test('unrelated deadlines are not labeled "Paper submission"', () => {
  const blocks: TextBlock[] = [
    { text: "Sponsor Payment Deadline — Nov 07 '26 (Anywhere on Earth)", heading: 'Dates and Deadlines' },
  ];
  const dates = detectInBlocks(blocks, { url: 'https://neurips.cc/Conferences/2026/Dates', title: 'NeurIPS 2026 Dates' }, { referenceDate: new Date('2026-07-11') });
  assert.equal(dates[0].category, 'other');
  assert.ok(dates[0].title.includes('Sponsor Payment Deadline'));
});
