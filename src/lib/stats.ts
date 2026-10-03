// ─── WatchKeeper statistics engine ───────────────────────────────────────────
// All rate math works on "daily rate" samples: the change in offset between two
// consecutive measurements, normalized to seconds/day.

import type { Measurement, RestingHandling } from "./types";

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
   * Spread after positional/wear differences are removed, measured robustly
   * so that a few contaminated intervals cannot masquerade as an unstable
   * movement. This is what "unstable" should mean — raw variance also
   * contains the watch's normal dial-up vs crown-down delta, and any reading
   * that spanned a stoppage.
   */
  adjustedStdDev: number | null;
  adjustedVariance: number | null;
  /** readings sitting far outside the robust scatter — likely bad data */
  outliers: { date: string; spd: number }[];
  conditions: ConditionAnalysis | null;
  weeklyVariance: number | null;
  monthlyVariance: number | null;
  rolling7: number | null;
  rolling30: number | null;
  /** slope of spd over time, sec/day per day. + = rate increasing */
  driftTrend: number | null;
  /** the same trend expressed per 30 days, signed */
  driftPerMonth: number | null;
  /** whether that trend stands out from the scatter (|t| ≥ 2) */
  driftSignificant: boolean;
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
  /** ± uncertainty on the average rate, s/d — how sharp that figure really is */
  avgSpdError: number | null;
  /** predicted total deviation from today's offset after N days */
  predicted: { d7: number; d14: number; d30: number; d90: number } | null;
  /** ratio of samples within 1 stddev of mean */
  stabilityPct: number | null;
  wearRatio: number | null;
  /** every valid sample — charts and the position breakdown use all of them */
  samples: RateSample[];
  /** the subset the headline figures above were calculated from */
  headlineSamples: RateSample[];
  /** whether the headline used worn intervals only, and why */
  headlineBasis: "all" | "worn-only";
  /** mean rate on the wrist and at rest, when there is enough of each */
  wornRate: number | null;
  restingRate: number | null;
  restingCount: number;
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

/**
 * Scatter that a few bad readings cannot dominate.
 *
 * Standard deviation squares every deviation, so one interval spanning a
 * stopped watch drags it up by more than twenty ordinary readings pull it
 * down — four contaminated readings in thirty take σ from ±10 to ±70. The
 * median absolute deviation ignores the tails entirely; the 1.4826 factor
 * rescales it to agree with σ on clean, normally-distributed data.
 */
export function robustScatter(xs: number[]): number {
  if (xs.length < 3) return stdDev(xs);
  const centre = median(xs);
  return 1.4826 * median(xs.map((x) => Math.abs(x - centre)));
}

export interface TrendFit {
  /** least-squares slope, y-units per day */
  slope: number;
  /** standard error of that slope */
  stdError: number;
  /** slope ÷ its own error; |t| ≥ 2 is roughly the 95% mark */
  t: number;
}

/**
 * Fit a trend *and* say how much to believe it.
 *
 * A slope on its own is meaningless without knowing how noisy the data was:
 * scatter of ±60 s/d will throw up an apparent trend of half a second per day
 * out of pure randomness. Comparing the slope to its own standard error is the
 * difference between "this watch is drifting" and "these readings are noisy".
 */
