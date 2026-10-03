// WatchKeeper service worker — makes the app open without a connection.
//
// The data already lives on the device; this only keeps the app's own files.
// Two rules:
//   • Build files under /_next/static/ are named by their content, so a cached
//     copy can never be stale: serve from cache, fetch once.
//   • Everything else (pages) is fetched fresh whenever there is a connection,
//     and the last good copy is used only when there is not — so a new
//     deployment is picked up on the next online visit, never held back.
// Requests to any other origin (Supabase) are left completely alone.

const CACHE = "watchkeeper-v1";

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) if (key !== CACHE) await caches.delete(key);
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  // live answers (the clock check) must never come from a cache
  if (url.pathname.startsWith("/api/")) return;

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE);
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      })()
    );
    return;
  }

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      try {
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      } catch (err) {
        const hit = await cache.match(req);
        if (hit) return hit;
        // a page never opened before: fall back to the dashboard shell
        if (req.mode === "navigate") {
          const home = await cache.match("/");
          if (home) return home;
        }
        throw err;
      }
    })()
  );
});
