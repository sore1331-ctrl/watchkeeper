"use client";

// ─── Watch detail: profile, analytics, measurements, services ───────────────

import React, { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Pencil, Plus, ShieldCheck, Trash2, Wrench,
} from "lucide-react";
import { useStore } from "@/lib/store";
import {
  computeStats, detectAnomaly, fmtSec, fmtSpd, groupByPeriod, rollingAverage,
} from "@/lib/stats";
import {
  accuracyGrade, batteryRemaining, daysSince, healthScore,
  lastRegulationDate, lastServiceDate, nextServiceEstimate,
} from "@/lib/grades";
import { fmtDate, fmtDateTime, fmtMoney } from "@/lib/utils";
import { MeasurementDialog, ServiceDialog, WatchDialog } from "@/components/forms";
import {
  AccuracyHeatmap, OffsetChart, PeriodBars, PredictionChart, RateChart,
  TempScatter, WearFrequencyChart,
} from "@/components/charts";
import {
  ChartCard, GradeBadge, HealthBadge, HealthRing, ScoreBar, StatCard,
} from "@/components/widgets";
import { Badge, Button, Card, Empty, Skeleton, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui";
import { MeasurementsTable } from "@/components/measurements-table";

const DAY_MS = 86_400_000;

export default function WatchDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const store = useStore();
  const { ready, watches, measurementsFor, servicesFor, insights, deleteWatch } = store;
  const watch = watches.find((w) => w.id === id);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const data = useMemo(() => {
    if (!watch) return null;
    const ms = measurementsFor(watch.id);
    const stats = computeStats(ms);
    const services = servicesFor(watch.id);
    const rolling7 = rollingAverage(stats.samples, 7);
    const rolling30 = rollingAverage(stats.samples, 30);
    const chartData = stats.samples.map((s, i) => ({
      date: s.date,
      spd: +s.spd.toFixed(2),
      rolling7: +rolling7[i].value.toFixed(2),
      rolling30: +rolling30[i].value.toFixed(2),
      offset: s.offset,
    }));
    const weekly = groupByPeriod(stats.samples, "week").slice(-12);
    const monthly = groupByPeriod(stats.samples, "month");
    // forecast
    const rate = stats.rolling7 ?? stats.avgSpd ?? 0;
    const sd = stats.stdDev ?? 0;
    const lastDate = stats.lastMeasuredAt ? +new Date(stats.lastMeasuredAt) : Date.now();
    const off = stats.currentOffset ?? 0;
    const forecast = [7, 14, 30, 60, 90].map((d) => ({
      date: new Date(lastDate + d * DAY_MS).toISOString(),
      predicted: +(off + rate * d).toFixed(1),
      lo: +(off + (rate - 1.96 * sd / Math.sqrt(Math.max(stats.samples.length, 2))) * d).toFixed(1),
      hi: +(off + (rate + 1.96 * sd / Math.sqrt(Math.max(stats.samples.length, 2))) * d).toFixed(1),
    }));
    const history = stats.samples.slice(-45).map((s) => ({ date: s.date, offset: +s.offset.toFixed(1) }));
    const wearByDay = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((weekday, i) => ({
      weekday,
      count: ms.filter((m) => m.wornToday && (new Date(m.measuredAt).getDay() + 6) % 7 === i).length,
    }));
    const tempData = stats.samples
      .filter((s) => s.temperatureC != null)
      .map((s) => ({ temperatureC: s.temperatureC!, spd: +s.spd.toFixed(2) }));
    return {
      ms, stats, services,
      health: healthScore(watch, stats, services),
      grade: accuracyGrade(stats.avgSpd, watch.movementType, watch.coscCertified),
      anomaly: detectAnomaly(stats.samples),
      chartData, weekly, monthly, forecast, history, wearByDay, tempData,
    };
  }, [watch, measurementsFor, servicesFor]);

  if (!ready) return <Skeleton className="h-96" />;
  if (!watch || !data) {
    return (
      <Empty title="Watch not found">
        <Link href="/watches" className="text-accent hover:underline">Back to collection</Link>
      </Empty>
    );
  }

  const { stats, services, health, grade, anomaly } = data;
  const batt = batteryRemaining(watch);
  const nextSvc = nextServiceEstimate(watch, services);
  const watchInsights = insights.filter((i) => i.watchId === watch.id);

  return (
    <div className="fade-up">
      {/* header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/watches" className="mb-2 flex items-center gap-1 text-xs text-muted hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" /> Collection
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">
              {watch.brand} <span className="text-muted">{watch.model}</span>
            </h1>
            <GradeBadge grade={grade} />
            {watch.coscCertified && (
              <Badge color="#c9a227"><ShieldCheck className="h-3 w-3" /> COSC certified</Badge>
            )}
            {anomaly?.drifting && <Badge color="var(--critical)">Drifting</Badge>}
          </div>
          <p className="mt-1 text-sm text-muted">
            {watch.reference} · cal. {watch.caliber} · {watch.movementType}
            {watch.beatRate ? ` · ${(watch.beatRate / 3600).toFixed(0)} Hz×3600 (${watch.beatRate} vph)` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <WatchDialog existing={watch} trigger={
            <Button variant="secondary" size="sm"><Pencil className="h-3.5 w-3.5" /> Edit</Button>
          } />
          {!confirmDelete ? (
            <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(true)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          ) : (
            <Button variant="destructive" size="sm"
              onClick={() => { deleteWatch(watch.id); router.push("/watches"); }}>
              Confirm delete
            </Button>
          )}
          <MeasurementDialog watchId={watch.id} />
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:gap-4">
        <StatCard label="Current offset" value={fmtSec(stats.currentOffset)} accent={watch.accentColor}
          sub={`measured ${fmtDateTime(stats.lastMeasuredAt)}`} />
        <StatCard label="Average rate" value={fmtSpd(stats.avgSpd)} sub={`median ${fmtSpd(stats.medianSpd)}`} delay={0.05} />
        <StatCard label="Std deviation" value={stats.stdDev != null ? `±${stats.stdDev.toFixed(2)}` : "—"}
          sub={`variance ${stats.variance?.toFixed(2) ?? "—"} s²/d`} delay={0.1} />
        <StatCard label="Consistency" value={stats.consistencyIndex != null ? `${stats.consistencyIndex}%` : "—"}
          sub="within 1σ of mean" delay={0.15} />
        <StatCard label="Max gain" value={fmtSpd(stats.maxGain)} delay={0.2} />
        <StatCard label="Max loss" value={fmtSpd(stats.maxLoss)} delay={0.25} />
        <StatCard label="95% CI"
          value={stats.confidence95 ? `${stats.confidence95[0].toFixed(1)}…${stats.confidence95[1].toFixed(1)}` : "—"}
          sub="s/d around mean" delay={0.3} />
        <StatCard label="Worn" value={stats.wearRatio != null ? `${Math.round(stats.wearRatio * 100)}%` : "—"}
          sub="of measured days" delay={0.35} />
      </div>

      {/* prediction tiles */}
      {stats.predicted && (
        <div className="mt-4 grid grid-cols-4 gap-3">
          {([["7 days", stats.predicted.d7], ["14 days", stats.predicted.d14], ["30 days", stats.predicted.d30], ["90 days", stats.predicted.d90]] as const).map(([l, v]) => (
            <Card key={l} className="p-3 text-center">
              <p className="text-[10px] uppercase tracking-wider text-muted">After {l}</p>
              <p className="text-lg font-bold tabular-nums">{fmtSec(v, 0)}</p>
            </Card>
          ))}
        </div>
      )}

      {/* tabbed content */}
      <Tabs defaultValue="performance" className="mt-6">
        <TabsList>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="measurements">Measurements</TabsTrigger>
          <TabsTrigger value="service">Service</TabsTrigger>
          <TabsTrigger value="profile">Profile</TabsTrigger>
        </TabsList>

        <TabsContent value="performance" className="mt-4 space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard title="Daily rate" sub="s/d with 7-day rolling average — drag the brush to zoom">
              <RateChart data={data.chartData} color={watch.accentColor} coscBand={watch.coscCertified} />
            </ChartCard>
            <ChartCard title="Offset history" sub="cumulative deviation">
              <OffsetChart data={data.chartData} color={watch.accentColor} height={260} />
            </ChartCard>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard title="Prediction curve" sub="45-day history + 90-day forecast with 95% confidence band">
              <PredictionChart history={data.history} forecast={data.forecast} color={watch.accentColor} />
            </ChartCard>
            <ChartCard title="Weekly averages" sub="mean s/d per ISO week">
              <PeriodBars data={data.weekly} color={watch.accentColor} height={260} />
            </ChartCard>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <ChartCard title="Monthly averages">
              <PeriodBars data={data.monthly} color={watch.accentColor} height={200} />
            </ChartCard>
            <ChartCard title="Variance by week" sub="s²/d">
              <PeriodBars data={data.weekly} dataKey="variance" name="Variance" unit=" s²/d" color={watch.accentColor} height={200} />
            </ChartCard>
            <ChartCard title="Wear frequency" sub="days worn by weekday">
              <WearFrequencyChart data={data.wearByDay} color={watch.accentColor} height={200} />
            </ChartCard>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard title="Accuracy heatmap" sub="hover a cell for the exact rate">
              <AccuracyHeatmap samples={stats.samples} />
            </ChartCard>
            {data.tempData.length >= 5 && (
              <ChartCard title="Temperature sensitivity" sub="rate vs ambient temperature">
                <TempScatter data={data.tempData} color={watch.accentColor} />
              </ChartCard>
            )}
          </div>

          {/* health breakdown */}
          {health && (
            <Card className="p-5">
              <div className="flex flex-col gap-6 md:flex-row md:items-center">
                <div className="flex flex-col items-center gap-2">
                  <HealthRing score={health.score} label={health.label} />
                  <HealthBadge label={health.label} />
                </div>
                <div className="flex-1 space-y-2.5">
                  {health.components.map((c) => (
                    <ScoreBar key={c.name} name={c.name} score={c.score} weight={c.weight} />
                  ))}
                </div>
              </div>
            </Card>
          )}

          {/* insights for this watch */}
          {watchInsights.length > 0 && (
            <div className="grid gap-3 md:grid-cols-2">
              {watchInsights.map((ins) => (
                <Card key={ins.id} className="p-4">
                  <p className="text-sm">{ins.text}</p>
                  {ins.detail && <p className="mt-1 text-xs text-muted">{ins.detail}</p>}
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="measurements" className="mt-4">
          <MeasurementsTable watch={watch} measurements={data.ms} />
        </TabsContent>

        <TabsContent value="service" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted">
              {nextSvc && (
                <>Next service estimated <span className="font-semibold text-foreground">{fmtDate(nextSvc)}</span>
                  {daysSince(lastServiceDate(services) ?? null) != null &&
                    <> · last major service {daysSince(lastServiceDate(services))} days ago</>}
                </>
              )}
            </div>
            <ServiceDialog watchId={watch.id} trigger={
              <Button variant="secondary" size="sm"><Plus className="h-3.5 w-3.5" /> Log service</Button>
            } />
          </div>
          {services.length === 0 ? (
            <Empty icon={<Wrench className="h-8 w-8" />} title="No service records yet" />
          ) : (
            <div className="relative space-y-0 pl-6">
              <span className="absolute inset-y-2 left-[9px] w-px bg-border-token" />
              {[...services].reverse().map((s) => (
                <div key={s.id} className="relative pb-5">
                  <span className="absolute -left-6 top-1 flex h-5 w-5 items-center justify-center rounded-full border border-border-token bg-surface">
                    <span className="h-2 w-2 rounded-full" style={{ background: watch.accentColor }} />
                  </span>
                  <Card className="p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold capitalize">{s.type.replace("-", " ")}</p>
                      <p className="text-xs text-muted">{fmtDate(s.date)} · {fmtMoney(s.cost, s.currency)}</p>
                    </div>
                    <p className="mt-1 text-xs text-muted">{s.watchmaker}</p>
                    {s.notes && <p className="mt-1.5 text-xs">{s.notes}</p>}
                    {s.partsReplaced && s.partsReplaced.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {s.partsReplaced.map((p) => <Badge key={p} color="var(--faint)">{p}</Badge>)}
                      </div>
                    )}
                    {s.pressureTestPassed != null && (
                      <Badge className="mt-2" color={s.pressureTestPassed ? "var(--positive)" : "var(--critical)"}>
                        Pressure test {s.pressureTestPassed ? "passed" : "failed"}
                        {s.waterResistanceRating ? ` · ${s.waterResistanceRating}` : ""}
                      </Badge>
                    )}
                  </Card>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="profile" className="mt-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="p-5">
              <p className="mb-3 text-sm font-semibold">Specifications</p>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm">
                {([
                  ["Brand", watch.brand], ["Model", watch.model],
                  ["Reference", watch.reference], ["Serial", watch.serial],
                  ["Movement", watch.movementType], ["Caliber", watch.caliber],
                  ["Beat rate", watch.beatRate ? `${watch.beatRate} vph` : undefined],
                  ["Power reserve", watch.powerReserveHours ? `${watch.powerReserveHours} h` : undefined],
                  ["Jewels", watch.jewels?.toString()],
                  ["COSC", watch.coscCertified ? "Yes" : "No"],
                ] as const).map(([k, v]) => (
                  <React.Fragment key={k}>
                    <dt className="text-muted">{k}</dt>
                    <dd className="font-medium capitalize">{v ?? "—"}</dd>
                  </React.Fragment>
                ))}
              </dl>
            </Card>
            <Card className="p-5">
              <p className="mb-3 text-sm font-semibold">Ownership</p>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm">
                {([
                  ["Purchased", fmtDate(watch.purchaseDate)],
                  ["Purchase price", fmtMoney(watch.purchasePrice, watch.currency)],
                  ["Current value", fmtMoney(watch.currentValue, watch.currency)],
                  ["Warranty until", watch.warrantyUntil ? fmtDate(watch.warrantyUntil) : "—"],
                  ["Insured", watch.insured ? "Yes" : "No"],
                  ["Battery", batt != null ? `${Math.round(batt * 100)}% remaining` : "—"],
                ] as const).map(([k, v]) => (
                  <React.Fragment key={k}>
                    <dt className="text-muted">{k}</dt>
                    <dd className="font-medium">{v}</dd>
                  </React.Fragment>
                ))}
              </dl>
              {watch.notes && (
                <>
                  <p className="mb-1 mt-4 text-sm font-semibold">Notes</p>
                  <p className="text-sm text-muted">{watch.notes}</p>
                </>
              )}
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
