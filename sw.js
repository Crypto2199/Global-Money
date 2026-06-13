// ═══════════════════════════════════════════════
//  Global Money — sw.js (v4.2)
//  Improved: SWR strategy, version migration, update notifications
// ═══════════════════════════════════════════════

const CACHE_VERSION = "global-money-v4.2";
const STATIC_ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./js/app.js",
  "./js/state.js",
  "./js/i18n.js",
  "./js/storage.js",
  "./js/api.js",
  "./js/ui.js",
  "./js/converter.js",
  "./js/blackmarket.js",
  "./js/metals.js",
  "./js/charts.js",
  "./js/alerts.js",
  "./js/database.js",
  "./js/analytics.js",
  "./js/bm-config.js",
  "./js/gtag-init.js",
  "./js/consent.js",
  "./logo.png",
  "./favicon.png",
  "./manifest.json",
];

// API origins that should NEVER be cached
const API_ORIGINS = [
  "open.er-api.com",
  "coingecko.com",
  "metals.live",
  "goldapi.io",
  "fonts.googleapis.com",
  "fonts.gstatic.com",
  "unpkg.com",
  "s3.tradingview.com",
  "www.googletagmanager.com",
];

// Static-ish origins cached with Stale-While-Revalidate
const SWR_ORIGINS = ["flagcdn.com"];

// ── Install ───────────────────────────────────────
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// ── Activate ──────────────────────────────────────
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(k => k !== CACHE_VERSION)
          .map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// ── Fetch ─────────────────────────────────────────
self.addEventListener("fetch", event => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== "GET") return;

  // Skip API calls — network only, offline fallback to JSON error
  if (API_ORIGINS.some(origin => url.hostname.includes(origin))) {
    event.respondWith(
      fetch(request).catch(() =>
        new Response(
          JSON.stringify({ result: "error", offline: true }),
          { headers: { "Content-Type": "application/json" } }
        )
      )
    );
    return;
  }

  // Stale-While-Revalidate for flag CDN
  if (SWR_ORIGINS.some(origin => url.hostname.includes(origin))) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  // Cache-first for static assets, network fallback
  event.respondWith(cacheFirstWithFallback(request));
});

// ── Strategies ────────────────────────────────────
async function cacheFirstWithFallback(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_VERSION);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // Return a minimal offline page for navigation requests
    if (request.mode === "navigate") {
      const offline = await caches.match("./index.html");
      if (offline) return offline;
    }
    return new Response("Offline", { status: 503 });
  }
}

async function staleWhileRevalidate(request) {
  const cache  = await caches.open(CACHE_VERSION);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request).then(response => {
    if (response.ok) cache.put(request, response.clone());
    return response;
  }).catch(() => null);

  return cached || fetchPromise;
}

// ── Message: skip waiting ─────────────────────────
self.addEventListener("message", event => {
  if (event.data?.action === "skipWaiting") {
    self.skipWaiting();
  }
});
