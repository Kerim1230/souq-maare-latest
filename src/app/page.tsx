'use client';

import React, { useEffect, useRef, useState, lazy, Suspense, useCallback, useMemo } from 'react';
import { Toaster } from 'react-hot-toast';
import { AnimatePresence, motion } from 'framer-motion';
import { Home, Store, Search, Heart, User, MessageCircle, LogIn } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useAppStore } from '@/store/appStore';
import { useAutoDeleteStore } from '@/store/autoDeleteStore';
import { AuthScreen } from '@/screens/AuthScreen';
import { NotificationProvider } from '@/components/market/NotificationBanner';
import { useNotificationStore } from '@/store/notificationStore';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { NetworkIndicator } from '@/components/NetworkIndicator';
import { OverlayDebugMonitor } from '@/components/debug/OverlayDebugMonitor';
import { isHydrated, markHydrated, resetHydration } from '@/lib/hydration';

// Dynamic imports for heavy screens - loaded only when needed
const HomeScreen = lazy(() => import('@/screens/HomeScreen').then(m => ({ default: m.HomeScreen })));
const MyStoreScreen = lazy(() => import('@/screens/MyStoreScreen').then(m => ({ default: m.MyStoreScreen })));
const SearchScreen = lazy(() => import('@/screens/SearchScreen').then(m => ({ default: m.SearchScreen })));
const FavoritesScreen = lazy(() => import('@/screens/FavoritesScreen').then(m => ({ default: m.FavoritesScreen })));
const ProfileScreen = lazy(() => import('@/screens/ProfileScreen').then(m => ({ default: m.ProfileScreen })));
const StoreDetailScreen = lazy(() => import('@/screens/StoreDetailScreen').then(m => ({ default: m.StoreDetailScreen })));
const WalletScreen = lazy(() => import('@/screens/WalletScreen').then(m => ({ default: m.WalletScreen })));
const PurchasePointsScreen = lazy(() => import('@/screens/PurchasePointsScreen').then(m => ({ default: m.PurchasePointsScreen })));
const TransactionsScreen = lazy(() => import('@/screens/TransactionsScreen').then(m => ({ default: m.TransactionsScreen })));
const AdminDashboard = lazy(() => import('@/screens/AdminDashboard').then(m => ({ default: m.AdminDashboard })));
const ExpiredContentScreen = lazy(() => import('@/screens/ExpiredContentScreen').then(m => ({ default: m.ExpiredContentScreen })));
const VerificationScreen = lazy(() => import('@/screens/VerificationScreen').then(m => ({ default: m.VerificationScreen })));
const ShareEarnScreen = lazy(() => import('@/screens/ShareEarnScreen').then(m => ({ default: m.ShareEarnScreen })));
const NotificationScreen = lazy(() => import('@/screens/NotificationScreen').then(m => ({ default: m.NotificationScreen })));
const StoreMessages = lazy(() => import('@/components/market/StoreMessages').then(m => ({ default: m.StoreMessagesSafe })));
const UserMessages = lazy(() => import('@/components/market/UserMessages').then(m => ({ default: m.UserMessagesSafe })));
const ProductDetailScreen = lazy(() => import('@/screens/ProductDetailScreen').then(m => ({ default: m.ProductDetailScreen })));
const OfferDetailScreen = lazy(() => import('@/screens/OfferDetailScreen').then(m => ({ default: m.OfferDetailScreen })));
const SettingsScreen = lazy(() => import('@/screens/SettingsScreen').then(m => ({ default: m.SettingsScreen })));
const HelpScreen = lazy(() => import('@/screens/HelpScreen').then(m => ({ default: m.HelpScreen })));
const ContactSupportScreen = lazy(() => import('@/screens/ContactSupportScreen').then(m => ({ default: m.ContactSupportScreen })));
const PolicyScreen = lazy(() => import('@/screens/PolicyScreen').then(m => ({ default: m.PolicyScreen })));
const DebugPushScreen = lazy(() => import('@/screens/DebugPushScreen').then(m => ({ default: m.DebugPushScreen })));

// Minimal loading fallback
const ScreenLoader: React.FC = () => (
  <div className="flex items-center justify-center h-full min-h-[200px] bg-[var(--color-bg)]">
    <div className="flex flex-col items-center gap-3">
      <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
      <p className="text-xs text-slate-400 font-medium">جاري التحميل...</p>
    </div>
  </div>
);

