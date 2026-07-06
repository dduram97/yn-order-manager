/**
 * PWA Service Worker — 운영(HTTPS) 전용
 * - HTML/페이지: 절대 캐시하지 않음 (network-only)
 * - /api/*: SW 개입 없음
 * - v5: 이전 ok-page 캐시 무효화
 */
const CACHE_NAME = "yn-order-shell-v5";
const OFFLINE_FALLBACK = "/login";
const PRECACHE_ASSETS = [
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) =>
        Promise.allSettled(PRECACHE_ASSETS.map((asset) => cache.add(asset)))
      )
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
      .then(() => caches.open(CACHE_NAME))
      .then((cache) =>
        Promise.allSettled(PRECACHE_ASSETS.map((asset) => cache.add(asset)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // API: network-only
  if (url.pathname.startsWith("/api/")) return;

  // 페이지/HTML: network-only (캐시된 ok-page 등 방지)
  if (
    request.mode === "navigate" ||
    request.headers.get("accept")?.includes("text/html")
  ) {
    event.respondWith(
      fetch(request).catch(async () => {
        const cachedLogin = await caches.match(OFFLINE_FALLBACK);
        if (cachedLogin) return cachedLogin;
        return new Response("오프라인 — 네트워크 연결 후 다시 시도하세요.", {
          status: 503,
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        });
      })
    );
    return;
  }

  // 정적 아이콘/manifest만 cache-first
  if (
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/manifest.json" ||
    url.pathname === "/sw.js"
  ) {
    event.respondWith(
      caches.match(request).then((cached) => cached ?? fetch(request))
    );
  }
});
