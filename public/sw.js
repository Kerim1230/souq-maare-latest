const CACHE_NAME = 'suq-shamel-v10';
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/app-icon.png',
];

// API routes that can be cached with Stale While Revalidate
const CACHEABLE_API_ROUTES = [
  '/api/categories',
  '/api/home',
];

// TTL for cached API responses (10 minutes)
const API_CACHE_TTL = 10 * 60 * 1000;

// Static asset file extensions for Cache First strategy
const STATIC_EXT_REGEX = /\.(css|woff2?|ttf|eot|png|jpg|jpeg|gif|svg|ico|webp|avif)$/i;

self.addEventListener('install', (event) => {
  self.skipWaiting(); // Activate new SW immediately — prevents stale chunks
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
});

self.addEventListener('activate', (event) => {
  // Aggressively delete ALL old caches from previous versions
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => {
          console.log('[SW] Deleting old cache:', key);
          return caches.delete(key);
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Handle SKIP_WAITING message from the app to activate new SW immediately
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

/**
 * Check if a cached API response is still within TTL.
 */
function isCacheFresh(cachedResponse, cachedDate) {
  if (!cachedDate) return false;
  const age = Date.now() - parseInt(cachedDate, 10);
  return age < API_CACHE_TTL;
}

/**
 * Network First strategy for _next/static chunks.
 * Always tries network first (to get the latest chunk after deployments),
 * falls back to cache only when offline.
 * This prevents "Failed to load chunk" errors after new deployments.
 */
async function networkFirstForChunks(event) {
  const { request } = event;
  const cache = await caches.open(CACHE_NAME);

  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.ok) {
      // Cache for offline use (don't await — non-blocking)
      event.waitUntil(cache.put(request, networkResponse.clone()));
    }
    return networkResponse;
  } catch (error) {
    // Network failed — try cache (offline mode)
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
  }
}

/**
 * Cache First strategy for truly static assets (fonts, images — NOT JS chunks).
 * Only used for assets with file extensions that are truly immutable.
 */
async function cacheFirst(event) {
  const { request } = event;
  const cache = await caches.open(CACHE_NAME);

  const cachedResponse = await cache.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.ok) {
      event.waitUntil(cache.put(request, networkResponse.clone()));
    }
    return networkResponse;
  } catch (error) {
    return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
  }
}

/**
 * Stale While Revalidate strategy:
 * 1. Return cached response immediately (if available)
 * 2. Fetch fresh response in the background
 * 3. Update cache with fresh response for next time
 */
async function staleWhileRevalidate(event) {
  const { request } = event;
  const cache = await caches.open(CACHE_NAME);

  const cachedResponse = await cache.match(request);
  const cachedDate = cachedResponse?.headers?.get('sw-cache-date');

  if (cachedResponse && isCacheFresh(cachedResponse, cachedDate)) {
    event.waitUntil(
      fetch(request).then((networkResponse) => {
        if (networkResponse && networkResponse.ok) {
          const responseToCache = new Response(networkResponse.body, {
            status: networkResponse.status,
            statusText: networkResponse.statusText,
            headers: {
              ...Object.fromEntries(networkResponse.headers.entries()),
              'sw-cache-date': Date.now().toString(),
            },
          });
          cache.put(request, responseToCache);
        }
      }).catch(() => {})
    );
    return cachedResponse;
  }

  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.ok) {
      const responseToCache = new Response(networkResponse.body, {
        status: networkResponse.status,
        statusText: networkResponse.statusText,
        headers: {
          ...Object.fromEntries(networkResponse.headers.entries()),
          'sw-cache-date': Date.now().toString(),
        },
      });
      event.waitUntil(cache.put(request, responseToCache));
    }
    return networkResponse;
  } catch (error) {
    if (cachedResponse) {
      return cachedResponse;
    }
    return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only cache same-origin GET requests
  if (request.method !== 'GET') return;
  if (!request.url.startsWith(self.location.origin)) return;

  const url = new URL(request.url);

  // ── Cacheable API routes: Stale While Revalidate ──
  if (CACHEABLE_API_ROUTES.some(route => url.pathname.startsWith(route))) {
    event.respondWith(staleWhileRevalidate(event));
    return;
  }

  // ── Other API routes: Network-first ──
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request).catch(() => caches.match(request))
    );
    return;
  }

  // ── _next/static JS chunks: Network First (prevents stale chunk errors) ──
  // This is the KEY fix: JS chunks must be fetched from network first
  // because after deployments, old chunk filenames no longer exist on the server.
  if (url.pathname.startsWith('/_next/static/')) {
    // Only use network-first for JS files (the ones that cause chunk errors)
    // CSS and other static files can still use cache-first since they're less problematic
    if (url.pathname.endsWith('.js') || url.pathname.includes('/chunks/') || url.pathname.includes('/webpack-')) {
      event.respondWith(networkFirstForChunks(event));
      return;
    }
    // Non-JS static assets (CSS, etc.) can use cache-first safely
    event.respondWith(cacheFirst(event));
    return;
  }

  // ── Other static assets (fonts, images): Cache First ──
  if (STATIC_EXT_REGEX.test(url.pathname)) {
    event.respondWith(cacheFirst(event));
    return;
  }

  // ── HTML pages: Network-only (never cache HTML) ──
  // Caching HTML is the root cause of stale chunk references.
  // HTML must always be fresh so it references the correct chunk hashes.
  if (request.mode === 'navigate' || request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Still cache for offline fallback, but with a very short TTL
          if (response.ok) {
            const clone = response.clone();
            const offlineCache = new Response(clone.body, {
              status: clone.status,
              statusText: clone.statusText,
              headers: {
                ...Object.fromEntries(clone.headers.entries()),
                'sw-cache-date': Date.now().toString(),
              },
            });
            event.waitUntil(
              caches.open(CACHE_NAME).then((cache) => cache.put(request, offlineCache))
            );
          }
          return response;
        })
        .catch(() => {
          // Only use cache as absolute last resort (offline)
          return caches.match(request).then((cached) => {
            if (cached) {
              const cachedDate = cached.headers.get('sw-cache-date');
              // Only use cached HTML if it's less than 1 hour old
              if (cachedDate && (Date.now() - parseInt(cachedDate, 10)) < 3600000) {
                return cached;
              }
            }
            return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
          });
        })
    );
    return;
  }
});

// ── Push Notification Handler ──────────────────────────────────────────

self.addEventListener('push', (event) => {
  let data = {
    title: 'سوق شامل',
    body: 'لديك إشعار جديد',
    url: '/',
    tag: 'suq-default',
  };

  if (event.data) {
    try {
      const parsed = event.data.json();
      data = { ...data, ...parsed };
    } catch {
      data.body = event.data.text() || data.body;
    }
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/app-icon.png',
      badge: '/app-icon.png',
      dir: 'rtl',
      lang: 'ar',
      tag: data.tag || 'suq-notification',
      data: { url: data.url || '/' },
      vibrate: [100, 50, 100],
    })
  );
});

// ── Notification Click Handler ─────────────────────────────────────────

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const rawUrl = event.notification.data?.url || '/';
  let targetUrl = '/';

  if (rawUrl && rawUrl !== '/') {
    targetUrl = `/?deepLink=${encodeURIComponent(rawUrl)}`;
  }

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      return self.clients.openWindow(targetUrl);
    })
  );
});
