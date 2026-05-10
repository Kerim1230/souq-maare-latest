'use client';
import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  ArrowRight, Star, Users, ShoppingBag, MessageCircle, Loader2, ImageIcon, Package, Gift, Trophy,
  ShieldCheck, Share2, Flag, Clock, Heart, Percent,
  Eye, Search, SlidersHorizontal, Calendar, Sparkles, MapPin
} from 'lucide-react';
import { ChatModal } from '@/components/market/ChatModal';
import { SafeImage, StoreLogo } from '@/components/market/SafeImage';
import { Input } from '@/components/market/Input';
import { useAuthStore } from '@/store/authStore';
import { useAppStore } from '@/store/appStore';
import { useVerificationStore } from '@/store/verificationStore';
import type { Product, Store } from '@/store/appStore';
import { ShareSheet } from '@/components/market/ShareSheet';
import { ReportModal } from '@/components/admin/ReportModal';
import { getTimeRemaining, getUrgencyColors } from '@/store/autoDeleteStore';
import toast from 'react-hot-toast';
import { fetchApi, apiPost, apiDelete } from '@/lib/fetchApi';
import { useStoreTheme } from '@/hooks/useStoreTheme';
import { useStoreColorStore } from '@/store/storeColorStore';

interface StoreOffer {
  id: string;
  store_id: string;
  title: string;
  description?: string;
  image_url?: string;
  type: string;
  discount?: string;
  expires_at?: string | null;
  comments_count: number;
  is_featured?: boolean;
}

type StoreTab = 'products' | 'featured' | 'offers' | 'contests' | 'info';
type SortOption = 'newest' | 'price_low' | 'price_high' | 'views';

