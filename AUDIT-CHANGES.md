# Audit changes — keep or revert

Everything changed since the code review, on branch `audit-fixes`. Nothing here
was on `main` until the merge recorded under "Decided" below.

Each row is a decision for you. The commits after the first are one topic
each, so `git revert <commit>` undoes just that row. The first commit
(`1081e51`) holds rows 1–19 together; reverting one of those on its own means
undoing it by hand — tell me which and I will do it.

"Tested" means I exercised it in the browser. "Type-checked" means it compiles
but I could not exercise it (mostly because it needs a signed-in account).

## Commit 1081e51 — crash, sync, security, backups

| # | Change | Why | Checked |
|---|--------|-----|---------|
| 1 | Insights no longer crash when 7+ readings give no usable rate interval | It took down every page | Tested |
| 2 | A device remembers which account it synced with and refuses to sync with a different one | Signing in as someone else deleted local data and uploaded the rest into the wrong account | Type-checked |
| 3 | Deletions are remembered until the cloud confirms them | A delete made offline came back at the next sync | Type-checked |
| 4 | Edits made while a sync is running survive it | The sync overwrote them with its older snapshot | Type-checked |
| 5 | Failed cloud writes show as "Sync failed" with the reason | They were silently discarded | Type-checked |
| 6 | Power reserve clamped to 0–100; a typed 0 for temperature or reserve is kept | One out-of-range value failed every later sync; 0 was saved as blank | Tested |
| 7 | Sample collection gets random ids per device and is never uploaded while it is still the sample | Fixed ids are shared primary keys across all accounts | Tested |
| 8 | Adding a measurement or service to a sample watch makes the collection yours | README said so; before, that data was dropped on sign-in | Tested |
| 9 | Record ids are random UUIDs | Ids are global primary keys and must not be guessable | Tested |
| 10 | Content-Security-Policy and Permissions-Policy, set in `next.config.ts`; header block removed from `vercel.json` | No CSP; headers only applied on Vercel | Dev server only — production build not run |
| 11 | Wishlist link only shown for http(s) addresses | Unvalidated link | Type-checked |
| 12 | CSV export prefixes formula-like text cells with an apostrophe | Spreadsheet formula injection | Type-checked |
| 13 | `seed.sql` requires `set wk.seed_email`, ids are per-user | It seeded "the first user" of a shared project | Not run |
| 14 | New passwords need 10 characters (form only) | Was 6 | Type-checked |
| 15 | Pre-sync snapshot only when a sync changes the device; storage-full is retried, then shown as a banner | Snapshots rotated out on every tab focus; save failures were silent | Type-checked |
| 16 | Backup includes the wishlist; new Restore button on the Account page (adds back, never deletes) | Backups could not be restored | Tested |
| 17 | Tabs adopt each other's saves; pending changes are written when the tab is hidden | Two tabs overwrote each other; last edit lost on quick close | Type-checked |
| 18 | Caliber patterns only match within their brand; Omega 3220 no longer METAS; Daytona 4131 = 47 jewels; Miyota 8315 = 21 jewels; Spring Drive has no beat rate and a ±1 s/day spec | An AP 3120 was graded as a Rolex; catalog facts were wrong | Type-checked |
| 19 | Dashboard marks rolling figures "as of …" when the last reading is over a week old; service cost label uses the watch's currency; migration `0004a` added to the repo (copied from the live database); migration `0007` written | Stale figures looked current; label was hardcoded €; repo could not rebuild the live schema | Tested (labels) |

## Later commits — one topic each

