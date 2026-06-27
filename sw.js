const CACHE_NAME = 'flight-tracker-v1';
const VERSION = '0.0.12'
// Add all local assets you want instantly available offline
const ASSETS_TO_CACHE = [
    './index.html',
    './style.css',
    './app.js',
    './mapManager.js',
    './storageManager.js',
    './manifest.json',
    './setup/index.html',
    './setup/style.css',
    './setup/app.js',
    './options/index.html',
    // images
    './img/icon192.png',
    './img/icon512.png'
];

// 1. Install Event: Cache the App Shell
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
    self.skipWaiting();
});

// 2. Activate Event: Clean old cache versions safely
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.map((key) => {
                    if (key !== CACHE_NAME) return caches.delete(key);
                })
            );
        })
    );
    self.clients.claim();
});

// 3. Fetch Event: Cache-First Strategy for offline capability
self.addEventListener('fetch', (event) => {
    // Pass online API calls like OpenFreeMap directly through without locking them
    if (event.request.url.includes('openfreemap.org')) {
        return;
    }

    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            return cachedResponse || fetch(event.request);
        })
    );
});

self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});