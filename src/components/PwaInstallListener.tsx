'use client';

import { useEffect } from 'react';

/**
 * Captures the browser's `beforeinstallprompt` event and stores it
 * on `window.promptInstall` so the PwaInstallBanner can trigger it later.
 * Also registers the Service Worker and handles auto-updates.
 */
export function PwaInstallListener() {
  useEffect(() => {
    // ── Register Service Worker ──
    if ('serviceWorker' in navigator) {
      // Step 1: Force-unregister ALL old service workers immediately
      // This ensures old SWs (with old app name caches) stop serving stale JS
      navigator.serviceWorker.getRegistrations().then(async (registrations) => {
        for (const reg of registrations) {
          // Unregister any SW that isn't the current version
          const scriptURL = reg.active?.scriptURL || reg.installing?.scriptURL || reg.waiting?.scriptURL || '';
          if (!scriptURL.includes('suq-shamel')) {
            console.log('[PWA] Unregistering old service worker:', scriptURL);
            await reg.unregister();
          }
        }

        // Step 2: Also clear all old caches directly from the page
        // This handles the case where the old SW already cached stale JS bundles
        try {
          const cacheKeys = await caches.keys();
          for (const key of cacheKeys) {
            // Delete any cache from the old app name or old versions
            if (key.startsWith('suq-hurriya') || (key.startsWith('suq-shamel') && key !== 'suq-shamel-v2')) {
              console.log('[PWA] Deleting stale cache:', key);
              await caches.delete(key);
            }
          }
        } catch (e) {
          console.warn('[PWA] Cache cleanup failed:', e);
        }

        // Step 3: Register the new service worker
        navigator.serviceWorker.register('/sw.js').then((registration) => {
          console.log('[PWA] Service Worker registered, scope:', registration.scope);

          // Force update check
          registration.update();

          // Listen for new SW updates
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (!newWorker) return;

            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // New SW installed — send skipWaiting to activate immediately
                console.log('[PWA] New Service Worker installed — sending skipWaiting');
                newWorker.postMessage({ type: 'SKIP_WAITING' });
              }
              if (newWorker.state === 'activated') {
                // New SW activated — force page reload to pick up new code
                console.log('[PWA] New Service Worker activated — reloading for update');
                window.location.reload();
              }
            });
          });

          // Also check for waiting SW (already installed but waiting to activate)
          if (registration.waiting) {
            console.log('[PWA] New Service Worker waiting — sending skipWaiting');
            registration.waiting.postMessage({ type: 'SKIP_WAITING' });
          }
        }).catch((err) => {
          console.warn('[PWA] SW registration failed:', err);
        });
      });

      // When a controlled page detects a new controller, reload
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        console.log('[PWA] Controller changed — reloading');
        window.location.reload();
      });
    }

    // ── beforeinstallprompt handler ──
    const handler = (e: Event) => {
      e.preventDefault();
      const promptEvent = e as BeforeInstallPromptEvent;
      console.log('[PwaInstallListener] beforeinstallprompt captured');

      // Mark that the native install prompt is available
      window.__pwaInstallAvailable = true;

      // Store a function that triggers the native install prompt
      window.promptInstall = async () => {
        await promptEvent.prompt();
        await promptEvent.userChoice;
      };
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  return null;
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}
