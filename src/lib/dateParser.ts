/**
 * Self-contained date detection engine. Pure functions, no DOM, no deps —
 * runs entirely locally and is unit-tested against real conference text.
 */

export interface PlainDate {
  y: number;
  m: number; // 1-12
  d: number; // 1-31
}

export interface DateMatch {
  index: number;
  length: number;
  text: string;
  start: PlainDate;
  end?: PlainDate;
  time?: { h: number; min: number };
  timezone?: string;      // IANA
  timezoneLabel?: string; // raw, e.g. "AoE"
  confidence: number;     // 0..1
  hadYear: boolean;
}

export interface ParseOptions {
  /** Interpretation of ambiguous 05/06/2026. Default "MDY". */
  numericDateOrder?: 'MDY' | 'DMY';
  /** "Today" for inferring missing years. Defaults to real now. */
  referenceDate?: Date;
}

const MONTHS: Record<string, number> = {
  january: 1, jan: 1, february: 2, feb: 2, march: 3, mar: 3, april: 4, apr: 4,
  may: 5, june: 6, jun: 6, july: 7, jul: 7, august: 8, aug: 8,
  september: 9, sep: 9, sept: 9, october: 10, oct: 10,
  november: 11, nov: 11, december: 12, dec: 12,
  // Spanish
  enero: 1, ene: 1, febrero: 2, marzo: 3, abril: 4, abr: 4, mayo: 5,
  junio: 6, julio: 7, agosto: 8, ago: 8, septiembre: 9, setiembre: 9,
  octubre: 10, noviembre: 11, diciembre: 12, dic: 12,
};

const MONTH_RE = '(?:January|February|March|April|May|June|July|August|September|October|November|December|Enero|Febrero|Marzo|Abril|Mayo|Junio|Julio|Agosto|Septiembre|Setiembre|Octubre|Noviembre|Diciembre|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sept|Sep|Oct|Nov|Dec|Ene|Abr|Ago|Dic)\\.?';
const DOW_RE = '(?:(?:(?:Mon|Tues?|Wed(?:nes)?|Thu(?:rs?)?|Fri|Sat(?:ur)?|Sun)(?:day)?|lunes|martes|mi[e\u00e9]rcoles|jueves|viernes|s[a\u00e1]bado|domingo),?\\s+)?';
// The trailing (?!\d) stops "August 20" matching inside "August 2026".
const D_RE = '([0-3]?\\d)(?:st|nd|rd|th)?(?!\\d)';
// Accepts full years and abbreviated "'26" style years (common on
// conference sites, e.g. NeurIPS "May 04 '26").
const Y_RE = "((?:19|20)\\d{2}|['’]\\d{2})";

