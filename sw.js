const CACHE_NAME = 'sxios-v46';

const STATIC_ASSETS = [
  '/siios/',
  '/siios/index.html',
  '/siios/css/shared.css',
  '/siios/css/ios.css',
  '/siios/css/kakao.css',
  '/siios/css/notion-tokens.css',
  '/siios/css/claude-tokens.css',
  '/siios/js/app.js',
  '/siios/js/router.js',
  '/siios/js/db.js',
  '/siios/js/api.js',
  '/siios/js/components.js',
  '/siios/js/lockscreen.js',
  '/siios/js/homescreen.js',
  '/siios/js/debug-logger.js',
  '/siios/js/scroll-handler.js',
  '/siios/js/activity-interceptor.js',
  '/siios/js/activity-router.js',
  '/siios/js/apps/registry.js',
  '/siios/js/apps/chats/index.js',
  '/siios/js/apps/chats/chat.js',
  '/siios/js/apps/world-info/index.js',
  '/siios/js/apps/world-info/entry-editor.js',
  '/siios/js/apps/settings/index.js',
  '/siios/js/apps/settings/api-config.js',
  '/siios/js/apps/memory/index.js',
  '/siios/js/core/embedding/index.js',
  '/siios/js/core/memory-system/index.js',
  '/siios/manifest.json'
];

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'FORCE_UPDATE') {
    console.log('[SW] Force update requested');
    self.skipWaiting();
  }
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('[SW] Skip waiting via message');
    self.skipWaiting();
  }
});

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('[SW] Skip waiting');
        return self.skipWaiting();
      })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    }).then(() => {
      console.log('[SW] Claiming clients');
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  if (url.origin !== location.origin) {
    return;
  }
  
  if (request.method !== 'GET') {
    return;
  }

  // Navigation（HTML 頁面）：network-first，確保每次打開都抓到最新版
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, clone);
          });
          return response;
        })
        .catch(() => {
          return caches.match(request).then((cached) => {
            return cached || caches.match('/siios/index.html');
          });
        })
    );
    return;
  }
  
  event.respondWith(
    caches.match(request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          if (cachedResponse.status !== 200) {
            console.log('[SW] Ignoring cached error response:', request.url, 'status:', cachedResponse.status);
            return fetch(request).then((networkResponse) => {
              if (networkResponse && networkResponse.status === 200) {
                const responseToCache = networkResponse.clone();
                caches.open(CACHE_NAME).then((cache) => {
                  cache.put(request, responseToCache);
                });
              }
              return networkResponse;
            });
          }
          console.log('[SW] Serving from cache:', request.url);
          return cachedResponse;
        }
        
        console.log('[SW] Fetching from network:', request.url);
        return fetch(request)
          .then((response) => {
            if (!response || response.status !== 200) {
              return response;
            }
            
            const responseToCache = response.clone();
            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(request, responseToCache);
              });
            
            return response;
          })
          .catch((error) => {
            console.error('[SW] Fetch failed:', error);
            if (request.destination === 'document') {
              return caches.match('/siios/index.html');
            }
            return new Response('Offline', { status: 503 });
          });
      })
  );
});
