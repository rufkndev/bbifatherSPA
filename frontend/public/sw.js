// Service Worker для принудительного обновления мини-аппа
const CACHE_NAME = 'bbifather-miniapp-cache-v1';

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
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // Удаляем старые версии кеша
          if (cacheName !== CACHE_NAME) {
            console.log('Service Worker: Clearing Old Cache');
            return caches.delete(cacheName);
          }
          return Promise.resolve(false);
        })
      );
    })
  );
  
  // Принудительно берем контроль над всеми клиентами
  event.waitUntil(self.clients.claim());
});

// Перехватываем сетевые запросы
self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);
  const isGet = event.request.method === 'GET';
  const isApi = requestUrl.pathname.includes('/api/');
  const isDocument = event.request.mode === 'navigate' || event.request.destination === 'document';
  const isStaticAsset = requestUrl.pathname.startsWith('/static/');

  // Для Telegram WebApp используем сетевой приоритет (всегда загружаем свежую версию)
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Клонируем ответ, так как он может быть использован только один раз
        const responseToCache = response.clone();
        
        // Кешируем только GET-запросы не к API и не документы.
        // Статика обновится после перезагрузки за счёт версии бандла.
        if (isGet && !isApi && !isDocument && isStaticAsset) {
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
