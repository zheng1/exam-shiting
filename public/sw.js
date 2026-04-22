// public/sw.js
const CACHE_VERSION = 'v3';
const STATIC_CACHE  = 'static-' + CACHE_VERSION;

const PRECACHE_URLS = [
  '/',
  '/exam',
  '/practice',
  '/wrong',
  '/css/style.css',
  '/js/common.js',
  '/js/exam.js',
  '/js/practice.js',
  '/js/wrong.js',
  '/manifest.json',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(STATIC_CACHE)
      .then(c => c.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== STATIC_CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// 主动缓存一个 URL（供页面调用）
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'CACHE_URLS') {
    const urls = e.data.urls || [];
    caches.open(STATIC_CACHE).then(cache => {
      urls.forEach(url => {
        fetch(url).then(res => { if (res.ok) cache.put(url, res); }).catch(() => {});
      });
    });
  }
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // POST: 离线返回 503，由 OfflineQueue 处理
  if (e.request.method === 'POST') {
    e.respondWith(
      fetch(e.request).catch(() =>
        new Response(JSON.stringify({ offline: true }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    );
    return;
  }

  // GET API: Network First，成功时缓存，离线时用缓存
  if (url.pathname.startsWith('/api/')) {
    e.respondWith(
      fetch(e.request).then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(STATIC_CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() =>
        caches.match(e.request).then(cached =>
          cached || new Response(JSON.stringify({ offline: true, error: '离线，暂无缓存' }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' },
          })
        )
      )
    );
    return;
  }

  // 静态资源: Cache First，未命中时网络获取并缓存
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(STATIC_CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      });
    })
  );
});
