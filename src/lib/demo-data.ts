// ─── Deterministic seed / demo data ─────────────────────────────────────────
// Generates a realistic collection with distinct movement personalities so the
// analytics, insights and anomaly detection all have something real to show.

import type { Measurement, ServiceRecord, Watch, WatchPosition } from "./types";

// Mulberry32 PRNG — deterministic across sessions
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const gauss = (r: () => number) => {
  // Box–Muller
  const u = Math.max(r(), 1e-9);
  const v = r();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};

const POSITIONS: WatchPosition[] = [
  "dial-up", "dial-down", "crown-up", "crown-down", "crown-left", "crown-right",
];

export const DEMO_WATCHES: Watch[] = [
  {
    id: "w-submariner",
    brand: "Rolex", model: "Submariner Date", reference: "126610LN", serial: "7XK20941",
    movementType: "automatic", caliber: "3235", beatRate: 28800, powerReserveHours: 70,
    jewels: 31, coscCertified: true,
    purchaseDate: "2023-05-12", purchasePrice: 10100, currentValue: 12400, currency: "EUR",
    accentColor: "#059669",
    notes: "Daily wearer. Superlative Chronometer (+2/−2 spec).",
  },
  {
    id: "w-speedmaster",
    brand: "Omega", model: "Speedmaster Professional", reference: "310.30.42.50.01.001", serial: "88431265",
    movementType: "manual", caliber: "3861", beatRate: 21600, powerReserveHours: 50,
    jewels: 26, coscCertified: true,
    purchaseDate: "2022-09-03", purchasePrice: 6900, currentValue: 7200, currency: "EUR",
    accentColor: "#3b82f6",
    notes: "Moonwatch, hand-wound every morning.",
  },
  {
    id: "w-seiko",
    brand: "Seiko", model: "Prospex SPB143", reference: "SPB143J1", serial: "1N0524",
    movementType: "automatic", caliber: "6R35", beatRate: 21600, powerReserveHours: 70,
    jewels: 24, coscCertified: false,
    purchaseDate: "2021-06-20", purchasePrice: 1250, currentValue: 1100, currency: "EUR",
    accentColor: "#d97706",
    notes: "Weekend beater. Runs fast, due for regulation.",
  },
  {
    id: "w-nomos",
    brand: "Nomos", model: "Tangente 38", reference: "164", serial: "42117",
    movementType: "manual", caliber: "Alpha", beatRate: 21600, powerReserveHours: 43,
    jewels: 17, coscCertified: false,
    purchaseDate: "2024-02-14", purchasePrice: 1840, currentValue: 1900, currency: "EUR",
    accentColor: "#8b5cf6",
    notes: "Dress watch — office rotation.",
  },
  {
    id: "w-grandseiko",
    brand: "Grand Seiko", model: "SBGX261", reference: "SBGX261", serial: "930647",
    movementType: "quartz", caliber: "9F62", powerReserveHours: undefined,
    jewels: 9, coscCertified: false,
    purchaseDate: "2023-11-01", purchasePrice: 2300, currentValue: 2400, currency: "EUR",
    accentColor: "#ec4899",
    batteryInstalledAt: "2024-03-15", batteryLifeMonths: 30,
    notes: "9F quartz, ±10 s/year spec.",
  },
];

export const DEMO_SERVICES: ServiceRecord[] = [
  {
    id: "s1", watchId: "w-speedmaster", date: "2024-10-08", type: "full-service",
    watchmaker: "Omega Boutique Warsaw", cost: 620, currency: "EUR",
    notes: "Full movement service, new mainspring.", partsReplaced: ["mainspring", "gaskets"],
    pressureTestPassed: true, waterResistanceRating: "5 bar",
  },
  {
    id: "s2", watchId: "w-submariner", date: "2025-08-20", type: "pressure-test",
    watchmaker: "RSC Munich", cost: 90, currency: "EUR",
    pressureTestPassed: true, waterResistanceRating: "30 bar",
  },
  {
    id: "s3", watchId: "w-seiko", date: "2023-03-11", type: "regulation",
    watchmaker: "Local watchmaker (Kraków)", cost: 80, currency: "EUR",
    notes: "Regulated from +25 to +12 s/d. 6R35 has limited adjustment range.",
  },
  {
    id: "s4", watchId: "w-grandseiko", date: "2024-03-15", type: "battery",
    watchmaker: "Seiko Service Center", cost: 45, currency: "EUR",
    notes: "Battery replacement + gasket check.", partsReplaced: ["battery"],
  },
  {
    id: "s5", watchId: "w-nomos", date: "2024-02-14", type: "regulation",
    watchmaker: "Nomos (factory, at purchase)", cost: 0, currency: "EUR",
    notes: "Factory regulation in 6 positions.",
  },
];

