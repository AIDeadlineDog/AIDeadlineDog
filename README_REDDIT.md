# Reddit / community post — AI Deadline Dog

Ready-to-paste posts for sharing. Fill in the two links (repo + store/site)
before posting. Suggested subreddits: r/MachineLearning (Saturday
"Show-and-Tell" / project flair), r/PhD, r/GradSchool, r/compsci,
r/chrome_extensions, plus Hacker News "Show HN".

---

## Title options

- I built a Chrome extension that reads conference pages and puts the
  deadlines in your calendar (AoE-aware, works offline, no account)
- AI Deadline Dog: never manually copy a NeurIPS/ACL/CVPR deadline into your
  calendar again
- [P] A local-only Chrome extension that turns "important dates" pages into
  calendar events with AoE handled correctly

---

## Post body

Like everyone here, I keep a mental map of half a dozen conference deadlines,
and at least once a year I've fumbled one — usually because "May 15, 11:59 PM
AoE" quietly means May 16 in my timezone, or because I copied a date from the
wrong row of a dates table at 2am.

So I built **AI Deadline Dog** 🐶 — a Chrome extension that reads the conference
page you're already on, finds every deadline, and adds them to your calendar
in two clicks.

**What it does:**

- Visit any conference site (NeurIPS, ICML, ICLR, ACL/ARR, CVPR, AAAI, COLM,
  ICSE, SIGIR, …) — a small dog pops up: "Woof! I found 12 deadlines."
- Every date is **labeled** (abstract / paper / rebuttal / notification /
  camera-ready / registration) and grouped by venue, with a confidence score.
- **AoE done right**: "11:59 PM Anywhere on Earth" becomes the actual UTC
  instant in your calendar, and the countdown switches to hours on the final
  day — so the badge tells you the truth when it matters.
- Save to **Google Calendar** (prefilled tab, no OAuth dance) or download
  **.ics** files with built-in reminders (1 day + optional 1 week) for
  Apple Calendar / Outlook / anything.
- A **toolbar badge counts down** to your next deadline ("10d" → orange →
  red), everywhere you browse.
- Reads dates in **English, Japanese (2026年5月15日), and Spanish** — UI
  localized in all three.
- Works on **OpenReview venue pages** too (it mines the embedded data, so
  the deadline you see is the one the submission form enforces).

**What it deliberately doesn't do:**

- **No accounts, no servers, no tracking.** Everything runs locally in your
  browser; the extension makes zero network requests. (The Google Calendar
  button just opens a normal calendar.google.com tab in your own session.)
- It stays **silent on search results, Gmail, and social feeds** — early
  versions happily "found" fake deadlines in Google search snippets, so
  there's a precision gate now: it only speaks up on pages that are clearly
  about deadlines, and only shows dates it's confident about.

**Honest limitations:** desktop Chrome/Edge/Brave only (Chrome mobile has no
extensions); the rare all-JavaScript page needs a moment to render before the
rescan catches it; and if a conference page is wrong, the extension will be
confidently wrong with it — you can edit everything before saving.

Tested against ~35 venues across ML/NLP/CV/IR/DB/SE (there's an offline
harness in the repo that replays real conference pages through the parser —
that's how most of the bugs were found).

**Links:**
- Source: `<REPO-URL>`
- Install / site: `<SITE-OR-STORE-URL>`

It's free and open source. Would love feedback — especially conference pages
it gets wrong: open an issue with the URL and I'll add it to the test corpus.

---

## Short version (for comment threads / X)

Built a Chrome extension for researchers: it reads any conference page,
labels the deadlines (abstract/paper/rebuttal/camera-ready), converts
"11:59 PM AoE" to your real local time, and adds them to Google Calendar or
.ics in two clicks. Toolbar badge counts down to your next deadline. 100%
local, no account, open source. `<LINK>` 🐶

---

## FAQ ammo (for the comments)

**"Why not just use aideadlin.es / ccfddl?"** Those are great curated lists —
this is complementary: it works on *any* page (workshops, journals, grant
calls, your obscure second-tier venue), needs no curation lag, and gets the
dates into your actual calendar with reminders rather than a website you have
to remember to check.

**"Does it send my browsing anywhere?"** No. There are no network calls in
the bundle — auditable in the source; the manifest has no remote hosts.

**"Manifest V3?"** Yes, MV3 throughout (side panel, service worker, alarms).

**"Firefox?"** Not yet — it's mostly a `sidePanel` → `sidebar_action` rename
away; planned if there's interest (which would also unlock Android via
Firefox).
