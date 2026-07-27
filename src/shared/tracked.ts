/**
 * Tracked deadlines: the small persistent list behind the countdown badge.
 * Entries are added when the user saves a deadline (Google Calendar / .ics)
 * or clicks the 🔔 track button. Stored in chrome.storage.local only.
 */
import type { Category } from './types';
import { titleSimilarity } from '../lib/dedupe';
import { zonedTimeToUtc } from '../lib/ics';
import { t, initI18n } from './i18n';
import { getSettings } from './settings';

export interface TrackedDeadline {
  id: string;
  title: string;
  conference?: string;
  category: Category;
  startDate: string; // "2026-05-15"
  time?: string;     // "23:59"
  timezone?: string; // "Etc/GMT+12"
  sourceUrl: string;
  addedAt: string;
}

const KEY = 'tracked';
const SEEN_KEY = 'seenDeadlines2'; // v2: actionable deadlines only
const KEEP_PAST_MS = 30 * 24 * 3600 * 1000; // prune 30 days after passing

/** Stable id from the identifying fields (djb2 → base36). */
export function makeId(title: string, startDate: string, conference?: string): string {
  const s = `${title.toLowerCase()}|${startDate}|${conference ?? ''}`;
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

/** The moment a deadline actually passes. AoE 23:59 is a real UTC instant. */
export function deadlineInstant(d: Pick<TrackedDeadline, 'startDate' | 'time' | 'timezone'>): Date {
  const time = d.time ?? '23:59';
  if (d.timezone) return zonedTimeToUtc(d.startDate, time, d.timezone);
  return new Date(`${d.startDate}T${time}:00`); // local wall clock
}

/** Earliest upcoming tracked deadline, or null. */
export function nextDeadline(list: TrackedDeadline[], now: Date): TrackedDeadline | null {
  let best: TrackedDeadline | null = null;
  let bestT = Infinity;
  for (const d of list) {
    const t = deadlineInstant(d).getTime();
    if (t >= now.getTime() && t < bestT) {
      best = d;
      bestT = t;
    }
  }
  return best;
}

/** Whole calendar days from today to the deadline's stated date. */
export function calendarDaysLeft(calendarDate: string, now: Date): number {
  const [y, m, d] = calendarDate.split('-').map(Number);
  const deadlineDay = new Date(y, m - 1, d).getTime();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.round((deadlineDay - today) / (24 * 3600 * 1000));
}

/**
 * Chrome's badge fits ~4 half-width characters (kanji count double). With
 * single-kanji units, "9日" (3), "12時" (4), "45分" (4) all fit — keep them.
 * Fall back to Latin units only when the text is genuinely too wide
 * (e.g. "365日" → "365d").
 */
export function fitBadge(text: string): string {
  const width = [...text].reduce((w, ch) => w + ((ch.codePointAt(0) ?? 0) > 0xff ? 2 : 1), 0);
  if (width <= 4) return text;
  return text.replace('時', 'h').replace('分', 'm').replace('日', 'd');
}

export interface Countdown {
  /** Localized, for roomy surfaces (pill, panel): "9日", "12時", "45分". */
  text: string;
  /** Always-Latin, for the width-limited toolbar badge: "9d", "12h", "45m". */
  compact: string;
  color: string;
  urgency: 'far' | 'soon' | 'now';
}

/**
 * Days are counted between CALENDAR dates (the deadline's stated date vs
 * today), the way people count: on July 12, a July 22 deadline is "10d" —
 * even though an AoE deadline technically expires July 23 11:59 UTC. Hours
 * take over on the final day, where the AoE grace time actually matters.
 */
export function formatCountdown(target: Date, now: Date, calendarDate?: string): Countdown {
  const ms = target.getTime() - now.getTime();
  const minute = 60 * 1000;
  const hour = 60 * minute;
  if (ms < 5 * minute) return { text: '⏰', compact: '⏰', color: '#dc2626', urgency: 'now' };
  if (ms < hour) {
    // Final hour: minutes, so "1h" doesn't linger while time runs out.
    const m = Math.max(1, Math.floor(ms / minute));
    return { text: `${m}${t('minUnit')}`, compact: `${m}m`, color: '#dc2626', urgency: 'now' };
  }
  if (ms < 24 * hour) {
    // Floor, never ceil: overstating remaining time is the one unforgivable
    // direction for a deadline tool (1.4h left must not read "2h").
    const h = Math.floor(ms / hour);
    return { text: `${h}${t('hourUnit')}`, compact: `${h}h`, color: '#dc2626', urgency: 'now' };
  }
  let days: number;
  if (calendarDate) {
    days = Math.max(1, calendarDaysLeft(calendarDate, now));
  } else {
    days = Math.ceil(ms / (24 * hour));
  }
  const text = `${days}${t('dayUnit')}`;
  const compact = `${days}d`;
  if (days < 3) return { text, compact, color: '#dc2626', urgency: 'now' };
  if (days <= 14) return { text, compact, color: '#e8833a', urgency: 'soon' };
  return { text, compact, color: '#16a34a', urgency: 'far' };
}

/** Drop entries long past; fold near-duplicates (same date, similar title). */
export function foldTracked(list: TrackedDeadline[], item: TrackedDeadline, now: Date): TrackedDeadline[] {
  const pruned = list.filter((d) => deadlineInstant(d).getTime() >= now.getTime() - KEEP_PAST_MS);
  const dup = pruned.find(
    (d) => d.id === item.id || (d.startDate === item.startDate && titleSimilarity(d.title, item.title) >= 0.5),
  );
  if (dup) {
    return pruned.map((d) => (d === dup ? { ...item, id: dup.id, addedAt: dup.addedAt } : d));
  }
  return [...pruned, item];
}

// ---- chrome.storage-backed helpers ----

export async function getTracked(): Promise<TrackedDeadline[]> {
  const data = await chrome.storage.local.get(KEY);
  return (data[KEY] ?? []) as TrackedDeadline[];
}

export async function addTracked(item: TrackedDeadline): Promise<void> {
  const list = await getTracked();
  await chrome.storage.local.set({ [KEY]: foldTracked(list, item, new Date()) });
}

export async function removeTracked(id: string): Promise<void> {
  const list = await getTracked();
  await chrome.storage.local.set({ [KEY]: list.filter((d) => d.id !== id) });
}

export function onTrackedChanged(cb: (list: TrackedDeadline[]) => void): void {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && (changes[KEY] || changes[SEEN_KEY])) {
      cb(((changes[KEY]?.newValue ?? []) as TrackedDeadline[]));
    }
  });
}

