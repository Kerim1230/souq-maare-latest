'use client';

import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { apiPost } from '@/lib/fetchApi';

/**
 * Convert a VAPID base64 public key to a Uint8Array.
 * This is REQUIRED by pushManager.subscribe({ applicationServerKey }).
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
 * Headless push-subscription manager.
 * Does NOT render any UI — exposes subscribe/unsubscribe via ref
 * so the parent Toggle can drive it.
 */
export const usePushSubscription = (onStateChange?: (subscribed: boolean) => void) => {
  const [pushState, setPushState] = useState<'checking' | 'unsupported' | 'denied' | 'subscribed' | 'default'>('checking');

  const checkPushState = useCallback(async () => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      setPushState('unsupported');
      onStateChange?.(false);
      return;
    }

    try {
      const permission = Notification.permission;
      if (permission === 'denied') {
        setPushState('denied');
        onStateChange?.(false);
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription && permission === 'granted') {
        setPushState('subscribed');
        onStateChange?.(true);
      } else {
        setPushState('default');
        onStateChange?.(false);
      }
    } catch {
      setPushState('unsupported');
      onStateChange?.(false);
    }
  }, [onStateChange]);

  useEffect(() => {
    checkPushState();
  }, [checkPushState]);

  const subscribe = useCallback(async (): Promise<boolean> => {
    try {
      console.log('[Push] Starting subscription flow...');

      // 1. Request notification permission
      const permission = await Notification.requestPermission();
      console.log('[Push] Permission result:', permission);
      if (permission !== 'granted') {
        toast.error(permission === 'denied' ? 'تم رفض إذن الإشعارات من المتصفح' : 'لم يتم منح إذن الإشعارات');
        setPushState(permission === 'denied' ? 'denied' : 'default');
        onStateChange?.(false);
        return false;
      }

      // 2. Wait for service worker to be ready
      const registration = await navigator.serviceWorker.ready;
      console.log('[Push] SW ready');

      // 3. Get VAPID public key
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidKey) {
        console.error('[Push] VAPID public key not found in env');
        toast.error('مفاتيح الإشعارات غير مهيأة');
        return false;
      }
      console.log('[Push] VAPID key found, length:', vapidKey.length);

      // 4. Convert VAPID key to Uint8Array (CRITICAL — raw base64 won't work!)
      const applicationServerKey = urlBase64ToUint8Array(vapidKey);

      // 5. Subscribe to push
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey as BufferSource,
      });
      console.log('[Push] Subscription created:', subscription.endpoint?.substring(0, 50));

      // 6. Send subscription to server
      const res = await apiPost('/api/push/subscribe', {
        subscription: subscription.toJSON(),
      });
      console.log('[Push] Server response:', res.ok, res.error);

      if (res.error) {
        throw new Error(res.error);
      }

      setPushState('subscribed');
      onStateChange?.(true);
      toast.success('تم تفعيل الإشعارات بنجاح 🔔');
      return true;
    } catch (err) {
      console.error('[Push] Subscription failed:', err);
      toast.error('حدث خطأ أثناء تفعيل الإشعارات');
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
        await fetch(`/api/push/subscribe?endpoint=${encodeURIComponent(subscription.endpoint)}`, {
          method: 'DELETE',
          credentials: 'include',
        });
        await subscription.unsubscribe();
      }

      setPushState('default');
      onStateChange?.(false);
      toast.success('تم إلغاء تفعيل الإشعارات');
      return true;
    } catch {
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
