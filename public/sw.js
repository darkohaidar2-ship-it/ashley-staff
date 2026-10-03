const CACHE_NAME = 'ashley-checkin-offline-v19';

const PRECACHE_URLS = [
  '/',
  '/attendance/mobile',
  '/manifest.json',
  '/ashley-logo.png',
  '/ashley-logo.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/leaflet/leaflet.js',
  '/leaflet/leaflet.css'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.allSettled(
        PRECACHE_URLS.map((url) => cache.add(url).catch(() => {}))
      );
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never cache API calls
  if (url.pathname.startsWith('/api/')) return;

  // Only handle Check-In routes and their required static assets
  const isCheckInPage =
    url.pathname === '/' ||
    url.pathname === '/attendance/mobile' ||
    url.pathname === '/attendance';

  const isStaticAsset =
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/fonts/') ||
    url.pathname.startsWith('/models/') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.jpg') ||
    url.pathname.endsWith('.woff2') ||
    url.pathname === '/manifest.json';

  if (isCheckInPage || (request.mode === 'navigate' && isCheckInPage)) {
    // Network-First, falling back to Cache when offline
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          return caches.match('/');
        })
    );
    return;
  }

  if (isStaticAsset) {
    // Network-First with Offline Cache Fallback (always fresh online, 100% available offline)
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(async () => {
          return await caches.match(request);
        })
    );
  }
});

