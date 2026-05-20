/**
 * ============================================================
 *  TRENING PWA – service-worker.js
 *  Obsługa offline: cache-first dla zasobów statycznych
 * ============================================================
 */

const CACHE_NAME = 'trening-pwa-v1';

/** Zasoby do zakeszowania przy pierwszej instalacji */
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

/* ---- INSTALL: zakeszuj zasoby statyczne ---- */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  // Aktywuj nowy SW natychmiast
  self.skipWaiting();
});

/* ---- ACTIVATE: usuń stare cache ---- */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    )
  );
  // Przejmij kontrolę nad wszystkimi otwartymi kartami
  self.clients.claim();
});

/* ---- FETCH: cache-first, fallback do sieci ---- */
self.addEventListener('fetch', event => {
  // Obsługuj tylko GET
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;

      // Jeśli nie ma w cache – pobierz z sieci i zakeszuj
      return fetch(event.request)
        .then(response => {
          // Keszuj tylko poprawne odpowiedzi
          if (response && response.status === 200 && response.type === 'basic') {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, clone);
            });
          }
          return response;
        })
        .catch(() => {
          // Brak sieci i cache – zwróć index.html jako fallback SPA
          return caches.match('./index.html');
        });
    })
  );
});
