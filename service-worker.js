/**
 * TRENING PWA – service-worker.js
 * Zmień CACHE_NAME przy każdej aktualizacji – wymusza pobranie nowych plików.
 */

const CACHE_NAME = 'trening-pwa-v13'; // <-- zmieniona wersja = stary cache usunięty

const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-home.svg',
  './icons/icon-ubw.svg',
  './icons/icon-lbw.svg',
  './icons/icon-fbw.svg',
  './icons/icon-plan.svg',
  './icons/icon-vol.svg',
  './icons/icon-pr.svg',
  './icons/icon-exercises.svg'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(c => c.addAll(ASSETS))
  );
  self.skipWaiting(); // aktywuj natychmiast
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim(); // przejmij wszystkie otwarte karty
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (res && res.status === 200 && res.type === 'basic') {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() => caches.match('./index.html'));
    })
  );
});
