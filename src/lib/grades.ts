// ─── Accuracy grading & movement health scoring ─────────────────────────────

import type { AccuracyGrade, HealthLabel, MovementType, ServiceRecord, Watch } from "./types";
import type { WatchStats } from "./stats";
import { modelsForBrand, specForCaliber, type RateSpec } from "./watch-catalog";

export type { RateSpec };

const DAY_MS = 86_400_000;

/**
 * Measurements needed before a grade or health verdict is shown. Below this,
 * a couple of readings can swing the average by tens of seconds/day, so the
 * UI reports "collecting data" instead of a misleading verdict.
 */
export const MIN_MEASUREMENTS_FOR_GRADE = 7;

/**
 * The tolerance a watch is judged against: an explicit override on the watch,
 * otherwise its caliber's published spec, otherwise none (generic scale).
 */
export function rateSpecFor(watch: Watch): RateSpec | null {
  if (watch.rateSpecMin != null && watch.rateSpecMax != null)
    return {
      min: watch.rateSpecMin,
      max: watch.rateSpecMax,
      source: watch.rateSpecSource ?? "Custom specification",
    };

  const byCaliber = specForCaliber(watch.caliber, watch.coscCertified);
  if (byCaliber) return byCaliber;

  // No caliber recorded — look the model up in the catalog and use its
  // caliber. Someone who typed "Seiko SSK001" without filling in "4R34"
  // should still be graded against the 4R34's tolerance.
  const known = modelsForBrand(watch.brand).find((m) => {
    const q = watch.model.trim().toLowerCase();
    const mm = m.model.toLowerCase();
    return (
      mm === q ||
      mm.includes(q) ||
      q.includes(mm) ||
      (!!m.reference && m.reference.toLowerCase() === q)
    );
  });
  if (known?.caliber) return specForCaliber(known.caliber, watch.coscCertified);

  return specForCaliber(undefined, watch.coscCertified);
}

/**
 * Grade against the movement's own specification when it is known.
 *
 * `d` is where the average rate sits in the tolerance band: 0 at the centre,
 * ±1 at the edges. A Seiko 4R34 (−35/+45) running −28 s/d lands at d ≈ −0.83 —
 * inside spec, so "Good", not "Critical". The same rate on a Rolex 3235
 * (−2/+2) lands at d = −14 and is correctly Critical.
 */
export function gradeAgainstSpec(avgSpd: number, spec: RateSpec): AccuracyGrade {
  const centre = (spec.min + spec.max) / 2;
  const half = (spec.max - spec.min) / 2 || 1;
  const d = Math.abs((avgSpd - centre) / half);
  if (d <= 0.34) return "Excellent";
  if (d <= 0.67) return "Very Good";
  if (d <= 1) return "Good";
  if (d <= 1.5) return "Fair";
  if (d <= 2.5) return "Poor";
  return "Critical";
}

export function accuracyGrade(
  avgSpd: number | null,
  movement: MovementType,
  cosc: boolean,
  /** total measurements; when supplied, grading waits for the minimum */
  measurementCount?: number,
  /** manufacturer tolerance; when known the grade is judged against it */
  spec?: RateSpec | null
): AccuracyGrade | null {
  if (avgSpd == null) return null;
  if (measurementCount != null && measurementCount < MIN_MEASUREMENTS_FOR_GRADE) return null;

  // A certified chronometer inside its band earns the COSC badge outright.
  if (cosc && avgSpd >= -4 && avgSpd <= 6) return "COSC";
  if (spec) return gradeAgainstSpec(avgSpd, spec);

  const a = Math.abs(avgSpd);
  if (movement === "quartz") {
    if (a <= 0.1) return "Excellent";
    if (a <= 0.3) return "Very Good";
    if (a <= 0.7) return "Good";
    if (a <= 1.5) return "Fair";
    if (a <= 3) return "Poor";
    return "Critical";
  }
  // Generic mechanical scale — only used when no spec is known for the
  // caliber. Deliberately lenient at the bottom: plenty of honest movements
  // are built to ±30 s/d and are not "critical" at ±25.
  if (a <= 3) return "Excellent";
  if (a <= 6) return "Very Good";
  if (a <= 12) return "Good";
  if (a <= 20) return "Fair";
  if (a <= 40) return "Poor";
  return "Critical";
}

