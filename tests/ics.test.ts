import test from 'node:test';
import assert from 'node:assert/strict';
import { buildIcs, icsFileName, zonedTimeToUtc } from '../src/lib/ics';
import type { CalendarEventDraft } from '../src/shared/types';

const draft = (over: Partial<CalendarEventDraft> = {}): CalendarEventDraft => ({
  title: 'NeurIPS 2026 — Paper submission',
  description: 'Full Paper Submission Deadline',
  startDate: '2026-05-15',
  sourceUrl: 'https://neurips.cc/Conferences/2026/Dates',
  ...over,
});

test('valid VCALENDAR structure with one all-day event', () => {
  const ics = buildIcs([draft()]);
  assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\n'));
  assert.ok(ics.includes('BEGIN:VEVENT'));
  assert.ok(ics.includes('DTSTART;VALUE=DATE:20260515'));
  assert.ok(ics.includes('DTEND;VALUE=DATE:20260516')); // exclusive end
  assert.ok(ics.includes('SUMMARY:NeurIPS 2026 — Paper submission'));
  assert.ok(ics.includes('Source:'));
  assert.ok(ics.includes('neurips.cc/Conferences/2026/Dates'));
  assert.ok(ics.trimEnd().endsWith('END:VCALENDAR'));
});

test('multi-day range uses exclusive DTEND', () => {
  const ics = buildIcs([draft({ startDate: '2026-12-08', endDate: '2026-12-10' })]);
  assert.ok(ics.includes('DTSTART;VALUE=DATE:20261208'));
  assert.ok(ics.includes('DTEND;VALUE=DATE:20261211'));
});

test('AoE deadline converts to correct UTC instant', () => {
  // 23:59 AoE (UTC-12) on May 15 = 11:59 UTC on May 16.
  const utc = zonedTimeToUtc('2026-05-15', '23:59', 'Etc/GMT+12');
  assert.equal(utc.toISOString(), '2026-05-16T11:59:00.000Z');
  const ics = buildIcs([draft({ time: '23:59', timezone: 'Etc/GMT+12' })]);
  assert.ok(ics.includes('DTSTART:20260516T115900Z'));
});

test('always has a 1-day alarm; week alarm only when requested', () => {
  const noWeek = buildIcs([draft()]);
  assert.ok(noWeek.includes('TRIGGER:-P1D'));
  assert.ok(!noWeek.includes('TRIGGER:-P7D'));
  const withWeek = buildIcs([draft({ weekReminder: true })]);
  assert.ok(withWeek.includes('TRIGGER:-P1D'));
  assert.ok(withWeek.includes('TRIGGER:-P7D'));
});

test('special characters are escaped', () => {
  const ics = buildIcs([draft({ title: 'Deadline; final, really\nno extensions' })]);
  assert.ok(ics.includes('SUMMARY:Deadline\\; final\\, really\\nno extensions'));
});

test('multiple events in one calendar', () => {
  const ics = buildIcs([draft(), draft({ title: 'Camera-ready', startDate: '2026-10-22' })]);
  assert.equal((ics.match(/BEGIN:VEVENT/g) ?? []).length, 2);
  assert.equal((ics.match(/END:VEVENT/g) ?? []).length, 2);
});

test('file naming', () => {
  assert.equal(icsFileName([draft({ title: 'Paper Deadline (AoE)!' })]), 'paper-deadline-aoe.ics');
  assert.equal(icsFileName([draft(), draft()]), '2-deadlines.ics');
  assert.equal(icsFileName([draft({ title: 'X' })], '3'), '3-x.ics');
});
