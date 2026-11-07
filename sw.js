const CACHE_NAME = "medicare-v42-ui-helpers";
const APP_SHELL = ["./", "./index.html", "./login.html", "./register.html", "./dashboard.html", "./styles.css", "./app.js", "./seed-data.js", "./db.js", "./admin.js", "./doctor.js", "./auth.js", "./crypto.js", "./validate.js", "./ui.js", "./manifest.json"];

// Cache the application shell so the main workflow also works offline.
// Replace old cached files whenever the app shell version changes.
self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  // Remove caches from older releases after the new worker takes control.
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  // Serve cached assets first and fall back to the network when available.
  if (event.request.method !== "GET") return;
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
    const copy = response.clone();
    caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
    return response;
  }).catch(() => caches.match("./index.html"))));
});
