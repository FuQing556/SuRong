// Service Worker — 离线缓存（网络优先，回退缓存）
const CACHE = 'xixi-v6';
const FILES = [
  '/', '/index.html', '/style.css',
  '/js/state.js', '/js/utils.js', '/js/dialogs.js', '/js/saves.js',
  '/js/ui.js', '/js/achievements.js', '/js/prompts.js', '/js/templates.js',
  '/js/tavern.js', '/js/ai.js', '/js/core.js', '/js/init.js', '/js/audio.js',
  '/manifest.json', '/icon.svg', '/icon-192.png', '/icon-512.png',
  '/日常.png', '/对峙.png', '/调查.png', '/潜伏.png', '/社交.png',
  '/战斗.png', '/研究.png', '/交易.png', '/崩溃.png',
];

self.addEventListener('install', e => {
  self.skipWaiting();
  // 异步缓存，不阻塞 activate
  e.waitUntil(
    caches.open(CACHE).then(c => {
      return Promise.allSettled(FILES.map(f =>
        c.add(f).catch(() => console.debug('SW: skip cache', f))
      ));
    })
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE).map(k => caches.delete(k))
    ))
  );
  // 立即接管所有页面
  e.waitUntil(clients.claim());
});

self.addEventListener('fetch', e => {
  // 只缓存 GET 请求
  if (e.request.method !== 'GET') return;

  e.respondWith(
    fetch(e.request).then(response => {
      // 只缓存成功响应
      if (response.ok) {
        const clone = response.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
      }
      return response;
    }).catch(() => caches.match(e.request))
  );
});
