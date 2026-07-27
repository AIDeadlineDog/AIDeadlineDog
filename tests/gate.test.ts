import test from 'node:test';
import assert from 'node:assert/strict';
import { isConferencePage, isExcludedPage, isCompleteDetection } from '../src/lib/classify';
import type { Category } from '../src/shared/types';
import { detectInBlocks, type TextBlock } from '../src/lib/detect';

const strong = (category: Category = 'submission', confidence = 0.95) => ({ category, confidence });
const weak = () => ({ category: 'other' as Category, confidence: 0.6 });

test('search engines and quoted-content hosts are always excluded', () => {
  assert.ok(isExcludedPage('https://www.google.com/search?q=emnlp+2026+abstract+deadline'));
  assert.ok(isExcludedPage('https://google.co.jp/search?q=deadline'));
  assert.ok(isExcludedPage('https://www.bing.com/search?q=neurips'));
  assert.ok(isExcludedPage('https://duckduckgo.com/?q=iclr'));
  assert.ok(isExcludedPage('https://mail.google.com/mail/u/0/'));
  assert.ok(isExcludedPage('https://x.com/somebody/status/1'));
  assert.ok(isExcludedPage('https://www.reddit.com/r/MachineLearning/'));
  // regular sites are not excluded
  assert.ok(!isExcludedPage('https://neurips.cc/Conferences/2026/Dates'));
  assert.ok(!isExcludedPage('https://docs.google.com/document/d/abc'));
  assert.ok(!isExcludedPage('https://2026.emnlp.org/'));
});

test('the EMNLP-on-Google case: search page never counts as a conference page', () => {
  // Even with a venue in the title and strong-looking detections quoted in
  // snippets, a search page must not produce calendar entries.
  const ok = isConferencePage(
    'https://www.google.com/search?q=EMNLP+2026+abstract+deadline',
    'EMNLP 2026 abstract deadline - Google Search',
    [strong('abstract'), strong('submission'), strong('notification')],
  );
  assert.equal(ok, false);
});

test('real conference pages pass the gate', () => {
  assert.ok(isConferencePage(
    'https://neurips.cc/Conferences/2026/Dates',
    '2026 Dates and Deadlines',
    [strong('abstract'), strong('submission')],
  ));
  assert.ok(isConferencePage(
    'https://2026.emnlp.org/',
    'The 2026 Conference on Empirical Methods in Natural Language Processing - EMNLP 2026',
    [strong('submission')],
  ));
  assert.ok(isConferencePage(
    'https://aclrollingreview.org/dates',
    'Dates and Venues – ACL Rolling Review',
    [strong('submission'), strong('review'), strong('rebuttal')],
  ));
});

test('ordinary pages with incidental dates do not pass', () => {
  // News article mentioning a date
  assert.ok(!isConferencePage('https://news.example.com/article', 'Local news today', [weak()]));
  // Personal homepage
  assert.ok(!isConferencePage('https://someone.github.io/', 'About me', []));
  // Shopping page with delivery dates
  assert.ok(!isConferencePage('https://shop.example.com/item', 'Buy widgets online', [weak(), weak()]));
});

test('completeness: vague matches are dropped, labeled ones kept', () => {
  assert.ok(isCompleteDetection({ category: 'submission', confidence: 0.9, source: 'regex' }));
  assert.ok(isCompleteDetection({ category: 'other', confidence: 0.9, source: 'regex' }));   // confident labeled row
  assert.ok(isCompleteDetection({ category: 'conference', confidence: 0.7, source: 'structured' }));
  assert.ok(!isCompleteDetection({ category: 'other', confidence: 0.6, source: 'regex' }));  // vague
  assert.ok(!isCompleteDetection({ category: 'submission', confidence: 0.55, source: 'regex' })); // too unsure
});

test('end-to-end: mixed-venue snippet soup stays out via the page gate', () => {
  // Simulates search-result snippets: many venues, no coherent page.
  const blocks: TextBlock[] = [
    { text: 'EMNLP 2026 abstract deadline May 11, 2026 - somebody.com' },
    { text: 'NeurIPS 2026: Paper submission deadline May 15, 2026 ...' },
    { text: 'ICLR 2027 notification Jan 22, 2027 · reddit discussion' },
  ];
  const found = detectInBlocks(blocks, {
    url: 'https://www.google.com/search?q=ai+conference+deadlines',
    title: 'ai conference deadlines - Google Search',
  }, { referenceDate: new Date('2026-01-15') });
  // Detection itself may find things — the gate is what suppresses them.
  assert.ok(!isConferencePage('https://www.google.com/search?q=ai+conference+deadlines', 'ai conference deadlines - Google Search', found));
});

