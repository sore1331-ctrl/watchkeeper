// ─── Accuracy grading & movement health scoring ─────────────────────────────

import type { AccuracyGrade, HealthLabel, MovementType, ServiceRecord, Watch } from "./types";
import type { WatchStats } from "./stats";
import { specForCaliber, type RateSpec } from "./watch-catalog";

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
  return specForCaliber(watch.caliber, watch.coscCertified);
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
  if (stats.count < MIN_MEASUREMENTS_FOR_GRADE) return null;

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
  const stab = stats.stabilityScore ?? 50;
  const cons = stats.consistencyIndex ?? 50;

  // Drift: |accuracyTrend| of 0 s/d/day → 100; 0.15 → 0
  const drift = Math.max(0, 100 - Math.abs(stats.accuracyTrend ?? 0) * 667);

  // Service age: quartz uses battery age; mechanical target 5y interval
  let serviceAge = 70; // unknown default
  const since = daysSince(lastServiceDate(services) ?? watch.purchaseDate ?? null);
  if (since != null) {
    const intervalDays = watch.movementType === "quartz" ? 365 * 8 : 365 * 5;
    serviceAge = Math.max(0, Math.min(100, 100 * (1 - since / intervalDays)));
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
    : Math.abs(stats.avgSpd) > 20;
  // Instability is only actionable once there is enough history to trust it.
  const unstable = stats.count >= 14 && stab < 40;

  let label: HealthLabel;
  if (rateOutOfSpec && unstable) label = "Needs Service";
  else if (rateOutOfSpec) label = "Needs Regulation";
  else if (unstable) label = "Needs Service";
  else if (score >= 85) label = "Excellent";
  else if (score >= 70) label = "Very Good";
  else label = "Good";

  return { score, label, components };
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

/** Plain-language explanation of a movement health verdict. */
export function healthExplanation(label: HealthLabel): string {
  return `${HEALTH_MEANING[label]} The score combines accuracy against the movement's own spec, stability within a position, consistency, drift trend, service age and wear pattern.`;
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