| # | Commit | Change | Why | Checked |
|---|--------|--------|-----|---------|
| 20 | `7d6f6d5` | One service interval for health, next-service date and reminders, editable in Settings (default 5 years, quartz 8). "Overdue" only against a real service record; a purchase-date-only watch shows "No service on record" | Health used 7 years, reminders 5; one watch was overdue and healthy at once. **This changes health scores** (service-age part now uses 5 years, not 7) | Tested |
| 21 | `304008c` | Removed Display name and Temperature unit from Settings, and the unused theme field | They were stored but never read. If you want Fahrenheit to actually work, say so — that is a feature, not a fix | Tested |
| 22 | `e6d8488` | COSC badge no longer shown when the watch is outside its own tighter spec; Reports stability score matches the health score; CSV rates match the screen | Grade and health contradicted each other | Tested (reports) |
| 23 | `50e325d` | `.env.example` is now tracked; Settings describes storage correctly when signed in | README told you to copy a file git ignored | Type-checked |
| 24 | `dd1ac27` | Wording: grade band text matches the real thresholds; "Good" no longer says a minute a month; rate-change insight reads correctly for a losing watch; variance labelled (s/d)²; reference clock described as the device clock; "Accuracy certificate" renamed "Accuracy summary"; Account page no longer claims a sample-only device matches the account | Text contradicted the code | Tested (reports) |
| 25 | `5fe509b` | Forecast range includes day-to-day scatter, shared by both pages | The band was much too narrow | Type-checked |
| 26 | `edd3e11` | Tudor "-U" calibers use METAS 0/+5; "left on winder" demo note only on automatics | Catalog fact; nonsense note on manual and quartz | Type-checked |
| 27 | `8e80f70` | README brought up to date; this file | README described an older app | — |
| 28 | `58db058` | Error boundaries: a failing page shows a message and the rest of the app keeps working; a failure in the data store shows a page with "Download my data" and "Try again" | Any exception in the store blanked every page | Type-checked — not triggered |
| 29 | `84861dc` | Trend, stability-change and "rate has shifted" insights and notifications only appear when the last reading is within 14 days; Reports say their weekly and monthly figures end at the last reading | Old readings were described as "this month" and "recent" | Tested (reports line) |
| 30 | `c5eb102` | Settings and snoozed notifications sync between devices, newest wins | They stayed on one device. **Inactive until migration `0008` is applied**; until then the step is skipped silently | Type-checked |
| 31 | `15d432d` | Rate uncertainty allows 0.5 s for the unchecked device clock as well as 0.5 s for reading the dial | It assumed a perfect reference. **This widens the stated ± error** by about 40%, and the 95% interval by less. The 0.5 s figure is an assumption | Type-checked |
| 32 | `4f655b7` | One fallback currency (GBP) in the row mappers; migration `0009` aligns the column defaults | Tables disagreed (EUR vs GBP). No visible effect — the fallback never triggers | Type-checked |

## Design review fixes — merged into `main` on 2026-10-03

| # | Commit | Change | Why | Checked |
|---|--------|--------|-----|---------|
| 33 | `66f826e` | Mobile bottom bar gets a "More" button opening Wishlist, Compare, Reports, Account and Settings; bar items are at least 44 px | Those five pages had no link at phone width | Tested |
| 34 | `de3e59e` | Grade and health badge colours, accent, status colours and faint text are theme variables meeting 4.5:1. Light theme: accent `#0f766e`, darker status inks. Dark theme: only the faint text colour changed | Light-theme badges measured 1.4–2.5:1 | Tested — badges 5.0–5.5:1, faint 5.2:1, accent 5.5:1 in light |
| 35 | `457b48f` | Dashboard, Analytics and Reports show "No watches yet" with an Add watch button | They showed a loading skeleton forever | Tested |
| 36 | `1365eab` | Archive / Unarchive button on the watch page; Archived section on the collection page | Archived watches were filtered everywhere but nothing could archive one | Tested |
| 37 | `af324b7` | Saved theme applied before first paint; Theme setting with Dark, Light, Match this device | Page always drew dark first; no system option. Default is still dark | Tested (setting and class); the absence of a flash itself was not observed |
| 38 | `eb31b5c` | Dates use the browser's locale | Hardcoded to British format | Type-checked |
| 39 | `47db2db` | App icon and web manifest; removed the five default Next.js SVGs and favicon | Leftover scaffolding, no app identity | Tested (icon and manifest are served) |

## Palette and tap-to-capture — merged into `main` on 2026-10-03

| # | Commit | Change | Why | Checked |
|---|--------|--------|-----|---------|
| 40 | `25026ed` | New colour tokens: light is paper and racing green, dark is midnight and brass. Dark warning is orange and the COSC badge is platinum, so neither is confused with the brass accent. Icon, manifest, browser theme colour and the error page follow | Chosen palettes A and C | Every text colour computed at 4.5:1 or better on both surfaces; dark tokens confirmed live |
| 41 | `efb0a4a` | Tap to capture in the new-measurement dialog: tap as the seconds hand crosses 12, 3, 6 or 9 and the offset is worked out, to a tenth of a second. Several taps are averaged; −1 / +1 minute corrects a wrong minute. Editing a reading no longer rounds its stored offset to a whole second unless a time is retyped | Typing two times was the slow, error-prone step | Tested with simulated taps: offset, averaging, minute correction and save. Not tried against a real watch |