test('conference homepage with a single confident date range passes (KDD case)', () => {
  assert.ok(isConferencePage(
    'https://kdd2026.kdd.org/',
    'KDD 2026 – KDD 2026 | Korea',
    [{ category: 'other', confidence: 0.85 }],
  ));
});

test('CVPR homepage news feed: year-less "Mon D:" timestamps are demoted', () => {
  const blocks: TextBlock[] = [
    { text: 'Nov 7: Important Update: Abstract Submission Deadline Extended', heading: 'News' },
    { text: 'Oct 1: Call for Papers is posted', heading: 'News' },
    { text: 'May 3: Main Conference Poster and YouTube video upload instructions', heading: 'News' },
  ];
  const found = detectInBlocks(blocks, { url: 'https://cvpr.thecvf.com/', title: '2026 Conference' }, { referenceDate: new Date('2026-07-11') });
  for (const d of found) {
    assert.equal(d.category, 'other', d.context);
    assert.ok(d.confidence <= 0.5, `${d.context} → ${d.confidence}`);
    assert.ok(!isCompleteDetection(d), d.context);
  }
});

test('dated deadline rows with a colon and a year are NOT demoted', () => {
  const blocks: TextBlock[] = [
    { text: 'March 20, 2026: Paper submission deadline (AoE)' },
    { text: 'Enrollment Form Deadline: Nov 16, 11:59pm AoE' },
  ];
  const found = detectInBlocks(blocks, { url: 'https://cvpr.thecvf.com/', title: '2026 Conference' }, { referenceDate: new Date('2026-01-15') });
  const withYear = found.find((d) => d.startDate === '2026-03-20')!;
  assert.equal(withYear.category, 'submission');
  assert.ok(withYear.confidence >= 0.9);
});

test('venue sentence with convention center classifies as conference dates', () => {
  const blocks: TextBlock[] = [
    { text: 'Wed June 3 - Sun June 7, 2026 at the Colorado Convention Center' },
  ];
  const found = detectInBlocks(blocks, { url: 'https://cvpr.thecvf.com/', title: '2026 Conference' }, { referenceDate: new Date('2026-01-15') });
  assert.equal(found[0].category, 'conference');
  assert.equal(found[0].startDate, '2026-06-03');
  assert.equal(found[0].endDate, '2026-06-07');
});

test('actionable-deadline filter for the automatic countdown pool', async () => {
  const { isActionableDeadline } = await import('../src/lib/classify');
  const mk = (category: Category, context: string) => ({ category, context });
  assert.ok(isActionableDeadline(mk('submission', 'Full Paper Submission Deadline — May 15')));
  assert.ok(isActionableDeadline(mk('registration', 'Early registration — Apr 23')));
  assert.ok(isActionableDeadline(mk('workshop', 'Workshop Submission Deadline — Nov 03')));   // deadline-worded
  assert.ok(!isActionableDeadline(mk('review', 'Reviews Released to Authors — Jul 22')));     // informational
  assert.ok(!isActionableDeadline(mk('notification', 'Notification of acceptance — Sep 24')));
  assert.ok(!isActionableDeadline(mk('conference', 'The conference will be held Dec 6-12')));
  assert.ok(!isActionableDeadline(mk('workshop', 'Workshops — Fri Dec 11th through Sat Dec 12th'))); // event, not deadline
});

test('OpenReview "Submission Start" is an opening, not an actionable deadline', async () => {
  const { isActionableDeadline, isImportantDate } = await import('../src/lib/classify');
  const start = { category: 'submission' as Category, context: 'Submission Start: Apr 15 2026 12:00PM UTC-0', startDate: '2026-04-15' };
  const due = { category: 'submission' as Category, context: 'Submission Deadline: May 07 2026 11:59AM UTC-0', startDate: '2026-05-07' };
  assert.ok(!isActionableDeadline(start));
  assert.ok(!isImportantDate(start, '2026-01-01'));
  assert.ok(isActionableDeadline(due));
  assert.ok(isImportantDate(due, '2026-01-01'));
});
