// Service Worker — 离线缓存（网络优先，回退缓存）
const CACHE = 'xixi-v5';
const FILES = [
  '/', '/index.html', '/style.css',
  '/js/state.js', '/js/utils.js', '/js/dialogs.js', '/js/saves.js',
  '/js/ui.js', '/js/achievements.js', '/js/prompts.js', '/js/templates.js',
  '/js/tavern.js', '/js/ai.js', '/js/core.js', '/js/init.js',
  '/manifest.json', '/icon-192.png', '/icon-512.png',
  '/日常.png', '/对峙.png', '/调查.png', '/潜伏.png', '/社交.png',
  '/战斗.png', '/研究.png', '/交易.png', '/崩溃.png',
];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE).map(k => caches.delete(k))
    ))
  );
});

self.addEventListener('fetch', e => {
  // 只缓存 GET 请求（POST 等不支持 Cache API）
  if (e.request.method !== 'GET') return;

  e.respondWith(
    fetch(e.request).then(response => {
      const clone = response.clone();
      caches.open(CACHE).then(c => c.put(e.request, clone));
      return response;
    }).catch(() => caches.match(e.request))
  );
});
