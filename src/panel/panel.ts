/**
 * Side panel: review and edit detected dates, then add them to Google
 * Calendar via prefilled calendar.google.com tabs — uses the browser's
 * normal Google session, no sign-in or OAuth setup needed.
 */
import type { DetectedDate, UserSettings, CalendarEventDraft } from '../shared/types';
import { CATEGORY_LABELS } from '../shared/types';
import type { DatesResponse } from '../shared/messages';
import { getSettings, updateSettings } from '../shared/settings';
import { initI18n, t } from '../shared/i18n';
import { buildTemplateUrl } from '../lib/calendarUrl';
import { buildIcs, icsFileName } from '../lib/ics';
import { isImportantDate } from '../lib/classify';
import {
  makeId, getTracked, addTracked, removeTracked, onTrackedChanged,
  deadlineInstant, formatCountdown, getSeen, getNudgeIgnores, ignoreNudge,
  earlierUntracked, currentCountdown, removeSeen, type TrackedDeadline,
} from '../shared/tracked';

let settings: UserSettings;
let dates: DetectedDate[] = [];
let activeTabId: number | undefined;
let importantOnly = true;
let trackedIds = new Set<string>();

const $ = <T extends HTMLElement>(sel: string) => document.querySelector(sel) as T;
const list = $('#list');
const status = $('#status');

function setStatus(text: string, kind: 'info' | 'error' | 'success' = 'info'): void {
  status.textContent = text;
  status.className = kind === 'info' ? '' : kind;
}

async function sendToTab<T>(msg: unknown): Promise<T> {
  if (activeTabId === undefined) throw new Error('No active tab.');
  return chrome.tabs.sendMessage(activeTabId, msg);
}

const NAMED_THEMES = ['darker', 'dracula', 'github-dark', 'tokyo-night'];

