const CACHE_NAME = 'zeus-meteo-v7';
const STATIC_CACHE = 'zeus-meteo-static-v7';
const RUNTIME_CACHE = 'zeus-meteo-runtime-v7';
const API_CACHE = 'zeus-meteo-api-v7';

const STATIC_URLS = [
  '/',
  '/index.html',
  '/forecast.html',
  '/weather-enhanced.css',
  '/weather-enhanced.js',
  '/manifest.json'
];

const CACHE_STRATEGIES = {
  static: new RegExp('\\.(js|css|png|jpg|jpeg|svg|ico|woff|woff2|map)$'),
  api: new RegExp('^/api/'),
  html: new RegExp('\\.html$')
};

const API_CACHE_DURATION = 10 * 60 * 1000;

// Install event
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(STATIC_URLS))
      .then(() => self.skipWaiting())
  );
});

// Activate event
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(name => name.startsWith('zeus-meteo'))
          .map(name => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }
  
  // Skip external requests (let browser handle them)
  if (url.origin !== self.location.origin) {
    return;
  }
  
  // Route to appropriate strategy
  if (CACHE_STRATEGIES.api.test(url.pathname)) {
    event.respondWith(networkFirstWithExpiry(request));
  } else if (CACHE_STRATEGIES.static.test(url.pathname)) {
    event.respondWith(cacheFirst(request));
  } else {
    event.respondWith(staleWhileRevalidate(request));
  }
});

// Cache First Strategy for static assets
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) {
    return cached;
  }
  
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(STATIC_CACHE);
      // Clone before putting in cache
      await cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    return new Response('Offline - Resource not cached', { 
      status: 503,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
}

// Network First with Expiry for API calls
async function networkFirstWithExpiry(request) {
  const cacheKey = request.url;
  
  // Try network first
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      // Clone response to read body and cache it
      const responseClone = networkResponse.clone();
      const data = await responseClone.json();
      
      // Add timestamp
      data._cachedAt = Date.now();
      
      // Store in cache
      const cache = await caches.open(API_CACHE);
      await cache.put(request, new Response(JSON.stringify(data), {
        headers: { 'Content-Type': 'application/json' }
      }));
      
      // Return original response
      return networkResponse;
    }
    
    // If network response not ok, try cache
    throw new Error(`HTTP ${networkResponse.status}`);
    
  } catch (networkError) {
    // Network failed, try cache
    const cached = await caches.match(request);
    
    if (cached) {
      try {
        const cachedData = await cached.json();
        const cachedTime = cachedData._cachedAt || 0;
        
        // Check if cache is still fresh
        if (Date.now() - cachedTime < API_CACHE_DURATION) {
          // Remove internal timestamp before returning
          delete cachedData._cachedAt;
          return new Response(JSON.stringify(cachedData), {
            headers: { 'Content-Type': 'application/json' }
          });
        }
      } catch (e) {
        // Invalid cached data
      }
    }
    
    // No valid cache, return error
    return new Response(JSON.stringify({ 
      error: 'Offline',
      message: 'No hay conexión y no hay datos en caché',
      cached: false 
    }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Stale While Revalidate for other requests
async function staleWhileRevalidate(request) {
  const cached = await caches.match(request);
  
  // Start background fetch
  const fetchPromise = fetch(request).then(async networkResponse => {
    if (networkResponse.ok) {
      const cache = await caches.open(RUNTIME_CACHE);
      // Must clone before putting in cache
      await cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  }).catch(() => null);
  
  // Return cached immediately if available
  if (cached) {
    // Still do the fetch in background for next time
    fetchPromise;
    return cached;
  }
  
  // No cache, wait for network
  const networkResponse = await fetchPromise;
  if (networkResponse) {
    return networkResponse;
  }
  
  // Both failed
  return new Response('Offline', { 
    status: 503,
    headers: { 'Content-Type': 'text/plain' }
  });
}

// Message handler
self.addEventListener('message', event => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }
  
  if (event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then(names => {
        return Promise.all(names.map(name => caches.delete(name)));
      })
    );
  }
});

// Sync handler
self.addEventListener('sync', event => {
  if (event.tag === 'sync-weather-data') {
    event.waitUntil(syncWeatherData());
  }
});

async function syncWeatherData() {
  console.log('Syncing weather data in background...');
}
