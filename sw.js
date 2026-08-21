const CACHE = 'muzgramota-v23';

// Критические файлы с ASCII-путями — кэшируются через addAll (всё-или-ничего),
// поэтому здесь только то, без чего приложение не откроется вообще.
const PRECACHE = [
  '/musicapp/',
  '/musicapp/index.html',
  '/musicapp/manifest.json',
  '/musicapp/icon-512.png',
  '/musicapp/icon-192.png',
  '/musicapp/privacy-policy.html',
];

// Страницы модулей — пути с кириллицей и пробелами. addAll() уронил бы весь
// precache, если хотя бы один запрос не удастся, поэтому кэшируем каждую
// отдельно (best-effort) и не блокируем установку при отдельных сбоях.
const PRECACHE_MODULES = [
  '/musicapp/сольфеджио/index.html',
  '/musicapp/Нотная грамота/index.html',
  '/musicapp/ритмический тренажер/index.html',
  '/musicapp/слуховой анализ/index.html',
  '/musicapp/музыкальные диктанты/index.html',
  '/musicapp/цифровка/index.html',
  '/musicapp/тональности/index.html',
  '/musicapp/транспозиция/index.html',
  '/musicapp/словарик терминов/index.html',
  '/musicapp/муз-литература/index.html',
  '/musicapp/цитаты/index.html',
  '/musicapp/джазовая-гармония/index.html',
  '/musicapp/тюнер/index.html',
  '/musicapp/метроном/index.html',
  '/musicapp/инструменты оркестра/index.html',
  '/musicapp/избранное/index.html',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c =>
      c.addAll(PRECACHE).then(() =>
        Promise.allSettled(
          PRECACHE_MODULES.map(url =>
            c.add(url).catch(err => console.warn('precache miss:', url, err))
          )
        )
      )
    )
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
