const CACHE = 'muzgramota-v2';

// Только критические файлы с ASCII-путями — кэшируются при установке
const PRECACHE = [
  '/musicapp/',
  '/musicapp/index.html',
  '/musicapp/manifest.json',
  '/musicapp/icon-512.png',
  '/musicapp/privacy-policy.html',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(PRECACHE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if (!e.request.url.startsWith(self.location.origin)) return;

  e.respondWith(
    fetch(e.request)
      .then(response => {
        // Динамически кэшируем каждую успешно загруженную страницу
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return response;
      })
      .catch(() =>
        // Нет сети — берём из кэша
        caches.match(e.request).then(r => r || caches.match('/musicapp/'))
      )
  );
});
