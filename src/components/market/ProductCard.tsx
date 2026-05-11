'use client';
import React, { memo, useCallback, useMemo, useRef, useState } from 'react';
import { Heart, Loader2, Share2, Flag, Clock, Verified, MapPin, Store } from 'lucide-react';
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
  is_real_photo?: boolean;
  expires_at?: string | null;
}

interface ProductCardProps {
  product: ProductCardData;
  horizontal?: boolean;
  compact?: boolean;
  featured?: boolean;
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
 * Variants:
 * - default: Full-size card with store info, category, expiry, share/report buttons
 * - featured: Medium card with shorter image, smaller text, minimal store info (no share/report)
 * - compact: Smallest card for grid layout, minimal everything
 * 
 * KEY OPTIMIZATION: This component NO LONGER subscribes to any global store.
 * Instead, it receives `isFavorite` and `onToggleFavorite` as props.
 */
export const ProductCard: React.FC<ProductCardProps> = memo(({
  product,
  horizontal,
  compact,
  featured,
  isFavorite: isFav,
  onReport,
  onShare,
  onOpen,
  onToggleFavorite,
  isLoggedIn,
  borderColor,
}) => {
  const [favLoading, setFavLoading] = useState(false);

  // Whether to use small/condensed layout (compact or featured)
  const isSmall = compact || featured;

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
    if (favTimerRef.current) clearTimeout(favTimerRef.current);
    favTimerRef.current = setTimeout(() => setFavLoading(false), 500);
  }, [isLoggedIn, favLoading, product.id, onToggleFavorite]);

  // Memoize the store info section (full version for default card)
  const storeInfo = useMemo(() => {
    if (!product.store_name) return null;
    return (
      <div className="mb-1">
        <div className="flex items-center gap-1">
          {product.store_logo && <StoreLogo src={product.store_logo} name={product.store_name} size="xs" />}
          <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5 line-clamp-1"><Store className="w-3 h-3" />{product.store_name}</span>
          {product.store_verified && <Verified className="w-3 h-3 text-emerald-500 flex-shrink-0" />}
        </div>
        {product.store_governorate && (
          <div className="flex items-center gap-0.5 mt-0.5">
            <MapPin className="w-2.5 h-2.5 text-[var(--color-text-tertiary)] flex-shrink-0" />
            <span className="text-[11px] text-gray-400 dark:text-gray-500 line-clamp-1">{product.store_governorate}</span>
          </div>
        )}
      </div>
    );
  }, [product.store_name, product.store_logo, product.store_verified, product.store_governorate]);

  // Memoize badges — positioned to avoid covering product image center
  const badges = useMemo(() => {
    if (compact) {
      return (
        <>
          {product.is_real_photo && (
            <span className="absolute top-1.5 right-1.5 z-10 bg-sky-500/90 text-white text-[7px] font-bold px-1 py-0.5 rounded-full inline-flex items-center gap-0.5">📸 حقيقي</span>
          )}
          {product.is_new && (
            <span className="absolute bottom-1.5 right-1.5 z-10 bg-emerald-500/90 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full">جديد</span>
          )}
          {product.is_featured && (
            <span className="absolute bottom-1.5 left-1.5 z-10 bg-amber-400/90 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full">⭐</span>
          )}
        </>
      );
    }
    if (featured) {
      return (
        <>
          {product.is_real_photo && (
            <span className="absolute top-1.5 right-1.5 z-10 bg-sky-500/90 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full inline-flex items-center gap-0.5">📸</span>
          )}
          {product.is_new && (
            <span className="absolute bottom-1.5 right-1.5 z-10 bg-emerald-500/90 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">جديد</span>
          )}
          {product.is_featured && (
            <span className="absolute bottom-1.5 left-1.5 z-10 bg-amber-400/90 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">⭐</span>
          )}
        </>
      );
    }
    return (
      <>
        {product.is_real_photo && (
          <span className="absolute top-2 right-2 z-10 bg-sky-500/90 text-white text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-0.5 backdrop-blur-sm">📸 حقيقي</span>
        )}
        {product.is_new && (
          <span className="absolute bottom-2 right-2 z-10 bg-emerald-500/90 text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full">جديد</span>
        )}
        {product.is_featured && (
          <span className="absolute bottom-2 left-2 z-10 bg-amber-400/90 text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full inline-flex items-center gap-0.5">⭐ مميز</span>
        )}
      </>
    );
  }, [product.is_new, product.is_featured, product.is_real_photo, compact, featured]);

