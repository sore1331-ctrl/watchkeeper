"use client";

// ─── Collection dashboard + watch list ──────────────────────────────────────

import React, { useMemo } from "react";
import Link from "next/link";
import { Plus, Watch as WatchIcon } from "lucide-react";
import { useStore } from "@/lib/store";
import { computeStats, fmtSpd } from "@/lib/stats";
import { accuracyGrade, daysSince, healthScore, lastServiceDate } from "@/lib/grades";
import { fmtMoney, fmtDate } from "@/lib/utils";
import { WatchDialog } from "@/components/forms";
import { GradeBadge, HealthBadge, SectionTitle, StatCard } from "@/components/widgets";
import { Button, Card, Skeleton } from "@/components/ui";

export default function WatchesPage() {
  const { ready, watches, measurementsFor, servicesFor } = useStore();
  const active = watches.filter((w) => !w.archived);

  const rows = useMemo(
    () =>
      active.map((w) => {
        const ms = measurementsFor(w.id);
        const stats = computeStats(ms);
        const services = servicesFor(w.id);
        const health = healthScore(w, stats, services);
        return {
          watch: w,
          stats,
          health,
          grade: accuracyGrade(stats.avgSpd, w.movementType, w.coscCertified),
          sinceService: daysSince(lastServiceDate(services) ?? w.purchaseDate ?? null),
        };
      }),
    [active, measurementsFor, servicesFor]
  );

  const agg = useMemo(() => {
    const withStats = rows.filter((r) => r.stats.avgSpd != null);
    if (!withStats.length) return null;
    const by = <T,>(fn: (r: (typeof rows)[number]) => number, dir: 1 | -1 = 1) =>
      [...withStats].sort((a, b) => dir * (fn(a) - fn(b)))[0];
    const mostAccurate = by((r) => Math.abs(r.stats.avgSpd!));
    const leastAccurate = by((r) => Math.abs(r.stats.avgSpd!), -1);
    const mostWorn = by((r) => r.stats.wearRatio ?? 0, -1);
    const leastWorn = by((r) => r.stats.wearRatio ?? 0);
    const highVar = by((r) => r.stats.variance ?? 0, -1);
    const lowVar = by((r) => r.stats.variance ?? 0);
    const longestSinceService = by((r) => r.sinceService ?? 0, -1);
    const byTrend = [...withStats].sort(
      (a, b) => (a.stats.accuracyTrend ?? 0) - (b.stats.accuracyTrend ?? 0)
    );
    return {
      value: active.reduce((a, w) => a + (w.currentValue ?? 0), 0),
      mostAccurate, leastAccurate, mostWorn, leastWorn, highVar, lowVar,
      longestSinceService,
      improving: byTrend[0],
      declining: byTrend[byTrend.length - 1],
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
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5 lg:gap-4">
          <StatCard label="Collection value" value={fmtMoney(agg.value)} delay={0} />
          <StatCard label="Most accurate" value={name(agg.mostAccurate)}
            sub={fmtSpd(agg.mostAccurate?.stats.avgSpd)} delay={0.05} className="[&>p:nth-child(2)]:text-base" />
          <StatCard label="Least accurate" value={name(agg.leastAccurate)}
            sub={fmtSpd(agg.leastAccurate?.stats.avgSpd)} delay={0.1} className="[&>p:nth-child(2)]:text-base" />
          <StatCard label="Most worn" value={name(agg.mostWorn)}
            sub={`${Math.round((agg.mostWorn?.stats.wearRatio ?? 0) * 100)}% of days`} delay={0.15} className="[&>p:nth-child(2)]:text-base" />
          <StatCard label="Least worn" value={name(agg.leastWorn)}
            sub={`${Math.round((agg.leastWorn?.stats.wearRatio ?? 0) * 100)}% of days`} delay={0.2} className="[&>p:nth-child(2)]:text-base" />
          <StatCard label="Longest since service" value={name(agg.longestSinceService)}
            sub={`${agg.longestSinceService?.sinceService ?? "—"} days`} delay={0.25} className="[&>p:nth-child(2)]:text-base" />
          <StatCard label="Highest variance" value={name(agg.highVar)}
            sub={`${agg.highVar?.stats.variance?.toFixed(1)} s²/d`} delay={0.3} className="[&>p:nth-child(2)]:text-base" />
          <StatCard label="Lowest variance" value={name(agg.lowVar)}
            sub={`${agg.lowVar?.stats.variance?.toFixed(2)} s²/d`} delay={0.35} className="[&>p:nth-child(2)]:text-base" />
          <StatCard label="Largest improvement" value={name(agg.improving)}
            sub="accuracy trend ↓" delay={0.4} className="[&>p:nth-child(2)]:text-base" />
          <StatCard label="Largest decline" value={name(agg.declining)}
            sub="accuracy trend ↑" delay={0.45} className="[&>p:nth-child(2)]:text-base" />
        </div>
      )}

      <SectionTitle>Watches</SectionTitle>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {rows.map(({ watch: w, stats, health, grade }) => (
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
                <GradeBadge grade={grade} />
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
                {health && <HealthBadge label={health.label} />}
              </div>
              <p className="mt-2 text-[11px] text-faint">
                Purchased {fmtDate(w.purchaseDate)} · {fmtMoney(w.currentValue, w.currency)}
              </p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
