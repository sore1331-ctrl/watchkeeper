"use client";

// ─── Dashboard (home) ───────────────────────────────────────────────────────

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Battery, CalendarClock, Gauge, Watch as WatchIcon } from "lucide-react";
import { useStore } from "@/lib/store";
import { computeStats, fmtSpd, fmtSec, rollingAverage } from "@/lib/stats";
import {
  accuracyGrade, batteryRemaining, daysSince, healthScore,
  lastRegulationDate, lastServiceDate,
} from "@/lib/grades";
import { fmtMoney, relTime } from "@/lib/utils";
import { MeasurementDialog } from "@/components/forms";
import { RateChart, OffsetChart, AccuracyHeatmap } from "@/components/charts";
import {
  ChartCard, GradeBadge, HealthBadge, HealthRing, SectionTitle, StatCard,
} from "@/components/widgets";
import { Card, Skeleton } from "@/components/ui";

export default function DashboardPage() {
  const store = useStore();
  const { ready, watches, measurementsFor, servicesFor, insights } = store;
  const active = watches.filter((w) => !w.archived);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const watch = active.find((w) => w.id === selectedId) ?? active[0];

  const data = useMemo(() => {
    if (!watch) return null;
    const ms = measurementsFor(watch.id);
    const stats = computeStats(ms);
    const services = servicesFor(watch.id);
    const health = healthScore(watch, stats, services);
    const grade = accuracyGrade(stats.avgSpd, watch.movementType, watch.coscCertified);
    const rolling = rollingAverage(stats.samples, 7);
    const chartData = stats.samples.map((s, i) => ({
      date: s.date, spd: +s.spd.toFixed(2), rolling7: +rolling[i].value.toFixed(2), offset: s.offset,
    }));
    return { ms, stats, services, health, grade, chartData };
  }, [watch, measurementsFor, servicesFor]);

  if (!ready || !watch || !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
      </div>
    );
  }

  const { stats, services, health, grade, chartData } = data;
  const batt = batteryRemaining(watch);
  const regDays = daysSince(lastRegulationDate(services));
  const svcDays = daysSince(lastServiceDate(services) ?? watch.purchaseDate ?? null);
  const lastWorn = [...data.ms].reverse().find((m) => m.wornToday);
  const reserveLeft =
    watch.movementType !== "quartz" && watch.powerReserveHours && lastWorn
      ? Math.max(0, watch.powerReserveHours - (Date.now() - +new Date(lastWorn.measuredAt)) / 3_600_000)
      : null;
  const todayInsights = insights.filter((i) => i.watchId === watch.id).slice(0, 3);

  return (
    <div className="fade-up">
      {/* Header row */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-muted">Today&apos;s watch</p>
          <div className="mt-1 flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">
              {watch.brand} <span className="text-muted">{watch.model}</span>
            </h1>
            <GradeBadge grade={grade} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={watch.id}
            onChange={(e) => setSelectedId(e.target.value)}
            className="h-9 cursor-pointer rounded-lg border border-border-token bg-surface-2 px-3 text-sm"
          >
            {active.map((w) => (
              <option key={w.id} value={w.id}>{w.brand} {w.model}</option>
            ))}
          </select>
          <MeasurementDialog watchId={watch.id} />
        </div>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:gap-4">
        <StatCard label="Current offset" value={fmtSec(stats.currentOffset)} accent={watch.accentColor}
          sub={`measured ${relTime(stats.lastMeasuredAt)}`} delay={0} />
        <StatCard label="Today's gain/loss" value={fmtSpd(stats.todayRate)}
          trend={stats.todayRate == null ? undefined : stats.todayRate > 0.3 ? "up" : stats.todayRate < -0.3 ? "down" : "flat"}
          sub="latest daily rate" delay={0.05} />
        <StatCard label="Avg daily rate" value={fmtSpd(stats.avgSpd)}
          sub={`median ${fmtSpd(stats.medianSpd)}`} delay={0.1} />
        <StatCard label="Movement health" value={health ? `${health.score}` : "—"}
          sub={health ? <HealthBadge label={health.label} /> : undefined} delay={0.15} />
        <StatCard label="Weekly variance" value={stats.weeklyVariance?.toFixed(2) ?? "—"}
          sub="s²/d, last 7 days" delay={0.2} />
        <StatCard label="Monthly variance" value={stats.monthlyVariance?.toFixed(2) ?? "—"}
          sub="s²/d, last 30 days" delay={0.25} />
        <StatCard label="Rolling 7-day" value={fmtSpd(stats.rolling7)} sub="average rate" delay={0.3} />
        <StatCard label="Rolling 30-day" value={fmtSpd(stats.rolling30)} sub="average rate" delay={0.35} />
        <StatCard label="Days since regulation" value={regDays ?? "—"}
          sub={regDays != null ? "days" : "no record"} delay={0.4} />
        <StatCard label="Days since service" value={svcDays ?? "—"}
          sub={svcDays != null ? "days" : "no record"} delay={0.45} />
        {watch.movementType === "quartz" ? (
          <StatCard label="Battery" value={batt != null ? `${Math.round(batt * 100)}%` : "—"}
            sub={<span className="flex items-center gap-1"><Battery className="h-3.5 w-3.5" /> estimated remaining</span>} delay={0.5} />
        ) : (
          <StatCard label="Power reserve" value={reserveLeft != null ? `~${Math.round(reserveLeft)}h` : "—"}
            sub={<span className="flex items-center gap-1"><Gauge className="h-3.5 w-3.5" /> of {watch.powerReserveHours ?? "?"}h</span>} delay={0.5} />
        )}
        <StatCard label="Predicted +30d" value={stats.predicted ? fmtSec(stats.predicted.d30) : "—"}
          sub="deviation if unadjusted" delay={0.55} />
      </div>

      {/* Charts */}
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <ChartCard title="Daily rate" sub="seconds/day with 7-day rolling average">
          <RateChart data={chartData} color={watch.accentColor} coscBand={watch.coscCertified} zoom={false} />
        </ChartCard>
        <ChartCard title="Offset history" sub="cumulative deviation from reference time">
          <OffsetChart data={chartData} color={watch.accentColor} height={260} zoom={false} />
        </ChartCard>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <ChartCard title="Accuracy heatmap" sub="daily |rate| by calendar day" className="lg:col-span-2">
          <AccuracyHeatmap samples={stats.samples} />
        </ChartCard>
        <Card className="flex flex-col items-center justify-center gap-3 p-6">
          <p className="text-sm font-semibold">Movement health</p>
          {health ? (
            <>
              <HealthRing score={health.score} label={health.label} />
              <HealthBadge label={health.label} />
            </>
          ) : (
            <p className="text-xs text-muted">Not enough data yet.</p>
          )}
        </Card>
      </div>

      {/* Insights preview */}
      {todayInsights.length > 0 && (
        <>
          <SectionTitle
            action={
              <Link href="/insights" className="flex items-center gap-1 text-xs font-medium text-accent hover:underline">
                All insights <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            }
          >
            Smart insights
          </SectionTitle>
          <div className="grid gap-3 md:grid-cols-3">
            {todayInsights.map((ins) => (
              <Card key={ins.id} className="p-4">
                <p className="text-sm leading-relaxed">{ins.text}</p>
                {ins.detail && <p className="mt-1.5 text-xs text-muted">{ins.detail}</p>}
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Collection strip */}
      <SectionTitle
        action={
          <Link href="/watches" className="flex items-center gap-1 text-xs font-medium text-accent hover:underline">
            Collection <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        }
      >
        Your collection
      </SectionTitle>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {active.map((w) => {
          const s = computeStats(measurementsFor(w.id));
          const g = accuracyGrade(s.avgSpd, w.movementType, w.coscCertified);
          return (
            <Link key={w.id} href={`/watches/${w.id}`}>
              <Card className="group cursor-pointer p-4 transition-colors hover:border-accent/40">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg"
                    style={{ background: `color-mix(in oklab, ${w.accentColor} 15%, transparent)`, color: w.accentColor }}>
                    <WatchIcon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{w.brand}</p>
                    <p className="truncate text-xs text-muted">{w.model}</p>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-sm font-bold tabular-nums">{fmtSpd(s.avgSpd)}</span>
                  <GradeBadge grade={g} />
                </div>
              </Card>
            </Link>
          );
        })}
      </div>

      {/* footer stats */}
      <p className="mt-8 flex items-center gap-2 text-xs text-faint">
        <CalendarClock className="h-3.5 w-3.5" />
        {active.length} watches · {store.measurements.length} measurements ·
        collection value {fmtMoney(active.reduce((a, w) => a + (w.currentValue ?? 0), 0))}
      </p>
    </div>
  );
}