export const GRADE_COLORS: Record<AccuracyGrade, string> = {
  COSC: "#c9a227",
  Excellent: "#34d399",
  "Very Good": "#6ee7b7",
  Good: "#60a5fa",
  Fair: "#fbbf24",
  Poor: "#fb923c",
  Critical: "#f87171",
};

/** Rate band each grade covers, in |s/d|, per movement family. */
const GRADE_BANDS: Record<AccuracyGrade, { mech: string; quartz: string }> = {
  COSC: { mech: "−4 to +6 s/d", quartz: "—" },
  Excellent: { mech: "within ±3 s/d", quartz: "within ±0.1 s/d" },
  "Very Good": { mech: "±3–6 s/d", quartz: "±0.1–0.3 s/d" },
  Good: { mech: "±6–10 s/d", quartz: "±0.3–0.7 s/d" },
  Fair: { mech: "±10–15 s/d", quartz: "±0.7–1.5 s/d" },
  Poor: { mech: "±15–25 s/d", quartz: "±1.5–3 s/d" },
  Critical: { mech: "beyond ±25 s/d", quartz: "beyond ±3 s/d" },
};

const GRADE_MEANING: Record<AccuracyGrade, string> = {
  COSC: "Running inside chronometer specification — the standard a certified movement is tested to.",
  Excellent: "Keeping time better than most movements of its type. Nothing to act on.",
  "Very Good": "Comfortably accurate for everyday wear.",
  Good: "Normal, usable accuracy — you'd notice roughly a minute's drift per month.",
  Fair: "Drifting more than ideal. A regulation would bring it back in line.",
  Poor: "Well outside normal for a healthy movement. Regulation is recommended.",
  Critical: "Far outside spec — often a sign of magnetization, a fault, or an overdue service.",
};

const fmtBand = (s: RateSpec) =>
  `${s.min > 0 ? "+" : ""}${s.min} to ${s.max > 0 ? "+" : ""}${s.max} s/d`;

/**
 * Plain-language explanation of an accuracy grade. When the movement's own
 * tolerance is known the explanation is stated in those terms — that is the
 * standard the watch was actually built to.
 */
export function gradeExplanation(
  grade: AccuracyGrade,
  movement: MovementType,
  spec?: RateSpec | null,
  avgSpd?: number | null
): string {
  if (grade === "COSC")
    return `Running inside chronometer specification (−4 to +6 s/d) — the standard a certified movement is tested to.`;

  if (spec) {
    const inSpec = avgSpd != null && avgSpd >= spec.min && avgSpd <= spec.max;
    const where =
      avgSpd == null
        ? ""
        : inSpec
          ? ` At ${avgSpd > 0 ? "+" : ""}${avgSpd.toFixed(1)} s/d it is running within that tolerance.`
          : ` At ${avgSpd > 0 ? "+" : ""}${avgSpd.toFixed(1)} s/d it is outside that tolerance.`;
    const verdict = inSpec
      ? grade === "Excellent" || grade === "Very Good"
        ? "Comfortably inside spec, with margin on both sides."
        : "Within spec — performing as the manufacturer intends, even if not centred."
      : GRADE_MEANING[grade];
    return `Judged against ${spec.source}: ${fmtBand(spec)}.${where} ${verdict}`;
  }

  const band = movement === "quartz" ? GRADE_BANDS[grade].quartz : GRADE_BANDS[grade].mech;
  return `No published tolerance for this caliber, so a generic scale is used: ${band}. ${GRADE_MEANING[grade]} You can set the movement's real spec in the watch profile.`;
}

