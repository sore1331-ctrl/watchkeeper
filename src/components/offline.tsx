"use client";

import { useEffect } from "react";

/**
 * Registers the service worker that lets the app open offline (public/sw.js).
 * Production only: in development it would cache half-built files.
 */
export function OfflineSupport() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* not available (private mode, unsupported) — the app works without it */
    });
  }, []);
  return null;
}
