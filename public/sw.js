// Service Worker — 离线缓存（网络优先，回退缓存）
// v11: 修复 SW 每次 activate 都弹更新窗口；仅在真正的版本升级时通知
const CACHE = 'xixi-v11';
// 核心shell（install时预缓存）
const SHELL = [
  '/', '/index.html', '/style.css',
  '/js/state.js', '/js/utils.js', '/js/dialogs.js', '/js/saves.js',
  '/js/ui.js', '/js/achievements.js', '/js/prompts.js', '/js/templates.js',
  '/js/tavern.js', '/js/ai.js', '/js/core.js', '/js/init.js', '/js/audio.js',
  '/manifest.json', '/icon.svg', '/icon-192.png', '/icon-512.png',
  // 所有场景图片 — 离线时也需要
  '/日常.png', '/对峙.png', '/调查.png', '/潜伏.png', '/社交.png',
  '/战斗.png', '/研究.png', '/交易.png', '/崩溃.png',
  // 常用主题 — 至少缓存默认主题
  '/themes/theme-xianxia.css', '/themes/theme-cyber.css',
];

self.addEventListener('install', e => {
  self.skipWaiting();
  // 异步缓存，不阻塞 activate
  e.waitUntil(
    caches.open(CACHE).then(c => {
      return Promise.allSettled(SHELL.map(f =>
        c.add(f).catch(() => console.debug('SW: skip cache', f))
      ));
    })
  );
});

// ★ SW 版本真正更新标记 — install 时检测旧缓存，activate 时决定是否通知
let _isGenuineUpdate = false;

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(
    caches.keys().then(keys => {
      // 如果存在任何 xixi 旧版本缓存（非当前 CACHE），说明是真正的版本更新
      _isGenuineUpdate = keys.some(k => k.startsWith('xixi-v') && k !== CACHE);
      return caches.open(CACHE).then(c =>
        Promise.allSettled(SHELL.map(f =>
          c.add(f).catch(() => console.debug('SW: skip cache', f))
        ))
      );
    })
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE).map(k => caches.delete(k))
    ))
  );
  e.waitUntil(clients.claim());
  // ★ 只在真正的版本更新时通知页面。首次安装 / SW进程被杀后重启 / 清缓存刷新 均不弹窗
  if (_isGenuineUpdate) {
    e.waitUntil(
      clients.matchAll({ type: 'window' }).then(clients => {
        clients.forEach(client => {
          client.postMessage({ type: 'SW_UPDATED', version: CACHE });
        });
      })
    );
  }
});

self.addEventListener('fetch', e => {
  // 只缓存 GET 请求
  if (e.request.method !== 'GET') return;
  // API 请求不做缓存——模板/酒馆/生成等数据必须每次拉最新
  const url = new URL(e.request.url);
  if (url.pathname.startsWith('/api/')) return;

  e.respondWith(
    fetch(e.request).then(response => {
      if (response.ok) {
        const clone = response.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return response;
      }
      // HTTP 错误（404/500等）回退缓存
      return caches.match(e.request).then(cached => cached || response);
    }).catch(() => caches.match(e.request))
  );
});
