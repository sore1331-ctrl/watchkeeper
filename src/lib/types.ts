// ─── WatchKeeper domain types ────────────────────────────────────────────────

export type MovementType = "automatic" | "manual" | "quartz";

export type WatchPosition =
  | "dial-up"
  | "dial-down"
  | "crown-up"
  | "crown-down"
  | "crown-left"
  | "crown-right"
  | "on-wrist";

export type AccuracyGrade =
  | "COSC"
  | "Excellent"
  | "Very Good"
  | "Good"
  | "Fair"
  | "Poor"
  | "Critical";

export type HealthLabel =
  | "Excellent"
  | "Very Good"
  | "Good"
  | "Needs Regulation"
  | "Needs Service";

export type ServiceType =
  | "full-service"
  | "regulation"
  | "pressure-test"
  | "battery"
  | "oil-service"
  | "polishing"
  | "parts-replacement"
  | "water-resistance";

export interface ServiceRecord {
  id: string;
  watchId: string;
  date: string; // ISO date
  type: ServiceType;
  watchmaker: string;
  cost: number;
  currency: string;
  notes?: string;
  partsReplaced?: string[];
  pressureTestPassed?: boolean;
  waterResistanceRating?: string;
}

export interface Measurement {
  id: string;
  watchId: string;
  /** ISO datetime the measurement was taken */
  measuredAt: string;
  /** reference (atomic) time hh:mm:ss */
  referenceTime: string;
  /** what the watch displayed hh:mm:ss */
  watchTime: string;
  /** watch time minus reference time, in seconds (+ = fast) */
  offsetSeconds: number;
  temperatureC?: number;
  position?: WatchPosition;
  powerReservePct?: number;
  wornToday: boolean;
  notes?: string;
  photoUrl?: string;
}

export interface Watch {
  id: string;
  brand: string;
  model: string;
  reference?: string;
  serial?: string;
  movementType: MovementType;
  caliber?: string;
  /** vibrations per hour, e.g. 28800 */
  beatRate?: number;
  /** hours */
  powerReserveHours?: number;
  jewels?: number;
  coscCertified: boolean;
  purchaseDate?: string;
  purchasePrice?: number;
  currentValue?: number;
  currency: string;
  photoUrl?: string;
  accentColor: string;
  notes?: string;
  batteryInstalledAt?: string; // quartz
  batteryLifeMonths?: number;
  warrantyUntil?: string;
  insured?: boolean;
  archived?: boolean;
}

export interface Notification {
  id: string;
  watchId?: string;
  kind:
    | "measurement-overdue"
    | "variance-increase"
    | "service-due"
    | "battery-low"
    | "power-reserve-empty"
    | "not-worn"
    | "trend-change";
  severity: "info" | "warning" | "critical";
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
}

export interface Insight {
  id: string;
  watchId?: string;
  kind: "stability" | "rate" | "certification" | "recommendation" | "position" | "wear" | "power" | "trend";
  severity: "positive" | "neutral" | "warning" | "critical";
  text: string;
  detail?: string;
}

export interface AppSettings {
  displayName: string;
  temperatureUnit: "C" | "F";
  measurementReminderDays: number;
  serviceIntervalYears: number;
  theme: "dark" | "light" | "system";
}
