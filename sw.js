// Офлайн-кэш: после первого открытия игра работает без интернета.
// При каждом обновлении игры увеличивай VERSION, чтобы iPad подхватил новые файлы.
const VERSION = 'v2';
const CACHE = `polina-${VERSION}`;
const FILES = [
  './',
  './index.html',
  './style.css',
  './manifest.webmanifest',
  './src/main.js',
  './src/game.js',
  './src/draw.js',
  './src/scenery.js',
  './img/polina-menu.jpg',
  './src/input.js',
  './src/levels.js',
  './src/config.js',
  './src/save.js',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Сначала сеть (чтобы обновления приходили сразу), без сети — из кэша.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request).then((r) => r || caches.match('./index.html'))),
  );
});
