/** Typed message contracts between content script, panel, and background. */
import type { DetectedDate } from './types';

// panel/background → content script
export type ToContent =
  | { kind: 'GET_DATES' }
  | { kind: 'RESCAN'; force?: boolean }
  | { kind: 'SET_HIGHLIGHT'; enabled: boolean }
  | { kind: 'SET_PAGE_DARK'; enabled: boolean };

// content → background
export type ToBackground =
  | { kind: 'SCAN_COMPLETE'; count: number }
  | { kind: 'OPEN_PANEL' }
  | { kind: 'GET_PINNED' };

export interface DatesResponse {
  dates: DetectedDate[];
  url: string;
  pageTitle: string;
  /** True when detections were suppressed by the conference-page gate. */
  gated?: boolean;
}

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

export const ok = <T>(value: T): Result<T> => ({ ok: true, value });
export const err = <T = never>(error: string): Result<T> => ({ ok: false, error });
