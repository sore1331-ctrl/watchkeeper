// ─── Smart insights + notification engine ───────────────────────────────────

import type { Insight, Measurement, Notification, RestingHandling, Watch, ServiceRecord } from "./types";
import { analyzeConditions, computeStats, detectAnomaly, mean, stdDev, type WatchStats } from "./stats";
import { accuracyGrade, batteryRemaining, daysSince, expectedScatter, healthScore, lastRegulationDate, MIN_MEASUREMENTS_FOR_GRADE, nextServiceEstimate, rateSpecFor } from "./grades";

const DAY_MS = 86_400_000;
let seq = 0;
const nid = () => `ins-${++seq}`;

const POSITION_LABEL: Record<string, string> = {
  "dial-up": "dial-up",
  "dial-down": "dial-down",
  "crown-up": "crown-up",
  "crown-down": "crown-down",
  "crown-left": "crown-left",
  "crown-right": "crown-right",
  "on-wrist": "on the wrist",
};

export function generateInsights(
  watch: Watch,
  measurements: Measurement[],
  services: ServiceRecord[],
  restingReadings: RestingHandling = "separate"
): Insight[] {
  const stats = computeStats(measurements, { powerReserveHours: watch.powerReserveHours, restingReadings });
  const out: Insight[] = [];
  const name = `${watch.brand} ${watch.model}`;
  // Same evidence bar as grading: below it, one stray reading dominates.
  if (measurements.length < MIN_MEASUREMENTS_FOR_GRADE) {
    const left = MIN_MEASUREMENTS_FOR_GRADE - measurements.length;
    out.push({
      id: nid(), watchId: watch.id, kind: "recommendation", severity: "neutral",
      text: `${left} more measurement${left === 1 ? "" : "s"} needed before ${name} gets a rate analysis.`,
      detail: `Accuracy grades, health scoring and trend insights unlock at ${MIN_MEASUREMENTS_FOR_GRADE} measurements.`,
    });
    return out;
  }

  // Stability change: last 30d vs previous 30d
  const end = +new Date(stats.samples.at(-1)!.date);
  const rec = stats.samples.filter((s) => +new Date(s.date) > end - 30 * DAY_MS);
  const prev = stats.samples.filter(
    (s) => +new Date(s.date) <= end - 30 * DAY_MS && +new Date(s.date) > end - 60 * DAY_MS
  );
  if (rec.length >= 5 && prev.length >= 5) {
    // Compare like-for-like: σ of condition-adjusted residuals, so a month
    // spent resting in a different position isn't reported as instability.
    const cond = analyzeConditions(stats.samples);
    const resid = cond?.reliable ? new Map(cond.residuals.map((r) => [r.date, r.value])) : null;
    const val = (s: { date: string; spd: number }) => resid?.get(s.date) ?? s.spd;
    const sdRec = stdDev(rec.map(val));
    const sdPrev = stdDev(prev.map(val));
    const basis = resid ? " (positional effects excluded)" : "";
    if (sdPrev > 0.5) {
      const change = (sdRec - sdPrev) / sdPrev;
      if (change > 0.35)
        out.push({
          id: nid(), watchId: watch.id, kind: "stability", severity: change > 0.75 ? "warning" : "neutral",
          text: `${name} has become ${Math.round(change * 100)}% less stable over the last month.`,
          detail: `Rate σ rose from ±${sdPrev.toFixed(1)} to ±${sdRec.toFixed(1)} s/d${basis}.`,
        });
      else if (change < -0.35)
        out.push({
          id: nid(), watchId: watch.id, kind: "stability", severity: "positive",
          text: `${name} is ${Math.round(-change * 100)}% more stable than last month.`,
          detail: `Rate σ improved from ±${sdPrev.toFixed(1)} to ±${sdRec.toFixed(1)} s/d${basis}.`,
        });
    }
    const avgRec = mean(rec.map((s) => s.spd));
    const avgPrev = mean(prev.map((s) => s.spd));
    const delta = avgRec - avgPrev;
    if (Math.abs(delta) >= 0.8)
      out.push({
        id: nid(), watchId: watch.id, kind: "rate", severity: Math.abs(delta) > 2 ? "warning" : "neutral",
        text: `The average ${delta > 0 ? "gain" : "loss"} ${Math.abs(avgRec) > Math.abs(avgPrev) ? "increased" : "decreased"} by ${delta > 0 ? "+" : ""}${delta.toFixed(1)} s/d this month.`,
      });
  }

  // COSC check — skipped when a tighter manufacturer spec is reported below,
  // which would otherwise say the same thing twice.
  const coscOnly = !rateSpecFor(watch) || rateSpecFor(watch)!.source === "COSC chronometer";
  if (watch.coscCertified && coscOnly && stats.avgSpd != null) {
    const inCosc = stats.avgSpd >= -4 && stats.avgSpd <= 6;
    out.push({
      id: nid(), watchId: watch.id, kind: "certification",
      severity: inCosc ? "positive" : "warning",
      text: inCosc
        ? `${name} still performs within COSC specification (−4/+6 s/d).`
        : `${name} is running outside COSC specification at ${stats.avgSpd > 0 ? "+" : ""}${stats.avgSpd.toFixed(1)} s/d.`,
    });
  }

  // Regulation recommendation — judged against the movement's own tolerance.
  // A watch inside its manufacturer spec does not need regulating, however
  // far from zero it runs.
  const spec = rateSpecFor(watch);
  if (watch.movementType !== "quartz" && stats.avgSpd != null) {
    const rate = stats.avgSpd;
    const fmt = `${rate > 0 ? "+" : ""}${rate.toFixed(1)} s/d`;
    if (spec) {
      const half = (spec.max - spec.min) / 2 || 1;
      const centre = (spec.min + spec.max) / 2;
      const d = (rate - centre) / half;
      if (Math.abs(d) > 1) {
        const months = Math.abs(d) > 2 ? 1 : 3;
        out.push({
          id: nid(), watchId: watch.id, kind: "recommendation",
          severity: Math.abs(d) > 2 ? "warning" : "neutral",
          text: `${name} is running outside its ${spec.min > 0 ? "+" : ""}${spec.min}/${spec.max > 0 ? "+" : ""}${spec.max} s/d specification at ${fmt} — regulation would bring it back in band.`,
          detail: `Suggested within ${months} month${months > 1 ? "s" : ""}. Source: ${spec.source}.`,
        });
      } else {
        out.push({
          id: nid(), watchId: watch.id, kind: "certification", severity: "positive",
          text: `${name} is running within its ${spec.min > 0 ? "+" : ""}${spec.min}/${spec.max > 0 ? "+" : ""}${spec.max} s/d specification at ${fmt}.`,
          detail: `No regulation needed — this is how the movement is built to perform (${spec.source}).`,
        });
      }
    } else if (Math.abs(rate) > 20) {
      out.push({
        id: nid(), watchId: watch.id, kind: "recommendation", severity: "neutral",
        text: `${name} averages ${fmt}. If that is outside its caliber's tolerance, regulation would help.`,
        detail: "No published spec is known for this caliber — set one in the watch profile for an accurate verdict.",
      });
    }
  }

  // Position analysis
  const byPos = new Map<string, number[]>();
  for (const s of stats.samples) {
    if (!s.position) continue;
    if (!byPos.has(s.position)) byPos.set(s.position, []);
    byPos.get(s.position)!.push(s.spd);
  }
  const posEntries = [...byPos.entries()].filter(([, v]) => v.length >= 3);
  if (posEntries.length >= 2) {
    const ranked = posEntries
      .map(([p, v]) => ({ p, dev: Math.abs(mean(v)) }))
      .sort((a, b) => a.dev - b.dev);
    const best = ranked[0];
    const worst = ranked[ranked.length - 1];
    if (worst.dev - best.dev > 1.5)
      out.push({
        id: nid(), watchId: watch.id, kind: "position", severity: "neutral",
        text: `${name} performs better ${POSITION_LABEL[best.p] ?? best.p} than ${POSITION_LABEL[worst.p] ?? worst.p}.`,
        detail: `Mean deviation ${best.dev.toFixed(1)} s/d vs ${worst.dev.toFixed(1)} s/d — consider resting it ${POSITION_LABEL[best.p] ?? best.p} overnight.`,
      });
  }

  // Wear pattern (weekend vs weekday)
  const worn = measurements.filter((m) => m.wornToday);
  if (worn.length >= 6) {
    const weekend = worn.filter((m) => [0, 6].includes(new Date(m.measuredAt).getDay())).length;
    const ratio = weekend / worn.length;
    if (ratio > 0.5)
      out.push({
        id: nid(), watchId: watch.id, kind: "wear", severity: "neutral",
        text: `You wear ${name} mostly on weekends (${Math.round(ratio * 100)}% of worn days).`,
      });
  }

  // Power reserve behaviour. The sample already carries the reserve recorded at
  // the START of its interval — that is the state the watch ran in. Looking up
  // by s.date would fetch the reading that ENDED the interval instead.
  const lowPR = stats.samples.filter((s) => s.powerReservePct != null && s.powerReservePct < 35);
  const highPR = stats.samples.filter((s) => s.powerReservePct != null && s.powerReservePct >= 65);
  if (watch.movementType !== "quartz" && lowPR.length >= 3 && highPR.length >= 3) {
    const dLow = mean(lowPR.map((s) => s.spd));
    const dHigh = mean(highPR.map((s) => s.spd));
    if (Math.abs(dLow - dHigh) > 1.5)
      out.push({
        id: nid(), watchId: watch.id, kind: "power", severity: "neutral",
        text: `${name} ${dLow - dHigh > 0 ? "gains" : "loses"} more when the power reserve runs low.`,
        detail: `${dHigh > 0 ? "+" : ""}${dHigh.toFixed(1)} s/d at high reserve vs ${dLow > 0 ? "+" : ""}${dLow.toFixed(1)} s/d below 35%.`,
      });
  }

  // Scattered readings: report what it could be, don't declare a fault. Rate
  // data alone cannot separate a tiring movement from perfectly ordinary
  // causes, so this is offered as something to look into.
  const scatter = stats.adjustedStdDev ?? stats.stdDev;
  const normalScatter = expectedScatter(spec);
  if (stats.gradableCount >= 14 && scatter != null && scatter > normalScatter * 2) {
    out.push({
      id: nid(), watchId: watch.id, kind: "stability", severity: "neutral",
      text: `${name}'s readings scatter ±${scatter.toFixed(1)} s/d within a single position — wider than the ±${normalScatter.toFixed(1)} typical of this movement.`,
      detail:
        "Worth a look, though it is not automatically a fault. Common causes, cheapest first: readings taken at different wind states (a mainspring near the end of its reserve runs slower), a magnetised hairspring (a demagnetiser fixes this in seconds), measuring over short gaps where a half-second reading error becomes several s/d, or genuinely low amplitude — which only a timegrapher can confirm.",
    });
  }

  // Anomaly detection — on condition-adjusted residuals where possible
  const anomaly = detectAnomaly(stats.samples);
  if (anomaly?.drifting)
    out.push({
      id: nid(), watchId: watch.id, kind: "trend",
      severity: Math.abs(anomaly.zScore) > 3 ? "warning" : "neutral",
      text: `${name} is running differently than usual — recent rate ${anomaly.recentAvg > 0 ? "+" : ""}${anomaly.recentAvg.toFixed(1)} s/d vs baseline ${anomaly.baselineAvg > 0 ? "+" : ""}${anomaly.baselineAvg.toFixed(1)} s/d.`,
      detail: anomaly.conditionAdjusted
        ? `Compared within the same wearing positions, so this is not just a change of resting position (z=${anomaly.zScore.toFixed(1)}).`
        : `Positions aren't recorded consistently enough to rule out a change of resting position (z=${anomaly.zScore.toFixed(1)}).`,
    });

  return out;
}

