// ─── One analysis, one place ────────────────────────────────────────────────
//
// Every page used to assemble its own verdict: call computeStats with its own
// options, look up the spec, grade it, score health. They drifted apart three
// separate times — a fix would land on the watch page while Analytics kept
// drawing a COSC band and Reports kept quoting a different weekly average.
//
// Pages now ask for the finished analysis instead of rebuilding it. Adding a
// consideration here reaches every screen at once.

import type { AppSettings, Measurement, ServiceRecord, Watch } from "./types";
import { computeStats, detectAnomaly, type WatchStats } from "./stats";
import {
  accuracyGrade, healthScore, rateSpecFor,
  type HealthResult, type RateSpec,
} from "./grades";
import type { AccuracyGrade } from "./types";

export interface WatchAnalysis {
  watch: Watch;
  stats: WatchStats;
  /** the tolerance this movement is judged against, if known */
  spec: RateSpec | null;
  grade: AccuracyGrade | null;
  /**
   * Set instead of a grade when the readings cannot resolve one: the average
   * is known less precisely than the band it would be judged against.
   */
  gradeNote: string | null;
  health: HealthResult | null;
  anomaly: ReturnType<typeof detectAnomaly>;
}

export function analyzeWatch(
  watch: Watch,
  measurements: Measurement[],
  services: ServiceRecord[],
  settings: Pick<AppSettings, "restingReadings" | "serviceIntervalYears">
): WatchAnalysis {
  const stats = computeStats(measurements, {
    powerReserveHours: watch.powerReserveHours,
    movementType: watch.movementType,
    restingReadings: settings.restingReadings,
  });
  const spec = rateSpecFor(watch);
  let grade = accuracyGrade(
    stats.avgSpd,
    watch.movementType,
    watch.coscCertified,
    stats.gradableCount,
    spec
  );

  // A grade places the average inside a band. If the average itself is known
  // no better than the width of that band, the grade is noise — typical of a
  // quartz watch held to hundredths of a second a day and read by eye.
  let gradeNote: string | null = null;
  const ci = stats.confidence95;
  // without a published spec: the generic "good" band for the movement type
  const bandHalf = spec ? (spec.max - spec.min) / 2 : watch.movementType === "quartz" ? 0.7 : 12;
  if (grade && ci && (ci[1] - ci[0]) / 2 > bandHalf) {
    const half = (ci[1] - ci[0]) / 2;
    gradeNote =
      `The average rate is only known to ±${half.toFixed(2)} s/d, which is wider than the ` +
      `±${bandHalf.toFixed(2)} s/d it would be graded against, so no grade is given yet. ` +
      "Readings taken further apart sharpen it: the same reading error spread over a month is a thirtieth of what it is over a day.";
    grade = null;
  }

  return {
    watch,
    stats,
    spec,
    grade,
    gradeNote,
    health: healthScore(watch, stats, services, settings.serviceIntervalYears),
    // judged on the same readings the headline figures use, so a change of
    // resting habit can never read as the movement drifting
    anomaly: detectAnomaly(stats.headlineSamples),
  };
}
