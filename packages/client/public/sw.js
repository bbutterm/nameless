/**
 * Сервис-воркер: игра целиком статическая, сервера нет.
 *
 * Стратегия РАЗНАЯ для двух видов запросов, и это главное здесь.
 *
 * `index.html` — только сеть, кеш лишь как запасной выход в офлайне. Он был
 * cache-first, и это ломало обновление насмерть: страница отдавалась из кеша,
 * а внутри неё лежат ссылки на файлы с хешами в имени (`index-DR8vz7wA.js`,
 * `hourglass-DHh__J8l.webp`). Старая страница просит старые имена, старые
 * имена лежат в кеше — и игрок месяцами видит сборку, которую давно заменили.
 * Именно так «на проде старые картинки» при свежем деплое.
 *
 * Файлы с хешем в имени — наоборот, cache-first без оглядки: их содержимое
 * неизменно по построению, новая сборка даёт новое имя. Это и делает кеш
 * полезным: оболочка обновляется всегда, тяжёлое не перекачивается зря.
 *
 * Имя кеша содержит отпечаток сборки (подставляется `scripts/stamp-sw.mjs`).
 * Раньше оно было постоянным, и `activate` не удалял ничего: мусор от всех
 * прошлых сборок оставался на устройстве навсегда.
 */
const CACHE = 'nameless-__BUILD__';

/** Файлы сборки лежат в /assets/ и несут хеш в имени — их можно кешировать навсегда. */
function isImmutable(url) {
  return url.pathname.includes('/assets/');
}

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(['./', './index.html', './manifest.webmanifest'])));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Навигация и сама страница: сеть главнее. Кеш подставляется, только если
  // сети нет вовсе, — иначе игрок остаётся на старой сборке.
  const isShell = req.mode === 'navigate' || url.pathname.endsWith('/') || url.pathname.endsWith('.html');
  if (isShell) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match(req).then((hit) => hit ?? caches.match('./index.html'))),
    );
    return;
  }

  // Всё остальное: сначала кеш, потом сеть с дозаписью.
  event.respondWith(
    caches.match(req).then((hit) => {
      if (hit && isImmutable(url)) return hit;
      const network = fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => hit);
      return hit || network;
    }),
  );
});