function toYear(s: string): number {
  const t = s.replace(/['’]/g, '');
  const n = parseInt(t, 10);
  return t.length === 2 ? 2000 + n : n;
}
const DASH = '\\s*(?:[\\u2010-\\u2015\\u2212-]|to|through|until|till|al|hasta(?:\\s+el)?)\\s*';

/** Time zone label → IANA zone. AoE (Anywhere on Earth) is UTC-12. */
const TZ_MAP: Record<string, string> = {
  'aoe': 'Etc/GMT+12', 'anywhere on earth': 'Etc/GMT+12', 'utc-12': 'Etc/GMT+12',
  'utc': 'UTC', 'gmt': 'UTC',
  'et': 'America/New_York', 'est': 'America/New_York', 'edt': 'America/New_York',
  'ct': 'America/Chicago', 'cst': 'America/Chicago', 'cdt': 'America/Chicago',
  'mt': 'America/Denver', 'mst': 'America/Denver', 'mdt': 'America/Denver',
  'pt': 'America/Los_Angeles', 'pst': 'America/Los_Angeles', 'pdt': 'America/Los_Angeles',
  'cet': 'Europe/Paris', 'cest': 'Europe/Paris',
  'bst': 'Europe/London', 'ist': 'Asia/Kolkata', 'jst': 'Asia/Tokyo',
  'kst': 'Asia/Seoul', 'aest': 'Australia/Sydney', 'aedt': 'Australia/Sydney',
};

const TZ_RE = /\b(AoE|Anywhere on Earth|UTC[+-]\d{1,2}(?::\d{2})?|GMT[+-]\d{1,2}|UTC|GMT|EST|EDT|CST|CDT|MST|MDT|PST|PDT|CET|CEST|BST|IST|JST|KST|AEST|AEDT|ET|CT|MT|PT)\b/i;
const TIME_RE = /\b([01]?\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?\s*(am|pm|a\.m\.|p\.m\.)?|\b(1[0-2]|0?[1-9])\s*(am|pm|a\.m\.|p\.m\.)\b/i;
// 午後11時59分 / 23時59分 / 正午 — (?!間) avoids 「9時間」(duration) false hits
const JP_TIME_RE = /(午前|午後)?\s*([0-2]?\d)時(?!間)(?:\s*([0-5]?\d)分)?|正午/;

function monthNum(name: string): number {
  return MONTHS[name.toLowerCase().replace(/\.$/, '')] ?? 0;
}

function daysInMonth(y: number, m: number): number {
  return new Date(y, m, 0).getDate();
}

function validDate(y: number, m: number, d: number): boolean {
  return m >= 1 && m <= 12 && d >= 1 && d <= daysInMonth(y, m);
}

/** Infer a year for a year-less date: this year, or next if >2 months past. */
function inferYear(m: number, d: number, ref: Date): number {
  const y = ref.getFullYear();
  const candidate = new Date(y, m - 1, d);
  const twoMonthsAgo = new Date(ref.getTime() - 61 * 86400_000);
  return candidate < twoMonthsAgo ? y + 1 : y;
}

export function tzFromLabel(label: string): string | undefined {
  const key = label.toLowerCase().trim();
  if (TZ_MAP[key]) return TZ_MAP[key];
  // UTC±N / GMT±N → Etc/GMT∓N (Etc zones have inverted signs)
  const m = key.match(/^(?:utc|gmt)([+-])(\d{1,2})(?::\d{2})?$/);
  if (m) {
    const n = parseInt(m[2], 10);
    if (n === 0) return 'UTC';
    if (n <= 14) return `Etc/GMT${m[1] === '+' ? '-' : '+'}${n}`;
  }
  return undefined;
}

interface PatternDef {
  re: RegExp;
  handle: (m: RegExpExecArray, opts: Required<ParseOptions>) => Omit<DateMatch, 'index' | 'length' | 'text' | 'time' | 'timezone' | 'timezoneLabel'> | null;
}

// Ordered longest/most-specific first; earlier claims win on overlap.
const PATTERNS: PatternDef[] = [
  // "July 28, 2026 – August 1, 2026" | "July 28 – August 1, 2026" |
  // "Tue Dec 8th through Thu Dec 10th" (year inferred)
  {
    re: new RegExp(`${DOW_RE}(${MONTH_RE})\\s+${D_RE}(?:,?\\s*${Y_RE})?${DASH}${DOW_RE}(${MONTH_RE})\\s+${D_RE}(?:,?\\s*${Y_RE})?`, 'gi'),
    handle(m, opts) {
      const [, m1, d1, y1, m2, d2, y2] = m;
      const mm1 = monthNum(m1), mm2 = monthNum(m2);
      const dd1 = parseInt(d1, 10), dd2 = parseInt(d2, 10);
      const wraps = mm1 > mm2 || (mm1 === mm2 && dd1 > dd2);
      const yEnd = y2
        ? toYear(y2)
        : y1
          ? toYear(y1) + (wraps ? 1 : 0)
          : inferYear(mm1, dd1, opts.referenceDate) + (wraps ? 1 : 0);
      const yStart = y1 ? toYear(y1) : (wraps ? yEnd - 1 : yEnd);
      const start = { y: yStart, m: mm1, d: dd1 };
      const end = { y: yEnd, m: mm2, d: dd2 };
      if (!validDate(start.y, start.m, start.d) || !validDate(end.y, end.m, end.d)) return null;
      const hadYear = !!(y1 || y2);
      return { start, end, confidence: hadYear ? 0.95 : 0.7, hadYear };
    },
  },
  // Spanish cross-month range: "del 28 de julio al 1 de agosto de 2026"
  {
    re: new RegExp(`\\b${D_RE}\\s+de\\s+(${MONTH_RE})(?:\\s+de\\s+${Y_RE})?${DASH}${D_RE}\\s+de\\s+(${MONTH_RE})(?:\\s+de\\s+${Y_RE})?`, 'gi'),
    handle(m, opts) {
      const [, d1, m1, y1, d2, m2, y2] = m;
      const mm1 = monthNum(m1), mm2 = monthNum(m2);
      const dd1 = parseInt(d1, 10), dd2 = parseInt(d2, 10);
      const wraps = mm1 > mm2 || (mm1 === mm2 && dd1 > dd2);
      const yEnd = y2 ? toYear(y2) : y1 ? toYear(y1) + (wraps ? 1 : 0) : inferYear(mm1, dd1, opts.referenceDate) + (wraps ? 1 : 0);
      const yStart = y1 ? toYear(y1) : (wraps ? yEnd - 1 : yEnd);
      const start = { y: yStart, m: mm1, d: dd1 };
      const end = { y: yEnd, m: mm2, d: dd2 };
      if (!validDate(start.y, start.m, start.d) || !validDate(end.y, end.m, end.d)) return null;
      const hadYear = !!(y1 || y2);
      return { start, end, confidence: hadYear ? 0.95 : 0.7, hadYear };
    },
  },
  // Japanese range: "2026年12月6日〜12日" | "12月6日から12月12日まで"
  {
    re: /(?:(\d{4})年)?\s*(\d{1,2})月\s*(\d{1,2})日(?:[（(][月火水木金土日][)）])?\s*(?:[〜～‐-―−-]|から)\s*(?:(\d{4})年)?\s*(?:(\d{1,2})月)?\s*(\d{1,2})日(?:[（(][月火水木金土日][)）])?(?:まで)?/g,
    handle(m, opts) {
      const [, y1, mo1, d1, y2, mo2, d2] = m;
      const mm1 = parseInt(mo1, 10);
      const mm2 = mo2 ? parseInt(mo2, 10) : mm1;
      const dd1 = parseInt(d1, 10), dd2 = parseInt(d2, 10);
      const wraps = mm1 > mm2 || (mm1 === mm2 && dd1 > dd2);
      const yEnd = y2 ? toYear(y2) : y1 ? toYear(y1) + (wraps ? 1 : 0) : inferYear(mm1, dd1, opts.referenceDate) + (wraps ? 1 : 0);
      const yStart = y1 ? toYear(y1) : (wraps ? yEnd - 1 : yEnd);
      const start = { y: yStart, m: mm1, d: dd1 };
      const end = { y: yEnd, m: mm2, d: dd2 };
      if (!validDate(start.y, start.m, start.d) || !validDate(end.y, end.m, end.d)) return null;
      const hadYear = !!(y1 || y2);
      return { start, end, confidence: hadYear ? 0.95 : 0.7, hadYear };
    },
  },
  // Japanese single date: "2026年5月15日（金）" | "5月15日"
  {
    re: /(?:(\d{4})年)?\s*(\d{1,2})月\s*(\d{1,2})日(?:[（(][月火水木金土日][)）])?/g,
    handle(m, opts) {
      const [, y, mo, d] = m;
      const mm = parseInt(mo, 10);
      const dd = parseInt(d, 10);
      const yy = y ? toYear(y) : inferYear(mm, dd, opts.referenceDate);
      if (!validDate(yy, mm, dd)) return null;
      return { start: { y: yy, m: mm, d: dd }, confidence: y ? 0.95 : 0.7, hadYear: !!y };
    },
  },
  // "May 15–20, 2026" | "May 15 - 20" | "Tue Jul 7th through Thu the 9th"
  {
    re: new RegExp(`${DOW_RE}(${MONTH_RE})\\s+${D_RE}${DASH}${DOW_RE}(?:the\\s+)?${D_RE}(?:,?\\s*${Y_RE})?`, 'gi'),
    handle(m, opts) {
      const [, mon, d1, d2, y] = m;
      const mm = monthNum(mon);
      const dd1 = parseInt(d1, 10), dd2 = parseInt(d2, 10);
      if (dd2 <= dd1) return null;
      const yy = y ? toYear(y) : inferYear(mm, dd1, opts.referenceDate);
      if (!validDate(yy, mm, dd1) || !validDate(yy, mm, dd2)) return null;
      return { start: { y: yy, m: mm, d: dd1 }, end: { y: yy, m: mm, d: dd2 }, confidence: y ? 0.95 : 0.7, hadYear: !!y };
    },
  },
  // "15–19 May 2026" (European in-month range)
  {
    re: new RegExp(`\\b${D_RE}${DASH}${D_RE}\\s+(?:de\\s+)?(${MONTH_RE})(?:,?\\s*(?:de\\s+)?${Y_RE})?`, 'gi'),
    handle(m, opts) {
      const [, d1, d2, mon, y] = m;
      const mm = monthNum(mon);
      const dd1 = parseInt(d1, 10), dd2 = parseInt(d2, 10);
      if (dd2 <= dd1) return null;
      const yy = y ? toYear(y) : inferYear(mm, dd1, opts.referenceDate);
      if (!validDate(yy, mm, dd1) || !validDate(yy, mm, dd2)) return null;
      return { start: { y: yy, m: mm, d: dd1 }, end: { y: yy, m: mm, d: dd2 }, confidence: y ? 0.95 : 0.7, hadYear: !!y };
    },
  },
  // "Friday, May 15, 2026" | "May 15, 2026" | "May 15" | "Sept. 3rd, 2026"
  {
    re: new RegExp(`${DOW_RE}(${MONTH_RE})\\s+${D_RE}(?:,?\\s*${Y_RE})?`, 'gi'),
    handle(m, opts) {
      const [, mon, d, y] = m;
      const mm = monthNum(mon);
      const dd = parseInt(d, 10);
      const yy = y ? toYear(y) : inferYear(mm, dd, opts.referenceDate);
      if (!validDate(yy, mm, dd)) return null;
      return { start: { y: yy, m: mm, d: dd }, confidence: y ? 0.95 : 0.7, hadYear: !!y };
    },
  },
  // "15 May 2026" | "15th of May, 2026" | "15 May"
  {
    re: new RegExp(`${DOW_RE}\\b${D_RE}\\s+(?:of\\s+|de\\s+)?(${MONTH_RE})(?:,?\\s*(?:de\\s+)?${Y_RE})?`, 'gi'),
    handle(m, opts) {
      const [, d, mon, y] = m;
      const mm = monthNum(mon);
      const dd = parseInt(d, 10);
      const yy = y ? toYear(y) : inferYear(mm, dd, opts.referenceDate);
      if (!validDate(yy, mm, dd)) return null;
      return { start: { y: yy, m: mm, d: dd }, confidence: y ? 0.9 : 0.65, hadYear: !!y };
    },
  },
  // ISO "2026-05-15" (optionally with T time, which the time pass picks up)
  {
    re: /\b(20\d{2})-(0[1-9]|1[0-2])-([0-2]\d|3[01])\b/g,
    handle(m) {
      const start = { y: parseInt(m[1], 10), m: parseInt(m[2], 10), d: parseInt(m[3], 10) };
      if (!validDate(start.y, start.m, start.d)) return null;
      return { start, confidence: 0.9, hadYear: true };
    },
  },
  // "2026/05/15" (Y/M/D — common in Japan; unambiguous)
  {
    re: /\b(20\d{2})[/.]([01]?\d)[/.]([0-3]?\d)\b/g,
    handle(m) {
      const start = { y: parseInt(m[1], 10), m: parseInt(m[2], 10), d: parseInt(m[3], 10) };
      if (!validDate(start.y, start.m, start.d)) return null;
      return { start, confidence: 0.85, hadYear: true };
    },
  },
  // Numeric "05/15/2026" or "15/05/2026" or "15.05.2026" — ambiguous
  {
    re: /\b([0-3]?\d)[/.]([0-3]?\d)[/.]((?:19|20)\d{2})\b/g,
    handle(m, opts) {
      const a = parseInt(m[1], 10), b = parseInt(m[2], 10), y = parseInt(m[3], 10);
      let mm: number, dd: number;
      if (a > 12 && b <= 12) { dd = a; mm = b; }        // unambiguous DMY
      else if (b > 12 && a <= 12) { mm = a; dd = b; }   // unambiguous MDY
      else if (opts.numericDateOrder === 'DMY') { dd = a; mm = b; }
      else { mm = a; dd = b; }
      if (!validDate(y, mm, dd)) return null;
      const ambiguous = a <= 12 && b <= 12 && a !== b;
      return { start: { y, m: mm, d: dd }, confidence: ambiguous ? 0.55 : 0.8, hadYear: true };
    },
  },
];

/** Find a time + time zone near a date match (looks after, then before). */
function findTimeAndZone(text: string, matchIndex: number, matchLen: number): Pick<DateMatch, 'time' | 'timezone' | 'timezoneLabel'> {
  const after = text.slice(matchIndex + matchLen, matchIndex + matchLen + 60);
  const before = text.slice(Math.max(0, matchIndex - 40), matchIndex);
  const out: Pick<DateMatch, 'time' | 'timezone' | 'timezoneLabel'> = {};

  for (const zone of [after, before]) {
    // Stop at sentence boundary so we don't steal the next sentence's time.
    const scope = zone === after ? zone.split(/[.;\n](?=\s|$)|。/)[0] ?? zone : zone;
    if (!out.time) {
      const t = TIME_RE.exec(scope);
      if (t) {
        let h: number, min: number;
        if (t[4] !== undefined) { h = parseInt(t[4], 10); min = 0; }
        else { h = parseInt(t[1], 10); min = parseInt(t[2], 10); }
        const ampm = (t[3] || t[5] || '').toLowerCase().replace(/\./g, '');
        if (ampm === 'pm' && h < 12) h += 12;
        if (ampm === 'am' && h === 12) h = 0;
        out.time = { h, min };
      }
    }
    if (!out.time) {
      const jt = JP_TIME_RE.exec(scope);
      if (jt) {
        if (jt[0] === '正午') {
          out.time = { h: 12, min: 0 };
        } else {
          let h = parseInt(jt[2], 10);
          const min = jt[3] ? parseInt(jt[3], 10) : 0;
          if (jt[1] === '午後' && h < 12) h += 12;
          if (jt[1] === '午前' && h === 12) h = 0;
          if (h <= 24) out.time = { h: h === 24 ? 0 : h, min };
        }
      }
    }
    if (!out.timezoneLabel) {
      const z = TZ_RE.exec(scope);
      if (z) {
        out.timezoneLabel = z[1];
        out.timezone = tzFromLabel(z[1]);
      } else if (/日本時間/.test(scope)) {
        out.timezoneLabel = '日本時間';
        out.timezone = 'Asia/Tokyo';
      }
    }
    if (out.time && out.timezoneLabel) break;
  }
  return out;
}

/** Detect all dates in a piece of text. Overlaps resolved most-specific-first. */
export function parseDates(text: string, options: ParseOptions = {}): DateMatch[] {
  const opts: Required<ParseOptions> = {
    numericDateOrder: options.numericDateOrder ?? 'MDY',
    referenceDate: options.referenceDate ?? new Date(),
  };
  const matches: DateMatch[] = [];
  const claimed: Array<[number, number]> = [];

  const overlaps = (i: number, len: number) =>
    claimed.some(([s, e]) => i < e && i + len > s);

  for (const { re, handle } of PATTERNS) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      if (m[0].trim().length === 0) { re.lastIndex++; continue; }
      if (overlaps(m.index, m[0].length)) continue;
      const parsed = handle(m, opts);
      if (!parsed) continue;
      claimed.push([m.index, m.index + m[0].length]);
      matches.push({
        index: m.index,
        length: m[0].length,
        text: m[0].trim(),
        ...findTimeAndZone(text, m.index, m[0].length),
        ...parsed,
      });
    }
  }
  return matches.sort((a, b) => a.index - b.index);
}

export function toISODate(d: PlainDate): string {
  return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
}

export function toISOTime(t: { h: number; min: number }): string {
  return `${String(t.h).padStart(2, '0')}:${String(t.min).padStart(2, '0')}`;
}
