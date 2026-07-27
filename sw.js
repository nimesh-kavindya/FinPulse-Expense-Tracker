/**
 * FinPulse Progressive Web App (PWA) Service Worker
 * Handles offline static asset caching, stale-while-revalidate strategy,
 * and immediate activation via SKIP_WAITING for seamless version updates.
 */

const CACHE_NAME = 'finpulse-cache-v1.0.2';

const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './app.js',
  './styles.css',
  './manifest.json',
  './version.json',
  './logo.png',
  './budget.png'
];

// Install Event: Pre-cache essential app shell assets
self.addEventListener('install', (event) => {
  console.log('[SW] FinPulse Service Worker Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Pre-caching app shell assets');
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

// Activate Event: Clean up outdated caches and claim client windows
self.addEventListener('activate', (event) => {
  console.log('[SW] FinPulse Service Worker Activating...');
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[SW] Purging outdated cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => {
      console.log('[SW] Claiming clients for immediate update');
      return self.clients.claim();
    })
  );
});

// Message Event: Allow client app to send skipWaiting instruction
self.addEventListener('message', (event) => {
  if (event.data && (event.data.action === 'skipWaiting' || event.data.type === 'SKIP_WAITING')) {
    console.log('[SW] Skip waiting requested from client. Updating Service Worker...');
    self.skipWaiting();
  }
});

// Fetch Event: Custom caching strategies
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Always bypass cache for live version checking and Firebase calls
  if (url.pathname.endsWith('version.json') || url.hostname.includes('firestore') || url.hostname.includes('firebase')) {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' }).catch(() => caches.match(event.request))
    );
    return;
  }

  // Network First strategy with Cache Fallback for navigation and static assets
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (
          event.request.method === 'GET' &&
          networkResponse &&
          networkResponse.status === 200 &&
          networkResponse.type === 'basic'
        ) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          if (event.request.mode === 'navigate') {
            return caches.match('./index.html');
          }
        });
      })
  );
});
