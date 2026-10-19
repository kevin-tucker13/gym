/*
 * Strength & Recovery service worker: offline app shell.
 * The page itself is network-first (updates arrive when online, the cached copy
 * is used offline); hashed build assets are cache-first. No personal data passes
 * through here: your data lives in localStorage / IndexedDB, not in this cache.
 */
const PREFIX = 'strength-recovery-';
const CACHE = PREFIX + 'v1';
const SCOPE = new URL(self.registration.scope).pathname; // e.g. /gym/

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(['./', './manifest.webmanifest', './icon.svg', './icon-192.png']))
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  // Only remove this app's own old caches; other apps on the same site keep theirs.
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith(PREFIX) && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  // The previous Gym Tracker in ./legacy/ manages itself.
  if (url.pathname.startsWith(SCOPE + 'legacy/')) return;

  if (req.mode === 'navigate') {
    const isShell = url.pathname === SCOPE || url.pathname === SCOPE + 'index.html';
    if (!isShell) return;
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put('./', copy));
          }
          return res;
        })
        .catch(() => caches.open(CACHE).then((c) => c.match('./'))),
    );
    return;
  }

  // Look only in this app's cache: the previous Gym Tracker's cache on the same site
  // holds files with the same names (index, icons) that must not be served here.
  event.respondWith(
    caches.open(CACHE).then((c) => c.match(req)).then(
      (cached) =>
        cached ||
        fetch(req).then((res) => {
          if (res.ok && (url.pathname.includes('/assets/') || /\.(png|svg|webmanifest)$/.test(url.pathname))) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        }),
    ),
  );
});