export function lastServiceDate(services: ServiceRecord[]): string | null {
  const majors = services.filter((s) => s.type === "full-service" || s.type === "oil-service");
  if (!majors.length) return null;
  return majors.map((s) => s.date).sort().at(-1)!;
}

export function lastRegulationDate(services: ServiceRecord[]): string | null {
  const regs = services.filter((s) => s.type === "regulation" || s.type === "full-service");
  if (!regs.length) return null;
  return regs.map((s) => s.date).sort().at(-1)!;
}

export function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - +new Date(iso)) / DAY_MS);
}

export interface HealthResult {
  score: number; // 0-100
  label: HealthLabel;
  components: { name: string; score: number; weight: number }[];
  /** why this label, in plain language */
  reason: string;
}

/**
 * Day-to-day scatter a healthy movement of this class shows, in s/d.
 *
 * Consistency scales with how finely a movement was built and adjusted: a
 * chronometer held to a 10-second band is expected to repeat within a fraction
 * of a second, while a workhorse built to a 40-second band will wander several
 * seconds and still be perfectly healthy. Judging both on one absolute curve
 * marks honest budget movements down for behaving exactly as designed.
 */
export function expectedScatter(spec: RateSpec | null): number {
  if (!spec) return 3; // unknown movement — assume a mid-range mechanical
  return Math.max(0.8, (spec.max - spec.min) / 8);
}

/** 0–100 for observed scatter, relative to what this movement should show. */
export function stabilityScoreFor(sd: number, spec: RateSpec | null): number {
  const ratio = sd / expectedScatter(spec);
  // at or under half the expected scatter → 100; at 3× → 0
  return Math.max(0, Math.min(100, (100 * (3 - ratio)) / 2.5));
}

/**
 * Movement health, 0–100. Weighted blend of accuracy, stability, drift trend,
 * consistency, service age and wear pattern.
 */
