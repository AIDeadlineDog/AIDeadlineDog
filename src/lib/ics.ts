/**
 * ICS (RFC 5545) — download path for Google/Apple/Outlook, no login.
 */
import type { CalendarEventDraft } from '../shared/types';

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function compactDate(isoDate: string): string {
  return isoDate.replaceAll('-', '');
}

function nextDay(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

function zoneOffsetMinutes(timeZone: string, at: Date): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const p: Record<string, string> = {};
  for (const part of dtf.formatToParts(at)) p[part.type] = part.value;
  const wallAsUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second);
  return (wallAsUtc - at.getTime()) / 60_000;
}

/** Wall clock in a zone → UTC Date. */
export function zonedTimeToUtc(isoDate: string, time: string, timeZone: string): Date {
  const naive = new Date(`${isoDate}T${time}:00Z`);
  let utc = new Date(naive.getTime() - zoneOffsetMinutes(timeZone, naive) * 60_000);
  utc = new Date(naive.getTime() - zoneOffsetMinutes(timeZone, utc) * 60_000);
  return utc;
}

function toUtcStamp(isoDate: string, time: string, timeZone?: string): string {
  if (!timeZone) return `${compactDate(isoDate)}T${time.replace(':', '')}00`;
  const utc = zonedTimeToUtc(isoDate, time, timeZone);
  return (
    `${utc.getUTCFullYear()}${pad(utc.getUTCMonth() + 1)}${pad(utc.getUTCDate())}` +
    `T${pad(utc.getUTCHours())}${pad(utc.getUTCMinutes())}${pad(utc.getUTCSeconds())}Z`
  );
}

function escapeText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
}

function fold(line: string): string {
  const out: string[] = [];
  let rest = line;
  while (rest.length > 74) {
    out.push(rest.slice(0, 74));
    rest = ' ' + rest.slice(74);
  }
  out.push(rest);
  return out.join('\r\n');
}

function buildEvent(draft: CalendarEventDraft, stamp: string, index: number): string {
  const uid = `${Date.now()}-${index}-${Math.random().toString(36).slice(2)}@deadline-dog`;
  const lines: string[] = ['BEGIN:VEVENT', `UID:${uid}`, `DTSTAMP:${stamp}`];

  if (draft.time) {
    lines.push(`DTSTART:${toUtcStamp(draft.startDate, draft.time, draft.timezone)}`);
    if (draft.endDate && draft.endDate !== draft.startDate) {
      lines.push(`DTEND:${toUtcStamp(draft.endDate, draft.time, draft.timezone)}`);
    }
  } else {
    lines.push(`DTSTART;VALUE=DATE:${compactDate(draft.startDate)}`);
    lines.push(`DTEND;VALUE=DATE:${compactDate(nextDay(draft.endDate ?? draft.startDate))}`);
  }

  const description = [draft.description, `Source: ${draft.sourceUrl}`].filter(Boolean).join('\n\n');
  lines.push(fold(`SUMMARY:${escapeText(draft.title)}`));
  if (description) lines.push(fold(`DESCRIPTION:${escapeText(description)}`));
  if (draft.sourceUrl) lines.push(fold(`URL:${escapeText(draft.sourceUrl)}`));

  // Always a 1-day reminder; optional 1-week reminder.
  lines.push(
    'BEGIN:VALARM',
    'TRIGGER:-P1D',
    'ACTION:DISPLAY',
    fold(`DESCRIPTION:${escapeText(`Reminder: ${draft.title}`)}`),
    'END:VALARM',
  );
  if (draft.weekReminder) {
    lines.push(
      'BEGIN:VALARM',
      'TRIGGER:-P7D',
      'ACTION:DISPLAY',
      fold(`DESCRIPTION:${escapeText(`Reminder: ${draft.title}`)}`),
      'END:VALARM',
    );
  }

  lines.push('END:VEVENT');
  return lines.join('\r\n');
}

export function buildIcs(drafts: CalendarEventDraft[]): string {
  const now = new Date();
  const stamp =
    `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}` +
    `T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//AI Deadline Dog//Dates to Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    ...drafts.map((d, i) => buildEvent(d, stamp, i)),
    'END:VCALENDAR',
    '',
  ].join('\r\n');
}

export function icsFileName(drafts: CalendarEventDraft[], prefix = ''): string {
  const base =
    drafts.length === 1
      ? drafts[0].title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'deadline'
      : `${drafts.length}-deadlines`;
  return `${prefix ? `${prefix}-` : ''}${base}.ics`;
}
