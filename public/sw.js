const CACHE_NAME = 'zeus-meteo-v4';
const STATIC_CACHE = 'zeus-meteo-static-v4';
const RUNTIME_CACHE = 'zeus-meteo-runtime-v4';

const STATIC_URLS = [
  '/',
  '/index.html',
  '/weather.css',
  '/manifest.json'
];

const CACHE_STRATEGIES = {
  static: new RegExp('/\\.(js|css|png|jpg|jpeg|svg|ico|woff|woff2)$/'),
  api: new RegExp('/api/'),
  html: new RegExp('/.*\\.html$/')
};

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
        cacheNames.map(name => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  if (url.origin !== self.location.origin) {
    return;
  }

  if (CACHE_STRATEGIES.api.test(url.pathname)) {
    event.respondWith(networkFirst(request));
  } else if (CACHE_STRATEGIES.static.test(url.pathname)) {
    event.respondWith(cacheFirst(request));
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
});
