// ─── WatchKeeper statistics engine ───────────────────────────────────────────
// All rate math works on "daily rate" samples: the change in offset between two
// consecutive measurements, normalized to seconds/day.

import type { Measurement } from "./types";

export interface RateSample {
  /** ISO date of the later measurement */
  date: string;
  /** seconds per day (+ = gaining) */
  spd: number;
  /** raw offset at this point, seconds */
  offset: number;
  /** hours between the two measurements */
  gapHours: number;
  wornToday: boolean;
  position?: string;
  temperatureC?: number;
}

export interface WatchStats {
  count: number;
  currentOffset: number | null;
  lastMeasuredAt: string | null;
  /** most recent daily rate sample */
  todayRate: number | null;
  avgSpd: number | null;
  medianSpd: number | null;
  maxGain: number | null;
  maxLoss: number | null;
  stdDev: number | null;
  variance: number | null;
  weeklyVariance: number | null;
  monthlyVariance: number | null;
  rolling7: number | null;
  rolling30: number | null;
  /** slope of spd over time, sec/day per day. + = rate increasing */
  driftTrend: number | null;
  /** slope of |spd| over time — accuracy getting better (<0) or worse (>0) */
  accuracyTrend: number | null;
  /** 0-100 — closeness to ±0 s/d */
  performanceScore: number | null;
  /** 0-100 — consistency of the rate */
  stabilityScore: number | null;
  /** 0-100 (1 = perfectly consistent) */
  consistencyIndex: number | null;
  /** 95% confidence interval around avg spd */
  confidence95: [number, number] | null;
  /** predicted total deviation from today's offset after N days */
  predicted: { d7: number; d14: number; d30: number; d90: number } | null;
  /** ratio of samples within 1 stddev of mean */
  stabilityPct: number | null;
  wearRatio: number | null;
  samples: RateSample[];
}

const DAY_MS = 86_400_000;

export function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

export function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function variance(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - 1);
}

export function stdDev(xs: number[]): number {
  return Math.sqrt(variance(xs));
}

/** least-squares slope of y over x (x in days) */
export function slope(points: { x: number; y: number }[]): number {
  if (points.length < 2) return 0;
  const mx = mean(points.map((p) => p.x));
  const my = mean(points.map((p) => p.y));
  let num = 0;
  let den = 0;
  for (const p of points) {
    num += (p.x - mx) * (p.y - my);
    den += (p.x - mx) ** 2;
  }
  return den === 0 ? 0 : num / den;
}

/** Convert consecutive measurements into normalized seconds/day samples. */
export function rateSamples(measurements: Measurement[]): RateSample[] {
  const ms = [...measurements].sort(
    (a, b) => +new Date(a.measuredAt) - +new Date(b.measuredAt)
  );
  const out: RateSample[] = [];
  for (let i = 1; i < ms.length; i++) {
    const prev = ms[i - 1];
    const cur = ms[i];
    const gapMs = +new Date(cur.measuredAt) - +new Date(prev.measuredAt);
    if (gapMs < 3_600_000) continue; // ignore gaps under 1 hour (noise)
    const gapDays = gapMs / DAY_MS;
    out.push({
      date: cur.measuredAt,
      spd: (cur.offsetSeconds - prev.offsetSeconds) / gapDays,
      offset: cur.offsetSeconds,
      gapHours: gapMs / 3_600_000,
      wornToday: cur.wornToday,
      position: cur.position,
      temperatureC: cur.temperatureC,
    });
  }
  return out;
}

function samplesInWindow(samples: RateSample[], days: number, endMs?: number): RateSample[] {
  const end = endMs ?? (samples.length ? +new Date(samples[samples.length - 1].date) : Date.now());
  const start = end - days * DAY_MS;
  return samples.filter((s) => +new Date(s.date) > start && +new Date(s.date) <= end);
}

export function rollingAverage(samples: RateSample[], windowDays: number): { date: string; value: number }[] {
  return samples.map((s) => {
    const end = +new Date(s.date);
    const win = samples.filter(
      (x) => +new Date(x.date) > end - windowDays * DAY_MS && +new Date(x.date) <= end
    );
    return { date: s.date, value: mean(win.map((w) => w.spd)) };
  });
}

