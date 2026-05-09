'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Bell, BellOff, Check, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { apiPost } from '@/lib/fetchApi';

type PushState = 'unsupported' | 'default' | 'granted' | 'denied' | 'subscribing' | 'subscribed';

export const PushSubscribe: React.FC = () => {
  const [pushState, setPushState] = useState<PushState>('default');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    checkPushState();
  }, []);

  const checkPushState = useCallback(async () => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      setPushState('unsupported');
      return;
    }

    try {
      const permission = Notification.permission;
      if (permission === 'denied') {
        setPushState('denied');
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription && permission === 'granted') {
        setPushState('subscribed');
      } else if (permission === 'granted') {
        setPushState('granted');
      } else {
        setPushState('default');
      }
    } catch {
      setPushState('unsupported');
    }
  }, []);

  const handleSubscribe = async () => {
    if (pushState === 'subscribing') return;
    setPushState('subscribing');

    try {
      // 1. Request notification permission
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setPushState(permission === 'denied' ? 'denied' : 'default');
        toast.error('تم رفض إذن الإشعارات');
        return;
      }

      // 2. Wait for service worker to be ready
      const registration = await navigator.serviceWorker.ready;

      // 3. Get VAPID public key
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidKey) {
        toast.error('مفاتيح الإشعارات غير مهيأة');
        setPushState('granted');
        return;
      }

      // 4. Subscribe to push
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: vapidKey,
      });

      // 5. Send subscription to server
      const res = await apiPost('/api/push/subscribe', {
        subscription: subscription.toJSON(),
      });

      if (res.error) {
        throw new Error(res.error);
      }

      setPushState('subscribed');
      toast.success('تم تفعيل الإشعارات بنجاح 🔔');
    } catch (err) {
      console.error('Push subscription failed:', err);
      toast.error('حدث خطأ أثناء تفعيل الإشعارات');
      setPushState('granted');
    }
  };

  const handleUnsubscribe = async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        // Remove from server
        await fetch(`/api/push/subscribe?endpoint=${encodeURIComponent(subscription.endpoint)}`, {
          method: 'DELETE',
          credentials: 'include',
        });
        // Unsubscribe from browser
        await subscription.unsubscribe();
      }

      setPushState('default');
      toast.success('تم إلغاء تفعيل الإشعارات');
    } catch {
      toast.error('حدث خطأ أثناء إلغاء الإشعارات');
    }
  };

  if (!mounted) return null;

  // Unsupported browser
  if (pushState === 'unsupported') {
    return (
      <div className="flex items-center gap-3 py-3.5">
        <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 flex-shrink-0">
          <BellOff className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <p className="text-[13px] font-bold text-[var(--color-text-tertiary)]">إشعارات Push</p>
          <p className="text-[11px] text-[var(--color-text-tertiary)] mt-0.5">المتصفح لا يدعم الإشعارات</p>
        </div>
      </div>
    );
  }

  // Denied permission
  if (pushState === 'denied') {
    return (
      <div className="flex items-center gap-3 py-3.5">
        <div className="w-9 h-9 rounded-xl bg-red-50 dark:bg-red-900/30 flex items-center justify-center text-red-500 flex-shrink-0">
          <BellOff className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <p className="text-[13px] font-bold text-red-600 dark:text-red-400">الإشعارات محظورة</p>
          <p className="text-[11px] text-[var(--color-text-tertiary)] mt-0.5">فعّل الإشعارات من إعدادات المتصفح</p>
        </div>
      </div>
    );
  }

  // Already subscribed
  if (pushState === 'subscribed') {
    return (
      <div className="flex items-center justify-between py-3.5 gap-3">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-500 flex-shrink-0">
            <Check className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-bold text-emerald-600 dark:text-emerald-400">الإشعارات مفعلة ✅</p>
            <p className="text-[11px] text-[var(--color-text-tertiary)] mt-0.5">ستصلك الإشعارات فورياً</p>
          </div>
        </div>
        <button
          onClick={handleUnsubscribe}
          className="text-[11px] font-bold text-red-500 hover:text-red-600 transition-colors px-2 py-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
        >
          إلغاء
        </button>
      </div>
    );
  }

  // Subscribing (loading)
  if (pushState === 'subscribing') {
    return (
      <div className="flex items-center gap-3 py-3.5">
        <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-500 flex-shrink-0">
          <Loader2 className="w-4 h-4 animate-spin" />
        </div>
        <div className="min-w-0">
          <p className="text-[13px] font-bold text-emerald-600 dark:text-emerald-400">جاري التفعيل...</p>
        </div>
      </div>
    );
  }

  // Not yet subscribed — show subscribe button
  return (
    <button
      onClick={handleSubscribe}
      className="w-full flex items-center gap-3 py-3.5 group"
    >
      <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-500 dark:text-emerald-400 flex-shrink-0 group-hover:bg-emerald-100 dark:group-hover:bg-emerald-900/50 transition-colors">
        <Bell className="w-4 h-4" />
      </div>
      <div className="min-w-0 text-right flex-1">
        <p className="text-[13px] font-bold text-[var(--color-text)] group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
          تفعيل الإشعارات 🔔
        </p>
        <p className="text-[11px] text-[var(--color-text-tertiary)] mt-0.5">
          استلم إشعارات فورية للرسائل والعروض وغيرها
        </p>
      </div>
    </button>
  );
};

export default PushSubscribe;
