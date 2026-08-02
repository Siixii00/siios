const CACHE_NAME = 'sxios-v23';

function getBasePath() {
  return self.registration.scope;
}

const STATIC_ASSETS = [
  '/siios/',
  '/siios/index.html',
  '/siios/css/shared.css',
  '/siios/css/ios.css',
  '/siios/css/kakao.css',
  '/siios/js/app.js',
  '/siios/js/router.js',
  '/siios/js/db.js',
  '/siios/js/api.js',
  '/siios/js/components.js',
  '/siios/js/lockscreen.js',
  '/siios/js/homescreen.js',
  '/siios/js/debug-logger.js',
  '/siios/js/scroll-handler.js',
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

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        self.skipWaiting();
      })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => {
      self.clients.claim();
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
  
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (!response || response.status !== 200) {
          return caches.match(request)
            .then((cached) => cached || response);
        }
        const responseToCache = response.clone();
        caches.open(CACHE_NAME)
          .then((cache) => {
            cache.put(request, responseToCache);
          });
        return response;
      })
      .catch(() => {
        return caches.match(request)
          .then((cached) => {
            if (cached) return cached;
            if (request.destination === 'document') {
              return caches.match('/siios/index.html');
            }
            return new Response('Offline', { status: 503 });
          });
      })
  );
});
