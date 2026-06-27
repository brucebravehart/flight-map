const CACHE_NAME = 'flight-tracker-v1';
const VERSION = '0.0.23'
// Add all local assets you want instantly available offline
const REPO_NAME = self.location.pathname.substring(0, location.pathname.lastIndexOf('/') + 1);
console.log('Repo Name: ' + REPO_NAME)
console.log('Version: ' + VERSION)

const ASSETS_TO_CACHE = [
    REPO_NAME, // Caches the base path (github.io/projectname/)
    `${REPO_NAME}index.html`,
    `${REPO_NAME}style.css`,
    `${REPO_NAME}app.js`,
    `${REPO_NAME}mapManager.js`,
    `${REPO_NAME}storageManager.js`,
    `${REPO_NAME}manifest.json`,
    `${REPO_NAME}setup/index.html`,
    `${REPO_NAME}setup/style.css`,
    `${REPO_NAME}setup/app.js`,
    `${REPO_NAME}settings/index.html`,
    `${REPO_NAME}settings/style.css`,
    `${REPO_NAME}settings/app.js`,
    `${REPO_NAME}settings/documents/index.html`,
    `${REPO_NAME}settings/documents/style.css`,
    `${REPO_NAME}settings/documents/app.js`,
    `${REPO_NAME}settings/overlays/index.html`,
    `${REPO_NAME}settings/overlays/style.css`,
    `${REPO_NAME}settings/overlays/app.js`,
    `${REPO_NAME}settings/overlays/edit/index.html`,
    `${REPO_NAME}settings/overlays/edit/style.css`,
    `${REPO_NAME}settings/overlays/edit/app.js`,
    // images
    `${REPO_NAME}img/icon192.png`,
    `${REPO_NAME}img/icon512.png`,
    // Third-party MapLibre CDN assets
    'https://unpkg.com/maplibre-gl@4.5.0/dist/maplibre-gl.css',
    'https://unpkg.com/maplibre-gl@4.5.0/dist/maplibre-gl.js',
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'
];

// 1. Install Event: Cache the App Shell
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(async (cache) => {
            //return cache.addAll(ASSETS_TO_CACHE);
            console.log("=== STARTING CACHE DEPLOYMENT ===");

            // Loop through each file individually instead of using cache.addAll()
            for (const url of ASSETS_TO_CACHE) {
                try {
                    // Try fetching and caching the asset
                    await cache.add(url);
                    console.log(`✅ Cached successfully: ${url}`);
                } catch (err) {
                    // This will tell you EXACTLY which file path is breaking your app!
                    console.error(`❌ CRITICAL BREAK: Failed to cache asset -> "${url}". Make sure this file exists on GitHub and the casing matches perfectly!`, err);
                }
            }

            console.log("=== CACHE DEPLOYMENT COMPLETED ===");
        })

    );
    //self.skipWaiting();
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
    /*if (event.request.url.includes('openfreemap.org')) {
        return;
    }*/

    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) {
                return cachedResponse;
            }
            return fetch(event.request).then((networkResponse) => {
                // Check if it's a valid response (or an external CDN response)
                if (!networkResponse || networkResponse.status !== 200) {
                    return networkResponse;
                }

                // OPTIONAL: Dynamically cache new map tiles or files 
                // encountered while browsing online
                if (event.request.url.includes('unpkg.com')) {
                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseToCache);
                    });
                }

                return networkResponse;
            });
        }).catch(() => {
            // Optional: Handle complete offline fallbacks here if both network and cache fail
        })
    );
});

self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

self.addEventListener('message', (event) => {
    // Check if the page is asking for the constant
    if (event.data && event.data.type === 'GET_VERSION') {
        // Send the data back to the specific tab/page that asked for it
        event.ports[0].postMessage({
            status: 'success',
            version: VERSION
        });
    }
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        // Forces the waiting service worker to become the active service worker
        self.clients.claim().then(() => {
            console.log('Service Worker successfully claimed all subfolder clients!');
        })
    );
});