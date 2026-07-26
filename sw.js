const CACHE_NAME = 'finpulse-v2';
const assetsToCache = [
  './index.html',
  './manifest.json',
  './logo.png'
  // Add other CSS or JS files here if needed
];

// Install Service Worker and cache static assets
self.addEventListener('install', (e) => {
  console.log('FinPulse Service Worker Installed');
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(assetsToCache);
    })
  );
});

// Fetch resources from cache or network
self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((response) => {
      return response || fetch(e.request);
    })
  );
});

// Activate Service Worker and clean up old/obsolete caches
self.addEventListener('activate', (e) => {
  console.log('FinPulse Service Worker Activated');
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('Deleting old cache:', key);
            return caches.delete(key);
          }
        })
      );
    })
  );
});