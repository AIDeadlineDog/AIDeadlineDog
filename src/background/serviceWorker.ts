/** MV3 service worker: countdown badge, side-panel opening. */
import type { ToBackground } from '../shared/messages';
import { ok } from '../shared/messages';
import { currentCountdown, fitBadge, onTrackedChanged } from '../shared/tracked';

/** Global badge: days until the nearest tracked deadline ("12d"). */
async function updateCountdownBadge(): Promise<void> {
  const cc = await currentCountdown();
  if (!cc) {
    chrome.action.setBadgeText({ text: '' }).catch(() => {});
    chrome.action.setTitle({ title: 'AI Deadline Dog — open panel' }).catch(() => {});
    return;
  }
  const { next, countdown: c, inferred } = cc;
  const suffix = inferred ? ' · auto-detected, not tracked' : '';
  chrome.action.setBadgeText({ text: fitBadge(c.text) }).catch(() => {});
  chrome.action.setBadgeBackgroundColor({ color: c.color }).catch(() => {});
  chrome.action.setTitle({ title: `${c.text} — ${next.title} (${next.startDate})${suffix}` }).catch(() => {});
  // Per-tab page counts (set before anything was tracked) override the
  // global badge on their tabs — stamp the countdown over all of them so
  // every tab shows the same number.
  const tabs = await chrome.tabs.query({}).catch(() => [] as chrome.tabs.Tab[]);
  for (const tab of tabs) {
    if (tab.id === undefined) continue;
    chrome.action.setBadgeText({ tabId: tab.id, text: fitBadge(c.text) }).catch(() => {});
    chrome.action.setBadgeBackgroundColor({ tabId: tab.id, color: c.color }).catch(() => {});
  }
}

// Recompute on: install/startup, any tracked change, and an hourly alarm
// (service workers sleep, so the day count must be refreshed on wake).
chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
  chrome.alarms.create('countdown-badge', { periodInMinutes: 30 });
  void updateCountdownBadge();
});
chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.create('countdown-badge', { periodInMinutes: 30 });
  void updateCountdownBadge();
});
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'countdown-badge') void updateCountdownBadge();
});
onTrackedChanged(() => void updateCountdownBadge());
// Language (and other settings) changes must redraw the badge immediately —
// otherwise "9d" lingers until the next alarm tick after switching to 日本語.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.settings) void updateCountdownBadge();
});
// Re-create on every worker wake (idempotent) so the badge keeps ticking even
// if install/startup events were missed, and recompute immediately.
chrome.alarms.create('countdown-badge', { periodInMinutes: 30 });
void updateCountdownBadge();

function setBadge(tabId: number, count: number): void {
  chrome.action.setBadgeText({ tabId, text: count > 0 ? String(count) : '' }).catch(() => {});
  chrome.action.setBadgeBackgroundColor({ tabId, color: '#e8833a' }).catch(() => {});
}

chrome.runtime.onMessage.addListener((msg: ToBackground, sender, sendResponse) => {
  switch (msg.kind) {
    case 'SCAN_COMPLETE': {
      // Page count is only a fallback while nothing is tracked; once a
      // countdown exists it owns the badge on every tab. Checked against
      // storage each time (no cached flag — the worker restarts often).
      const tabId = sender.tab?.id;
      if (tabId !== undefined) {
        void (async () => {
          const cc = await currentCountdown();
          if (cc) {
            chrome.action.setBadgeText({ tabId, text: fitBadge(cc.countdown.text) }).catch(() => {});
            chrome.action.setBadgeBackgroundColor({ tabId, color: cc.countdown.color }).catch(() => {});
          } else {
            setBadge(tabId, msg.count);
          }
        })();
      }
      sendResponse(ok(null));
      return false;
    }
    case 'GET_PINNED':
      // Whether the toolbar icon is pinned (visible). If not, the mascot
      // shows the countdown pill instead of the (hidden) badge.
      chrome.action
        .getUserSettings()
        .then((us) => sendResponse(ok(us.isOnToolbar)))
        .catch(() => sendResponse(ok(false)));
      return true;
    case 'OPEN_PANEL':
      if (sender.tab?.id !== undefined) {
        // Must be called synchronously to keep the user-gesture credit.
        chrome.sidePanel.open({ tabId: sender.tab.id }).catch(() => {
          // Some Chrome versions don't credit gestures relayed from content
          // scripts — fall back to the panel in a small popup window.
          chrome.windows
            .create({ url: chrome.runtime.getURL('panel.html'), type: 'popup', width: 420, height: 680 })
            .catch(() => {});
        });
      }
      sendResponse(ok(null));
      return false;
    default:
      return false;
  }
});
