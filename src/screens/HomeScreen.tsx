'use client';
import React, { memo, useEffect, useState, useCallback, useMemo, useRef, useTransition } from 'react';
import { fetchApi, apiPost, apiDelete } from '@/lib/fetchApi';
import { Search, Star, ChevronLeft, Verified, Flag, Clock, Share2, Bell, Wallet, Gift, Trophy, Store as StoreIcon, Percent } from 'lucide-react';
import { SkeletonCard } from '@/components/market/Card';
import { SafeImage, StoreLogo } from '@/components/market/SafeImage';
import { ShareSheet } from '@/components/market/ShareSheet';
import { ProductCard } from '@/components/market/ProductCard';
import type { ProductCardData } from '@/components/market/ProductCard';
import { CategoryGrid } from '@/components/market/CategoryGrid';
import { LazySection } from '@/components/market/LazySection';
import { ReportModal } from '@/components/admin/ReportModal';
import { useAppStore } from '@/store/appStore';
import { useAuthStore } from '@/store/authStore';
import { useNotificationStore } from '@/store/notificationStore';
import { usePointsStore } from '@/store/pointsStore';
import { useStoreColorStore } from '@/store/storeColorStore';
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
  <div className="flex items-center justify-between mb-3">
    <h2 className="text-sm font-bold text-[var(--color-text)]">{title}</h2>
    <div className="flex items-center gap-2">
      {extra}
      {actionLabel && (
        <button onClick={onAction} className="text-xs font-bold text-emerald-500 flex items-center gap-0.5">
          {actionLabel} <ChevronLeft className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  </div>
  );
});
SectionHeader.displayName = 'SectionHeader';

