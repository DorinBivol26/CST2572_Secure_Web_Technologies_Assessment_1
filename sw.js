// Changing this name makes the browser install a fresh cache version.
const CACHE_NAME = "carelocal-v2";

// These files are the minimum app shell needed to start the application offline.
const APP_SHELL = ["./", "./index.html", "./styles.css", "./app.js", "./db.js", "./manifest.json"];

self.addEventListener("install", event => {
  // Save the main application files when the service worker is installed.
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  // Take control of open pages as soon as the new worker becomes active.
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  // Use cached files first, then cache successful network responses for later use.
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
    const copy = response.clone();
    caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
    return response;
  }).catch(() => caches.match("./index.html"))));
});