interface Personality {
  baseSpd: number;          // mean s/d
  sigma: number;            // day-to-day noise
  driftPerDay: number;      // slow rate change
  wearProb: number;
  tempSensitivity: number;  // s/d per °C from 22
  positionBias: Partial<Record<WatchPosition, number>>;
  measureEvery: [number, number]; // min/max days between measurements
  recentShift?: { fromDay: number; deltaSpd: number; sigmaMult: number }; // anomaly
  powerReserveEffect?: number; // extra s/d when reserve < 35%
}

const PERSONALITIES: Record<string, Personality> = {
  "w-submariner": {
    baseSpd: 1.1, sigma: 0.7, driftPerDay: 0.002, wearProb: 0.75,
    tempSensitivity: -0.03, positionBias: { "dial-up": -0.3, "crown-down": 0.5 },
    measureEvery: [1, 2],
  },
  "w-speedmaster": {
    baseSpd: 3.2, sigma: 1.1, driftPerDay: 0.004, wearProb: 0.45,
    tempSensitivity: -0.05, positionBias: { "dial-up": -0.8, "crown-down": 1.1 },
    measureEvery: [1, 3], powerReserveEffect: 2.2,
  },
  "w-seiko": {
    baseSpd: 9.5, sigma: 2.6, driftPerDay: 0.012, wearProb: 0.3,
    tempSensitivity: -0.09, positionBias: { "dial-up": -1.5, "crown-down": 2.2 },
    measureEvery: [2, 5],
    recentShift: { fromDay: 118, deltaSpd: 4.5, sigmaMult: 1.9 }, // drifting anomaly
  },
  "w-nomos": {
    baseSpd: -2.4, sigma: 1.3, driftPerDay: -0.003, wearProb: 0.5,
    tempSensitivity: -0.04, positionBias: { "dial-up": 0.6, "crown-down": -1.0 },
    measureEvery: [1, 3],
  },
  "w-grandseiko": {
    baseSpd: 0.03, sigma: 0.05, driftPerDay: 0.0, wearProb: 0.35,
    tempSensitivity: 0.002, positionBias: {},
    measureEvery: [3, 7],
  },
};

const pad = (n: number) => String(n).padStart(2, "0");
const hms = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

export function generateDemoMeasurements(now = new Date()): Measurement[] {
  const out: Measurement[] = [];
  const HISTORY_DAYS = 150;

  for (const watch of DEMO_WATCHES) {
    const p = PERSONALITIES[watch.id];
    const r = rng(watch.id.split("").reduce((a, c) => a + c.charCodeAt(0) * 31, 7));
    let offset = (r() - 0.5) * 4;
    let day = 0;
    let idx = 0;
    let gapDaysPrev = 0;

    while (day <= HISTORY_DAYS) {
      const date = new Date(now);
      date.setDate(date.getDate() - (HISTORY_DAYS - day));
      date.setHours(7 + Math.floor(r() * 3), Math.floor(r() * 60), Math.floor(r() * 60), 0);

      const isWeekend = [0, 6].includes(date.getDay());
      const worn =
        watch.id === "w-seiko"
          ? r() < (isWeekend ? 0.85 : 0.12) // weekend watch
          : r() < p.wearProb;

      const temp = 20 + gauss(r) * 3 + (isWeekend ? 1 : 0);
      const position = worn ? ("on-wrist" as WatchPosition) : POSITIONS[Math.floor(r() * POSITIONS.length)];
      const posBias = p.positionBias[position] ?? 0;
      const powerReserve =
        watch.movementType === "quartz"
          ? undefined
          : Math.round(Math.max(5, Math.min(100, worn ? 70 + r() * 30 : 25 + r() * 45)));
      const prEffect =
        p.powerReserveEffect && powerReserve != null && powerReserve < 35 ? p.powerReserveEffect : 0;

      const shift = p.recentShift && day >= p.recentShift.fromDay ? p.recentShift : null;
      const spd =
        p.baseSpd +
        p.driftPerDay * day +
        (shift?.deltaSpd ?? 0) +
        posBias +
        prEffect +
        (temp - 22) * p.tempSensitivity +
        gauss(r) * p.sigma * (shift?.sigmaMult ?? 1);

      // advance offset by spd × gap
      const gap = Math.max(1, Math.round(p.measureEvery[0] + r() * (p.measureEvery[1] - p.measureEvery[0])));
      if (day > 0) offset += spd * gapDaysPrev;

      const ref = new Date(date);
      const wt = new Date(+date + Math.round(offset * 1000));

      out.push({
        id: `${watch.id}-m${idx++}`,
        watchId: watch.id,
        measuredAt: date.toISOString(),
        referenceTime: hms(ref),
        watchTime: hms(wt),
        offsetSeconds: Math.round(offset * 10) / 10,
        temperatureC: Math.round(temp * 10) / 10,
        position,
        powerReservePct: powerReserve,
        wornToday: worn,
        notes:
          idx % 23 === 0 ? "Synced against NTP pool before measuring." :
          idx % 17 === 0 ? "Left on winder overnight." : undefined,
      });

      gapDaysPrev = gap; // used next iteration
      day += gap;
    }
  }
  return out.sort((a, b) => +new Date(a.measuredAt) - +new Date(b.measuredAt));
}
