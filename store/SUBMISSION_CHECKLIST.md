# Chrome Web Store Submission Checklist — AI Deadline Dog v1.0.2

The upload package and copy-paste materials are ready. Steps marked ⚠️ need
your account, public URLs, or real product screenshots.

## 0. What's in the `submit/` folder

| File | Use |
|---|---|
| `ai-deadline-dog-v1.0.2.zip` | The package you upload (built from `dist/`) |
| `icon128.png` | Store icon uploaded separately in the listing |
| `promo-small-440x280.png` | Required small promotional tile |
| `privacy.html` | Ready-to-host public privacy-policy page |
| `LISTING.md` | Store listing text — copy-paste per field |
| `PRIVACY_POLICY.md` | Host this somewhere public (see step 5) |
| `PERMISSIONS_JUSTIFICATION.md` | Copy-paste into the Privacy practices tab |

## 1. Developer account (one time) ⚠️

- Go to https://chrome.google.com/webstore/devconsole
- Sign in with the Google account you want to publish under
- Pay the one-time developer registration fee shown by Google

## 2. Create the item

- Developer Dashboard → **Package** → upload `ai-deadline-dog-v1.0.2.zip`
- The manifest (v1.0.2, Manifest V3, localized name/description) is accepted as-is

## 3. Store listing tab

Enter these values:

- **Name:** `AI Deadline Dog — Dates to Calendar`
- **Summary:** `Finds dates and deadlines on any webpage (great for AI conference pages) and adds them to your calendar.`
- **Category:** `Productivity → Workflow & Planning`
  (Spanish dashboard: `Productividad → Flujo de trabajo y planificación`)
- **Primary language:** `English`
- **Homepage / Official URL:** `https://aideadlinedog.github.io/AIDeadlineDog/`
- **Support URL:** `https://aideadlinedog.github.io/AIDeadlineDog/`
- **Mature content:** `No`

Paste this into **Detailed description**:

```text
AI Deadline Dog finds dates and deadlines on any webpage (great for AI conference
pages) and turns them into calendar events in two clicks.

🐶 HOW IT WORKS
• Open a page with deadlines — a small dog mascot appears when it finds them
• Click the toolbar icon (or "Show me") to review everything in the side panel
• Deadlines are labeled (abstract, paper submission, rebuttal, notification,
  camera-ready, registration, conference dates) and grouped by conference
• Edit the title, date, time, and time zone, then save:
   – Add to Google Calendar (prefilled tab — uses your normal Google session)
   – Download an .ics file for Apple Calendar, Outlook, or any calendar app
   – Optional reminders built into the .ics: 1 day and 1 week before

✅ MADE FOR DEADLINE PAGES
• Understands "Anywhere on Earth" (AoE), UTC offsets, and common time zones
• Reads tables, lists, prose, and structured data — including dates written
  in English, Japanese (2026年5月15日), and Spanish (15 de mayo de 2026)
• Only activates on pages that are clearly about dates and deadlines, so it
  stays silent on search results, mail, and social feeds ("Scan anyway"
  override available)
• Highlights detected dates on the page; dark mode included

🔒 PRIVATE BY DESIGN
• All detection runs locally in your browser — page content is never sent
  anywhere
• No account, no sign-up, no tracking, no analytics
• Uses only the permissions needed to save preferences and tracked deadlines,
  show the side panel, scan pages locally, and refresh the countdown badge

The mascot can be moved, minimized, muted, or disabled entirely.
```

Upload these graphic assets:

- **Store icon:** `icon128.png`
- **Small promotional tile:** `promo-small-440x280.png`
- **Screenshot:** `screenshot-1-aaai-deadlines-1280x800.png`
- **Marquee promotional tile:** leave blank (optional)

## 4. Screenshot ⚠️ (required, at least 1)

Recapture the real extension at 1280×800 after loading v1.0.2, so the panel
title shows `AI Deadline Dog — Dates to Calendar`. The previous screenshot was
taken before the product name was aligned and should not be uploaded.

Optional additional screenshots can follow this shot list:

Capture at **1280×800** (Chrome window sized accordingly, `Ctrl+Shift+P` →
"Capture screenshot" in DevTools works well):

1. Open https://neurips.cc/Conferences/2026/Dates with the extension loaded
2. Screenshot the page with the dog bubble visible
3. Open the side panel and screenshot the grouped deadlines
4. (Optional) the edit pane, an .ics download, dark mode

Shot list with captions is at the bottom of `LISTING.md`.

## 5. Privacy practices tab

- **Single purpose** + **permission justifications**: copy from
  `PERMISSIONS_JUSTIFICATION.md`
- **Data usage**: check **Web history** and **Website content** because Google
  requires disclosure of local processing/storage too. Leave the other data
  types unchecked and check all three policy certifications. Details are in
  `PERMISSIONS_JUSTIFICATION.md`.
- **Privacy policy URL**: use
  `https://aideadlinedog.github.io/AIDeadlineDog/privacy.html`
- **Homepage URL**: use
  `https://aideadlinedog.github.io/AIDeadlineDog/`
- ⚠️ Deploy the updated `site/privacy.html` and `site/index.html` from this
  project before submission so the live disclosures match the extension.

## 6. Distribution tab

- Visibility: **Public** (or Unlisted for a soft launch)
- Regions: all

## 7. Submit for review

- Click **Submit for review**
- Google says most reviews finish within a few days but can take a few weeks.
  As of April 2026, Google reports extended review times due to a submission
  surge. Broad host access can also increase review time. The precision gate,
  local-only processing, and justifications in this folder explain why the
  HTTP/HTTPS content script is necessary.

## Notes for the reviewer conversation (if asked)

- Why `<all_urls>`? Conference/deadline pages span thousands of domains; a
  fixed list is impossible. Analysis is 100% local; a precision gate keeps
  the extension inert on non-deadline pages; auto-scan can be disabled.
- No remote code, no external requests, no data collection (verifiable:
  the bundle contains no fetch/XHR to external hosts).

## Rebuilding the ZIP after changes

```bash
cd /path/to/Chrome-Ext/deadline-dog
npm run build
rm -f submit/ai-deadline-dog-v1.0.2.zip
cd dist && zip -r ../submit/ai-deadline-dog-v1.0.2.zip . -x '.*' && cd ..
```
