'use client';
import React, { memo, useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { motion } from 'framer-motion';
import { apiPost, apiDelete } from '@/lib/fetchApi';
import { Star, ChevronLeft, Verified, Flag, Clock, Share2, Bell, Wallet, Gift, Trophy, Store as StoreIcon, Percent, LogIn } from 'lucide-react';
import { SkeletonCard } from '@/components/market/Card';
import { SafeImage, StoreLogo } from '@/components/market/SafeImage';
import { ShareSheet } from '@/components/market/ShareSheet';
import { ProductCard } from '@/components/market/ProductCard';
import type { ProductCardData } from '@/components/market/ProductCard';
import { CategoryGrid } from '@/components/market/CategoryGrid';
import { ReportModal } from '@/components/admin/ReportModal';
import { useAppStore } from '@/store/appStore';
import { useAuthStore } from '@/store/authStore';
import { useNotificationStore } from '@/store/notificationStore';
import { usePointsStore } from '@/store/pointsStore';
import { useStoreColorStore, type StoreGradientColor } from '@/store/storeColorStore';
import { getTimeRemaining } from '@/store/autoDeleteStore';
import { PwaInstallBanner } from '@/components/PwaInstallBanner';
import type { Store } from '@/store/appStore';

interface OfferItem {
  id: string;
  store_id?: string | null;
  title: string;
  description?: string;
  image_url?: string;
  type: string;
  discount?: string;
  expires_at?: string | null;
  store_name?: string;
  store_theme_color?: string | null;
}

// Default colors for offers/contests when no store theme
const DEFAULT_OFFER_COLOR = '#059669'; // emerald solid
const DEFAULT_CONTEST_COLOR = '#e11d48'; // rose solid

// Memoized section header
const SectionHeader: React.FC<{ title: string; actionLabel?: string; onAction?: () => void; extra?: React.ReactNode }> = memo(({ title, actionLabel, onAction, extra }) => {
  return (
  <div className="flex items-center justify-between mb-4 px-0">
    <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">{title}</h2>
    <div className="flex items-center gap-2">
      {extra}
      {actionLabel && (
        <button onClick={onAction} className="text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-0.5">
          {actionLabel} <ChevronLeft className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  </div>
  );
});
SectionHeader.displayName = 'SectionHeader';

// Memoized Store Card — circular logo with themeColor border (manual scroll only)
const StoreCard: React.FC<{ store: Store; getStoreColorById: (_colorId: string) => StoreGradientColor | undefined }> = memo(({ store, getStoreColorById }) => {
  const handleOpen = useCallback(() => {
    const { setSelectedStoreId, setSubScreen } = useAppStore.getState();
    setSelectedStoreId(store.id);
    setSubScreen('store-detail');
  }, [store.id]);

  // Resolve theme_color ID (e.g. "emerald", "royal-blue") to actual hex color
  const resolvedColor = store.theme_color ? getStoreColorById(store.theme_color) : undefined;
  const borderColor = resolvedColor?.solid || '#e5e7eb';
  const shadowColor = resolvedColor?.shadowLight || 'transparent';

  return (
    <div
      onClick={handleOpen}
      className="flex-shrink-0 flex flex-col items-center gap-2 cursor-pointer active:opacity-80 group"
      style={{ width: '120px' }}
    >
      <div
        className="w-20 h-20 rounded-2xl overflow-hidden shadow-sm group-hover:shadow-md transition-shadow duration-200"
        style={{ border: '2.5px solid', borderColor, boxShadow: resolvedColor ? `0 2px 8px ${shadowColor}` : undefined }}
      >
        <StoreLogo src={store.logo_url} name={store.name} size="md" className="w-full h-full" />
      </div>
      <div className="p-4 text-center">
        <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 line-clamp-1">{store.name}</p>
        {store.description && <p className="text-[11px] text-gray-500 dark:text-gray-400 line-clamp-1 mt-1">{store.description}</p>}
        {store.is_verified && (
          <span className="bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 text-[10px] px-2 py-0.5 rounded-full inline-flex items-center gap-1 mt-2">
            <Verified className="w-3 h-3" />موثق
          </span>
        )}
      </div>
    </div>
  );
});
StoreCard.displayName = 'StoreCard';

// ── Pre-compute favorite lookup map (O(1) instead of O(n) .some()) ──
function buildFavSet(favorites: Array<{ product_id?: string }>): Set<string> {
  const set = new Set<string>();
  for (let i = 0; i < favorites.length; i++) {
    if (favorites[i].product_id) set.add(favorites[i].product_id!);
  }
  return set;
}

// ── Skeleton Home — full page skeleton for initial load ──
const SkeletonHome: React.FC = () => (
  <div className="min-h-screen bg-[var(--color-bg)] top-nav-safe">
    {/* Skeleton header */}
    <div className="gradient-dark px-5 pt-8 pb-10">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/10 animate-pulse" />
          <div className="w-24 h-5 rounded bg-white/10 animate-pulse" />
        </div>
        <div className="flex gap-2">
          <div className="w-10 h-10 rounded-xl bg-white/10 animate-pulse" />
          <div className="w-10 h-10 rounded-xl bg-white/10 animate-pulse" />
        </div>
      </div>
    </div>

    <div className="px-5 space-y-6 mt-2">
      {/* Skeleton offers */}
      <div>
        <div className="w-32 h-4 bg-[var(--color-surface)] animate-pulse rounded mb-3" />
        <div className="flex gap-3 overflow-hidden">
          <div className="flex-shrink-0 min-w-[170px] h-52 rounded-2xl bg-[var(--color-surface)] animate-pulse border border-[var(--color-border)]" />
          <div className="flex-shrink-0 min-w-[170px] h-52 rounded-2xl bg-[var(--color-surface)] animate-pulse border border-[var(--color-border)]" />
          <div className="flex-shrink-0 min-w-[170px] h-52 rounded-2xl bg-[var(--color-surface)] animate-pulse border border-[var(--color-border)]" />
        </div>
      </div>

      {/* Skeleton categories */}
      <div>
        <div className="w-20 h-4 bg-[var(--color-surface)] animate-pulse rounded mb-3" />
        <div className="grid grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-2">
              <div className="w-12 h-12 rounded-2xl bg-[var(--color-surface)] animate-pulse" />
              <div className="w-10 h-2 bg-[var(--color-surface)] animate-pulse rounded" />
            </div>
          ))}
        </div>
      </div>

      {/* Skeleton featured products */}
      <div>
        <div className="w-28 h-4 bg-[var(--color-surface)] animate-pulse rounded mb-3" />
        <div className="flex gap-3 overflow-hidden">
          <div className="flex-shrink-0 w-40 h-52 bg-[var(--color-surface)] rounded-2xl animate-pulse border border-[var(--color-border)]" />
          <div className="flex-shrink-0 w-40 h-52 bg-[var(--color-surface)] rounded-2xl animate-pulse border border-[var(--color-border)]" />
          <div className="flex-shrink-0 w-40 h-52 bg-[var(--color-surface)] rounded-2xl animate-pulse border border-[var(--color-border)]" />
        </div>
      </div>

      {/* Skeleton stores */}
      <div>
        <div className="w-28 h-4 bg-[var(--color-surface)] animate-pulse rounded mb-3" />
        <div className="flex gap-4 overflow-hidden">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex-shrink-0 flex flex-col items-center gap-2" style={{ width: '88px' }}>
              <div className="w-[72px] h-[72px] rounded-2xl bg-[var(--color-surface)] animate-pulse border-2 border-[var(--color-border)]" />
              <div className="w-14 h-3 bg-[var(--color-surface)] animate-pulse rounded" />
            </div>
          ))}
        </div>
      </div>

      {/* Skeleton new products */}
      <div>
        <div className="w-28 h-4 bg-[var(--color-surface)] animate-pulse rounded mb-3" />
        <div className="grid grid-cols-2 gap-3">
          <SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard />
        </div>
      </div>
    </div>
  </div>
);

