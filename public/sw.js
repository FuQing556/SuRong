// Service Worker — 离线缓存
const CACHE = 'xixi-v2';
const FILES = [
  '/', '/index.html', '/style.css', '/app.js',
  '/manifest.json', '/icon-192.png', '/icon-512.png',
  '/日常.png', '/对峙.png', '/调查.png', '/潜伏.png', '/社交.png',
  '/战斗.png', '/研究.png', '/交易.png', '/崩溃.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)));
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request))
  );
});
