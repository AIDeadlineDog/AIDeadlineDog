# Permission Justifications — AI Deadline Dog

Copy-paste ready for the Developer Dashboard "Privacy practices" tab.

## Single purpose description

```
AI Deadline Dog detects dates and deadlines on the webpage the user is viewing
(for example academic conference "important dates" pages) and lets the user
add them to their calendar as prefilled Google Calendar events or downloadable
.ics files. All detection runs locally in the browser.
```

## Permission justifications

### storage

```
Stores the user's preferences, tracked deadlines, and a limited, automatically
pruned history of detected deadlines on their device. This powers settings,
the countdown badge, and the missed-deadline safety nudge. No data is
transmitted anywhere.
```

### sidePanel

```
Displays the extension's main interface: a side panel where the user reviews
detected dates, edits event details, and adds them to their calendar.
```

### scripting

```
Injects the extension's own bundled content script into the current tab when
the user opens the panel on a page that was loaded before the extension was
installed or reloaded (so the user does not have to refresh the tab). Only
the extension's packaged files are injected; no remote code.
```

### alarms

```
Refreshes the toolbar badge's countdown (days until the user's nearest saved
deadline) once per hour, since Manifest V3 service workers are suspended and
the day count would otherwise go stale. No data is transmitted.
```

### Content script on <all_urls> (host access)

```
The extension's core feature is detecting deadlines on any webpage the user
visits (conference sites use thousands of different domains, so a fixed site
list is not possible). The content script analyzes the page text entirely
locally; nothing is transmitted. A built-in precision gate keeps the extension
inactive on search engines, webmail, and social feeds, and the user can
disable automatic scanning in the options.
```

## Data usage disclosures (check-boxes on the dashboard)

Check these two data types because Google requires disclosure even when data
is processed or stored only on the user's device:

- **Web history** — the extension handles the current page URL and locally
  stores source URLs for relevant detected or tracked deadlines.
- **Website content** — the extension reads page text locally to detect dates
  and deadlines.

Leave all other data-type boxes unchecked. Then check all three certifications:

- Does not sell or transfer user data to third parties outside approved cases
- Does not use or transfer user data for purposes unrelated to the single purpose
- Does not use or transfer user data to determine creditworthiness or offer loans

## Remote code

```
No remote code. All JavaScript is bundled inside the extension package.
```
