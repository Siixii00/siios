const CACHE_NAME = 'ios-classic-ai-v1';

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
  './js/pages/home.js',
  './js/pages/chats.js',
  './js/pages/chat.js',
  './js/pages/world-info.js',
  './js/pages/entry-editor.js',
  './js/pages/settings.js',
  './js/pages/api-config.js',
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