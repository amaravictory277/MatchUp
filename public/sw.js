const CACHE_NAME = "matchup-shell-v3";
const SHELL = ["/", "/manifest.webmanifest", "/icon.svg", "/icon-192.svg", "/icon-512.svg"];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() => caches.match("/"))
    );
    return;
  }

  const cacheable = ["script", "style", "image", "font", "manifest"].includes(event.request.destination)
    || url.pathname === "/manifest.webmanifest"
    || url.pathname === "/icon.svg"
    || url.pathname === "/icon-192.svg"
    || url.pathname === "/icon-512.svg";

  if (!cacheable) return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response.ok) {
          const copy = response.clone();
          void caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
