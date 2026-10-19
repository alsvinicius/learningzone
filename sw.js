/* Skill Builder review — offline shell + stories.
   Cache-first for same-origin GET (app shell, data/*.json, reports, cards),
   so the story deck works fully offline after the first visit or after tapping
   "Offline" in the app bar. Network revalidates in the background, so a
   normalize --patch shows up on the next load. */

importScripts("cache-utils.js");

const VERSION = "sb-v3";
const STATIC_CACHE = `${VERSION}-static`;
const CONTENT_CACHE = `${VERSION}-content`;
const FONT_CACHE = `${VERSION}-fonts`;

const CORE = [
  "./",
  "index.html",
  "app.css?v=11",
  "app.js?v=11",
  "progress.js",
  "cache-utils.js",
  "manifest.webmanifest",
  "data/index.json",
  "icons/icon.svg",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/maskable-512.png",
  "icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(CORE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k.startsWith("sb-") && ![STATIC_CACHE, CONTENT_CACHE, FONT_CACHE].includes(k))
          .map((k) => caches.delete(k))
      );
      if ("navigationPreload" in self.registration) {
        try {
          await self.registration.navigationPreload.enable();
        } catch {
          /* unsupported browser, navigation still works */
        }
      }
      await self.clients.claim();
    })()
  );
});

// The app bar "Offline" button posts the full story payload so the whole
// attempt is usable without network, not just what was already visited.
self.addEventListener("message", (event) => {
  const msg = event.data || {};
  if (msg.type === "SKIP_WAITING") {
    self.skipWaiting();
    return;
  }
  if (msg.type === "CACHE_URLS" && Array.isArray(msg.urls) && msg.urls.length) {
    event.waitUntil(
      (async () => {
        const cache = await caches.open(CONTENT_CACHE);
        const { saved, total } = await self.StudyCache.cacheIndividually(msg.urls, cache, fetch);
        const clients = await self.clients.matchAll({ includeUncontrolled: true });
        for (const c of clients) c.postMessage({ type: "CACHE_DONE", saved, total });
      })()
    );
  }
});

const isSameOrigin = (url) => url.origin === self.location.origin;
const isContent = (path) =>
  path.startsWith("data/") || path.endsWith(".md") || path.endsWith(".json");

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  const network = fetch(request)
    .then((res) => {
      if (res && res.ok) cache.put(request, res.clone()).catch(() => {});
      return res;
    })
    .catch(() => undefined);
  // Offline + cached: instant stories. Online: cached screen first, fresh
  // bytes stored for the next visit.
  if (hit) return hit;
  const res = await network;
  if (res) return res;
  throw new Error("offline");
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  // Google Fonts: cache the CSS and woff2 after first use, never block on it.
  if (!isSameOrigin(url)) {
    if (/fonts\.(googleapis|gstatic)\.com/.test(url.host)) {
      event.respondWith(staleWhileRevalidate(request, FONT_CACHE));
    }
    return;
  }

  // App navigation while offline opens the cached shell, which then renders
  // from cached data.
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          if (self.registration.navigationPreload) {
            const pre = await event.preloadResponse;
            if (pre) {
              const cache = await caches.open(STATIC_CACHE);
              cache.put("index.html", pre.clone()).catch(() => {});
              return pre;
            }
          }
          const net = await fetch(request);
          const cache = await caches.open(STATIC_CACHE);
          cache.put("index.html", net.clone()).catch(() => {});
          return net;
        } catch {
          const cache = await caches.open(STATIC_CACHE);
          return (await cache.match("index.html")) || Response.error();
        }
      })()
    );
    return;
  }

  const rel = url.pathname.replace(/^\//, "");
  const base = rel.split("/").pop();
  const isShell =
    ["", "index.html", "app.css", "app.js", "progress.js", "cache-utils.js", "manifest.webmanifest", "sw.js"].includes(rel) ||
    base === "index.html" ||
    rel.startsWith("icons/");

  if (isShell) {
    event.respondWith(staleWhileRevalidate(request, STATIC_CACHE));
    return;
  }

  if (isContent(rel)) {
    event.respondWith(staleWhileRevalidate(request, CONTENT_CACHE));
  }
});
