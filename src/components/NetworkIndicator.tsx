'use client';
import React, { useState, useEffect, useRef } from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';
import { apiGet } from '@/lib/fetchApi';

/**
 * Offline/weak internet indicator bar.
 * Shows at the top of the app when the user goes offline,
 * with a retry button to attempt reconnection.
 */
export const NetworkIndicator: React.FC = () => {
  const [isOffline, setIsOffline] = useState(() => {
    if (typeof navigator === 'undefined') return false;
    return !navigator.onLine;
  });
  const [isSlow, setIsSlow] = useState(false);
  const [showSlow, setShowSlow] = useState(false);
  const slowTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      setShowSlow(false);
      // Verify connection by pinging the API
      apiGet('/api/stores?limit=1')
        .then(({ ok }) => {
          if (ok) setIsSlow(false);
        })
        .catch(() => setIsSlow(true));
    };

    const handleOffline = () => {
      setIsOffline(true);
      setShowSlow(false);
    };

    const handleChange = () => {
      const conn = (navigator as unknown as Record<string, unknown>).connection as Record<string, unknown> | undefined;
      if (conn) {
        const effectiveType = conn.effectiveType as string | undefined;
        if (effectiveType === '2g' || effectiveType === 'slow-2g') {
          setIsSlow(true);
          setShowSlow(true);
          // Auto-hide after 5s
          if (slowTimerRef.current) clearTimeout(slowTimerRef.current);
          slowTimerRef.current = setTimeout(() => setShowSlow(false), 5000);
        } else {
          setIsSlow(false);
          setShowSlow(false);
        }
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const conn = (navigator as unknown as Record<string, unknown>).connection as Record<string, unknown> | undefined;
    if (conn && conn.addEventListener) {
      (conn as unknown as EventTarget).addEventListener('change', handleChange);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (conn && conn.removeEventListener) {
        (conn as unknown as EventTarget).removeEventListener('change', handleChange);
      }
      // Clear slow timer on unmount to prevent setState on unmounted component
      if (slowTimerRef.current) {
        clearTimeout(slowTimerRef.current);
        slowTimerRef.current = null;
      }
    };
  }, []);

  const handleRetry = () => {
    // Attempt to reconnect by making a simple fetch
    apiGet('/api/stores?limit=1')
      .then(({ ok }) => {
        if (ok) {
          setIsOffline(false);
          setIsSlow(false);
        }
      })
      .catch(() => {});
  };

  if (isOffline) {
    return (
      <div className="fixed top-0 left-0 right-0 z-[9999] bg-rose-500 text-white px-4 py-2.5 flex items-center justify-center gap-2 shadow-lg shadow-rose-500/30 safe-area-top">
        <WifiOff className="w-4 h-4 flex-shrink-0" />
        <p className="text-[13px] font-bold">لا يوجد اتصال بالإنترنت</p>
        <button
          onClick={handleRetry}
          className="flex items-center gap-1 bg-white/20 hover:bg-white/30 rounded-lg px-2.5 py-1 text-[12px] font-bold transition-colors mr-2"
        >
          <RefreshCw className="w-3 h-3" />
          إعادة المحاولة
        </button>
      </div>
    );
  }

  if (isSlow && showSlow) {
    return (
      <div className="fixed top-0 left-0 right-0 z-[9999] bg-amber-500 text-white px-4 py-2 flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 safe-area-top">
        <WifiOff className="w-4 h-4 flex-shrink-0 opacity-80" />
        <p className="text-[12px] font-bold">اتصال الإنترنت ضعيف — قد يكون التحميل أبطأ</p>
      </div>
    );
  }

  return null;
};

export default NetworkIndicator;
