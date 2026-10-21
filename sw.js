const CACHE_NAME = 'sxios-v122';

// 外部資源（資料庫函式庫、圖示與字型）也要進快取：離線時沒有它們，App 連啟動都不行（idb 是 db.js 的 ES 模組），圖示也會變成一串英文字。
const CDN_HOSTS = ['cdn.jsdelivr.net', 'cdnjs.cloudflare.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];
const CDN_PRECACHE = [
  'https://cdn.jsdelivr.net/npm/idb@8/+esm',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css',
  'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=block',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap'
];

// <<app-assets（由 scripts/update-sw-assets.mjs 產生，請勿手改）
const APP_ASSETS = [
  '/siios/js/activity-api-handler.js',
  '/siios/js/activity-interceptor.js',
  '/siios/js/activity-router.js',
  '/siios/js/api/activity-sync.js',
  '/siios/js/api.js',
  '/siios/js/app.js',
  '/siios/js/apps/activity/index.js',
  '/siios/js/apps/album/index.js',
  '/siios/js/apps/album/style.css',
  '/siios/js/apps/ao3/index.js',
  '/siios/js/apps/ao3/style.css',
  '/siios/js/apps/appearance/index.js',
  '/siios/js/apps/appearance/style.css',
  '/siios/js/apps/arcade/games/bulls-core.js',
  '/siios/js/apps/arcade/games/bulls.js',
  '/siios/js/apps/arcade/games/daily.js',
  '/siios/js/apps/arcade/games/g2048-core.js',
  '/siios/js/apps/arcade/games/g2048.js',
  '/siios/js/apps/arcade/games/levels.js',
  '/siios/js/apps/arcade/games/lights-core.js',
  '/siios/js/apps/arcade/games/lights.js',
  '/siios/js/apps/arcade/games/memory-core.js',
  '/siios/js/apps/arcade/games/memory.js',
  '/siios/js/apps/arcade/games/mines-core.js',
  '/siios/js/apps/arcade/games/mines.js',
  '/siios/js/apps/arcade/games/slide-core.js',
  '/siios/js/apps/arcade/games/slide.js',
  '/siios/js/apps/arcade/games/snake-core.js',
  '/siios/js/apps/arcade/games/snake.js',
  '/siios/js/apps/arcade/games/sudoku-core.js',
  '/siios/js/apps/arcade/games/sudoku.js',
  '/siios/js/apps/arcade/index.js',
  '/siios/js/apps/arcade/style.css',
  '/siios/js/apps/bilibili/index.js',
  '/siios/js/apps/bilibili/style.css',
  '/siios/js/apps/bubbles/index.js',
  '/siios/js/apps/bubbles/style.css',
  '/siios/js/apps/chats/chat-ai-tools.js',
  '/siios/js/apps/chats/chat-extras.js',
  '/siios/js/apps/chats/chat-media.js',
  '/siios/js/apps/chats/chat-settings.js',
  '/siios/js/apps/chats/chat-synth.js',
  '/siios/js/apps/chats/chat.js',
  '/siios/js/apps/chats/chats-nav.js',
  '/siios/js/apps/chats/contacts.js',
  '/siios/js/apps/chats/index.js',
  '/siios/js/apps/chats/shop.js',
  '/siios/js/apps/chats/style.css',
  '/siios/js/apps/chrome/index.js',
  '/siios/js/apps/chrome/index_new.js',
  '/siios/js/apps/chrome/style.css',
  '/siios/js/apps/daily-recipe/index.js',
  '/siios/js/apps/daily-recipe/style.css',
  '/siios/js/apps/dating/dating-data.js',
  '/siios/js/apps/dating/index.js',
  '/siios/js/apps/dating/style.css',
  '/siios/js/apps/delivery/index.js',
  '/siios/js/apps/delivery/style.css',
  '/siios/js/apps/drift-bottle/index.js',
  '/siios/js/apps/drift-bottle/style.css',
  '/siios/js/apps/emoji-shop/index.js',
  '/siios/js/apps/emoji-shop/style.css',
  '/siios/js/apps/exchange-diary/index.js',
  '/siios/js/apps/exchange-diary/style.css',
  '/siios/js/apps/facebook/index.js',
  '/siios/js/apps/facebook/style.css',
  '/siios/js/apps/farm/index.js',
  '/siios/js/apps/farm/style.css',
  '/siios/js/apps/gift-shop/index.js',
  '/siios/js/apps/gift-shop/style.css',
  '/siios/js/apps/guzi-guide/index.js',
  '/siios/js/apps/guzi-guide/style.css',
  '/siios/js/apps/health/index.js',
  '/siios/js/apps/health/style.css',
  '/siios/js/apps/home/index.js',
  '/siios/js/apps/home/style.css',
  '/siios/js/apps/instagram/index.js',
  '/siios/js/apps/instagram/style.css',
  '/siios/js/apps/invest/index.js',
  '/siios/js/apps/invest/style.css',
  '/siios/js/apps/invest/world-events.js',
  '/siios/js/apps/kakaopay/fund-ui.js',
  '/siios/js/apps/kakaopay/index.js',
  '/siios/js/apps/kakaopay/style.css',
  '/siios/js/apps/lofter/index.js',
  '/siios/js/apps/lofter/style.css',
  '/siios/js/apps/match-3/engine.js',
  '/siios/js/apps/match-3/index.js',
  '/siios/js/apps/match-3/style.css',
  '/siios/js/apps/mcp-market/code-templates.js',
  '/siios/js/apps/mcp-market/index.js',
  '/siios/js/apps/mcp-market/style.css',
  '/siios/js/apps/mcp-market/test-worker-syntax.js',
  '/siios/js/apps/mcp-market/tools-catalog.js',
  '/siios/js/apps/mcp-market/ziwei-engine-template.js',
  '/siios/js/apps/memory/index.js',
  '/siios/js/apps/memory/style.css',
  '/siios/js/apps/music/index.js',
  '/siios/js/apps/music/index_new.js',
  '/siios/js/apps/music/style.css',
  '/siios/js/apps/passkey/index.js',
  '/siios/js/apps/passkey/style.css',
  '/siios/js/apps/payment-code/index.js',
  '/siios/js/apps/payment-code/style.css',
  '/siios/js/apps/personal-wiki/history-manager.js',
  '/siios/js/apps/personal-wiki/index.js',
  '/siios/js/apps/personal-wiki/link-system.js',
  '/siios/js/apps/personal-wiki/migration.js',
  '/siios/js/apps/personal-wiki/operation-queue.js',
  '/siios/js/apps/personal-wiki/style.css',
  '/siios/js/apps/personal-wiki/sync-engine.js',
  '/siios/js/apps/personal-wiki/templates.js',
  '/siios/js/apps/phone/index.js',
  '/siios/js/apps/phone/style.css',
  '/siios/js/apps/pomodoro/index.js',
  '/siios/js/apps/pomodoro/style.css',
  '/siios/js/apps/pub/index.js',
  '/siios/js/apps/pub/style.css',
  '/siios/js/apps/registry.js',
  '/siios/js/apps/settings/activity-privacy-settings.js',
  '/siios/js/apps/settings/api-config.js',
  '/siios/js/apps/settings/backup-settings.js',
  '/siios/js/apps/settings/char-settings.js',
  '/siios/js/apps/settings/cross-device-settings.js',
  '/siios/js/apps/settings/discord-guide-data.js',
  '/siios/js/apps/settings/discord-guide.js',
  '/siios/js/apps/settings/discord-settings.js',
  '/siios/js/apps/settings/discord-user-binding.js',
  '/siios/js/apps/settings/github-settings.js',
  '/siios/js/apps/settings/index.js',
  '/siios/js/apps/settings/mcp-settings.js',
  '/siios/js/apps/settings/memory-settings.js',
  '/siios/js/apps/settings/style.css',
  '/siios/js/apps/settings/synth-settings.js',
  '/siios/js/apps/settings/user-mask-settings.js',
  '/siios/js/apps/smart-painter/index.js',
  '/siios/js/apps/smart-painter/style.css',
  '/siios/js/apps/taobao/index.js',
  '/siios/js/apps/taobao/style.css',
  '/siios/js/apps/theater/index.js',
  '/siios/js/apps/theater/style.css',
  '/siios/js/apps/theme-shop/index.js',
  '/siios/js/apps/theme-shop/style.css',
  '/siios/js/apps/timetree/index.js',
  '/siios/js/apps/timetree/style.css',
  '/siios/js/apps/touch/index.js',
  '/siios/js/apps/touch/style.css',
  '/siios/js/apps/twitch/index.js',
  '/siios/js/apps/twitch/style.css',
  '/siios/js/apps/twitter/index.js',
  '/siios/js/apps/twitter/style.css',
  '/siios/js/apps/weather/index.js',
  '/siios/js/apps/weather/style.css',
  '/siios/js/apps/weverse/index.js',
  '/siios/js/apps/weverse/style.css',
  '/siios/js/apps/widget/index.js',
  '/siios/js/apps/widget/style.css',
  '/siios/js/apps/world-info/builtin-worldbooks.js',
  '/siios/js/apps/world-info/entry-editor.js',
  '/siios/js/apps/world-info/global-forbidden-list.js',
  '/siios/js/apps/world-info/global-settings-list.js',
  '/siios/js/apps/world-info/import-worldbook.js',
  '/siios/js/apps/world-info/index.js',
  '/siios/js/apps/world-info/keyword-settings-list.js',
  '/siios/js/apps/world-info/style.css',
  '/siios/js/apps/world-info/theater-settings-list.js',
  '/siios/js/apps/youtube/index.js',
  '/siios/js/apps/youtube/style.css',
  '/siios/js/components.js',
  '/siios/js/constants/rp-system-prompt.js',
  '/siios/js/core/activity-context.js',
  '/siios/js/core/activity-format.js',
  '/siios/js/core/activity-memory.js',
  '/siios/js/core/age-core.js',
  '/siios/js/core/age-gate.js',
  '/siios/js/core/age-restricted.js',
  '/siios/js/core/app-context-builder.js',
  '/siios/js/core/appearance-dom.js',
  '/siios/js/core/appearance.js',
  '/siios/js/core/arcade-income.js',
  '/siios/js/core/assistive-touch.js',
  '/siios/js/core/backup-manager.js',
  '/siios/js/core/calendar.js',
  '/siios/js/core/chat-mcp-handler.js',
  '/siios/js/core/co-watch-prompt.js',
  '/siios/js/core/co-watch.js',
  '/siios/js/core/cross-device/encryption.js',
  '/siios/js/core/cross-device/github-sync.js',
  '/siios/js/core/cross-device/sync-manager.js',
  '/siios/js/core/dialogs.js',
  '/siios/js/core/discord-memory-sync.js',
  '/siios/js/core/discord-worker-client.js',
  '/siios/js/core/dislikes.js',
  '/siios/js/core/embedding/index.js',
  '/siios/js/core/embedding/presets.js',
  '/siios/js/core/fund-store.js',
  '/siios/js/core/fund.js',
  '/siios/js/core/gift-ideas.js',
  '/siios/js/core/gift-log.js',
  '/siios/js/core/gifts.js',
  '/siios/js/core/local-tools.js',
  '/siios/js/core/mcp-client.js',
  '/siios/js/core/mcp-intelligence/index.js',
  '/siios/js/core/memory-prefs.js',
  '/siios/js/core/memory-saver.js',
  '/siios/js/core/memory-sources.js',
  '/siios/js/core/memory-system/decay-engine.js',
  '/siios/js/core/memory-system/digest.js',
  '/siios/js/core/memory-system/emotion-tagger.js',
  '/siios/js/core/memory-system/index.js',
  '/siios/js/core/memory-system/memory-classifier.js',
  '/siios/js/core/memory-system/sensory-extractor.js',
  '/siios/js/core/memory-system/sleep-engine.js',
  '/siios/js/core/memory-system/spatiotemporal-tagger.js',
  '/siios/js/core/orders.js',
  '/siios/js/core/period-calculator.js',
  '/siios/js/core/real-shops.js',
  '/siios/js/core/real-world-context.js',
  '/siios/js/core/reasoning-filter.js',
  '/siios/js/core/seeded.js',
  '/siios/js/core/shopping-store.js',
  '/siios/js/core/synth-client.js',
  '/siios/js/core/wallet.js',
  '/siios/js/core/wallpapers.js',
  '/siios/js/core/widgets.js',
  '/siios/js/core/world-info-loader.js',
  '/siios/js/core/worldbook-installer.js',
  '/siios/js/core/worldbook-parser.js',
  '/siios/js/core/ziwei-lazy-loader.js',
  '/siios/js/core/ziwei-mcp-client.js',
  '/siios/js/core/ziwei-service.js',
  '/siios/js/db.js',
  '/siios/js/db_part1.js',
  '/siios/js/debug-logger.js',
  '/siios/js/homescreen.js',
  '/siios/js/lockscreen.js',
  '/siios/js/router.js',
  '/siios/js/scroll-handler.js',
  '/siios/js/utils/html.js',
  '/siios/js/utils/image.js',
  '/siios/js/vendor/qrcode-generator.js',
  '/siios/css/claude-tokens.css',
  '/siios/css/ios.css',
  '/siios/css/kakao.css',
  '/siios/css/notion-tokens.css',
  '/siios/css/shared.css'
];
// app-assets>>

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
        return cache.addAll(STATIC_ASSETS).then(() =>
          // 外部資源盡力快取（安裝時剛好沒網路也不能讓整個安裝失敗）
          Promise.allSettled([
            ...CDN_PRECACHE.map((u) => cache.add(new Request(u, { mode: 'cors' }))),
            // 全部 App 的程式碼也一併快取，離線時每個功能都開得起來（個別檔案失敗不影響安裝）
            ...APP_ASSETS.map((u) => cache.add(u))
          ]));
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
  
  if (request.method !== 'GET') {
    return;
  }

  // 外部 CDN：快取優先（字型檔、函式庫版本固定），沒有才上網並存起來
  if (CDN_HOSTS.includes(url.hostname)) {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request).then((response) => {
        if (response && (response.ok || response.type === 'opaque')) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      }))
    );
    return;
  }

  if (url.origin !== location.origin) {
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
