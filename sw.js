// Офлайн-кэш: после первого открытия игра работает без интернета.
// При каждом обновлении игры увеличивай VERSION, чтобы iPad подхватил новые файлы.
const VERSION = 'v15';
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
  './src/assets.js',
  './src/version.js',
  './img/bg/sky.jpg',
  './img/bg/station.webp',
  './img/bg/village.webp',
  './img/obj/coin.png',
  './img/obj/crate.png',
  './img/obj/goose-angry.png',
  './img/obj/goose-walk.png',
  './img/obj/sign.png',
  './img/obj/stone.png',
  './img/obj/train-car.png',
  './img/obj/train-head.png',
  './img/polina/arm-blue.png',
  './img/polina/arm-pajamas.png',
  './img/polina/arm-sundress.png',
  './img/polina/arm-yolochka.png',
  './img/polina/body-blue.png',
  './img/polina/body-pajamas.png',
  './img/polina/body-sundress.png',
  './img/polina/body-yolochka.png',
  './img/polina/front-blue.webp',
  './img/polina/front-pajamas.webp',
  './img/polina/front-sundress.webp',
  './img/polina/front-yolochka.webp',
  './img/ui/title.webp',
  './img/ui/btn-new.webp',
  './img/ui/btn-levels.webp',
  './img/ui/btn-wardrobe.webp',
  './img/ui/btn-shop.webp',
  './img/ui/chapter-1.jpg',
  './img/ui/chapter-1-plaque.webp',
  './img/polina/dance-sundress.webp',
  './img/tiles/ground.webp',
  './img/tiles/ground-edge.webp',
  './img/tiles/planks.webp',
  './img/ui/levels-zeleny.jpg',
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
// Файлы игры перепроверяем на сервере (no-cache), иначе браузер ещё минут 10 отдаёт старые.
// version.json не кэшируем вовсе: по нему игра узнаёт, что вышло обновление.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  if (url.pathname.endsWith('/version.json')) {
    e.respondWith(fetch(e.request.url, { cache: 'no-store' }));
    return;
  }
  const net = e.request.mode === 'navigate' ? fetch(e.request) : fetch(e.request.url, { cache: 'no-cache' });
  e.respondWith(
    net
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match('./index.html'))),
  );
});
