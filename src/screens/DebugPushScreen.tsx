'use client';

import React, { useState, useCallback } from 'react';
import { ChevronRight, ArrowLeft, Play, CheckCircle2, XCircle, Loader2, RotateCcw, AlertTriangle } from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { apiPost } from '@/lib/fetchApi';

// ── Types ──
interface TestResult {
  id: number;
  title: string;
  status: 'pending' | 'running' | 'pass' | 'fail';
  detail: string;
  subDetails?: string[];
}

// ── Helper: VAPID key conversion (from PushSubscribe.tsx) ──
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// ── Component ──
export const DebugPushScreen: React.FC = () => {
  const setSubScreen = useAppStore(s => s.setSubScreen);
  const [results, setResults] = useState<TestResult[]>([
    { id: 1, title: 'دعم المتصفح', status: 'pending', detail: '' },
    { id: 2, title: 'تسجيل Service Worker', status: 'pending', detail: '' },
    { id: 3, title: 'مفتاح VAPID', status: 'pending', detail: '' },
    { id: 4, title: 'إذن الإشعارات', status: 'pending', detail: '' },
    { id: 5, title: 'اشتراك Push', status: 'pending', detail: '' },
    { id: 6, title: 'حفظ في الخادم', status: 'pending', detail: '' },
    { id: 7, title: 'إشعار تجريبي', status: 'pending', detail: '' },
  ]);
  const [isRunning, setIsRunning] = useState(false);
  const [currentTest, setCurrentTest] = useState(0);

  const updateResult = useCallback((id: number, update: Partial<TestResult>) => {
    setResults(prev => prev.map(r => r.id === id ? { ...r, ...update } : r));
  }, []);

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const runDiagnostics = useCallback(async () => {
    setIsRunning(true);

    // Reset all results
    setResults(prev => prev.map(r => ({ ...r, status: 'pending', detail: '', subDetails: undefined })));

    // ── Test 1: Browser Support ──
    setCurrentTest(1);
    updateResult(1, { status: 'running', detail: 'جاري الفحص...' });
    await delay(400);

    const hasNotification = 'Notification' in window;
    const hasPushManager = 'PushManager' in window;
    const hasServiceWorker = 'serviceWorker' in navigator;
    const browserSupported = hasNotification && hasPushManager && hasServiceWorker;

    updateResult(1, {
      status: browserSupported ? 'pass' : 'fail',
      detail: browserSupported
        ? 'المتصفح يدعم الإشعارات'
        : 'المتصفح لا يدعم الإشعارات',
      subDetails: [
        `Notification API: ${hasNotification ? '✓' : '✗'}`,
        `PushManager API: ${hasPushManager ? '✓' : '✗'}`,
        `Service Worker API: ${hasServiceWorker ? '✓' : '✗'}`,
      ],
    });

    if (!browserSupported) {
      setIsRunning(false);
      setCurrentTest(0);
      return;
    }

    await delay(300);

    // ── Test 2: Service Worker Registration ──
    setCurrentTest(2);
    updateResult(2, { status: 'running', detail: 'جاري الفحص...' });
    await delay(400);

    try {
      const registration = await navigator.serviceWorker.ready;
      const swState = registration.active?.state || registration.installing?.state || registration.waiting?.state || 'unknown';
      const stateLabel: Record<string, string> = {
        active: 'نشط (active)',
        installing: 'قيد التثبيت (installing)',
        waiting: 'بانتظار التفعيل (waiting)',
        activated: 'مفعّل (activated)',
        redundant: 'مهمل (redundant)',
        unknown: 'غير معروف',
      };

      if (registration.active) {
        updateResult(2, {
          status: 'pass',
          detail: 'Service Worker مسجّل ونشط',
          subDetails: [
            `الحالة: ${stateLabel[swState] || swState}`,
            `النطاق: ${registration.scope}`,
          ],
        });
      } else {
        updateResult(2, {
          status: 'fail',
          detail: 'Service Worker مسجّل لكنه غير نشط',
          subDetails: [
            `الحالة: ${stateLabel[swState] || swState}`,
          ],
        });
      }
    } catch (err) {
      updateResult(2, {
        status: 'fail',
        detail: 'فشل تسجيل Service Worker',
        subDetails: [err instanceof Error ? err.message : String(err)],
      });
    }

    await delay(300);

    // ── Test 3: VAPID Public Key ──
    setCurrentTest(3);
    updateResult(3, { status: 'running', detail: 'جاري الفحص...' });
    await delay(400);

    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const keyStartsWithB = vapidKey?.startsWith('B') ?? false;
    const keyLengthOk = vapidKey ? Math.abs(vapidKey.length - 87) <= 2 : false;
    const keyValid = keyStartsWithB && keyLengthOk;

    updateResult(3, {
      status: keyValid ? 'pass' : 'fail',
      detail: keyValid
        ? 'مفتاح VAPID صالح'
        : vapidKey
          ? 'مفتاح VAPID غير صالح'
          : 'مفتاح VAPID غير موجود',
      subDetails: vapidKey
        ? [
            `أول 10 أحرف: ${vapidKey.substring(0, 10)}...`,
            `الطول: ${vapidKey.length} حرف`,
            `يبدأ بـ B: ${keyStartsWithB ? '✓' : '✗'}`,
            `الطول ≈ 87: ${keyLengthOk ? '✓' : '✗'}`,
          ]
        : ['NEXT_PUBLIC_VAPID_PUBLIC_KEY غير معرّف'],
    });

    await delay(300);

    // ── Test 4: Notification Permission ──
    setCurrentTest(4);
    updateResult(4, { status: 'running', detail: 'جاري الفحص...' });
    await delay(400);

    const permission = Notification.permission;
    const permissionLabels: Record<string, string> = {
      granted: 'مقبول ✓',
      denied: 'مرفوض ✗',
      default: 'غير محدد',
    };

    updateResult(4, {
      status: permission === 'granted' ? 'pass' : permission === 'denied' ? 'fail' : 'fail',
      detail: `الإذن: ${permissionLabels[permission] || permission}`,
      subDetails: [
        permission === 'denied'
          ? 'يجب السماح بالإشعارات من إعدادات المتصفح'
          : permission === 'default'
            ? 'لم يتم طلب الإذن بعد — سيُطلب في خطوة الاشتراك'
            : 'تم منح الإذن بنجاح',
      ],
    });

    await delay(300);

    // ── Test 5: Push Subscription ──
    setCurrentTest(5);
    updateResult(5, { status: 'running', detail: 'جاري الفحص...' });
    await delay(400);

    let subscription: PushSubscription | null = null;

    try {
      // Request permission if not yet granted
      if (Notification.permission === 'default') {
        const permResult = await Notification.requestPermission();
        if (permResult !== 'granted') {
          updateResult(5, {
            status: 'fail',
            detail: 'تم رفض إذن الإشعارات',
            subDetails: ['يجب السماح بالإشعارات من إعدادات المتصفح'],
          });
          setIsRunning(false);
          setCurrentTest(0);
          return;
        }
      }

      if (Notification.permission === 'denied') {
        updateResult(5, {
          status: 'fail',
          detail: 'الإشعارات مرفوضة — لا يمكن الاشتراك',
          subDetails: ['افتح إعدادات المتصفح واسمح بالإشعارات لهذا الموقع'],
        });
        setIsRunning(false);
        setCurrentTest(0);
        return;
      }

      const registration = await navigator.serviceWorker.ready;

      // Check for existing subscription first
      const existingSub = await registration.pushManager.getSubscription();

      if (existingSub) {
        subscription = existingSub;
        updateResult(5, {
          status: 'pass',
          detail: 'تم الاشتراك مسبقاً — تم إعادة استخدام الاشتراك',
          subDetails: [
            `نقطة النهاية: ${subscription.endpoint.substring(0, 60)}...`,
            `مفاتيح: p256dh=${!!subscription.toJSON().keys?.p256dh}, auth=${!!subscription.toJSON().keys?.auth}`,
          ],
        });
      } else if (!vapidKey) {
        updateResult(5, {
          status: 'fail',
          detail: 'لا يمكن الاشتراك — مفتاح VAPID غير موجود',
          subDetails: ['تأكد من تعريف NEXT_PUBLIC_VAPID_PUBLIC_KEY'],
        });
      } else {
        const applicationServerKey = urlBase64ToUint8Array(vapidKey);
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey,
        });

        updateResult(5, {
          status: 'pass',
          detail: 'تم الاشتراك بنجاح',
          subDetails: [
            `نقطة النهاية: ${subscription.endpoint.substring(0, 60)}...`,
            `مفاتيح: p256dh=${!!subscription.toJSON().keys?.p256dh}, auth=${!!subscription.toJSON().keys?.auth}`,
          ],
        });
      }
    } catch (err) {
      updateResult(5, {
        status: 'fail',
        detail: 'فشل الاشتراك في Push',
        subDetails: [err instanceof Error ? err.message : String(err)],
      });
    }

    await delay(300);

    // ── Test 6: Server Save ──
    setCurrentTest(6);
    updateResult(6, { status: 'running', detail: 'جاري الفحص...' });
    await delay(400);

    if (!subscription) {
      updateResult(6, {
        status: 'fail',
        detail: 'لا يمكن الحفظ — لا يوجد اشتراك',
        subDetails: ['خطوة الاشتراك السابقة فشلت'],
      });
    } else {
      try {
        const subJson = subscription.toJSON();
        const res = await apiPost('/api/push/subscribe', {
          subscription: subJson,
        });

        if (res.ok) {
          updateResult(6, {
            status: 'pass',
            detail: 'تم حفظ الاشتراك في الخادم',
            subDetails: [
              `الحالة: ${res.status}`,
              `النقطة: ${subJson.endpoint?.substring(0, 40)}...`,
            ],
          });
        } else {
          updateResult(6, {
            status: 'fail',
            detail: 'فشل حفظ الاشتراك في الخادم',
            subDetails: [
              `خطأ: ${res.error || 'غير معروف'}`,
              `الحالة: ${res.status}`,
            ],
          });
        }
      } catch (err) {
        updateResult(6, {
          status: 'fail',
          detail: 'خطأ في الاتصال بالخادم',
          subDetails: [err instanceof Error ? err.message : String(err)],
        });
      }
    }

    await delay(300);

    // ── Test 7: Send Test Notification ──
    setCurrentTest(7);
    updateResult(7, { status: 'running', detail: 'جاري الفحص...' });
    await delay(400);

    try {
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification('🔍 إشعار تجريبي — سوق شامل', {
        body: 'إذا ترى هذا الإشعار، فالنظام يعمل بشكل صحيح! ✅',
        icon: '/app-icon.png',
        badge: '/app-icon.png',
        tag: 'debug-test-notification',
        requireInteraction: true,
      });

      updateResult(7, {
        status: 'pass',
        detail: 'تم عرض الإشعار التجريبي',
        subDetails: ['تحقق من ظهور الإشعار على جهازك'],
      });
    } catch (err) {
      updateResult(7, {
        status: 'fail',
        detail: 'فشل عرض الإشعار التجريبي',
        subDetails: [err instanceof Error ? err.message : String(err)],
      });
    }

    setIsRunning(false);
    setCurrentTest(0);
  }, [updateResult]);

  const passCount = results.filter(r => r.status === 'pass').length;
  const failCount = results.filter(r => r.status === 'fail').length;
  const allDone = results.every(r => r.status === 'pass' || r.status === 'fail');

  return (
    <div className="min-h-[100dvh] bg-[var(--color-bg)]" dir="rtl">
      {/* Header */}
      <header className="gradient-dark px-5 pt-8 pb-6 relative overflow-hidden">
        <div className="absolute top-[-30px] right-[-20px] w-[140px] h-[140px] rounded-full bg-teal-600/15 blur-[50px]" />
        <div className="absolute bottom-[-15px] left-[-10px] w-[100px] h-[100px] rounded-full bg-emerald-600/10 blur-[40px]" />
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <button
              onClick={() => setSubScreen('none')}
              className="w-10 h-10 bg-[var(--color-surface)]/10 backdrop-blur-sm rounded-xl flex items-center justify-center hover:bg-[var(--color-surface)]/20 transition-colors"
              aria-label="رجوع"
            >
              <ArrowLeft className="w-5 h-5 text-teal-300" />
            </button>
            <div>
              <h1 className="text-white font-black text-lg leading-tight">تشخيص الإشعارات 🔔</h1>
              <p className="text-teal-300/60 text-xs font-medium mt-0.5">اختبار خطوة بخطوة لنظام الإشعارات</p>
            </div>
          </div>

          {/* Summary bar */}
          {allDone && (
            <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl ${
              failCount === 0
                ? 'bg-emerald-500/20 border border-emerald-500/30'
                : 'bg-rose-500/20 border border-rose-500/30'
            }`}>
              {failCount === 0 ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-rose-400" />
              )}
              <span className={`text-sm font-bold ${
                failCount === 0 ? 'text-emerald-300' : 'text-rose-300'
              }`}>
                {failCount === 0
                  ? `جميع الاختبارات ناجحة (${passCount}/${results.length})`
                  : `${failCount} اختبار فاشل من ${results.length}`
                }
              </span>
            </div>
          )}
        </div>
      </header>

      <main className="px-5 py-4 space-y-3">
        {/* Action Buttons */}
        <div className="flex gap-3 mb-2">
          <button
            onClick={runDiagnostics}
            disabled={isRunning}
            className={`flex-1 flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl font-bold text-sm transition-all duration-200 ${
              isRunning
                ? 'bg-[var(--color-surface)] text-[var(--color-text-tertiary)] cursor-not-allowed border border-[var(--color-border)]'
                : 'bg-gradient-to-l from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/25 active:scale-[0.98]'
            }`}
          >
            {isRunning ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>جاري التشخيص...</span>
              </>
            ) : (
              <>
                <Play className="w-5 h-5" />
                <span>بدء التشخيص</span>
              </>
            )}
          </button>

          <button
            onClick={runDiagnostics}
            disabled={isRunning}
            className="w-12 h-12 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl flex items-center justify-center hover:bg-[var(--color-surface)]/80 transition-colors disabled:opacity-50"
            aria-label="إعادة التشخيص"
          >
            <RotateCcw className={`w-5 h-5 text-[var(--color-text-secondary)] ${isRunning ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Test Results */}
        {results.map((result, index) => (
          <div
            key={result.id}
            className={`bg-[var(--color-surface)] border rounded-xl overflow-hidden transition-all duration-300 ${
              result.status === 'running'
                ? 'border-emerald-500/50 shadow-sm shadow-emerald-500/10'
                : result.status === 'pass'
                  ? 'border-emerald-500/20'
                  : result.status === 'fail'
                    ? 'border-rose-500/20'
                    : 'border-[var(--color-border)]'
            }`}
          >
            <div className="flex items-center gap-3 p-4">
              {/* Step number or status icon */}
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 text-sm font-black ${
                result.status === 'pending'
                  ? 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                  : result.status === 'running'
                    ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
                    : result.status === 'pass'
                      ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
                      : 'bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400'
              }`}>
                {result.status === 'running' ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : result.status === 'pass' ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : result.status === 'fail' ? (
                  <XCircle className="w-5 h-5" />
                ) : (
                  <span>{index + 1}</span>
                )}
              </div>

              {/* Title & detail */}
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold text-[var(--color-text)]">{result.title}</h3>
                {result.detail && (
                  <p className={`text-xs font-medium mt-0.5 ${
                    result.status === 'pass' ? 'text-emerald-600 dark:text-emerald-400' :
                    result.status === 'fail' ? 'text-rose-600 dark:text-rose-400' :
                    result.status === 'running' ? 'text-emerald-500 animate-pulse' :
                    'text-[var(--color-text-tertiary)]'
                  }`}>
                    {result.detail}
                  </p>
                )}
              </div>

              {/* Chevron for expanded details */}
              {result.status === 'running' && (
                <ChevronRight className="w-4 h-4 text-emerald-500 animate-pulse flex-shrink-0" />
              )}
            </div>

            {/* Sub-details */}
            {result.subDetails && result.subDetails.length > 0 && (
              <div className="px-4 pb-3 border-t border-[var(--color-border)]/50">
                <div className="mt-2 space-y-1">
                  {result.subDetails.map((sub, i) => (
                    <p key={i} className="text-[11px] font-medium text-[var(--color-text-tertiary)] font-mono leading-relaxed">
                      {sub}
                    </p>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Progress bar */}
        {isRunning && (
          <div className="mt-4">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-[var(--color-text-secondary)]">
                التقدم: {results.filter(r => r.status === 'pass' || r.status === 'fail').length} / {results.length}
              </span>
              <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                اختبار {currentTest > 0 ? currentTest : '...'}
              </span>
            </div>
            <div className="w-full h-2 bg-[var(--color-surface)] rounded-full overflow-hidden border border-[var(--color-border)]">
              <div
                className="h-full bg-gradient-to-l from-emerald-400 to-teal-500 rounded-full transition-all duration-500 ease-out"
                style={{
                  width: `${((results.filter(r => r.status === 'pass' || r.status === 'fail').length) / results.length) * 100}%`,
                }}
              />
            </div>
          </div>
        )}

        {/* Tips section */}
        <div className="mt-6 p-4 bg-amber-50/50 dark:bg-amber-900/10 border border-amber-200/50 dark:border-amber-800/30 rounded-xl">
          <h4 className="text-xs font-black text-amber-700 dark:text-amber-400 mb-2">💡 نصائح لحل المشاكل</h4>
          <ul className="space-y-1.5 text-[11px] text-amber-600 dark:text-amber-400/80 font-medium leading-relaxed">
            <li>• إذا فشل إذن الإشعارات: افتح إعدادات الموقع في المتصفح واسمح بالإشعارات</li>
            <li>• إذا فشل Service Worker: تأكد أنك تستخدم HTTPS أو localhost</li>
            <li>• إذا فشل مفتاح VAPID: تحقق من متغير NEXT_PUBLIC_VAPID_PUBLIC_KEY</li>
            <li>• إذا فشل حفظ الخادم: تحقق من تسجيل الدخول واتصال الإنترنت</li>
            <li>• إذا فشل الإشعار التجريبي: تحقق أن المتصفح يسمح بالإشعارات من هذا الموقع</li>
          </ul>
        </div>
      </main>
    </div>
  );
};

export default DebugPushScreen;
