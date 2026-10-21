/* 像素农场 · 采购记 — Service Worker
 * 目标（G13）：首次访问后完全离线可用（断网 / 地铁里 / 超市信号差）。
 * 策略：
 *   本地资源  → cache-first（应用外壳不变，缓存即最新）
 *   字体 CDN  → network-first，失败回退缓存
 * 版本号改了就要同步改 CACHE，否则旧缓存不会失效。
 */
var CACHE = 'pixel-farm-v1';
var ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './icons.js',
  './ingredient-icons.js',
  './data.js',
  './data-100.js',
  './analytics.js',
  './manifest.webmanifest',
  './assets/icon.svg'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE)
      .then(function (c) {
        /* addAll 是「全部成功才算成功」，单个 404 会让整个 install 失败。
           用逐个 put 更稳：失败的跳过，不影响其它资源。 */
        return Promise.all(ASSETS.map(function (url) {
          return c.add(new Request(url, { cache: 'reload' })).catch(function () { });
        }));
      })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys()
      .then(function (keys) {
        return Promise.all(keys.map(function (k) {
          if (k !== CACHE) return caches.delete(k);
        }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;

  /* 字体走 CDN：network-first，拿到就顺手写进缓存 */
  if (req.url.indexOf('cdn.jsdelivr.net') > -1) {
    e.respondWith(
      fetch(req).then(function (r) {
        var copy = r.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); });
        return r;
      }).catch(function () { return caches.match(req); })
    );
    return;
  }

  /* 本地资源：cache-first */
  e.respondWith(
    caches.match(req).then(function (hit) {
      if (hit) return hit;
      return fetch(req).then(function (r) {
        var copy = r.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); });
        return r;
      }).catch(function () {
        /* 导航请求失败时退回外壳，至少应用还能打开 */
        if (req.mode === 'navigate') return caches.match('./index.html');
      });
    })
  );
});
