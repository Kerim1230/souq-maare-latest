'use client';

import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { apiPost, apiDelete, ensureCsrfReady } from '@/lib/fetchApi';

/**
 * Convert a VAPID base64 public key to a Uint8Array.
 * This is REQUIRED by pushManager.subscribe({ applicationServerKey }).
 * Handles URL-safe base64 (replaces - with +, _ with /).
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Ensure the Service Worker is registered and ready.
 * If not registered yet, register it and wait for it to become active.
 */
async function ensureServiceWorkerReady(): Promise<ServiceWorkerRegistration> {
  if (!('serviceWorker' in navigator)) {
    throw new Error('المتصفح لا يدعم Service Worker');
  }

  // First, try to get an already-ready registration
  try {
    const registration = await navigator.serviceWorker.ready;
    if (registration.active) {
      console.log('[Push] SW already active');
      return registration;
    }
  } catch {
    // Not ready yet, continue to register
  }

  // Register the service worker
  console.log('[Push] Registering Service Worker...');
  const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  console.log('[Push] SW registered, state:', registration.active?.state || registration.installing?.state);

  // Wait for it to become active
  if (registration.active) {
    return registration;
  }

  return new Promise((resolve, reject) => {
    const worker = registration.installing || registration.waiting;
    if (!worker) {
      reject(new Error('فشل تسجيل Service Worker'));
      return;
    }

    const timeout = setTimeout(() => {
      reject(new Error('انتهت مهلة تفعيل Service Worker'));
    }, 10000);

    worker.addEventListener('statechange', () => {
      console.log('[Push] SW state changed to:', worker.state);
      if (worker.state === 'activated') {
        clearTimeout(timeout);
        resolve(registration);
      }
    });

    // Also check if it's already activated
    if (worker.state === 'activated') {
      clearTimeout(timeout);
      resolve(registration);
    }
  });
}

/**
 * Headless push-subscription manager.
 * Does NOT render any UI — exposes subscribe/unsubscribe as a hook
 * so the parent Toggle can drive it.
 */
