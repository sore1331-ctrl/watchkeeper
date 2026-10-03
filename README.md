# WatchKeeper

A premium watch accuracy and timekeeping analytics platform for mechanical and
quartz collectors. Not just a measurement log — WatchKeeper computes rates,
variance, stability, health scores, predictions and plain-language insights so
you understand how each movement performs over time.

## Features

- **Dashboard** — today's watch, current offset, gain/loss, rolling 7/30-day
  averages, weekly/monthly variance, accuracy grade, movement health,
  battery/power-reserve, days since regulation/service, quick-add measurement.
- **Analytics** — daily deviation, offset history, weekly/monthly aggregates,
  variance, prediction curve with an approximate 95% range, accuracy heatmap,
  temperature sensitivity, wear frequency, service timeline. Charts support
  brush zooming and hover tooltips.
- **Statistics engine** (`src/lib/stats.ts`) — seconds/day normalization,
  mean/median, min/max, standard deviation, variance, consistency index,
  stability %, rolling averages, confidence intervals, drift/accuracy trend
  slopes, 7/14/30/90-day predictions, and anomaly detection (recent-vs-baseline
  z-score) that flags a watch drifting outside its normal behavior.
- **Health & grading** (`src/lib/grades.ts`) — 0–100 movement health score
  (accuracy, stability, consistency, drift, service age, wear pattern) judged
  against the movement's own rate tolerance where known. Labels are Excellent,
  Very Good, Good, Regulation due and Service due — the app names a due date
  or an out-of-spec rate, it never diagnoses a fault from rate readings. Plus
  COSC/Excellent/…/Critical accuracy grades with color-coded badges.
- **Smart insights** (`src/lib/insights.ts`) — "35% less stable this month",
  "still within COSC", "performs better dial-up than crown-down", "gains more
  at low power reserve", "worn mostly on weekends", regulation recommendations.
- **Service module** — full history (regulation, pressure tests, parts, costs),
  next-service estimation, overdue tracking.
- **Compare** — multi-watch rolling-rate and variance charts + a full metric
  matrix.
- **Reports** — weekly summary, monthly report, a printable accuracy summary
  (self-measured, not a certificate), CSV / collection-CSV / JSON export.
- **Wishlist** — watches not owned yet, moved into the collection on purchase.
- **Notifications** — measurement overdue, variance increase, service due,
  battery low, power reserve empty, not worn recently, trend change.
- **Local-first + optional cloud sync** — everything works offline in
  localStorage (privacy-first); configure Supabase env vars and sign in for
  two-way sync between devices through Postgres with RLS. The newer edit wins,
  deletions propagate, and a device will not merge with a different account
  than the one it last synced with.
- **Backup and restore** — download everything as JSON from the Account page
  and restore it there.

## Getting started

```bash
cd watchkeeper
npm install
npm run dev        # http://localhost:3000 — loads a rich demo dataset
```

The app boots with a deterministic demo collection (5 watches, ~150 days of
realistic measurements, one deliberately drifting movement) so every chart and
insight has data. Add your own watch, measurement or service record and it
becomes your data; until then the sample set is never uploaded to an account.
Settings → "Reset to demo data" restores the sample set.

## Supabase (optional cloud sync)

1. Copy `.env.example` to `.env.local` and fill in your project URL and
   publishable key (already done for the linked project).
2. Apply the migrations in `supabase/migrations/` in filename order:
   - `0001` — 16 `wk_*` tables, indexes, `updated_at` trigger. The app syncs
     `wk_watches`, `wk_measurements`, `wk_services` and `wk_wishlist`; the
     rest (profiles, stats caches, photos, notes, …) are not used yet.
   - `0002` — RLS on every table (`user_id = auth.uid()`), private `wk-photos`
     storage bucket with per-user folder policies.
   - `0003` — trigger function hardened.
   - `0004`, `0004a` — rate spec and time-correction columns; `updated_at` on
     measurements and services for sync.
   - `0005`, `0006` — wishlist; exclude-from-rate flag.
   - `0007` — keep the client's edit time so "newer edit wins" holds.
   - `0008` — a JSON column on `wk_settings` so settings and snoozed
     notifications sync.
   - `0009` — one default currency across tables.
3. `supabase/seed.sql` seeds two starter watches and 15 measurements for one
   named account: `set wk.seed_email = 'you@example.com';` first. It refuses
   to run otherwise, because the project may be shared with other apps.

Tables are prefixed `wk_` so WatchKeeper can share a Supabase project with
other apps.

## Deploying to Vercel

```bash
vercel deploy
```

`vercel.json` sets the framework and region. Security headers, including the
Content-Security-Policy, are set in `next.config.ts` so they apply on any
host. Add the two `NEXT_PUBLIC_SUPABASE_*` env vars in the Vercel dashboard to
enable cloud sync.

## Architecture

```
src/
  lib/
    types.ts        domain model
    stats.ts        statistics engine (pure functions)
    grades.ts       accuracy grades + health scoring
    analysis.ts     the one analysis every page reads (stats + grade + health)
    insights.ts     insight + notification generators
    watch-catalog.ts brand/model autocomplete and published rate tolerances
    demo-data.ts    seeded demo generator
    store.tsx       local-first store (React context + localStorage) and sync
    sync.ts         local ⇄ cloud merge rules (pure functions)
    supabase/       browser client + cloud repository
  components/
    ui.tsx          compact shadcn-style primitives (Radix + Tailwind v4)
    charts.tsx      themed Recharts wrappers (zoom, tooltips, heatmap)
    widgets.tsx     KPI cards, health ring, grade badges
    forms.tsx       measurement / watch / service dialogs
    shell.tsx       sidebar + topbar + notifications + mobile nav
  app/              dashboard, watches, watches/[id], wishlist, analytics,
                    compare, insights, services, reports, account, settings
supabase/           migrations + seed
```

Dark mode is default with a light theme toggle; the chart palette is
colorblind-validated for both surfaces.
