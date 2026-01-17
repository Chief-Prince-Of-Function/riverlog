// service-worker.js — RiverLog
// Offline-first app shell for GitHub Pages, with reliable iOS updates.

const VERSION = "15";                 // bump on every deploy
const CACHE = `riverlog-v${VERSION}`;

// IMPORTANT: GitHub Pages path prefix (repo name)
// If your repo name is NOT "riverlog", change this.
const BASE = "/riverlog";

// If you add ?v=VERSION in index.html for app.css / main.js, the SW will still match
// cached items because we use ignoreSearch: true.
const ASSETS = [
  `${BASE}/`,
  `${BASE}/index.html`,

  // If you cache-bust in HTML (recommended), these will still work:
  // <link rel="stylesheet" href="app.css?v=13">
  // <script type="module" src="js/main.js?v=13"></script>
  `${BASE}/app.css`,
  `${BASE}/manifest.json`,
  `${BASE}/storage.js`,
  `${BASE}/vendor/jszip.min.js`,
  `${BASE}/assets/icon-192.png`,
  `${BASE}/assets/icon-512.png`,

  // JS entry + modules
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
    self.skipWaiting(); // take over ASAP
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    // Remove old caches
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => (k !== CACHE ? caches.delete(k) : null)));

    // Ensure the new SW controls existing clients immediately
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;

  // Only handle GET
  if (req.method !== "GET") return;

  event.respondWith((async () => {
    // 1) Navigations: network-first so HTML updates actually land on iOS.
    //    Fallback to cached shell when offline.
    if (req.mode === "navigate") {
      try {
        const fresh = await fetch(req, { cache: "no-store" });

        // Update cached index/app shell on successful navigation fetch
        try {
          const cache = await caches.open(CACHE);
          cache.put(req, fresh.clone()).catch(() => {});
          // Also keep index.html fresh (useful when req is / or /index.html)
          cache.put(`${BASE}/index.html`, fresh.clone()).catch(() => {});
        } catch (_) {}

        return fresh;
      } catch (err) {
        const cachedNav = await caches.match(req, { ignoreSearch: true });
        if (cachedNav) return cachedNav;

        const fallback = await caches.match(`${BASE}/index.html`, { ignoreSearch: true });
        if (fallback) return fallback;

        throw err;
      }
    }

    // 2) Everything else: cache-first (fast), then network, then cache.
    const cached = await caches.match(req, { ignoreSearch: true });
    if (cached) return cached;

    try {
      const fresh = await fetch(req);

      // Best-effort cache for same-origin only
      try {
        const url = new URL(req.url);
        if (url.origin === self.location.origin) {
          const cache = await caches.open(CACHE);

          // Store with the original request (including any querystring)
          // ignoreSearch:true on reads makes versioned URLs resolve to cached base files too.
          cache.put(req, fresh.clone()).catch(() => {});
        }
      } catch (_) {}

      return fresh;
    } catch (err) {
      // If we fail, try any cached match (ignoreSearch helps on iOS/PWA)
      const fallback = await caches.match(req, { ignoreSearch: true });
      if (fallback) return fallback;
      throw err;
    }
  })());
});
