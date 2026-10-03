"use client";

// ─── Analytics: cross-cutting interactive charts ────────────────────────────

import React, { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { forecastOffsets, groupByPeriod, rollingAverage } from "@/lib/stats";
import { analyzeWatch } from "@/lib/analysis";
import {
  AccuracyHeatmap, OffsetChart, PeriodBars, PredictionChart, RateChart,
  TempScatter, WearFrequencyChart,
} from "@/components/charts";
import { ChartCard } from "@/components/widgets";
import { Skeleton, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui";
import { fmtDate } from "@/lib/utils";

const DAY_MS = 86_400_000;
const RANGES = [
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
  { label: "All", days: 9999 },
];

export default function AnalyticsPage() {
  const { ready, watches, measurementsFor, servicesFor, settings } = useStore();
  const active = watches.filter((w) => !w.archived);
  const [watchId, setWatchId] = useState<string | null>(null);
  const [rangeDays, setRangeDays] = useState(90);
  const watch = active.find((w) => w.id === watchId) ?? active[0];

  const data = useMemo(() => {
    if (!watch) return null;
    const cutoff = Date.now() - rangeDays * DAY_MS;
    // Analytics windows the data, so it computes stats over the filtered set
    // rather than reusing the whole-history analysis — but through the same
    // shared function, with the same options, so the two always agree.
    const ms = measurementsFor(watch.id).filter((m) => +new Date(m.measuredAt) > cutoff);
    const { stats, spec } = analyzeWatch(watch, ms, servicesFor(watch.id), settings);
    const r7 = rollingAverage(stats.samples, 7);
    const r30 = rollingAverage(stats.samples, 30);
    const chartData = stats.samples.map((s, i) => ({
      date: s.date, spd: +s.spd.toFixed(2),
      rolling7: +r7[i].value.toFixed(2), rolling30: +r30[i].value.toFixed(2),
      offset: s.offset,
    }));
    const forecast = forecastOffsets(stats);
    const wearByDay = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((weekday, i) => ({
      weekday,
      count: ms.filter((m) => m.wornToday && (new Date(m.measuredAt).getDay() + 6) % 7 === i).length,
    }));
    return {
      stats, chartData, forecast, spec,
      weekly: groupByPeriod(stats.samples, "week"),
      monthly: groupByPeriod(stats.samples, "month"),
      history: stats.samples.slice(-45).map((s) => ({ date: s.date, offset: +s.offset.toFixed(1) })),
      wearByDay,
      tempData: stats.samples.filter((s) => s.temperatureC != null)
        .map((s) => ({ temperatureC: s.temperatureC!, spd: +s.spd.toFixed(2) })),
      services: servicesFor(watch.id),
    };
  }, [watch, rangeDays, measurementsFor, servicesFor]);

  if (!ready || !watch || !data) return <Skeleton className="h-96" />;

  return (
    <div className="fade-up">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
        <div className="flex items-center gap-2">
          <select
            value={watch.id}
            onChange={(e) => setWatchId(e.target.value)}
            className="h-9 cursor-pointer rounded-lg border border-border-token bg-surface-2 px-3 text-sm"
          >
            {active.map((w) => (
              <option key={w.id} value={w.id}>{w.brand} {w.model}</option>
            ))}
          </select>
          <div className="flex rounded-lg bg-surface-2 p-1">
            {RANGES.map((r) => (
              <button
                key={r.label}
                onClick={() => setRangeDays(r.days)}
                className={`cursor-pointer rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                  rangeDays === r.days ? "bg-surface text-foreground shadow-sm" : "text-muted"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <Tabs defaultValue="rate">
        <TabsList className="mb-4 flex-wrap">
          <TabsTrigger value="rate">Rate</TabsTrigger>
          <TabsTrigger value="offset">Offset</TabsTrigger>
          <TabsTrigger value="aggregates">Weekly / Monthly</TabsTrigger>
          <TabsTrigger value="prediction">Prediction</TabsTrigger>
          <TabsTrigger value="patterns">Patterns</TabsTrigger>
        </TabsList>

        <TabsContent value="rate" className="space-y-4">
          <ChartCard title="Daily deviation & moving averages"
            sub="thin line = daily rate · bold = 7-day rolling · drag the brush to zoom">
            <RateChart data={data.chartData} color={watch.accentColor} height={340}
              spec={data.spec} />
          </ChartCard>
          <ChartCard title="Seconds/day trend" sub="30-day rolling average">
            <RateChart
              data={data.chartData.map((d) => ({ ...d, rolling7: d.rolling30 }))}
              color={watch.accentColor} height={240} showRolling zoom={false}
            />
          </ChartCard>
        </TabsContent>

        <TabsContent value="offset">
          <ChartCard title="Offset history" sub="cumulative deviation from reference time — drag to zoom">
            <OffsetChart data={data.chartData} color={watch.accentColor} height={380} />
          </ChartCard>
        </TabsContent>

        <TabsContent value="aggregates" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard title="Weekly average" sub="mean s/d per ISO week">
              <PeriodBars data={data.weekly} color={watch.accentColor} height={260} />
            </ChartCard>
            <ChartCard title="Monthly average">
              <PeriodBars data={data.monthly} color={watch.accentColor} height={260} />
            </ChartCard>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard title="Weekly variance" sub="(s/d)² — lower is more stable">
              <PeriodBars data={data.weekly} dataKey="variance" name="Variance" unit=" (s/d)²"
                color={watch.accentColor} height={220} />
            </ChartCard>
            <ChartCard title="Weekly σ" sub="standard deviation per week">
              <PeriodBars data={data.weekly.map((w) => ({ ...w, stdDev: +w.stdDev.toFixed(2) }))}
                dataKey="stdDev" name="σ" unit=" s/d" color={watch.accentColor} height={220} />
            </ChartCard>
          </div>
        </TabsContent>

        <TabsContent value="prediction">
          <ChartCard title="Prediction curve"
            sub="measured offset + forecast with an approximate 95% range (based on 7-day rate)">
            <PredictionChart history={data.history} forecast={data.forecast}
              color={watch.accentColor} height={380} />
          </ChartCard>
        </TabsContent>

        <TabsContent value="patterns" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard title="Accuracy heatmap" sub="daily |rate| by calendar day">
              <AccuracyHeatmap samples={data.stats.samples} weeks={22} />
            </ChartCard>
            <ChartCard title="Wear frequency" sub="days worn by weekday">
              <WearFrequencyChart data={data.wearByDay} color={watch.accentColor} height={240} />
            </ChartCard>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {data.tempData.length >= 5 && (
              <ChartCard title="Temperature sensitivity" sub="rate vs ambient temperature">
                <TempScatter data={data.tempData} color={watch.accentColor} />
              </ChartCard>
            )}
            <ChartCard title="Service timeline" sub="service events for this watch">
              {data.services.length === 0 ? (
                <p className="py-8 text-center text-xs text-muted">No service records.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {data.services.map((s) => (
                    <li key={s.id} className="flex items-center justify-between rounded-lg bg-surface-2/60 px-3 py-2">
                      <span className="capitalize">{s.type.replace("-", " ")}</span>
                      <span className="text-xs text-muted">{fmtDate(s.date)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </ChartCard>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
