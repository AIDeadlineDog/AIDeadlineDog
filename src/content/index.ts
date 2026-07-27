/** Content script: scans the page, serves the panel, drives the mascot. */
import { extractBlocks, extractStructuredEvents } from '../lib/extract';
import { detectInBlocks } from '../lib/detect';
import { mergeDetections } from '../lib/dedupe';
import { isImportantDate, isConferencePage, isCompleteDetection, isActionableDeadline } from '../lib/classify';
import type { DetectedDate } from '../shared/types';
import type { ToContent, DatesResponse } from '../shared/messages';
import { getSettings, onSettingsChanged } from '../shared/settings';
import { makeId, recordSeen, getTracked, getFiredReminders, markReminderFired, dueReminders } from '../shared/tracked';
import { applyHighlights, clearHighlights } from './highlight';
import { setPageDark } from './pageDark';
import { Mascot } from './mascot';

let detected: DetectedDate[] = [];
let gated = false;
const mascot = new Mascot();

function importantDetected(): DetectedDate[] {
  const today = new Date().toISOString().slice(0, 10);
  return detected.filter((d) => isImportantDate(d, today));
}

function scan(): DetectedDate[] {
  const page = { url: location.href, title: document.title };
  const blocks = extractBlocks(document);
  const fromText = detectInBlocks(blocks, page);
  const fromStructured = extractStructuredEvents(document, location.href);
  return mergeDetections([...fromStructured, ...fromText]);
}

async function runScan(force = false): Promise<void> {
  const settings = await getSettings();
  let all: DetectedDate[] = [];
  try {
    all = scan();
  } catch (e) {
    console.warn('[AI Deadline Dog] scan failed:', e);
  }
  // Precision gate: unless the user forces a scan, only surface results on
  // pages that clearly are about conference dates/deadlines, and only the
  // detections that carry complete information (label + confident date).
  if (settings.strictMode && !force) {
    if (isConferencePage(location.href, document.title, all)) {
      detected = all.filter(isCompleteDetection);
      gated = false;
    } else {
      detected = [];
      gated = all.length > 0;
    }
  } else {
    detected = all;
    gated = false;
  }
  const important = importantDetected();
  chrome.runtime.sendMessage({ kind: 'SCAN_COMPLETE', count: important.length }).catch(() => {});
  // Highlight every detected date; mascot only barks about important ones.
  // Highlight only what the panel/mascot will actually show (important,
  // upcoming deadlines) — highlighting news timestamps and past dates makes
  // the page look like the extension extracted things it didn't.
  if (settings.highlightDates && important.length > 0) applyHighlights(important);
  else clearHighlights();
  // The mascot mounts itself lazily — the dog only appears when there are deadlines.
  void mascot.setDates(important);
  // Remember labeled upcoming deadlines so the countdown badge works even
  // before the user explicitly tracks anything.
  const today = new Date().toISOString().slice(0, 10);
  void recordSeen(
    detected
      .filter((d) => isActionableDeadline(d) && d.category !== 'other' && (d.endDate ?? d.startDate) >= today)
      .map((d) => ({
        id: makeId(d.title, d.startDate, d.conference),
        title: d.title,
        conference: d.conference,
        category: d.category,
        startDate: d.startDate,
        time: d.time,
        timezone: d.timezone,
        sourceUrl: d.url,
        addedAt: new Date().toISOString(),
      })),
  );
}

chrome.runtime.onMessage.addListener((msg: ToContent, _sender, sendResponse) => {
  switch (msg.kind) {
    case 'GET_DATES': {
      const res: DatesResponse = { dates: detected, url: location.href, pageTitle: document.title, gated };
      sendResponse(res);
      return false;
    }
    case 'RESCAN':
      runScan(msg.force ?? false).then(() => {
        const res: DatesResponse = { dates: detected, url: location.href, pageTitle: document.title, gated };
        sendResponse(res);
      });
      return true;
    case 'SET_HIGHLIGHT':
      if (msg.enabled) applyHighlights(importantDetected());
      else clearHighlights();
      sendResponse(null);
      return false;
    case 'SET_PAGE_DARK':
      setPageDark(msg.enabled);
      sendResponse(null);
      return false;
    default:
      return false;
  }
});

let scanTimer: ReturnType<typeof setTimeout> | undefined;
function watchMutations(): void {
  const observer = new MutationObserver(() => {
    clearTimeout(scanTimer);
    scanTimer = setTimeout(() => runScan(), 1500);
  });
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  setTimeout(() => observer.disconnect(), 30_000);
}

/**
 * The dog reminds you about booked deadlines at the user's thresholds
 * (default 7 and 1 days). Runs on every page — researchers are always
 * online, so a page load is the delivery moment. Claim-before-show keeps
 * multiple open tabs from announcing the same reminder.
 */
async function checkReminders(): Promise<void> {
  const settings = await getSettings();
  if (!settings.mascotEnabled || settings.mascotMuted) return;
  if (settings.reminderDays.length === 0) return;
  const due = dueReminders(await getTracked(), settings.reminderDays, await getFiredReminders(), new Date());
  if (due.length === 0) return;
  const first = due[0];
  await markReminderFired(first);
  await mascot.announceReminder(first);
}

async function init(): Promise<void> {
  const settings = await getSettings();
  void checkReminders();
  if (!settings.autoScan) return;

  const origin = location.origin;
  if (settings.pageDarkSites.includes(origin)) setPageDark(true);

  await runScan();
  if (document.body) watchMutations();

  onSettingsChanged((s) => {
    if (!s.mascotEnabled) mascot.destroy();
    if (!s.highlightDates) clearHighlights();
    else if (detected.length > 0) applyHighlights(importantDetected());
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => void init());
} else {
  void init();
}