const APP_NAME = 'سوق شامل';
const APP_SUBTITLE = 'الإلكتروني';

/**
 * SplashScreen – uses client-only rendering for text to avoid hydration mismatch
 * when old Service Worker caches serve stale JS bundles.
 * During SSR, only the icon and loading animation are rendered.
 * After mount, the app name and subtitle fade in.
 */
const SplashScreen: React.FC = () => {
  const [showText, setShowText] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setShowText(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gradient-dark relative overflow-hidden">
      <div className="absolute top-[-120px] right-[-80px] w-[300px] h-[300px] rounded-full bg-teal-600/20 blur-[80px]" />
      <div className="absolute bottom-[-100px] left-[-60px] w-[250px] h-[250px] rounded-full bg-emerald-600/15 blur-[80px]" />
      <div className="relative z-10">
        <div className="w-24 h-24 rounded-3xl overflow-hidden shadow-xl shadow-emerald-500/30 mb-6 glow-primary">
          <img src="/app-icon.png" alt="" className="w-full h-full object-cover" />
        </div>
        <div className="h-[42px] flex flex-col items-center">
          {showText ? (
            <>
              <h1 className="text-[28px] font-black text-white text-center">{APP_NAME}</h1>
              <p className="text-teal-300/60 text-[14px] mt-1.5 font-medium text-center">{APP_SUBTITLE}</p>
            </>
          ) : null}
        </div>
      </div>
      <div className="mt-8 flex gap-2">
        <div className="w-2 h-2 rounded-full gradient-primary animate-bounce" style={{ animationDelay: '0ms' }} />
        <div className="w-2 h-2 rounded-full gradient-primary animate-bounce" style={{ animationDelay: '150ms' }} />
        <div className="w-2 h-2 rounded-full gradient-primary animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
    </div>
  );
};

// ── Auth Gate Component — shown when visitor tries to access protected features ──
const AuthGate: React.FC<{ title: string; description: string }> = ({ title, description }) => {
  const setSubScreen = useAppStore(s => s.setSubScreen);
  return (
    <div className="min-h-screen bg-[var(--color-bg)] flex flex-col">
      <div className="gradient-dark px-6 pt-12 pb-14 flex flex-col items-center relative overflow-hidden">
        <div className="absolute top-[-40px] right-[-30px] w-[160px] h-[160px] rounded-full bg-teal-600/20 blur-[60px]" />
        <div className="absolute bottom-[-20px] left-[-20px] w-[100px] h-[100px] rounded-full bg-emerald-600/15 blur-[50px]" />
        <div className="relative z-10">
          <div className="w-16 h-16 rounded-2xl overflow-hidden shadow-xl shadow-emerald-500/30 mb-4 glow-primary">
            <img src="/app-icon.png" alt="سوق شامل" className="w-full h-full object-cover" />
          </div>
          <h1 className="text-[22px] font-black text-white tracking-tight text-center">{title}</h1>
          <p className="text-teal-300 dark:text-teal-600/60 text-[13px] mt-1 font-semibold text-center">{description}</p>
        </div>
      </div>
      <div className="flex-1 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-t-[28px] -mt-6 relative z-10 shadow-[0_-4px_30px_rgba(5,150,105,0.06)] flex flex-col items-center justify-center px-6">
        <div className="w-20 h-20 bg-emerald-50/60 dark:bg-emerald-900/20 rounded-3xl flex items-center justify-center mb-5">
          <LogIn className="w-10 h-10 text-emerald-400" />
        </div>
        <h2 className="text-lg font-bold text-[var(--color-text)] mb-2">سجّل الدخول للمتابعة</h2>
        <p className="text-[var(--color-text-tertiary)] text-sm text-center mb-6 max-w-[280px] leading-relaxed">
          أنشئ حسابك أو سجّل الدخول للوصول إلى هذه الميزة
        </p>
        <button
          onClick={() => setSubScreen('auth')}
          className="w-full max-w-[320px] py-3.5 rounded-2xl gradient-primary text-white font-bold text-[15px] shadow-lg shadow-emerald-500/20 hover:shadow-xl hover:shadow-emerald-500/30 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
        >
          <LogIn className="w-5 h-5" />
          تسجيل الدخول أو إنشاء حساب
        </button>
      </div>
    </div>
  );
};

