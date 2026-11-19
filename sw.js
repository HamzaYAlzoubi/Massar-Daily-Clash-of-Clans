/* مسار — Service Worker */
const CACHE = "massar-v1";
const SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-192.png",
  "./icons/icon-maskable-512.png",
  "./icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function cachePut(request, response) {
  if (!response || !(response.ok || response.type === "opaque")) return response;
  const copy = response.clone();
  const cache = await caches.open(CACHE);
  await cache.put(request, copy);
  return response;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // App navigation: network first, fall back to the cached shell (works offline).
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => cachePut(new Request("./index.html"), response))
        .catch(async () => (await caches.match("./index.html")) || (await caches.match("./")) || Response.error())
    );
    return;
  }

  // Same-origin assets: cache first, refresh in the background.
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(request).then((hit) => {
        const network = fetch(request)
          .then((response) => cachePut(request, response))
          .catch(() => hit);
        return hit || network;
      })
    );
    return;
  }

  // Cross-origin (fonts): stale-while-revalidate.
  event.respondWith(
    caches.match(request).then((hit) => {
      const network = fetch(request)
        .then((response) => cachePut(request, response))
        .catch(() => hit);
      return hit || network;
    })
  );
});
