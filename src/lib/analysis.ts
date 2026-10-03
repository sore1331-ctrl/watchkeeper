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
    restingReadings: settings.restingReadings,
  });
  const spec = rateSpecFor(watch);
  return {
    watch,
    stats,
    spec,
    grade: accuracyGrade(
      stats.avgSpd,
      watch.movementType,
      watch.coscCertified,
      stats.gradableCount,
      spec
    ),
    health: healthScore(watch, stats, services, settings.serviceIntervalYears),
    // judged on the same readings the headline figures use, so a change of
    // resting habit can never read as the movement drifting
    anomaly: detectAnomaly(stats.headlineSamples),
  };
}
