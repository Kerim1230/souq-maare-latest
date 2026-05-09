'use client';

import React, { useEffect, useRef, useState, lazy, Suspense, useCallback, useMemo } from 'react';
import { Toaster } from 'react-hot-toast';
import { Home, Store, Search, Heart, User, MessageCircle } from 'lucide-react';
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

const SplashScreen: React.FC = () => (
  <div className="min-h-screen flex flex-col items-center justify-center gradient-dark relative overflow-hidden">
    <div className="absolute top-[-120px] right-[-80px] w-[300px] h-[300px] rounded-full bg-teal-600/20 blur-[80px]" />
    <div className="absolute bottom-[-100px] left-[-60px] w-[250px] h-[250px] rounded-full bg-emerald-600/15 blur-[80px]" />
    <div className="relative z-10">
      <div className="w-24 h-24 rounded-3xl overflow-hidden shadow-xl shadow-emerald-500/30 mb-6 glow-primary">
        <img src="/app-icon.png" alt="سوق مارع" className="w-full h-full object-cover" />
      </div>
      <h1 className="text-[28px] font-black text-white text-center">سوق مارع</h1>
      <p className="text-teal-300/60 text-[14px] mt-1.5 font-medium text-center">الإلكتروني</p>
    </div>
    <div className="mt-8 flex gap-2">
      <div className="w-2 h-2 rounded-full gradient-primary animate-bounce" style={{ animationDelay: '0ms' }} />
      <div className="w-2 h-2 rounded-full gradient-primary animate-bounce" style={{ animationDelay: '150ms' }} />
      <div className="w-2 h-2 rounded-full gradient-primary animate-bounce" style={{ animationDelay: '300ms' }} />
    </div>
  </div>
);

// Static tab config — defined outside component to avoid re-creation
const tabs = [
  { id: 0, label: 'الرئيسية', icon: Home },
  { id: 1, label: 'متجري', icon: Store },
  { id: 2, label: 'البحث', icon: Search },
  { id: 3, label: 'المفضلة', icon: Heart },
  { id: 4, label: 'حسابي', icon: User },
] as const;

