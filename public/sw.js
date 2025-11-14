// Custom Service Worker for Blaze Wallet
// Handles caching with proper POST request filtering

const CACHE_NAME = 'blaze-wallet-v1';
const urlsToCache = [
  '/',
  '/manifest.json',
];

// Install event - cache essential resources
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch event - serve from cache or network
self.addEventListener('fetch', (event) => {
  const { request } = event;
  
  // ✅ FIX: Don't cache POST, PUT, DELETE, PATCH requests
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    // Just fetch from network, don't cache
    event.respondWith(fetch(request));
    return;
  }
  
  // ✅ Don't cache API requests (they're dynamic)
  if (request.url.includes('/api/')) {
    event.respondWith(fetch(request));
    return;
  }
  
  // For GET requests, try cache first, then network
  event.respondWith(
    caches.match(request)
      .then((response) => {
        // Cache hit - return response
        if (response) {
          return response;
        }
        
        // Clone the request
        const fetchRequest = request.clone();
        
        return fetch(fetchRequest).then((response) => {
          // Check if valid response
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }
          
          // Clone the response
          const responseToCache = response.clone();
          
          // Cache static assets only
          if (request.url.match(/\.(js|css|png|jpg|jpeg|svg|gif|woff|woff2|ttf|eot)$/)) {
            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(request, responseToCache);
              });
          }
          
          return response;
        }).catch((error) => {
          console.error('Fetch failed:', error);
          // You could return a custom offline page here
          throw error;
        });
      })
  );
});

