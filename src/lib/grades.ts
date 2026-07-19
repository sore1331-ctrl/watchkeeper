// ─── Accuracy grading & movement health scoring ─────────────────────────────

import type { AccuracyGrade, HealthLabel, MovementType, ServiceRecord, Watch } from "./types";
import type { WatchStats } from "./stats";

const DAY_MS = 86_400_000;

export function accuracyGrade(
  avgSpd: number | null,
  movement: MovementType,
  cosc: boolean
): AccuracyGrade | null {
  if (avgSpd == null) return null;
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
