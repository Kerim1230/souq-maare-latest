'use client';
import React, { useEffect, useState, useMemo, useRef } from 'react';
import { Heart, Store as StoreIcon, Trash2, Loader2, Verified, ImageIcon, Users, Bell, BellOff, ArrowUpDown, AlertTriangle, X } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useAppStore } from '@/store/appStore';
import { SafeImage, StoreLogo } from '@/components/market/SafeImage';
import { useNotificationStore } from '@/store/notificationStore';
import { isHydrated } from '@/lib/hydration';
import type { Favorite } from '@/store/appStore';
import toast from 'react-hot-toast';
import { apiDelete } from '@/lib/fetchApi';

type Tab = 'favorites' | 'following';
type SortOption = 'newest' | 'name' | 'price-low' | 'price-high';

const sortLabels: Record<SortOption, string> = {
  newest: 'الأحدث',
  name: 'الاسم',
  'price-low': 'السعر: الأقل',
  'price-high': 'السعر: الأعلى',
};

export const FavoritesScreen: React.FC = () => {
  const user = useAuthStore(s => s.user);
  const favorites = useAppStore(s => s.favorites);
  const setFavorites = useAppStore(s => s.setFavorites);
  const removeFavorite = useAppStore(s => s.removeFavorite);
  const followedStores = useAppStore(s => s.followedStores);
  const removeFollowedStore = useAppStore(s => s.removeFollowedStore);
  const fetchFavorites = useAppStore(s => s.fetchFavorites);
  const fetchFollowedStores = useAppStore(s => s.fetchFollowedStores);
  const openProductDetail = useAppStore(s => s.openProductDetail);
  const setSelectedStoreId = useAppStore(s => s.setSelectedStoreId);
  const setSubScreen = useAppStore(s => s.setSubScreen);
  const notifications = useNotificationStore(s => s.notifications);
  const [tab, setTab] = useState<Tab>('favorites');
  const [removing, setRemoving] = useState<string | null>(null);
  const [unfollowing, setUnfollowing] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [showClearAll, setShowClearAll] = useState(false);
  const [clearingAll, setClearingAll] = useState(false);
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [forceShow, setForceShow] = useState(false);

  // Consumer-only pattern: Only fetch if global init has NOT loaded data yet.
  const fallbackFetchDone = useRef(false);
  useEffect(() => {
    if (fallbackFetchDone.current || !user) return;
    fallbackFetchDone.current = true;
    if (!isHydrated('favorites') || !isHydrated('followedStores')) {
      Promise.allSettled([
        fetchFavorites(user.id),
        fetchFollowedStores(user.id),
      ]);
    }
  }, [user, fetchFavorites, fetchFollowedStores]);

  // Timeout fallback: show content after 5 seconds even if hydration hasn't completed
  useEffect(() => {
    const timer = setTimeout(() => setForceShow(true), 5000);
    return () => clearTimeout(timer);
  }, []);

  // Close sort menu when clicking outside
  useEffect(() => {
    if (!showSortMenu) return;
    const handler = () => setShowSortMenu(false);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [showSortMenu]);

  const handleRemoveFavorite = async (fav: Favorite) => {
    setRemoving(fav.id);
    try {
      await apiDelete(`/api/favorites?favoriteId=${fav.id}`);
      removeFavorite(fav.id);
      toast.success('تم الإزالة من المفضلة');
    } catch {
      toast.error('حدث خطأ أثناء الإزالة');
    } finally {
      setRemoving(null);
    }
  };

  const handleClearAll = async () => {
    if (!user) return;
    setClearingAll(true);
    try {
      const { error } = await apiDelete(`/api/favorites?deleteAll=true`);
      if (error) {
        toast.error('حدث خطأ أثناء الحذف');
        return;
      }
      setFavorites([]);
      setShowClearAll(false);
      toast.success('تم حذف جميع المفضلة');
    } catch {
      toast.error('حدث خطأ أثناء الحذف');
    } finally {
      setClearingAll(false);
    }
  };

  const handleUnfollow = async (storeId: string) => {
    if (!user) return;
    setUnfollowing(storeId);
    try {
      await apiDelete(`/api/stores/follow?userId=${user.id}&storeId=${storeId}`);
      removeFollowedStore(storeId);
      toast.success('تم إلغاء المتابعة');
    } catch {
      toast.error('حدث خطأ أثناء إلغاء المتابعة');
    } finally {
      setUnfollowing(null);
    }
  };

  const handleOpenStore = (storeId: string) => {
    setSelectedStoreId(storeId);
    setSubScreen('store-detail');
  };

  const handleOpenProduct = (fav: Favorite) => {
    if (fav.product_id) {
      openProductDetail(fav.product_id);
    }
  };

  const productFavs = favorites.filter(f => f.product_id && f.product);

  const sortedFavorites = useMemo(() => {
    const sorted = [...productFavs];
    switch (sortBy) {
      case 'newest':
        sorted.sort((a, b) => b.id.localeCompare(a.id));
        break;
      case 'name':
        sorted.sort((a, b) => (a.product?.name || '').localeCompare(b.product?.name || 'ar'));
        break;
      case 'price-low':
        sorted.sort((a, b) => (a.product?.price ?? 0) - (b.product?.price ?? 0));
        break;
      case 'price-high':
        sorted.sort((a, b) => (b.product?.price ?? 0) - (a.product?.price ?? 0));
        break;
    }
    return sorted;
  }, [productFavs, sortBy]);

  // Get store notifications for followed stores
  const storeNotifications = useMemo(() => {
    if (!user) return [];
    return notifications
      .filter(n => n.userId === user.id && n.type === 'store')
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .filter(n => {
        const storeId = n.data?.storeId || n.deepLink?.replace('/store/', '');
        return storeId && followedStores.some(s => s.id === storeId);
      });
  }, [user, notifications, followedStores]);

  // Hydration-aware loading: show skeleton until global init has hydrated data.
  if (!isHydrated('favorites') && !forceShow) {
    return (
      <div className="bg-[var(--color-bg)] min-h-[100dvh] pb-20">
        <div className="gradient-dark px-3 pt-8 pb-6 relative overflow-hidden">
          <div className="absolute top-[-30px] right-[-20px] w-[140px] h-[140px] rounded-full bg-rose-600/15 blur-[50px]" />
          <div className="relative z-10 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/10 animate-pulse" />
            <div className="space-y-2">
              <div className="h-5 w-20 bg-white/10 rounded animate-pulse" />
              <div className="h-3 w-32 bg-white/10 rounded animate-pulse" />
            </div>
          </div>
        </div>
        <div className="px-3 -mt-4 space-y-3">
          <div className="flex gap-3">
            <div className="flex-1 h-11 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse" />
            <div className="flex-1 h-11 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse" />
          </div>
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-[var(--color-surface)] rounded-2xl p-2.5 border border-[var(--color-border)] flex items-center gap-3 animate-pulse">
              <div className="w-14 h-14 bg-slate-100 dark:bg-slate-800 rounded-xl" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-3/4 bg-slate-100 dark:bg-slate-800 rounded" />
                <div className="h-3 w-1/2 bg-slate-100 dark:bg-slate-800 rounded" />
                <div className="h-4 w-1/3 bg-slate-100 dark:bg-slate-800 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[var(--color-bg)] min-h-[100dvh] pb-20">
      {/* Header */}
      <div className="gradient-dark px-3 pt-8 pb-6 relative overflow-hidden">
        <div className="absolute top-[-30px] right-[-20px] w-[140px] h-[140px] rounded-full bg-rose-600/15 blur-[50px]" />
        <div className="absolute bottom-[-20px] left-[-10px] w-[100px] h-[100px] rounded-full bg-teal-600/10 blur-[40px]" />
        <div className="relative z-10 flex items-center gap-3">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shadow-md ${
            tab === 'favorites'
              ? 'gradient-rose shadow-rose-500/20'
              : 'bg-gradient-to-br from-teal-500 to-emerald-500 shadow-emerald-500/20'
          }`}>
            {tab === 'favorites'
              ? <Heart className="w-4 h-4 text-white" />
              : <Users className="w-4 h-4 text-white" />
            }
          </div>
          <div>
            <h1 className="text-white text-lg font-bold">
              {tab === 'favorites' ? 'المفضلة' : 'المتابعة'}
            </h1>
            <p className="text-teal-300/70 dark:text-teal-600/50 text-[11px] mt-0.5">
              {tab === 'favorites'
                ? `${productFavs.length} منتج محفوظ`
                : `${followedStores.length} متجر متابع`
              }
            </p>
          </div>
        </div>
      </div>

      <div className="px-3 -mt-4 space-y-3">
        {/* Tab Switcher — visible background container with clear tabs */}
        <div className="bg-[var(--color-surface)] rounded-xl p-1.5 border border-[var(--color-border)] shadow-sm">
          <div className="flex gap-1.5">
            <button
              onClick={() => setTab('favorites')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all duration-150 ${
                tab === 'favorites'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              <Heart className="w-5 h-5 flex-shrink-0" />
              <span>المفضلة</span>
              {productFavs.length > 0 && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                  tab === 'favorites' ? 'bg-white/20' : 'bg-rose-50 dark:bg-rose-900/20 text-rose-500 dark:text-rose-400'
                }`}>
                  {productFavs.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setTab('following')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all duration-150 ${
                tab === 'following'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              <Users className="w-5 h-5 flex-shrink-0" />
              <span>المتابَعة</span>
              {followedStores.length > 0 && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                  tab === 'following' ? 'bg-white/20' : 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-500'
                }`}>
                  {followedStores.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* ===== Favorites Tab (Products) ===== */}
        {tab === 'favorites' && (
          <div className="space-y-3">
            {/* Sort & Clear All Bar */}
            {productFavs.length > 0 && (
              <div className="flex items-center justify-between gap-2">
                {/* Sort Button */}
                <div className="relative">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowSortMenu(!showSortMenu);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors font-bold"
                  >
                    <ArrowUpDown className="w-3.5 h-3.5" />
                    {sortLabels[sortBy]}
                  </button>
                  {showSortMenu && (
                    <div className="absolute top-full left-0 mt-1 bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] shadow-lg z-30 overflow-hidden min-w-[160px]">
                      {(Object.keys(sortLabels) as SortOption[]).map((option) => (
                        <button
                          key={option}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSortBy(option);
                            setShowSortMenu(false);
                          }}
                          className={`w-full px-3 py-2.5 text-[12px] text-right font-medium transition-colors ${
                            sortBy === option
                              ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20'
                              : 'text-slate-500 dark:text-slate-400 hover:bg-emerald-50/50 dark:hover:bg-emerald-900/10'
                          }`}
                        >
                          {sortLabels[option]}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Clear All Button */}
                <button
                  onClick={() => setShowClearAll(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors font-bold"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  حذف الكل
                </button>
              </div>
            )}

            {productFavs.length === 0 ? (
              <div className="bg-[var(--color-surface)] rounded-2xl p-8 text-center border border-[var(--color-border)] shadow-sm">
                <div className="w-16 h-16 bg-rose-50/60 dark:bg-rose-900/20 rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <Heart className="w-8 h-8 text-rose-300" />
                </div>
                <p className="text-[var(--color-text)] font-medium text-base">لا توجد منتجات مفضلة</p>
                <p className="text-sm text-gray-500 mt-1">اضغط على أيقونة القلب في المنتجات لحفظها هنا</p>
              </div>
            ) : sortedFavorites.map((fav) => (
              <div
                key={fav.id}
                onClick={() => handleOpenProduct(fav)}
                className="bg-[var(--color-surface)] rounded-2xl flex items-center gap-3 p-2.5 border border-[var(--color-border)] shadow-sm cursor-pointer hover:shadow-md transition-shadow active:scale-[0.98]"
              >
                {/* Product image — smaller for mobile */}
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-emerald-50/50 to-teal-50/50 overflow-hidden flex-shrink-0">
                  <SafeImage
                    src={fav.product?.image_url}
                    alt={fav.product?.name || ''}
                    className="w-full h-full object-cover"
                    widthHint={120}
                    fallback={<div className="w-full h-full flex items-center justify-center"><ImageIcon className="w-5 h-5 text-emerald-300" /></div>}
                  />
                </div>
                {/* Product info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--color-text)] line-clamp-1">{fav.product?.name}</p>
                  <p className="text-sm font-bold text-emerald-400 mt-0.5">{fav.product?.price.toLocaleString('ar-SY')} ل.س</p>
                  {fav.product?.store_name && (
                    <p className="text-[11px] text-gray-500 mt-0.5 flex items-center gap-1">
                      <StoreIcon className="w-2.5 h-2.5" />
                      {fav.product.store_name}
                    </p>
                  )}
                </div>
                {/* Delete button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveFavorite(fav);
                  }}
                  disabled={removing === fav.id}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-red-600/20 text-red-400 hover:bg-red-600/30 flex-shrink-0 transition-colors"
                >
                  {removing === fav.id
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : <Trash2 className="w-3.5 h-3.5" />
                  }
                </button>
              </div>
            ))}
          </div>
        )}

        {/* ===== Following Tab (Stores + Notifications) ===== */}
        {tab === 'following' && (
          <div className="space-y-3">
            {/* Store Notifications Section */}
            {storeNotifications.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Bell className="w-4 h-4 text-emerald-500" />
                  <h3 className="text-sm font-bold text-[var(--color-text)]">إشعارات المتاجر المتابعة</h3>
                  <span className="text-[10px] bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 font-bold px-2 py-0.5 rounded-full">
                    {storeNotifications.length}
                  </span>
                </div>
                <div className="space-y-2">
                  {storeNotifications.slice(0, 5).map((notif) => {
                    const storeId = notif.data?.storeId || notif.deepLink?.replace('/store/', '');
                    const store = storeId ? followedStores.find(s => s.id === storeId) : null;
                    return (
                      <div
                        key={notif.id}
                        className={`bg-[var(--color-surface)] rounded-xl p-3 border border-[var(--color-border)] shadow-sm ${
                          !notif.isRead ? 'border-r-[3px] border-r-emerald-400' : ''
                        }`}
                      >
                        <div className="flex items-start gap-2.5">
                          {store && (
                            <StoreLogo src={store.logo_url} name={store.name} size="xs" className="flex-shrink-0 mt-0.5" />
                          )}
                          <div className="flex-1 min-w-0">
                            {store && (
                              <p className="text-[10px] text-emerald-600 font-bold">{store.name}</p>
                            )}
                            <p className="text-[12px] font-bold text-[var(--color-text)] mt-0.5">{notif.title}</p>
                            <p className="text-[11px] text-[var(--color-text-tertiary)] mt-0.5 line-clamp-2">{notif.body}</p>
                            <p className="text-[10px] text-[var(--color-text-tertiary)] mt-1">
                              {new Date(notif.createdAt).toLocaleDateString('ar-SY', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Followed Stores Section */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Users className="w-4 h-4 text-emerald-500" />
                <h3 className="text-sm font-bold text-[var(--color-text)]">المتاجر المتابعة</h3>
              </div>
              {followedStores.length === 0 ? (
                <div className="bg-[var(--color-surface)] rounded-2xl p-8 text-center border border-[var(--color-border)] shadow-sm">
                  <div className="w-16 h-16 bg-emerald-50/60 dark:bg-emerald-900/20 rounded-2xl flex items-center justify-center mx-auto mb-3">
                    <Users className="w-8 h-8 text-emerald-300" />
                  </div>
                  <p className="text-[var(--color-text)] font-medium text-base">لا توجد متاجر متابعة</p>
                  <p className="text-sm text-gray-500 mt-1">تابع المتاجر لتصلك إشعاراتها الجديدة</p>
                </div>
              ) : followedStores.map((store) => (
                <div
                  key={store.id}
                  className="bg-[var(--color-surface)] rounded-2xl p-2.5 border border-[var(--color-border)] shadow-sm mb-2.5"
                >
                  <div className="flex items-center gap-3">
                    {/* Circular store logo */}
                    <div
                      onClick={() => handleOpenStore(store.id)}
                      className="cursor-pointer flex-shrink-0"
                    >
                      <StoreLogo src={store.logo_url} name={store.name || ''} size="sm" className="!rounded-full border-2 border-emerald-500/20" />
                    </div>
                    {/* Store info */}
                    <div
                      onClick={() => handleOpenStore(store.id)}
                      className="flex-1 min-w-0 cursor-pointer"
                    >
                      <div className="flex items-center gap-1">
                        <p className="text-sm font-medium text-[var(--color-text)] line-clamp-1">{store.name}</p>
                        {store.is_verified && <Verified className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />}
                      </div>
                      <p className="text-[11px] text-gray-500 line-clamp-1 mt-0.5">{store.category || store.description || 'متجر إلكتروني'}</p>
                    </div>
                    {/* Action buttons */}
                    <div className="flex flex-col gap-1.5 flex-shrink-0">
                      <button
                        onClick={() => handleOpenStore(store.id)}
                        className="px-3 py-1.5 text-[11px] rounded-lg bg-emerald-600/20 text-emerald-400 font-bold hover:bg-emerald-600/30 transition-colors"
                      >
                        عرض المتجر
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleUnfollow(store.id);
                        }}
                        disabled={unfollowing === store.id}
                        className="px-3 py-1.5 text-[11px] rounded-lg bg-red-600/20 text-red-400 font-bold hover:bg-red-600/30 transition-colors flex items-center justify-center gap-1"
                      >
                        {unfollowing === store.id
                          ? <Loader2 className="w-3 h-3 animate-spin" />
                          : 'إلغاء المتابعة'
                        }
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* No notifications hint */}
            {storeNotifications.length === 0 && followedStores.length > 0 && (
              <div className="bg-[var(--color-surface)] rounded-xl p-4 text-center border border-[var(--color-border)] shadow-sm">
                <div className="flex items-center justify-center gap-2 text-[var(--color-text-tertiary)]">
                  <BellOff className="w-4 h-4" />
                  <p className="text-[12px] font-medium">لا توجد إشعارات جديدة من المتاجر المتابعة</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ===== Clear All Confirmation Modal ===== */}
      {showClearAll && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowClearAll(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            className="relative w-full max-w-sm bg-[var(--color-surface)] rounded-2xl shadow-xl overflow-hidden z-10"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-rose-50 dark:bg-rose-900/20 flex items-center justify-center">
                  <AlertTriangle className="w-4 h-4 text-rose-500" />
                </div>
                <h3 className="text-[15px] font-bold text-[var(--color-text)]">تأكيد الحذف</h3>
              </div>
              <button
                onClick={() => setShowClearAll(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors"
              >
                <X className="w-4 h-4 text-[var(--color-text-tertiary)]" />
              </button>
            </div>
            {/* Body */}
            <div className="p-5">
              <p className="text-[13px] text-slate-500 dark:text-slate-400 leading-relaxed text-center">
                هل أنت متأكد من حذف جميع المنتجات من المفضلة؟
                <br />
                <span className="text-rose-500 font-bold">لا يمكن التراجع عن هذا الإجراء</span>
              </p>
              <div className="flex gap-2.5 mt-5">
                <button
                  onClick={() => setShowClearAll(false)}
                  className="flex-1 py-2.5 rounded-xl text-[13px] font-bold text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-700/50 border border-[var(--color-border)] transition-colors"
                >
                  إلغاء
                </button>
                <button
                  onClick={handleClearAll}
                  disabled={clearingAll}
                  className="flex-1 py-2.5 rounded-xl text-[13px] font-bold text-white bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 shadow-md shadow-rose-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {clearingAll ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      جارٍ الحذف...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      حذف الكل
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