export function healthScore(
  watch: Watch,
  stats: WatchStats,
  services: ServiceRecord[]
): HealthResult | null {
  if (stats.avgSpd == null) return null;
  // gate on readings that actually contributed a rate, not raw entries
  if (stats.gradableCount < MIN_MEASUREMENTS_FOR_GRADE) return null;

  // Accuracy is scored against the movement's own tolerance when known: a
  // 4R34 at −28 s/d is in spec and should not be marked down like a chronometer
  // would be. Without a spec, fall back to the absolute performance curve.
  const spec = rateSpecFor(watch);
  const perf = spec
    ? (() => {
        const centre = (spec.min + spec.max) / 2;
        const half = (spec.max - spec.min) / 2 || 1;
        const d = Math.abs((stats.avgSpd! - centre) / half);
        // centred → 100, at the band edge → 70, well outside → approaches 0
        return Math.max(0, Math.min(100, d <= 1 ? 100 - 30 * d : Math.max(0, 70 - 40 * (d - 1))));
      })()
    : (stats.performanceScore ?? 50);
  // Stability is judged the same way: against what this movement should show,
  // not against a chronometer. Positional differences are already excluded —
  // this is scatter within a single position.
  const sd = stats.adjustedStdDev ?? stats.stdDev ?? 0;
  const stab = stabilityScoreFor(sd, spec);
  const expected = expectedScatter(spec);

  // Consistency: how many readings land inside the movement's normal scatter.
  // (The old measure — share within one standard deviation — was ~68% for any
  // well-behaved data by definition, so it scored every watch the same.)
  // Deviations are taken from each reading's own position where possible, so a
  // night spent crown-down is not counted as an inconsistent reading.
  const deviations = stats.conditions?.reliable
    ? stats.conditions.residuals.map((r) => Math.abs(r.value))
    : stats.samples.map((s) => Math.abs(s.spd - stats.avgSpd!));
  const cons = deviations.length
    ? (100 * deviations.filter((d) => d <= expected * 2).length) / deviations.length
    : 50;

  // Drift: is the rate itself moving? Judged against the movement's own
  // scatter — a change of a few s/d per month is noise on a workhorse and a
  // red flag on a chronometer. Too few readings to tell → stay neutral rather
  // than punish a short history, where the slope is mostly noise.
  const driftPerMonth = Math.abs(stats.accuracyTrend ?? 0) * 30;
  const drift =
    stats.samples.length < 10
      ? 75
      : Math.max(0, Math.min(100, 100 * (1 - driftPerMonth / (expected * 2))));

  // Service age. A real service record is authoritative; failing that, the
  // purchase date stands in — "never serviced since bought" is the relevant
  // fact for a watch bought new, but it is weaker evidence, so it can't sink
  // the score as far.
  const realService = lastServiceDate(services);
  const sinceService = daysSince(realService ?? watch.purchaseDate ?? null);
  const intervalYears = watch.movementType === "quartz" ? 8 : 7;
  const intervalDays = 365 * intervalYears;
  let serviceAge = 50; // nothing recorded — mildly pessimistic, not damning
  if (sinceService != null) {
    const raw = 100 * (1 - sinceService / intervalDays);
    serviceAge = Math.max(realService ? 0 : 20, Math.min(100, raw));
  }

  // Wear regularity — automatics like being worn; extremes are fine for quartz
  const wear =
    watch.movementType === "quartz"
      ? 100
      : stats.wearRatio == null
        ? 70
        : Math.max(30, Math.min(100, 40 + stats.wearRatio * 60));

  const components = [
    { name: "Accuracy", score: perf, weight: 0.28 },
    { name: "Stability", score: stab, weight: 0.24 },
    { name: "Consistency", score: cons, weight: 0.13 },
    { name: "Drift trend", score: drift, weight: 0.15 },
    { name: "Service age", score: serviceAge, weight: 0.12 },
    { name: "Wear pattern", score: wear, weight: 0.08 },
  ];
  const score = Math.round(
    components.reduce((a, c) => a + c.score * c.weight, 0) /
      components.reduce((a, c) => a + c.weight, 0)
  );

  // The label names an action, so it has to match the actual fault:
  //   • regulation adjusts the RATE — pointless if the rate is already in spec
  //   • service addresses instability — scatter within one position
  // A watch that simply runs off-centre but inside tolerance needs neither.
  const rateOutOfSpec = spec
    ? stats.avgSpd < spec.min || stats.avgSpd > spec.max
    // No published tolerance: a quartz movement drifting seconds a day is
    // already broken, while a mechanical at 15 s/d may be entirely normal.
    : Math.abs(stats.avgSpd) > (watch.movementType === "quartz" ? 2 : 20);
  // Instability has to clear a real bar: enough history, and scatter well
  // beyond what this class of movement normally shows — not merely worse than
  // a chronometer would manage.
  const unstable = stats.gradableCount >= 14 && sd > expected * 2;
  // Time alone is a reason for a service, and it is the one thing the phrase
  // literally means. Only claimed on a real service record, since a purchase
  // date says nothing about work done before you owned it.
  const overdueYears = realService && sinceService != null ? sinceService / 365 : null;
  const serviceOverdue = overdueYears != null && overdueYears > intervalYears;

  const sdText = `±${sd.toFixed(1)} s/d within a single position (typical for this movement: ±${expected.toFixed(1)})`;

  let label: HealthLabel;
  let reason: string;
  if (serviceOverdue) {
    label = "Needs Service";
    reason = `Last serviced ${overdueYears!.toFixed(1)} years ago, past the ${intervalYears}-year interval used here. The rate itself is ${rateOutOfSpec ? "also outside tolerance" : "still fine"} — this verdict is about elapsed time, not a fault.`;
  } else if (rateOutOfSpec && unstable) {
    label = "Needs Service";
    reason = `Running outside its tolerance and scattering ${sdText}. Both together point at the movement rather than the regulation.`;
  } else if (rateOutOfSpec) {
    label = "Needs Regulation";
    reason = spec
      ? `The average rate sits outside the ${fmtBand(spec)} this movement is built to. Regulation adjusts exactly this; nothing here suggests a fault.`
      : `The average rate is a long way from zero, judged on a generic scale because no tolerance is set for this caliber.`;
  } else if (unstable) {
    label = "Needs Service";
    reason = `The rate is within tolerance, but it scatters ${sdText}. Repeatability that poor within one position usually means low amplitude, and regulation cannot fix it.`;
  } else {
    if (score >= 85) label = "Excellent";
    else if (score >= 70) label = "Very Good";
    else label = "Good";
    reason = spec
      ? `Running within its ${fmtBand(spec)} tolerance and repeating to ${sdText}. Nothing needs doing — the score reflects how far from the centre of spec it sits and how long since it was serviced, not a fault.`
      : `Nothing here needs attention. Set this caliber's tolerance in the profile for a sharper verdict.`;
  }

  return { score, label, components, reason };
}

