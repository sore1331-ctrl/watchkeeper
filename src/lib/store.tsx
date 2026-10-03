"use client";

// ─── WatchKeeper data store ─────────────────────────────────────────────────
// Local-first: state lives in React context and persists to localStorage.
// When Supabase env vars are configured and a session exists, mutations are
// mirrored to Supabase (cloud sync) via the repository in lib/supabase/repo.

import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from "react";
import type {
  AppSettings, Insight, Measurement, Notification, ServiceRecord, Watch, WishlistItem,
} from "./types";
import { DEMO_WATCHES, DEMO_SERVICES, DEMO_WISHLIST, generateDemoMeasurements } from "./demo-data";
import { generateInsights, generateNotifications } from "./insights";
import { detectCurrency, uid } from "./utils";
import { getSupabase } from "./supabase/client";
import * as repo from "./supabase/repo";
import { mergeCollection, touch } from "./sync";
import { analyzeWatch, type WatchAnalysis } from "./analysis";
import { findCatalogModel } from "./watch-catalog";

/** Accent colours assigned to new watches, in order. */
const ACCENTS = ["#059669", "#3b82f6", "#d97706", "#8b5cf6", "#ec4899"];

const LS_KEY = "watchkeeper-v1";

/**
 * Dismissals are snoozes, not permanent mutes: a watch that is still overdue
 * next week should say so again. Persisted with the time they were made.
 */
export interface Dismissal {
  key: string;
  at: string;
}

const SNOOZE_DAYS = 7;

interface PersistedState {
  watches: Watch[];
  measurements: Measurement[];
  services: ServiceRecord[];
  wishlist: WishlistItem[];
  settings: AppSettings;
  dismissedNotifications: Dismissal[];
  demo: boolean;
  /** ids this device has already exchanged with the cloud (see lib/sync) */
  syncedIds?: string[];
  /**
   * The account those ids were exchanged with. A different account signing in
   * on this device must never be merged with them: its cloud lacks every one,
   * which would read as "deleted elsewhere", and anything unsynced would be
   * uploaded into the wrong account.
   */
  syncedUserId?: string;
  /**
   * Deletions the cloud has not confirmed yet. Without these a record deleted
   * offline (or whose cloud delete failed) is still in the cloud at the next
   * sync and would simply be merged back in.
   */
  pendingDeletes?: repo.PendingDelete[];
  lastSyncedAt?: string;
}

const OTHER_ACCOUNT_MESSAGE =
  "This device holds data from a different account, so nothing was synced. " +
  "Sign back in to that account, or clear this device first with Settings → Reset to demo data.";

const deleteKey = (d: repo.PendingDelete) => `${d.table}:${d.id}`;

export type SyncState =
  | { status: "off" }            // Supabase not configured
  | { status: "signed-out" }
  | { status: "syncing" }
  | { status: "synced"; at: string | null }
  | { status: "error"; message: string };

const DEFAULT_SETTINGS: AppSettings = {
  displayName: "Collector",
  currency: "GBP", // replaced by the browser's locale on first run
  restingReadings: "separate",
  temperatureUnit: "C",
  measurementReminderDays: 3,
  serviceIntervalYears: 5,
  theme: "dark",
};

