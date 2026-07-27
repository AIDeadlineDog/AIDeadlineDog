import test from 'node:test';
import assert from 'node:assert/strict';
import {
  makeId, deadlineInstant, nextDeadline, formatCountdown, foldTracked, earlierUntracked,
  type TrackedDeadline,
} from '../src/shared/tracked';

const NOW = new Date('2026-07-11T12:00:00Z');

const mk = (over: Partial<TrackedDeadline> = {}): TrackedDeadline => ({
  id: makeId(over.title ?? 'Paper submission', over.startDate ?? '2026-08-01', over.conference),
  title: 'Paper submission',
  category: 'submission',
  startDate: '2026-08-01',
  sourceUrl: 'https://example.org',
  addedAt: NOW.toISOString(),
  ...over,
});

test('makeId is stable and distinguishes deadlines', () => {
  assert.equal(makeId('Paper', '2026-08-01', 'X 2026'), makeId('Paper', '2026-08-01', 'X 2026'));
  assert.notEqual(makeId('Paper', '2026-08-01'), makeId('Paper', '2026-08-02'));
  assert.notEqual(makeId('Paper', '2026-08-01', 'A'), makeId('Paper', '2026-08-01', 'B'));
});

test('AoE deadline instant is the true UTC moment', () => {
  const d = mk({ startDate: '2026-05-15', time: '23:59', timezone: 'Etc/GMT+12' });
  assert.equal(deadlineInstant(d).toISOString(), '2026-05-16T11:59:00.000Z');
});

test('nextDeadline picks the earliest upcoming instant, skipping past ones', () => {
  const past = mk({ startDate: '2026-07-01', title: 'Past deadline' });
  const soon = mk({ startDate: '2026-07-20', title: 'Soon deadline' });
  const later = mk({ startDate: '2026-09-01', title: 'Later deadline' });
  assert.equal(nextDeadline([later, past, soon], NOW)?.title, 'Soon deadline');
  assert.equal(nextDeadline([past], NOW), null);
  assert.equal(nextDeadline([], NOW), null);
});

test('timezone can change which deadline is next', () => {
  // Same calendar date: AoE (UTC-12) passes later than Tokyo time.
  const aoe = mk({ startDate: '2026-07-12', time: '23:59', timezone: 'Etc/GMT+12', title: 'AoE' });
  const tokyo = mk({ startDate: '2026-07-12', time: '23:59', timezone: 'Asia/Tokyo', title: 'Tokyo' });
  assert.equal(nextDeadline([aoe, tokyo], NOW)?.title, 'Tokyo');
});

test('formatCountdown buckets: days / hours / imminent', () => {
  // Local-time dates so calendar-day math is deterministic in any timezone.
  const local = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h);
  const now = local(2026, 7, 11);
  assert.equal(formatCountdown(local(2026, 7, 31), now, '2026-07-31').text, '20d');
  assert.equal(formatCountdown(local(2026, 7, 31), now, '2026-07-31').urgency, 'far');
  assert.equal(formatCountdown(local(2026, 7, 18), now, '2026-07-18').urgency, 'soon');
  assert.equal(formatCountdown(local(2026, 7, 13, 11), now, '2026-07-13').text, '2d');
  assert.equal(formatCountdown(local(2026, 7, 11, 20), now).text, '8h');
  assert.equal(formatCountdown(new Date(now.getTime() + 30 * 60000), now).text, '30m');
  assert.equal(formatCountdown(new Date(now.getTime() + 3 * 60000), now).text, '⏰');
  // Hours floor — 1.4h left must NOT read "2h".
  assert.equal(formatCountdown(new Date(now.getTime() + 84 * 60000), now).text, '1h');
});

test('AoE deadline counts calendar days to its stated date (AAAI case)', () => {
  const local = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h);
  const now = local(2026, 7, 12);
  // Stated date July 22, AoE — instant is July 23 11:59 UTC, but people
  // count July 22 − July 12 = 10 days, not ceil(exact hours) = 11.
  const instant = new Date('2026-07-23T11:59:00Z');
  const c = formatCountdown(instant, now, '2026-07-22');
  assert.equal(c.text, '10d');
  // Hours take over on the final day, when AoE grace time matters.
  const lastDay = formatCountdown(instant, new Date('2026-07-22T20:59:00Z'), '2026-07-22');
  assert.equal(lastDay.text, '15h');
});

test('foldTracked deduplicates same date + similar title, keeps original id', () => {
  const a = mk({ title: 'NeurIPS 2026 — Paper submission' });
  const b = mk({ title: 'Paper submission (NeurIPS 2026)', time: '23:59', timezone: 'Etc/GMT+12' });
  const list = foldTracked(foldTracked([], a, NOW), b, NOW);
  assert.equal(list.length, 1);
  assert.equal(list[0].id, a.id);          // identity preserved
  assert.equal(list[0].time, '23:59');     // details updated
});

test('foldTracked prunes entries >30 days past', () => {
  const old = mk({ startDate: '2026-05-01', title: 'Long past' });
  const recent = mk({ startDate: '2026-07-01', title: 'Recently past' });
  const upcoming = mk({ startDate: '2026-09-01', title: 'Upcoming' });
  const list = foldTracked([old, recent], upcoming, NOW);
  assert.deepEqual(list.map((d) => d.title).sort(), ['Recently past', 'Upcoming']);
});

