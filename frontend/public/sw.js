// Service Worker для принудительного обновления кеша в Telegram WebApp
const CACHE_NAME = 'bbifather-v' + Date.now();
const RESOURCES_TO_PRELOAD = [
  '/',
  '/static/js/bundle.js',
  '/static/css/main.css'
];

// Установка Service Worker
self.addEventListener('install', event => {
  console.log('Service Worker: Installing');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Service Worker: Caching App Shell');
        // Не кешируем ресурсы принудительно, позволяем браузеру управлять кешем
        return Promise.resolve();
      })
  );
  
  // Принудительно активируем новый Service Worker
  self.skipWaiting();
});

// Активация Service Worker
self.addEventListener('activate', event => {
  console.log('Service Worker: Activating');
  
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          // Удаляем старые версии кеша
          if (cacheName !== CACHE_NAME) {
            console.log('Service Worker: Clearing Old Cache');
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  
  // Принудительно берем контроль над всеми клиентами
  return self.clients.claim();
});

// Перехватываем сетевые запросы
self.addEventListener('fetch', event => {
  // Для Telegram WebApp используем сетевой приоритет (всегда загружаем свежую версию)
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Клонируем ответ, так как он может быть использован только один раз
        const responseToCache = response.clone();
        
        // Не кешируем HTML файлы и API запросы для обеспечения актуальности
        if (event.request.destination !== 'document' && 
            !event.request.url.includes('/api/')) {
          caches.open(CACHE_NAME)
            .then(cache => {
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
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
