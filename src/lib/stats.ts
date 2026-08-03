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
  /**
   * Conditions the watch was kept in *during* this interval. These come from
   * the earlier measurement — the state you recorded when you set the watch
   * down is what governs how it ran until you picked it up again.
   */
  worn: boolean;
  position?: string;
  temperatureC?: number;
  powerReservePct?: number;
}

export interface WatchStats {
  /** measurements recorded, including any excluded from rate analysis */
  count: number;
  /**
   * Measurements that actually contribute to the rate. Time corrections and
   * stopped-watch intervals produce no sample, so this is what grading must
   * wait on — ten readings that are nine resets are still one data point.
   */
  gradableCount: number;
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
  /**
   * Spread after positional/wear differences are removed. This is what
   * "unstable" should mean — raw variance also contains the watch's normal
   * dial-up vs crown-down delta. Falls back to raw σ when conditions
   * aren't recorded consistently enough to separate them.
   */
  adjustedStdDev: number | null;
  adjustedVariance: number | null;
  conditions: ConditionAnalysis | null;
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
  /** intervals not counted as drift (time corrections, stopped watch) */
  excluded: ExcludedSample[];
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

/**
 * Any implied rate beyond this is not timekeeping — it is a watch that was
 * reset, stopped, or a mistyped reading. Five minutes a day is already far
 * past "broken" for any movement.
 */
export const IMPLAUSIBLE_SPD = 300;

export interface ExcludedSample {
  date: string;
  spd: number;
  reason: "time-corrected" | "implausible";
}

/** Intervals that were not counted as drift, with why. */
export function excludedSamples(measurements: Measurement[]): ExcludedSample[] {
  const ms = [...measurements].sort(
    (a, b) => +new Date(a.measuredAt) - +new Date(b.measuredAt)
  );
  const out: ExcludedSample[] = [];
  for (let i = 1; i < ms.length; i++) {
    const gapMs = +new Date(ms[i].measuredAt) - +new Date(ms[i - 1].measuredAt);
    if (gapMs < 3_600_000) continue;
    const spd = (ms[i].offsetSeconds - ms[i - 1].offsetSeconds) / (gapMs / DAY_MS);
    if (ms[i].timeAdjusted) out.push({ date: ms[i].measuredAt, spd, reason: "time-corrected" });
    else if (Math.abs(spd) > IMPLAUSIBLE_SPD)
      out.push({ date: ms[i].measuredAt, spd, reason: "implausible" });
  }
  return out;
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

    // The watch was corrected across this gap: the offset change is the
    // correction the user made, not how the movement ran. No rate here.
    if (cur.timeAdjusted) continue;

    const gapDays = gapMs / DAY_MS;
    const spd = (cur.offsetSeconds - prev.offsetSeconds) / gapDays;
    // Safety net for history recorded before corrections could be flagged:
    // a reset or a stopped watch masquerades as an enormous rate.
    if (Math.abs(spd) > IMPLAUSIBLE_SPD) continue;

    out.push({
      date: cur.measuredAt,
      spd,
      offset: cur.offsetSeconds,
      gapHours: gapMs / 3_600_000,
      // conditions during the interval = how the watch was left at its start
      worn: prev.wornToday,
      position: prev.wornToday ? "on-wrist" : prev.position,
      temperatureC: prev.temperatureC,
      powerReservePct: prev.powerReservePct,
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

// ─── Condition-aware analysis ───────────────────────────────────────────────
// A mechanical watch does not have one rate — it has a rate per position, and
// another when worn. Averaging those together inflates "variance" with what is
// really normal positional behaviour. These helpers separate the two:
//   • within-condition spread  → genuine instability (what stability should use)
//   • between-condition spread → positional delta (an expected characteristic)

export const CONDITION_LABELS: Record<string, string> = {
  "on-wrist": "Worn",
  "dial-up": "Dial up",
  "dial-down": "Dial down",
  "crown-up": "Crown up",
  "crown-down": "Crown down",
  "crown-left": "Crown left",
  "crown-right": "Crown right",
  unknown: "Unrecorded",
};

export interface ConditionGroup {
  key: string;
  label: string;
  n: number;
  mean: number;
  sd: number;
  worn: boolean;
}

export interface ConditionAnalysis {
  groups: ConditionGroup[];
  /** pooled within-condition σ — instability with positional effects removed */
  withinSd: number;
  withinVariance: number;
  /** spread between condition means — the watch's positional delta */
  betweenSpread: number;
  /** share of total variance explained by condition alone (0–1) */
  explained: number;
  /** enough samples per condition to trust the split */
  reliable: boolean;
  /** each sample's deviation from its own condition's mean */
  residuals: { date: string; value: number }[];
}

const conditionKey = (s: RateSample): string =>
  s.worn ? "on-wrist" : (s.position ?? "unknown");

/** Minimum samples in a condition before its mean is trusted. */
const MIN_PER_CONDITION = 3;

export function analyzeConditions(samples: RateSample[]): ConditionAnalysis | null {
  if (samples.length < 2) return null;

  const buckets = new Map<string, RateSample[]>();
  for (const s of samples) {
    const k = conditionKey(s);
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k)!.push(s);
  }

  const groups: ConditionGroup[] = [...buckets.entries()]
    .map(([key, xs]) => ({
      key,
      label: CONDITION_LABELS[key] ?? key,
      n: xs.length,
      mean: mean(xs.map((x) => x.spd)),
      sd: xs.length >= 2 ? stdDev(xs.map((x) => x.spd)) : 0,
      worn: xs[0].worn,
    }))
    .sort((a, b) => b.n - a.n);

  const trusted = groups.filter((g) => g.n >= MIN_PER_CONDITION);
  const overall = mean(samples.map((s) => s.spd));
  const meanFor = (k: string) =>
    trusted.find((g) => g.key === k)?.mean ?? overall;

  // pooled within-condition variance
  let num = 0;
  let den = 0;
  for (const g of groups) {
    if (g.n < 2) continue;
    num += (g.n - 1) * g.sd ** 2;
    den += g.n - 1;
  }
  const withinVariance = den > 0 ? num / den : variance(samples.map((s) => s.spd));
  const totalVariance = variance(samples.map((s) => s.spd));

  const means = trusted.map((g) => g.mean);
  const betweenSpread = means.length >= 2 ? Math.max(...means) - Math.min(...means) : 0;

  return {
    groups,
    withinSd: Math.sqrt(withinVariance),
    withinVariance,
    betweenSpread,
    explained: totalVariance > 0 ? Math.max(0, Math.min(1, 1 - withinVariance / totalVariance)) : 0,
    reliable: trusted.length >= 2 && samples.length >= 8,
    residuals: samples.map((s) => ({
      date: s.date,
      value: s.spd - meanFor(conditionKey(s)),
    })),
  };
}

export function computeStats(measurements: Measurement[]): WatchStats {
  const ms = [...measurements].sort(
    (a, b) => +new Date(a.measuredAt) - +new Date(b.measuredAt)
  );
  const samples = rateSamples(ms);
  const last = ms[ms.length - 1] ?? null;

  const empty: WatchStats = {
    count: ms.length,
    gradableCount: samples.length ? samples.length + 1 : 0,
    currentOffset: last ? last.offsetSeconds : null,
    lastMeasuredAt: last ? last.measuredAt : null,
    todayRate: null, avgSpd: null, medianSpd: null, maxGain: null, maxLoss: null,
    stdDev: null, variance: null, adjustedStdDev: null, adjustedVariance: null,
    conditions: null, weeklyVariance: null, monthlyVariance: null,
    rolling7: null, rolling30: null, driftTrend: null, accuracyTrend: null,
    performanceScore: null, stabilityScore: null, consistencyIndex: null,
    confidence95: null, predicted: null, stabilityPct: null, wearRatio: null,
    samples,
    excluded: excludedSamples(measurements),
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

  const conditions = analyzeConditions(samples);
  // Instability is the spread *within* a condition; positional delta is normal.
  const effectiveSd = conditions?.reliable ? conditions.withinSd : sd;

  // Scores. Performance: |avg| of 0 → 100, 30 s/d → 0 (log-ish curve).
  const perf = Math.max(0, Math.min(100, 100 * (1 - Math.log10(1 + Math.abs(avg) * 3) / Math.log10(91))));
  // Stability: σ of 0 → 100, 10 s/d → 0 — measured within condition.
  const stab = Math.max(0, Math.min(100, 100 * (1 - Math.log10(1 + effectiveSd * 2) / Math.log10(21))));
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
    adjustedStdDev: effectiveSd,
    adjustedVariance: effectiveSd ** 2,
    conditions,
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
    wearRatio: samples.filter((s) => s.worn).length / samples.length,
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

/**
 * Detect whether the recent window drifted outside historical behaviour.
 *
 * Compares condition-adjusted residuals, so a week spent resting crown-down
 * (which legitimately runs at a different rate) does not register as drift.
 * Only a change relative to how the watch normally behaves *in that same
 * condition* counts. Requires a real evidence base before firing.
 */
export function detectAnomaly(samples: RateSample[]): {
  drifting: boolean;
  zScore: number;
  recentAvg: number;
  baselineAvg: number;
  conditionAdjusted: boolean;
} | null {
  if (samples.length < 14) return null;
  const recent = samplesInWindow(samples, 7);
  const endRecent = +new Date(samples[samples.length - 1].date) - 7 * DAY_MS;
  const baseline = samples.filter((s) => +new Date(s.date) <= endRecent);
  if (recent.length < 3 || baseline.length < 7) return null;

  const cond = analyzeConditions(samples);
  const adjusted = !!cond?.reliable;

  // Work on residuals when conditions are known, raw rates otherwise.
  const valueOf = (() => {
    if (!adjusted) return (s: RateSample) => s.spd;
    const byDate = new Map(cond!.residuals.map((r) => [r.date, r.value]));
    return (s: RateSample) => byDate.get(s.date) ?? s.spd;
  })();

  const bVals = baseline.map(valueOf);
  const rVals = recent.map(valueOf);
  const bSd = stdDev(bVals);
  const z = bSd === 0 ? 0 : (mean(rVals) - mean(bVals)) / bSd;

  // Report raw rates — they are what the user recognises — but judge on residuals.
  return {
    drifting: Math.abs(z) > 2,
    zScore: z,
    recentAvg: mean(recent.map((s) => s.spd)),
    baselineAvg: mean(baseline.map((s) => s.spd)),
    conditionAdjusted: adjusted,
  };
}

export const fmtSpd = (v: number | null | undefined, digits = 1): string =>
  v == null ? "—" : `${v > 0 ? "+" : ""}${v.toFixed(digits)} s/d`;

export const fmtSec = (v: number | null | undefined, digits = 1): string =>
  v == null ? "—" : `${v > 0 ? "+" : ""}${v.toFixed(digits)}s`;