function applyTheme(): void {
  if (NAMED_THEMES.includes(settings.darkMode)) {
    document.documentElement.dataset.theme = settings.darkMode;
    return;
  }
  const dark =
    settings.darkMode === 'dark' ||
    (settings.darkMode === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
}

function draftFrom(card: HTMLElement, d: DetectedDate): CalendarEventDraft {
  const val = (sel: string) => (card.querySelector(sel) as HTMLInputElement).value;
  return {
    title: val('.ev-title') || d.title,
    description: (card.querySelector('.ev-desc') as HTMLTextAreaElement).value,
    startDate: val('.ev-start') || d.startDate,
    endDate: val('.ev-end') || undefined,
    time: val('.ev-time') || undefined,
    timezone: val('.ev-tz') || undefined,
    weekReminder: (card.querySelector('.ev-weekrem') as HTMLInputElement).checked,
    sourceUrl: d.url,
  };
}

function visibleDates(): DetectedDate[] {
  if (!importantOnly) return dates;
  const today = new Date().toISOString().slice(0, 10);
  return dates.filter((d) => isImportantDate(d, today));
}

function updateStatusCounts(): void {
  const visible = visibleDates().length;
  if (dates.length === 0) setStatus('');
  else if (importantOnly && visible < dates.length) {
    setStatus(t('foundImportant', { n: visible, hidden: dates.length - visible }));
  } else {
    setStatus(t('foundOnPage', { n: dates.length }));
  }
}

function render(): void {
  list.innerHTML = '';
  const shown = visibleDates();
  if (shown.length === 0) {
    const msg = dates.length > 0 ? t('emptyNoImportant', { n: dates.length }) : t('emptyNoDates');
    const hint = dates.length > 0 ? '' : `<p>${t('emptyHint')}</p>`;
    list.innerHTML = `<div class="empty"><div class="dog"><img src="icons/icon128.png" alt="" width="56" height="56" /><span>💤</span></div><p>${msg}</p>${hint}</div>`;
    $('#btn-add').setAttribute('disabled', '');
    ($('#btn-ics') as HTMLButtonElement).disabled = true;
    ($('#btn-ics-sep') as HTMLButtonElement).disabled = true;
    return;
  }

  // Group by conference, ungrouped last.
  const groups = new Map<string, DetectedDate[]>();
  for (const d of shown) {
    const key = d.conference ?? 'Other dates on this page';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(d);
  }

  const tpl = document.getElementById('tpl-event') as HTMLTemplateElement;
  for (const [group, items] of groups) {
    const h = document.createElement('h2');
    h.className = 'group-title';
    h.textContent = group;
    list.appendChild(h);

    for (const d of items) {
      const card = (tpl.content.cloneNode(true) as DocumentFragment).firstElementChild as HTMLElement;
      card.dataset.id = d.id;
      (card.querySelector('.ev-select') as HTMLInputElement).checked = true;

      const cat = card.querySelector('.ev-cat') as HTMLElement;
      cat.textContent = CATEGORY_LABELS[d.category];
      cat.dataset.cat = d.category;

      const conf = card.querySelector('.ev-conf') as HTMLElement;
      const pct = Math.round(d.confidence * 100);
      conf.textContent = d.confidence < 0.7 ? `unsure · ${pct}%` : `${pct}%`;
      if (d.confidence < 0.7) conf.classList.add('low');

      (card.querySelector('.ev-title') as HTMLInputElement).value = d.title;
      (card.querySelector('.ev-when') as HTMLElement).textContent =
        `📅 ${d.startDate}${d.endDate ? ` → ${d.endDate}` : ''}${d.time ? ` · ${d.time}` : ''}${d.timezoneLabel ? ` ${d.timezoneLabel}` : d.timezone ? ` (${d.timezone})` : ''}`;
      (card.querySelector('.ev-context') as HTMLElement).textContent = d.context;
      (card.querySelector('.ev-start') as HTMLInputElement).value = d.startDate;
      (card.querySelector('.ev-end') as HTMLInputElement).value = d.endDate ?? '';
      (card.querySelector('.ev-time') as HTMLInputElement).value = d.time ?? '';
      (card.querySelector('.ev-tz') as HTMLSelectElement).value = d.timezone ?? '';
      (card.querySelector('.ev-desc') as HTMLTextAreaElement).value = d.context;
      (card.querySelector('.ev-open') as HTMLElement).textContent = t('openInGcal');
      (card.querySelector('.ev-weekrem') as HTMLInputElement).checked = true;
      (card.querySelector('.ev-week-text') as HTMLElement).textContent = t('weekReminder');

      const expandBtn = card.querySelector('.ev-expand') as HTMLButtonElement;
      const editPane = card.querySelector('.ev-edit') as HTMLElement;
      expandBtn.addEventListener('click', () => {
        const open = editPane.hidden;
        editPane.hidden = !open;
        expandBtn.setAttribute('aria-expanded', String(open));
      });

      (card.querySelector('.ev-open') as HTMLButtonElement).addEventListener('click', () => {
        chrome.tabs.create({ url: buildTemplateUrl(draftFrom(card, d)) });
      });

      const trackBtn = card.querySelector('.ev-track') as HTMLButtonElement;
      const refreshTrackBtn = () => {
        const id = makeId((card.querySelector('.ev-title') as HTMLInputElement).value || d.title,
          (card.querySelector('.ev-start') as HTMLInputElement).value || d.startDate, d.conference);
        trackBtn.classList.toggle('on', trackedIds.has(id));
      };
      refreshTrackBtn();
      trackBtn.title = t('trackTip');
      trackBtn.addEventListener('click', async () => {
        const entry = trackedFrom(card, d);
        if (trackedIds.has(entry.id)) await removeTracked(entry.id);
        else await addTracked(entry);
      });
      card.addEventListener('dd-tracked-refresh' as any, refreshTrackBtn);

      (card.querySelector('.ev-select') as HTMLInputElement).addEventListener('change', updateAddButton);
      list.appendChild(card);
    }
  }
  updateAddButton();
}

function trackedFrom(card: HTMLElement, d: DetectedDate): TrackedDeadline {
  const draft = draftFrom(card, d);
  return {
    id: makeId(draft.title, draft.startDate, d.conference),
    title: draft.title,
    conference: d.conference,
    category: d.category,
    startDate: draft.startDate,
    time: draft.time,
    timezone: draft.timezone,
    sourceUrl: draft.sourceUrl,
    addedAt: new Date().toISOString(),
  };
}

/** Saving a deadline (Google tab or .ics) also tracks it for the countdown. */
async function trackSaved(items: Array<{ card: HTMLElement; date: DetectedDate }>): Promise<void> {
  for (const { card, date } of items) await addTracked(trackedFrom(card, date));
}

async function renderTracked(): Promise<void> {
  const listEl = $('#tracked-list');
  const sec = $('#tracked-sec') as HTMLElement;
  const now = new Date();
  const tracked = await getTracked();
  const items = tracked
    .map((d) => ({ d, at: deadlineInstant(d).getTime() }))
    .filter(({ at }) => at >= now.getTime())
    .sort((a, b) => a.at - b.at);
  trackedIds = new Set(tracked.map((x) => x.id));
  listEl.innerHTML = '';

  // Safety net: seen-but-untracked deadlines due BEFORE the nearest tracked
  // one — otherwise a calm badge could hide a sooner deadline.
  const nudges = earlierUntracked(tracked, await getSeen(), await getNudgeIgnores(), now);
  sec.hidden = items.length === 0 && nudges.length === 0;

  // Transparency: when the badge shows an AUTO-DETECTED countdown (nothing
  // booked yet), show exactly which deadline it is — bookable or removable.
  if (items.length === 0 && nudges.length === 0) {
    const cc = await currentCountdown(now);
    if (cc?.inferred) {
      sec.hidden = false;
      const row = document.createElement('div');
      row.className = 'tr-row';
      const count = document.createElement('span');
      count.className = 'tr-count';
      count.textContent = cc.countdown.text;
      count.style.background = cc.countdown.color;
      const title = document.createElement('span');
      title.className = 'tr-title';
      title.textContent = `${t('autoNext')} ${cc.next.title}`;
      title.title = cc.next.sourceUrl;
      const when = document.createElement('span');
      when.className = 'tr-date';
      when.textContent = cc.next.startDate;
      const track = document.createElement('button');
      track.className = 'tr-track';
      track.textContent = '🔔';
      track.title = t('trackTip');
      track.addEventListener('click', () => void addTracked(cc.next));
      const rm = document.createElement('button');
      rm.className = 'tr-remove';
      rm.textContent = '🚫';
      rm.title = t('removeAuto');
      rm.addEventListener('click', () => void removeSeen(cc.next.id));
      row.append(count, title, when, track, rm);
      listEl.appendChild(row);
    }
  }
  for (const d of nudges) {
    const c = formatCountdown(deadlineInstant(d), now, d.startDate);
    const row = document.createElement('div');
    row.className = 'tr-row tr-nudge';
    const warn = document.createElement('span');
    warn.className = 'tr-count';
    warn.style.background = '#b45309';
    warn.textContent = `⚠ ${c.text}`;
    const title = document.createElement('span');
    title.className = 'tr-title';
    title.textContent = `${t('nudgeSeen')} ${d.title}`;
    title.title = d.sourceUrl;
    const when = document.createElement('span');
    when.className = 'tr-date';
    when.textContent = d.startDate;
    const track = document.createElement('button');
    track.className = 'tr-track';
    track.textContent = '🔔';
    track.title = t('trackTip');
    track.addEventListener('click', () => void addTracked(d));
    const rm = document.createElement('button');
    rm.className = 'tr-remove';
    rm.textContent = '✕';
    rm.title = t('dismiss');
    rm.addEventListener('click', async () => {
      await ignoreNudge(d);
      void renderTracked();
    });
    row.append(warn, title, when, track, rm);
    listEl.appendChild(row);
  }
  for (const { d } of items) {
    const c = formatCountdown(deadlineInstant(d), now, d.startDate);
    const row = document.createElement('div');
    row.className = 'tr-row';
    const count = document.createElement('span');
    count.className = 'tr-count';
    count.textContent = c.text;
    count.style.background = c.color;
    const title = document.createElement('span');
    title.className = 'tr-title';
    title.textContent = d.title;
    title.title = d.sourceUrl;
    const when = document.createElement('span');
    when.className = 'tr-date';
    when.textContent = d.startDate;
    const rm = document.createElement('button');
    rm.className = 'tr-remove';
    rm.textContent = '✕';
    rm.title = t('untrackTip');
    rm.addEventListener('click', () => void removeTracked(d.id));
    row.append(count, title, when, rm);
    listEl.appendChild(row);
  }
  list.querySelectorAll('.event').forEach((card) => card.dispatchEvent(new Event('dd-tracked-refresh')));
}

function selectedCards(): Array<{ card: HTMLElement; date: DetectedDate }> {
  return [...list.querySelectorAll<HTMLElement>('.event')]
    .filter((c) => (c.querySelector('.ev-select') as HTMLInputElement).checked)
    .map((card) => ({ card, date: dates.find((d) => d.id === card.dataset.id)! }));
}

function updateAddButton(): void {
  const n = selectedCards().length;
  const btn = $('#btn-add') as HTMLButtonElement;
  btn.disabled = n === 0;
  btn.textContent = n > 0 ? t('addN', { n }) : t('addSelected');
  ($('#btn-ics') as HTMLButtonElement).disabled = n === 0;
  ($('#btn-ics-sep') as HTMLButtonElement).disabled = n === 0;
}

function saveFile(content: string, name: string): void {
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

/** One combined .ics with all selected events (Apple/Outlook/any calendar). */
function downloadIcs(): void {
  const selected = selectedCards();
  const drafts = selected.map(({ card, date }) => draftFrom(card, date));
  if (drafts.length === 0) return;
  saveFile(buildIcs(drafts), icsFileName(drafts));
  void trackSaved(selected);
  setStatus(t('icsDone', { n: drafts.length }), 'success');
}

/** One .ics per event, for calendars that import only the first VEVENT. */
function downloadSeparateIcs(): void {
  const selected = selectedCards();
  void trackSaved(selected);
  const drafts = selected.map(({ card, date }) => draftFrom(card, date));
  drafts.forEach((draft, i) => {
    setTimeout(() => saveFile(buildIcs([draft]), icsFileName([draft], String(i + 1))), i * 250);
  });
  if (drafts.length > 0) setStatus(t('icsDone', { n: drafts.length }), 'success');
}

function setAllSelected(checked: boolean): void {
  list.querySelectorAll<HTMLInputElement>('.ev-select').forEach((c) => (c.checked = checked));
  updateAddButton();
}

/** Open one prefilled Google Calendar tab per selected event. */
function addSelected(): void {
  const selected = selectedCards();
  if (selected.length === 0) return;
  setStatus(t('templateOpening'));
  void trackSaved(selected);
  for (const { card, date } of selected) {
    chrome.tabs.create({ url: buildTemplateUrl(draftFrom(card, date)), active: selected.length === 1 });
    (card.querySelector('.ev-select') as HTMLInputElement).checked = false;
  }
  updateAddButton();
  setStatus(t('templateDone'), 'success');
}

/** Active tab of the current window — or of the last normal window when the
 *  panel itself runs in a popup window (fallback for older Chrome). */
async function getPageTab(): Promise<chrome.tabs.Tab | undefined> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.url && /^https?:/.test(tab.url)) return tab;
  const win = await chrome.windows.getLastFocused({ windowTypes: ['normal'] }).catch(() => undefined);
  if (win?.id === undefined) return tab;
  const [pageTab] = await chrome.tabs.query({ active: true, windowId: win.id });
  return pageTab ?? tab;
}

