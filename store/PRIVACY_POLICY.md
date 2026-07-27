# Privacy Policy — AI Deadline Dog

_Last updated: 2026-07-23_

AI Deadline Dog ("the extension") finds dates and deadlines on webpages you visit
and helps you add them to your calendar.

## Data collection

**The extension does not transmit, store remotely, sell, or share any data.**
It processes website content and relevant page addresses only on your device
to provide its deadline-detection features.

- All webpage analysis (date detection, classification) runs **locally in your
  browser**. Page content never leaves your device.
- The extension makes **no network requests** to any server operated by us or
  by third parties. It has no analytics, no telemetry, and no error reporting.
- No account or sign-up exists.

## Data stored locally

The following is stored only in your browser's extension storage
(`chrome.storage.local`) and never transmitted:

- Your preferences (language, dark mode, highlight/mascot toggles, mascot
  position, per-site dark-theme choices).
- Deadlines you choose to track and a limited, automatically pruned history of
  deadlines detected on relevant pages (event title, date/time, time zone, and
  source page address). This powers the countdown badge and missed-deadline
  safety nudge.

Uninstalling the extension deletes this data.

## Calendar integration

- **Google Calendar**: clicking "Add to Google Calendar" opens a standard
  `calendar.google.com` tab prefilled with the event you reviewed. This is a
  normal page navigation in your own browser session; the extension has no
  access to your Google account, calendar, or credentials.
- **.ics download**: calendar files are generated locally and saved by your
  browser's regular download mechanism.

## Permissions

| Permission | Purpose |
|---|---|
| `storage` | Save preferences, tracked deadlines, and the limited detected-deadline history on your device |
| `sidePanel` | Show the review panel UI |
| `scripting` | Inject the packaged scanner into an already-open page when needed |
| Content script on HTTP/HTTPS pages | Detect deadlines locally on websites; automatic scanning can be disabled |
| `alarms` | Refresh the countdown badge hourly while the Manifest V3 worker sleeps |

## Changes

If this policy ever changes (for example, if a future version adds an optional
online feature), the change will be described in the extension's changelog and
this document before release.

## Limited use

AI Deadline Dog's use of information received from Chrome APIs adheres to the
Chrome Web Store User Data Policy, including the Limited Use requirements.

## Contact

Questions: use the support contact shown on the extension's Chrome Web Store
listing or visit https://aideadlinedog.github.io/AIDeadlineDog/.