// Memoized bottom nav tab — prevents re-render on every state change
const NavTab = React.memo(({ tab, isActive, onClick }: { tab: typeof tabs[number]; isActive: boolean; onClick: (_id: number) => void }) => {
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

// Main tab screens - loaded on demand (memoized to prevent unnecessary re-mounts)
const tabScreens = [HomeScreen, MyStoreScreen, SearchScreen, FavoritesScreen, ProfileScreen];
const memoizedTabScreens = tabScreens.map(Screen => React.memo(Screen));

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

  // --- Transition: tab slide helpers ---
  // CSS transitions don't fire on initial mount (no previous value to transition from),
  // so no mounted guard is needed.
  const getTabTransform = useCallback((tabIndex: number): string => {
    if (activeTab === tabIndex) return 'translateX(0)';
    return tabIndex < activeTab ? 'translateX(-10px)' : 'translateX(10px)';
  }, [activeTab]);

  // --- Transition: subscreen slide-up / slide-down ---
  // Use React's "set state during render" pattern to synchronously track
  // the incoming subscreen, avoiding the need for synchronous setState in effects.
  const [displayedSubScreen, setDisplayedSubScreen] = useState<string | null>(null);
  const [subScreenVisible, setSubScreenVisible] = useState(false);
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  if (subScreen !== 'none' && displayedSubScreen !== subScreen) {
    setDisplayedSubScreen(subScreen);
    setSubScreenVisible(false);
  }

  useEffect(() => {
    // Clear any pending exit timer
    if (exitTimerRef.current) {
      clearTimeout(exitTimerRef.current);
      exitTimerRef.current = null;
    }

    if (subScreen !== 'none' && !subScreenVisible) {
      // Entrance: double rAF to ensure off-screen position is painted first
      const raf = requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setSubScreenVisible(true);
        });
      });
      return () => cancelAnimationFrame(raf);
    }

    if (subScreen === 'none' && displayedSubScreen !== null && subScreenVisible) {
      // Exit: animate out, then unmount after transition completes
      const id = requestAnimationFrame(() => {
        setSubScreenVisible(false);
        exitTimerRef.current = setTimeout(() => {
          setDisplayedSubScreen(null);
          exitTimerRef.current = null;
        }, 250);
      });
      return () => {
        cancelAnimationFrame(id);
        if (exitTimerRef.current) {
          clearTimeout(exitTimerRef.current);
          exitTimerRef.current = null;
        }
      };
    }
  }, [subScreen, subScreenVisible, displayedSubScreen]);

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
    setActiveTab(tabId);
  }, [setActiveTab]);

  return (
    <div className="flex flex-col h-screen bg-[var(--color-bg)] overflow-hidden">
      <div className="flex-1 overflow-hidden relative">
        {memoizedTabScreens.map((Screen, index) => (
          <div
            key={index}
            className={`absolute inset-0 overflow-y-auto ${
              activeTab === index && subScreen === 'none'
                ? 'opacity-100 pointer-events-auto z-10'
                : 'opacity-0 pointer-events-none z-0'
            }`}
            style={{
              WebkitOverflowScrolling: 'touch',
              transform: getTabTransform(index),
              transition: 'opacity 200ms ease-in-out, transform 200ms ease-in-out',
            }}
          >
            <ErrorBoundary>
              <Suspense fallback={<ScreenLoader />}>
                <Screen />
              </Suspense>
            </ErrorBoundary>
          </div>
        ))}

        {displayedSubScreen !== null && (
          <div
            className="absolute inset-0 overflow-y-auto z-20 bg-[var(--color-bg)]"
            style={{
              WebkitOverflowScrolling: 'touch',
              transition: 'transform 250ms ease-out, opacity 200ms ease-in-out',
              transform: subScreenVisible ? 'translateY(0)' : 'translateY(20px)',
              opacity: subScreenVisible ? 1 : 0,
              // 🔴 FIX: Prevent invisible overlay from blocking clicks during transition
              pointerEvents: subScreenVisible ? 'auto' : 'none',
            }}
          >
            <ErrorBoundary>
              <SubScreenLoader subScreen={displayedSubScreen} />
            </ErrorBoundary>
          </div>
        )}
      </div>

      {/* Bottom Navigation */}
      {subScreen === 'none' && (
        <nav className="bottom-nav flex-shrink-0 pb-safe relative overflow-visible">
          <div className="flex items-center justify-around max-w-lg mx-auto px-2 py-2">
            {tabs.map((tab) => (
              <NavTab
                key={tab.id}
                tab={tab}
                isActive={activeTab === tab.id}
                onClick={handleTabChange}
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

  // ── Global data initialization on login ──
  // Uses Hydration Coordinator Layer: each entity is loaded exactly once per session.
  // resetHydration() is called on logout (user goes from truthy → falsy).
  useEffect(() => {
    // Detect logout: reset all hydration flags so next login re-fetches
    if (!user) {
      resetHydration();
      return;
    }

    const userId = user.id;
    if (!userId) return;

    const loadGlobalData = async () => {
      try {
        const tasks: Promise<void>[] = [];

        // 1. Favorites — one-time via hydration guard
        if (!isHydrated('favorites')) {
          tasks.push(useAppStore.getState().fetchFavorites(userId).then(() => {}));
        }

        // 2. Followed stores — one-time via hydration guard
        if (!isHydrated('followedStores')) {
          tasks.push(useAppStore.getState().fetchFollowedStores(userId).then(() => {}));
        }

        // 3. Wallet — one-time via hydration guard
        if (!isHydrated('wallet')) {
          tasks.push((async () => {
            const { usePointsStore } = await import('@/store/pointsStore');
            const ps = usePointsStore.getState();
            ps.initialize(); // Load settings only (user-agnostic)
            await ps.fetchWallet(userId); // markHydrated('wallet') called inside on success
          })());
        }

        // 4. Notifications — one-time via hydration guard
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
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!initialized) return <SplashScreen />;

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
        {user ? (
          <>
            <NotificationProvider userId={user.id} />
            <MainLayout />
          </>
        ) : <AuthScreen />}
      </ErrorBoundary>
    </>
  );
}
