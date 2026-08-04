"use client";

// ─── WatchKeeper data store ─────────────────────────────────────────────────
// Local-first: state lives in React context and persists to localStorage.
// When Supabase env vars are configured and a session exists, mutations are
// mirrored to Supabase (cloud sync) via the repository in lib/supabase/repo.

import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from "react";
import type {
  AppSettings, Insight, Measurement, Notification, ServiceRecord, Watch,
} from "./types";
import { DEMO_WATCHES, DEMO_SERVICES, generateDemoMeasurements } from "./demo-data";
import { generateInsights, generateNotifications } from "./insights";
import { uid } from "./utils";
import { getSupabase } from "./supabase/client";
import * as repo from "./supabase/repo";
import { mergeCollection, touch } from "./sync";

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
  settings: AppSettings;
  dismissedNotifications: Dismissal[];
  demo: boolean;
  /** ids this device has already exchanged with the cloud (see lib/sync) */
  syncedIds?: string[];
  lastSyncedAt?: string;
}

export type SyncState =
  | { status: "off" }            // Supabase not configured
  | { status: "signed-out" }
  | { status: "syncing" }
  | { status: "synced"; at: string | null }
  | { status: "error"; message: string };

const DEFAULT_SETTINGS: AppSettings = {
  displayName: "Collector",
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
  addWatch: (w: Omit<Watch, "id">) => Watch;
  updateWatch: (id: string, patch: Partial<Watch>) => void;
  deleteWatch: (id: string) => void;
  addMeasurement: (m: Omit<Measurement, "id">) => Measurement;
  updateMeasurement: (id: string, patch: Partial<Measurement>) => void;
  deleteMeasurement: (id: string) => void;
  addService: (s: Omit<ServiceRecord, "id">) => ServiceRecord;
  deleteService: (id: string) => void;
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
}

const StoreContext = createContext<StoreValue | null>(null);

function loadPersisted(): PersistedState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedState;
    return {
      ...parsed,
      // earlier builds stored bare keys that never expired
      dismissedNotifications: (parsed.dismissedNotifications ?? []).map((d) =>
        typeof d === "string" ? { key: d as string, at: new Date().toISOString() } : d
      ),
    };
  } catch {
    return null;
  }
}

function freshDemoState(): PersistedState {
  return {
    watches: DEMO_WATCHES,
    measurements: generateDemoMeasurements(),
    services: DEMO_SERVICES,
    settings: DEFAULT_SETTINGS,
    dismissedNotifications: [],
    demo: true,
  };
}

