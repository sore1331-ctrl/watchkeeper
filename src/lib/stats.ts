// ─── WatchKeeper statistics engine ───────────────────────────────────────────
// All rate math works on "daily rate" samples: the change in offset between two
// consecutive measurements, normalized to seconds/day.

import type { Measurement, MovementType, RestingHandling } from "./types";

export interface RateSample {
  /** ISO date of the later measurement */
  date: string;
  /** seconds per day (+ = gaining) */
  spd: number;
  /** raw offset at this point, seconds */
  offset: number;
  /** hours between the two measurements */
  gapHours: number;
  /** how well the offset change across the interval is known, seconds */
  errorS: number;
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
   * Measurements behind the headline figures — the ones a grade is actually
   * judged on. Time corrections and stopped-watch intervals produce no
   * sample, and resting intervals may be kept out of the headline, so this is
   * what grading must wait on, not the number of readings taken.
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
  /** whether that slope stands out from the scatter (|t| ≥ 2) */
  accuracyTrendSignificant: boolean;
  /**
   * Rate used to forecast the offset: everything the watch did over the last
   * 30 days, worn and resting, since that is what moves the hands.
   */
  forecastRate: number | null;
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
  /** share of elapsed time the watch was worn (0–1), over every interval */
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
 * Average rate over a set of intervals: seconds gained ÷ time elapsed.
 *
 * That is each interval's rate weighted by its length. A plain mean lets a
 * one-hour interval count as much as a four-day one, and weighting by length
 * squared (as an earlier version did) lets one long gap drown out a week of
 * daily readings. Only this version answers "how fast does it actually run".
 */
export function meanRate(samples: { spd: number; gapHours: number }[]): number {
  let gain = 0;
  let hours = 0;
  for (const s of samples) {
    gain += s.spd * s.gapHours;
    hours += s.gapHours;
  }
  return hours > 0 ? gain / hours : mean(samples.map((s) => s.spd));
}

/** Two-sided 95% Student-t critical value. 1.96 is only right for large samples. */
const T95 = [
  12.706, 4.303, 3.182, 2.776, 2.571, 2.447, 2.365, 2.306, 2.262, 2.228,
  2.201, 2.179, 2.16, 2.145, 2.131, 2.12, 2.11, 2.101, 2.093, 2.086,
  2.08, 2.074, 2.069, 2.064, 2.06, 2.056, 2.052, 2.048, 2.045, 2.042,
];
export function tCritical95(degreesOfFreedom: number): number {
  const df = Math.max(1, Math.floor(degreesOfFreedom));
  return df <= T95.length ? T95[df - 1] : 1.96 + 2.5 / df;
}

/**
 * Share of elapsed time the watch was worn (0–1). Every interval counts, by
 * its length — including those left out of the rate, which are mostly the
 * unworn ones. Counting only the intervals that survived made a watch worn a
 * fifth of the time read as worn all of it.
 */
export function wearShare(measurements: Measurement[], sinceMs = -Infinity): number | null {
  const ms = [...measurements].sort(
    (a, b) => +new Date(a.measuredAt) - +new Date(b.measuredAt)
  );
  let worn = 0;
  let total = 0;
  for (let i = 1; i < ms.length; i++) {
    const end = +new Date(ms[i].measuredAt);
    if (end <= sinceMs) continue;
    const gap = end - +new Date(ms[i - 1].measuredAt);
    total += gap;
    if (ms[i - 1].wornToday) worn += gap;
  }
  return total > 0 ? worn / total : null;
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
 * seconds hand against a clock is good to roughly half a second.
 */
export const READING_ERROR_S = 0.5;
/**
 * How far the reference itself may have moved between readings. The reference
 * is the device's clock, which is not checked against anything: a steady
 * offset cancels out of a rate, but the clock drifts and is re-synced between
 * readings, and half a second of that is ordinary. This is an assumption, not
 * a measurement.
 */
export const REFERENCE_ERROR_S = 0.5;
/**
 * The same, for a reading whose reference was checked against the server and
 * corrected: what is left is the precision of that check.
 */
export const CHECKED_REFERENCE_ERROR_S = 0.1;

/** How well one reading's offset is known: dial-reading error plus reference error. */
const readingError = (m: Measurement) =>
  Math.hypot(READING_ERROR_S, m.referenceChecked ? CHECKED_REFERENCE_ERROR_S : REFERENCE_ERROR_S);

// Each reading carries both errors; two readings make an interval.
const INTERVAL_ERROR_S = Math.hypot(READING_ERROR_S, REFERENCE_ERROR_S) * Math.SQRT2;

/**
 * Uncertainty in a rate, in s/d, from reading and reference error.
 *
 * The same second of imprecision across an interval becomes ±1.7 s/d over a fourteen-hour
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

/** What is known about the movement, for telling a wound-down interval from a rate. */
export interface RateOptions {
  /** the watch's rated reserve, hours */
  powerReserveHours?: number;
  movementType?: MovementType;
}

/**
 * Could the mainspring have run out during this interval?
 *
 * Only an automatic winds down for want of wearing: a hand-wound watch is
 * wound whether or not it is on a wrist, so "unworn for longer than the
 * reserve" says nothing about it. This only marks the interval as a
 * candidate — see classify() for the evidence it then has to show.
 */
function couldHaveRunDown(prev: Measurement, gapHours: number, opts: RateOptions): boolean {
  if (opts.movementType !== "automatic" || !opts.powerReserveHours || prev.wornToday) return false;
  // reserve remaining when it was set down, if recorded
  const remaining =
    prev.powerReservePct != null
      ? opts.powerReserveHours * (prev.powerReservePct / 100)
      : opts.powerReserveHours;
  return gapHours > remaining;
}

/** How far below its usual rate (s/d) an interval must run before "it wound down" is believed. */
const RUN_DOWN_MIN_LOSS = 5;

/**
 * Sort every interval into a rate sample or an exclusion, with the reason.
 *
 * A watch that actually stopped, or ran on a nearly empty spring, loses time
 * against its usual rate. So an interval is only set aside as "ran down" when
 * it both could have (see above) and visibly did: it ran clearly slower than
 * the watch's other intervals. Excluding on the possibility alone threw away
 * half the readings of a watch that was merely resting.
 */
function classify(
  measurements: Measurement[],
  opts: RateOptions = {}
): { samples: RateSample[]; excluded: ExcludedSample[] } {
  const ms = [...measurements].sort(
    (a, b) => +new Date(a.measuredAt) - +new Date(b.measuredAt)
  );
  const kept: { sample: RateSample; candidate: boolean }[] = [];
  const excluded: ExcludedSample[] = [];
  for (let i = 1; i < ms.length; i++) {
    const prev = ms[i - 1];
    const cur = ms[i];
    const gapMs = +new Date(cur.measuredAt) - +new Date(prev.measuredAt);
    if (gapMs < 3_600_000) continue; // ignore gaps under 1 hour (noise)
    const gapHours = gapMs / 3_600_000;
    const spd = (cur.offsetSeconds - prev.offsetSeconds) / (gapMs / DAY_MS);

    // You told us this period isn't representative.
    if (cur.excludeFromRate) {
      excluded.push({ date: cur.measuredAt, spd, reason: "excluded-by-you" });
      continue;
    }
    // The watch was corrected across this gap: the offset change is the
    // correction the user made, not how the movement ran. No rate here.
    if (cur.timeAdjusted) {
      excluded.push({ date: cur.measuredAt, spd, reason: "time-corrected" });
      continue;
    }
    // Safety net for history recorded before corrections could be flagged:
    // a reset or a stopped watch masquerades as an enormous rate.
    if (Math.abs(spd) > IMPLAUSIBLE_SPD) {
      excluded.push({ date: cur.measuredAt, spd, reason: "implausible" });
      continue;
    }

    kept.push({
      candidate: couldHaveRunDown(prev, gapHours, opts),
      sample: {
        date: cur.measuredAt,
        spd,
        offset: cur.offsetSeconds,
        gapHours,
        errorS: Math.hypot(readingError(prev), readingError(cur)),
        // conditions during the interval = how the watch was left at its start
        worn: prev.wornToday,
        position: prev.wornToday ? "on-wrist" : prev.position,
        temperatureC: prev.temperatureC,
        powerReservePct: prev.powerReservePct,
      },
    });
  }

  if (kept.some((k) => k.candidate)) {
    // "usual" is judged from the intervals not under suspicion, when there
    // are enough of them to say
    const clear = kept.filter((k) => !k.candidate).map((k) => k.sample.spd);
    const usual = clear.length >= 3 ? clear : kept.map((k) => k.sample.spd);
    const floor = median(usual) - Math.max(3 * robustScatter(usual), RUN_DOWN_MIN_LOSS);
    for (const k of kept) {
      k.candidate = k.candidate && k.sample.spd < floor;
      if (k.candidate)
        excluded.push({ date: k.sample.date, spd: k.sample.spd, reason: "ran-down" });
    }
  }

  return {
    // any still marked as candidates here are the ones that did run down
    samples: kept.filter((k) => !k.candidate).map((k) => k.sample),
    excluded: excluded.sort((a, b) => a.date.localeCompare(b.date)),
  };
}

/** Intervals that were not counted as drift, with why. */
export function excludedSamples(measurements: Measurement[], opts: RateOptions = {}): ExcludedSample[] {
  return classify(measurements, opts).excluded;
}

/** Convert consecutive measurements into normalized seconds/day samples. */
export function rateSamples(measurements: Measurement[], opts: RateOptions = {}): RateSample[] {
  return classify(measurements, opts).samples;
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
    return { date: s.date, value: meanRate(win) };
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
      mean: meanRate(xs),
      sd: xs.length >= 2 ? stdDev(xs.map((x) => x.spd)) : 0,
      worn: xs[0].worn,
    }))
    .sort((a, b) => b.n - a.n);

  const trusted = groups.filter((g) => g.n >= MIN_PER_CONDITION);
  const overall = meanRate(samples);
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

