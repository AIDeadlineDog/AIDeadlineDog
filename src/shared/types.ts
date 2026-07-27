/** Category of a detected date, used for labeling and grouping. */
export type Category =
  | 'abstract'
  | 'submission'
  | 'supplementary'
  | 'rebuttal'
  | 'review'
  | 'notification'
  | 'camera-ready'
  | 'registration'
  | 'workshop'
  | 'conference'
  | 'other';

export type Source = 'regex' | 'structured';

/** Calendar-agnostic representation of a date found on a page. */
export interface DetectedDate {
  id: string;
  /** Human label, e.g. "Paper submission deadline". */
  title: string;
  category: Category;
  /** Conference / event grouping key, e.g. "NeurIPS 2026". */
  conference?: string;
  /** ISO local date "2026-05-15". */
  startDate: string;
  /** Inclusive end date for ranges. */
  endDate?: string;
  /** "23:59" if a time-of-day was found. */
  time?: string;
  /** IANA time zone, e.g. "Etc/GMT+12" for AoE. */
  timezone?: string;
  /** Raw label as it appeared, e.g. "AoE". */
  timezoneLabel?: string;
  /** The exact text that matched on the page. */
  rawText: string;
  /** Surrounding context (sentence / table row / list item). */
  context: string;
  /** Page the date was found on. */
  url: string;
  pageTitle?: string;
  /** 0..1 — how sure the detector is. */
  confidence: number;
  source: Source;
}

export interface UserSettings {
  darkMode: 'system' | 'light' | 'dark' | 'darker' | 'dracula' | 'github-dark' | 'tokyo-night';
  /** Which dark-family theme the 🌙 toggle returns to from light. */
  lastDarkTheme: 'dark' | 'darker' | 'dracula' | 'github-dark' | 'tokyo-night';
  highlightDates: boolean;
  autoScan: boolean;
  /** Only activate on conference/deadline-looking pages (precision mode). */
  strictMode: boolean;
  mascotEnabled: boolean;
  mascotMuted: boolean;
  /** Days before a booked deadline when the mascot reminds you (e.g. [7, 1]). */
  reminderDays: number[];
  /** Show the "Ask" question box in the mascot bubble. */
  mascotAskEnabled: boolean;
  mascotPos?: { x: number; y: number };
  /** Origins where page dark theme is enabled. */
  pageDarkSites: string[];
  /** UI language: auto-detect from browser, or fixed. */
  language: 'auto' | 'en' | 'ja' | 'es';
  /** "MDY" (US) or "DMY" (rest of world) for ambiguous 05/06/2026. */
  numericDateOrder: 'MDY' | 'DMY';
}

export const DEFAULT_SETTINGS: UserSettings = {
  darkMode: 'system',
  lastDarkTheme: 'dark',
  highlightDates: true,
  autoScan: true,
  strictMode: true,
  mascotEnabled: true,
  mascotMuted: false,
  reminderDays: [7, 1],
  mascotAskEnabled: false,
  pageDarkSites: [],
  language: 'auto',
  numericDateOrder: 'MDY',
};

export const CATEGORY_LABELS: Record<Category, string> = {
  'abstract': 'Abstract deadline',
  'submission': 'Paper submission',
  'supplementary': 'Supplementary deadline',
  'rebuttal': 'Author response / rebuttal',
  'review': 'Reviews released',
  'notification': 'Notification',
  'camera-ready': 'Camera-ready deadline',
  'registration': 'Registration',
  'workshop': 'Workshop',
  'conference': 'Conference dates',
  'other': 'Date',
};

/** Event payload sent to the Google Calendar API / template URL. */
export interface CalendarEventDraft {
  title: string;
  description: string;
  startDate: string;      // "2026-05-15"
  endDate?: string;       // inclusive
  time?: string;          // "23:59" → timed event, else all-day
  timezone?: string;
  /** Adds a "1 week before" alarm to the ICS file. */
  weekReminder?: boolean;
  sourceUrl: string;
}