// Static tab config — defined outside component to avoid re-creation
const tabs = [
  { id: 0, label: 'الرئيسية', icon: Home, requiresAuth: false },
  { id: 1, label: 'متجري', icon: Store, requiresAuth: true },
  { id: 2, label: 'البحث', icon: Search, requiresAuth: false },
  { id: 3, label: 'المفضلة', icon: Heart, requiresAuth: true },
  { id: 4, label: 'حسابي', icon: User, requiresAuth: true },
] as const;

// Memoized bottom nav tab — prevents re-render on every state change
const NavTab = React.memo(({ tab, isActive, onClick, isLoggedIn }: { tab: typeof tabs[number]; isActive: boolean; onClick: (_id: number) => void; isLoggedIn: boolean }) => {
  const Icon = tab.icon;
  return (
    <button
      onClick={() => onClick(tab.id)}
      className={`flex flex-col items-center gap-0.5 px-4 py-1.5 rounded-xl transition-all duration-150 ${
        isActive
          ? 'text-emerald-600 dark:text-emerald-400'
          : 'text-slate-400 dark:text-slate-500 hover:text-emerald-700 dark:hover:text-emerald-300'
      }`}
    >
      <div className={`p-1 rounded-xl transition-all duration-150 ${
        isActive
          ? 'bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/30 dark:to-teal-900/30 shadow-sm'
          : ''
      }`}>
        <Icon
          className={`w-5 h-5 ${isActive ? 'text-emerald-600 dark:text-emerald-400' : ''}`}
          strokeWidth={isActive ? 2.5 : 1.8}
        />
      </div>
      <span className={`text-[10px] font-bold ${isActive ? 'text-emerald-600 dark:text-emerald-400' : ''}`}>
        {tab.label}
      </span>
      {isActive && (
        <div className="w-1 h-1 rounded-full gradient-primary mt-[-2px]" />
      )}
    </button>
  );
});
NavTab.displayName = 'NavTab';

// ── Framer Motion variants ──
const tabVariants = {
  enter: { opacity: 0, y: 10 },
  center: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
};

const subScreenVariants = {
  initial: { y: 30, opacity: 0 },
  animate: { y: 0, opacity: 1, transition: { duration: 0.25, ease: [0.25, 0.1, 0.25, 1] } },
  exit: { y: 20, opacity: 0, transition: { duration: 0.2, ease: [0.25, 0.1, 0.25, 1] } },
};

// Main tab screens - loaded on demand (memoized to prevent unnecessary re-mounts)
const tabScreens = [HomeScreen, MyStoreScreen, SearchScreen, FavoritesScreen, ProfileScreen];
const memoizedTabScreens = tabScreens.map(Screen => React.memo(Screen));

// Auth gate for each protected tab
const authGates: React.FC[] = [
  () => null, // Tab 0: Home - no auth needed
  () => <AuthGate title="متجري" description="أنشئ متجرك وابدأ البيع" />, // Tab 1: My Store
  () => null, // Tab 2: Search - no auth needed
  () => <AuthGate title="المفضلة" description="احفظ منتجاتك المفضلة" />, // Tab 3: Favorites
  () => <AuthGate title="حسابي" description="إدارة حسابك الشخصي" />, // Tab 4: Profile
];

function SubScreenLoader({ subScreen }: { subScreen: string }) {
  const Screen = useMemo(() => {
    switch (subScreen) {
      case 'store-detail': return StoreDetailScreen;
      case 'product-detail': return ProductDetailScreen;
      case 'offer-detail': return OfferDetailScreen;
      case 'wallet': return WalletScreen;
      case 'purchase-points': return PurchasePointsScreen;
      case 'transactions': return TransactionsScreen;
      case 'admin-dashboard': return AdminDashboard;
      case 'expired-content': return ExpiredContentScreen;
      case 'verification': return VerificationScreen;
      case 'share-earn': return ShareEarnScreen;
      case 'notifications': return NotificationScreen;
      case 'store-messages': return StoreMessages;
      case 'user-messages': return UserMessages;
      case 'settings': return SettingsScreen;
      case 'help': return HelpScreen;
      case 'contact-support': return ContactSupportScreen;
      case 'policy': return PolicyScreen;
      case 'debug-push': return DebugPushScreen;
      case 'auth': return AuthScreen;
      default: return null;
    }
  }, [subScreen]);

  if (!Screen) return null;
  return <Suspense fallback={<ScreenLoader />}><Screen /></Suspense>;
}

