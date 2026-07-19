"use client";

// ─── Supabase repository (cloud sync mirror) ────────────────────────────────
// Fire-and-forget mirrors of local mutations. All tables are namespaced wk_*
// and protected by RLS (user_id = auth.uid()). No-ops when Supabase is not
// configured or the user is signed out.

import type { Measurement, ServiceRecord, Watch } from "../types";
import { getSupabase } from "./client";

async function withUser(): Promise<{ sb: NonNullable<ReturnType<typeof getSupabase>>; userId: string } | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  if (!data.session) return null;
  return { sb, userId: data.session.user.id };
}

export async function upsertWatch(w: Watch) {
  const ctx = await withUser();
  if (!ctx) return;
  await ctx.sb.from("wk_watches").upsert({
    id: w.id, user_id: ctx.userId,
    brand: w.brand, model: w.model, reference: w.reference, serial: w.serial,
    movement_type: w.movementType, caliber: w.caliber, beat_rate: w.beatRate,
    power_reserve_hours: w.powerReserveHours, jewels: w.jewels,
    cosc_certified: w.coscCertified, purchase_date: w.purchaseDate,
    purchase_price: w.purchasePrice, current_value: w.currentValue,
    currency: w.currency, photo_url: w.photoUrl, accent_color: w.accentColor,
    notes: w.notes, battery_installed_at: w.batteryInstalledAt,
    battery_life_months: w.batteryLifeMonths, warranty_until: w.warrantyUntil,
    insured: w.insured, archived: w.archived ?? false,
  });
}

export async function deleteWatch(id: string) {
  const ctx = await withUser();
  if (!ctx) return;
  await ctx.sb.from("wk_watches").delete().eq("id", id);
}

export async function upsertMeasurement(m: Measurement) {
  const ctx = await withUser();
  if (!ctx) return;
  await ctx.sb.from("wk_measurements").upsert({
    id: m.id, user_id: ctx.userId, watch_id: m.watchId,
    measured_at: m.measuredAt, reference_time: m.referenceTime,
    watch_time: m.watchTime, offset_seconds: m.offsetSeconds,
    temperature_c: m.temperatureC, position: m.position,
    power_reserve_pct: m.powerReservePct, worn_today: m.wornToday,
    notes: m.notes, photo_url: m.photoUrl,
  });
}

export async function deleteMeasurement(id: string) {
  const ctx = await withUser();
  if (!ctx) return;
  await ctx.sb.from("wk_measurements").delete().eq("id", id);
}

export async function upsertService(s: ServiceRecord) {
  const ctx = await withUser();
  if (!ctx) return;
  await ctx.sb.from("wk_services").upsert({
    id: s.id, user_id: ctx.userId, watch_id: s.watchId,
    date: s.date, type: s.type, watchmaker: s.watchmaker,
    cost: s.cost, currency: s.currency, notes: s.notes,
    parts_replaced: s.partsReplaced,
    pressure_test_passed: s.pressureTestPassed,
    water_resistance_rating: s.waterResistanceRating,
  });
}

export async function deleteService(id: string) {
  const ctx = await withUser();
  if (!ctx) return;
  await ctx.sb.from("wk_services").delete().eq("id", id);
}
