// Service Worker для принудительного обновления мини-аппа
const CACHE_NAME = 'bbifather-miniapp-cache-v2';

const notifyClientsToReload = async () => {
  const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  clients.forEach((client) => {
    client.postMessage({ type: 'APP_UPDATED' });
  });
};

// Установка Service Worker
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(() => {
        console.log('Service Worker: Ready');
        return Promise.resolve();
      })
  );
  
  // Принудительно активируем новый Service Worker
  self.skipWaiting();
});

// Активация Service Worker
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => Promise.all(
        cacheNames.map((cacheName) => {
          console.log(`Service Worker: Clearing cache ${cacheName}`);
          return caches.delete(cacheName);
        })
      ))
      .then(() => self.clients.claim())
      .then(() => notifyClientsToReload())
  );
});

// Перехватываем сетевые запросы
self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);
  const isGet = event.request.method === 'GET';
  const isApi = requestUrl.pathname.includes('/api/');
  const isDocument = event.request.mode === 'navigate' || event.request.destination === 'document';
  const isStaticAsset = requestUrl.pathname.startsWith('/static/');

  if (isDocument || isApi) {
    event.respondWith(fetch(event.request, { cache: 'no-store' }));
    return;
  }

  if (!isGet) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Для Telegram WebApp используем сетевой приоритет (всегда загружаем свежую версию)
  event.respondWith(
    fetch(event.request, { cache: 'reload' })
      .then((response) => {
        // Клонируем ответ, так как он может быть использован только один раз
        const responseToCache = response.clone();
        
        // Кешируем только GET-запросы не к API и не документы.
        // Статика обновится после перезагрузки за счёт версии бандла.
        if (isGet && isStaticAsset && response.ok) {
          caches.open(CACHE_NAME)
            .then((cache) => {
              cache.put(event.request, responseToCache);
            });
        }
        
        return response;
      })
      .catch(() => {
        // В случае ошибки сети пытаемся загрузить из кеша
        return caches.match(event.request);
      })
  );
});

// Уведомляем клиентов об обновлениях
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