async function injectContentScript(tabId: number): Promise<void> {
  await chrome.scripting.insertCSS({ target: { tabId }, files: ['content.css'] }).catch(() => {});
  await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
}

async function loadDates(rescan = false): Promise<void> {
  const tab = await getPageTab();
  activeTabId = tab?.id;
  // Without "tabs" permission tab.url is often hidden — don't block on it.
  if (activeTabId === undefined) {
    setStatus(t('openRegular'), 'error');
    dates = [];
    render();
    return;
  }
  try {
    const res = await sendToTab<DatesResponse>({ kind: rescan ? 'RESCAN' : 'GET_DATES' });
    applyResponse(res);
  } catch {
    try {
      await injectContentScript(activeTabId);
      const res = await sendToTab<DatesResponse>({ kind: 'RESCAN' });
      applyResponse(res);
    } catch {
      const nonWeb = tab?.url && !/^https?:/.test(tab.url);
      setStatus(t(nonWeb ? 'openRegular' : 'notScanned'), 'error');
      dates = [];
    }
  }
  render();
}

function applyResponse(res: DatesResponse): void {
  dates = res.dates;
  const gatedEmpty = !!res.gated && dates.length === 0;
  ($('#gated-row') as HTMLElement).hidden = !gatedEmpty;
  if (gatedEmpty) setStatus(t('gatedMsg'));
  else updateStatusCounts();
}

