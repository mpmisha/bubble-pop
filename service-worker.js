// Offline-first service worker. Caches the whole app shell so Bubble Pop runs
// with no network at all once installed to the home screen.
//
// Update strategy:
//  - Bump CACHE on every release. On install we precache the new shell and
//    skipWaiting(); on activate we delete ALL old caches and claim clients.
//  - Navigations are network-first (so a fresh index.html is fetched when
//    online, falling back to cache offline). Other same-origin assets are
//    cache-first against the versioned cache. The paired registration in
//    main.js reloads the page on controllerchange so users get the new build.
const CACHE = 'bubble-pop-v5';

const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './manifest.webmanifest',
  './js/main.js',
  './js/game.js',
  './js/board.js',
  './js/bubble.js',
  './js/skins.js',
  './js/color.js',
  './js/audio.js',
  './js/storage.js',
  './js/i18n.js',
  './js/telemetry.js',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
    ).then(() => self.clients.claim()),
  );
});

// Allow the page to tell a waiting worker to activate immediately.
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  // Navigations (the HTML document): network-first so shell updates show up
  // promptly online; fall back to the cached shell offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).then((resp) => {
        const copy = resp.clone();
        caches.open(CACHE).then((cache) => cache.put(request, copy)).catch(() => {});
        return resp;
      }).catch(() =>
        caches.match(request).then((cached) => cached || caches.match('./index.html')),
      ),
    );
    return;
  }

  if (url.origin === location.origin) {
    // Cache-first for same-origin assets (served from the versioned cache).
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request).then((resp) => {
        const copy = resp.clone();
        caches.open(CACHE).then((cache) => cache.put(request, copy)).catch(() => {});
        return resp;
      }).catch(() => cached)),
    );
    return;
  }

  // Cross-origin (Google Fonts): stale-while-revalidate.
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request).then((resp) => {
        const copy = resp.clone();
        caches.open(CACHE).then((cache) => cache.put(request, copy)).catch(() => {});
        return resp;
      }).catch(() => cached);
      return cached || network;
    }),
  );
});
