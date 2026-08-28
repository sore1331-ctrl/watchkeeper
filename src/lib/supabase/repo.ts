"use client";

// ─── Supabase repository ────────────────────────────────────────────────────
// All tables are namespaced wk_* and protected by RLS (user_id = auth.uid()),
// so a query can only ever see the signed-in user's own rows.
// Every function is a no-op when Supabase isn't configured or nobody is
// signed in — the app stays fully usable in local-only mode.

import type {
  Measurement, MovementType, ServiceRecord, ServiceType, Watch, WatchPosition, WishlistItem,
} from "../types";
import { getSupabase } from "./client";

type Client = NonNullable<ReturnType<typeof getSupabase>>;

async function withUser(): Promise<{ sb: Client; userId: string } | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  if (!data.session) return null;
  return { sb, userId: data.session.user.id };
}

// ── row ⇄ domain mapping ────────────────────────────────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any */
const watchRow = (w: Watch, userId: string) => ({
  id: w.id, user_id: userId,
  brand: w.brand, model: w.model, reference: w.reference ?? null, serial: w.serial ?? null,
  movement_type: w.movementType, caliber: w.caliber ?? null, beat_rate: w.beatRate ?? null,
  power_reserve_hours: w.powerReserveHours ?? null, jewels: w.jewels ?? null,
  cosc_certified: w.coscCertified,
  rate_spec_min: w.rateSpecMin ?? null, rate_spec_max: w.rateSpecMax ?? null,
  rate_spec_source: w.rateSpecSource ?? null,
  purchase_date: w.purchaseDate || null, purchase_price: w.purchasePrice ?? null,
  current_value: w.currentValue ?? null, currency: w.currency,
  photo_url: w.photoUrl ?? null, accent_color: w.accentColor, notes: w.notes ?? null,
  battery_installed_at: w.batteryInstalledAt || null,
  battery_life_months: w.batteryLifeMonths ?? null,
  warranty_until: w.warrantyUntil || null, insured: w.insured ?? false,
  archived: w.archived ?? false,
  updated_at: w.updatedAt ?? new Date().toISOString(),
});

const toWatch = (r: any): Watch => ({
  id: r.id, brand: r.brand, model: r.model,
  reference: r.reference ?? undefined, serial: r.serial ?? undefined,
  movementType: r.movement_type as MovementType, caliber: r.caliber ?? undefined,
  beatRate: r.beat_rate ?? undefined,
  powerReserveHours: r.power_reserve_hours ?? undefined,
  jewels: r.jewels ?? undefined, coscCertified: !!r.cosc_certified,
  rateSpecMin: r.rate_spec_min ?? undefined, rateSpecMax: r.rate_spec_max ?? undefined,
  rateSpecSource: r.rate_spec_source ?? undefined,
  purchaseDate: r.purchase_date ?? undefined, purchasePrice: r.purchase_price ?? undefined,
  currentValue: r.current_value ?? undefined, currency: r.currency ?? "EUR",
  photoUrl: r.photo_url ?? undefined, accentColor: r.accent_color ?? "#059669",
  notes: r.notes ?? undefined,
  batteryInstalledAt: r.battery_installed_at ?? undefined,
  batteryLifeMonths: r.battery_life_months ?? undefined,
  warrantyUntil: r.warranty_until ?? undefined, insured: r.insured ?? undefined,
  archived: r.archived ?? undefined,
  updatedAt: r.updated_at ?? undefined,
});

const measurementRow = (m: Measurement, userId: string) => ({
  id: m.id, user_id: userId, watch_id: m.watchId,
  measured_at: m.measuredAt, reference_time: m.referenceTime, watch_time: m.watchTime,
  offset_seconds: m.offsetSeconds, temperature_c: m.temperatureC ?? null,
  position: m.position ?? null, power_reserve_pct: m.powerReservePct ?? null,
  worn_today: m.wornToday, time_adjusted: m.timeAdjusted ?? false,
  exclude_from_rate: m.excludeFromRate ?? false,
  notes: m.notes ?? null, photo_url: m.photoUrl ?? null,
  updated_at: m.updatedAt ?? new Date().toISOString(),
});

const toMeasurement = (r: any): Measurement => ({
  id: r.id, watchId: r.watch_id, measuredAt: r.measured_at,
  referenceTime: r.reference_time, watchTime: r.watch_time,
  offsetSeconds: Number(r.offset_seconds),
  temperatureC: r.temperature_c == null ? undefined : Number(r.temperature_c),
  position: (r.position ?? undefined) as WatchPosition | undefined,
  powerReservePct: r.power_reserve_pct == null ? undefined : Number(r.power_reserve_pct),
  wornToday: !!r.worn_today, timeAdjusted: r.time_adjusted || undefined,
  excludeFromRate: r.exclude_from_rate || undefined,
  notes: r.notes ?? undefined, photoUrl: r.photo_url ?? undefined,
  updatedAt: r.updated_at ?? undefined,
});

const serviceRow = (s: ServiceRecord, userId: string) => ({
  id: s.id, user_id: userId, watch_id: s.watchId,
  date: s.date, type: s.type, watchmaker: s.watchmaker,
  cost: s.cost, currency: s.currency, notes: s.notes ?? null,
  parts_replaced: s.partsReplaced ?? null,
  pressure_test_passed: s.pressureTestPassed ?? null,
  water_resistance_rating: s.waterResistanceRating ?? null,
  updated_at: s.updatedAt ?? new Date().toISOString(),
});