// ---- auto-seen pool: deadlines noticed on conference pages, no click needed ----

export async function getSeen(): Promise<TrackedDeadline[]> {
  const data = await chrome.storage.local.get(SEEN_KEY);
  return (data[SEEN_KEY] ?? []) as TrackedDeadline[];
}

function poolSignature(list: TrackedDeadline[]): string {
  return list.map((d) => `${d.id}|${d.startDate}|${d.time ?? ''}|${d.timezone ?? ''}`).sort().join(';');
}

/** Remember deadlines seen on a page (folded, pruned, capped at 100). */
export async function recordSeen(items: TrackedDeadline[]): Promise<void> {
  if (items.length === 0) return;
  const before = await getSeen();
  const now = new Date();
  let list = before;
  for (const item of items) list = foldTracked(list, item, now);
  if (list.length > 100) {
    list = list.sort((a, b) => deadlineInstant(a).getTime() - deadlineInstant(b).getTime()).slice(0, 100);
  }
  if (poolSignature(list) !== poolSignature(before)) {
    await chrome.storage.local.set({ [SEEN_KEY]: list });
  }
}

/** Drop one auto-detected deadline from the countdown pool. */
export async function removeSeen(id: string): Promise<void> {
  const list = await getSeen();
  await chrome.storage.local.set({ [SEEN_KEY]: list.filter((d) => d.id !== id) });
}

// ---- mascot reminders: the dog announces booked deadlines at N days out ----

const FIRED_KEY = 'reminderFired'; // `${id}|${startDate}|${threshold}` — date edits auto-reset

export interface DueReminder {
  deadline: TrackedDeadline;
  daysLeft: number;
  /** All thresholds this announcement satisfies (marked fired together). */
  thresholds: number[];
}

/**
 * Which booked deadlines should the mascot announce right now?
 * A deadline qualifies when its calendar-days-left has entered one of the
 * user's thresholds (e.g. 7 or 1) that hasn't been announced yet. All
 * satisfied thresholds are consumed at once, so a deadline booked 1 day out
 * gets a single "1 day left" — not a 7-day and a 1-day back to back.
 */
