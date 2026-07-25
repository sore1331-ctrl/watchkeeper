// ─── Accuracy grading & movement health scoring ─────────────────────────────

import type { AccuracyGrade, HealthLabel, MovementType, ServiceRecord, Watch } from "./types";
import type { WatchStats } from "./stats";

const DAY_MS = 86_400_000;

/**
 * Measurements needed before a grade or health verdict is shown. Below this,
 * a couple of readings can swing the average by tens of seconds/day, so the
 * UI reports "collecting data" instead of a misleading verdict.
 */
export const MIN_MEASUREMENTS_FOR_GRADE = 7;

export function accuracyGrade(
  avgSpd: number | null,
  movement: MovementType,
  cosc: boolean,
  /** total measurements; when supplied, grading waits for the minimum */
  measurementCount?: number
): AccuracyGrade | null {
  if (avgSpd == null) return null;
  if (measurementCount != null && measurementCount < MIN_MEASUREMENTS_FOR_GRADE) return null;
  const a = Math.abs(avgSpd);
  if (movement === "quartz") {
    if (a <= 0.1) return "Excellent";
    if (a <= 0.3) return "Very Good";
    if (a <= 0.7) return "Good";
    if (a <= 1.5) return "Fair";
    if (a <= 3) return "Poor";
    return "Critical";
  }
  // Mechanical. COSC: -4/+6 s/d
  if (cosc && avgSpd >= -4 && avgSpd <= 6) return "COSC";
  if (a <= 3) return "Excellent";
  if (a <= 6) return "Very Good";
  if (a <= 10) return "Good";
  if (a <= 15) return "Fair";
  if (a <= 25) return "Poor";
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

/** Plain-language explanation of an accuracy grade for the given movement. */
export function gradeExplanation(grade: AccuracyGrade, movement: MovementType): string {
  const band = movement === "quartz" ? GRADE_BANDS[grade].quartz : GRADE_BANDS[grade].mech;
  const prefix = grade === "COSC" ? band : `Average rate ${band}`;
  return `${prefix}. ${GRADE_MEANING[grade]}`;
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

  const perf = stats.performanceScore ?? 50;
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

  let label: HealthLabel;
  if (score >= 85) label = "Excellent";
  else if (score >= 70) label = "Very Good";
  else if (score >= 55) label = "Good";
  else if (score >= 40) label = "Needs Regulation";
  else label = "Needs Service";

  return { score, label, components };
}

export const HEALTH_COLORS: Record<HealthLabel, string> = {
  Excellent: "#34d399",
  "Very Good": "#6ee7b7",
  Good: "#60a5fa",
  "Needs Regulation": "#fbbf24",
  "Needs Service": "#f87171",
};

const HEALTH_BANDS: Record<HealthLabel, string> = {
  Excellent: "85–100",
  "Very Good": "70–84",
  Good: "55–69",
  "Needs Regulation": "40–54",
  "Needs Service": "below 40",
};

const HEALTH_MEANING: Record<HealthLabel, string> = {
  Excellent: "Accurate, consistent and holding its rate. Nothing needs attention.",
  "Very Good": "Performing well. Keep measuring at your usual cadence.",
  Good: "Healthy overall, though accuracy or consistency has room to improve.",
  "Needs Regulation":
    "The movement runs reliably but off-rate. A watchmaker can adjust the rate without a full service.",
  "Needs Service":
    "Several indicators are weak at once — rate, stability, or time since the last service. Worth having it looked at.",
};

/** Plain-language explanation of a movement health verdict. */
export function healthExplanation(label: HealthLabel): string {
  return `Score ${HEALTH_BANDS[label]}. ${HEALTH_MEANING[label]} Combines accuracy, stability, consistency, drift trend, service age and wear pattern.`;
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