Known trade-offs in row 40: in the light theme the accent and "positive" are
both greens. The five chart series colours are unchanged and are below 4.5:1
on the light surface (3.1–4.2:1), which is acceptable for lines but not text.

## Calculation fixes, layout and installable app — branch `calc-and-app`, not yet on `main`

Rows 42–44 share commit `62f8132`; undoing one on its own is a manual job.
**Row 42 changes the numbers every watch shows.**

| # | Commit | Change | Why | Checked |
|---|--------|--------|-----|---------|
| 42 | `62f8132` | Calculations. (a) Worn % is the share of elapsed time over every interval. (b) "Ran down" applies only to automatics, and only to intervals that also ran clearly slow. (c) Every average is seconds gained ÷ time elapsed — headline, rolling, weekly, monthly, per position. (d) The forecast uses the last 30 days of all intervals, worn and resting, with one rule for the list and the charts | (a) read 100% for a watch worn 21% of the time. (b) discarded about half the readings of resting watches. (c) three different weightings; the headline could be 1.6 s/d for a watch gaining 2.7. (d) used a worn-only rate for a watch that mostly rests | Tested against hand-worked cases and the sample data's known rates: worn % matches to the percent, average equals gain ÷ time, a genuinely stopped automatic is still excluded, a hand-wound watch never is |
| 43 | `62f8132` | Reporting. 95% interval uses Student-t. No grade ("Too fine to grade") when the average is known less precisely than the band it is judged against. Improvement / decline only named when the trend is significant. The "7 measurements" gate counts the readings actually graded. Heatmap coloured against the watch's own spec, and correct across clock changes. Power-reserve estimate shown for automatics only | Interval was far too narrow with few readings; a quartz was graded on noise; noise was named "largest improvement"; a watch in spec was painted red | Tested in the browser: quartz shows "Too fine to grade", improvement shows "no clear trend", hand-wound watch has no power-reserve card |
| 44 | `62f8132` | Dashboard leads with four figures and folds the other eight under "More figures"; collection page shows the watches first with the highlights folded away | Twelve equal cards on the dashboard, ten above the first watch | Tested |
| 45 | `cb20c7e` | Light-theme accent is navy ink (`#1f3a5f`) instead of racing green | Green accent read as "good". Brass was tried on paper and is the same dark amber as "Regulation due" | Contrast computed; not seen rendered |
| 46 | `061cf3b` | Installable app: PNG, maskable and Apple icons; a service worker caching the app's own files (build assets cache-first, pages network-first with the last copy as fallback). Production only | So it can be added to a phone's home screen and opened without a connection | Tested on a production build: worker active, pages and 28 assets cached, icons served. Not installed on a real phone; offline not simulated |

## Decided on 2026-10-03

- **Migrations `0007`, `0008`, `0009` applied** to the live database and
  verified there. Settings sync (row 30) is now active.
- **`audit-fixes` merged into `main`.** A production build was run first and
  the strict Content-Security-Policy (row 10) loaded every page checked with
  no console errors.
- **"Worn today" stays as it is** — it is a good metric as designed.
- **No Fahrenheit.** The removed setting (row 21) stays removed.
- **Unused tables left in place.** All 12 unused `wk_` tables and the
  `wk-photos` bucket are empty, so dropping them later loses nothing.

## Still open

- **Supabase dashboard (yours):** turn on leaked-password protection and
  raise the minimum password length.
- **Per-user primary keys in the database.** Not migrated; see the
  conversation for the trade-off.
- **Catalog entries I believe are wrong but did not verify:** Lange L093.1
  jewels (28, likely 21), IWC 82100 jewels (31, likely 22), Hangzhou 5000A
  beat rate (21600, likely 28800).
- **Not exercised:** anything needing a signed-in account, two-tab handling,
  the storage-full banner, the error-boundary pages, `seed.sql`.

## Known and unchanged

- `eslint` reports 18 errors, all React-compiler rules (`Date.now()` during
  render, `setState` in effects). The count is the same as before the audit:
  two old ones were removed and two of the same kind were added.
- A device that already uploaded records under the old fixed sample ids
  keeps them.
- A device that synced before row 2 adopts whichever account syncs next;
  the protection starts from that sync.