// Memoized Store Card — circular logo with themeColor border (manual scroll only)
const StoreCard: React.FC<{ store: Store }> = memo(({ store }) => {
  const handleOpen = useCallback(() => {
    const { setSelectedStoreId, setSubScreen } = useAppStore.getState();
    setSelectedStoreId(store.id);
    setSubScreen('store-detail');
  }, [store.id]);

  const borderColor = store.theme_color || '#e5e7eb';

  return (
    <div
      onClick={handleOpen}
      className="flex-shrink-0 flex flex-col items-center gap-2 cursor-pointer active:opacity-80"
      style={{ contain: 'layout style paint', width: '88px' }}
    >
      <div
        className="w-[72px] h-[72px] rounded-2xl overflow-hidden shadow-sm"
        style={{ border: '2px solid', borderColor }}
      >
        <StoreLogo src={store.logo_url} name={store.name} size="md" className="w-full h-full" />
      </div>
      <div className="flex items-center gap-0.5 max-w-[84px]">
        <p className="text-[11px] font-bold text-[var(--color-text)] line-clamp-1 text-center">{store.name}</p>
        {store.is_verified && <Verified className="w-3 h-3 text-emerald-500 flex-shrink-0" />}
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

  // Store color resolver — used to get theme color for offer cards
  const getStoreColorById = useStoreColorStore(s => s.getStoreColorById);

  // useTransition for non-critical state updates
  const [_isPending, startTransition] = useTransition();

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

  // ── Local state — split into independent loading states ──
  const [storesLoaded, setStoresLoaded] = useState(false);
  const [productsLoaded, setProductsLoaded] = useState(false);
  const [offersLoaded, setOffersLoaded] = useState(false);
  const [featuredProducts, setFP] = useState<ProductCardData[]>([]);
  const [newProducts, setNP] = useState<ProductCardData[]>([]);
  const [featuredStores, setFS] = useState<Store[]>([]);
  const [allOffers, setAllOffers] = useState<OfferItem[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [reportModal, setReportModal] = useState<{ isOpen: boolean; targetType: 'product' | 'store' | 'offer'; targetId: string; targetName: string }>({ isOpen: false, targetType: 'product', targetId: '', targetName: '' });
  const [showShareSheet, setShowShareSheet] = useState(false);
  const [shareTarget, setShareTarget] = useState<{
    type: 'store' | 'product' | 'offer' | 'contest'; id: string; name: string;
    description?: string; price?: string; storeName?: string; imageUrl?: string; discount?: string;
  } | null>(null);

  // ── Sliced display arrays ──
  const displayedOffers = useMemo(() => allOffers.slice(0, 5), [allOffers]);
  const displayedFeaturedProducts = useMemo(() => featuredProducts.slice(0, 3), [featuredProducts]);
  const displayedNewProducts = useMemo(() => newProducts.slice(0, 3), [newProducts]);

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

  // ── Navigation Fetch Guard — skip re-fetch if user navigated back within 30s ──
  const lastFetchTime = useRef(0);
  const lastFetchSuccess = useRef(false);
  const prevUserIdRef = useRef<string | undefined>(user?.id);
  const HOME_FETCH_COOLDOWN = 30_000; // 30 seconds

  // ── Data fetch: Progressive loading with useTransition ──
  const fetchHomeData = useCallback(async (signal?: AbortSignal) => {
    const url = `/api/home?userId=${user?.id || ''}&fpPage=1&npPage=1`;
    const { data, error } = await fetchApi(url, { signal });
    if (error) throw new Error(error);
    return data;
  }, [user?.id]);

  // Initial load
  useEffect(() => {
    const userIdChanged = prevUserIdRef.current !== user?.id;
    prevUserIdRef.current = user?.id;

    const now = Date.now();
    // Skip cooldown only if last fetch was successful; always retry on failure
    if (!userIdChanged && lastFetchSuccess.current && now - lastFetchTime.current < HOME_FETCH_COOLDOWN) return;

    console.log('[HomeScreen] Fetching home data...', { userId: user?.id, userIdChanged });
    const controller = new AbortController();
    const { signal } = controller;
    let cancelled = false;

    fetchHomeData(signal)
      .then((data) => {
        if (cancelled) return;

        lastFetchTime.current = Date.now();
        lastFetchSuccess.current = true;
        console.log('[HomeScreen] Data loaded successfully', {
          stores: data?.featured_stores?.length || 0,
          products: data?.featured_products?.length || 0,
          offers: data?.offers?.length || 0,
        });

        // CRITICAL: Show stores first (visible above the fold)
        startTransition(() => {
          setFS(data?.featured_stores || []);
          setStoresLoaded(true);
        });

        // DEFERRED: Show products after a micro-delay
        setTimeout(() => {
          if (cancelled) return;
          startTransition(() => {
            setFP((data?.featured_products || []) as ProductCardData[]);
            setNP((data?.new_products || []) as ProductCardData[]);
            setProductsLoaded(true);
          });
        }, 50);

        // LAZY: Show offers last
        setTimeout(() => {
          if (cancelled) return;
          startTransition(() => {
            setAllOffers(data?.offers || []);
            setOffersLoaded(true);
          });
        }, 100);
      })
      .catch(err => {
        if (!cancelled) {
          console.error('[HomeScreen] Fetch error:', err);
          // Mark fetch as failed so cooldown doesn't block retry
          lastFetchSuccess.current = false;
          // Show empty state so skeletons disappear and retry is possible
          setStoresLoaded(true);
          setProductsLoaded(true);
          setOffersLoaded(true);
        }
      });

    return () => { cancelled = true; controller.abort(); };
  }, [fetchHomeData]);

  // ── Auto-refresh every 60 seconds (silent, with thin progress bar) ──
  // Skips refresh if the user is interacting (modal open, typing in a field)
  useEffect(() => {
    const interval = setInterval(() => {
      // Skip if user is interacting with a modal or input
      const activeEl = document.activeElement;
      const isTyping = activeEl instanceof HTMLInputElement || activeEl instanceof HTMLTextAreaElement;
      const hasOpenModal = document.querySelector('[role="dialog"][aria-modal="true"]');
      if (isTyping || hasOpenModal) {
        console.log('[HomeScreen] Skipping auto-refresh — user is interacting');
        return;
      }

      setIsRefreshing(true);
      fetchHomeData()
        .then((data) => {
          if (!data) return;
          lastFetchTime.current = Date.now();
          lastFetchSuccess.current = true;
          startTransition(() => {
            setFS(data?.featured_stores || []);
            setFP((data?.featured_products || []) as ProductCardData[]);
            setNP((data?.new_products || []) as ProductCardData[]);
            setAllOffers(data?.offers || []);
          });
          console.log('[HomeScreen] Auto-refreshed successfully');
        })
        .catch(() => { /* silent refresh failure */ })
        .finally(() => setIsRefreshing(false));
    }, 60_000); // 60 seconds
    return () => clearInterval(interval);
  }, [fetchHomeData, startTransition]);

  // ── Memoized skeletons (created once) ──
  const storeSkeletons = useMemo(() => [...Array(5)].map((_, i) => (
    <div key={`fs-sk-${i}`} className="flex-shrink-0 flex flex-col items-center gap-2" style={{ width: '88px' }}>
      <div className="w-[72px] h-[72px] rounded-2xl bg-[var(--color-surface)] animate-pulse border-2 border-[var(--color-border)]" />
      <div className="w-14 h-3 bg-[var(--color-surface)] animate-pulse rounded" />
    </div>
  )), []);

  return (
    <div className="min-h-screen bg-[var(--color-bg)] pb-24">
      {/* Thin progress bar for silent auto-refresh */}
      {isRefreshing && (
        <div className="fixed top-0 left-0 right-0 z-[200] h-1 bg-emerald-100 dark:bg-emerald-900/30">
          <div className="h-full bg-gradient-to-l from-emerald-400 to-teal-500 animate-pulse rounded-full" style={{ width: '60%' }} />
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

      {/* ═══ 1. SEARCH BAR — First thing after header ═══ */}
      <div className="px-5 -mt-6 relative z-20 mb-2">
        <div
          onClick={() => setActiveTab(2)}
          className="bg-[var(--color-surface)] rounded-xl flex items-center gap-3 px-4 py-3 border border-[var(--color-border)] cursor-pointer shadow-sm"
        >
          <Search className="w-5 h-5 text-slate-400" />
          <span className="text-[var(--color-text-tertiary)] text-sm font-medium flex-1">ابحث عن منتجات، متاجر، عروض...</span>
          <div className="w-9 h-9 gradient-primary rounded-lg flex items-center justify-center shadow-sm">
            <Search className="w-4 h-4 text-white" />
          </div>
        </div>
      </div>

      <main className="px-5 space-y-6 mt-4">

        {/* ═══ 2. OFFERS & CONTESTS 🎁 — Manual-scroll horizontal ═══ */}
        <LazySection placeholderHeight={220} fallback={<div className="h-52 rounded-2xl bg-[var(--color-surface)] animate-pulse border border-[var(--color-border)]" />}>
          <section>
            <SectionHeader title="العروض والمسابقات 🎁" actionLabel="الكل" onAction={handleViewAllOffers} />
            {!offersLoaded ? (
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
                      style={{ contain: 'layout style paint', contentVisibility: 'auto' }}
                    >
                      <div
                        className="relative h-[210px] rounded-2xl overflow-hidden shadow-sm border border-white/10"
                        style={{ background: `linear-gradient(135deg, ${themeFrom}dd, ${themeTo}99, ${themeColor}55)` }}
                      >
                        {offer.image_url && <SafeImage src={offer.image_url} alt={offer.title} className="absolute inset-0 w-full h-full object-cover opacity-25" fallback={null} />}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-black/10" />

                        {offer.discount && (
                          <div className="absolute top-3 left-3 z-10 w-[52px] h-[52px] rounded-full bg-white/95 dark:bg-black/70 backdrop-blur-sm flex flex-col items-center justify-center shadow-lg" style={{ border: `2px solid ${themeColor}` }}>
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

                          <h3 className="text-white font-bold text-sm leading-tight line-clamp-1">{offer.title}</h3>

                          {truncatedDesc && (
                            <p className="text-white/70 text-[11px] mt-1 line-clamp-2 leading-relaxed">{truncatedDesc}</p>
                          )}

                          <div className="flex items-center justify-between mt-2">
                            {offer.store_name && (
                              <div className="flex items-center gap-1">
                                <StoreIcon className="w-3 h-3 text-white/50" />
                                <span className="text-white/50 text-[10px] font-medium line-clamp-1">{offer.store_name}</span>
                              </div>
                            )}
                            {offer.expires_at && (() => {
                              const ti = getTimeRemaining(offer.expires_at);
                              if (!ti.isExpired && ti.text) return (
                                <span className="bg-white/15 backdrop-blur-sm text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full inline-flex items-center gap-0.5 whitespace-nowrap">
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
          </section>
        </LazySection>

        {/* ═══ 3. CATEGORIES 📂 ═══ */}
        <section>
          <SectionHeader title="الفئات 📂" />
          <CategoryGrid onCategoryClick={handleCategoryClick} />
        </section>

        {/* ═══ 4. FEATURED PRODUCTS ⭐ — Manual-scroll horizontal ═══ */}
        <LazySection placeholderHeight={260} fallback={
          <div className="flex gap-3 overflow-hidden">
            <div className="flex-shrink-0 w-40 h-52 bg-[var(--color-surface)] rounded-2xl animate-pulse border border-[var(--color-border)]" />
            <div className="flex-shrink-0 w-40 h-52 bg-[var(--color-surface)] rounded-2xl animate-pulse border border-[var(--color-border)]" />
            <div className="flex-shrink-0 w-40 h-52 bg-[var(--color-surface)] rounded-2xl animate-pulse border border-[var(--color-border)]" />
          </div>
        }>
          <section>
            <SectionHeader title="منتجات مميزة ⭐" actionLabel="الكل" onAction={handleViewAllFeatured} />
            {!productsLoaded ? (
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
                  <div key={product.id} className="flex-shrink-0 w-40 snap-start">
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
          </section>
        </LazySection>

        {/* ═══ 5. FEATURED STORES 🏪 — Manual-scroll horizontal ═══ */}
        <section>
          <SectionHeader title="متاجر مميزة 🏪" actionLabel="الكل" onAction={handleViewAllStores} />
          <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide snap-x snap-mandatory">
            {!storesLoaded
              ? storeSkeletons
              : featuredStores.length === 0 ? (
                <div className="py-6 text-center w-full">
                  <p className="text-[var(--color-text-tertiary)] text-sm">لا توجد متاجر مميزة حالياً</p>
                </div>
              ) : (
                featuredStores.slice(0, 5).map((store) => (
                  <div key={store.id} className="snap-start">
                    <StoreCard store={store} />
                  </div>
                ))
              )}
          </div>
        </section>

        {/* ═══ 6. NEW PRODUCTS 🆕 — 2-column grid ═══ */}
        <LazySection placeholderHeight={500} fallback={
          <div className="grid grid-cols-2 gap-3">
            <SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard />
          </div>
        }>
          <section>
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
            <div className="grid grid-cols-2 gap-3">
              {!productsLoaded
                ? <><SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard /></>
                : displayedNewProducts.length === 0 ? (
                  <div className="col-span-2 py-6 text-center">
                    <p className="text-[var(--color-text-tertiary)] text-sm">لا توجد منتجات جديدة حالياً</p>
                  </div>
                ) : displayedNewProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    isFavorite={favSet.has(product.id)}
                    onReport={handleReportProduct}
                    onShare={handleShareProduct}
                    onOpen={handleOpenProductDetail}
                    onToggleFavorite={handleToggleFavorite}
                    isLoggedIn={!!user}
                  />
                ))}
            </div>
          </section>
        </LazySection>
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