export function fitTrend(points: { x: number; y: number }[]): TrendFit {
  const n = points.length;
  if (n < 3) return { slope: 0, stdError: Infinity, t: 0 };
  const mx = mean(points.map((p) => p.x));
  const my = mean(points.map((p) => p.y));
  let sxx = 0;
  let sxy = 0;
  for (const p of points) {
    sxx += (p.x - mx) ** 2;
    sxy += (p.x - mx) * (p.y - my);
  }
  if (sxx === 0) return { slope: 0, stdError: Infinity, t: 0 };
  const b = sxy / sxx;
  const intercept = my - b * mx;
  let sse = 0;
  for (const p of points) sse += (p.y - (intercept + b * p.x)) ** 2;
  const stdError = Math.sqrt(sse / (n - 2) / sxx);
  return { slope: b, stdError, t: stdError > 0 ? b / stdError : 0 };
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

/**
 * How precisely a single dial reading can be taken, in seconds. Reading a
 * seconds hand against a clock is good to roughly half a second; two readings
 * make an interval, so their errors combine.
 */
export const READING_ERROR_S = 0.5;
const INTERVAL_ERROR_S = READING_ERROR_S * Math.SQRT2;

/**
 * Uncertainty in a rate, in s/d, from reading error alone.
 *
 * The same half-second of imprecision becomes ±1.2 s/d over a fourteen-hour
 * gap and ±0.14 s/d over a week — which is why a chart of overnight readings
 * looks so much jumpier than one built from weekly checks, with no change in
 * the watch whatsoever.
 */
export function rateUncertainty(gapDays: number): number {
  return gapDays > 0 ? INTERVAL_ERROR_S / gapDays : Infinity;
}

export interface ExcludedSample {
  date: string;
  spd: number;
  reason: "time-corrected" | "implausible" | "ran-down" | "excluded-by-you";
}

/**
 * Did the mainspring run out during this interval?
 *
 * A watch left unworn for longer than its power reserve stops. Long before it
 * stops, falling torque drops the balance amplitude and the watch runs
 * progressively slower. Either way the interval measures a watch that wasn't
 * running properly, not the rate of a healthy movement — so it is no more a
 * timekeeping reading than a manual correction is.
 */
function ranDown(
  prev: Measurement,
  gapHours: number,
  powerReserveHours?: number
): boolean {
  if (!powerReserveHours || prev.wornToday) return false;
  // reserve remaining when it was set down, if recorded
  const remaining =
    prev.powerReservePct != null
      ? powerReserveHours * (prev.powerReservePct / 100)
      : powerReserveHours;
  return gapHours > remaining;
}

/** Intervals that were not counted as drift, with why. */
export function excludedSamples(
  measurements: Measurement[],
  powerReserveHours?: number
): ExcludedSample[] {
  const ms = [...measurements].sort(
    (a, b) => +new Date(a.measuredAt) - +new Date(b.measuredAt)
  );
  const out: ExcludedSample[] = [];
  for (let i = 1; i < ms.length; i++) {
    const gapMs = +new Date(ms[i].measuredAt) - +new Date(ms[i - 1].measuredAt);
    if (gapMs < 3_600_000) continue;
    const spd = (ms[i].offsetSeconds - ms[i - 1].offsetSeconds) / (gapMs / DAY_MS);
    if (ms[i].excludeFromRate) out.push({ date: ms[i].measuredAt, spd, reason: "excluded-by-you" });
    else if (ms[i].timeAdjusted) out.push({ date: ms[i].measuredAt, spd, reason: "time-corrected" });
    else if (Math.abs(spd) > IMPLAUSIBLE_SPD)
      out.push({ date: ms[i].measuredAt, spd, reason: "implausible" });
    else if (ranDown(ms[i - 1], gapMs / 3_600_000, powerReserveHours))
      out.push({ date: ms[i].measuredAt, spd, reason: "ran-down" });
  }
  return out;
}

/** Convert consecutive measurements into normalized seconds/day samples. */
export function rateSamples(
  measurements: Measurement[],
  powerReserveHours?: number
): RateSample[] {
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
    // You told us this period isn't representative.
    if (cur.excludeFromRate) continue;

    const gapDays = gapMs / DAY_MS;
    const spd = (cur.offsetSeconds - prev.offsetSeconds) / gapDays;
    // Safety net for history recorded before corrections could be flagged:
    // a reset or a stopped watch masquerades as an enormous rate.
    if (Math.abs(spd) > IMPLAUSIBLE_SPD) continue;
    // The mainspring ran out somewhere in here — not a rate.
    if (ranDown(prev, gapMs / 3_600_000, powerReserveHours)) continue;

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

/** Worn samples needed before the headline can safely ignore resting ones. */
const MIN_WORN_FOR_SPLIT = 5;

export function computeStats(
  measurements: Measurement[],
  opts: {
    /** the watch's rated reserve, so wound-down intervals can be spotted */
    powerReserveHours?: number;
    /** how resting (overnight) intervals feed the headline figures */
    restingReadings?: RestingHandling;
  } = {}
): WatchStats {
  const { powerReserveHours, restingReadings = "separate" } = opts;
  const ms = [...measurements].sort(
    (a, b) => +new Date(a.measuredAt) - +new Date(b.measuredAt)
  );
  const samples = rateSamples(ms, powerReserveHours);
  const last = ms[ms.length - 1] ?? null;

  // Split wrist time from rest. Keeping resting readings out of the headline
  // only makes sense when enough worn intervals remain to say anything — for
  // someone who only ever measures overnight, everything still counts.
  const wornSamples = samples.filter((s) => s.worn);
  const restingSamples = samples.filter((s) => !s.worn);
  const splitWanted = restingReadings !== "include";
  const canSplit = splitWanted && wornSamples.length >= MIN_WORN_FOR_SPLIT;
  const headlineSamples = canSplit ? wornSamples : samples;
  const headlineBasis: "all" | "worn-only" = canSplit ? "worn-only" : "all";

  const empty: WatchStats = {
    count: ms.length,
    gradableCount: samples.length ? samples.length + 1 : 0,
    currentOffset: last ? last.offsetSeconds : null,
    lastMeasuredAt: last ? last.measuredAt : null,
    todayRate: null, avgSpd: null, medianSpd: null, maxGain: null, maxLoss: null,
    stdDev: null, variance: null, adjustedStdDev: null, adjustedVariance: null,
    outliers: [],
    conditions: null, weeklyVariance: null, monthlyVariance: null,
    rolling7: null, rolling30: null, driftTrend: null,
    driftPerMonth: null, driftSignificant: false, accuracyTrend: null,
    performanceScore: null, stabilityScore: null, consistencyIndex: null,
    confidence95: null, avgSpdError: null, predicted: null,
    stabilityPct: null, wearRatio: null,
    samples,
    headlineSamples,
    headlineBasis,
    wornRate: wornSamples.length >= 3 ? mean(wornSamples.map((s) => s.spd)) : null,
    restingRate: restingSamples.length >= 3 ? mean(restingSamples.map((s) => s.spd)) : null,
    restingCount: restingSamples.length,
    excluded: excludedSamples(measurements, powerReserveHours),
  };
  if (headlineSamples.length === 0) return empty;

  // Everything below describes the headline set. Charts and the position
  // breakdown still read `samples`, so no reading disappears from view.
  const spds = headlineSamples.map((s) => s.spd);

  // Weight each reading by how precisely it could be measured. A rate taken
  // over an hour carries far more reading error than one taken over a week,
  // so treating them as equal lets the noisiest readings pull the average
  // around. Weights are capped so a single very long interval cannot become
  // the only reading that counts.
  const rawWeights = headlineSamples.map((s) => {
    const u = rateUncertainty(s.gapHours / 24);
    return Number.isFinite(u) && u > 0 ? 1 / (u * u) : 0;
  });
  const medianWeight = median(rawWeights.filter((w) => w > 0)) || 1;
  const weights = rawWeights.map((w) => Math.min(w, medianWeight * 20));
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  const avg =
    totalWeight > 0
      ? spds.reduce((a, x, i) => a + x * weights[i], 0) / totalWeight
      : mean(spds);
  const sd = stdDev(spds);
  // Uncertainty of that weighted average from reading error alone.
  const avgSpdError = totalWeight > 0 ? Math.sqrt(1 / totalWeight) : null;
  const t0 = +new Date(headlineSamples[0].date);
  const pts = headlineSamples.map((s) => ({ x: (+new Date(s.date) - t0) / DAY_MS, y: s.spd }));
  const absPts = headlineSamples.map((s) => ({ x: (+new Date(s.date) - t0) / DAY_MS, y: Math.abs(s.spd) }));

  const w7 = samplesInWindow(headlineSamples, 7);
  const w30 = samplesInWindow(headlineSamples, 30);
  const driftFit = fitTrend(pts);

  // The breakdown reads every sample — resting positions are the whole point
  // of that card — while stability judges only the headline set.
  const conditions = analyzeConditions(samples);

  // Deviation of each headline reading from what it should be: its own
  // position's mean where positions are known, otherwise the overall mean.
  // A worn-only headline is already a single condition.
  const residualByDate =
    headlineBasis === "worn-only" || !conditions?.reliable
      ? null
      : new Map(conditions.residuals.map((r) => [r.date, r.value]));
  const deviations = headlineSamples.map(
    (s) => residualByDate?.get(s.date) ?? s.spd - avg
  );

  // Instability measured robustly, so a stopped watch or an unflagged reset
  // cannot pass itself off as a movement that scatters.
  const effectiveSd = robustScatter(deviations);

  // Readings far outside that scatter are almost certainly bad data rather
  // than the movement misbehaving — surfaced so they can be checked. Hunted
  // across every sample, not just the headline set: a suspect reading is worth
  // knowing about whether the watch was on a wrist or a nightstand.
  const allResiduals = conditions?.reliable
    ? new Map(conditions.residuals.map((r) => [r.date, r.value]))
    : null;
  const allDeviations = samples.map(
    (s) => allResiduals?.get(s.date) ?? s.spd - mean(samples.map((x) => x.spd))
  );
  // Four times the robust scatter, but never less than 15 s/d — the point is
  // to catch stoppages and resets, not to nag about a good watch having a
  // slightly odd day.
  const outlierScale = robustScatter(allDeviations);
  const outlierCut = Math.max(outlierScale * 4, 15);
  const outliers = samples
    .map((s, i) => ({ date: s.date, spd: s.spd, dev: Math.abs(allDeviations[i]) }))
    .filter((o) => o.dev > outlierCut)
    .map(({ date, spd }) => ({ date, spd }));

  // Scores. Performance: |avg| of 0 → 100, 30 s/d → 0 (log-ish curve).
  const perf = Math.max(0, Math.min(100, 100 * (1 - Math.log10(1 + Math.abs(avg) * 3) / Math.log10(91))));
  // Stability: σ of 0 → 100, 10 s/d → 0 — measured within condition.
  const stab = Math.max(0, Math.min(100, 100 * (1 - Math.log10(1 + effectiveSd * 2) / Math.log10(21))));
  // Consistency: the share of readings that behave. Measuring "within one
  // standard deviation" scored ~68% for any well-behaved data by definition,
  // so it said the same thing about every watch. Against the robust scatter
  // instead, clean data scores ~95% and a set with erratic readings drops.
  const consistent =
    effectiveSd === 0
      ? 1
      : deviations.filter((d) => Math.abs(d) <= effectiveSd * 2).length / deviations.length;

  const se = sd / Math.sqrt(spds.length);
  const rate = w7.length >= 2 ? mean(w7.map((s) => s.spd)) : avg;
  const off = last!.offsetSeconds;

  return {
    ...empty,
    todayRate: headlineSamples[headlineSamples.length - 1].spd,
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
    driftTrend: driftFit.slope,
    driftPerMonth: driftFit.slope * 30,
    // Only believe a trend that stands clear of the scatter it was fitted
    // through — noisy readings throw up apparent trends by themselves.
    driftSignificant: Math.abs(driftFit.t) >= 2 && headlineSamples.length >= 10,
    accuracyTrend: slope(absPts),
    outliers,
    performanceScore: perf,
    stabilityScore: stab,
    consistencyIndex: Math.round(consistent * 100),
    // Widen the interval by the reading error as well as the spread, so it
    // reflects both how much the watch varies and how well it was measured.
    confidence95: [
      avg - 1.96 * Math.hypot(se, avgSpdError ?? 0),
      avg + 1.96 * Math.hypot(se, avgSpdError ?? 0),
    ],
    avgSpdError,
    predicted: {
      d7: off + rate * 7,
      d14: off + rate * 14,
      d30: off + rate * 30,
      d90: off + rate * 90,
    },
    stabilityPct: consistent * 100,
    wearRatio: samples.filter((s) => s.worn).length / samples.length,
    samples,
  };
}

/**
 * Where the offset is likely to be N days after the last reading.
 *
 * The range has two parts. The average rate is itself uncertain, and that
 * error compounds every day (grows with d). And the watch does not run at its
 * average every day — its ordinary scatter accumulates like a random walk
 * (grows with √d). Leaving the second out, as an earlier version did, draws a
 * band far narrower than where the watch actually ends up.
 */
export function forecastOffsets(
  stats: WatchStats,
  days: number[] = [7, 14, 30, 60, 90]
): { date: string; predicted: number; lo: number; hi: number }[] {
  const rate = stats.rolling7 ?? stats.avgSpd ?? 0;
  const sd = stats.stdDev ?? 0;
  const n = Math.max(stats.headlineSamples.length, 2);
  const last = stats.lastMeasuredAt ? +new Date(stats.lastMeasuredAt) : Date.now();
  const off = stats.currentOffset ?? 0;
  return days.map((d) => {
    const centre = off + rate * d;
    const half = 1.96 * Math.hypot((sd / Math.sqrt(n)) * d, sd * Math.sqrt(d));
    return {
      date: new Date(last + d * DAY_MS).toISOString(),
      predicted: +centre.toFixed(1),
      lo: +(centre - half).toFixed(1),
      hi: +(centre + half).toFixed(1),
    };
  });
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
