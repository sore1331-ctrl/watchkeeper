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

/**
 * Health verdicts describe state, or name a due date. They never diagnose a
 * fault from rate readings alone — wrist data cannot support that, and an
 * unwarranted "needs service" is worse than no verdict at all. Anything the
 * app merely suspects is reported as an insight with its evidence instead.
 */
export type HealthLabel =
  | "Excellent"
  | "Very Good"
  | "Good"
  | "Regulation due"
  | "Service due";

export type ServiceType =
  | "full-service"
  | "regulation"
  | "pressure-test"
  | "battery"
  | "oil-service"
  | "polishing"
  | "parts-replacement"
  | "water-resistance";

/**
 * Every synced record carries the moment it last changed on the device that
 * changed it. Sync resolves conflicts by keeping the newer one.
 */
export interface Synced {
  updatedAt?: string;
}

export interface ServiceRecord extends Synced {
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

export interface Measurement extends Synced {
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
  /**
   * The watch was reset or hand-corrected since the previous measurement.
   * The offset jump across that gap is the correction, not drift, so no rate
   * sample is produced for it — otherwise a −60s reset reads as a wild rate.
   */
  timeAdjusted?: boolean;
  notes?: string;
  photoUrl?: string;
}

export interface Watch extends Synced {
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
  /**
   * Manufacturer's daily rate tolerance in seconds/day (e.g. Seiko 4R34 is
   * −35/+45). Grading is judged against this band when known, rather than
   * against a generic chronometer scale.
   */
  rateSpecMin?: number;
  rateSpecMax?: number;
  rateSpecSource?: string;
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

export type WishlistStatus = "wanted" | "watching" | "reserved" | "acquired" | "passed";
export type WishlistPriority = "high" | "medium" | "low";

/** A watch you don't own yet. Becomes a Watch when you buy it. */
export interface WishlistItem extends Synced {
  id: string;
  brand: string;
  model: string;
  reference?: string;
  movementType?: MovementType;
  caliber?: string;
  /** what you're willing to pay / what you've seen it for */
  targetPrice?: number;
  currency: string;
  priority: WishlistPriority;
  status: WishlistStatus;
  /** listing or reference link */
  url?: string;
  notes?: string;
  addedAt: string;
  /** set once the item has been moved into the collection */
  acquiredWatchId?: string;
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

/**
 * How intervals the watch spent resting (typically overnight) feed the
 * headline figures. A watch on the nightstand is measuring one position at
 * a stable temperature; on the wrist it is measuring a mix of positions at
 * body heat. Averaging the two answers neither question well.
 */
export type RestingHandling = "include" | "separate" | "exclude";

export interface AppSettings {
  displayName: string;
  /** ISO 4217 code used for new watches and collection totals */
  currency: string;
  restingReadings: RestingHandling;
  temperatureUnit: "C" | "F";
  measurementReminderDays: number;
  serviceIntervalYears: number;
  theme: "dark" | "light" | "system";
}