  return (
    <div
      onClick={() => onOpen?.(product)}
      className={`bg-[var(--color-surface)] ${compact ? 'rounded-xl border' : featured ? 'rounded-xl border' : 'rounded-2xl border-2'} overflow-hidden shadow-sm hover:shadow-lg transition-shadow duration-300 cursor-pointer active:opacity-80`}
      style={{ contain: 'layout style', borderColor: borderColor || '#e5e7eb' }}
    >
      {/* Image container — aspect ratio varies by variant */}
      <div className={`relative ${compact || horizontal ? 'aspect-square' : featured ? 'aspect-[4/3]' : 'aspect-square'} bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 overflow-hidden`}>
        <SafeImage src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
        {badges}

        {/* Favorite button — sized per variant */}
        {isLoggedIn && (
          <button
            onClick={handleToggleFavorite}
            disabled={favLoading}
            className={`absolute top-1.5 left-1.5 z-10 ${compact ? 'w-6 h-6' : featured ? 'w-7 h-7' : 'w-8 h-8'} bg-[var(--color-surface)]/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-sm transition-colors hover:bg-[var(--color-surface)]`}
          >
            {favLoading ? (
              <Loader2 className={`${compact ? 'w-2.5 h-2.5' : featured ? 'w-3 h-3' : 'w-3.5 h-3.5'} text-slate-400 animate-spin`} />
            ) : (
              <Heart className={`${compact ? 'w-2.5 h-2.5' : featured ? 'w-3 h-3' : 'w-3.5 h-3.5'} transition-colors ${isFav ? 'fill-rose-500 text-rose-500 dark:text-rose-400' : 'text-slate-400 hover:text-rose-400'}`} />
            )}
          </button>
        )}

        {/* Share/Report — only in default (full) variant */}
        {!isSmall && (
          <div className="absolute top-2 left-10 flex gap-1">
            {onShare && (
              <button
                onClick={(e) => { e.stopPropagation(); onShare(product); }}
                className="w-8 h-8 bg-[var(--color-surface)]/90 backdrop-blur-sm rounded-full flex items-center justify-center text-emerald-500 hover:bg-emerald-50 dark:bg-emerald-900/20 shadow-sm"
                aria-label="مشاركة"
              >
                <Share2 className="w-3.5 h-3.5" />
              </button>
            )}
            {onReport && (
              <button
                onClick={(e) => { e.stopPropagation(); onReport(product); }}
                className="w-8 h-8 bg-[var(--color-surface)]/90 backdrop-blur-sm rounded-full flex items-center justify-center text-rose-400 hover:bg-rose-50 dark:bg-rose-900/20 shadow-sm"
                aria-label="إبلاغ"
              >
                <Flag className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Content section — sizing varies by variant */}
      <div className={`${compact ? 'p-2' : featured ? 'p-2.5' : 'p-5'} flex flex-col flex-1`}>
        {/* Store info — full in default, mini in featured, hidden in compact */}
        {!isSmall && storeInfo}
        {featured && product.store_name && (
          <div className="flex items-center gap-1 mb-1">
            {product.store_logo && <StoreLogo src={product.store_logo} name={product.store_name} size="xs" />}
            <span className="text-[10px] text-gray-500 dark:text-gray-400 line-clamp-1">{product.store_name}</span>
            {product.store_verified && <Verified className="w-2.5 h-2.5 text-emerald-500 flex-shrink-0" />}
          </div>
        )}

        {/* Product name */}
        <p className={`${compact ? 'text-[11px]' : featured ? 'text-xs' : 'text-[15px]'} font-semibold text-gray-800 dark:text-gray-100 line-clamp-1 ${compact ? 'mb-0.5' : featured ? 'mb-1' : 'mb-2'}`}>{product.name}</p>

        {/* Category — only in default */}
        {!isSmall && <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">{product.category}</p>}

        {/* Price */}
        <p className={`${compact ? 'text-xs' : featured ? 'text-sm' : 'text-xl'} font-bold text-emerald-600 dark:text-emerald-400 ${isSmall ? 'mb-0' : 'mb-3'}`}>
          {product.price.toLocaleString('ar-SY')} ل.س
        </p>

        {/* Expiry + bottom border — only in default */}
        {!isSmall && expiryBadge}
        {!isSmall && <div className="mt-auto pt-3 border-t border-gray-100 dark:border-gray-700" />}
      </div>
    </div>
  );
});

ProductCard.displayName = 'ProductCard';
