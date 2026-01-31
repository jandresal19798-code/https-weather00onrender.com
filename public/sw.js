const CACHE_NAME = 'zeus-meteo-v6';
const STATIC_CACHE = 'zeus-meteo-static-v6';
const RUNTIME_CACHE = 'zeus-meteo-runtime-v6';
const API_CACHE = 'zeus-meteo-api-v6';

const STATIC_URLS = [
  '/',
  '/index.html',
  '/forecast.html',
  '/weather-enhanced.css',
  '/weather-enhanced.js',
  '/manifest.json',
  '/favicon.ico'
];

const CACHE_STRATEGIES = {
  static: new RegExp('/\\.(js|css|png|jpg|jpeg|svg|ico|woff|woff2|map)$/'),
  api: new RegExp('/api/'),
  html: new RegExp('/.*\\.html$/'),
  external: new RegExp('https?://')
};

const API_CACHE_DURATION = 10 * 60 * 1000;

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(STATIC_URLS))
      .then(() => self.skipWaiting())
  );
});

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

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  if (url.origin !== self.location.origin && !CACHE_STRATEGIES.external.test(url.pathname)) {
    return;
  }

  if (CACHE_STRATEGIES.api.test(url.pathname)) {
    event.respondWith(networkFirstWithExpiry(request));
  } else if (CACHE_STRATEGIES.static.test(url.pathname)) {
    event.respondWith(cacheFirst(request));
  } else if (CACHE_STRATEGIES.html.test(url.pathname)) {
    event.respondWith(staleWhileRevalidate(request));
  } else if (CACHE_STRATEGIES.external.test(url.pathname)) {
    event.respondWith(networkFirstExternal(request));
  } else {
    event.respondWith(staleWhileRevalidate(request));
  }
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) {
    return cached;
  }
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(STATIC_CACHE);
      await cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    return new Response('Offline', { status: 503 });
  }
}

async function networkFirstWithExpiry(request) {
  const cached = await caches.match(request);
  
  if (cached) {
    const cachedResponse = await cached.json();
    const cachedTime = cachedResponse._timestamp || 0;
    
    if (Date.now() - cachedTime < API_CACHE_DURATION) {
      return new Response(JSON.stringify(cachedResponse), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  try {
    const response = await fetch(request);
    if (response.ok) {
      const data = await response.json();
      data._timestamp = Date.now();
      
      const cache = await caches.open(API_CACHE);
      await cache.put(request, new Response(JSON.stringify(data)));
    }
    return response;
  } catch (error) {
    if (cached) {
      const cachedResponse = await cached.json();
      delete cachedResponse._timestamp;
      return new Response(JSON.stringify(cachedResponse), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    return new Response(JSON.stringify({ error: 'Offline', cached: false }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(RUNTIME_CACHE);
      await cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }
    return new Response(JSON.stringify({ error: 'Offline', cached: false }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function staleWhileRevalidate(request) {
  const cached = await caches.match(request);
  
  const fetchPromise = fetch(request).then(async response => {
    if (response.ok) {
      const cache = await caches.open(RUNTIME_CACHE);
      await cache.put(request, response.clone());
    }
    return response;
  }).catch(() => {
    return cached;
  });
  
  return cached || fetchPromise;
}

async function networkFirstExternal(request) {
  try {
    const response = await fetch(request);
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }
    return new Response('External resource not available', { 
      status: 503,
      statusText: 'Service Unavailable'
    });
  }
}

self.addEventListener('message', event => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }
  
  if (event.data.type === 'CLEAR_CACHE') {
    caches.keys().then(names => {
      names.forEach(name => caches.delete(name));
    });
  }
});

self.addEventListener('sync', event => {
  if (event.tag === 'sync-weather-data') {
    event.waitUntil(syncWeatherData());
  }
});

async function syncWeatherData() {
  console.log('Syncing weather data in background...');
}
