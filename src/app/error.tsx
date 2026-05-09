'use client';

import { AlertTriangle, RefreshCw } from 'lucide-react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // Log error for debugging (error is required by Next.js error boundary contract)
  void error;
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg)] p-6" dir="rtl">
      <div className="bg-[var(--color-surface)] rounded-2xl p-6 max-w-sm w-full shadow-lg text-center border border-[var(--color-border)]">
        <div className="w-16 h-16 bg-rose-50 dark:bg-rose-900/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="w-8 h-8 text-rose-400" />
        </div>
        <h2 className="text-[16px] font-black text-[var(--color-text)] mb-1.5">حدث خطأ غير متوقع</h2>
        <p className="text-[13px] text-slate-500 mb-4">عذراً، حدث خطأ أثناء تحميل الصفحة</p>
        <button
          onClick={reset}
          className="w-full flex items-center justify-center gap-2 py-3 gradient-primary text-white font-bold rounded-xl shadow-md text-sm"
        >
          <RefreshCw className="w-4 h-4" />
          إعادة المحاولة
        </button>
      </div>
    </div>
  );
}