export function computeStats(measurements: Measurement[]): WatchStats {
  const ms = [...measurements].sort(
    (a, b) => +new Date(a.measuredAt) - +new Date(b.measuredAt)
  );
  const samples = rateSamples(ms);
  const last = ms[ms.length - 1] ?? null;

  const empty: WatchStats = {
    count: ms.length,
    currentOffset: last ? last.offsetSeconds : null,
    lastMeasuredAt: last ? last.measuredAt : null,
    todayRate: null, avgSpd: null, medianSpd: null, maxGain: null, maxLoss: null,
    stdDev: null, variance: null, weeklyVariance: null, monthlyVariance: null,
    rolling7: null, rolling30: null, driftTrend: null, accuracyTrend: null,
    performanceScore: null, stabilityScore: null, consistencyIndex: null,
    confidence95: null, predicted: null, stabilityPct: null, wearRatio: null,
    samples,
  };
  if (samples.length === 0) return empty;

  const spds = samples.map((s) => s.spd);
  const avg = mean(spds);
  const sd = stdDev(spds);
  const t0 = +new Date(samples[0].date);
  const pts = samples.map((s) => ({ x: (+new Date(s.date) - t0) / DAY_MS, y: s.spd }));
  const absPts = samples.map((s) => ({ x: (+new Date(s.date) - t0) / DAY_MS, y: Math.abs(s.spd) }));

  const w7 = samplesInWindow(samples, 7);
  const w30 = samplesInWindow(samples, 30);

  // Scores. Performance: |avg| of 0 → 100, 30 s/d → 0 (log-ish curve).
  const perf = Math.max(0, Math.min(100, 100 * (1 - Math.log10(1 + Math.abs(avg) * 3) / Math.log10(91))));
  // Stability: sd of 0 → 100, 10 s/d → 0.
  const stab = Math.max(0, Math.min(100, 100 * (1 - Math.log10(1 + sd * 2) / Math.log10(21))));
  const within1sd = sd === 0 ? 1 : spds.filter((x) => Math.abs(x - avg) <= sd).length / spds.length;

  const se = sd / Math.sqrt(spds.length);
  const rate = w7.length >= 2 ? mean(w7.map((s) => s.spd)) : avg;
  const off = last!.offsetSeconds;

  return {
    ...empty,
    todayRate: samples[samples.length - 1].spd,
    avgSpd: avg,
    medianSpd: median(spds),
    maxGain: Math.max(...spds),
    maxLoss: Math.min(...spds),
    stdDev: sd,
    variance: variance(spds),
    weeklyVariance: w7.length >= 2 ? variance(w7.map((s) => s.spd)) : null,
    monthlyVariance: w30.length >= 2 ? variance(w30.map((s) => s.spd)) : null,
    rolling7: w7.length ? mean(w7.map((s) => s.spd)) : null,
    rolling30: w30.length ? mean(w30.map((s) => s.spd)) : null,
    driftTrend: slope(pts),
    accuracyTrend: slope(absPts),
    performanceScore: perf,
    stabilityScore: stab,
    consistencyIndex: Math.round(within1sd * 100),
    confidence95: [avg - 1.96 * se, avg + 1.96 * se],
    predicted: {
      d7: off + rate * 7,
      d14: off + rate * 14,
      d30: off + rate * 30,
      d90: off + rate * 90,
    },
    stabilityPct: within1sd * 100,
    wearRatio: samples.filter((s) => s.wornToday).length / samples.length,
    samples,
  };
}

// ─── Aggregations for charts & reports ──────────────────────────────────────

export interface PeriodStat {
  key: string;       // e.g. "2026-W12" or "2026-03"
  label: string;
  avgSpd: number;
  variance: number;
  stdDev: number;
  min: number;
  max: number;
  count: number;
}

export function isoWeekKey(d: Date): string {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((+date - +yearStart) / DAY_MS + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export function groupByPeriod(
  samples: RateSample[],
  period: "week" | "month"
): PeriodStat[] {
  const buckets = new Map<string, RateSample[]>();
  for (const s of samples) {
    const d = new Date(s.date);
    const key =
      period === "week"
        ? isoWeekKey(d)
        : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(s);
  }
  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, xs]) => {
      const spds = xs.map((x) => x.spd);
      return {
        key,
        label: key,
        avgSpd: mean(spds),
        variance: variance(spds),
        stdDev: stdDev(spds),
        min: Math.min(...spds),
        max: Math.max(...spds),
        count: xs.length,
      };
    });
}

/** Detect whether the recent window drifted outside historical behavior. */
export function detectAnomaly(samples: RateSample[]): {
  drifting: boolean;
  zScore: number;
  recentAvg: number;
  baselineAvg: number;
} | null {
  if (samples.length < 14) return null;
  const recent = samplesInWindow(samples, 7);
  const endRecent = +new Date(samples[samples.length - 1].date) - 7 * DAY_MS;
  const baseline = samples.filter((s) => +new Date(s.date) <= endRecent);
  if (recent.length < 3 || baseline.length < 7) return null;
  const bAvg = mean(baseline.map((s) => s.spd));
  const bSd = stdDev(baseline.map((s) => s.spd));
  const rAvg = mean(recent.map((s) => s.spd));
  const z = bSd === 0 ? 0 : (rAvg - bAvg) / bSd;
  return { drifting: Math.abs(z) > 1.5, zScore: z, recentAvg: rAvg, baselineAvg: bAvg };
}

export const fmtSpd = (v: number | null | undefined, digits = 1): string =>
  v == null ? "—" : `${v > 0 ? "+" : ""}${v.toFixed(digits)} s/d`;

export const fmtSec = (v: number | null | undefined, digits = 1): string =>
  v == null ? "—" : `${v > 0 ? "+" : ""}${v.toFixed(digits)}s`;
