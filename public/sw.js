// public/sw.js
const CACHE_VERSION = 'v2';
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

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // API: Network First，GET 请求离线时用缓存；POST 返回 503 由 OfflineQueue 处理
  if (url.pathname.startsWith('/api/')) {
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
    // GET: Network First，成功时缓存，离线时用缓存
    e.respondWith(
      fetch(e.request).then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(STATIC_CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() => caches.match(e.request))
    );
    return;
  }

  // 静态资源: Cache First
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