const wishlistRow = (w: WishlistItem, userId: string) => ({
  id: w.id, user_id: userId,
  brand: w.brand, model: w.model, reference: w.reference ?? null,
  movement_type: w.movementType ?? null, caliber: w.caliber ?? null,
  target_price: w.targetPrice ?? null, currency: w.currency,
  priority: w.priority, status: w.status,
  url: w.url ?? null, notes: w.notes ?? null,
  added_at: w.addedAt, acquired_watch_id: w.acquiredWatchId ?? null,
  updated_at: w.updatedAt ?? new Date().toISOString(),
});

const toWishlist = (r: any): WishlistItem => ({
  id: r.id, brand: r.brand, model: r.model,
  reference: r.reference ?? undefined,
  movementType: (r.movement_type ?? undefined) as MovementType | undefined,
  caliber: r.caliber ?? undefined,
  targetPrice: r.target_price == null ? undefined : Number(r.target_price),
  currency: r.currency ?? "GBP",
  priority: r.priority as WishlistItem["priority"],
  status: r.status as WishlistItem["status"],
  url: r.url ?? undefined, notes: r.notes ?? undefined,
  addedAt: r.added_at, acquiredWatchId: r.acquired_watch_id ?? undefined,
  updatedAt: r.updated_at ?? undefined,
});

const toService = (r: any): ServiceRecord => ({
  id: r.id, watchId: r.watch_id, date: r.date, type: r.type as ServiceType,
  watchmaker: r.watchmaker ?? "—", cost: Number(r.cost ?? 0), currency: r.currency ?? "EUR",
  notes: r.notes ?? undefined, partsReplaced: r.parts_replaced ?? undefined,
  pressureTestPassed: r.pressure_test_passed ?? undefined,
  waterResistanceRating: r.water_resistance_rating ?? undefined,
  updatedAt: r.updated_at ?? undefined,
});
/* eslint-enable @typescript-eslint/no-explicit-any */

// ── single-record mirrors (fire-and-forget on local mutations) ──────────────

export async function upsertWatch(w: Watch) {
  const ctx = await withUser();
  if (!ctx) return;
  await ctx.sb.from("wk_watches").upsert(watchRow(w, ctx.userId));
}

export async function deleteWatch(id: string) {
  const ctx = await withUser();
  if (!ctx) return;
  await ctx.sb.from("wk_watches").delete().eq("id", id);
}

export async function upsertMeasurement(m: Measurement) {
  const ctx = await withUser();
  if (!ctx) return;
  await ctx.sb.from("wk_measurements").upsert(measurementRow(m, ctx.userId));
}

export async function deleteMeasurement(id: string) {
  const ctx = await withUser();
  if (!ctx) return;
  await ctx.sb.from("wk_measurements").delete().eq("id", id);
}

export async function upsertService(s: ServiceRecord) {
  const ctx = await withUser();
  if (!ctx) return;
  await ctx.sb.from("wk_services").upsert(serviceRow(s, ctx.userId));
}

export async function deleteService(id: string) {
  const ctx = await withUser();
  if (!ctx) return;
  await ctx.sb.from("wk_services").delete().eq("id", id);
}

// ── bulk sync ───────────────────────────────────────────────────────────────

export async function upsertWishlistItem(w: WishlistItem) {
  const ctx = await withUser();
  if (!ctx) return;
  await ctx.sb.from("wk_wishlist").upsert(wishlistRow(w, ctx.userId));
}

export async function deleteWishlistItem(id: string) {
  const ctx = await withUser();
  if (!ctx) return;
  await ctx.sb.from("wk_wishlist").delete().eq("id", id);
}

export interface CloudSnapshot {
  watches: Watch[];
  measurements: Measurement[];
  services: ServiceRecord[];
  wishlist: WishlistItem[];
}

/** Everything this user has in the cloud. Throws so the caller can surface it. */
export async function pullAll(): Promise<CloudSnapshot | null> {
  const ctx = await withUser();
  if (!ctx) return null;

  // measurements can be numerous — page through rather than hit the row cap
  const measurements: Measurement[] = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await ctx.sb
      .from("wk_measurements").select("*")
      .order("measured_at", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    measurements.push(...(data ?? []).map(toMeasurement));
    if (!data || data.length < PAGE) break;
  }

  const [w, s, wl] = await Promise.all([
    ctx.sb.from("wk_watches").select("*"),
    ctx.sb.from("wk_services").select("*"),
    ctx.sb.from("wk_wishlist").select("*"),
  ]);
  if (w.error) throw new Error(w.error.message);
  if (s.error) throw new Error(s.error.message);
  if (wl.error) throw new Error(wl.error.message);

  return {
    watches: (w.data ?? []).map(toWatch),
    measurements,
    services: (s.data ?? []).map(toService),
    wishlist: (wl.data ?? []).map(toWishlist),
  };
}

/** Upload records in chunks. Throws on the first failure so nothing is assumed synced. */
export async function pushAll(snapshot: Partial<CloudSnapshot>): Promise<void> {
  const ctx = await withUser();
  if (!ctx) return;
  const CHUNK = 500;

  const send = async <T>(
    table: string,
    rows: T[],
    map: (r: T, uid: string) => object
  ) => {
    for (let i = 0; i < rows.length; i += CHUNK) {
      const batch = rows.slice(i, i + CHUNK).map((r) => map(r, ctx.userId));
      const { error } = await ctx.sb.from(table).upsert(batch);
      if (error) throw new Error(`${table}: ${error.message}`);
    }
  };

  // watches first — measurements, services and acquired wishlist items reference them
  await send("wk_watches", snapshot.watches ?? [], watchRow);
  await send("wk_measurements", snapshot.measurements ?? [], measurementRow);
  await send("wk_services", snapshot.services ?? [], serviceRow);
  await send("wk_wishlist", snapshot.wishlist ?? [], wishlistRow);
}
