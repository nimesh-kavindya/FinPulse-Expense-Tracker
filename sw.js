self.addEventListener('install', (e) => {
  console.log('FinPulse Service Worker Installed');
});

self.addEventListener('fetch', (e) => {
  // Basic fetch handler for PWA
  e.respondWith(
    caches.match(e.request).then((response) => {
      return response || fetch(e.request);
    })
  );
});