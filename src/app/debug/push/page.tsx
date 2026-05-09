'use client';

import { useState } from 'react';
import { apiPost, ensureCsrfReady } from '@/lib/fetchApi';

/**
 * Convert a VAPID base64 public key to a Uint8Array.
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

interface TestResult {
  name: string;
  nameAr: string;
  status: 'pending' | 'running' | 'pass' | 'fail';
  message: string;
  details?: string;
}

const initialTests: TestResult[] = [
  { name: 'browser-support', nameAr: 'دعم المتصفح', status: 'pending', message: '' },
  { name: 'sw-registration', nameAr: 'تسجيل Service Worker', status: 'pending', message: '' },
  { name: 'vapid-key', nameAr: 'صلاحية مفتاح VAPID', status: 'pending', message: '' },
  { name: 'permission', nameAr: 'حالة الإذن', status: 'pending', message: '' },
  { name: 'subscribe', nameAr: 'إنشاء اشتراك Push', status: 'pending', message: '' },
  { name: 'server-save', nameAr: 'حفظ الاشتراك في الخادم', status: 'pending', message: '' },
];

export default function PushDebugPage() {
  const [tests, setTests] = useState<TestResult[]>(initialTests);
  const [running, setRunning] = useState(false);

  const updateTest = (name: string, update: Partial<TestResult>) => {
    setTests(prev => prev.map(t => t.name === name ? { ...t, ...update } : t));
  };

  const runDiagnostics = async () => {
    setRunning(true);
    setTests(initialTests);

    // ── Test 1: Browser Support ──
    updateTest('browser-support', { status: 'running', message: 'جاري الفحص...' });
    await sleep(300);
    const hasSW = 'serviceWorker' in navigator;
    const hasPush = 'PushManager' in window;
    const hasNotif = 'Notification' in window;
    if (hasSW && hasPush && hasNotif) {
      updateTest('browser-support', { status: 'pass', message: 'المتصفح يدعم الإشعارات', details: `SW: ${hasSW}, Push: ${hasPush}, Notification: ${hasNotif}` });
    } else {
      updateTest('browser-support', { status: 'fail', message: 'المتصفح لا يدعم الإشعارات', details: `SW: ${hasSW}, Push: ${hasPush}, Notification: ${hasNotif}` });
      setRunning(false);
      // Skip remaining tests
      markRemainingFailed('sw-registration');
      return;
    }

    // ── Test 2: Service Worker Registration ──
    updateTest('sw-registration', { status: 'running', message: 'جاري الفحص...' });
    await sleep(300);
    try {
      let registration = await navigator.serviceWorker.getRegistration('/');
      if (!registration) {
        registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
        await sleep(1000); // Wait for SW to install
      }
      const state = registration.active?.state || registration.installing?.state || registration.waiting?.state || 'unknown';
      if (registration.active && registration.active.state === 'activated') {
        updateTest('sw-registration', { status: 'pass', message: `Service Worker مسجل وفعّال`, details: `State: ${state}, Scope: ${registration.scope}` });
      } else {
        // Try waiting for it
        await navigator.serviceWorker.ready;
        updateTest('sw-registration', { status: 'pass', message: `Service Worker مسجل`, details: `State: ${state}` });
      }
    } catch (err: any) {
      updateTest('sw-registration', { status: 'fail', message: 'فشل تسجيل Service Worker', details: err?.message });
      setRunning(false);
      markRemainingFailed('vapid-key');
      return;
    }

    // ── Test 3: VAPID Key Validity ──
    updateTest('vapid-key', { status: 'running', message: 'جاري الفحص...' });
    await sleep(300);
    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidKey) {
      updateTest('vapid-key', { status: 'fail', message: 'مفتاح VAPID غير موجود في المتغيرات البيئية', details: 'NEXT_PUBLIC_VAPID_PUBLIC_KEY is undefined' });
      setRunning(false);
      markRemainingFailed('permission');
      return;
    }
    try {
      const keyBytes = urlBase64ToUint8Array(vapidKey);
      if (keyBytes.length === 65) {
        updateTest('vapid-key', { status: 'pass', message: 'مفتاح VAPID صالح', details: `Key length: ${vapidKey.length} chars → ${keyBytes.length} bytes` });
      } else {
        updateTest('vapid-key', { status: 'fail', message: 'مفتاح VAPID بطول غير صحيح', details: `Expected 65 bytes, got ${keyBytes.length}` });
      }
    } catch (err: any) {
      updateTest('vapid-key', { status: 'fail', message: 'فشل تحويل مفتاح VAPID', details: err?.message });
      setRunning(false);
      markRemainingFailed('permission');
      return;
    }

    // ── Test 4: Permission Status ──
    updateTest('permission', { status: 'running', message: 'جاري الفحص...' });
    await sleep(300);
    const perm = Notification.permission;
    if (perm === 'granted') {
      updateTest('permission', { status: 'pass', message: 'الإذن ممنوح', details: `Permission: ${perm}` });
    } else if (perm === 'denied') {
      updateTest('permission', { status: 'fail', message: 'تم رفض إذن الإشعارات — يجب السماح من إعدادات المتصفح', details: `Permission: ${perm}` });
      setRunning(false);
      markRemainingFailed('subscribe');
      return;
    } else {
      // Request permission
      const newPerm = await Notification.requestPermission();
      if (newPerm === 'granted') {
        updateTest('permission', { status: 'pass', message: 'تم منح الإذن بنجاح', details: `Permission: ${perm} → ${newPerm}` });
      } else {
        updateTest('permission', { status: 'fail', message: 'تم رفض إذن الإشعارات', details: `Permission: ${newPerm}` });
        setRunning(false);
        markRemainingFailed('subscribe');
        return;
      }
    }

    // ── Test 5: PushManager.subscribe ──
    updateTest('subscribe', { status: 'running', message: 'جاري إنشاء الاشتراك...' });
    await sleep(300);
    let subscription: PushSubscription | null = null;
    try {
      const registration = await navigator.serviceWorker.ready;
      const existingSub = await registration.pushManager.getSubscription();

      if (existingSub) {
        subscription = existingSub;
        updateTest('subscribe', { status: 'pass', message: 'تم العثور على اشتراك موجود', details: `Endpoint: ${existingSub.endpoint.substring(0, 60)}...` });
      } else {
        const applicationServerKey = urlBase64ToUint8Array(vapidKey) as unknown as BufferSource;
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey,
        });
        updateTest('subscribe', { status: 'pass', message: 'تم إنشاء اشتراك جديد بنجاح', details: `Endpoint: ${subscription.endpoint.substring(0, 60)}...` });
      }
    } catch (err: any) {
      updateTest('subscribe', { status: 'fail', message: 'فشل إنشاء اشتراك Push', details: err?.message });
      setRunning(false);
      markRemainingFailed('server-save');
      return;
    }

    // ── Test 6: Server Save ──
    updateTest('server-save', { status: 'running', message: 'جاري الحفظ في الخادم...' });
    try {
      await ensureCsrfReady();
      const subJson = subscription!.toJSON();
      const res = await apiPost('/api/push/subscribe', {
        subscription: subJson,
      });

      if (res.ok) {
        updateTest('server-save', { status: 'pass', message: 'تم حفظ الاشتراك في الخادم بنجاح', details: `Status: ${res.status}` });
      } else {
        const errorDetail = res.error || 'Unknown error';
        updateTest('server-save', { status: 'fail', message: `فشل الحفظ في الخادم (${res.status})`, details: `Error: ${errorDetail}` });
      }
    } catch (err: any) {
      updateTest('server-save', { status: 'fail', message: 'فشل الاتصال بالخادم', details: err?.message });
    }

    setRunning(false);
  };

  const markRemainingFailed = (fromTest: string) => {
    const startIdx = tests.findIndex(t => t.name === fromTest);
    for (let i = startIdx; i < tests.length; i++) {
      updateTest(tests[i].name, { status: 'fail', message: 'تم تخطي هذا الاختبار بسبب فشل سابق' });
    }
  };

  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const getStatusIcon = (status: TestResult['status']) => {
    switch (status) {
      case 'pass': return '✅';
      case 'fail': return '❌';
      case 'running': return '⏳';
      default: return '⚪';
    }
  };

  const getStatusColor = (status: TestResult['status']) => {
    switch (status) {
      case 'pass': return 'text-green-600 dark:text-green-400';
      case 'fail': return 'text-red-600 dark:text-red-400';
      case 'running': return 'text-yellow-600 dark:text-yellow-400';
      default: return 'text-gray-400';
    }
  };

  const passedCount = tests.filter(t => t.status === 'pass').length;
  const failedCount = tests.filter(t => t.status === 'fail').length;
  const totalDone = passedCount + failedCount;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 sm:p-8" dir="rtl">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2">
            🔔 تشخيص الإشعارات الخارجية
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            أداة فحص شاملة لنظام Web Push Notifications
          </p>
        </div>

        {/* Summary */}
        {totalDone > 0 && (
          <div className="mb-6 grid grid-cols-3 gap-3">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 text-center shadow-sm border border-gray-100 dark:border-gray-700">
              <div className="text-2xl font-bold text-green-600">{passedCount}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">ناجح</div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 text-center shadow-sm border border-gray-100 dark:border-gray-700">
              <div className="text-2xl font-bold text-red-600">{failedCount}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">فاشل</div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 text-center shadow-sm border border-gray-100 dark:border-gray-700">
              <div className="text-2xl font-bold text-gray-400">{6 - totalDone}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">متبقي</div>
            </div>
          </div>
        )}

        {/* Test Results */}
        <div className="space-y-3 mb-8">
          {tests.map((test) => (
            <div
              key={test.name}
              className={`bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border transition-all ${
                test.status === 'pass'
                  ? 'border-green-200 dark:border-green-800'
                  : test.status === 'fail'
                  ? 'border-red-200 dark:border-red-800'
                  : 'border-gray-100 dark:border-gray-700'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-xl flex-shrink-0">
                  {getStatusIcon(test.status)}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h3 className={`font-medium ${getStatusColor(test.status)}`}>
                      {test.nameAr}
                    </h3>
                    <span className="text-xs text-gray-400 font-mono">
                      {test.name}
                    </span>
                  </div>
                  {test.message && (
                    <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                      {test.message}
                    </p>
                  )}
                  {test.details && (
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 font-mono truncate" title={test.details}>
                      {test.details}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Run Button */}
        <div className="text-center">
          <button
            onClick={runDiagnostics}
            disabled={running}
            className={`px-8 py-3 rounded-xl font-bold text-white text-lg transition-all shadow-lg ${
              running
                ? 'bg-gray-400 cursor-not-allowed shadow-gray-300'
                : 'bg-gradient-to-l from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 shadow-emerald-300/50 hover:shadow-emerald-400/50'
            }`}
          >
            {running ? (
              <span className="flex items-center gap-2 justify-center">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                جاري التشخيص...
              </span>
            ) : (
              '🔍 تشغيل التشخيص'
            )}
          </button>
        </div>

        {/* Info Section */}
        <div className="mt-10 bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
          <h2 className="font-bold text-gray-900 dark:text-white mb-3 text-sm">📋 ما الذي يفحصه هذا التشخيص؟</h2>
          <div className="space-y-2 text-xs text-gray-500 dark:text-gray-400">
            <p><strong className="text-gray-700 dark:text-gray-300">1. دعم المتصفح:</strong> هل المتصفح يدعم Service Worker و Push Manager و Notifications API</p>
            <p><strong className="text-gray-700 dark:text-gray-300">2. تسجيل Service Worker:</strong> هل ملف sw.js مسجل وفعّال</p>
            <p><strong className="text-gray-700 dark:text-gray-300">3. مفتاح VAPID:</strong> هل المفتاح العام موجود وصالح (65 بايت)</p>
            <p><strong className="text-gray-700 dark:text-gray-300">4. حالة الإذن:</strong> هل منح المستخدم إذن الإشعارات</p>
            <p><strong className="text-gray-700 dark:text-gray-300">5. إنشاء اشتراك:</strong> هل يمكن إنشاء PushSubscription عبر PushManager</p>
            <p><strong className="text-gray-700 dark:text-gray-300">6. حفظ الخادم:</strong> هل يمكن حفظ الاشتراك في قاعدة البيانات عبر /api/push/subscribe</p>
          </div>
        </div>
      </div>
    </div>
  );
}
