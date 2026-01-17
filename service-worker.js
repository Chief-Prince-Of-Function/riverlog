// Simple offline cache for app shell (GitHub Pages safe)
const CACHE = "riverlog-v5"; // bump this when you deploy changes

// IMPORTANT: GitHub Pages path prefix (repo name)
// If your repo name is NOT "riverlog", change this.
const BASE = "/riverlog";

// Keep this list tight: only the stuff required to boot offline.
const ASSETS = [
  `${BASE}/`,
  `${BASE}/index.html`,
  `${BASE}/app.css`,
  `${BASE}/manifest.json`,
  `${BASE}/storage.js`,
  `${BASE}/vendor/jszip.min.js`,
  `${BASE}/assets/icon-192.png`,
  `${BASE}/assets/icon-512.png`,

  // Split JS entry + modules (add/remove if your /js folder changes)
  `${BASE}/js/main.js`,
  `${BASE}/js/dom.js`,
  `${BASE}/js/pwa.js`,
  `${BASE}/js/trips.js`,
  `${BASE}/js/catches.js`,
  `${BASE}/js/collage.js`,
  `${BASE}/js/io.js`,
  `${BASE}/js/utils.js`,
  `${BASE}/js/state.js`
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(ASSETS);
    self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => (k !== CACHE ? caches.delete(k) : null)));
    self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;

  // Only handle GET
  if (req.method !== "GET") return;

  event.respondWith((async () => {
    // Cache-first
    const cached = await caches.match(req);
    if (cached) return cached;

    try {
      const fresh = await fetch(req);

      // Best-effort cache for same-origin only
      try {
        const url = new URL(req.url);
        if (url.origin === self.location.origin) {
          const cache = await caches.open(CACHE);
          cache.put(req, fresh.clone()).catch(() => {});
        }
      } catch (_) {}

      return fresh;
    } catch (err) {
      // Navigation fallback (offline) -> app shell
      if (req.mode === "navigate") {
        const fallback = await caches.match(`${BASE}/index.html`);
        if (fallback) return fallback;
      }
      throw err;
    }
  })());
});