const MainLayout: React.FC = () => {
  const activeTab = useAppStore(s => s.activeTab);
  const setActiveTab = useAppStore(s => s.setActiveTab);
  const subScreen = useAppStore(s => s.subScreen);
  const user = useAuthStore(s => s.user);
  const initAutoDelete = useAutoDeleteStore(s => s.initialize);
  const startAutoDeleteTimer = useAutoDeleteStore(s => s.startAutoDeleteTimer);
  const stopAutoDeleteTimer = useAutoDeleteStore(s => s.stopAutoDeleteTimer);
  const archiveAndCleanup = useAutoDeleteStore(s => s.archiveAndCleanup);
  const timerStarted = useRef(false);

  // ── Deep link handler ──
  const setSubScreen = useAppStore(s => s.setSubScreen);
  const setSelectedStoreId = useAppStore(s => s.setSelectedStoreId);
  const setSelectedProductId = useAppStore(s => s.setSelectedProductId);
  const setSelectedOfferId = useAppStore(s => s.setSelectedOfferId);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const deepLink = params.get('deepLink');
    if (!deepLink) return;

    console.log('[DeepLink] Detected deep link:', deepLink);

    const url = new URL(window.location.href);
    url.searchParams.delete('deepLink');
    window.history.replaceState({}, '', url.pathname);

    const normalizedLink = deepLink.startsWith('/') ? deepLink : `/${deepLink}`;

    try {
      if (normalizedLink.startsWith('/store/')) {
        const storeId = normalizedLink.replace('/store/', '').split('?')[0];
        if (storeId) {
          setSelectedStoreId(storeId);
          setSubScreen('store-detail');
          console.log('[DeepLink] Navigated to store:', storeId);
        }
      } else if (normalizedLink.startsWith('/product/')) {
        const productId = normalizedLink.replace('/product/', '').split('?')[0];
        if (productId) {
          setSelectedProductId(productId);
          setSubScreen('product-detail');
          console.log('[DeepLink] Navigated to product:', productId);
        }
      } else if (normalizedLink.startsWith('/offer/')) {
        const offerId = normalizedLink.replace('/offer/', '').split('?')[0];
        if (offerId) {
          setSelectedOfferId(offerId);
          setSubScreen('offer-detail');
          console.log('[DeepLink] Navigated to offer:', offerId);
        }
      } else if (normalizedLink.startsWith('/chat')) {
        const chatParams = new URLSearchParams(normalizedLink.split('?')[1] || '');
        const storeId = chatParams.get('storeId');
        const userId = chatParams.get('userId');
        if (storeId) {
          setSelectedStoreId(storeId);
          setSubScreen('store-messages');
          console.log('[DeepLink] Navigated to store-messages, storeId:', storeId);
        } else if (userId) {
          setSubScreen('user-messages');
          console.log('[DeepLink] Navigated to user-messages');
        }
      } else if (normalizedLink === '/notifications' || normalizedLink.startsWith('/admin')) {
        setSubScreen('notifications');
        console.log('[DeepLink] Navigated to notifications');
      } else if (normalizedLink === '/wallet') {
        setSubScreen('wallet');
        console.log('[DeepLink] Navigated to wallet');
      } else if (normalizedLink === '/verification') {
        setSubScreen('verification');
        console.log('[DeepLink] Navigated to verification');
      }
    } catch {
      console.warn('[DeepLink] Failed to parse deep link:', deepLink);
    }
  }, []);

  useEffect(() => {
    initAutoDelete();
    if (!timerStarted.current && user?.id) {
      timerStarted.current = true;
      startAutoDeleteTimer(archiveAndCleanup);
    }
    return () => {
      stopAutoDeleteTimer();
      timerStarted.current = false;
    };
  }, [user?.id, initAutoDelete, startAutoDeleteTimer, archiveAndCleanup, stopAutoDeleteTimer]);

  const handleTabChange = useCallback((tabId: number) => {
    // If user is not logged in and tries to access a protected tab, show auth gate
    const tab = tabs.find(t => t.id === tabId);
    if (tab?.requiresAuth && !user) {
      // Set the active tab first (to show the auth gate for that tab)
      setActiveTab(tabId);
      return;
    }
    setActiveTab(tabId);
  }, [setActiveTab, user]);

  // Determine if current tab should show auth gate
  const currentTabConfig = tabs.find(t => t.id === activeTab);
  const showAuthGate = currentTabConfig?.requiresAuth && !user;

  return (
    <div className="flex flex-col bg-[var(--color-bg)] overflow-hidden" style={{ height: '100dvh' }}>
      {/* Main content area */}
      <div className="flex-1 overflow-hidden relative">
        <AnimatePresence mode="wait">
          {subScreen === 'none' && (
            <motion.div
              key={`tab-${activeTab}`}
              variants={tabVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
              className="absolute inset-0 overflow-y-auto pb-4"
              style={{ WebkitOverflowScrolling: 'touch' }}
            >
              <ErrorBoundary>
                {showAuthGate ? (
                  <Suspense fallback={<ScreenLoader />}>
                    {React.createElement(authGates[activeTab])}
                  </Suspense>
                ) : (
                  <Suspense fallback={<ScreenLoader />}>
                    {React.createElement(memoizedTabScreens[activeTab])}
                  </Suspense>
                )}
              </ErrorBoundary>
            </motion.div>
          )}
        </AnimatePresence>

        {/* SubScreen overlay with slide-up animation */}
        <AnimatePresence>
          {subScreen !== 'none' && (
            <motion.div
              key={`sub-${subScreen}`}
              variants={subScreenVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="absolute inset-0 overflow-y-auto z-20 bg-[var(--color-bg)]"
              style={{ WebkitOverflowScrolling: 'touch' }}
            >
              <ErrorBoundary>
                <SubScreenLoader subScreen={subScreen} />
              </ErrorBoundary>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom Navigation — FIXED to viewport bottom */}
      {subScreen === 'none' && (
        <nav className="bottom-nav fixed bottom-0 left-0 right-0 z-[100] pb-safe">
          <div className="flex items-center justify-around max-w-lg mx-auto px-2 py-2">
            {tabs.map((tab) => (
              <NavTab
                key={tab.id}
                tab={tab}
                isActive={activeTab === tab.id}
                onClick={handleTabChange}
                isLoggedIn={!!user}
              />
            ))}
          </div>
          {/* Help Button — attached to nav bar, above حسابي tab */}
          <button
            onClick={() => useAppStore.getState().setSubScreen('help')}
            className="absolute -top-12 left-4 w-11 h-11 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/30 flex items-center justify-center hover:scale-110 active:scale-95 transition-transform duration-200 animate-pulse z-50"
            aria-label="المساعد الذكي"
          >
            <MessageCircle className="w-5 h-5 text-white" />
          </button>
        </nav>
      )}
    </div>
  );
};

export default function App() {
  const user = useAuthStore((s) => s.user);
  const initialized = useAuthStore((s) => s.initialized);
  const initialize = useAuthStore((s) => s.initialize);
  const notificationInit = useNotificationStore((s) => s.initialize);

  useEffect(() => {
    initialize();
    notificationInit();
  }, [initialize, notificationInit]);

  // ── Global chunk error recovery ──
  // When a new deployment invalidates old chunk filenames,
  // the browser may fail to load them. Detect this and force a hard reload
  // with cache busting to get fresh assets.
  useEffect(() => {
    const CHUNK_ERROR_PATTERN = /Loading chunk|Loading CSS chunk|Failed to fetch dynamically imported module|chunk\s+\w+\s+failed|Importing a module script failed/i;
    const MAX_RELOAD_ATTEMPTS = 3;
    const RELOAD_KEY = 'suq_chunk_reload_count';
    const RELOAD_TIMESTAMP_KEY = 'suq_chunk_reload_ts';

    function handleChunkRecovery(source: string) {
      // Prevent infinite reload loop — max 3 reloads within 60 seconds
      const now = Date.now();
      const lastReloadTs = parseInt(sessionStorage.getItem(RELOAD_TIMESTAMP_KEY) || '0', 10);
      const reloadCount = parseInt(sessionStorage.getItem(RELOAD_KEY) || '0', 10);

      if (now - lastReloadTs > 60_000) {
        // Reset counter if more than 60s since last reload
        sessionStorage.setItem(RELOAD_KEY, '1');
        sessionStorage.setItem(RELOAD_TIMESTAMP_KEY, String(now));
      } else if (reloadCount >= MAX_RELOAD_ATTEMPTS) {
        console.warn('[ChunkError] Max reload attempts reached, stopping recovery loop');
        sessionStorage.removeItem(RELOAD_KEY);
        sessionStorage.removeItem(RELOAD_TIMESTAMP_KEY);
        return; // Don't reload — show the error to the user instead
      } else {
        sessionStorage.setItem(RELOAD_KEY, String(reloadCount + 1));
        sessionStorage.setItem(RELOAD_TIMESTAMP_KEY, String(now));
      }

      console.warn(`[ChunkError] Detected stale chunk (${source}), clearing caches and reloading...`);
      // Clear all caches
      if ('caches' in window) {
        caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))));
      }
      // Force hard reload with cache bust
      window.location.reload();
    }

    // Handle synchronous error events
    const handleError = (event: ErrorEvent) => {
      const msg = event.message || '';
      if (CHUNK_ERROR_PATTERN.test(msg)) {
        event.preventDefault();
        handleChunkRecovery('error-event');
      }
    };

    // Handle unhandled promise rejections (dynamic imports fail here)
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const msg = event.reason?.message || event.reason?.toString() || '';
      if (CHUNK_ERROR_PATTERN.test(msg)) {
        event.preventDefault();
        handleChunkRecovery('unhandled-rejection');
      }
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  // ── Global data initialization on login ──
  useEffect(() => {
    if (!user) {
      resetHydration();
      return;
    }

    const userId = user.id;
    if (!userId) return;

    const loadGlobalData = async () => {
      try {
        const tasks: Promise<void>[] = [];

        if (!isHydrated('favorites')) {
          tasks.push(useAppStore.getState().fetchFavorites(userId).then(() => {}));
        }

        if (!isHydrated('followedStores')) {
          tasks.push(useAppStore.getState().fetchFollowedStores(userId).then(() => {}));
        }

        if (!isHydrated('wallet')) {
          tasks.push((async () => {
            const { usePointsStore } = await import('@/store/pointsStore');
            const ps = usePointsStore.getState();
            ps.initialize();
            await ps.fetchWallet(userId);
          })());
        }

        if (!isHydrated('notifications')) {
          tasks.push((async () => {
            await useNotificationStore.getState().fetchNotifications(userId);
            markHydrated('notifications');
          })());
        }

        await Promise.all(tasks);
      } catch {
        // Global init failures are non-critical — screens have fallback fetch
      }
    };

    loadGlobalData();
  }, [user?.id]);

  // Show splash screen while auth is initializing
  if (!initialized) return <SplashScreen />;

  // ALWAYS show MainLayout — even for unauthenticated visitors
  return (
    <>
      <NetworkIndicator />
      <OverlayDebugMonitor />
      <Toaster
        position="top-center"
        containerStyle={{ zIndex: 200 }}
        toastOptions={{
          style: {
            fontFamily: 'Cairo, sans-serif',
            fontWeight: 600,
            borderRadius: '14px',
            padding: '10px 16px',
            direction: 'rtl',
            fontSize: '13px',
            boxShadow: '0 4px 24px rgba(16, 185, 129, 0.12)',
          },
          success: {
            style: {
              background: 'linear-gradient(135deg, #022c22, #064e3b)',
              color: 'white',
            },
            iconTheme: { primary: '#34d399', secondary: '#022c22' },
          },
          error: {
            style: {
              background: 'linear-gradient(135deg, #022c22, #064e3b)',
              color: 'white',
            },
            iconTheme: { primary: '#fb7185', secondary: '#022c22' },
          },
        }}
      />
      <ErrorBoundary>
        {user && <NotificationProvider userId={user.id} />}
        <MainLayout />
      </ErrorBoundary>
    </>
  );
}
