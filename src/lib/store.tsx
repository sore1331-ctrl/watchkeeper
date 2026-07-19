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

const LS_KEY = "watchkeeper-v1";

interface PersistedState {
  watches: Watch[];
  measurements: Measurement[];
  services: ServiceRecord[];
  settings: AppSettings;
  dismissedNotifications: string[];
  demo: boolean;
}

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
}

const StoreContext = createContext<StoreValue | null>(null);

function loadPersisted(): PersistedState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as PersistedState) : null;
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

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<PersistedState | null>(null);
  const [cloudSynced, setCloudSynced] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // hydrate
  useEffect(() => {
    setState(loadPersisted() ?? freshDemoState());
    // detect supabase session for cloud-sync badge
    const sb = getSupabase();
    if (sb) {
      sb.auth.getSession().then(({ data }) => setCloudSynced(!!data.session));
    }
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
          .filter((n) => !s.dismissedNotifications.includes(`${n.kind}:${n.watchId}`))
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
        const created: Watch = { ...w, id: uid() };
        mutate((st) => ({ ...st, demo: false, watches: [...st.watches, created] }));
        repo.upsertWatch(created);
        return created;
      },
      updateWatch: (id, patch) => {
        mutate((st) => ({
          ...st,
          watches: st.watches.map((x) => (x.id === id ? { ...x, ...patch } : x)),
        }));
        const cur = s.watches.find((x) => x.id === id);
        if (cur) repo.upsertWatch({ ...cur, ...patch });
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
        const created: Measurement = { ...m, id: uid() };
        mutate((st) => ({ ...st, measurements: [...st.measurements, created] }));
        repo.upsertMeasurement(created);
        return created;
      },
      updateMeasurement: (id, patch) => {
        mutate((st) => ({
          ...st,
          measurements: st.measurements.map((x) => (x.id === id ? { ...x, ...patch } : x)),
        }));
      },
      deleteMeasurement: (id) => {
        mutate((st) => ({
          ...st,
          measurements: st.measurements.filter((x) => x.id !== id),
        }));
        repo.deleteMeasurement(id);
      },
      addService: (sv) => {
        const created: ServiceRecord = { ...sv, id: uid() };
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
          dismissedNotifications: [...st.dismissedNotifications, key],
        }));
      },
      resetDemoData: () => setState(freshDemoState()),
    };
  }, [state, cloudSynced, mutate]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}
