/**
 * Prefilled Google Calendar "create event" URL — works with the user's normal
 * browser session, no OAuth or extension permissions needed.
 */
import type { CalendarEventDraft } from '../shared/types';

/** Next calendar day, for all-day event exclusive end dates. */
function nextDay(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export function buildTemplateUrl(draft: CalendarEventDraft): string {
  const compact = (d: string) => d.replaceAll('-', '');
  let dates: string;
  if (draft.time) {
    const t = draft.time.replace(':', '') + '00';
    const endDate = draft.endDate ?? draft.startDate;
    dates = `${compact(draft.startDate)}T${t}/${compact(endDate)}T${t}`;
  } else {
    dates = `${compact(draft.startDate)}/${compact(nextDay(draft.endDate ?? draft.startDate))}`;
  }
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: draft.title,
    dates,
    details: [draft.description, `Source: ${draft.sourceUrl}`].filter(Boolean).join('\n\n'),
  });
  if (draft.time && draft.timezone) params.set('ctz', draft.timezone);
  return `https://calendar.google.com/calendar/render?${params}`;
}