export const usePushSubscription = (onStateChange?: (subscribed: boolean) => void) => {
  const [pushState, setPushState] = useState<'checking' | 'unsupported' | 'denied' | 'subscribed' | 'default'>('checking');

  const checkPushState = useCallback(async () => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.log('[Push] Browser does not support push notifications');
      setPushState('unsupported');
      onStateChange?.(false);
      return;
    }

    try {
      const permission = Notification.permission;
      console.log('[Push] Current notification permission:', permission);
      if (permission === 'denied') {
        setPushState('denied');
        onStateChange?.(false);
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      console.log('[Push] Existing subscription:', subscription ? 'found' : 'none');
      if (subscription && permission === 'granted') {
        setPushState('subscribed');
        onStateChange?.(true);
      } else {
        setPushState('default');
        onStateChange?.(false);
      }
    } catch (err) {
      console.error('[Push] checkPushState failed:', err);
      setPushState('unsupported');
      onStateChange?.(false);
    }
  }, [onStateChange]);

  useEffect(() => {
    checkPushState();
  }, [checkPushState]);

  const subscribe = useCallback(async (): Promise<boolean> => {
    try {
      console.log('[Push] ═══════ Starting subscription flow ═══════');

      // 1. Check browser support
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        toast.error('المتصفح لا يدعم الإشعارات');
        return false;
      }
      console.log('[Push] ✅ Step 1: Browser supports push');

      // 2. Request notification permission
      console.log('[Push] Step 2: Requesting notification permission...');
      const permission = await Notification.requestPermission();
      console.log('[Push] ✅ Step 2: Permission result =', permission);
      if (permission !== 'granted') {
        const msg = permission === 'denied' ? 'تم رفض إذن الإشعارات من المتصفح' : 'لم يتم منح إذن الإشعارات';
        toast.error(msg);
        setPushState(permission === 'denied' ? 'denied' : 'default');
        onStateChange?.(false);
        return false;
      }

      // 3. Ensure Service Worker is ready
      console.log('[Push] Step 3: Ensuring Service Worker is ready...');
      const registration = await ensureServiceWorkerReady();
      console.log('[Push] ✅ Step 3: SW ready, active:', !!registration.active);

      // 4. Get VAPID public key
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      console.log('[Push] Step 4: VAPID key from env =', vapidKey ? `${vapidKey.substring(0, 10)}... (${vapidKey.length} chars)` : 'UNDEFINED');
      if (!vapidKey) {
        console.error('[Push] ❌ NEXT_PUBLIC_VAPID_PUBLIC_KEY is not defined!');
        toast.error('مفاتيح الإشعارات غير مهيأة — تحقق من إعدادات الخادم');
        return false;
      }

      // 5. Convert VAPID key to Uint8Array (CRITICAL — raw base64 won't work!)
      console.log('[Push] Step 5: Converting VAPID key to Uint8Array...');
      const applicationServerKey = urlBase64ToUint8Array(vapidKey);
      console.log('[Push] ✅ Step 5: Key converted, byte length =', applicationServerKey.length);

      // 6. Check for existing subscription
      const existingSubscription = await registration.pushManager.getSubscription();

      // 7. Subscribe to push — if already subscribed with same key, reuse it
      let subscription = existingSubscription;
      if (!subscription) {
        console.log('[Push] Step 6: No existing subscription, creating new one...');
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey,  // Pass Uint8Array directly — most compatible
        });
        console.log('[Push] ✅ Step 6: Subscription created, endpoint =', subscription.endpoint?.substring(0, 60) + '...');
      } else {
        console.log('[Push] Step 6: Existing subscription found, reusing it...');
      }

      // 8. Send subscription to server (apiPost auto-handles CSRF)
      const subJson = subscription.toJSON();
      console.log('[Push] Step 7: Sending subscription to server...', {
        hasEndpoint: !!subJson.endpoint,
        hasKeys: !!(subJson.keys?.p256dh && subJson.keys?.auth),
      });
      const res = await apiPost('/api/push/subscribe', {
        subscription: subJson,
      });
      console.log('[Push] Step 7 result: ok =', res.ok, 'error =', res.error, 'status =', res.status);

      if (!res.ok) {
        throw new Error(res.error || `فشل حفظ الاشتراك (${res.status})`);
      }

      setPushState('subscribed');
      onStateChange?.(true);
      toast.success('تم تفعيل الإشعارات بنجاح 🔔');
      console.log('[Push] ═══════ Subscription complete! ═══════');
      return true;
    } catch (err) {
      console.error('[Push] ❌ Subscription failed:', err);
      const message = err instanceof Error ? err.message : 'حدث خطأ أثناء تفعيل الإشعارات';
      toast.error(message);
      setPushState('default');
      onStateChange?.(false);
      return false;
    }
  }, [onStateChange]);

  const unsubscribe = useCallback(async (): Promise<boolean> => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        // Delete from server first (using apiDelete for CSRF support)
        const endpoint = subscription.endpoint;
        const res = await apiDelete(`/api/push/subscribe?endpoint=${encodeURIComponent(endpoint)}`);

        if (!res.ok && res.status !== 404) {
          console.warn('[Push] Server delete failed:', res.error);
        }

        // Unsubscribe from browser
        await subscription.unsubscribe();
      }

      setPushState('default');
      onStateChange?.(false);
      toast.success('تم إلغاء تفعيل الإشعارات');
      return true;
    } catch (err) {
      console.error('[Push] Unsubscribe failed:', err);
      toast.error('حدث خطأ أثناء إلغاء الإشعارات');
      return false;
    }
  }, [onStateChange]);

  return {
    pushState,
    isSubscribed: pushState === 'subscribed',
    isUnsupported: pushState === 'unsupported',
    isDenied: pushState === 'denied',
    isChecking: pushState === 'checking',
    subscribe,
    unsubscribe,
  };
};

export default usePushSubscription;
