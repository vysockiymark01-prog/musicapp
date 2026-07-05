const CACHE = 'muzgramota-v1';

const ASSETS = [
  '/musicapp/',
  '/musicapp/index.html',
  '/musicapp/manifest.json',
  '/musicapp/icon-192.png',
  '/musicapp/icon-512.png',
  '/musicapp/privacy-policy.html',
  '/musicapp/Нотная грамота/index.html',
  '/musicapp/тональности/index.html',
  '/musicapp/слуховой анализ/index.html',
  '/musicapp/ритмический тренажер/index.html',
  '/musicapp/цифровка/index.html',
  '/musicapp/музыкальные диктанты/index.html',
  '/musicapp/муз-литература/index.html',
  '/musicapp/словарик терминов/index.html',
  '/musicapp/цитаты/index.html',
  '/musicapp/транспозиция/index.html'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS))
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
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request).catch(() => caches.match('/musicapp/')))
  );
});