/**
 * Worn samples needed before the headline can safely ignore resting ones.
 * Six samples is seven measurements — the same bar a grade waits for, so a
 * worn-only headline is never graded on less than that.
 */
const MIN_WORN_FOR_SPLIT = 6;

export function computeStats(
  measurements: Measurement[],
  opts: {
    /** the watch's rated reserve, so wound-down intervals can be spotted */
    powerReserveHours?: number;
    /** only an automatic winds down for want of wearing */
    movementType?: MovementType;
    /** how resting (overnight) intervals feed the headline figures */
    restingReadings?: RestingHandling;
  } = {}
): WatchStats {
  const { powerReserveHours, movementType, restingReadings = "separate" } = opts;
  const ms = [...measurements].sort(
    (a, b) => +new Date(a.measuredAt) - +new Date(b.measuredAt)
  );
  const { samples, excluded } = classify(ms, { powerReserveHours, movementType });
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
    gradableCount: headlineSamples.length ? headlineSamples.length + 1 : 0,
    currentOffset: last ? last.offsetSeconds : null,
    lastMeasuredAt: last ? last.measuredAt : null,
    todayRate: null, avgSpd: null, medianSpd: null, maxGain: null, maxLoss: null,
    stdDev: null, variance: null, adjustedStdDev: null, adjustedVariance: null,
    outliers: [],
    conditions: null, weeklyVariance: null, monthlyVariance: null,
    rolling7: null, rolling30: null, driftTrend: null,
    driftPerMonth: null, driftSignificant: false, accuracyTrend: null,
    accuracyTrendSignificant: false, forecastRate: null,
    performanceScore: null, stabilityScore: null, consistencyIndex: null,
    confidence95: null, avgSpdError: null, predicted: null,
    stabilityPct: null, wearRatio: wearShare(ms),
    samples,
    headlineSamples,
    headlineBasis,
    wornRate: wornSamples.length >= 3 ? meanRate(wornSamples) : null,
    restingRate: restingSamples.length >= 3 ? meanRate(restingSamples) : null,
    restingCount: restingSamples.length,
    excluded,
  };
  if (headlineSamples.length === 0) return empty;

  // Everything below describes the headline set. Charts and the position
  // breakdown still read `samples`, so no reading disappears from view.
  const spds = headlineSamples.map((s) => s.spd);

  // Seconds gained ÷ time elapsed — see meanRate().
  const avg = meanRate(headlineSamples);
  const sd = stdDev(spds);
  // Uncertainty of that average from reading error alone: each interval's
  // gain is known to its own ±errorS (smaller where the reference was
  // checked), and the average is their sum over the total time.
  const totalDays = headlineSamples.reduce((a, s) => a + s.gapHours, 0) / 24;
  const avgSpdError =
    totalDays > 0
      ? Math.sqrt(headlineSamples.reduce((a, s) => a + s.errorS ** 2, 0)) / totalDays
      : null;
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

  // Standard error of a length-weighted mean: the scatter about it, over the
  // effective number of intervals (long ones count for more, so there are
  // effectively fewer of them than were taken).
  const sumW = headlineSamples.reduce((a, s) => a + s.gapHours, 0);
  const sumW2 = headlineSamples.reduce((a, s) => a + s.gapHours ** 2, 0);
  const nEff = sumW2 > 0 ? sumW ** 2 / sumW2 : spds.length;
  const n = spds.length;
  const weightedVar =
    n >= 2 && sumW > 0
      ? (headlineSamples.reduce((a, s) => a + s.gapHours * (s.spd - avg) ** 2, 0) / sumW) * (n / (n - 1))
      : 0;
  const se = Math.sqrt(weightedVar / nEff);
  // Student-t, not 1.96: with a handful of readings the interval is far wider.
  // One sample has no scatter to judge by, so no interval is claimed.
  const ciHalf = n >= 2 ? tCritical95(nEff - 1) * Math.hypot(se, avgSpdError ?? 0) : null;

  // The forecast asks where the hands will be, so it uses everything the
  // watch did recently — on the wrist and off it — not the worn-only headline.
  const recentAll = samplesInWindow(samples, 30);
  const forecastRate = meanRate(recentAll.length >= 2 ? recentAll : samples);
  const absFit = fitTrend(absPts);
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
    rolling7: w7.length ? meanRate(w7) : null,
    rolling30: w30.length ? meanRate(w30) : null,
    driftTrend: driftFit.slope,
    driftPerMonth: driftFit.slope * 30,
    // Only believe a trend that stands clear of the scatter it was fitted
    // through — noisy readings throw up apparent trends by themselves.
    driftSignificant: Math.abs(driftFit.t) >= 2 && headlineSamples.length >= 10,
    accuracyTrend: absFit.slope,
    accuracyTrendSignificant: Math.abs(absFit.t) >= 2 && headlineSamples.length >= 10,
    forecastRate,
    outliers,
    performanceScore: perf,
    stabilityScore: stab,
    consistencyIndex: Math.round(consistent * 100),
    // Widen the interval by the reading error as well as the spread, so it
    // reflects both how much the watch varies and how well it was measured.
    confidence95: ciHalf != null ? [avg - ciHalf, avg + ciHalf] : null,
    avgSpdError,
    predicted: {
      d7: off + forecastRate * 7,
      d14: off + forecastRate * 14,
      d30: off + forecastRate * 30,
      d90: off + forecastRate * 90,
    },
    stabilityPct: consistent * 100,
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
  // the same rate, and so the same centre line, as stats.predicted
  const rate = stats.forecastRate ?? stats.avgSpd ?? 0;
  const sd = stats.samples.length >= 2 ? stdDev(stats.samples.map((x) => x.spd)) : 0;
  const n = Math.max(stats.samples.length, 2);
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
        avgSpd: meanRate(xs),
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
    recentAvg: meanRate(recent),
    baselineAvg: meanRate(baseline),
    conditionAdjusted: adjusted,
  };
}

export const fmtSpd = (v: number | null | undefined, digits = 1): string =>
  v == null ? "—" : `${v > 0 ? "+" : ""}${v.toFixed(digits)} s/d`;

export const fmtSec = (v: number | null | undefined, digits = 1): string =>
  v == null ? "—" : `${v > 0 ? "+" : ""}${v.toFixed(digits)}s`;