export function generateNotifications(
  watches: Watch[],
  measurementsByWatch: Map<string, Measurement[]>,
  servicesByWatch: Map<string, ServiceRecord[]>,
  reminderDays = 3,
  restingReadings: RestingHandling = "separate"
): Notification[] {
  const out: Notification[] = [];
  let n = 0;
  const push = (p: Omit<Notification, "id" | "createdAt" | "read">) =>
    out.push({ ...p, id: `ntf-${++n}`, createdAt: new Date().toISOString(), read: false });

  for (const w of watches.filter((x) => !x.archived)) {
    const ms = measurementsByWatch.get(w.id) ?? [];
    const svcs = servicesByWatch.get(w.id) ?? [];
    const stats = computeStats(ms, { powerReserveHours: w.powerReserveHours, restingReadings });
    const name = `${w.brand} ${w.model}`;

    const lastDays = daysSince(stats.lastMeasuredAt);
    if (lastDays != null && lastDays > reminderDays)
      push({
        watchId: w.id, kind: "measurement-overdue", severity: lastDays > reminderDays * 3 ? "warning" : "info",
        title: "Measurement overdue",
        body: `${name} hasn't been measured in ${lastDays} days.`,
      });

    // Only warn once there is a real evidence base, and only when the shift
    // survives adjusting for the positions the watch was kept in.
    const anomaly = stats.count >= MIN_MEASUREMENTS_FOR_GRADE ? detectAnomaly(stats.samples) : null;
    if (anomaly?.drifting && anomaly.conditionAdjusted)
      push({
        watchId: w.id, kind: "trend-change",
        severity: Math.abs(anomaly.zScore) > 3 ? "warning" : "info",
        title: "Rate has shifted",
        body: `${name} is averaging ${anomaly.recentAvg > 0 ? "+" : ""}${anomaly.recentAvg.toFixed(1)} s/d against a baseline of ${anomaly.baselineAvg > 0 ? "+" : ""}${anomaly.baselineAvg.toFixed(1)} — beyond its usual positional variation.`,
      });

    if (
      stats.count >= MIN_MEASUREMENTS_FOR_GRADE &&
      stats.conditions?.reliable &&
      stats.weeklyVariance != null && stats.monthlyVariance != null &&
      stats.weeklyVariance > stats.monthlyVariance * 3 && stats.weeklyVariance > 4
    )
      push({
        watchId: w.id, kind: "variance-increase", severity: "info",
        title: "Variance increasing",
        body: `${name}'s weekly variance (${stats.weeklyVariance.toFixed(1)}) is well above its monthly norm (${stats.monthlyVariance.toFixed(1)}).`,
      });

    const next = nextServiceEstimate(w, svcs);
    if (next && +new Date(next) - Date.now() < 90 * DAY_MS)
      push({
        watchId: w.id, kind: "service-due",
        severity: +new Date(next) < Date.now() ? "critical" : "warning",
        title: +new Date(next) < Date.now() ? "Service overdue" : "Service due soon",
        body: `${name} is ${+new Date(next) < Date.now() ? "past" : "approaching"} its estimated service date (${next}).`,
      });

    const batt = batteryRemaining(w);
    if (batt != null && batt < 0.15)
      push({
        watchId: w.id, kind: "battery-low", severity: batt < 0.05 ? "critical" : "warning",
        title: "Battery low",
        body: `${name}'s battery is at roughly ${Math.round(batt * 100)}% of its expected life.`,
      });

    if (w.movementType !== "quartz" && w.powerReserveHours && stats.lastMeasuredAt) {
      const lastWorn = [...ms].reverse().find((m) => m.wornToday);
      const hoursIdle = lastWorn ? (Date.now() - +new Date(lastWorn.measuredAt)) / 3_600_000 : Infinity;
      if (hoursIdle > w.powerReserveHours && hoursIdle < w.powerReserveHours * 4)
        push({
          watchId: w.id, kind: "power-reserve-empty", severity: "info",
          title: "Power reserve likely empty",
          body: `${name} probably stopped — last worn ${Math.round(hoursIdle)}h ago (reserve ${w.powerReserveHours}h).`,
        });
    }

    const lastWornDays = (() => {
      const lw = [...ms].reverse().find((m) => m.wornToday);
      return lw ? daysSince(lw.measuredAt) : null;
    })();
    if (lastWornDays != null && lastWornDays > 14)
      push({
        watchId: w.id, kind: "not-worn", severity: "info",
        title: "Not worn recently",
        body: `${name} hasn't been worn in ${lastWornDays} days.`,
      });
  }
  return out;
}

export type { WatchStats };
export { accuracyGrade, healthScore, lastRegulationDate };