export const HomeScreen: React.FC = () => {
  // ── Minimal Zustand selectors (no whole-store subscriptions) ──
  const user = useAuthStore(s => s.user);
  const setActiveTab = useAppStore(s => s.setActiveTab);
  const setSubScreen = useAppStore(s => s.setSubScreen);
  const setSearchQuery = useAppStore(s => s.setSearchQuery);
  const openProductDetail = useAppStore(s => s.openProductDetail);
  const openOfferDetail = useAppStore(s => s.openOfferDetail);
  const favorites = useAppStore(s => s.favorites);
  const addFavorite = useAppStore(s => s.addFavorite);
  const removeFavorite = useAppStore(s => s.removeFavorite);
  const homeData = useAppStore(s => s.homeData);
  const homeDataLoading = useAppStore(s => s.homeDataLoading);
  const fetchHomePage = useAppStore(s => s.fetchHomePage);
  const loadHomeFromCache = useAppStore(s => s.loadHomeFromCache);

  // Store color resolver — used to get theme color for offer cards
  const getStoreColorById = useStoreColorStore(s => s.getStoreColorById);

  // ── Derived state ──
  const unreadNotifCount = useNotificationStore(s =>
    user ? s.notifications.reduce((c, n) => c + (n.userId === user.id && !n.isRead ? 1 : 0), 0) : 0
  );
  // Reactive wallet balance selector
  const walletBalance = usePointsStore(s =>
    user && s.wallets[user.id] ? s.wallets[user.id].balance : 0
  );

  // O(1) favorite lookup — computed once per favorites change
  const favSet = useMemo(() => buildFavSet(favorites), [favorites]);

  // ── Local state ──
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [reportModal, setReportModal] = useState<{ isOpen: boolean; targetType: 'product' | 'store' | 'offer'; targetId: string; targetName: string }>({ isOpen: false, targetType: 'product', targetId: '', targetName: '' });
  const [showShareSheet, setShowShareSheet] = useState(false);
  const [shareTarget, setShareTarget] = useState<{
    type: 'store' | 'product' | 'offer' | 'contest'; id: string; name: string;
    description?: string; price?: string; storeName?: string; imageUrl?: string; discount?: string;
  } | null>(null);

  // ── Derive display arrays from centralized homeData ──
  const featuredProducts = useMemo<ProductCardData[]>(() => (homeData?.featured_products || []) as ProductCardData[], [homeData]);
  const newProducts = useMemo<ProductCardData[]>(() => (homeData?.new_products || []) as ProductCardData[], [homeData]);
  const featuredStores = useMemo<Store[]>(() => (homeData?.featured_stores || []) as Store[], [homeData]);
  const allOffers = useMemo<OfferItem[]>(() => (homeData?.offers || []) as OfferItem[], [homeData]);

  const displayedOffers = useMemo(() => allOffers.slice(0, 5), [allOffers]);
  const displayedFeaturedProducts = useMemo(() => featuredProducts.slice(0, 5), [featuredProducts]);
  const displayedNewProducts = useMemo(() => newProducts.slice(0, 12), [newProducts]);

  // ── Whether data is loaded and ready to display ──
  const dataLoaded = homeData !== null;

  // ── Stable callbacks ──
  const handleCategoryClick = useCallback((catName: string) => {
    setSearchQuery(catName);
    setActiveTab(2);
  }, [setSearchQuery, setActiveTab]);

  const handleViewAllFeatured = useCallback(() => {
    setSearchQuery('مميز');
    setActiveTab(2);
  }, [setSearchQuery, setActiveTab]);

  const handleViewAllOffers = useCallback(() => {
    setSearchQuery('عرض');
    setActiveTab(2);
  }, [setSearchQuery, setActiveTab]);

  const handleViewAllNewProducts = useCallback(() => {
    setSearchQuery('منتج');
    setActiveTab(2);
  }, [setSearchQuery, setActiveTab]);

  const handleViewAllStores = useCallback(() => {
    setSearchQuery('متجر');
    setActiveTab(2);
  }, [setSearchQuery, setActiveTab]);

  const handleOpenProductDetail = useCallback((p: ProductCardData) => {
    openProductDetail(p.id);
  }, [openProductDetail]);

  // ── Optimistic favorite toggle ──
  const handleToggleFavorite = useCallback(async (productId: string) => {
    if (!user) return;
    const currentFavorites = useAppStore.getState().favorites;
    const existingFav = currentFavorites.find(f => f.product_id === productId);
    if (existingFav) {
      removeFavorite(existingFav.id);
      try {
        const { error } = await apiDelete(`/api/favorites?favoriteId=${existingFav.id}`);
        if (error) {
          addFavorite(existingFav);
        }
      } catch {
        addFavorite(existingFav);
      }
    } else {
      const tempId = `temp_${Date.now()}`;
      addFavorite({ id: tempId, user_id: user.id, product_id: productId, store_id: undefined });
      try {
        const { data, error } = await apiPost('/api/favorites', { userId: user.id, productId });
        if (!error && data?.favorite) {
          removeFavorite(tempId);
          addFavorite(data.favorite);
        } else {
          removeFavorite(tempId);
        }
      } catch {
        removeFavorite(tempId);
      }
    }
  }, [user, addFavorite, removeFavorite]);

  const handleShareProduct = useCallback((product: ProductCardData) => {
    setShareTarget({ type: 'product', id: product.id, name: product.name, description: product.description || undefined, price: `${product.price.toLocaleString('ar-SY')} ل.س`, storeName: product.store_name || undefined, imageUrl: product.image_url || undefined });
    setShowShareSheet(true);
  }, []);

  const handleShareOffer = useCallback((offer: OfferItem) => {
    setShareTarget({ type: offer.type as 'offer' | 'contest', id: offer.id, name: offer.title, description: offer.description || undefined, discount: offer.discount || undefined, storeName: offer.store_name || undefined, imageUrl: offer.image_url || undefined });
    setShowShareSheet(true);
  }, []);

  const handleReportProduct = useCallback((p: ProductCardData) => {
    setReportModal({ isOpen: true, targetType: 'product', targetId: p.id, targetName: p.name });
  }, []);

  const handleReportOffer = useCallback((offer: OfferItem) => {
    setReportModal({ isOpen: true, targetType: 'offer', targetId: offer.id, targetName: offer.title });
  }, []);

  const handleCloseReportModal = useCallback(() => {
    setReportModal({ isOpen: false, targetType: 'product', targetId: '', targetName: '' });
  }, []);

  const handleCloseShareSheet = useCallback(() => {
    setShowShareSheet(false);
    setShareTarget(null);
  }, []);

  // ── MAIN DATA LOADING: loadAllData() ──
  // 1. Load from localStorage cache → display instantly
  // 2. Fetch fresh data from API → update display
  // 3. Works for ALL users (authenticated and visitors)
  const loadAllData = useCallback(async (userId?: string) => {
    // STEP 1: Try to load from cache for instant paint
    const cached = loadHomeFromCache();
    if (cached) {
      console.log('[HomeScreen] ✅ Cache hit — displaying instantly');
      setIsInitialLoading(false);
    }

    // STEP 2: Always fetch fresh data from server
    console.log('[HomeScreen] 🔄 Fetching fresh data...', { userId: userId || 'visitor' });
    try {
      const freshData = await fetchHomePage(userId);
      if (freshData) {
        console.log('[HomeScreen] ✅ Fresh data loaded', {
          stores: freshData.featured_stores?.length || 0,
          products: freshData.featured_products?.length || 0,
          offers: freshData.offers?.length || 0,
        });
      }
      setIsInitialLoading(false);
    } catch (err) {
      console.error('[HomeScreen] ❌ Fetch error:', err);
      // Even if fetch fails, stop loading — we either have cached data or show empty
      setIsInitialLoading(false);
    }
  }, [loadHomeFromCache, fetchHomePage]);

  // ── Initial mount: load all data immediately ──
  const hasLoadedRef = useRef(false);
  useEffect(() => {
    if (hasLoadedRef.current) return;
    hasLoadedRef.current = true;
    // Get current userId at the time of mount (not from closure)
    const currentUserId = useAuthStore.getState().user?.id;
    // Use requestAnimationFrame to avoid synchronous setState in effect
    requestAnimationFrame(() => loadAllData(currentUserId));
  }, [loadAllData]);

  // ── Re-fetch when user changes (login/logout) ──
  const prevUserIdRef = useRef<string | undefined>(user?.id);
  useEffect(() => {
    const prevId = prevUserIdRef.current;
    prevUserIdRef.current = user?.id;
    // Only re-fetch if user changed AFTER initial load
    if (hasLoadedRef.current && prevId !== user?.id) {
      console.log('[HomeScreen] 🔄 User changed, re-fetching...', { userId: user?.id });
      fetchHomePage(user?.id).catch(() => {});
    }
  }, [user?.id, fetchHomePage]);

  // ── Auto-refresh every 60 seconds (silent, with thin progress bar) ──
  useEffect(() => {
    const interval = setInterval(() => {
      // Skip if user is interacting with a modal or input
      const activeEl = document.activeElement;
      const isTyping = activeEl instanceof HTMLInputElement || activeEl instanceof HTMLTextAreaElement;
      const hasOpenModal = document.querySelector('[role="dialog"][aria-modal="true"]');
      if (isTyping || hasOpenModal) return;

      setIsRefreshing(true);
      fetchHomePage(user?.id)
        .then(() => {})
        .catch(() => { /* silent refresh failure */ })
        .finally(() => setIsRefreshing(false));
    }, 60_000); // 60 seconds
    return () => clearInterval(interval);
  }, [user?.id, fetchHomePage]);

  // ── Memoized skeletons (created once) ──
  const storeSkeletons = useMemo(() => [...Array(5)].map((_, i) => (
    <div key={`fs-sk-${i}`} className="flex-shrink-0 flex flex-col items-center gap-2" style={{ width: '88px' }}>
      <div className="w-[72px] h-[72px] rounded-2xl bg-[var(--color-surface)] animate-pulse border-2 border-[var(--color-border)]" />
      <div className="w-14 h-3 bg-[var(--color-surface)] animate-pulse rounded" />
    </div>
  )), []);

  // ── Show full-page skeleton on very first load with no cache ──
  if (isInitialLoading && !dataLoaded) {
    return <SkeletonHome />;
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg)] top-nav-safe">
      {/* Thin progress bar for silent auto-refresh */}
      {(isRefreshing || homeDataLoading) && (
        <div className="fixed top-0 left-0 right-0 z-[200] h-[2px] transition-all duration-300">
          <div className="h-full bg-gradient-to-l from-emerald-400 to-teal-500 animate-pulse w-full" />
        </div>
      )}

      {/* HEADER — Always visible, no loading dependency */}
      <header className="gradient-dark px-5 pt-8 pb-10 relative overflow-hidden">
        <div className="absolute top-[-30px] right-[-20px] w-[140px] h-[140px] rounded-full bg-teal-600/15 blur-[50px]" />
        <div className="absolute bottom-[-15px] left-[-10px] w-[100px] h-[100px] rounded-full bg-emerald-600/10 blur-[40px]" />
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl overflow-hidden shadow-lg shadow-emerald-500/30 flex-shrink-0">
                <img src="/app-icon.png" alt="سوق شامل" className="w-full h-full object-cover" />
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-white font-black text-lg leading-none tracking-tight">سوق شامل</span>
                <span className="text-teal-400/50 text-xs">/</span>
                <span className="text-teal-300 dark:text-teal-600/60 text-sm font-semibold">الإلكتروني</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {!user && (
                <button onClick={() => setSubScreen('auth')} className="relative w-10 h-10 bg-emerald-400/20 backdrop-blur-sm rounded-xl flex items-center justify-center hover:bg-emerald-400/30 transition-colors border border-emerald-400/20" aria-label="تسجيل الدخول">
                  <LogIn className="w-[18px] h-[18px] text-emerald-300" />
                </button>
              )}
              <button onClick={() => setSubScreen('wallet')} className="relative w-10 h-10 bg-[var(--color-surface)]/10 backdrop-blur-sm rounded-xl flex items-center justify-center hover:bg-[var(--color-surface)]/20 transition-colors" aria-label="محفظة النقاط">
                <Wallet className="w-[18px] h-[18px] text-teal-300 dark:text-teal-600/70" />
                {walletBalance > 0 && (
                  <span className="absolute -top-1.5 -left-1 min-w-[20px] h-5 bg-emerald-400 rounded-full flex items-center justify-center text-[9px] font-black text-white px-1.5 shadow-sm shadow-emerald-500/30">
                    {walletBalance > 999 ? `${Math.floor(walletBalance / 1000)}k` : walletBalance}
                  </span>
                )}
              </button>
              <button onClick={() => setSubScreen('notifications')} className="relative w-10 h-10 bg-[var(--color-surface)]/10 backdrop-blur-sm rounded-xl flex items-center justify-center hover:bg-[var(--color-surface)]/20 transition-colors">
                <Bell className="w-[18px] h-[18px] text-teal-300 dark:text-teal-600/70" />
                {unreadNotifCount > 0 && (
                  <span className="absolute -top-1 -left-1 min-w-[18px] h-[18px] bg-rose-500 rounded-full flex items-center justify-center text-[9px] font-black text-white px-1 animate-pulse">
                    {unreadNotifCount > 99 ? '99+' : unreadNotifCount}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="px-5 space-y-8 mt-2">

        {/* ═══ 2. OFFERS & CONTESTS 🎁 ═══ */}
        <motion.section
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.05 }}
        >
          <SectionHeader title="العروض والمسابقات 🎁" actionLabel="الكل" onAction={handleViewAllOffers} />
          {!dataLoaded ? (
            <div className="flex gap-3 overflow-hidden">
              {[...Array(3)].map((_, i) => (
                <div key={`off-sk-${i}`} className="flex-shrink-0 min-w-[170px] h-52 rounded-2xl bg-[var(--color-surface)] animate-pulse border border-[var(--color-border)]" />
              ))}
            </div>
          ) : displayedOffers.length === 0 ? (
            <div className="py-8 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-sm flex flex-col items-center justify-center gap-3">
              <div className="w-14 h-14 bg-emerald-50/60 dark:bg-emerald-900/20 rounded-2xl flex items-center justify-center"><Gift className="w-7 h-7 text-emerald-300" /></div>
              <p className="text-[var(--color-text-tertiary)] text-sm font-medium">لا توجد عروض حالياً</p>
            </div>
          ) : (
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide snap-x snap-mandatory">
              {displayedOffers.map((offer) => {
                const isContest = offer.type === 'contest';
                const storeColorObj = offer.store_theme_color ? getStoreColorById(offer.store_theme_color) : undefined;
                const themeColor = storeColorObj?.solid || (isContest ? DEFAULT_CONTEST_COLOR : DEFAULT_OFFER_COLOR);
                const themeFrom = storeColorObj?.from || themeColor;
                const themeTo = storeColorObj?.to || themeColor;
                const truncatedDesc = offer.description
                  ? offer.description.length > 50
                    ? offer.description.slice(0, 50) + '...'
                    : offer.description
                  : null;

                return (
                  <div
                    key={offer.id}
                    onClick={() => openOfferDetail(offer.id)}
                    className="flex-shrink-0 min-w-[170px] max-w-[200px] snap-start cursor-pointer active:opacity-80"
                    style={{ willChange: 'transform' }}
                  >
                    <div
                      className="relative h-[210px] rounded-2xl overflow-hidden shadow-sm border-2"
                      style={{ background: `linear-gradient(135deg, ${themeFrom}dd, ${themeTo}99, ${themeColor}55)`, borderColor: themeColor }}
                    >
                      {offer.image_url && <SafeImage src={offer.image_url} alt={offer.title} className="absolute inset-0 w-full h-full object-cover opacity-25" fallback={null} />}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-black/10" />

                      {offer.discount && (
                        <div className="absolute top-3 left-3 z-10 w-16 h-16 rounded-full bg-white/95 dark:bg-black/70 backdrop-blur-sm flex flex-col items-center justify-center shadow-lg" style={{ border: `2px solid ${themeColor}` }}>
                          <Percent className="w-3 h-3" style={{ color: themeColor }} />
                          <span className="text-[11px] font-black leading-none" style={{ color: themeColor }}>{offer.discount}</span>
                        </div>
                      )}

                      <div className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                        {isContest ? <Trophy className="w-4 h-4 text-white" /> : <Gift className="w-4 h-4 text-white" />}
                      </div>

                      <div className="absolute top-3 left-3 z-10 flex gap-1" style={offer.discount ? { top: '62px' } : undefined}>
                        <button onClick={(e) => { e.stopPropagation(); handleShareOffer(offer); }} className="w-6 h-6 bg-[var(--color-surface)]/20 backdrop-blur-sm rounded-md flex items-center justify-center text-white/70 hover:text-white shadow-sm" aria-label="مشاركة"><Share2 className="w-3 h-3" /></button>
                        <button onClick={(e) => { e.stopPropagation(); handleReportOffer(offer); }} className="w-6 h-6 bg-[var(--color-surface)]/20 backdrop-blur-sm rounded-md flex items-center justify-center text-white/70 hover:text-white shadow-sm" aria-label="إبلاغ"><Flag className="w-3 h-3" /></button>
                      </div>

                      <div className="absolute bottom-0 left-0 right-0 p-3 z-10">
                        <span
                          className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full mb-1.5 text-white"
                          style={{ background: `${themeColor}cc` }}
                        >
                          {isContest ? '🏆 مسابقة' : '🎁 عرض'}
                        </span>

                        <h3 className="text-white font-semibold text-base leading-tight line-clamp-1">{offer.title}</h3>

                        {truncatedDesc && (
                          <p className="text-white/70 text-xs mt-1 line-clamp-2 leading-relaxed">{truncatedDesc}</p>
                        )}

                        <div className="flex items-center justify-between mt-2">
                          {offer.store_name && (
                            <div className="flex items-center gap-1">
                              <StoreIcon className="w-3 h-3 text-white/50" />
                              <span className="text-white/50 text-[11px] font-medium line-clamp-1">{offer.store_name}</span>
                            </div>
                          )}
                          {offer.expires_at && (() => {
                            const ti = getTimeRemaining(offer.expires_at);
                            if (!ti.isExpired && ti.text) return (
                              <span className="bg-white/15 backdrop-blur-sm text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full inline-flex items-center gap-0.5 whitespace-nowrap">
                                <Clock className="w-2.5 h-2.5" />{ti.text}
                              </span>
                            );
                            return null;
                          })()}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </motion.section>

        {/* ═══ 3. CATEGORIES 📂 ═══ */}
        <motion.section
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          <SectionHeader title="الفئات 📂" />
          <CategoryGrid onCategoryClick={handleCategoryClick} />
        </motion.section>

        {/* ═══ 4. FEATURED PRODUCTS ⭐ ═══ */}
        <motion.section
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.15 }}
        >
          <SectionHeader title="منتجات مميزة ⭐" actionLabel="الكل" onAction={handleViewAllFeatured} />
          {!dataLoaded ? (
            <div className="flex gap-3 overflow-hidden">
              {[...Array(3)].map((_, i) => (
                <div key={`fp-sk-${i}`} className="flex-shrink-0 w-40 h-52 bg-[var(--color-surface)] rounded-2xl animate-pulse border border-[var(--color-border)]" />
              ))}
            </div>
          ) : displayedFeaturedProducts.length === 0 ? (
            <div className="py-6 text-center">
              <p className="text-[var(--color-text-tertiary)] text-sm">لا توجد منتجات مميزة حالياً</p>
            </div>
          ) : (
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide snap-x snap-mandatory">
              {displayedFeaturedProducts.map((product) => (
                <div key={product.id} className="flex-shrink-0 w-[140px] snap-start">
                  <ProductCard
                    product={product}
                    isFavorite={favSet.has(product.id)}
                    onReport={handleReportProduct}
                    onShare={handleShareProduct}
                    onOpen={handleOpenProductDetail}
                    onToggleFavorite={handleToggleFavorite}
                    isLoggedIn={!!user}
                  />
                </div>
              ))}
            </div>
          )}
        </motion.section>

        {/* ═══ 5. FEATURED STORES 🏪 ═══ */}
        <motion.section
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
        >
          <SectionHeader title="متاجر مميزة 🏪" actionLabel="الكل" onAction={handleViewAllStores} />
          <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide snap-x snap-mandatory">
            {!dataLoaded
              ? storeSkeletons
              : featuredStores.length === 0 ? (
                <div className="py-6 text-center w-full">
                  <p className="text-[var(--color-text-tertiary)] text-sm">لا توجد متاجر مميزة حالياً</p>
                </div>
              ) : (
                featuredStores.slice(0, 5).map((store) => (
                  <div key={store.id} className="snap-start">
                    <StoreCard store={store} getStoreColorById={getStoreColorById} />
                  </div>
                ))
              )}
          </div>
        </motion.section>

        {/* ═══ 6. NEW PRODUCTS 🆕 — 4-column compact grid ═══ */}
        <motion.section
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.25 }}
        >
          <SectionHeader
            title="منتجات جديدة 🆕"
            actionLabel="الكل"
            onAction={handleViewAllNewProducts}
            extra={
              <div className="flex items-center gap-1">
                <Star className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400 fill-amber-500" />
                <span className="text-xs text-[var(--color-text-tertiary)] font-medium">الأحدث</span>
              </div>
            }
          />
          <div className="grid grid-cols-4 gap-1.5">
            {!dataLoaded
              ? <><SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard /></>
              : displayedNewProducts.length === 0 ? (
                <div className="col-span-4 py-6 text-center">
                  <p className="text-[var(--color-text-tertiary)] text-sm">لا توجد منتجات جديدة حالياً</p>
                </div>
              ) : displayedNewProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  compact
                  isFavorite={favSet.has(product.id)}
                  onReport={handleReportProduct}
                  onShare={handleShareProduct}
                  onOpen={handleOpenProductDetail}
                  onToggleFavorite={handleToggleFavorite}
                  isLoggedIn={!!user}
                />
              ))}
          </div>
        </motion.section>
      </main>

      {/* Report Modal */}
      {reportModal.isOpen && (
        <ReportModal isOpen={reportModal.isOpen} onClose={handleCloseReportModal} targetType={reportModal.targetType} targetId={reportModal.targetId} targetName={reportModal.targetName} />
      )}

      {/* Share Sheet */}
      {shareTarget && (
        <ShareSheet isOpen={showShareSheet} onClose={handleCloseShareSheet} itemType={shareTarget.type} itemId={shareTarget.id} itemName={shareTarget.name} itemDescription={shareTarget.description} itemPrice={shareTarget.price} storeName={shareTarget.storeName} imageUrl={shareTarget.imageUrl} discount={shareTarget.discount} />
      )}

      {/* PWA Install Banner */}
      <PwaInstallBanner />
    </div>
  );
};
