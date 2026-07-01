/*
 * Service worker mínimo de Momec (PWA instalable).
 * - App shell cache-first (para arranque offline).
 * - Nunca cachea /api ni /webhooks (datos siempre frescos, network-only).
 * - Navegaciones: network-first con fallback al index cacheado.
 */
const CACHE = "momec-shell-v1";
const SHELL = ["/app/", "/app/index.html", "/app/favicon.svg", "/app/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  // Datos: nunca cachear.
  if (url.pathname.startsWith("/api") || url.pathname.startsWith("/webhooks")) return;

  // Navegación (SPA): network-first, fallback al index cacheado.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match("/app/index.html").then((r) => r || fetch(request))),
    );
    return;
  }

  // Assets: cache-first con actualización en segundo plano.
  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request).then((res) => {
          if (res.ok && url.origin === self.location.origin) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(request, copy));
          }
          return res;
        }),
    ),
  );
});
