const CACHE_NAME = 'sxios-v1';

function getBasePath() {
  return self.registration.scope;
}

const STATIC_ASSETS = [
  './',
  './index.html',
  './css/shared.css',
  './css/ios.css',
  './css/kakao.css',
  './js/app.js',
  './js/router.js',
  './js/db.js',
  './js/api.js',
  './js/components.js',
  './js/lockscreen.js',
  './js/homescreen.js',
  './js/apps/registry.js',
  './js/apps/chats/index.js',
  './js/apps/chats/chat.js',
  './js/apps/world-info/index.js',
  './js/apps/world-info/entry-editor.js',
  './js/apps/settings/index.js',
  './js/apps/settings/api-config.js',
  './js/apps/memory/index.js',
  './js/core/embedding/index.js',
  './js/core/memory-system/index.js',
  './manifest.json'
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
    caches.match(request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        
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
          });
      })
      .catch(() => {
        if (request.destination === 'document') {
          return caches.match('./index.html');
        }
        return new Response('Offline', { status: 503 });
      })
  );
});