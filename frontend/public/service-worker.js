const CACHE_VERSION = 'glossflow-v10-market-cache';
const RUNTIME_CACHE = 'glossflow-runtime-v10';
const APP_SHELL = ['/', '/index.html', '/offline.html', '/manifest.webmanifest', '/icon.svg'];
const PUBLIC_API_CACHE = ['/public/salon', '/services', '/professionals', '/portfolio'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => ![CACHE_VERSION, RUNTIME_CACHE].includes(key)).map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  const isAdminOrAuth = url.pathname.includes('/admin/') || url.pathname.includes('/auth/');
  if (isAdminOrAuth) return;

  const isNavigation = request.mode === 'navigate';
  const shouldCacheApi = PUBLIC_API_CACHE.some((path) => url.pathname.endsWith(path));

  if (isNavigation) {
    event.respondWith(fetch(request).catch(() => caches.match('/offline.html')));
    return;
  }

  if (shouldCacheApi) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request).then((response) => {
      if (response.ok && ['style', 'script', 'image', 'font'].includes(request.destination)) {
        const copy = response.clone();
        caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy));
      }
      return response;
    }).catch(() => caches.match('/offline.html')))
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
