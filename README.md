# <img src="icons/icon128.png" alt="AI Deadline Dog logo" width="52" align="center"> Deadline Dog — Dates to Calendar

[![Website](https://img.shields.io/badge/website-live-2ea44f)](https://aideadlinedog.github.io/AIDeadlineDog/)
![Project status](https://img.shields.io/badge/status-active-2ea44f)
[![Chrome Web Store](https://img.shields.io/badge/Chrome_Web_Store-Install_Now-f59e0b?logo=googlechrome&logoColor=white)](https://chromewebstore.google.com/detail/deadline-dog-%E2%80%94-dates-to-c/ipllicdjdefjbiejcoaejcjimaknlael)
![Version](https://img.shields.io/badge/version-1.0.2-2563eb)
![Manifest](https://img.shields.io/badge/manifest-V3-4285f4)
[![License](https://img.shields.io/badge/license-MIT-7c3aed)](LICENSE)

A Chrome extension that finds dates and deadlines on any webpage (great for AI
conference pages) and adds them to your calendar. A small dog mascot appears
when it sniffs out deadlines — and a toolbar badge counts down to your next one.

**100% local. No sign-up, no account, no network requests.** Page analysis
never leaves your browser.

## Why

Conference deadlines live on dozens of differently-formatted websites — tables
on `neurips.cc`, prose CFPs, Jekyll tables on ARR, React apps like OpenReview —
usually in "Anywhere on Earth" time. Copying them into a calendar by hand is
error-prone exactly where errors hurt most. Deadline Dog reads the page you're
already looking at and turns its deadlines into calendar events in two clicks.

## Features

### Detection
- **Self-contained parsing engine** (no runtime dependencies): US / European /
  ISO dates, ranges ("July 28 – August 1, 2026", "Dec 8th through Dec 10th"),
  abbreviated years ("May 04 '26"), times, and time zones — including
  **AoE (Anywhere on Earth)**, resolved to the true UTC instant.
- **Three languages**: English, Japanese (2026年5月15日・午後3時・日本時間), and
  Spanish (del 28 de julio al 1 de agosto de 2026).
- **Conference-aware**: labels every date (abstract, paper submission,
  rebuttal, notification, camera-ready, registration, conference dates) and
  groups by venue (~90 known acronyms + generic "ACRO 2026" detection).
- **Structured sources**: JSON-LD events, table headers (multi-date rows like
  ARR's cycle table), `<meta>` descriptions on SPA sites, and inline-script
  payloads — **OpenReview venue pages work before React even renders**.
- **Precision gate**: stays silent on search engines, webmail, and social
  feeds, and on pages that aren't clearly about deadlines ("Scan anyway"
  override in the panel). News-feed timestamps ("Nov 7: Deadline extended")
  are never mistaken for the deadline itself.

### Calendar
- **Google Calendar**: one click opens a prefilled event tab — uses your
  normal browser session, zero OAuth setup.
- **.ics download**: one combined file or one per event — works with Apple
  Calendar, Outlook, Thunderbird, anything. Reminders are baked in
  (1 day before + optional "⏰ 1 week before" per deadline).
- Full editing before saving: title, dates, time, time zone, notes; source
  URL embedded in every event.

### Countdown
- **Toolbar badge** shows days to your nearest deadline ("10d") — counted in
  calendar days the way humans count, switching to hours on the final day
  (where AoE grace time matters). Green → orange → red as it approaches.
- **Booked vs auto-detected**: deadlines you saved or 🔔-tracked show in
  color; before you've booked anything, the nearest deadline *seen* on
  conference pages shows in gray ("auto-detected" in the tooltip).
- **Safety nudge**: if a seen-but-unbooked deadline falls before your next
  booked one, the panel warns you (⚠️ with one-click track/dismiss).
- If the toolbar icon isn't pinned, the dog wears the countdown pill instead.

### Interface
- Side panel for review, with confidence scores ("unsure · 55%") and an
  "only important deadlines" filter (hides past dates and "X opens" rows).
- On-page highlighting (CSS Custom Highlight API — never mutates the page).
- Dark mode for the UI + optional per-site dark theme for pages.
- The mascot appears **only when deadlines are found**; it can be dragged,
  minimized, muted, or disabled. UI localized in English / 日本語 / Español.

## Install

**Chrome Web Store:** coming soon (submission kit in [`store/`](store/)).

**From source:**

Download or clone the repository, then run:

```bash
npm install
npm run build        # bundles to dist/
```

Then open `chrome://extensions`, enable **Developer mode**, click
**Load unpacked**, and select the `dist/` folder. Visit a conference page
(e.g. a NeurIPS/ICML "Dates" page) and listen for the woof.

## Verified on

NeurIPS · ICML · ICLR · CVPR · AAAI · ACL · ARR · EMNLP · EACL · NAACL ·
COLM · IJCAI · KDD · CIKM · SIGIR · RecSys · TheWebConf · VLDB ·
ICDE · ICSE · FSE · ASE · ISSTA (researchr.org) · MLSys · AISTATS · UAI ·
LREC · INTERSPEECH · ICASSP · ICDAR · NLP (言語処理学会) · JSAI (人工知能学会) ·
OpenReview venue pages — plus generic news / grant / product pages for
false-positive checks.

Pages that render *everything* with JavaScript and embed nothing in the HTML
(rare) are picked up by the automatic rescan after the page renders.

## Permissions & privacy

| Permission | Why |
|---|---|
| `storage` | Preferences and tracked deadlines, on your device |
| `sidePanel` | The review panel UI |
| `scripting` | Injecting the packaged scanner into an already-open page when needed |
| `alarms` | Refreshing the countdown badge (MV3 workers sleep) |
| Content script on `http(s)` | Detecting deadlines on any site — analysis is 100% local; a precision gate keeps it inert on non-deadline pages, and auto-scan can be disabled |

No analytics, no tracking, no external requests of any kind. Full policy:
[`site/privacy.html`](site/privacy.html).

## Development

```bash
npm test             # 83 unit tests: parser, classifier, gate, ICS, countdown
npm run typecheck    # strict TypeScript
npm run build        # production bundle → dist/
npm run watch        # rebuild on change
```

Test the detection pipeline against any saved page without loading the
extension:

```bash
curl -sL "https://iclr.cc/Conferences/2026/Dates" -o /tmp/page.html
npx esbuild tools/run-page.ts --bundle --platform=node --packages=external \
  --format=esm --outfile=.test-dist/run-page.mjs
node .test-dist/run-page.mjs /tmp/page.html "https://iclr.cc/Conferences/2026/Dates"
```

## Project layout

```
src/lib/        pure detection engine (parser, classifier, gate, dedupe, ICS) — unit tested
src/content/    page scanning, highlighting, mascot, page dark mode
src/background/ service worker: countdown badge, side panel
src/panel/      side panel UI (review / edit / save / tracked deadlines)
src/options/    settings page
site/           landing page + privacy policy (GitHub Pages ready)
store/          Chrome Web Store submission kit (zip, listing, justifications)
docs/           architecture notes
```

Design details in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## License

MIT — see [`LICENSE`](LICENSE).