interface StoreValue {
  ready: boolean;
  demo: boolean;
  cloudSynced: boolean;
  watches: Watch[];
  measurements: Measurement[];
  services: ServiceRecord[];
  settings: AppSettings;
  notifications: Notification[];
  insights: Insight[];
  measurementsFor: (watchId: string) => Measurement[];
  servicesFor: (watchId: string) => ServiceRecord[];
  /**
   * The finished analysis for a watch — stats, spec, grade, health, anomaly.
   * Pages should use this rather than assembling their own, so every screen
   * necessarily agrees.
   */
  analysisFor: (watchId: string) => WatchAnalysis | null;
  addWatch: (w: Omit<Watch, "id">) => Watch;
  updateWatch: (id: string, patch: Partial<Watch>) => void;
  deleteWatch: (id: string) => void;
  addMeasurement: (m: Omit<Measurement, "id">) => Measurement;
  updateMeasurement: (id: string, patch: Partial<Measurement>) => void;
  deleteMeasurement: (id: string) => void;
  addService: (s: Omit<ServiceRecord, "id">) => ServiceRecord;
  deleteService: (id: string) => void;
  wishlist: WishlistItem[];
  addWishlistItem: (w: Omit<WishlistItem, "id" | "addedAt">) => WishlistItem;
  updateWishlistItem: (id: string, patch: Partial<WishlistItem>) => void;
  deleteWishlistItem: (id: string) => void;
  /** Create a real watch from a wishlist item and mark the item acquired. */
  moveWishlistToCollection: (id: string, purchase?: { price?: number; date?: string }) => Watch | null;
  updateSettings: (patch: Partial<AppSettings>) => void;
  dismissNotification: (id: string) => void;
  resetDemoData: () => void;
  // ── account & sync ──
  supabaseConfigured: boolean;
  user: { id: string; email: string | null } | null;
  sync: SyncState;
  signUp: (email: string, password: string) => Promise<{ needsConfirmation: boolean }>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  syncNow: () => Promise<void>;
  /** JSON of everything on this device, for a manual backup */
  exportBackup: () => string;
  /** Put the records in a backup file back on this device. Throws if it isn't one. */
  importBackup: (json: string) => {
    watches: number; measurements: number; services: number; wishlist: number;
  };
  /** the browser refused the last save (storage full or blocked) */
  saveFailed: boolean;
}

const StoreContext = createContext<StoreValue | null>(null);

function loadPersisted(): PersistedState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedState;

    // Data saved before the currency setting existed: adopt whatever the
    // watches are already labelled with, so the picker opens on the truth
    // rather than silently re-labelling everything.
    const settings = { ...DEFAULT_SETTINGS, ...parsed.settings };
    if (!parsed.settings?.currency) {
      const counts = new Map<string, number>();
      for (const w of parsed.watches ?? []) {
        if (w.currency) counts.set(w.currency, (counts.get(w.currency) ?? 0) + 1);
      }
      const commonest = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
      settings.currency = commonest ?? detectCurrency();
    }

    const loaded: PersistedState = {
      ...parsed,
      settings,
      // earlier builds stored bare keys that never expired
      dismissedNotifications: (parsed.dismissedNotifications ?? []).map((d) =>
        typeof d === "string" ? { key: d as string, at: new Date().toISOString() } : d
      ),
    };
    // Earlier builds gave the sample collection the same ids on every device.
    // If this copy has never been synced, give it its own now.
    const demoIds = new Set(DEMO_WATCHES.map((w) => w.id));
    const hasSharedIds =
      !loaded.syncedIds?.length && (loaded.watches ?? []).some((w) => demoIds.has(w.id));
    return hasSharedIds ? withFreshIds(loaded) : loaded;
  } catch {
    return null;
  }
}

function freshDemoState(): PersistedState {
  // Sample figures are shown in the viewer's own currency — the numbers are
  // illustrative either way, and it avoids inventing a currency for someone.
  const currency = detectCurrency();
  return withFreshIds({
    watches: DEMO_WATCHES.map((w) => ({ ...w, currency })),
    measurements: generateDemoMeasurements(),
    services: DEMO_SERVICES.map((s) => ({ ...s, currency })),
    wishlist: DEMO_WISHLIST.map((w) => ({ ...w, currency })),
    settings: { ...DEFAULT_SETTINGS, currency },
    dismissedNotifications: [],
    demo: true,
  });
}

/**
 * Re-key a collection. Ids are primary keys shared by every account in the
 * cloud, and the sample collection becomes the user's own once they add to
 * it — so each device's copy needs ids no other device has.
 */
