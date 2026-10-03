"use client";

// ─── Theme ──────────────────────────────────────────────────────────────────
// The choice lives in localStorage and on <html class="dark">. An inline
// script in the root layout applies it before first paint; this hook keeps
// every component that shows or changes it in step afterwards.

import { useCallback, useSyncExternalStore } from "react";

export type ThemeMode = "dark" | "light" | "system";

const KEY = "wk-theme";
const EVENT = "wk-theme-change";
const SYSTEM_DARK = "(prefers-color-scheme: dark)";

function readMode(): ThemeMode {
  try {
    const v = window.localStorage.getItem(KEY);
    return v === "light" || v === "system" ? v : "dark";
  } catch {
    return "dark";
  }
}

const resolvesDark = (mode: ThemeMode) =>
  mode === "dark" || (mode === "system" && window.matchMedia(SYSTEM_DARK).matches);

function subscribe(onChange: () => void) {
  const mq = window.matchMedia(SYSTEM_DARK);
  const update = () => {
    document.documentElement.classList.toggle("dark", resolvesDark(readMode()));
    onChange();
  };
  window.addEventListener(EVENT, update);
  window.addEventListener("storage", update);
  mq.addEventListener("change", update);
  return () => {
    window.removeEventListener(EVENT, update);
    window.removeEventListener("storage", update);
    mq.removeEventListener("change", update);
  };
}

// ── Light-theme accent ──────────────────────────────────────────────────────

export type LightAccent = "navy" | "green";

const ACCENT_KEY = "wk-accent";
const ACCENT_EVENT = "wk-accent-change";

function readAccent(): LightAccent {
  try {
    return window.localStorage.getItem(ACCENT_KEY) === "green" ? "green" : "navy";
  } catch {
    return "navy";
  }
}

function applyAccent(accent: LightAccent) {
  // navy is the stylesheet's default, so it needs no attribute
  if (accent === "green") document.documentElement.dataset.accent = "green";
  else delete document.documentElement.dataset.accent;
}

function subscribeAccent(onChange: () => void) {
  const update = () => {
    applyAccent(readAccent());
    onChange();
  };
  window.addEventListener(ACCENT_EVENT, update);
  window.addEventListener("storage", update);
  return () => {
    window.removeEventListener(ACCENT_EVENT, update);
    window.removeEventListener("storage", update);
  };
}

export function useLightAccent() {
  const accent = useSyncExternalStore(subscribeAccent, readAccent, () => "navy" as LightAccent);
  const setAccent = useCallback((next: LightAccent) => {
    try {
      window.localStorage.setItem(ACCENT_KEY, next);
    } catch {
      /* private mode — the choice still applies for this visit */
    }
    applyAccent(next);
    window.dispatchEvent(new Event(ACCENT_EVENT));
  }, []);
  return { accent, setAccent };
}

export function useTheme() {
  const mode = useSyncExternalStore(subscribe, readMode, () => "dark" as ThemeMode);
  const dark = useSyncExternalStore(subscribe, () => resolvesDark(readMode()), () => true);
  const setMode = useCallback((next: ThemeMode) => {
    try {
      window.localStorage.setItem(KEY, next);
    } catch {
      /* private mode — the choice still applies for this visit */
    }
    document.documentElement.classList.toggle("dark", resolvesDark(next));
    window.dispatchEvent(new Event(EVENT));
  }, []);
  const toggle = useCallback(() => setMode(dark ? "light" : "dark"), [dark, setMode]);
  return { mode, dark, setMode, toggle };
}
