"use client";

// ─── Compare watches ────────────────────────────────────────────────────────

import React, { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { computeStats, fmtSpd, isoWeekKey, rollingAverage } from "@/lib/stats";
import { accuracyGrade, healthScore } from "@/lib/grades";
import { CompareChart, type SeriesPoint } from "@/components/charts";
import { ChartCard, GradeBadge, HealthBadge } from "@/components/widgets";
import { Card, Skeleton } from "@/components/ui";
import { cn, fmtMoney } from "@/lib/utils";

export default function ComparePage() {
  const { ready, watches, measurementsFor, servicesFor } = useStore();
  const active = watches.filter((w) => !w.archived);
  const [selected, setSelected] = useState<string[]>([]);
  const ids = selected.length >= 2 ? selected : active.slice(0, 3).map((w) => w.id);

  const rows = useMemo(
    () =>
      active
        .filter((w) => ids.includes(w.id))
        .map((w) => {
          const ms = measurementsFor(w.id);
          const stats = computeStats(ms);
          return {
            watch: w, stats,
            health: healthScore(w, stats, servicesFor(w.id)),
            grade: accuracyGrade(stats.avgSpd, w.movementType, w.coscCertified),
            services: servicesFor(w.id),
          };
        }),
    [active, ids, measurementsFor, servicesFor]
  );

  // merge rolling-7 series onto a shared weekly time axis
  const chart = useMemo(() => {
    const byDate = new Map<string, SeriesPoint>();
    for (const r of rows) {
      const rolling = rollingAverage(r.stats.samples, 7);
      for (let i = 0; i < r.stats.samples.length; i++) {
        const day = r.stats.samples[i].date.slice(0, 10);
        if (!byDate.has(day)) byDate.set(day, { date: r.stats.samples[i].date });
        byDate.get(day)![r.watch.id] = +rolling[i].value.toFixed(2);
      }
    }
    return [...byDate.values()].sort((a, b) =>
      String(a.date).localeCompare(String(b.date))
    );
  }, [rows]);

  const weeklyVarianceChart = useMemo(() => {
    const byWeek = new Map<string, SeriesPoint>();
    for (const r of rows) {
      const grouped = new Map<string, number[]>();
      for (const s of r.stats.samples) {
        const key = isoWeekKey(new Date(s.date));
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key)!.push(s.spd);
      }
      for (const [week, spds] of grouped) {
        if (spds.length < 2) continue;
        const m = spds.reduce((a, b) => a + b, 0) / spds.length;
        const v = spds.reduce((a, x) => a + (x - m) ** 2, 0) / (spds.length - 1);
        if (!byWeek.has(week)) byWeek.set(week, { date: week });
        byWeek.get(week)![r.watch.id] = +v.toFixed(2);
      }
    }
    return [...byWeek.values()].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  }, [rows]);

  if (!ready) return <Skeleton className="h-96" />;

  const toggle = (id: string) =>
    setSelected((cur) => {
      const base = cur.length ? cur : ids;
      return base.includes(id) ? base.filter((x) => x !== id) : [...base, id];
    });

  const series = rows.map((r) => ({
    key: r.watch.id,
    name: `${r.watch.brand} ${r.watch.model}`,
    color: r.watch.accentColor,
  }));

  const METRICS: { label: string; get: (r: (typeof rows)[number]) => React.ReactNode }[] = [
    { label: "Average rate", get: (r) => fmtSpd(r.stats.avgSpd) },
    { label: "Rolling 7-day", get: (r) => fmtSpd(r.stats.rolling7) },
    { label: "Rolling 30-day", get: (r) => fmtSpd(r.stats.rolling30) },
    { label: "Std deviation", get: (r) => (r.stats.stdDev != null ? `±${r.stats.stdDev.toFixed(2)}` : "—") },
    { label: "Variance", get: (r) => r.stats.variance?.toFixed(2) ?? "—" },
    { label: "Weekly variance", get: (r) => r.stats.weeklyVariance?.toFixed(2) ?? "—" },
    { label: "Monthly variance", get: (r) => r.stats.monthlyVariance?.toFixed(2) ?? "—" },
    { label: "Consistency", get: (r) => (r.stats.consistencyIndex != null ? `${r.stats.consistencyIndex}%` : "—") },
    { label: "Grade", get: (r) => <GradeBadge grade={r.grade} /> },
    { label: "Health", get: (r) => (r.health ? <HealthBadge label={r.health.label} /> : "—") },
    { label: "Movement", get: (r) => <span className="capitalize">{r.watch.movementType}</span> },
    { label: "Caliber", get: (r) => r.watch.caliber ?? "—" },
    { label: "Power reserve", get: (r) => (r.watch.powerReserveHours ? `${r.watch.powerReserveHours} h` : "—") },
    { label: "Services logged", get: (r) => r.services.length },
    { label: "Worn", get: (r) => (r.stats.wearRatio != null ? `${Math.round(r.stats.wearRatio * 100)}%` : "—") },
    { label: "Value", get: (r) => fmtMoney(r.watch.currentValue, r.watch.currency) },
  ];

  return (
    <div className="fade-up">
      <h1 className="mb-1 text-2xl font-bold tracking-tight">Compare watches</h1>
      <p className="mb-5 text-sm text-muted">Pick two or more watches to compare side by side.</p>

      {/* selector chips */}
      <div className="mb-6 flex flex-wrap gap-2">
        {active.map((w) => {
          const on = ids.includes(w.id);
          return (
            <button
              key={w.id}
              onClick={() => toggle(w.id)}
              className={cn(
                "cursor-pointer rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all",
                on ? "border-transparent" : "border-border-token text-muted hover:text-foreground"
              )}
              style={on ? {
                background: `color-mix(in oklab, ${w.accentColor} 15%, transparent)`,
                color: w.accentColor,
              } : undefined}
            >
              <span className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ background: w.accentColor }} />
              {w.brand} {w.model}
            </button>
          );
        })}
      </div>

      <div className="space-y-4">
        <ChartCard title="Daily accuracy" sub="7-day rolling rate, s/d — drag to zoom">
          <CompareChart data={chart} series={series} height={340} />
        </ChartCard>
        <ChartCard title="Weekly variance" sub="s²/d per ISO week — lower is more stable">
          <CompareChart data={weeklyVarianceChart} series={series} height={260} unit=" s²/d"
            xFormatter={(v) => v} />
        </ChartCard>
      </div>

      {/* comparison matrix */}
      <Card className="mt-6 overflow-x-auto p-0">
        <table className="w-full min-w-130 text-sm">
          <thead>
            <tr className="border-b border-border-token text-left">
              <th className="px-4 py-3 text-xs font-semibold text-muted">Metric</th>
              {rows.map((r) => (
                <th key={r.watch.id} className="px-4 py-3">
                  <span className="flex items-center gap-2 text-xs font-semibold">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: r.watch.accentColor }} />
                    {r.watch.brand} {r.watch.model}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {METRICS.map((m) => (
              <tr key={m.label} className="border-b border-border-token/50 hover:bg-surface-2/40">
                <td className="px-4 py-2.5 text-xs text-muted">{m.label}</td>
                {rows.map((r) => (
                  <td key={r.watch.id} className="px-4 py-2.5 font-medium tabular-nums">
                    {m.get(r)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
