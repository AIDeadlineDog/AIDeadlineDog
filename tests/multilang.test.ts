import test from 'node:test';
import assert from 'node:assert/strict';
import { parseDates, toISODate } from '../src/lib/dateParser';
import { detectInBlocks, type TextBlock } from '../src/lib/detect';
import { classify } from '../src/lib/classify';

const REF = new Date('2026-01-15T12:00:00Z');
const opts = { referenceDate: REF };

// ---------- Japanese ----------

test('Japanese full date with weekday and time', () => {
  const m = parseDates('論文投稿締め切り：2026年5月15日（金）23時59分（日本時間）', opts);
  assert.equal(m.length, 1);
  assert.equal(toISODate(m[0].start), '2026-05-15');
  assert.deepEqual(m[0].time, { h: 23, min: 59 });
  assert.equal(m[0].timezone, 'Asia/Tokyo');
  assert.ok(m[0].confidence >= 0.9);
});

test('Japanese afternoon time 午後11時59分', () => {
  const m = parseDates('提出期限は2026年8月1日 午後11時59分です。', opts);
  assert.deepEqual(m[0].time, { h: 23, min: 59 });
});

test('Japanese range with wave dash', () => {
  const m = parseDates('会期：2026年12月6日〜12日', opts);
  assert.equal(m.length, 1);
  assert.equal(toISODate(m[0].start), '2026-12-06');
  assert.equal(toISODate(m[0].end!), '2026-12-12');
});

test('Japanese range から…まで across months', () => {
  const m = parseDates('12月6日から1月3日まで開催', opts);
  assert.equal(toISODate(m[0].start), '2026-12-06');
  assert.equal(toISODate(m[0].end!), '2027-01-03');
});

test('Japanese year-less date infers year', () => {
  const m = parseDates('結果通知：9月24日', opts);
  assert.equal(toISODate(m[0].start), '2026-09-24');
  assert.equal(m[0].hadYear, false);
});

test('YYYY/MM/DD numeric (Japan style)', () => {
  const m = parseDates('締切: 2026/05/15', opts);
  assert.equal(toISODate(m[0].start), '2026-05-15');
});

test('9時間 (duration) is not a time-of-day', () => {
  const m = parseDates('2026年5月15日から9時間のワークショップ', opts);
  assert.equal(m[0].time, undefined);
});

test('Japanese conference page end-to-end', () => {
  const blocks: TextBlock[] = [
    { text: '論文投稿締切 — 2026年5月15日（金）23時59分（日本時間）', heading: '重要な日程' },
    { text: '採否通知 — 2026年9月24日', heading: '重要な日程' },
    { text: 'カメラレディ原稿提出 — 2026年10月22日', heading: '重要な日程' },
    { text: '参加登録締切 — 2026年11月30日', heading: '重要な日程' },
    { text: '会議は2026年12月8日〜10日に開催されます。', heading: 'NLP2026' },
  ];
  const dates = detectInBlocks(blocks, { url: 'https://example.jp/nlp2026', title: 'NLP2026 大会' }, opts);
  assert.equal(dates.length, 5);
  const byCat = Object.fromEntries(dates.map((d) => [d.category, d]));
  assert.equal(byCat['submission'].startDate, '2026-05-15');
  assert.equal(byCat['notification'].startDate, '2026-09-24');
  assert.equal(byCat['camera-ready'].startDate, '2026-10-22');
  assert.equal(byCat['registration'].startDate, '2026-11-30');
  assert.equal(byCat['conference'].startDate, '2026-12-08');
  assert.equal(byCat['conference'].endDate, '2026-12-10');
});

// ---------- Spanish ----------

test('Spanish "15 de mayo de 2026"', () => {
  const m = parseDates('Fecha límite de envío: 15 de mayo de 2026 a las 23:59.', opts);
  assert.equal(m.length, 1);
  assert.equal(toISODate(m[0].start), '2026-05-15');
  assert.deepEqual(m[0].time, { h: 23, min: 59 });
});

test('Spanish weekday prefix "viernes 15 de mayo de 2026"', () => {
  const m = parseDates('El plazo termina el viernes 15 de mayo de 2026.', opts);
  assert.equal(toISODate(m[0].start), '2026-05-15');
});

test('Spanish cross-month range "del 28 de julio al 1 de agosto de 2026"', () => {
  const m = parseDates('El congreso se celebrará del 28 de julio al 1 de agosto de 2026 en Madrid.', opts);
  assert.equal(m.length, 1);
  assert.equal(toISODate(m[0].start), '2026-07-28');
  assert.equal(toISODate(m[0].end!), '2026-08-01');
});

test('Spanish in-month range "15 al 20 de mayo de 2026"', () => {
  const m = parseDates('Talleres: del 15 al 20 de mayo de 2026.', opts);
  assert.equal(toISODate(m[0].start), '2026-05-15');
  assert.equal(toISODate(m[0].end!), '2026-05-20');
});

test('Spanish abbreviated month "1 dic 2026"', () => {
  const m = parseDates('Inscripción temprana hasta el 1 dic 2026.', opts);
  assert.equal(toISODate(m[0].start), '2026-12-01');
});

test('Spanish classifier keywords', () => {
  assert.equal(classify('Fecha límite de envío de artículos').category, 'submission');
  assert.equal(classify('Notificación de aceptación').category, 'notification');
  assert.equal(classify('Versión final (camera-ready)').category, 'camera-ready');
  assert.equal(classify('Inscripción temprana').category, 'registration');
  assert.equal(classify('El congreso tendrá lugar en Madrid').category, 'conference');
  assert.equal(classify('Respuesta de los autores').category, 'rebuttal');
});

test('Japanese classifier keywords', () => {
  assert.equal(classify('論文投稿締切').category, 'submission');
  assert.equal(classify('採否通知').category, 'notification');
  assert.equal(classify('カメラレディ原稿').category, 'camera-ready');
  assert.equal(classify('参加登録締切').category, 'registration');
  assert.equal(classify('ワークショップ開催').category, 'workshop');
});

test('Spanish conference page end-to-end', () => {
  const blocks: TextBlock[] = [
    { text: 'Fecha límite de envío de artículos: 15 de mayo de 2026 (23:59, AoE)', heading: 'Fechas importantes' },
    { text: 'Notificación de aceptación: 24 de septiembre de 2026', heading: 'Fechas importantes' },
    { text: 'El congreso se celebrará del 8 al 10 de diciembre de 2026.', heading: 'SEPLN 2026' },
  ];
  const dates = detectInBlocks(blocks, { url: 'https://example.es/sepln2026', title: 'SEPLN 2026' }, opts);
  assert.equal(dates.length, 3);
  const byCat = Object.fromEntries(dates.map((d) => [d.category, d]));
  assert.equal(byCat['submission'].startDate, '2026-05-15');
  assert.equal(byCat['submission'].timezone, 'Etc/GMT+12');
  assert.equal(byCat['notification'].startDate, '2026-09-24');
  assert.equal(byCat['conference'].startDate, '2026-12-08');
  assert.equal(byCat['conference'].endDate, '2026-12-10');
});

// English still works (no regressions from the added alternations)
test('English detection unaffected', () => {
  const m = parseDates('Paper deadline: May 15, 2026, 11:59 PM AoE', opts);
  assert.equal(toISODate(m[0].start), '2026-05-15');
  assert.equal(m[0].timezone, 'Etc/GMT+12');
});
