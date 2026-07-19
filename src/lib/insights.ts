// ─── Smart insights + notification engine ───────────────────────────────────

import type { Insight, Measurement, Notification, Watch, ServiceRecord } from "./types";
import { computeStats, detectAnomaly, mean, stdDev, type WatchStats } from "./stats";
import { accuracyGrade, batteryRemaining, daysSince, healthScore, lastRegulationDate, nextServiceEstimate } from "./grades";

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
  services: ServiceRecord[]
): Insight[] {
  const stats = computeStats(measurements);
  const out: Insight[] = [];
  const name = `${watch.brand} ${watch.model}`;
  if (stats.samples.length < 3) {
    out.push({
      id: nid(), watchId: watch.id, kind: "recommendation", severity: "neutral",
      text: `Add a few more measurements for ${name} to unlock trend analysis.`,
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
    const sdRec = stdDev(rec.map((s) => s.spd));
    const sdPrev = stdDev(prev.map((s) => s.spd));
    if (sdPrev > 0.2) {
      const change = (sdRec - sdPrev) / sdPrev;
      if (change > 0.2)
        out.push({
          id: nid(), watchId: watch.id, kind: "stability", severity: change > 0.5 ? "critical" : "warning",
          text: `${name} has become ${Math.round(change * 100)}% less stable over the last month.`,
          detail: `Rate σ rose from ±${sdPrev.toFixed(1)} to ±${sdRec.toFixed(1)} s/d.`,
        });
      else if (change < -0.2)
        out.push({
          id: nid(), watchId: watch.id, kind: "stability", severity: "positive",
          text: `${name} is ${Math.round(-change * 100)}% more stable than last month.`,
          detail: `Rate σ improved from ±${sdPrev.toFixed(1)} to ±${sdRec.toFixed(1)} s/d.`,
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

  // COSC check
  if (watch.coscCertified && stats.avgSpd != null) {
    const inCosc = stats.avgSpd >= -4 && stats.avgSpd <= 6;
    out.push({
      id: nid(), watchId: watch.id, kind: "certification",
      severity: inCosc ? "positive" : "warning",
      text: inCosc
        ? `${name} still performs within COSC specification (−4/+6 s/d).`
        : `${name} is running outside COSC specification at ${stats.avgSpd > 0 ? "+" : ""}${stats.avgSpd.toFixed(1)} s/d.`,
    });
  }

  // Regulation recommendation
  if (watch.movementType !== "quartz" && stats.avgSpd != null && Math.abs(stats.avgSpd) > 8) {
    const months = Math.abs(stats.avgSpd) > 15 ? 1 : 3;
    out.push({
      id: nid(), watchId: watch.id, kind: "recommendation",
      severity: months === 1 ? "critical" : "warning",
      text: `Recommend regulation within ${months} month${months > 1 ? "s" : ""} — average rate is ${stats.avgSpd > 0 ? "+" : ""}${stats.avgSpd.toFixed(1)} s/d.`,
    });
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

  // Power reserve behavior
  const lowPR = stats.samples.filter((s, i) => {
    const m = measurements.find((mm) => mm.measuredAt === s.date);
    return m?.powerReservePct != null && m.powerReservePct < 35 && i > 0;
  });
  const highPR = stats.samples.filter((s) => {
    const m = measurements.find((mm) => mm.measuredAt === s.date);
    return m?.powerReservePct != null && m.powerReservePct >= 65;
  });
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

  // Anomaly detection
  const anomaly = detectAnomaly(stats.samples);
  if (anomaly?.drifting)
    out.push({
      id: nid(), watchId: watch.id, kind: "trend",
      severity: Math.abs(anomaly.zScore) > 2.5 ? "critical" : "warning",
      text: `${name} is drifting outside its normal behavior — recent rate ${anomaly.recentAvg > 0 ? "+" : ""}${anomaly.recentAvg.toFixed(1)} s/d vs baseline ${anomaly.baselineAvg > 0 ? "+" : ""}${anomaly.baselineAvg.toFixed(1)} s/d (z=${anomaly.zScore.toFixed(1)}).`,
    });

  return out;
}

export function generateNotifications(
  watches: Watch[],
  measurementsByWatch: Map<string, Measurement[]>,
  servicesByWatch: Map<string, ServiceRecord[]>,
  reminderDays = 3
): Notification[] {
  const out: Notification[] = [];
  let n = 0;
  const push = (p: Omit<Notification, "id" | "createdAt" | "read">) =>
    out.push({ ...p, id: `ntf-${++n}`, createdAt: new Date().toISOString(), read: false });

  for (const w of watches.filter((x) => !x.archived)) {
    const ms = measurementsByWatch.get(w.id) ?? [];
    const svcs = servicesByWatch.get(w.id) ?? [];
    const stats = computeStats(ms);
    const name = `${w.brand} ${w.model}`;

    const lastDays = daysSince(stats.lastMeasuredAt);
    if (lastDays != null && lastDays > reminderDays)
      push({
        watchId: w.id, kind: "measurement-overdue", severity: lastDays > reminderDays * 3 ? "warning" : "info",
        title: "Measurement overdue",
        body: `${name} hasn't been measured in ${lastDays} days.`,
      });

    const anomaly = detectAnomaly(stats.samples);
    if (anomaly?.drifting)
      push({
        watchId: w.id, kind: "trend-change", severity: Math.abs(anomaly.zScore) > 2.5 ? "critical" : "warning",
        title: "Trend change detected",
        body: `${name}'s rate shifted to ${anomaly.recentAvg > 0 ? "+" : ""}${anomaly.recentAvg.toFixed(1)} s/d (baseline ${anomaly.baselineAvg > 0 ? "+" : ""}${anomaly.baselineAvg.toFixed(1)}).`,
      });

    if (stats.weeklyVariance != null && stats.monthlyVariance != null && stats.weeklyVariance > stats.monthlyVariance * 2 && stats.weeklyVariance > 2)
      push({
        watchId: w.id, kind: "variance-increase", severity: "warning",
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