export const StoreDetailScreen: React.FC = () => {
  const user = useAuthStore(s => s.user);
  const selectedStoreId = useAppStore(s => s.selectedStoreId);
  const setSubScreen = useAppStore(s => s.setSubScreen);
  const addFavorite = useAppStore(s => s.addFavorite);
  const removeFavorite = useAppStore(s => s.removeFavorite);
  const favorites = useAppStore(s => s.favorites);
  const storeVerification = useVerificationStore(s => selectedStoreId ? (s.verifications[selectedStoreId] ?? null) : null);
  const loadStoreVerification = useVerificationStore(s => s.loadStoreVerification);
  const canStoreChat = useVerificationStore(s => s.canStoreChat);
  const isVerified = useMemo(() => {
    if (!storeVerification || !storeVerification.isActive || !storeVerification.endDate) return false;
    return new Date(storeVerification.endDate) > new Date();
  }, [storeVerification]);
  const chatAvailable = useMemo(() => selectedStoreId ? canStoreChat(selectedStoreId) : false, [selectedStoreId, canStoreChat, storeVerification]);
  const [store, setStore] = useState<Store | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [offers, setOffers] = useState<StoreOffer[]>([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showChat, setShowChat] = useState(false);
  const [showShareSheet, setShowShareSheet] = useState(false);
  const [shareTarget, setShareTarget] = useState<{ type: 'store' | 'product' | 'offer' | 'contest'; id: string; name: string; description?: string; price?: string; storeName?: string; imageUrl?: string; discount?: string } | null>(null);
  const [reportModal, setReportModal] = useState<{ isOpen: boolean; targetType: 'product' | 'store' | 'offer'; targetId: string; targetName: string }>({ isOpen: false, targetType: 'product', targetId: '', targetName: '' });
  const [favoriteLoading, setFavoriteLoading] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<StoreTab>('products');
  const [sortOption, setSortOption] = useState<SortOption>('newest');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSortMenu, setShowSortMenu] = useState(false);

  // ── Guard: don't render or fetch without a storeId (FIX 4) ──
  useEffect(() => {
    if (!selectedStoreId && !loading && !store) {
      setSubScreen('none');
    }
  }, [selectedStoreId, loading, store, setSubScreen]);

  // Ref to track if store data was ever loaded (prevents circular dependency)
  const hasStoreData = useRef(false);

  const loadStore = useCallback(async (signal?: AbortSignal) => {
    if (!selectedStoreId) return;
    setLoading(true);
    setError(null);
    try {
      const [storeResult, productsResult] = await Promise.all([
        fetchApi<{ stores?: Store[]; store?: Store }>(`/api/stores?id=${selectedStoreId}&userId=${user?.id || ''}`, { signal }),
        fetchApi<{ products: Product[] }>(`/api/products?store_id=${selectedStoreId}`, { signal }),
      ]);

      // Validate store data
      const s = storeResult.data?.stores?.[0] || storeResult.data?.store;
      if (!s) {
        setError('STORE_NOT_FOUND');
        return;
      }

      // Validate products — filter by storeId to prevent cross-store leakage
      const rawProducts = productsResult.data?.products || [];
      const storeProducts = rawProducts.filter(p => p.store_id === selectedStoreId);

      setStore(s);
      hasStoreData.current = true;
      setIsFollowing(s.is_following || false);
      setFollowersCount(s.followers_count || 0);
      setProducts(storeProducts);

      // Offers (non-blocking)
      try {
        const offersResult = await fetchApi<{ offers: StoreOffer[] }>(`/api/offers?storeId=${selectedStoreId}`, { signal });
        if (!offersResult.error) { setOffers(offersResult.data?.offers || []); }
      } catch { /* offers fetch is non-blocking */ }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      // Only show error if we NEVER had store data (prevents false error flash)
      if (!hasStoreData.current) {
        setError('LOAD_FAILED');
        toast.error('حدث خطأ في تحميل المتجر');
      }
    } finally {
      setLoading(false);
    }
  }, [selectedStoreId, user]);

  // ── Clear stale data when storeId changes (FIX 3) ──
  useEffect(() => {
    if (!selectedStoreId) return;
    setProducts([]);
    setOffers([]);
    setStore(null);
    setError(null);
    hasStoreData.current = false; // Reset ref so error guard works for new store
  }, [selectedStoreId]);

  // ── Load store data ──
  useEffect(() => {
    const controller = new AbortController();
    loadStore(controller.signal);
    return () => controller.abort();
  }, [loadStore]);

  // ── Load verification data for this store ──
  useEffect(() => {
    if (selectedStoreId) {
      loadStoreVerification(selectedStoreId);
    }
  }, [selectedStoreId, loadStoreVerification]);

  const handleFollow = useCallback(async () => {
    if (!user || !selectedStoreId) { toast.error('يجب تسجيل الدخول أولاً'); return; }
    try {
      if (isFollowing) {
        const { error } = await apiDelete(`/api/stores/follow?userId=${user.id}&storeId=${selectedStoreId}`);
        if (error) throw new Error();
        setIsFollowing(false); setFollowersCount(Math.max(0, followersCount - 1)); toast.success('تم إلغاء المتابعة');
      } else {
        const followResult = await apiPost<{ notification?: any }>(`/api/stores/follow`, { userId: user.id, storeId: selectedStoreId });
        if (followResult.error) throw new Error();
        setIsFollowing(true); setFollowersCount(followersCount + 1); toast.success('تمت المتابعة بنجاح!');
        if (followResult.data?.notification) { const { useNotificationStore } = await import('@/store/notificationStore'); useNotificationStore.getState().createNotification(followResult.data.notification); }
      }
    } catch { toast.error('حدث خطأ'); }
  }, [user, selectedStoreId, isFollowing, followersCount]);

  const isProductFavorite = useCallback((productId: string) => favorites.some(f => f.product_id === productId), [favorites]);

  const handleToggleProductFavorite = useCallback(async (product: Product) => {
    if (!user) { toast.error('يجب تسجيل الدخول أولاً'); return; }
    const existingFav = favorites.find(f => f.product_id === product.id);
    setFavoriteLoading(product.id);
    try {
      if (existingFav) {
        const { error: delError } = await apiDelete(`/api/favorites?favoriteId=${existingFav.id}`);
        if (delError) throw new Error(); removeFavorite(existingFav.id); toast.success('تم الإزالة من المفضلة');
      } else {
        const addResult = await apiPost<{ favorite?: any; notification?: any }>('/api/favorites', { userId: user.id, productId: product.id });
        if (addResult.error) throw new Error();
        if (addResult.data?.favorite) addFavorite(addResult.data.favorite);
        if (addResult.data?.notification) { const { useNotificationStore } = await import('@/store/notificationStore'); useNotificationStore.getState().createNotification(addResult.data.notification); }
        toast.success('تمت الإضافة للمفضلة!');
      }
    } catch { toast.error('حدث خطأ'); } finally { setFavoriteLoading(null); }
  }, [user, favorites, addFavorite, removeFavorite]);

  const filteredProducts = useMemo(() => {
    let result = [...products];
    if (searchQuery.trim()) {
      result = result.filter(p => p.name.includes(searchQuery.trim()) || (p.category && p.category.includes(searchQuery.trim())));
    }
    switch (sortOption) {
      case 'newest': result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()); break;
      case 'price_low': result.sort((a, b) => a.price - b.price); break;
      case 'price_high': result.sort((a, b) => b.price - a.price); break;
      case 'views': result.sort((a, b) => (b.views || 0) - (a.views || 0)); break;
    }
    return result;
  }, [products, searchQuery, sortOption]);

  const featuredProducts = useMemo(() => filteredProducts.filter(p => p.is_featured), [filteredProducts]);
  const storeOffers = useMemo(() => offers.filter(o => o.type === 'offer'), [offers]);
  const storeContests = useMemo(() => offers.filter(o => o.type === 'contest'), [offers]);

  const totalViews = useMemo(() => products.reduce((sum, p) => sum + (p.views || 0), 0), [products]);

  const tabs: { id: StoreTab; label: string; icon: React.ReactNode; count?: number }[] = [
    { id: 'products', label: 'المنتجات', icon: <Package className="w-4 h-4" />, count: filteredProducts.length },
    { id: 'featured', label: 'المميزة', icon: <Star className="w-4 h-4" />, count: featuredProducts.length },
    { id: 'offers', label: 'العروض', icon: <Gift className="w-4 h-4" />, count: storeOffers.length },
    { id: 'contests', label: 'المسابقات', icon: <Trophy className="w-4 h-4" />, count: storeContests.length },
    { id: 'info', label: 'عن المتجر', icon: <Eye className="w-4 h-4" /> },
  ];

  const sortOptions: { id: SortOption; label: string }[] = [
    { id: 'newest', label: 'الأحدث' },
    { id: 'price_low', label: 'السعر: الأقل' },
    { id: 'price_high', label: 'السعر: الأعلى' },
    { id: 'views', label: 'الأكثر مشاهدة' },
  ];

  // Store Theme Color System (hooks must be before early returns)
  const theme = useStoreTheme(undefined, store?.theme_color);
  const getStoreColorById = useStoreColorStore(s => s.getStoreColorById);

  // ── 3-State Rendering: loading → error (only if no data) → content (FIX 1) ──
  if (loading) {
    return (<div className="bg-[var(--color-bg)] min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 text-emerald-500 animate-spin" /></div>);
  }
  if (error && !store) {
    return (
      <div className="bg-[var(--color-bg)] min-h-screen flex flex-col items-center justify-center gap-3">
        <p className="text-[var(--color-text-secondary)]">{error === 'STORE_NOT_FOUND' ? 'لم يتم العثور على المتجر' : 'حدث خطأ في تحميل المتجر'}</p>
        <button onClick={() => setSubScreen('none')} className="text-emerald-500 text-sm font-bold">العودة</button>
      </div>
    );
  }
  if (!store) {
    return (<div className="bg-[var(--color-bg)] min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 text-emerald-500 animate-spin" /></div>);
  }

  const isStoreOwner = user && user.id === store.user_id;

  // All theme color values are now provided by the useStoreTheme hook via theme.color, theme.themeBg, etc.

  const ProductCard: React.FC<{ product: Product }> = ({ product }) => (
    <div
      className="bg-[var(--color-surface)] rounded-2xl overflow-hidden border-2 shadow-sm cursor-pointer active:scale-[0.98] transition-all duration-150 hover:shadow-lg" style={{ borderColor: theme.color?.solid || '#e5e7eb' }}
      onClick={() => { const { openProductDetail } = useAppStore.getState(); openProductDetail(product.id); }}
    >
      <div className="aspect-square bg-gradient-to-br from-emerald-50/50 to-teal-50/50 dark:from-emerald-900/20 dark:to-teal-900/20 relative overflow-hidden" style={theme.color ? { background: `linear-gradient(135deg, ${theme.color.lightFrom}80, ${theme.color.lightTo}80)` } : undefined}>
        <SafeImage
          src={product.image_url}
          alt={product.name}
          className="w-full h-full object-cover"
          fallback={<div className="w-full h-full flex items-center justify-center"><ImageIcon className="w-7 h-7 text-emerald-300 dark:text-emerald-700" /></div>}
        />
        <div className="absolute top-2 right-2 flex gap-1">
          {product.is_new && <span className="text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full shadow-sm" style={theme.color ? { background: theme.themeBg } : undefined}>جديد</span>}
          {product.is_featured && <span className="gradient-warm text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full shadow-sm">مميز</span>}
        </div>
        {user && (
          <button
            onClick={(e) => { e.stopPropagation(); handleToggleProductFavorite(product); }}
            disabled={favoriteLoading === product.id}
            className="absolute top-2 left-2 z-10 w-7 h-7 bg-white/90 dark:bg-black/50 backdrop-blur-sm rounded-lg flex items-center justify-center shadow-sm transition-colors hover:bg-white dark:hover:bg-black/70"
          >
            {favoriteLoading === product.id ? (
              <Loader2 className="w-3.5 h-3.5 text-[var(--color-text-tertiary)] animate-spin" />
            ) : (
              <Heart className={`w-3.5 h-3.5 ${isProductFavorite(product.id) ? 'fill-rose-500 text-rose-500' : 'text-[var(--color-text-tertiary)]'}`} />
            )}
          </button>
        )}
      </div>
      <div className="p-3">
        <p className="text-[13px] font-semibold text-[var(--color-text)] line-clamp-1">{product.name}</p>
        {product.category && <p className="text-[11px] text-[var(--color-text-tertiary)] mt-0.5">{product.category}</p>}
        <p className="text-[15px] font-bold gradient-text-primary mt-1" style={theme.color ? { background: theme.themeBg, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' } : undefined}>{product.price.toLocaleString('ar-SY')} ل.س</p>
        <div className="flex items-center justify-between mt-1.5">
          <div className="flex items-center gap-1">
            <Eye className="w-3 h-3 text-[var(--color-text-tertiary)]" />
            <span className="text-[10px] text-[var(--color-text-tertiary)]">{(product.views || 0).toLocaleString('ar-SY')}</span>
          </div>
          {product.expires_at && (() => {
            const timeInfo = getTimeRemaining(product.expires_at);
            if (!timeInfo.isExpired && timeInfo.text) {
              const colors = getUrgencyColors(timeInfo.urgencyLevel);
              return <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${colors.bg} ${colors.text}`}>{timeInfo.text}</span>;
            }
            return null;
          })()}
        </div>
      </div>
    </div>
  );

  // Default colors for offers/contests when no store theme
  const DEFAULT_OFFER_COLOR_SD = '#059669';
  const DEFAULT_CONTEST_COLOR_SD = '#e11d48';

  const OfferCard: React.FC<{ offer: StoreOffer }> = ({ offer }) => {
    const isContest = offer.type === 'contest';
    // Resolve store's theme_color ID via storeColorStore
    const storeColorObj = store?.theme_color ? getStoreColorById(store.theme_color) : undefined;
    const themeColor = storeColorObj?.solid || (isContest ? DEFAULT_CONTEST_COLOR_SD : DEFAULT_OFFER_COLOR_SD);
    const themeFrom = storeColorObj?.from || themeColor;
    const themeTo = storeColorObj?.to || themeColor;
    const truncatedDesc = offer.description
      ? offer.description.length > 50
        ? offer.description.slice(0, 50) + '...'
        : offer.description
      : null;

    return (
      <div
        className="bg-[var(--color-surface)] rounded-2xl overflow-hidden border-2 shadow-sm cursor-pointer active:scale-[0.98] transition-transform duration-150 flex-shrink-0 w-[280px]"
        style={{ borderColor: themeColor }}
        onClick={() => { const { openOfferDetail } = useAppStore.getState(); openOfferDetail(offer.id); }}
      >
        {/* Hero section with theme color gradient + image */}
        <div
          className="aspect-[16/10] overflow-hidden relative"
          style={{ background: `linear-gradient(135deg, ${themeFrom}cc, ${themeTo}99, ${themeColor}55)` }}
        >
          {offer.image_url ? (
            <SafeImage src={offer.image_url} alt={offer.title} className="w-full h-full object-cover opacity-40" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              {isContest ? <Trophy className="w-14 h-14 text-white/40" /> : <Gift className="w-14 h-14 text-white/40" />}
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
          <div className="bg-gradient-to-t from-black/60 to-transparent absolute bottom-0 left-0 right-0 h-20" />

          {/* Discount circle badge — top-left (RTL) */}
          {offer.discount && (
            <div className="absolute top-3 left-3 z-10 w-16 h-16 rounded-full bg-white/95 dark:bg-black/70 backdrop-blur-sm flex flex-col items-center justify-center shadow-lg" style={{ border: `2px solid ${themeColor}` }}>
              <Percent className="w-2.5 h-2.5" style={{ color: themeColor }} />
              <span className="text-[10px] font-black leading-none" style={{ color: themeColor }}>{offer.discount}</span>
            </div>
          )}

          {/* Featured badge — top-right (RTL) */}
          {offer.is_featured && (
            <div className="absolute top-2.5 right-2.5 z-10 bg-gradient-to-r from-amber-400 to-amber-500 text-white text-[8px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
              <Star className="w-2.5 h-2.5 fill-white" /> مميز
            </div>
          )}

          {/* Type icon badge */}
          <div className="absolute top-2.5 right-2.5 z-10 w-7 h-7 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center" style={offer.is_featured ? { top: '36px' } : undefined}>
            {isContest ? <Trophy className="w-3.5 h-3.5 text-white" /> : <Gift className="w-3.5 h-3.5 text-white" />}
          </div>

          {/* Report button */}
          <button
            onClick={(e) => { e.stopPropagation(); setReportModal({ isOpen: true, targetType: 'offer', targetId: offer.id, targetName: offer.title }); }}
            className="absolute bottom-2.5 left-2.5 w-6 h-6 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center text-white/70 hover:text-white shadow-sm z-10"
            aria-label="إبلاغ"
          >
            <Flag className="w-3 h-3" />
          </button>
        </div>

        {/* Content */}
        <div className="p-3.5">
          {/* Type label */}
          <span
            className="inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full"
            style={{ background: `${themeColor}22`, color: themeColor }}
          >
            {isContest ? '🏆 مسابقة' : '🎁 عرض'}
          </span>

          {/* Title */}
          <p className="text-sm font-semibold text-[var(--color-text)] line-clamp-1 mt-1.5">{offer.title}</p>

          {/* Description */}
          {truncatedDesc && (
            <p className="text-xs text-[var(--color-text-tertiary)] mt-0.5 line-clamp-2 leading-relaxed">{truncatedDesc}</p>
          )}

          {/* Bottom: discount + timer */}
          <div className="flex items-center justify-between mt-2.5">
            {offer.discount && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg flex items-center gap-1" style={{ background: `${themeColor}18`, color: themeColor }}>
                <Percent className="w-3 h-3" />
                خصم {offer.discount}
              </span>
            )}
            {offer.expires_at && (() => {
              const timeInfo = getTimeRemaining(offer.expires_at);
              if (!timeInfo.isExpired && timeInfo.text) {
                const colors = getUrgencyColors(timeInfo.urgencyLevel);
                return <span className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-lg ${colors.bg} ${colors.text}`}><Clock className="w-3 h-3" />{timeInfo.text}</span>;
              }
              return null;
            })()}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-[var(--color-bg)] min-h-screen pb-24">
      {/* Cover */}
      <div className="relative h-56 overflow-hidden" style={theme.themeBg ? { background: theme.themeBg } : undefined}>
        {!theme.color && <div className="absolute inset-0 gradient-primary" />}
        <SafeImage src={store.cover_url} alt="" className="w-full h-full object-cover" fallback={null} />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/20 to-transparent" />
        
        {/* Top actions */}
        <div className="absolute top-10 right-4 z-20">
          <button onClick={() => setSubScreen('none')} className="w-10 h-10 bg-black/20 backdrop-blur-md rounded-full flex items-center justify-center text-white hover:bg-black/30 transition-colors shadow-sm hover:shadow-md">
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
        <div className="absolute top-10 left-4 z-20 flex gap-2">
          <button onClick={() => setReportModal({ isOpen: true, targetType: 'store', targetId: store.id, targetName: store.name })} className="w-10 h-10 bg-black/20 backdrop-blur-md rounded-full flex items-center justify-center text-white hover:bg-black/30 transition-colors shadow-sm hover:shadow-md" aria-label="إبلاغ"><Flag className="w-5 h-5" /></button>
          <button onClick={() => { if (store) { setShareTarget({ type: 'store', id: store.id, name: store.name, description: store.description, storeName: store.name, imageUrl: store.logo_url || store.cover_url }); setShowShareSheet(true); } }} className="w-10 h-10 bg-black/20 backdrop-blur-md rounded-full flex items-center justify-center text-white hover:bg-black/30 transition-colors shadow-sm hover:shadow-md"><Share2 className="w-5 h-5" /></button>
        </div>

        {/* Bottom stats on cover */}
        <div className="absolute bottom-4 left-4 right-4 z-10 flex items-center gap-3">
          <div className="flex items-center gap-1.5 bg-black/20 backdrop-blur-md rounded-lg px-2.5 py-1.5">
            <Users className="w-3.5 h-3.5 text-white/90" />
            <span className="text-white text-[11px] font-bold">{followersCount.toLocaleString('ar-SY')}</span>
          </div>
          <div className="flex items-center gap-1.5 bg-black/20 backdrop-blur-md rounded-lg px-2.5 py-1.5">
            <ShoppingBag className="w-3.5 h-3.5 text-white/90" />
            <span className="text-white text-[11px] font-bold">{products.length}</span>
          </div>
          <div className="flex items-center gap-1.5 bg-black/20 backdrop-blur-md rounded-lg px-2.5 py-1.5">
            <Gift className="w-3.5 h-3.5 text-white/90" />
            <span className="text-white text-[11px] font-bold">{offers.length}</span>
          </div>
        </div>
      </div>

      {/* Store Info Card */}
      <div className="px-4 -mt-12 relative z-10">
        <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] shadow-lg shadow-black/5 dark:shadow-black/20">
          <div className="px-5 pb-5">
            {/* Logo */}
            <div className="-mt-8 mb-3 relative z-10 flex items-end justify-between">
              <div style={theme.color ? { boxShadow: `0 4px 14px ${theme.color.shadowLight}` } : { boxShadow: '0 4px 14px rgba(16, 185, 129, 0.2)' }}>
                <StoreLogo src={store.logo_url} name={store.name} size="lg" className="border-4 border-white dark:border-gray-800 shadow-lg" />
              </div>
              {!isStoreOwner && (
                <button
                  onClick={handleFollow}
                  className={`flex items-center gap-1.5 px-6 py-3 rounded-xl text-sm font-bold transition-all active:scale-[0.98] ${
                    isFollowing
                      ? 'bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-secondary)]'
                      : theme.hasTheme ? 'text-white shadow-md' : 'gradient-primary text-white shadow-md'
                  }`}
                  style={!isFollowing && theme.hasTheme ? theme.gradientStyleSm : undefined}
                >
                  <Users className="w-4 h-4" />
                  {isFollowing ? 'إلغاء المتابعة' : 'متابعة'}
                </button>
              )}
            </div>

            {/* Name + Badges */}
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <h2 className="text-2xl font-black text-[var(--color-text)]">{store.name}</h2>
              {isVerified && (
                <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 text-[10px] font-black px-2.5 py-1 rounded-full shadow-sm">
                  <ShieldCheck className="w-3.5 h-3.5" />متجر موثق
                </span>
              )}
              {store.is_featured && (
                <span className="inline-flex items-center gap-1 bg-gradient-to-r from-amber-400 to-orange-400 text-white text-[9px] font-black px-2 py-0.5 rounded-full shadow-sm">
                  <Star className="w-3 h-3 fill-white" />مميز
                </span>
              )}
            </div>

            {/* Description */}
            <p className="text-sm text-gray-600 dark:text-gray-400 text-center line-clamp-3 leading-relaxed mt-1">{store.description || 'لا يوجد وصف بعد'}</p>

            {/* Location */}
            {(store.governorate || store.district || store.location) && (
              <div className="flex items-center gap-1.5 mt-2">
                <MapPin className="w-3.5 h-3.5 text-emerald-500" style={theme.color ? { color: theme.color.solid } : undefined} />
                <span className="text-[13px] text-[var(--color-text-secondary)]">
                  {store.location || [store.governorate, store.city, store.district].filter(Boolean).join(' - ')}
                </span>
              </div>
            )}

            {/* Category + Date */}
            <div className="flex items-center gap-3 mt-2.5 flex-wrap">
              {store.category && (
                <span
                  className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-lg"
                  style={theme.color ? { background: theme.color.solidLight + '18', color: theme.color.solidLight } : undefined}
                >
                  <Sparkles className="w-3 h-3" />{store.category}
                </span>
              )}
              <span className="inline-flex items-center gap-1 text-[var(--color-text-tertiary)] text-[10px]">
                <Calendar className="w-3 h-3" />
                انضم {new Date(store.created_at).toLocaleDateString('ar-SY', { month: 'long', year: 'numeric' })}
              </span>
            </div>

            {/* Action Buttons (for non-owners) */}
            {!isStoreOwner && (
              <div className="flex gap-2 mt-4">
                {chatAvailable ? (
                  <button
                    onClick={() => { if (!user) { toast.error('يجب تسجيل الدخول أولاً'); return; } setShowChat(true); }}
                    className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-[14px] transition-all active:scale-[0.98] ${
                      theme.hasTheme ? 'text-white shadow-lg' : 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400'
                    }`}
                    style={theme.hasTheme ? { ...theme.gradientStyle } : undefined}
                  >
                    <MessageCircle className="w-4 h-4" />
                    تواصل مع المتجر
                  </button>
                ) : (
                  <div className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-medium text-[13px] bg-[var(--color-bg)] text-[var(--color-text-tertiary)] border border-[var(--color-border)]">
                    <ShieldCheck className="w-4 h-4" />
                    {isVerified ? 'المحادثة غير مفعّلة لهذا المتجر' : 'المتجر غير موثق - المحادثة غير متاحة'}
                  </div>
                )}
              </div>
            )}

            {/* Owner banner */}
            {isStoreOwner && (
              <div
                className="mt-3 rounded-xl p-3 border"
                style={theme.color ? { background: `linear-gradient(to left, ${theme.color.lightFrom}, ${theme.color.lightTo})`, borderColor: theme.color.solidLight + '40' } : undefined}
              >
                <p className="text-[12px] font-bold flex items-center gap-1.5" style={theme.color ? { color: theme.color.solid } : { color: '#047857' }}>
                  <Eye className="w-3.5 h-3.5" />
                  أنت صاحب هذا المتجر — هذه هي الصفحة التي يراها الزوار
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="px-4 mt-4 space-y-4">
        {/* Tabs */}
        <div className="flex justify-center gap-2 mb-6 px-4">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-6 py-2.5 rounded-full text-sm font-medium whitespace-nowrap transition-all duration-200 flex-shrink-0 ${
                  activeTab === tab.id
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
                style={
                  activeTab === tab.id
                    ? (theme.color ? { background: theme.themeBg, boxShadow: theme.themeShadowSm } : { boxShadow: '0 2px 8px rgba(16, 185, 129, 0.2)' })
                    : undefined
                }
              >
                {tab.icon}
                <span>{tab.label}</span>
                {tab.count !== undefined && tab.count > 0 && (
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${activeTab === tab.id ? 'bg-white/20' : 'bg-[var(--color-bg)] text-[var(--color-text-tertiary)]'}`}>{tab.count}</span>
                )}
              </button>
            ))}
        </div>

        {/* Search & Sort */}
        {(activeTab === 'products' || activeTab === 'featured') && (
          <div className="flex gap-2">
            <div className="flex-1">
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ابحث في المتجر..."
                icon={<Search className="w-4 h-4" />}
              />
            </div>
            <div className="relative">
              <button
                onClick={() => setShowSortMenu(!showSortMenu)}
                className="w-11 h-11 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl flex items-center justify-center text-[var(--color-text-secondary)] hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors"
              >
                <SlidersHorizontal className="w-4 h-4" />
              </button>
              {showSortMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowSortMenu(false)} />
                  <div className="absolute left-0 top-12 z-20 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl shadow-lg overflow-hidden min-w-[150px] animate-[fadeIn_150ms_ease-out]">
                    {sortOptions.map((opt) => (
                      <button
                        key={opt.id}
                        onClick={() => { setSortOption(opt.id); setShowSortMenu(false); }}
                        className={`w-full text-right px-4 py-2.5 text-[12px] font-semibold transition-colors ${sortOption !== opt.id ? 'text-[var(--color-text)] hover:bg-emerald-50/50 dark:hover:bg-emerald-900/10' : ''}`}
                        style={sortOption === opt.id && theme.color ? { background: theme.color.solidLight + '18', color: theme.color.solid } : undefined}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Products Tab */}
        {activeTab === 'products' && (
          <section>
            {filteredProducts.length === 0 ? (
              <div className="bg-[var(--color-surface)] rounded-2xl p-8 text-center border border-[var(--color-border)] shadow-sm">
                <div className="w-16 h-16 bg-emerald-50/60 dark:bg-emerald-900/20 rounded-2xl flex items-center justify-center mx-auto mb-3"><Package className="w-8 h-8 text-emerald-300 dark:text-emerald-700" /></div>
                <p className="text-[var(--color-text)] font-bold text-[15px]">{searchQuery ? 'لا توجد نتائج' : 'لا توجد منتجات حالياً'}</p>
                <p className="text-[var(--color-text-tertiary)] text-[12px] mt-1">{searchQuery ? 'جرب البحث بكلمات أخرى' : 'سيتم إضافة منتجات قريباً'}</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {filteredProducts.map((product) => <ProductCard key={product.id} product={product} />)}
              </div>
            )}
          </section>
        )}

        {/* Featured Tab */}
        {activeTab === 'featured' && (
          <section>
            {featuredProducts.length === 0 ? (
              <div className="bg-[var(--color-surface)] rounded-2xl p-8 text-center border border-[var(--color-border)] shadow-sm">
                <div className="w-16 h-16 bg-amber-50/60 dark:bg-amber-900/20 rounded-2xl flex items-center justify-center mx-auto mb-3"><Star className="w-8 h-8 text-amber-300 dark:text-amber-700" /></div>
                <p className="text-[var(--color-text)] font-bold text-[15px]">لا توجد منتجات مميزة</p>
                <p className="text-[var(--color-text-tertiary)] text-[12px] mt-1">المنتجات المميزة ستظهر هنا</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {featuredProducts.map((product) => <ProductCard key={product.id} product={product} />)}
              </div>
            )}
          </section>
        )}

        {/* Offers Tab */}
        {activeTab === 'offers' && (
          <section>
            {storeOffers.length === 0 ? (
              <div className="bg-[var(--color-surface)] rounded-2xl p-8 text-center border border-[var(--color-border)] shadow-sm">
                <div className="w-16 h-16 bg-amber-50/60 dark:bg-amber-900/20 rounded-2xl flex items-center justify-center mx-auto mb-3"><Gift className="w-8 h-8 text-amber-300 dark:text-amber-700" /></div>
                <p className="text-[var(--color-text)] font-bold text-[15px]">لا توجد عروض</p>
                <p className="text-[var(--color-text-tertiary)] text-[12px] mt-1">العروض ستظهر هنا عند إضافتها</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {storeOffers.map((offer) => <OfferCard key={offer.id} offer={offer} />)}
              </div>
            )}
          </section>
        )}

        {/* Contests Tab */}
        {activeTab === 'contests' && (
          <section>
            {storeContests.length === 0 ? (
              <div className="bg-[var(--color-surface)] rounded-2xl p-8 text-center border border-[var(--color-border)] shadow-sm">
                <div className="w-16 h-16 bg-rose-50/60 dark:bg-rose-900/20 rounded-2xl flex items-center justify-center mx-auto mb-3"><Trophy className="w-8 h-8 text-rose-300 dark:text-rose-700" /></div>
                <p className="text-[var(--color-text)] font-bold text-[15px]">لا توجد مسابقات</p>
                <p className="text-[var(--color-text-tertiary)] text-[12px] mt-1">المسابقات ستظهر هنا</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {storeContests.map((contest) => <OfferCard key={contest.id} offer={contest} />)}
              </div>
            )}
          </section>
        )}

        {/* Info Tab */}
        {activeTab === 'info' && (
          <section>
            <div className="bg-white dark:bg-gray-800/60 rounded-2xl shadow-sm p-6 mx-4 mb-6 space-y-4">
              <div>
                <h3 className="text-[13px] font-bold text-emerald-600 dark:text-emerald-400 mb-3 flex items-center gap-2" style={theme.color ? { color: theme.color.solid } : undefined}><Sparkles className="w-4 h-4" />عن المتجر</h3>
                <div className="space-y-0">
                  <div className="flex items-center gap-3 py-2.5 border-b border-gray-100 dark:border-gray-700 last:border-0">
                    <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center text-emerald-500" style={theme.color ? { background: theme.color.solidLight + '18', color: theme.color.solid } : undefined}><ShoppingBag className="w-4 h-4" /></div>
                    <div><p className="text-[12px] font-bold text-[var(--color-text)]">{store.name}</p><p className="text-[10px] text-[var(--color-text-tertiary)]">اسم المتجر</p></div>
                  </div>
                  <div className="flex items-center gap-3 py-2.5 border-b border-gray-100 dark:border-gray-700 last:border-0">
                    <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center text-emerald-500" style={theme.color ? { background: theme.color.solidLight + '18', color: theme.color.solid } : undefined}><Package className="w-4 h-4" /></div>
                    <div><p className="text-[12px] font-bold text-[var(--color-text)]">{products.length} منتج</p><p className="text-[10px] text-[var(--color-text-tertiary)]">إجمالي المنتجات المنشورة</p></div>
                  </div>
                  <div className="flex items-center gap-3 py-2.5 border-b border-gray-100 dark:border-gray-700 last:border-0">
                    <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center text-emerald-500" style={theme.color ? { background: theme.color.solidLight + '18', color: theme.color.solid } : undefined}><Users className="w-4 h-4" /></div>
                    <div><p className="text-[12px] font-bold text-[var(--color-text)]">{followersCount.toLocaleString('ar-SY')} متابع</p><p className="text-[10px] text-[var(--color-text-tertiary)]">عدد المتابعين</p></div>
                  </div>
                  <div className="flex items-center gap-3 py-2.5 border-b border-gray-100 dark:border-gray-700 last:border-0">
                    <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center text-emerald-500" style={theme.color ? { background: theme.color.solidLight + '18', color: theme.color.solid } : undefined}><Eye className="w-4 h-4" /></div>
                    <div><p className="text-[12px] font-bold text-[var(--color-text)]">{totalViews.toLocaleString('ar-SY')} مشاهدة</p><p className="text-[10px] text-[var(--color-text-tertiary)]">إجمالي مشاهدات المنتجات</p></div>
                  </div>
                  <div className="flex items-center gap-3 py-2.5 border-b border-gray-100 dark:border-gray-700 last:border-0">
                    <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center text-emerald-500" style={theme.color ? { background: theme.color.solidLight + '18', color: theme.color.solid } : undefined}><Gift className="w-4 h-4" /></div>
                    <div><p className="text-[12px] font-bold text-[var(--color-text)]">{offers.length} عرض ومسابقة</p><p className="text-[10px] text-[var(--color-text-tertiary)]">العروض والمسابقات النشطة</p></div>
                  </div>
                  {store.category && (
                    <div className="flex items-center gap-3 py-2.5 border-b border-gray-100 dark:border-gray-700 last:border-0">
                      <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center text-emerald-500" style={theme.color ? { background: theme.color.solidLight + '18', color: theme.color.solid } : undefined}><Sparkles className="w-4 h-4" /></div>
                      <div><p className="text-[12px] font-bold text-[var(--color-text)]">{store.category}</p><p className="text-[10px] text-[var(--color-text-tertiary)]">تصنيف المتجر</p></div>
                    </div>
                  )}
                  <div className="flex items-center gap-3 py-2.5 border-b border-gray-100 dark:border-gray-700 last:border-0">
                    <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center text-emerald-500" style={theme.color ? { background: theme.color.solidLight + '18', color: theme.color.solid } : undefined}><Calendar className="w-4 h-4" /></div>
                    <div><p className="text-[12px] font-bold text-[var(--color-text)]">{new Date(store.created_at).toLocaleDateString('ar-SY')}</p><p className="text-[10px] text-[var(--color-text-tertiary)]">تاريخ إنشاء المتجر</p></div>
                  </div>
                  {(store.location || store.governorate || store.district) && (
                    <div className="flex items-center gap-3 py-2.5 border-b border-gray-100 dark:border-gray-700 last:border-0">
                      <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center text-emerald-500" style={theme.color ? { background: theme.color.solidLight + '18', color: theme.color.solid } : undefined}><MapPin className="w-4 h-4" /></div>
                      <div><p className="text-[12px] font-bold text-[var(--color-text)]">{store.location || [store.governorate, store.city, store.district].filter(Boolean).join(' - ')}</p><p className="text-[10px] text-[var(--color-text-tertiary)]">الموقع</p></div>
                    </div>
                  )}
                </div>
              </div>
              {store.description && (
                <div>
                  <h3 className="text-[13px] font-bold text-emerald-600 dark:text-emerald-400 mb-2 flex items-center gap-2" style={theme.color ? { color: theme.color.solid } : undefined}>وصف المتجر</h3>
                  <p className="text-[13px] text-[var(--color-text-secondary)] leading-relaxed p-3 bg-[var(--color-bg)] rounded-xl">{store.description}</p>
                </div>
              )}
              {isVerified && (
                <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-amber-50 to-amber-50/50 dark:from-amber-900/20 dark:to-amber-900/10 rounded-xl border border-amber-200/40 dark:border-amber-800/20">
                  <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center"><ShieldCheck className="w-5 h-5 text-amber-500" /></div>
                  <div><p className="text-[12px] font-bold text-amber-700 dark:text-amber-300">متجر موثق</p><p className="text-[10px] text-amber-600/70 dark:text-amber-400/70">هذا المتجر موثق من إدارة سوق شامل</p></div>
                </div>
              )}
            </div>
          </section>
        )}
      </div>

      {/* Chat Modal */}
      {store && user && user.id !== store.user_id && chatAvailable && (
        <ChatModal isOpen={showChat} onClose={() => setShowChat(false)} currentUserId={user.id} storeOwnerId={store.user_id} storeName={store.name} storeId={store.id} storeLogoUrl={store.logo_url} />
      )}

      {/* Report Modal */}
      {reportModal.isOpen && (
        <ReportModal isOpen={reportModal.isOpen} onClose={() => setReportModal(prev => ({ ...prev, isOpen: false }))} targetType={reportModal.targetType} targetId={reportModal.targetId} targetName={reportModal.targetName} />
      )}

      {/* Share Sheet */}
      {shareTarget && (
        <ShareSheet isOpen={showShareSheet} onClose={() => { setShowShareSheet(false); setShareTarget(null); }} itemType={shareTarget.type} itemId={shareTarget.id} itemName={shareTarget.name} itemDescription={shareTarget.description} itemPrice={shareTarget.price} storeName={shareTarget.storeName} imageUrl={shareTarget.imageUrl} />
      )}
    </div>
  );
};

