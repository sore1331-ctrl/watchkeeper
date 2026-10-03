"use client";

// ─── Collection dashboard + watch list ──────────────────────────────────────

import React, { useMemo } from "react";
import Link from "next/link";
import { ChevronRight, Plus, Watch as WatchIcon } from "lucide-react";
import { useStore } from "@/lib/store";
import { fmtSpd } from "@/lib/stats";
import { daysSince, lastServiceDate } from "@/lib/grades";
import { fmtMoney, fmtDate, fmtTotal } from "@/lib/utils";
import { WatchDialog } from "@/components/forms";
import { GradeBadge, HealthBadge, SectionTitle, StatCard } from "@/components/widgets";
import { Button, Card, Skeleton } from "@/components/ui";

export default function WatchesPage() {
  const { ready, watches, analysisFor, servicesFor, settings, updateWatch } = useStore();
  const active = watches.filter((w) => !w.archived);
  const archived = watches.filter((w) => w.archived);

  const rows = useMemo(
    () =>
      active.map((w) => {
        const { stats, health, grade, gradeNote } = analysisFor(w.id)!;
        const services = servicesFor(w.id);
        return {
          watch: w,
          stats,
          health,
          grade,
          gradeNote,
          sinceService: daysSince(lastServiceDate(services) ?? w.purchaseDate ?? null),
        };
      }),
    [active, analysisFor, servicesFor]
  );

  const agg = useMemo(() => {
    const withStats = rows.filter((r) => r.stats.avgSpd != null);
    if (!withStats.length) return null;
    const by = (fn: (r: (typeof rows)[number]) => number, dir: 1 | -1 = 1) =>
      [...withStats].sort((a, b) => dir * (fn(a) - fn(b)))[0];
    const mostAccurate = by((r) => Math.abs(r.stats.avgSpd!));
    const leastAccurate = by((r) => Math.abs(r.stats.avgSpd!), -1);
    const mostWorn = by((r) => r.stats.wearRatio ?? 0, -1);
    const leastWorn = by((r) => r.stats.wearRatio ?? 0);
    const highVar = by((r) => r.stats.variance ?? 0, -1);
    const lowVar = by((r) => r.stats.variance ?? 0);
    const longestSinceService = by((r) => r.sinceService ?? 0, -1);
    // Only a trend that stands clear of the scatter is named — a slope fitted
    // through noisy readings is not an improvement or a decline.
    const byTrend = withStats
      .filter((r) => r.stats.accuracyTrendSignificant)
      .sort((a, b) => (a.stats.accuracyTrend ?? 0) - (b.stats.accuracyTrend ?? 0));
    const best = byTrend[0];
    const worst = byTrend[byTrend.length - 1];
    return {
      value: fmtTotal(
        active.map((w) => ({ amount: w.currentValue, currency: w.currency })),
        settings.currency
      ),
      mostAccurate, leastAccurate, mostWorn, leastWorn, highVar, lowVar,
      longestSinceService,
      improving: best && (best.stats.accuracyTrend ?? 0) < 0 ? best : undefined,
      declining: worst && (worst.stats.accuracyTrend ?? 0) > 0 ? worst : undefined,
    };
  }, [rows, active]);

  if (!ready) return <Skeleton className="h-96" />;

  const name = (r: (typeof rows)[number] | undefined) =>
    r ? `${r.watch.brand} ${r.watch.model}` : "—";

  return (
    <div className="fade-up">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Collection</h1>
        <WatchDialog trigger={<Button><Plus className="h-4 w-4" /> Add watch</Button>} />
      </div>

      {agg && (
        <p className="-mt-3 mb-4 text-sm text-muted">
          {active.length} watch{active.length === 1 ? "" : "es"} · collection value{" "}
          <span className="font-semibold text-foreground">{agg.value}</span>
        </p>
      )}

      <SectionTitle>Watches</SectionTitle>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {rows.map(({ watch: w, stats, health, grade, gradeNote }) => (
          <Link key={w.id} href={`/watches/${w.id}`}>
            <Card className="group h-full cursor-pointer p-5 transition-all hover:border-accent/40 hover:shadow-lg">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl"
                    style={{ background: `color-mix(in oklab, ${w.accentColor} 15%, transparent)`, color: w.accentColor }}>
                    <WatchIcon className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="font-semibold">{w.brand} {w.model}</p>
                    <p className="text-xs text-muted">
                      {w.reference ?? "—"} · {w.caliber ?? w.movementType}
                    </p>
                  </div>
                </div>
                <GradeBadge grade={grade} movement={w.movementType} count={stats.gradableCount} note={gradeNote} explain={false} />
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-surface-2/60 p-2">
                  <p className="text-[10px] uppercase tracking-wide text-muted">Rate</p>
                  <p className="text-sm font-bold tabular-nums">{fmtSpd(stats.avgSpd, 1)}</p>
                </div>
                <div className="rounded-lg bg-surface-2/60 p-2">
                  <p className="text-[10px] uppercase tracking-wide text-muted">σ</p>
                  <p className="text-sm font-bold tabular-nums">
                    {stats.stdDev != null ? `±${stats.stdDev.toFixed(1)}` : "—"}
                  </p>
                </div>
                <div className="rounded-lg bg-surface-2/60 p-2">
                  <p className="text-[10px] uppercase tracking-wide text-muted">Health</p>
                  <p className="text-sm font-bold tabular-nums">{health?.score ?? "—"}</p>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between text-xs text-muted">
                <span>{stats.count} measurements</span>
                <HealthBadge label={health?.label ?? null} count={stats.gradableCount} explain={false} />
              </div>
              <p className="mt-2 text-[11px] text-faint">
                Purchased {fmtDate(w.purchaseDate)} · {fmtMoney(w.currentValue, w.currency)}
              </p>
            </Card>
          </Link>
        ))}
      </div>

      {agg && (
        <details className="group mt-6">
          <summary className="inline-flex cursor-pointer list-none items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-accent hover:bg-surface-2 [&::-webkit-details-marker]:hidden">
            <ChevronRight className="h-3.5 w-3.5 transition-transform group-open:rotate-90" />
            Collection highlights
          </summary>
          <div className="mt-3">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-5 lg:gap-4">
              <StatCard label="Collection value" value={agg.value}
                className="[&>p:nth-child(2)]:text-xl" delay={0} />
              <StatCard label="Most accurate" value={name(agg.mostAccurate)}
                sub={fmtSpd(agg.mostAccurate?.stats.avgSpd)} delay={0.05} className="[&>p:nth-child(2)]:text-base" />
              <StatCard label="Least accurate" value={name(agg.leastAccurate)}
                sub={fmtSpd(agg.leastAccurate?.stats.avgSpd)} delay={0.1} className="[&>p:nth-child(2)]:text-base" />
              <StatCard label="Most worn" value={name(agg.mostWorn)}
                sub={`${Math.round((agg.mostWorn?.stats.wearRatio ?? 0) * 100)}% of the time`} delay={0.15} className="[&>p:nth-child(2)]:text-base" />
              <StatCard label="Least worn" value={name(agg.leastWorn)}
                sub={`${Math.round((agg.leastWorn?.stats.wearRatio ?? 0) * 100)}% of the time`} delay={0.2} className="[&>p:nth-child(2)]:text-base" />
              <StatCard label="Longest since service" value={name(agg.longestSinceService)}
                sub={`${agg.longestSinceService?.sinceService ?? "—"} days`} delay={0.25} className="[&>p:nth-child(2)]:text-base" />
              <StatCard label="Highest variance" value={name(agg.highVar)}
                sub={`${agg.highVar?.stats.variance?.toFixed(1)} (s/d)²`} delay={0.3} className="[&>p:nth-child(2)]:text-base" />
              <StatCard label="Lowest variance" value={name(agg.lowVar)}
                sub={`${agg.lowVar?.stats.variance?.toFixed(2)} (s/d)²`} delay={0.35} className="[&>p:nth-child(2)]:text-base" />
              <StatCard label="Largest improvement" value={name(agg.improving)}
                sub={agg.improving ? "accuracy trend ↓" : "no clear trend"} delay={0.4} className="[&>p:nth-child(2)]:text-base" />
              <StatCard label="Largest decline" value={name(agg.declining)}
                sub={agg.declining ? "accuracy trend ↑" : "no clear trend"} delay={0.45} className="[&>p:nth-child(2)]:text-base" />
            </div>
          </div>
        </details>
      )}

      {archived.length > 0 && (
        <>
          <SectionTitle>Archived</SectionTitle>
          <p className="-mt-2 mb-3 text-xs text-muted">
            Kept with all their readings, but left out of the dashboard, analytics and reminders.
          </p>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {archived.map((w) => (
              <Card key={w.id} className="flex items-center justify-between gap-3 p-4">
                <Link href={`/watches/${w.id}`} className="min-w-0 hover:text-accent">
                  <p className="truncate text-sm font-semibold">{w.brand} {w.model}</p>
                  <p className="truncate text-xs text-muted">{w.reference ?? w.caliber ?? w.movementType}</p>
                </Link>
                <Button variant="secondary" size="sm" onClick={() => updateWatch(w.id, { archived: false })}>
                  Unarchive
                </Button>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
