# AI Deadline Dog — Architecture

## Design goals

1. **Privacy-first**: all analysis runs locally — page content never leaves the browser.
2. **Zero-setup MVP**: useful immediately (template-URL calendar adds), upgrades gracefully
   (OAuth API adds) when the user invests setup effort.
3. **Testable core**: the detection engine is pure TypeScript with no DOM/Chrome
   dependencies, so it's covered by fast node tests.
4. **No runtime dependencies**: smaller attack surface, no supply-chain risk, trivial review.

## Data flow

```
                       ┌────────────────────────── content script (per tab) ─┐
 page DOM ──extract──► │ text blocks + JSON-LD                               │
                       │   └─► lib/detect: parseDates → classify → merge     │
                       │         └─► DetectedDate[]  (kept in tab memory)    │
                       │   highlight.ts (CSS Custom Highlights)              │
                       │   mascot.ts (shadow DOM, announcements, Q&A)        │
                       └───────────────▲─────────────────────────────────────┘
                                       │ GET_DATES / RESCAN / SET_* messages
        ┌─ side panel (panel.ts) ──────┴──────────┐
        │ group by conference, edit drafts,       │
        │ confidence badges, duplicate warnings   │
        └───────────────┬─────────────────────────┘
                        │ ADD_EVENT / CHECK_DUPLICATE / AI_EXTRACT / AUTH_*
        ┌─ service worker (background) ───────────┐
        │ calendar.ts: launchWebAuthFlow (implicit│
        │   grant) → Calendar API insert/list     │
        │ badge counts, side-panel behavior       │
        └─────────────────────────────────────────┘
```

## Module responsibilities

| Module | Responsibility | Depends on |
|---|---|---|
| `lib/dateParser` | Regex date engine: formats, ranges, times, time zones (AoE→`Etc/GMT+12`), year inference, confidence | nothing |
| `lib/classify` | Deadline categories via keyword rules; venue detection (known acronyms + generic `ACRO 20XX`) | types |
| `lib/detect` | Orchestrates parser+classifier over text blocks → `DetectedDate[]` | parser, classify, dedupe |
| `lib/extract` | DOM → text blocks (tables become "label — value" rows; dt/dd pairs; heading context) + JSON-LD Events | DOM |
| `lib/dedupe` | Fuzzy title similarity (token Jaccard + plural stemming), page-level and calendar-level duplicate checks | types |
| `content/*` | Scan lifecycle (idle + debounced mutation observer, 30 s), highlighting, mascot, per-site dark theme | lib, shared |
| `background/calendar` | OAuth implicit flow (session-only token), event insert, duplicate query, no-auth template URLs | shared |
| `panel/*` | Review/edit/add UI, grouping, confidence, dark mode | shared, lib/dedupe |

## Key decisions

- **Own date parser instead of chrono-node**: conference pages use a narrow, predictable
  set of formats; owning the parser lets us attach confidence scores, time zones like AoE,
  and range semantics precisely — and keeps the bundle dependency-free. The regex layers
  are ordered most-specific-first with overlap claiming, so "July 28 – August 1, 2026"
  never double-counts as two single dates.
- **`(?!\d)` after day numbers**: prevents "August 20" matching inside "August 2026" —
  the single most important false-positive guard (caught by tests).
- **CSS Custom Highlight API** for highlighting: zero DOM mutation, so it can never break
  React/Vue pages; degrades to no-op on old Chrome.
- **Shadow DOM mascot with `all: initial`**: page styles can't leak in, mascot styles
  can't leak out; `z-index` max keeps it above content but the panel is the primary UI.
- **Implicit-grant OAuth via `launchWebAuthFlow`** instead of manifest `oauth2` +
  `getAuthToken`: the client ID lives in user settings, so people can install from source
  without editing the manifest, and no client secret is ever needed. Access tokens live in
  `storage.session` (RAM) only.
- **Duplicate detection at two levels**: page-level merge (overlapping DOM blocks produce
  the same date twice) and calendar-level (±1 day window + title similarity ≥ 0.5, with a
  confirm dialog rather than silent skip).

## Extension points

- `lib/classify.ts` — add venues to `KNOWN_VENUES`, or new category rules.
- Site-specific parsers can be added as extra block producers in `lib/extract.ts`
  (e.g. an OpenReview API reader) without touching the engine.
- `TZ_MAP` in `lib/dateParser.ts` — more time-zone abbreviations.
