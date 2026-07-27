import test from 'node:test';
import assert from 'node:assert/strict';
import { detectInBlocks, type TextBlock } from '../src/lib/detect';
import { classify, detectConference } from '../src/lib/classify';
import { mergeDetections, titleSimilarity } from '../src/lib/dedupe';
import type { DetectedDate } from '../src/shared/types';

const REF = new Date('2025-11-01T12:00:00Z');
const page = { url: 'https://neurips.cc/Conferences/2026/Dates', title: 'NeurIPS 2026 Important Dates' };
const opts = { referenceDate: REF };

// Fixture modeled on the NeurIPS "Important Dates" table (rows joined by " — ").
const NEURIPS_BLOCKS: TextBlock[] = [
  { text: 'Abstract Submission Deadline — May 11, 2026 11:59 PM AoE', heading: 'Important Dates' },
  { text: 'Full Paper Submission Deadline — May 15, 2026 11:59 PM AoE', heading: 'Important Dates' },
  { text: 'Author Rebuttal Period — Jul 24 – Aug 5, 2026', heading: 'Important Dates' },
  { text: 'Notification of Acceptance — Sep 18, 2026', heading: 'Important Dates' },
  { text: 'Camera Ready Deadline — Oct 22, 2026 11:59 PM AoE', heading: 'Important Dates' },
  { text: 'The conference will be held December 6–12, 2026 in San Diego.', heading: 'NeurIPS 2026' },
];

test('conference page: all deadlines detected and classified', () => {
  const dates = detectInBlocks(NEURIPS_BLOCKS, page, opts);
  assert.equal(dates.length, 6);

  const byCat = Object.fromEntries(dates.map((d) => [d.category, d]));
  assert.equal(byCat['abstract'].startDate, '2026-05-11');
  assert.equal(byCat['submission'].startDate, '2026-05-15');
  assert.equal(byCat['rebuttal'].startDate, '2026-07-24');
  assert.equal(byCat['rebuttal'].endDate, '2026-08-05');
  assert.equal(byCat['notification'].startDate, '2026-09-18');
  assert.equal(byCat['camera-ready'].startDate, '2026-10-22');
  assert.equal(byCat['conference'].startDate, '2026-12-06');
  assert.equal(byCat['conference'].endDate, '2026-12-12');

  // AoE deadlines carry the timezone through.
  assert.equal(byCat['submission'].timezone, 'Etc/GMT+12');
  assert.equal(byCat['submission'].time, '23:59');

  // Grouping: everything attributed to NeurIPS 2026.
  for (const d of dates) assert.equal(d.conference, 'NeurIPS 2026');
});

test('ACL/ARR style prose page', () => {
  const blocks: TextBlock[] = [
    { text: 'ARR submission deadline for the October cycle is October 6, 2026 (AoE).', heading: 'ACL Rolling Review' },
    { text: 'Commitment deadline for ACL 2027: January 15, 2027.', heading: 'ACL Rolling Review' },
  ];
  const dates = detectInBlocks(blocks, { url: 'https://aclrollingreview.org/dates', title: 'ARR Dates' }, opts);
  assert.equal(dates.length, 2);
  assert.equal(dates[0].startDate, '2026-10-06');
  assert.ok(dates[0].conference?.includes('ARR'));
});

test('generic non-conference page still works', () => {
  const blocks: TextBlock[] = [
    { text: 'The application window closes on 31 March 2026 at 17:00 CET.' },
    { text: 'Final results will be announced on 2026-04-15.' },
  ];
  const dates = detectInBlocks(blocks, { url: 'https://example.org/grants', title: 'Grant program' }, opts);
  assert.equal(dates.length, 2);
  assert.equal(dates[0].startDate, '2026-03-31');
  assert.equal(dates[0].time, '17:00');
  assert.equal(dates[0].timezone, 'Europe/Paris');
});




test('classifier priorities', () => {
  assert.equal(classify('Camera-ready paper deadline').category, 'camera-ready');
  assert.equal(classify('Abstract submission deadline').category, 'abstract');
  assert.equal(classify('Paper submission deadline').category, 'submission');
  assert.equal(classify('Author response period').category, 'rebuttal');
  assert.equal(classify('Notification of acceptance').category, 'notification');
  assert.equal(classify('Early bird registration ends').category, 'registration');
  assert.equal(classify('The conference will be held in Vienna').category, 'conference');
  assert.equal(classify('Random sentence with nothing').category, 'other');
});

test('conference detection: known venues, NIPS aliasing, generic acronyms', () => {
  assert.equal(detectConference('NeurIPS 2026 Call for Papers'), 'NeurIPS 2026');
  assert.equal(detectConference('NIPS 2017 archive'), 'NeurIPS 2017');
  assert.equal(detectConference('AAAI-26 Important Dates', 'AAAI 2026'), 'AAAI 2026');
  assert.equal(detectConference('QIP 2026 — Quantum Information Processing'), 'QIP 2026');
  assert.equal(detectConference('Welcome to my homepage'), undefined);
});

test('duplicate merge: labeled row beats bare date', () => {
  const mk = (over: Partial<DetectedDate>): DetectedDate => ({
    id: Math.random().toString(36),
    title: 'x', category: 'other', startDate: '2026-05-15', rawText: 'May 15, 2026',
    context: '', url: 'u', confidence: 0.5, source: 'regex', ...over,
  });
  const merged = mergeDetections([
    mk({ title: 'Paper submission', category: 'submission', confidence: 0.95 }),
    mk({ title: 'May 15, 2026', category: 'other', confidence: 0.6 }),
  ]);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].category, 'submission');
});

test('titleSimilarity basics', () => {
  assert.ok(titleSimilarity('Paper submission deadline', 'Submission deadline (papers)') > 0.5);
  assert.ok(titleSimilarity('Registration opens', 'Camera-ready deadline') < 0.3);
});