export function dueReminders(
  tracked: TrackedDeadline[],
  thresholds: number[],
  fired: Set<string>,
  now: Date,
): DueReminder[] {
  const out: DueReminder[] = [];
  for (const d of tracked) {
    if (deadlineInstant(d).getTime() < now.getTime()) continue;
    const daysLeft = Math.max(0, calendarDaysLeft(d.startDate, now));
    const satisfied = thresholds.filter((t) => daysLeft <= t);
    if (satisfied.length === 0) continue;
    const unfired = satisfied.filter((t) => !fired.has(`${d.id}|${d.startDate}|${t}`));
    if (unfired.length === 0) continue;
    out.push({ deadline: d, daysLeft, thresholds: satisfied });
  }
  return out.sort((a, b) => a.daysLeft - b.daysLeft);
}

export async function getFiredReminders(): Promise<Set<string>> {
  const data = await chrome.storage.local.get(FIRED_KEY);
  return new Set((data[FIRED_KEY] ?? []) as string[]);
}

export async function markReminderFired(r: DueReminder): Promise<void> {
  const fired = await getFiredReminders();
  for (const t of r.thresholds) fired.add(`${r.deadline.id}|${r.deadline.startDate}|${t}`);
  await chrome.storage.local.set({ [FIRED_KEY]: [...fired].slice(-400) });
}

const NUDGE_KEY = 'nudgeIgnores';

export async function getNudgeIgnores(): Promise<Set<string>> {
  const data = await chrome.storage.local.get(NUDGE_KEY);
  return new Set((data[NUDGE_KEY] ?? []) as string[]);
}

export async function ignoreNudge(d: Pick<TrackedDeadline, 'id' | 'startDate'>): Promise<void> {
  const set = await getNudgeIgnores();
  set.add(`${d.id}|${d.startDate}`);
  await chrome.storage.local.set({ [NUDGE_KEY]: [...set] });
}

/**
 * Safety net for the tracked-wins badge: seen-but-untracked deadlines that
 * fall BEFORE the user's nearest tracked deadline. These are surfaced as a
 * dismissible nudge in the panel so an untracked deadline can't slip by
 * silently behind a calm badge.
 */
export function earlierUntracked(
  tracked: TrackedDeadline[],
  seen: TrackedDeadline[],
  ignores: Set<string>,
  now: Date,
): TrackedDeadline[] {
  if (tracked.length === 0) return []; // badge already uses the seen pool
  const upcoming = tracked
    .map((t) => deadlineInstant(t).getTime())
    .filter((t) => t >= now.getTime());
  const nearestTracked = upcoming.length > 0 ? Math.min(...upcoming) : Infinity;
  return seen
    .filter((sd) => {
      const at = deadlineInstant(sd).getTime();
      if (at < now.getTime() || at >= nearestTracked) return false;
      if (ignores.has(`${sd.id}|${sd.startDate}`)) return false;
      const isTracked = tracked.some(
        (t) => t.id === sd.id || (t.startDate === sd.startDate && titleSimilarity(t.title, sd.title) >= 0.5),
      );
      return !isTracked;
    })
    .sort((a, b) => deadlineInstant(a).getTime() - deadlineInstant(b).getTime())
    .slice(0, 3);
}

/**
 * What the countdown badge counts down to: deadlines you explicitly tracked
 * take priority; before you've tracked anything, deadlines the extension has
 * seen on conference pages are used so the badge is useful from day one.
 */
export async function countdownPool(): Promise<{ list: TrackedDeadline[]; inferred: boolean }> {
  const tracked = await getTracked();
  if (tracked.length > 0) return { list: tracked, inferred: false };
  return { list: await getSeen(), inferred: true };
}

export interface CurrentCountdown {
  next: TrackedDeadline;
  countdown: Countdown;
  /** True when the source is the auto-seen pool, not an explicit choice. */
  inferred: boolean;
}

/** One call for badge + mascot pill: what to display right now, if anything. */
export async function currentCountdown(now: Date = new Date()): Promise<CurrentCountdown | null> {
  // The badge is rendered by the service worker, which never runs the panel's
  // init — resolve the UI language here so units localize ("9d" → "9日").
  initI18n((await getSettings()).language);
  const { list, inferred } = await countdownPool();
  const next = nextDeadline(list, now);
  if (!next) return null;
  const countdown = formatCountdown(deadlineInstant(next), now, next.startDate);
  // Inferred countdowns render neutral gray so they can't be mistaken for
  // deadlines the user explicitly tracked.
  if (inferred) countdown.color = '#6b7280';
  return { next, countdown, inferred };
}