/**
 * Snapshot the device's data under a timestamped key before the first merge
 * touches it. Cheap insurance: if a sync ever went wrong, the pre-sync state
 * is still sitting in localStorage.
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

  // persist (debounced)
  useEffect(() => {
    if (!state) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      try {
        window.localStorage.setItem(LS_KEY, JSON.stringify(state));
      } catch { /* storage full — ignore */ }
    }, 400);
  }, [state]);

  const mutate = useCallback((fn: (s: PersistedState) => PersistedState) => {
    setState((s) => (s ? fn(s) : s));
  }, []);

  /**
   * Reconcile this device with the cloud.
   *
   * Order matters for safety: back up locally, pull, merge in memory, upload
   * anything the cloud is missing, and only then commit the merged state. If
   * any step throws, local data is untouched.
   */
  const runSync = useCallback(async () => {
    const current = stateRef.current;
    if (!current || syncing.current) return;
    const sb = getSupabase();
    if (!sb) return;
    const { data: sess } = await sb.auth.getSession();
    if (!sess.session) return;

    syncing.current = true;
    setSync({ status: "syncing" });
    try {
      backupBeforeSync(current);
      const remote = await repo.pullAll();
      if (!remote) throw new Error("Not signed in");

      // Sample data is not the user's data: never upload it into an account.
      // If the account already holds real watches, the demo simply gives way;
      // if the account is empty, the demo stays on this device untouched.
      if (current.demo) {
        if (remote.watches.length === 0) {
          setSync({ status: "synced", at: new Date().toISOString() });
          return;
        }
        mutate((st) => ({
          ...st,
          watches: remote.watches,
          measurements: remote.measurements,
          services: remote.services,
          demo: false,
          syncedIds: [
            ...remote.watches.map((r) => r.id),
            ...remote.measurements.map((r) => r.id),
            ...remote.services.map((r) => r.id),
          ],
          lastSyncedAt: new Date().toISOString(),
        }));
        setSync({ status: "synced", at: new Date().toISOString() });
        return;
      }

      const syncedIds = new Set(current.syncedIds ?? []);
      const w = mergeCollection(current.watches, remote.watches, syncedIds);
      const m = mergeCollection(current.measurements, remote.measurements, syncedIds);
      const s = mergeCollection(current.services, remote.services, syncedIds);

      // Upload what the cloud lacks or has an older copy of. Do this before
      // committing so a failure leaves local data exactly as it was.
      await repo.pushAll({
        watches: w.toUpload as Watch[],
        measurements: m.toUpload as Measurement[],
        services: s.toUpload as ServiceRecord[],
      });

      const at = new Date().toISOString();
      const allIds = [
        ...w.merged.map((r) => r.id),
        ...m.merged.map((r) => r.id),
        ...s.merged.map((r) => r.id),
      ];
      mutate((st) => ({
        ...st,
        watches: w.merged as Watch[],
        measurements: m.merged as Measurement[],
        services: s.merged as ServiceRecord[],
        demo: false,
        syncedIds: allIds,
        lastSyncedAt: at,
      }));
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
      ? generateNotifications(s.watches, byWatch, svcByWatch, s.settings.measurementReminderDays)
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
          generateInsights(w, byWatch.get(w.id) ?? [], svcByWatch.get(w.id) ?? [])
        )
      : [];

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
      addWatch: (w) => {
        const created: Watch = touch({ ...w, id: uid() });
        mutate((st) => ({ ...st, demo: false, watches: [...st.watches, created] }));
        repo.upsertWatch(created);
        return created;
      },
      updateWatch: (id, patch) => {
        const cur = s.watches.find((x) => x.id === id);
        const next = cur ? touch({ ...cur, ...patch }) : null;
        mutate((st) => ({
          ...st,
          watches: st.watches.map((x) => (x.id === id ? touch({ ...x, ...patch }) : x)),
        }));
        if (next) repo.upsertWatch(next);
      },
      deleteWatch: (id) => {
        mutate((st) => ({
          ...st,
          watches: st.watches.filter((x) => x.id !== id),
          measurements: st.measurements.filter((m) => m.watchId !== id),
          services: st.services.filter((x) => x.watchId !== id),
        }));
        repo.deleteWatch(id);
      },
      addMeasurement: (m) => {
        const created: Measurement = touch({ ...m, id: uid() });
        mutate((st) => ({ ...st, measurements: [...st.measurements, created] }));
        repo.upsertMeasurement(created);
        return created;
      },
      updateMeasurement: (id, patch) => {
        const cur = s.measurements.find((x) => x.id === id);
        const next = cur ? touch({ ...cur, ...patch }) : null;
        mutate((st) => ({
          ...st,
          measurements: st.measurements.map((x) => (x.id === id ? touch({ ...x, ...patch }) : x)),
        }));
        if (next) repo.upsertMeasurement(next);
      },
      deleteMeasurement: (id) => {
        mutate((st) => ({
          ...st,
          measurements: st.measurements.filter((x) => x.id !== id),
        }));
        repo.deleteMeasurement(id);
      },
      addService: (sv) => {
        const created: ServiceRecord = touch({ ...sv, id: uid() });
        mutate((st) => ({ ...st, services: [...st.services, created] }));
        repo.upsertService(created);
        return created;
      },
      deleteService: (id) => {
        mutate((st) => ({ ...st, services: st.services.filter((x) => x.id !== id) }));
        repo.deleteService(id);
      },
      updateSettings: (patch) => {
        mutate((st) => ({ ...st, settings: { ...st.settings, ...patch } }));
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
            settings: s.settings,
          },
          null,
          2
        ),
    };
  }, [state, cloudSynced, mutate, user, sync, runSync]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}
