'use client';
import React, { useEffect, useState, useCallback } from 'react';
import {
  ArrowRight, Heart, Share2, MessageCircle, Store as StoreIcon, Eye, Clock,
  Loader2, ImageIcon, ShieldCheck, Flag
} from 'lucide-react';
import { SafeImage, StoreLogo } from '@/components/market/SafeImage';
import { CommentsSection } from '@/components/market/CommentsSection';
import { ChatModal } from '@/components/market/ChatModal';
import { ImageLightbox } from '@/components/market/ImageLightbox';
import { ShareSheet } from '@/components/market/ShareSheet';
import { ReportModal } from '@/components/admin/ReportModal';
import { useAuthStore } from '@/store/authStore';
import { useAppStore } from '@/store/appStore';
import type { Product } from '@/store/appStore';
import { useVerificationStore } from '@/store/verificationStore';
import { apiGet, apiPost, apiDelete } from '@/lib/fetchApi';
import { getTimeRemaining, getUrgencyColors } from '@/store/autoDeleteStore';
import toast from 'react-hot-toast';

interface ProductDetailData extends Product {
  store_name?: string;
  store_logo?: string;
  store_verified?: boolean;
  store_chat_enabled?: boolean;
  comments_count?: number;
}

export const ProductDetailScreen: React.FC = () => {
  const user = useAuthStore(s => s.user);
  const selectedProductId = useAppStore(s => s.selectedProductId);
  const goBack = useAppStore(s => s.goBack);
  const openStoreDetail = useAppStore(s => s.openStoreDetail);
  const favorites = useAppStore(s => s.favorites);
  const addFavorite = useAppStore(s => s.addFavorite);
  const removeFavorite = useAppStore(s => s.removeFavorite);
  const [product, setProduct] = useState<ProductDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [favLoading, setFavLoading] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showShareSheet, setShowShareSheet] = useState(false);
  const [showLightbox, setShowLightbox] = useState(false);
  const [reportModal, setReportModal] = useState<{ isOpen: boolean; targetType: 'product' | 'store' | 'offer'; targetId: string; targetName: string }>({ isOpen: false, targetType: 'product', targetId: '', targetName: '' });

  // Verification store — single source of truth for chat availability
  const loadStoreVerification = useVerificationStore(s => s.loadStoreVerification);
  const canStoreChat = useVerificationStore(s => s.canStoreChat);

  const loadProduct = useCallback(async (signal?: AbortSignal) => {
    if (!selectedProductId) return;
    setLoading(true);
    try {
      const { data, error } = await apiGet<{ product: ProductDetailData }>(`/api/product/${selectedProductId}`, { signal });
      if (error) throw new Error();
      setProduct(data?.product || null);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      toast.error('حدث خطأ في تحميل المنتج');
    } finally {
      setLoading(false);
    }
  }, [selectedProductId]);

  useEffect(() => {
    const controller = new AbortController();
    loadProduct(controller.signal);
    return () => controller.abort();
  }, [loadProduct]);

  // Load verification data for the store when product is loaded
  useEffect(() => {
    if (product?.store_id) {
      loadStoreVerification(product.store_id);
    }
  }, [product?.store_id, loadStoreVerification]);

  const isFav = product ? favorites.some(f => f.product_id === product.id) : false;

  const handleToggleFavorite = async () => {
    if (!user || !product) { toast.error('يجب تسجيل الدخول أولاً'); return; }
    setFavLoading(true);
    try {
      const existingFav = favorites.find(f => f.product_id === product.id);
      if (existingFav) {
        const { error: delError } = await apiDelete(`/api/favorites?favoriteId=${existingFav.id}`);
        if (delError) throw new Error();
        removeFavorite(existingFav.id);
        toast.success('تم الإزالة من المفضلة');
      } else {
        const { data: addData, error: addError } = await apiPost('/api/favorites', { userId: user.id, productId: product.id });
        if (addError) throw new Error();
        if (addData?.favorite) addFavorite(addData.favorite);
        toast.success('تمت الإضافة للمفضلة!');
      }
    } catch { toast.error('حدث خطأ'); }
    finally { setFavLoading(false); }
  };

  const handleGoToStore = () => {
    if (product?.store_id) {
      openStoreDetail(product.store_id);
    }
  };

  const handleShare = () => {
    if (!product) return;
    setShowShareSheet(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--color-bg)]">
        {/* Header skeleton */}
        <div className="h-12 bg-[var(--color-surface)] border-b border-[var(--color-border)]" />
        {/* Image skeleton */}
        <div className="w-full aspect-[4/3] bg-emerald-50 dark:bg-emerald-900/20 animate-pulse" />
        {/* Content skeleton */}
        <div className="px-4 py-4 space-y-3">
          <div className="h-6 w-3/4 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg animate-pulse" />
          <div className="h-8 w-1/3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg animate-pulse" />
          <div className="h-4 w-full bg-emerald-50 dark:bg-emerald-900/20 rounded-lg animate-pulse" />
          <div className="h-4 w-2/3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg animate-pulse" />
          <div className="h-20 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl animate-pulse mt-4" />
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-[var(--color-bg)] flex flex-col items-center justify-center">
        <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl flex items-center justify-center mb-4">
          <ImageIcon className="w-8 h-8 text-emerald-300" />
        </div>
        <p className="text-[var(--color-text-tertiary)] text-sm font-medium">لم يتم العثور على المنتج</p>
        <button onClick={goBack} className="mt-4 text-sm text-emerald-600 font-bold">العودة</button>
      </div>
    );
  }

  const timeInfo = getTimeRemaining(product.expires_at);
  const urgencyColors = getUrgencyColors(timeInfo.urgencyLevel);

  return (
    <div className="min-h-screen bg-[var(--color-bg)] pb-24">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-[var(--color-surface)]/80 backdrop-blur-lg border-b border-[var(--color-border)]/60">
        <div className="flex items-center justify-between px-4 py-3">
          <button
            onClick={goBack}
            className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/30 transition-colors"
          >
            <ArrowRight className="w-5 h-5" />
          </button>
          <h1 className="text-sm font-bold text-[var(--color-text)] line-clamp-1 flex-1 text-center px-4">{product.name}</h1>
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleShare}
              className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-900/30 transition-colors"
            >
              <Share2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setReportModal({ isOpen: true, targetType: 'product', targetId: product.id, targetName: product.name })}
              className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center text-rose-400 hover:bg-rose-50 dark:bg-rose-900/20 transition-colors"
            >
              <Flag className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Product Image */}
      <div className="relative">
        <div
          className="w-full aspect-[4/3] bg-gradient-to-br from-emerald-50/50 to-teal-50/50 overflow-hidden cursor-zoom-in"
          onClick={() => setShowLightbox(true)}
        >
          <SafeImage
            src={product.image_url}
            alt={product.name}
            className="w-full h-full object-cover"
            fallback={
              <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                <ImageIcon className="w-12 h-12 text-emerald-200" />
                <span className="text-emerald-300 dark:text-emerald-600 text-xs">لا توجد صورة</span>
              </div>
            }
          />
        </div>
        {/* Status badges */}
        <div className="absolute top-3 right-3 flex gap-1.5">
          {product.is_new && (
            <span className="gradient-primary text-white text-xs font-bold px-3 py-1 rounded-full shadow-md">جديد</span>
          )}
          {product.is_featured && (
            <span className="bg-gradient-to-r from-amber-400 to-orange-400 text-white text-xs font-bold px-3 py-1 rounded-full shadow-md">مميز</span>
          )}
        </div>
        {/* Favorite button */}
        <button
          onClick={handleToggleFavorite}
          disabled={favLoading}
          className="absolute top-3 left-3 z-10 w-10 h-10 bg-[var(--color-surface)]/90 backdrop-blur-sm rounded-xl flex items-center justify-center shadow-lg transition-colors hover:bg-[var(--color-surface)]"
        >
          {favLoading ? (
            <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
          ) : (
            <Heart className={`w-5 h-5 transition-colors ${isFav ? 'fill-rose-500 text-rose-500 dark:text-rose-400' : 'text-slate-400'}`} />
          )}
        </button>
      </div>

      {/* Lightbox */}
      {product.image_url && (
        <ImageLightbox
          images={[{ src: product.image_url, alt: product.name }]}
          isOpen={showLightbox}
          onClose={() => setShowLightbox(false)}
        />
      )}

      {/* Content */}
      <div className="px-4 -mt-4 relative z-10">
        <div className="bg-[var(--color-surface)] rounded-t-3xl border border-[var(--color-border)]/60 shadow-sm pt-5 pb-4">
          {/* Price & Store */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <p className="text-2xl font-black gradient-text-primary">
                {product.price.toLocaleString('ar-SY')} <span className="text-sm text-[var(--color-text-secondary)]">ل.س</span>
              </p>
            </div>
            <button
              onClick={handleGoToStore}
              className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-100 dark:bg-emerald-900/30 transition-colors px-3 py-2 rounded-xl"
            >
              <StoreIcon className="w-4 h-4 text-emerald-600" />
              <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300">الانتقال إلى المتجر</span>
            </button>
          </div>

          {/* Product Name */}
          <h2 className="text-lg font-bold text-[var(--color-text)] mb-1">{product.name}</h2>

          {/* Store Info */}
          <button
            onClick={handleGoToStore}
            className="flex items-center gap-2 mb-3 group"
          >
            <StoreLogo src={product.store_logo} name={product.store_name || 'م'} size="sm" />
            <div className="flex items-center gap-1">
              <span className="text-sm font-bold text-emerald-700 group-hover:text-emerald-800 dark:text-emerald-300 transition-colors">{product.store_name || 'متجر'}</span>
              {product.store_verified && <ShieldCheck className="w-4 h-4 text-emerald-500" />}
            </div>
          </button>

          {/* Category */}
          {product.category && (
            <span className="inline-block bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 text-xs font-bold px-3 py-1 rounded-lg mb-3">{product.category}</span>
          )}

          {/* Stats */}
          <div className="flex items-center gap-4 mb-4 pb-4 border-b border-[var(--color-border)]/60">
            <div className="flex items-center gap-1.5 text-xs text-[var(--color-text-tertiary)]">
              <Eye className="w-3.5 h-3.5" />
              <span className="font-bold">{((product.views || 0)).toLocaleString('ar-SY')}</span>
              <span>مشاهدة</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-[var(--color-text-tertiary)]">
              <Clock className="w-3.5 h-3.5" />
              <span>{new Date(product.created_at).toLocaleDateString('ar-SY', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
            </div>
            {!timeInfo.isExpired && timeInfo.text && product.expires_at && (
              <div className="flex items-center gap-1">
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-lg ${urgencyColors.bg} ${urgencyColors.text} border ${urgencyColors.border}`}>
                  <Clock className="w-3 h-3 inline ml-0.5" />
                  {timeInfo.text}
                </span>
              </div>
            )}
          </div>

          {/* Description */}
          <div className="mb-4">
            <h3 className="text-sm font-bold text-[var(--color-text)] mb-2">الوصف</h3>
            <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed whitespace-pre-wrap">
              {product.description || 'لا يوجد وصف لهذا المنتج'}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <button
              onClick={handleToggleFavorite}
              disabled={favLoading}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-colors ${
                isFav
                  ? 'bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 border border-rose-100'
                  : 'bg-[var(--color-surface)] text-emerald-700 border border-emerald-100 dark:border-emerald-800 hover:bg-emerald-50 dark:bg-emerald-900/20'
              }`}
            >
              <Heart className={`w-4 h-4 ${isFav ? 'fill-rose-500' : ''}`} />
              {isFav ? 'إزالة من المفضلة' : 'إضافة للمفضلة'}
            </button>
            {product?.store_id && canStoreChat(product.store_id) && user && user.id !== product.user_id ? (
              <button
                onClick={() => setShowChat(true)}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 transition-colors shadow-md shadow-emerald-500/20"
              >
                <MessageCircle className="w-4 h-4" />
                مراسلة البائع
              </button>
            ) : product?.store_id && !canStoreChat(product.store_id) && user && user.id !== product.user_id && (product.store_chat_enabled) ? (
              <div className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text-tertiary)] text-xs font-medium">
                <ShieldCheck className="w-3.5 h-3.5" />
                المتجر غير موثق
              </div>
            ) : (
              <button
                onClick={handleShare}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 transition-colors shadow-md shadow-emerald-500/20"
              >
                <Share2 className="w-4 h-4" />
                مشاركة
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Go to Store Banner */}
      <div className="px-4 mt-4">
        <button
          onClick={handleGoToStore}
          className="w-full bg-gradient-to-l from-emerald-600 to-teal-600 rounded-2xl p-4 flex items-center gap-3 shadow-lg shadow-emerald-500/15 hover:shadow-emerald-500/25 transition-shadow"
        >
          <div className="w-12 h-12 bg-[var(--color-surface)]/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
            <StoreIcon className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1 text-right">
            <p className="text-white font-bold text-sm">الانتقال إلى المتجر</p>
            <p className="text-white/60 text-xs">{product.store_name || 'متجر'}</p>
          </div>
          <ArrowRight className="w-5 h-5 text-white/60" />
        </button>
      </div>

      {/* Comments Section */}
      <div className="px-4 mt-4">
        <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)]/60 shadow-sm p-4">
          <CommentsSection targetId={product.id} targetType="product" ownerId={product.user_id} />
        </div>
      </div>

      {/* Chat Modal */}
      {product && user && user.id !== product.user_id && product.store_id && canStoreChat(product.store_id) && (
        <ChatModal
          isOpen={showChat}
          onClose={() => setShowChat(false)}
          currentUserId={user.id}
          storeOwnerId={product.user_id}
          storeName={product.store_name || ''}
          storeId={product.store_id}
          storeLogoUrl={product.store_logo}
        />
      )}

      {/* Share Sheet */}
      {product && (
        <ShareSheet
          isOpen={showShareSheet}
          onClose={() => setShowShareSheet(false)}
          itemType="product"
          itemId={product.id}
          itemName={product.name}
          itemDescription={product.description}
          itemPrice={`${product.price.toLocaleString('ar-SY')} ل.س`}
          storeName={product.store_name}
          imageUrl={product.image_url}
        />
      )}

      {/* Report Modal */}
      {reportModal.isOpen && (
        <ReportModal
          isOpen={reportModal.isOpen}
          onClose={() => setReportModal(prev => ({ ...prev, isOpen: false }))}
          targetType={reportModal.targetType}
          targetId={reportModal.targetId}
          targetName={reportModal.targetName}
        />
      )}
    </div>
  );
};
