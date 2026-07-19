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
  variance, prediction curve with 95% confidence band, accuracy heatmap,
  temperature sensitivity, wear frequency, service timeline. Charts support
  brush zooming and hover tooltips.
- **Statistics engine** (`src/lib/stats.ts`) — seconds/day normalization,
  mean/median, min/max, standard deviation, variance, consistency index,
  stability %, rolling averages, confidence intervals, drift/accuracy trend
  slopes, 7/14/30/90-day predictions, and anomaly detection (recent-vs-baseline
  z-score) that flags a watch drifting outside its normal behavior.
- **Health & grading** (`src/lib/grades.ts`) — 0–100 movement health score
  (accuracy, stability, consistency, drift, service age, wear pattern) with
  Excellent → Needs Service labels, plus COSC/Excellent/…/Critical accuracy
  grades with color-coded badges.
- **Smart insights** (`src/lib/insights.ts`) — "35% less stable this month",
  "still within COSC", "performs better dial-up than crown-down", "gains more
  at low power reserve", "worn mostly on weekends", regulation recommendations.
- **Service module** — full history (regulation, pressure tests, parts, costs),
  next-service estimation, overdue tracking.
- **Compare** — multi-watch rolling-rate and variance charts + a full metric
  matrix.
- **Reports** — weekly summary, monthly report, accuracy certificate,
  print-to-PDF, CSV / collection-CSV / JSON export.
- **Notifications** — measurement overdue, variance increase, service due,
  battery low, power reserve empty, not worn recently, trend change.
- **Local-first + optional cloud sync** — everything works offline in
  localStorage (privacy-first); configure Supabase env vars and sign in to
  mirror data to Postgres with RLS.

## Getting started

```bash
cd watchkeeper
npm install
npm run dev        # http://localhost:3000 — loads a rich demo dataset
```

The app boots with a deterministic demo collection (5 watches, ~150 days of
realistic measurements, one deliberately drifting movement) so every chart and
insight has data. Add your own watch or measurement and it becomes your data;
Settings → "Reset to demo data" restores the sample set.

## Supabase (optional cloud sync)

1. Copy `.env.example` to `.env.local` and fill in your project URL and
   publishable key (already done for the linked project).
2. Apply migrations in `supabase/migrations/` (already applied via MCP to the
   linked project):
   - `0001_watchkeeper_schema.sql` — 16 `wk_*` tables (profiles, collections,
     watches, measurements, daily offsets, weekly/monthly stats, services,
     photos, attachments, notes, notifications, AI insights, health scores,
     settings, exports), indexes, `updated_at` trigger.
   - `0002_watchkeeper_rls.sql` — RLS on every table (`user_id = auth.uid()`),
     private `wk-photos` storage bucket with per-user folder policies.
3. `supabase/seed.sql` seeds a starter watch + 14 measurements for the first
   auth user (the client demo dataset is the primary test data).

Tables are prefixed `wk_` so WatchKeeper can share a Supabase project with
other apps.

## Deploying to Vercel

```bash
vercel deploy
```

`vercel.json` sets the framework, region and security headers. Add the two
`NEXT_PUBLIC_SUPABASE_*` env vars in the Vercel dashboard to enable cloud sync.

## Architecture

```
src/
  lib/
    types.ts        domain model
    stats.ts        statistics engine (pure functions)
    grades.ts       accuracy grades + health scoring
    insights.ts     insight + notification generators
    demo-data.ts    deterministic seeded demo generator
    store.tsx       local-first store (React context + localStorage)
    supabase/       browser client + cloud-sync repository
  components/
    ui.tsx          compact shadcn-style primitives (Radix + Tailwind v4)
    charts.tsx      themed Recharts wrappers (zoom, tooltips, heatmap)
    widgets.tsx     KPI cards, health ring, grade badges
    forms.tsx       measurement / watch / service dialogs
    shell.tsx       sidebar + topbar + notifications + mobile nav
  app/              dashboard, watches, watches/[id], analytics, compare,
                    insights, services, reports, settings
supabase/           migrations + seed
```

Dark mode is default with a light theme toggle; the chart palette is
colorblind-validated for both surfaces.
