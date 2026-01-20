// service-worker.js — RiverLog
// Offline-first app shell for GitHub Pages, with reliable iOS updates.

const VERSION = "54";                 // bump on every deploy
const CACHE = `riverlog-v${VERSION}`;

// IMPORTANT: GitHub Pages path prefix (repo name)
// If your repo name is NOT "riverlog", change this.
const BASE = "/riverlog";

// App shell + modules (paths are relative to repo root on GH Pages)
const ASSETS = [
  `${BASE}/`,
  `${BASE}/index.html`,

  `${BASE}/app.css`,
  `${BASE}/manifest.json`,
  `${BASE}/vendor/jszip.min.js`,

  // Icons (add/remove to match your repo)
  `${BASE}/assets/favicon.ico`,
  `${BASE}/assets/favicon.png`,
  `${BASE}/assets/icon-192.png`,
  `${BASE}/assets/icon-512.png`,

  // Root storage module (your imports use ../storage.js from /js/*)
  `${BASE}/storage.js`,

  // JS entry + modules
  `${BASE}/js/main.js`,
  `${BASE}/js/dom.js`,
  `${BASE}/js/pwa.js`,
  `${BASE}/js/trips.js`,
  `${BASE}/js/catches.js`,
  `${BASE}/js/collage.js`,
  `${BASE}/js/io.js`,
  `${BASE}/js/utils.js`,
  `${BASE}/js/state.js`,
  `${BASE}/js/badges.js`,
  `${BASE}/js/ui/flybox.js`
];

async function safePrecache(){
  const cache = await caches.open(CACHE);
  // Cache one-by-one so a single 404 doesn't fail the whole install on GH Pages
  await Promise.all(
    ASSETS.map(async (url)=>{
      try{
        const req = new Request(url, { cache: "reload" });
        const res = await fetch(req);
        if(res && res.ok) await cache.put(req, res);
      }catch(_){
        // ignore
      }
    })
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    await safePrecache();
    self.skipWaiting(); // take over ASAP
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => (k !== CACHE ? caches.delete(k) : null)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  event.respondWith((async () => {

    // 1) Navigations: network-first so HTML updates actually land on iOS.
    if (req.mode === "navigate") {
      try {
        const fresh = await fetch(req, { cache: "no-store" });

        // Update cached shells (use TWO clones if we store twice)
        try {
          const cache = await caches.open(CACHE);
          cache.put(req, fresh.clone()).catch(() => {});
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

    // 2) Everything else: cache-first, then network, then cache.
    const cached = await caches.match(req, { ignoreSearch: true });
    if (cached) return cached;

    try {
      const fresh = await fetch(req);

      // Cache same-origin only
      try {
        const url = new URL(req.url);
        if (url.origin === self.location.origin) {
          const cache = await caches.open(CACHE);
          cache.put(req, fresh.clone()).catch(() => {});
        }
      } catch (_) {}

      return fresh;
    } catch (err) {
      const fallback = await caches.match(req, { ignoreSearch: true });
      if (fallback) return fallback;
      throw err;
    }
  })());
});
