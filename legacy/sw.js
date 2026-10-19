// Offline cache for Gym Tracker.
// Files are served from the cache first so the app opens with no signal,
// and refreshed in the background whenever there is a connection.
const PREFIX = 'gym-tracker-';
const CACHE = PREFIX + 'v1';
const FILES = ['./', 'index.html', 'manifest.json', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(FILES)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  // Only remove this app's own old caches: other GitHub Pages sites share the same origin.
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith(PREFIX) && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  const fresh = fetch(req).then(res => {
    if (res && res.ok) {
      const copy = res.clone();
      caches.open(CACHE).then(cache => cache.put(req, copy));
    }
    return res;
  });

  event.respondWith(
    caches.open(CACHE)
      .then(cache => cache.match(req, { ignoreSearch: true }))
      .then(hit => hit || fresh)
  );
  event.waitUntil(fresh.catch(() => {}));
});
