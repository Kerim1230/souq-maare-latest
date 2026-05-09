'use client';

import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'pwa_banner_last_shown';
const COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours
const FALLBACK_DELAY_MS = 3000; // Show after 3s even without beforeinstallprompt

declare global {
  interface Window {
    promptInstall?: () => Promise<void>;
    __pwaInstallAvailable?: boolean;
  }
}

export function PwaInstallBanner() {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Don't run on server
    if (typeof window === 'undefined') return;

    // Check if already installed (standalone mode)
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as { standalone?: boolean }).standalone === true;

    if (isStandalone) {
      console.log('[PwaInstallBanner] App already installed (standalone), hiding banner');
      return;
    }

    // Check 24h cooldown
    try {
      const lastShown = localStorage.getItem(STORAGE_KEY);
      if (lastShown) {
        const elapsed = Date.now() - parseInt(lastShown, 10);
        if (elapsed < COOLDOWN_MS) {
          console.log('[PwaInstallBanner] Cooldown active, hiding banner. Next show in:', Math.round((COOLDOWN_MS - elapsed) / 60000), 'min');
          return;
        }
      }
    } catch {
      // localStorage unavailable — continue
    }

    console.log('[PwaInstallBanner] Cooldown expired, will show banner...');

    // If beforeinstallprompt already fired (listener captured it), show after a tick
    if (window.__pwaInstallAvailable) {
      console.log('[PwaInstallBanner] beforeinstallprompt already captured, showing after tick');
      const raf = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(raf);
    }

    // Wait for beforeinstallprompt event with a 3-second fallback
    let shown = false;

    const onBeforeInstall = () => {
      if (shown) return;
      shown = true;
      console.log('[PwaInstallBanner] beforeinstallprompt fired, showing banner');
      setVisible(true);
    };

    const fallbackTimer = setTimeout(() => {
      if (shown) return;
      shown = true;
      console.log('[PwaInstallBanner] 3s elapsed without beforeinstallprompt, showing banner as fallback');
      setVisible(true);
    }, FALLBACK_DELAY_MS);

    window.addEventListener('beforeinstallprompt', onBeforeInstall);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      clearTimeout(fallbackTimer);
    };
  }, []);

  const dismiss = useCallback(() => {
    setDismissed(true);
    try {
      localStorage.setItem(STORAGE_KEY, Date.now().toString());
      console.log('[PwaInstallBanner] Dismissed, cooldown set for 24h');
    } catch {
      // ignore
    }
  }, []);

  const handleInstall = useCallback(async () => {
    if (typeof window.promptInstall === 'function') {
      try {
        console.log('[PwaInstallBanner] Triggering native install prompt...');
        await window.promptInstall();
        console.log('[PwaInstallBanner] Install prompt completed');
      } catch {
        console.log('[PwaInstallBanner] Install prompt failed or cancelled');
      }
    } else {
      console.log('[PwaInstallBanner] No native install prompt available (window.promptInstall not set)');
    }
    dismiss();
  }, [dismiss]);

  if (!visible || dismissed) return null;

  return (
    <div className="fixed bottom-20 left-0 right-0 z-50 px-4 animate-in slide-in-from-bottom-4 duration-300">
      <div className="bg-white dark:bg-zinc-900 border-t border-[var(--color-border)] rounded-2xl shadow-lg shadow-black/10 p-3 flex items-center gap-3">
        <p className="flex-1 text-sm font-semibold text-[var(--color-text)] leading-relaxed">
          ثبّت التطبيق على هاتفك لتصفح أسرع 🚀
        </p>
        <button
          onClick={handleInstall}
          className="flex-shrink-0 px-4 py-2 rounded-xl bg-gradient-to-l from-emerald-500 to-teal-500 text-white text-sm font-bold shadow-md shadow-emerald-500/25 active:scale-95 transition-transform"
        >
          تثبيت
        </button>
        <button
          onClick={dismiss}
          className="flex-shrink-0 w-8 h-8 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-text-tertiary)] hover:text-[var(--color-text)] transition-colors"
          aria-label="إغلاق"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
