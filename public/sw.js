// Service Worker — 离线缓存（网络优先，回退缓存）
const CACHE = 'xixi-v3';
const FILES = [
  '/', '/index.html', '/style.css', '/app.js',
  '/manifest.json', '/icon-192.png', '/icon-512.png',
  '/日常.png', '/对峙.png', '/调查.png', '/潜伏.png', '/社交.png',
  '/战斗.png', '/研究.png', '/交易.png', '/崩溃.png',
];

self.addEventListener('install', e => {
  // 跳过等待，立即激活
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)));
});

self.addEventListener('activate', e => {
  // 清理旧版本缓存
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE).map(k => caches.delete(k))
    ))
  );
});

self.addEventListener('fetch', e => {
  // 网络优先：先请求网络，失败时用缓存
  e.respondWith(
    fetch(e.request).then(response => {
      // 更新缓存
      const clone = response.clone();
      caches.open(CACHE).then(c => c.put(e.request, clone));
      return response;
    }).catch(() => caches.match(e.request))
  );
});
