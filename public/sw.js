const CACHE_NAME = 'suq-shamel-v2';
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

// TTL for cached API responses (10 minutes — increased for performance)
const API_CACHE_TTL = 10 * 60 * 1000;

// Static asset file extensions for Cache First strategy
const STATIC_EXT_REGEX = /\.(css|js|woff2?|ttf|eot|png|jpg|jpeg|gif|svg|ico|webp|avif)$/i;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Aggressively delete ALL old caches (including old app name caches like suq-hurriya-v1)
  // and any previous versions of suq-shamel cache to ensure fresh JS bundles are served
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
 * Cache First strategy for static assets (CSS, JS, fonts, images).
 * Returns cached version immediately, only falls back to network if not cached.
 * This is the fastest strategy for immutable assets with hashed filenames.
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
      // Cache for future use (don't await — non-blocking)
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

  // Try to get cached version
  const cachedResponse = await cache.match(request);
  const cachedDate = cachedResponse?.headers?.get('sw-cache-date');

  // If we have a fresh cached response, return it immediately
  if (cachedResponse && isCacheFresh(cachedResponse, cachedDate)) {
    // Revalidate in background (fire and forget)
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
      }).catch(() => {
        // Background revalidation failed — that's fine, cached version was already returned
      })
    );

    return cachedResponse;
  }

  // No fresh cache — try network first, then fall back to stale cache
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
      // Clone and cache (don't await — non-blocking)
      event.waitUntil(cache.put(request, responseToCache));
    }
    return networkResponse;
  } catch (error) {
    // Network failed — return stale cache if available
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

  // ── _next/static assets: Cache First (immutable, hashed filenames) ──
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirst(event));
    return;
  }

  // ── Other static assets: Cache First ──
  // CSS, JS, fonts, images — serve from cache immediately, fastest strategy
  if (STATIC_EXT_REGEX.test(url.pathname)) {
    event.respondWith(cacheFirst(event));
    return;
  }

  // ── HTML pages: Network-first with cache fallback ──
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
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
      // Fallback to text
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

  // The app is an SPA with only the '/' route.
  // Deep links like /store/xxx or /chat are not real routes — they cause 404.
  // Instead, we navigate to '/' with a 'deepLink' query param that the app reads.
  const rawUrl = event.notification.data?.url || '/';
  let targetUrl = '/';

  if (rawUrl && rawUrl !== '/') {
    // Pass the deep link as a query parameter
    targetUrl = `/?deepLink=${encodeURIComponent(rawUrl)}`;
  }

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If there's already an open window, focus it and navigate
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      // Otherwise, open a new window
      return self.clients.openWindow(targetUrl);
    })
  );
});