/** User override: scan this page even though it doesn't look conference-like. */
async function scanAnyway(): Promise<void> {
  try {
    const res = await sendToTab<DatesResponse>({ kind: 'RESCAN', force: true });
    ($('#gated-row') as HTMLElement).hidden = true;
    dates = res.dates;
    updateStatusCounts();
    render();
  } catch {
    setStatus(t('notScanned'), 'error');
  }
}

function localizeStatic(): void {
  $('#lbl-important').textContent = t('importantToggle');
  $('#lbl-highlight').textContent = t('highlightToggle');
  $('#lbl-pagedark').textContent = t('pageDarkToggle');
  $('#select-all').textContent = t('selectAll');
  $('#clear-all').textContent = t('clearAll');
  $('#btn-scan-anyway').textContent = t('scanAnyway');
  $('#btn-ics').textContent = t('downloadIcs');
  $('#btn-ics-sep').textContent = t('downloadSeparate');
  $('#btn-rescan').title = t('rescanTitle');
  $('#btn-theme').title = t('themeTitle');
  $('#btn-options').title = t('optionsTitle');
}

async function init(): Promise<void> {
  settings = await getSettings();
  initI18n(settings.language);
  localizeStatic();
  applyTheme();
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);

  ($('#chk-highlight') as HTMLInputElement).checked = settings.highlightDates;
  $('#chk-important').addEventListener('change', (e) => {
    importantOnly = (e.target as HTMLInputElement).checked;
    updateStatusCounts();
    render();
  });
  $('#chk-highlight').addEventListener('change', async (e) => {
    const enabled = (e.target as HTMLInputElement).checked;
    settings = await updateSettings({ highlightDates: enabled });
    sendToTab({ kind: 'SET_HIGHLIGHT', enabled }).catch(() => {});
  });

  $('#chk-pagedark').addEventListener('change', async (e) => {
    const enabled = (e.target as HTMLInputElement).checked;
    const tab = await getPageTab();
    const origin = tab?.url ? new URL(tab.url).origin : null;
    if (origin) {
      const sites = new Set(settings.pageDarkSites);
      if (enabled) sites.add(origin);
      else sites.delete(origin);
      settings = await updateSettings({ pageDarkSites: [...sites] });
    }
    sendToTab({ kind: 'SET_PAGE_DARK', enabled }).catch(() => {});
  });

  $('#btn-theme').addEventListener('click', async () => {
    // Light ↔ your theme: from any dark-family theme (incl. Dracula etc.)
    // the moon switches to light and REMEMBERS the theme; pressing again
    // returns to it — named themes are never silently lost.
    const current = document.documentElement.dataset.theme;
    if (current === 'light') {
      settings = await updateSettings({ darkMode: settings.lastDarkTheme });
    } else {
      settings = await updateSettings({
        lastDarkTheme: current as UserSettings['lastDarkTheme'],
        darkMode: 'light',
      });
    }
    applyTheme();
  });
  $('#btn-options').addEventListener('click', () => chrome.runtime.openOptionsPage());
  $('#btn-rescan').addEventListener('click', () => loadDates(true));
  $('#btn-scan-anyway').addEventListener('click', scanAnyway);
  $('#btn-add').addEventListener('click', addSelected);
  $('#btn-ics').addEventListener('click', downloadIcs);
  $('#btn-ics-sep').addEventListener('click', downloadSeparateIcs);
  $('#tracked-title').textContent = t('trackedTitle');
  onTrackedChanged(() => void renderTracked());
  void renderTracked();
  $('#select-all').addEventListener('click', () => setAllSelected(true));
  $('#clear-all').addEventListener('click', () => setAllSelected(false));

  const tab = await getPageTab();
  if (tab?.url) {
    ($('#chk-pagedark') as HTMLInputElement).checked = settings.pageDarkSites.includes(new URL(tab.url).origin);
  }

  await loadDates();
}

void init();