function withFreshIds(st: PersistedState): PersistedState {
  const watchIds = new Map(st.watches.map((w) => [w.id, uid()]));
  const wid = (old: string) => watchIds.get(old) ?? old;
  return {
    ...st,
    watches: st.watches.map((w) => ({ ...w, id: wid(w.id) })),
    measurements: st.measurements.map((m) => ({ ...m, id: uid(), watchId: wid(m.watchId) })),
    services: st.services.map((sv) => ({ ...sv, id: uid(), watchId: wid(sv.watchId) })),
    wishlist: (st.wishlist ?? []).map((w) => ({
      ...w, id: uid(),
      acquiredWatchId: w.acquiredWatchId ? wid(w.acquiredWatchId) : undefined,
    })),
    // snoozes are keyed by watch id
    dismissedNotifications: [],
  };
}

/**
 * Snapshot the device's data under a timestamped key before a sync changes
 * it. Cheap insurance: if a sync ever went wrong, the pre-sync state is still
 * sitting in localStorage. Only taken when the sync is about to alter what is
 * on the device, so routine syncs don't rotate the useful snapshots away.
 */
function backupBeforeSync(state: PersistedState) {
  try {
    const key = `${LS_KEY}-backup-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "")}`;
    window.localStorage.setItem(key, JSON.stringify(state));
    // keep only the three most recent backups
    const keys = Object.keys(window.localStorage)
      .filter((k) => k.startsWith(`${LS_KEY}-backup-`))
      .sort();
    for (const k of keys.slice(0, Math.max(0, keys.length - 3))) {
      window.localStorage.removeItem(k);
    }
  } catch {
    /* storage full — proceed; the cloud copy is the backup */
  }
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<PersistedState | null>(null);
  const [cloudSynced, setCloudSynced] = useState(false);
  const [user, setUser] = useState<{ id: string; email: string | null } | null>(null);
  const [sync, setSync] = useState<SyncState>({ status: "off" });
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stateRef = useRef<PersistedState | null>(null);
  const syncing = useRef(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const fromOtherTab = useRef(false);
  stateRef.current = state;

  // hydrate + watch the auth session
  useEffect(() => {
    setState(loadPersisted() ?? freshDemoState());
    const sb = getSupabase();
    if (!sb) {
      setSync({ status: "off" });
      return;
    }
    setSync({ status: "signed-out" });
    sb.auth.getSession().then(({ data }) => {
      setCloudSynced(!!data.session);
      if (data.session)
        setUser({ id: data.session.user.id, email: data.session.user.email ?? null });
    });
    const { data: listener } = sb.auth.onAuthStateChange((_event, session) => {
      setCloudSynced(!!session);
      setUser(session ? { id: session.user.id, email: session.user.email ?? null } : null);
      if (!session) setSync({ status: "signed-out" });
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const save = useCallback((st: PersistedState) => {
    const json = JSON.stringify(st);
    try {
      window.localStorage.setItem(LS_KEY, json);
      setSaveFailed(false);
    } catch {
      // Out of room: the pre-sync snapshots are the only thing that can go.
      try {
        for (const k of Object.keys(window.localStorage))
          if (k.startsWith(`${LS_KEY}-backup-`)) window.localStorage.removeItem(k);
        window.localStorage.setItem(LS_KEY, json);
        setSaveFailed(false);
      } catch {
        setSaveFailed(true);
      }
    }
  }, []);

  // persist (debounced)
  useEffect(() => {
    if (!state) return;
    // state adopted from another tab is already in storage
    if (fromOtherTab.current) {
      fromOtherTab.current = false;
      return;
    }
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveTimer.current = null;
      save(state);
    }, 400);
  }, [state, save]);

  useEffect(() => {
    // don't let the debounce lose the last change when the tab goes away
    const flush = () => {
      if (!saveTimer.current || !stateRef.current) return;
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
      save(stateRef.current);
    };
    // Another tab saved: adopt its copy, or this tab's next save would
    // silently overwrite it with what it loaded earlier.
    const onStorage = (e: StorageEvent) => {
      if (e.key !== LS_KEY || !e.newValue) return;
      const next = loadPersisted();
      if (!next) return;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = null;
      fromOtherTab.current = true;
      setState(next);
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", flush);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", flush);
      window.removeEventListener("storage", onStorage);
    };
  }, [save]);

  const mutate = useCallback((fn: (s: PersistedState) => PersistedState) => {
    setState((s) => (s ? fn(s) : s));
  }, []);

  /**
   * Reconcile this device with the cloud.
   *
   * Order matters for safety: pull, merge in memory, upload anything the
   * cloud is missing, back up locally, and only then commit the merged state.
   * If any step throws, local data is untouched.
   */
  const runSync = useCallback(async () => {
    const current = stateRef.current;
    if (!current || syncing.current) return;
    const sb = getSupabase();
    if (!sb) return;
    const { data: sess } = await sb.auth.getSession();
    if (!sess.session) return;

    const userId = sess.session.user.id;
    syncing.current = true;
    setSync({ status: "syncing" });
    try {
      if (current.syncedUserId && current.syncedUserId !== userId)
        throw new Error(OTHER_ACCOUNT_MESSAGE);

      // Deletions first, so the pull below no longer contains those records.
      const pending = current.pendingDeletes ?? [];
      await repo.pushDeletes(pending);
      const confirmed = new Set(pending.map(deleteKey));
      const stillPending = (st: PersistedState) =>
        (st.pendingDeletes ?? []).filter((d) => !confirmed.has(deleteKey(d)));

      const remote = await repo.pullAll();
      if (!remote) throw new Error("Not signed in");

      // Sample data is not the user's data: never upload it into an account.
      // If the account already holds real watches, the demo simply gives way;
      // if the account is empty, the demo stays on this device untouched.
      if (current.demo) {
        if (remote.watches.length === 0) {
          mutate((st) => ({ ...st, pendingDeletes: stillPending(st) }));
          setSync({ status: "synced", at: new Date().toISOString() });
          return;
        }
        backupBeforeSync(current);
        mutate((st) => ({
          ...st,
          watches: remote.watches,
          measurements: remote.measurements,
          services: remote.services,
          wishlist: remote.wishlist,
          demo: false,
          syncedIds: [
            ...remote.watches.map((r) => r.id),
            ...remote.measurements.map((r) => r.id),
            ...remote.services.map((r) => r.id),
            ...remote.wishlist.map((r) => r.id),
          ],
          syncedUserId: userId,
          pendingDeletes: stillPending(st),
          lastSyncedAt: new Date().toISOString(),
        }));
        setSync({ status: "synced", at: new Date().toISOString() });
        return;
      }

      const syncedIds = new Set(current.syncedIds ?? []);
      const w = mergeCollection(current.watches, remote.watches, syncedIds);
      const m = mergeCollection(current.measurements, remote.measurements, syncedIds);
      const s = mergeCollection(current.services, remote.services, syncedIds);
      const wl = mergeCollection(current.wishlist ?? [], remote.wishlist, syncedIds);

      // Upload what the cloud lacks or has an older copy of. Do this before
      // committing so a failure leaves local data exactly as it was.
      await repo.pushAll({
        watches: w.toUpload as Watch[],
        measurements: m.toUpload as Measurement[],
        services: s.toUpload as ServiceRecord[],
        wishlist: wl.toUpload as WishlistItem[],
      });

      const alters = <T extends { id: string }>(
        res: { merged: T[]; removedRemotely: string[] }, local: T[]
      ) => {
        const mine = new Set(local);
        return res.removedRemotely.length > 0 || res.merged.some((r) => !mine.has(r));
      };
      if (
        alters(w, current.watches) || alters(m, current.measurements) ||
        alters(s, current.services) || alters(wl, current.wishlist ?? [])
      )
        backupBeforeSync(current);

      const at = new Date().toISOString();
      const allIds = [
        ...w.merged.map((r) => r.id),
        ...m.merged.map((r) => r.id),
        ...s.merged.map((r) => r.id),
        ...wl.merged.map((r) => r.id),
      ];
      mutate((st) => {
        // anything deleted while this sync was in flight stays deleted
        const left = stillPending(st);
        const gone = (table: repo.DeleteTable) =>
          new Set(left.filter((d) => d.table === table).map((d) => d.id));
        const goneWatches = gone("watches");
        const keep = <T extends { id: string }>(rows: T[], table: repo.DeleteTable) => {
          const ids = gone(table);
          return ids.size ? rows.filter((r) => !ids.has(r.id)) : rows;
        };
        const ofLiveWatch = <T extends { watchId: string }>(rows: T[]) =>
          goneWatches.size ? rows.filter((r) => !goneWatches.has(r.watchId)) : rows;
        // The merge was computed from the state as it was when the sync began.
        // Anything added or edited since then is newer than all of it.
        const overlay = <T extends { id: string }>(merged: T[], before: T[], now: T[]) => {
          const was = new Set(before);
          const changed = now.filter((r) => !was.has(r));
          if (!changed.length) return merged;
          const ids = new Set(changed.map((r) => r.id));
          return [...merged.filter((r) => !ids.has(r.id)), ...changed];
        };
        return {
          ...st,
          watches: keep(overlay(w.merged as Watch[], current.watches, st.watches), "watches"),
          measurements: ofLiveWatch(keep(
            overlay(m.merged as Measurement[], current.measurements, st.measurements), "measurements")),
          services: ofLiveWatch(keep(
            overlay(s.merged as ServiceRecord[], current.services, st.services), "services")),
          wishlist: keep(
            overlay(wl.merged as WishlistItem[], current.wishlist ?? [], st.wishlist ?? []), "wishlist"),
          demo: false,
          syncedIds: allIds,
          syncedUserId: userId,
          pendingDeletes: left,
          lastSyncedAt: at,
        };
      });
      setSync({ status: "synced", at });
    } catch (e) {
      setSync({ status: "error", message: e instanceof Error ? e.message : "Sync failed" });
    } finally {
      syncing.current = false;
    }
  }, [mutate]);

  // sync on sign-in and when the tab regains focus
  useEffect(() => {
    if (!user || !state) return;
    void runSync();
    const onFocus = () => void runSync();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // The sample collection is never uploaded; once it becomes the user's own
  // (see `demo: false` below) everything on the device needs to go up.
  const isDemo = state?.demo;
  useEffect(() => {
    if (user && isDemo === false) void runSync();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDemo]);

  const value = useMemo<StoreValue>(() => {
    const s = state ?? freshDemoState();
    const byWatch = new Map<string, Measurement[]>();
    for (const m of s.measurements) {
      if (!byWatch.has(m.watchId)) byWatch.set(m.watchId, []);
      byWatch.get(m.watchId)!.push(m);
    }
    const svcByWatch = new Map<string, ServiceRecord[]>();
    for (const sv of s.services) {
      if (!svcByWatch.has(sv.watchId)) svcByWatch.set(sv.watchId, []);
      svcByWatch.get(sv.watchId)!.push(sv);
    }
    const notifications = state
      ? generateNotifications(
          s.watches, byWatch, svcByWatch,
          s.settings.measurementReminderDays, s.settings.restingReadings
        )
          .filter((n) => {
            const snoozed = s.dismissedNotifications.find(
              (d) => d.key === `${n.kind}:${n.watchId}`
            );
            if (!snoozed) return true;
            return Date.now() - +new Date(snoozed.at) > SNOOZE_DAYS * 86_400_000;
          })
      : [];
    const insights = state
      ? s.watches.flatMap((w) =>
          generateInsights(
            w, byWatch.get(w.id) ?? [], svcByWatch.get(w.id) ?? [], s.settings.restingReadings
          )
        )
      : [];

    // Never mirror a change into an account other than the one this device's
    // data belongs to (see syncedUserId).
    // Sample data is never uploaded; changes to it stay on this device.
    const cloud =
      !s.demo && (!user || !s.syncedUserId || s.syncedUserId === user.id) ? repo : null;
    // A failed mirror loses nothing — the next sync sends it — but say so.
    const mirror = (p: Promise<void> | undefined) => {
      p?.catch((e: unknown) =>
        setSync({
          status: "error",
          message:
            `A change could not be saved to your account (${e instanceof Error ? e.message : "network error"}). ` +
            "It is kept on this device and will be sent at the next sync.",
        })
      );
    };
    // Remember a deletion until a sync confirms the cloud has applied it.
    const tombstone = (st: PersistedState, table: repo.DeleteTable, id: string) =>
      user || st.syncedUserId ? [...(st.pendingDeletes ?? []), { table, id }] : st.pendingDeletes;

    return {
      ready: state !== null,
      demo: s.demo,
      cloudSynced,
      watches: s.watches,
      measurements: s.measurements,
      services: s.services,
      settings: s.settings,
      notifications,
      insights,
      measurementsFor: (id) =>
        (byWatch.get(id) ?? []).slice().sort((a, b) => +new Date(a.measuredAt) - +new Date(b.measuredAt)),
      servicesFor: (id) =>
        (svcByWatch.get(id) ?? []).slice().sort((a, b) => a.date.localeCompare(b.date)),
      analysisFor: (id) => {
        const w = s.watches.find((x) => x.id === id);
        if (!w) return null;
        const ms = (byWatch.get(id) ?? [])
          .slice()
          .sort((a, b) => +new Date(a.measuredAt) - +new Date(b.measuredAt));
        const svcs = (svcByWatch.get(id) ?? [])
          .slice()
          .sort((a, b) => a.date.localeCompare(b.date));
        return analyzeWatch(w, ms, svcs, s.settings);
      },
      addWatch: (w) => {
        const created: Watch = touch({ ...w, id: uid() });
        mutate((st) => ({ ...st, demo: false, watches: [...st.watches, created] }));
        mirror(cloud?.upsertWatch(created));
        return created;
      },
      updateWatch: (id, patch) => {
        const cur = s.watches.find((x) => x.id === id);
        const next = cur ? touch({ ...cur, ...patch }) : null;
        mutate((st) => ({
          ...st,
          watches: st.watches.map((x) => (x.id === id ? touch({ ...x, ...patch }) : x)),
        }));
        if (next) mirror(cloud?.upsertWatch(next));
      },
      deleteWatch: (id) => {
        mutate((st) => ({
          ...st,
          watches: st.watches.filter((x) => x.id !== id),
          measurements: st.measurements.filter((m) => m.watchId !== id),
          services: st.services.filter((x) => x.watchId !== id),
          pendingDeletes: tombstone(st, "watches", id),
        }));
        mirror(cloud?.deleteWatch(id));
      },
      addMeasurement: (m) => {
        const created: Measurement = touch({ ...m, id: uid() });
        // adding a reading to a sample watch makes the collection yours
        mutate((st) => ({ ...st, demo: false, measurements: [...st.measurements, created] }));
        mirror(cloud?.upsertMeasurement(created));
        return created;
      },
      updateMeasurement: (id, patch) => {
        const cur = s.measurements.find((x) => x.id === id);
        const next = cur ? touch({ ...cur, ...patch }) : null;
        mutate((st) => ({
          ...st,
          measurements: st.measurements.map((x) => (x.id === id ? touch({ ...x, ...patch }) : x)),
        }));
        if (next) mirror(cloud?.upsertMeasurement(next));
      },
      deleteMeasurement: (id) => {
        mutate((st) => ({
          ...st,
          measurements: st.measurements.filter((x) => x.id !== id),
          pendingDeletes: tombstone(st, "measurements", id),
        }));
        mirror(cloud?.deleteMeasurement(id));
      },
      addService: (sv) => {
        const created: ServiceRecord = touch({ ...sv, id: uid() });
        mutate((st) => ({ ...st, demo: false, services: [...st.services, created] }));
        mirror(cloud?.upsertService(created));
        return created;
      },
      deleteService: (id) => {
        mutate((st) => ({
          ...st,
          services: st.services.filter((x) => x.id !== id),
          pendingDeletes: tombstone(st, "services", id),
        }));
        mirror(cloud?.deleteService(id));
      },
      wishlist: s.wishlist ?? [],
      addWishlistItem: (w) => {
        const created: WishlistItem = touch({
          ...w, id: uid(), addedAt: new Date().toISOString(),
        });
        mutate((st) => ({ ...st, wishlist: [...(st.wishlist ?? []), created] }));
        mirror(cloud?.upsertWishlistItem(created));
        return created;
      },
      updateWishlistItem: (id, patch) => {
        const cur = (s.wishlist ?? []).find((x) => x.id === id);
        const next = cur ? touch({ ...cur, ...patch }) : null;
        mutate((st) => ({
          ...st,
          wishlist: (st.wishlist ?? []).map((x) => (x.id === id ? touch({ ...x, ...patch }) : x)),
        }));
        if (next) mirror(cloud?.upsertWishlistItem(next));
      },
      deleteWishlistItem: (id) => {
        mutate((st) => ({
          ...st,
          wishlist: (st.wishlist ?? []).filter((x) => x.id !== id),
          pendingDeletes: tombstone(st, "wishlist", id),
        }));
        mirror(cloud?.deleteWishlistItem(id));
      },
      moveWishlistToCollection: (id, purchase) => {
        const item = (s.wishlist ?? []).find((x) => x.id === id);
        if (!item) return null;
        // Carry across everything already known, and fill the movement specs
        // from the catalog so the new watch is graded correctly from day one.
        const known = findCatalogModel(item.brand, item.model);
        const watch: Watch = touch({
          id: uid(),
          brand: item.brand,
          model: item.model,
          reference: item.reference ?? known?.reference,
          movementType: item.movementType ?? known?.movementType ?? "automatic",
          caliber: item.caliber ?? known?.caliber,
          beatRate: known?.beatRate,
          powerReserveHours: known?.powerReserveHours,
          jewels: known?.jewels,
          coscCertified: known?.cosc ?? false,
          purchaseDate: purchase?.date ?? new Date().toISOString().slice(0, 10),
          purchasePrice: purchase?.price ?? item.targetPrice,
          currentValue: purchase?.price ?? item.targetPrice,
          currency: item.currency,
          accentColor: ACCENTS[(s.watches.length + 1) % ACCENTS.length],
          notes: item.notes,
        });
        const acquired = touch({
          ...item,
          status: "acquired" as const,
          acquiredWatchId: watch.id,
        });
        mutate((st) => ({
          ...st,
          demo: false,
          watches: [...st.watches, watch],
          wishlist: (st.wishlist ?? []).map((x) => (x.id === id ? acquired : x)),
        }));
        mirror(cloud?.upsertWatch(watch));
        mirror(cloud?.upsertWishlistItem(acquired));
        return watch;
      },
      updateSettings: (patch) => {
        mutate((st) => {
          const next = { ...st, settings: { ...st.settings, ...patch } };
          // Changing the collection currency re-labels the watches that were
          // still on the previous default. Amounts are never converted — the
          // figure you typed stays the figure you typed.
          if (patch.currency && patch.currency !== st.settings.currency) {
            const from = st.settings.currency;
            next.watches = st.watches.map((w) =>
              w.currency === from ? touch({ ...w, currency: patch.currency! }) : w
            );
            next.services = st.services.map((sv) =>
              sv.currency === from ? touch({ ...sv, currency: patch.currency! }) : sv
            );
          }
          return next;
        });
      },
      dismissNotification: (key) => {
        mutate((st) => ({
          ...st,
          dismissedNotifications: [
            ...st.dismissedNotifications.filter((d) => d.key !== key),
            { key, at: new Date().toISOString() },
          ],
        }));
      },
      resetDemoData: () => setState(freshDemoState()),

      // ── account & sync ──
      supabaseConfigured: !!getSupabase(),
      user,
      sync,
      signUp: async (email, password) => {
        const sb = getSupabase();
        if (!sb) throw new Error("Cloud sync is not configured");
        const { data, error } = await sb.auth.signUp({ email, password });
        if (error) throw new Error(error.message);
        // With email confirmation enabled Supabase returns a user but no
        // session until the link is clicked.
        return { needsConfirmation: !data.session };
      },
      signIn: async (email, password) => {
        const sb = getSupabase();
        if (!sb) throw new Error("Cloud sync is not configured");
        const { error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw new Error(error.message);
      },
      signOut: async () => {
        const sb = getSupabase();
        if (!sb) return;
        await sb.auth.signOut();
        // Local data deliberately stays put — signing out is not a delete.
        setSync({ status: "signed-out" });
      },
      syncNow: runSync,
      exportBackup: () =>
        JSON.stringify(
          {
            exportedAt: new Date().toISOString(),
            watches: s.watches,
            measurements: s.measurements,
            services: s.services,
            wishlist: s.wishlist ?? [],
            settings: s.settings,
          },
          null,
          2
        ),
      importBackup: (json) => {
        let data: Record<string, unknown>;
        try {
          data = JSON.parse(json);
        } catch {
          throw new Error("That file is not valid JSON.");
        }
        const notBackup = new Error("That file is not a WatchKeeper backup.");
        if (!data || typeof data !== "object") throw notBackup;
        const rows = <T extends { id: string }>(
          v: unknown, ok: (r: Record<string, unknown>) => boolean
        ): T[] => {
          if (v == null) return [];
          if (!Array.isArray(v)) throw notBackup;
          for (const r of v)
            if (!r || typeof r !== "object" || typeof r.id !== "string" || !ok(r)) throw notBackup;
          return v as T[];
        };
        const str = (x: unknown) => typeof x === "string";
        const watches = rows<Watch>(data.watches, (r) => str(r.brand) && str(r.model));
        const measurements = rows<Measurement>(data.measurements, (r) =>
          str(r.watchId) && typeof r.offsetSeconds === "number" &&
          str(r.measuredAt) && !Number.isNaN(+new Date(r.measuredAt as string)));
        const services = rows<ServiceRecord>(data.services, (r) => str(r.watchId) && str(r.date));
        const wishlist = rows<WishlistItem>(data.wishlist, (r) => str(r.brand) && str(r.model));
        if (!watches.length && !measurements.length && !services.length && !wishlist.length)
          throw new Error("That backup contains no records.");

        const restored = new Set(
          [...watches, ...measurements, ...services, ...wishlist].map((r) => r.id)
        );
        // Restored records replace their twins and are stamped as just changed,
        // so the next sync uploads them rather than preferring an older cloud copy.
        const put = <T extends { id: string }>(have: T[], add: T[]) => [
          ...have.filter((r) => !restored.has(r.id)),
          ...add.map((r) => touch(r) as T),
        ];
        mutate((st) => {
          // a restore replaces the sample collection; it adds to a real one
          const base = st.demo
            ? { ...st, watches: [], measurements: [], services: [], wishlist: [] }
            : st;
          return {
            ...base,
            demo: false,
            watches: put(base.watches, watches),
            measurements: put(base.measurements, measurements),
            services: put(base.services, services),
            wishlist: put(base.wishlist ?? [], wishlist),
            // not "deleted elsewhere" if the cloud lacks them — they are back
            syncedIds: (st.syncedIds ?? []).filter((x) => !restored.has(x)),
            pendingDeletes: (st.pendingDeletes ?? []).filter((d) => !restored.has(d.id)),
          };
        });
        return {
          watches: watches.length, measurements: measurements.length,
          services: services.length, wishlist: wishlist.length,
        };
      },
      saveFailed,
    };
  }, [state, cloudSynced, mutate, user, sync, runSync, saveFailed]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}
