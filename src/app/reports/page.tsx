"use client";

// ─── Reports: weekly summary, monthly report, exports ───────────────────────

import React, { useMemo, useState } from "react";
import { Download, FileText, Printer } from "lucide-react";
import { useStore } from "@/lib/store";
import {
  computeStats, fmtSpd, groupByPeriod, isoWeekKey, mean, stdDev, variance,
} from "@/lib/stats";
import { accuracyGrade, healthScore, nextServiceEstimate } from "@/lib/grades";
import { GradeBadge, HealthBadge, SectionTitle, StatCard } from "@/components/widgets";
import { Button, Card, Skeleton, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui";
import { exportMeasurementsCsv } from "@/components/measurements-table";

const DAY_MS = 86_400_000;

function download(name: string, mime: string, content: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

export default function ReportsPage() {
  const store = useStore();
  const { ready, watches, measurementsFor, servicesFor } = store;
  const active = watches.filter((w) => !w.archived);
  const [watchId, setWatchId] = useState<string | null>(null);
  const watch = active.find((w) => w.id === watchId) ?? active[0];

  const report = useMemo(() => {
    if (!watch) return null;
    const ms = measurementsFor(watch.id);
    const stats = computeStats(ms);
    const services = servicesFor(watch.id);
    const health = healthScore(watch, stats, services);
    const grade = accuracyGrade(stats.avgSpd, watch.movementType, watch.coscCertified);

    // Weekly summary (last full 7 days)
    const end = stats.lastMeasuredAt ? +new Date(stats.lastMeasuredAt) : Date.now();
    const week = stats.samples.filter((s) => +new Date(s.date) > end - 7 * DAY_MS);
    const weekSpds = week.map((s) => s.spd);
    const weekly = week.length >= 2 ? {
      avg: mean(weekSpds),
      fastest: week.reduce((a, b) => (b.spd > a.spd ? b : a)),
      slowest: week.reduce((a, b) => (b.spd < a.spd ? b : a)),
      largestDev: week.reduce((a, b) => (Math.abs(b.spd) > Math.abs(a.spd) ? b : a)),
      variance: variance(weekSpds),
      sd: stdDev(weekSpds),
    } : null;

    // Monthly report (last 30 days)
    const month = stats.samples.filter((s) => +new Date(s.date) > end - 30 * DAY_MS);
    const weeks = groupByPeriod(month, "week");
    const best = weeks.length ? [...weeks].sort((a, b) => Math.abs(a.avgSpd) - Math.abs(b.avgSpd))[0] : null;
    const worst = weeks.length ? [...weeks].sort((a, b) => Math.abs(b.avgSpd) - Math.abs(a.avgSpd))[0] : null;
    const stable = weeks.length ? [...weeks].sort((a, b) => a.variance - b.variance)[0] : null;
    const unstable = weeks.length ? [...weeks].sort((a, b) => b.variance - a.variance)[0] : null;
    const monthly = month.length >= 2 ? {
      count: month.length,
      avg: mean(month.map((s) => s.spd)),
      variance: variance(month.map((s) => s.spd)),
      wear: month.filter((s) => s.wornToday).length / month.length,
      best, worst, stable, unstable,
    } : null;

    const suggestions: string[] = [];
    if (stats.avgSpd != null && Math.abs(stats.avgSpd) > 8)
      suggestions.push("Rate exceeds ±8 s/d — consider regulation.");
    if (weekly && weekly.sd > 3)
      suggestions.push("Weekly σ above 3 s/d — check for magnetization or position sensitivity.");
    if (stats.weeklyVariance != null && stats.monthlyVariance != null && stats.weeklyVariance > 2 * stats.monthlyVariance)
      suggestions.push("Variance rising vs monthly baseline — keep a closer measurement cadence.");
    if (watch.coscCertified && stats.avgSpd != null && (stats.avgSpd < -4 || stats.avgSpd > 6))
      suggestions.push("Running outside COSC — a service center can restore chronometer spec.");
    if (!suggestions.length) suggestions.push("Performance is healthy — keep the current routine.");

    return { ms, stats, services, health, grade, weekly, monthly, suggestions,
      nextService: nextServiceEstimate(watch, services) };
  }, [watch, measurementsFor, servicesFor]);

  if (!ready || !watch || !report) return <Skeleton className="h-96" />;

  const { stats, weekly, monthly, health, grade } = report;
  const fmtDay = (iso: string) =>
    new Date(iso).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });

  const exportJson = () =>
    download("watchkeeper-export.json", "application/json", JSON.stringify({
      exportedAt: new Date().toISOString(),
      watches: store.watches, measurements: store.measurements, services: store.services,
    }, null, 2));

  const exportCollectionCsv = () => {
    const header = "brand,model,reference,movement,caliber,avg_spd,std_dev,variance,grade,health,measurements";
    const rows = active.map((w) => {
      const s = computeStats(measurementsFor(w.id));
      const h = healthScore(w, s, servicesFor(w.id));
      const g = accuracyGrade(s.avgSpd, w.movementType, w.coscCertified);
      return [w.brand, w.model, w.reference ?? "", w.movementType, w.caliber ?? "",
        s.avgSpd?.toFixed(2) ?? "", s.stdDev?.toFixed(2) ?? "", s.variance?.toFixed(2) ?? "",
        g ?? "", h?.score ?? "", s.count].join(",");
    });
    download("watchkeeper-collection.csv", "text/csv", [header, ...rows].join("\n"));
  };

  return (
    <div className="fade-up">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={watch.id}
            onChange={(e) => setWatchId(e.target.value)}
            className="h-9 cursor-pointer rounded-lg border border-border-token bg-surface-2 px-3 text-sm"
          >
            {active.map((w) => (
              <option key={w.id} value={w.id}>{w.brand} {w.model}</option>
            ))}
          </select>
          <Button variant="secondary" size="sm" onClick={() => window.print()}>
            <Printer className="h-3.5 w-3.5" /> Print / PDF
          </Button>
          <Button variant="secondary" size="sm" onClick={() => exportMeasurementsCsv(watch, report.ms)}>
            <Download className="h-3.5 w-3.5" /> CSV
          </Button>
          <Button variant="secondary" size="sm" onClick={exportCollectionCsv}>
            <Download className="h-3.5 w-3.5" /> Collection CSV
          </Button>
          <Button variant="secondary" size="sm" onClick={exportJson}>
            <Download className="h-3.5 w-3.5" /> JSON backup
          </Button>
        </div>
      </div>

      {/* Accuracy certificate header (print friendly) */}
      <Card className="mb-6 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted">
              <FileText className="h-3.5 w-3.5" /> Accuracy certificate
            </p>
            <h2 className="mt-1 text-xl font-bold">{watch.brand} {watch.model}</h2>
            <p className="text-sm text-muted">
              {watch.reference} · cal. {watch.caliber} · {stats.count} measurements ·
              generated {new Date().toLocaleDateString("en-GB")}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <GradeBadge grade={grade} />
            {health && <HealthBadge label={health.label} />}
          </div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard label="Average rate" value={fmtSpd(stats.avgSpd)} />
          <StatCard label="Std deviation" value={stats.stdDev != null ? `±${stats.stdDev.toFixed(2)}` : "—"} />
          <StatCard label="95% CI"
            value={stats.confidence95 ? `${stats.confidence95[0].toFixed(1)}…${stats.confidence95[1].toFixed(1)}` : "—"} />
          <StatCard label="Health score" value={health?.score ?? "—"} />
        </div>
      </Card>

      <Tabs defaultValue="weekly">
        <TabsList className="print:hidden">
          <TabsTrigger value="weekly">Weekly summary</TabsTrigger>
          <TabsTrigger value="monthly">Monthly report</TabsTrigger>
        </TabsList>

        <TabsContent value="weekly" className="mt-4">
          {!weekly ? (
            <p className="text-sm text-muted">Not enough measurements in the last 7 days.</p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                <StatCard label="Average SPD" value={fmtSpd(weekly.avg)} />
                <StatCard label="Fastest day" value={fmtSpd(weekly.fastest.spd)}
                  sub={fmtDay(weekly.fastest.date)} delay={0.05} />
                <StatCard label="Slowest day" value={fmtSpd(weekly.slowest.spd)}
                  sub={fmtDay(weekly.slowest.date)} delay={0.1} />
                <StatCard label="Largest deviation" value={fmtSpd(weekly.largestDev.spd)}
                  sub={fmtDay(weekly.largestDev.date)} delay={0.15} />
                <StatCard label="Variance" value={weekly.variance.toFixed(2)} sub="s²/d" delay={0.2} />
                <StatCard label="Stability score" value={stats.stabilityScore != null ? Math.round(stats.stabilityScore) : "—"}
                  sub="/ 100" delay={0.25} />
              </div>
              <SectionTitle>Prediction & suggestions</SectionTitle>
              <div className="grid gap-4 md:grid-cols-2">
                <Card className="p-5">
                  <p className="mb-2 text-sm font-semibold">Projected deviation</p>
                  {stats.predicted && (
                    <ul className="space-y-1.5 text-sm">
                      <li className="flex justify-between"><span className="text-muted">After 7 days</span><span className="font-semibold tabular-nums">{stats.predicted.d7 > 0 ? "+" : ""}{stats.predicted.d7.toFixed(0)}s</span></li>
                      <li className="flex justify-between"><span className="text-muted">After 14 days</span><span className="font-semibold tabular-nums">{stats.predicted.d14 > 0 ? "+" : ""}{stats.predicted.d14.toFixed(0)}s</span></li>
                      <li className="flex justify-between"><span className="text-muted">After 30 days</span><span className="font-semibold tabular-nums">{stats.predicted.d30 > 0 ? "+" : ""}{stats.predicted.d30.toFixed(0)}s</span></li>
                      <li className="flex justify-between"><span className="text-muted">After 90 days</span><span className="font-semibold tabular-nums">{stats.predicted.d90 > 0 ? "+" : ""}{stats.predicted.d90.toFixed(0)}s</span></li>
                    </ul>
                  )}
                </Card>
                <Card className="p-5">
                  <p className="mb-2 text-sm font-semibold">Suggestions</p>
                  <ul className="list-inside list-disc space-y-1.5 text-sm text-muted">
                    {report.suggestions.map((s, i) => <li key={i}>{s}</li>)}
                  </ul>
                </Card>
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="monthly" className="mt-4">
          {!monthly ? (
            <p className="text-sm text-muted">Not enough measurements in the last 30 days.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              <StatCard label="Measurements" value={monthly.count} />
              <StatCard label="Average accuracy" value={fmtSpd(monthly.avg)} delay={0.05} />
              <StatCard label="Variance" value={monthly.variance.toFixed(2)} sub="s²/d" delay={0.1} />
              <StatCard label="Best week" value={monthly.best?.label ?? "—"}
                sub={monthly.best ? fmtSpd(monthly.best.avgSpd) : undefined} delay={0.15} />
              <StatCard label="Worst week" value={monthly.worst?.label ?? "—"}
                sub={monthly.worst ? fmtSpd(monthly.worst.avgSpd) : undefined} delay={0.2} />
              <StatCard label="Average wear" value={`${Math.round(monthly.wear * 100)}%`}
                sub="of measured days" delay={0.25} />
              <StatCard label="Most stable period" value={monthly.stable?.label ?? "—"}
                sub={monthly.stable ? `var ${monthly.stable.variance.toFixed(2)}` : undefined} delay={0.3} />
              <StatCard label="Least stable period" value={monthly.unstable?.label ?? "—"}
                sub={monthly.unstable ? `var ${monthly.unstable.variance.toFixed(2)}` : undefined} delay={0.35} />
              <StatCard label="Service recommendation"
                value={report.nextService ?? "—"} sub="estimated next service"
                className="[&>p:nth-child(2)]:text-base" delay={0.4} />
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
