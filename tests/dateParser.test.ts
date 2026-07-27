import test from 'node:test';
import assert from 'node:assert/strict';
import { parseDates, toISODate, tzFromLabel } from '../src/lib/dateParser';

const REF = new Date('2026-07-11T12:00:00Z');
const opts = { referenceDate: REF };

test('simple US date with year', () => {
  const m = parseDates('Paper submission deadline: May 15, 2026', opts);
  assert.equal(m.length, 1);
  assert.equal(toISODate(m[0].start), '2026-05-15');
  assert.ok(m[0].confidence >= 0.9);
});

test('day-of-week prefix and ordinal suffix', () => {
  const m = parseDates('Due Friday, September 3rd, 2026 at noon', opts);
  assert.equal(toISODate(m[0].start), '2026-09-03');
});

test('abbreviated month with period', () => {
  const m = parseDates('Camera-ready: Sept. 21, 2026', opts);
  assert.equal(toISODate(m[0].start), '2026-09-21');
});

test('European format', () => {
  const m = parseDates('The rebuttal period ends on 15 August 2026.', opts);
  assert.equal(toISODate(m[0].start), '2026-08-15');
});

test('ISO format', () => {
  const m = parseDates('Deadline: 2026-01-22 23:59 UTC', opts);
  assert.equal(toISODate(m[0].start), '2026-01-22');
  assert.deepEqual(m[0].time, { h: 23, min: 59 });
  assert.equal(m[0].timezone, 'UTC');
});

test('in-month range', () => {
  const m = parseDates('The conference will be held December 6–12, 2026.', opts);
  assert.equal(m.length, 1);
  assert.equal(toISODate(m[0].start), '2026-12-06');
  assert.equal(toISODate(m[0].end!), '2026-12-12');
});

test('cross-month range', () => {
  const m = parseDates('ACL 2026 takes place July 28 – August 1, 2026 in Vienna.', opts);
  assert.equal(toISODate(m[0].start), '2026-07-28');
  assert.equal(toISODate(m[0].end!), '2026-08-01');
});

test('cross-year range infers start year', () => {
  const m = parseDates('Dec 28 – Jan 3, 2027', opts);
  assert.equal(toISODate(m[0].start), '2026-12-28');
  assert.equal(toISODate(m[0].end!), '2027-01-03');
});

test('European range "15–19 May 2026"', () => {
  const m = parseDates('Held 15–19 May 2026 in Singapore', opts);
  assert.equal(toISODate(m[0].start), '2026-05-15');
  assert.equal(toISODate(m[0].end!), '2026-05-19');
});

test('missing year is inferred and lowers confidence', () => {
  const m = parseDates('Abstracts due January 22.', opts);
  assert.equal(toISODate(m[0].start), '2027-01-22'); // Jan 22 already >2mo past ref (Jul 2026)
  assert.ok(m[0].confidence < 0.9);
  assert.equal(m[0].hadYear, false);
});

test('recent past date without year stays in current year', () => {
  const m = parseDates('Reviews were released on June 10.', opts);
  assert.equal(toISODate(m[0].start), '2026-06-10');
});

test('AoE timezone detection', () => {
  const m = parseDates('Submission deadline: May 22, 2026, 11:59 PM AoE', opts);
  assert.deepEqual(m[0].time, { h: 23, min: 59 });
  assert.equal(m[0].timezoneLabel, 'AoE');
  assert.equal(m[0].timezone, 'Etc/GMT+12');
});

test('"Anywhere on Earth" long form', () => {
  const m = parseDates('due 23:59 Anywhere on Earth on March 2, 2026', opts);
  assert.equal(m[0].timezone, 'Etc/GMT+12');
  assert.deepEqual(m[0].time, { h: 23, min: 59 });
});

test('am/pm without minutes', () => {
  const m = parseDates('Deadline: June 5, 2026 at 5pm PT', opts);
  assert.deepEqual(m[0].time, { h: 17, min: 0 });
  assert.equal(m[0].timezone, 'America/Los_Angeles');
});

test('numeric MDY vs DMY setting', () => {
  const us = parseDates('Due 05/06/2026', { ...opts, numericDateOrder: 'MDY' });
  assert.equal(toISODate(us[0].start), '2026-05-06');
  const eu = parseDates('Due 05/06/2026', { ...opts, numericDateOrder: 'DMY' });
  assert.equal(toISODate(eu[0].start), '2026-06-05');
  assert.ok(us[0].confidence < 0.7); // ambiguous → low confidence
});

test('unambiguous numeric date ignores setting', () => {
  const m = parseDates('Due 25/06/2026', { ...opts, numericDateOrder: 'MDY' });
  assert.equal(toISODate(m[0].start), '2026-06-25');
});

test('invalid dates are rejected', () => {
  assert.equal(parseDates('February 30, 2026', opts).length, 0);
  assert.equal(parseDates('The room number is 45/90/2026x', opts).length, 0);
});

test('multiple dates in one block, no overlap double-count', () => {
  const text =
    'Abstract deadline: May 15, 2026. Full paper deadline: May 22, 2026 (11:59pm AoE). Notification: September 24, 2026.';
  const m = parseDates(text, opts);
  assert.equal(m.length, 3);
  assert.equal(toISODate(m[1].start), '2026-05-22');
  assert.equal(m[1].timezoneLabel, 'AoE');
});

test('time from next sentence is not stolen', () => {
  const m = parseDates('Notification: Sep 24, 2026. Check-in opens at 8:00 am daily.', opts);
  assert.equal(m[0].time, undefined);
});

test('tzFromLabel handles UTC offsets with inverted Etc sign', () => {
  assert.equal(tzFromLabel('UTC-12'), 'Etc/GMT+12');
  assert.equal(tzFromLabel('UTC+8'), 'Etc/GMT-8');
  assert.equal(tzFromLabel('GMT+0'), 'UTC');
});

test('plain years and versions do not match', () => {
  assert.equal(parseDates('Copyright 2026, version 3.2.1, ISBN 978-3', opts).length, 0);
});
