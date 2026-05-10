'use client';
import React, { memo, useCallback, useMemo, useRef, useState } from 'react';
import { Heart, Loader2, Share2, Flag, Clock, Verified, MapPin } from 'lucide-react';
import { SafeImage, StoreLogo } from '@/components/market/SafeImage';
import { getTimeRemaining, getUrgencyColors } from '@/store/autoDeleteStore';
import toast from 'react-hot-toast';

export interface ProductCardData {
  id: string;
  name: string;
  description?: string;
  price: number;
  image_url?: string;
  category?: string;
  store_name?: string;
  store_logo?: string;
  store_verified?: boolean;
  store_governorate?: string | null;
  is_new?: boolean;
  is_featured?: boolean;
  expires_at?: string | null;
}

interface ProductCardProps {
  product: ProductCardData;
  horizontal?: boolean;
  isFavorite?: boolean;
  onReport?: (_product: ProductCardData) => void;
  onShare?: (_product: ProductCardData) => void;
  onOpen?: (_product: ProductCardData) => void;
  onToggleFavorite?: (_productId: string) => void;
  isLoggedIn?: boolean;
  borderColor?: string;
}

/**
 * Ultra-stable ProductCard.
 * 
 * KEY OPTIMIZATION: This component NO LONGER subscribes to any global store.
 * Instead, it receives `isFavorite` and `onToggleFavorite` as props.
 * This prevents cascading re-renders when unrelated state changes.
 * 
 * Only re-renders when:
 * - The product data changes
 * - The isFavorite prop changes
 * - Callback refs change (stable via useCallback in parent)
 */
export const ProductCard: React.FC<ProductCardProps> = memo(({
  product,
  horizontal,
  isFavorite: isFav,
  onReport,
  onShare,
  onOpen,
  onToggleFavorite,
  isLoggedIn,
  borderColor,
}) => {
  const [favLoading, setFavLoading] = useState(false);

  // Pre-compute expiry badge outside render cycle
  const expiryBadge = useMemo(() => {
    if (!product.expires_at) return null;
    const timeInfo = getTimeRemaining(product.expires_at);
    if (timeInfo.isExpired || !timeInfo.text) return null;
    const colors = getUrgencyColors(timeInfo.urgencyLevel);
    return (
      <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-lg mt-1.5 ${colors.bg} ${colors.text} border ${colors.border}`}>
        <Clock className="w-3 h-3" />
        {timeInfo.text}
      </span>
    );
  }, [product.expires_at]);

  const favTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleToggleFavorite = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isLoggedIn) {
      toast.error('يجب تسجيل الدخول أولاً');
      return;
    }
    if (favLoading) return;
    setFavLoading(true);
    onToggleFavorite?.(product.id);
    // Reset loading after a delay (optimistic — assumes success)
    if (favTimerRef.current) clearTimeout(favTimerRef.current);
    favTimerRef.current = setTimeout(() => setFavLoading(false), 500);
  }, [isLoggedIn, favLoading, product.id, onToggleFavorite]);

  // Memoize the store info section to avoid re-creating on every render
  const storeInfo = useMemo(() => {
    if (!product.store_name) return null;
    return (
      <div className="mb-1">
        <div className="flex items-center gap-1">
          {product.store_logo && <StoreLogo src={product.store_logo} name={product.store_name} size="xs" />}
          <span className="text-[11px] text-emerald-600 font-bold line-clamp-1">{product.store_name}</span>
          {product.store_verified && <Verified className="w-3 h-3 text-emerald-500 flex-shrink-0" />}
        </div>
        {product.store_governorate && (
          <div className="flex items-center gap-0.5 mt-0.5">
            <MapPin className="w-2.5 h-2.5 text-[var(--color-text-tertiary)] flex-shrink-0" />
            <span className="text-[11px] text-[var(--color-text-tertiary)] line-clamp-1">{product.store_governorate}</span>
          </div>
        )}
      </div>
    );
  }, [product.store_name, product.store_logo, product.store_verified, product.store_governorate]);

  // Memoize badges
  const badges = useMemo(() => (
    <>
      {product.is_new && (
        <span className="absolute top-2 right-2 bg-emerald-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">جديد</span>
      )}
      {product.is_featured && (
        <span className="absolute top-2 left-10 bg-gradient-to-r from-amber-400 to-amber-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm inline-flex items-center gap-0.5">⭐ مميز</span>
      )}
    </>
  ), [product.is_new, product.is_featured]);

  return (
    <div
      onClick={() => onOpen?.(product)}
      className="bg-[var(--color-surface)] rounded-2xl overflow-hidden border-2 shadow-sm hover:shadow-lg transition-shadow duration-300 cursor-pointer active:opacity-80"
      style={{ contain: 'layout style', borderColor: borderColor || '#e5e7eb' }}
    >
      <div className={`relative ${horizontal ? 'aspect-square' : 'aspect-[4/3]'} bg-gradient-to-br from-emerald-50/50 to-teal-50/50 overflow-hidden`}>
        <SafeImage src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
        {badges}

        {/* Favorite button */}
        {isLoggedIn && (
          <button
            onClick={handleToggleFavorite}
            disabled={favLoading}
            className="absolute top-2 left-2 z-10 w-7 h-7 bg-[var(--color-surface)]/90 backdrop-blur-sm rounded-lg flex items-center justify-center shadow-sm transition-colors hover:bg-[var(--color-surface)]"
          >
            {favLoading ? (
              <Loader2 className="w-3.5 h-3.5 text-slate-400 animate-spin" />
            ) : (
              <Heart className={`w-3.5 h-3.5 transition-colors ${isFav ? 'fill-rose-500 text-rose-500 dark:text-rose-400' : 'text-slate-400 hover:text-rose-400'}`} />
            )}
          </button>
        )}

        <div className="absolute top-2 left-10 flex gap-1">
          {onShare && (
            <button
              onClick={(e) => { e.stopPropagation(); onShare(product); }}
              className="w-7 h-7 bg-[var(--color-surface)]/90 backdrop-blur-sm rounded-lg flex items-center justify-center text-emerald-500 hover:bg-emerald-50 dark:bg-emerald-900/20 shadow-sm"
              aria-label="مشاركة"
            >
              <Share2 className="w-3.5 h-3.5" />
            </button>
          )}
          {onReport && (
            <button
              onClick={(e) => { e.stopPropagation(); onReport(product); }}
              className="w-7 h-7 bg-[var(--color-surface)]/90 backdrop-blur-sm rounded-lg flex items-center justify-center text-rose-400 hover:bg-rose-50 dark:bg-rose-900/20 shadow-sm"
              aria-label="إبلاغ"
            >
              <Flag className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
      <div className="p-3.5">
        {storeInfo}
        <p className="text-sm font-semibold text-[var(--color-text)] line-clamp-1 mb-1">{product.name}</p>
        <p className="text-[13px] text-[var(--color-text-tertiary)] mt-0.5 line-clamp-1">{product.category}</p>
        <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-2">
          {product.price.toLocaleString('ar-SY')} ل.س
        </p>
        {expiryBadge}
      </div>
    </div>
  );
});

ProductCard.displayName = 'ProductCard';
