// sw.js - Service Worker для кэширования
const CACHE_NAME = 'ceiling-plan-v1.5.0';
const urlsToCache = [
    '/',
    '/index.html',
    '/style.css',
    '/js/init.js',
    '/js/auth.js',
    '/js/elements.js',
    '/js/prices.js',
    '/js/core.js',
    '/js/projects.js',
    '/js/admin.js',
    '/js/mobile.js',
    '/js/materials.js',
    '/js/lighting-standards.js',
    '/js/ai-lighting.js',
    '/js/gallery.js',
    '/js/version.js',
    'https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js',
    'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth-compat.js',
    'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore-compat.js'
];

// Установка service worker
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('✅ Кэш открыт');
                return cache.addAll(urlsToCache);
            })
    );
});

// Активация и очистка старого кэша
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('🗑️ Удаляем старый кэш:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});

// Перехват запросов
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                // Если есть в кэше - возвращаем
                if (response) {
                    return response;
                }
                
                // Иначе запрашиваем с сети
                return fetch(event.request).then(
                    networkResponse => {
                        // Проверяем валидность ответа
                        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
                            return networkResponse;
                        }
                        
                        // Кэшируем новый ресурс
                        const responseToCache = networkResponse.clone();
                        caches.open(CACHE_NAME)
                            .then(cache => {
                                cache.put(event.request, responseToCache);
                            });
                        
                        return networkResponse;
                    }
                );
            })
    );
});