export const HEALTH_COLORS: Record<HealthLabel, string> = {
  Excellent: "#34d399",
  "Very Good": "#6ee7b7",
  Good: "#60a5fa",
  "Needs Regulation": "#fbbf24",
  "Needs Service": "#f87171",
};

const HEALTH_MEANING: Record<HealthLabel, string> = {
  Excellent: "Accurate, consistent and holding its rate. Nothing needs attention.",
  "Very Good": "Performing well. Keep measuring at your usual cadence.",
  Good:
    "Running within tolerance. The score reflects how far from the centre of spec it sits and how consistent it is — a lower number here is not a fault.",
  "Needs Regulation":
    "The rate is outside the movement's tolerance. A watchmaker can adjust it without a full service — this is a rate problem, not a fault.",
  "Needs Service":
    "The rate scatters more than it should within a single position, which regulation cannot fix. Worth having the movement looked at.",
};

/**
 * Plain-language explanation of a movement health verdict. Without a known
 * tolerance the verdict must not claim the rate is "outside spec" — there is
 * no spec to be outside of, only a generic assumption.
 */
export function healthExplanation(label: HealthLabel, hasSpec = true): string {
  if (!hasSpec && label === "Needs Regulation")
    return (
      "The rate is a long way from zero, but no tolerance is set for this movement — " +
      "this verdict comes from a generic scale, not your caliber's real spec. " +
      "Many honest movements are built to ±30 s/d or wider. Add the caliber (or its " +
      "rate spec) in the watch profile to be graded against the standard it was actually built to."
    );
  const tail = hasSpec
    ? "The score combines accuracy against the movement's own spec, stability within a position, consistency, drift trend, service age and wear pattern."
    : "No rate spec is set for this movement, so accuracy is scored on a generic scale — add the caliber in the watch profile for an accurate verdict.";
  return `${HEALTH_MEANING[label]} ${tail}`;
}

/** Estimate next service date from last major service + interval. */
export function nextServiceEstimate(watch: Watch, services: ServiceRecord[]): string | null {
  const last = lastServiceDate(services) ?? watch.purchaseDate;
  if (!last) return null;
  const years = watch.movementType === "quartz" ? 8 : 5;
  const d = new Date(last);
  d.setFullYear(d.getFullYear() + years);
  return d.toISOString().slice(0, 10);
}

/** Remaining battery fraction for quartz watches (0–1), null if unknown. */
export function batteryRemaining(watch: Watch): number | null {
  if (watch.movementType !== "quartz" || !watch.batteryInstalledAt) return null;
  const life = (watch.batteryLifeMonths ?? 24) * 30.44 * DAY_MS;
  const used = Date.now() - +new Date(watch.batteryInstalledAt);
  return Math.max(0, Math.min(1, 1 - used / life));
}