test('earlierUntracked flags a seen deadline sooner than the nearest tracked one', () => {
  const tracked = [mk({ startDate: '2026-12-01', title: 'NeurIPS camera-ready' })];
  const seen = [
    mk({ startDate: '2026-09-15', title: 'ACL paper submission' }),   // earlier — flag
    mk({ startDate: '2027-01-10', title: 'ICLR paper submission' }),  // later — ignore
    mk({ startDate: '2026-06-01', title: 'Past deadline' }),          // past — ignore
  ];
  const nudges = earlierUntracked(tracked, seen, new Set(), NOW);
  assert.equal(nudges.length, 1);
  assert.equal(nudges[0].title, 'ACL paper submission');
});

test('earlierUntracked: dismissed and already-tracked lookalikes are excluded', () => {
  const tracked = [
    mk({ startDate: '2026-12-01', title: 'NeurIPS camera-ready' }),
    mk({ startDate: '2026-09-15', title: 'ACL paper submission (edited)' }),
  ];
  const dupOfTracked = mk({ startDate: '2026-09-15', title: 'ACL paper submission' });
  const dismissed = mk({ startDate: '2026-08-20', title: 'Workshop deadline' });
  const ignores = new Set([`${dismissed.id}|${dismissed.startDate}`]);
  assert.equal(earlierUntracked(tracked, [dupOfTracked, dismissed], ignores, NOW).length, 0);
});

test('earlierUntracked is empty when nothing is tracked (badge already uses seen)', () => {
  const seen = [mk({ startDate: '2026-09-15' })];
  assert.equal(earlierUntracked([], seen, new Set(), NOW).length, 0);
});

test('dueReminders: fires at thresholds, once, consuming all satisfied levels', () => {
  const { dueReminders } = require('../src/shared/tracked') as typeof import('../src/shared/tracked');
  const local = (y: number, m: number, d: number) => new Date(y, m - 1, d, 9);
  const now = local(2026, 7, 12);
  const d7 = mk({ startDate: '2026-07-19', title: 'Seven days out' });
  const d20 = mk({ startDate: '2026-08-01', title: 'Far away' });
  const d1 = mk({ startDate: '2026-07-13', title: 'Tomorrow' });

  // 7-day threshold triggers; far one silent.
  let due = dueReminders([d7, d20], [7, 1], new Set(), now);
  assert.deepEqual(due.map((r) => r.deadline.title), ['Seven days out']);
  assert.deepEqual(due[0].thresholds, [7]);

  // Booked 1 day out: both thresholds satisfied → one announcement, both consumed.
  due = dueReminders([d1], [7, 1], new Set(), now);
  assert.equal(due.length, 1);
  assert.deepEqual(due[0].thresholds, [7, 1]);

  // After firing, silent.
  const fired = new Set(due[0].thresholds.map((t) => `${d1.id}|${d1.startDate}|${t}`));
  assert.equal(dueReminders([d1], [7, 1], fired, now).length, 0);

  // 7d fired earlier; at 1 day the 1-threshold still fires.
  const fired7 = new Set([`${d1.id}|${d1.startDate}|7`]);
  due = dueReminders([d1], [7, 1], fired7, now);
  assert.equal(due.length, 1);

  // Past deadlines never remind.
  const past = mk({ startDate: '2026-07-01', title: 'Gone' });
  assert.equal(dueReminders([past], [7, 1], new Set(), now).length, 0);
});

test('countdown units localize (9d → 9日 in Japanese)', async () => {
  const { initI18n } = await import('../src/shared/i18n');
  const local = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12);
  const now = local(2026, 7, 12);
  const target = local(2026, 7, 21);
  initI18n('ja');
  assert.equal(formatCountdown(target, now, '2026-07-21').text, '9日');
  assert.equal(formatCountdown(new Date(now.getTime() + 5 * 3600_000), now).text, '5時');
  assert.equal(formatCountdown(new Date(now.getTime() + 30 * 60000), now).text, '30分');
  // Badge always stays Latin regardless of language.
  assert.equal(formatCountdown(target, now, '2026-07-21').compact, '9d');
  assert.equal(formatCountdown(new Date(now.getTime() + 5 * 3600_000), now).compact, '5h');
  initI18n('es');
  assert.equal(formatCountdown(target, now, '2026-07-21').text, '9d');
  initI18n('en'); // restore for other tests
  assert.equal(formatCountdown(target, now, '2026-07-21').text, '9d');
});

test('badge shows kanji units when they fit, Latin only when too wide', async () => {
  const { fitBadge } = await import('../src/shared/tracked');
  assert.equal(fitBadge('9日'), '9日');     // 3 units — fits
  assert.equal(fitBadge('99日'), '99日');   // 4 units — fits
  assert.equal(fitBadge('12時'), '12時');   // 4 units — fits
  assert.equal(fitBadge('45分'), '45分');   // 4 units — fits
  assert.equal(fitBadge('365日'), '365d');  // 5 units — Latin fallback
  assert.equal(fitBadge('⏰'), '⏰');
  assert.equal(fitBadge('12h'), '12h');
});
