'use client';

import React, { useCallback, useState, useMemo, useEffect, useRef, memo } from 'react';
import { createPortal } from 'react-dom';
import { lockScroll, unlockScroll, blockPointerEvents, restorePointerEvents } from '@/lib/scroll-lock';
import {
  Share2, Copy, Check, X, MessageCircle, Send, ExternalLink,
  Store, Package, Gift, Trophy, Clock, ChevronLeft
} from 'lucide-react';
import { useShareStore, type ShareableType } from '@/store/shareStore';
import { optimizeImage } from '@/lib/image-optimize';
import toast from 'react-hot-toast';

interface ShareSheetProps {
  isOpen: boolean;
  onClose: () => void;
  itemType: ShareableType;
  itemId: string;
  itemName: string;
  itemDescription?: string;
  itemPrice?: string;
  storeName?: string;
  imageUrl?: string;
  discount?: string;
  expiresIn?: string;
}

const PLATFORMS = [
  {
    key: 'whatsapp',
    label: 'واتساب',
    icon: <MessageCircle className="w-5 h-5" />,
    color: 'bg-emerald-500',
    hoverColor: 'hover:bg-emerald-600',
    getUrl: (url: string, text: string) => `https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`,
  },
  {
    key: 'telegram',
    label: 'تيليجرام',
    icon: <Send className="w-5 h-5" />,
    color: 'bg-sky-500',
    hoverColor: 'hover:bg-sky-600',
    getUrl: (url: string, text: string) => `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
  },
  {
    key: 'facebook',
    label: 'فيسبوك',
    icon: <span className="text-[18px] font-bold">f</span>,
    color: 'bg-blue-600',
    hoverColor: 'hover:bg-blue-700',
    getUrl: (url: string) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
  },
];

// Type-specific preview cards
const StorePreview: React.FC<{ name: string; description?: string; imageUrl?: string; onOpen: () => void }> = ({ name, description, imageUrl, onOpen }) => (
  <div className="flex items-center gap-3.5 p-3.5 rounded-2xl bg-gradient-to-br from-emerald-50/80 to-teal-50/60 border border-emerald-100/50">
    <div className="w-16 h-16 rounded-2xl overflow-hidden flex-shrink-0 bg-[var(--color-surface)] shadow-sm border border-[var(--color-border)]/60">
      {imageUrl ? (
        <img src={optimizeImage(imageUrl)} alt="" className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-emerald-100 to-teal-100">
          <Store className="w-7 h-7 text-emerald-400" />
        </div>
      )}
    </div>
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-1.5 mb-1">
        <Store className="w-3.5 h-3.5 text-emerald-500" />
        <span className="text-[10px] font-bold text-emerald-500">متجر</span>
      </div>
      <p className="text-[14px] font-black text-[var(--color-text)] truncate">{name}</p>
      {description && <p className="text-[11px] text-[var(--color-text-tertiary)] mt-0.5 line-clamp-2 leading-relaxed">{description}</p>}
    </div>
    <button onClick={onOpen} className="flex-shrink-0 px-3 py-2 rounded-xl gradient-primary text-white text-[10px] font-bold shadow-sm shadow-emerald-500/20 flex items-center gap-1 active:scale-95 transition-transform">
      فتح
      <ChevronLeft className="w-3 h-3" />
    </button>
  </div>
);

const ProductPreview: React.FC<{ name: string; price?: string; storeName?: string; imageUrl?: string; isFeatured?: boolean; isNew?: boolean }> = ({ name, price, storeName, imageUrl, isFeatured, isNew }) => (
  <div className="flex items-center gap-3.5 p-3.5 rounded-2xl bg-gradient-to-br from-emerald-50/80 to-teal-50/60 border border-emerald-100/50">
    <div className="w-16 h-16 rounded-2xl overflow-hidden flex-shrink-0 bg-[var(--color-surface)] shadow-sm border border-[var(--color-border)]/60 relative">
      {imageUrl ? (
        <img src={optimizeImage(imageUrl)} alt="" className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-emerald-100 to-teal-100">
          <Package className="w-7 h-7 text-emerald-400" />
        </div>
      )}
      <div className="absolute top-1 right-1 flex gap-0.5">
        {isNew && <span className="gradient-primary text-white text-[7px] font-bold px-1 py-px rounded">جديد</span>}
        {isFeatured && <span className="gradient-warm text-white text-[7px] font-bold px-1 py-px rounded">مميز</span>}
      </div>
    </div>
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-1.5 mb-1">
        <Package className="w-3.5 h-3.5 text-emerald-500" />
        <span className="text-[10px] font-bold text-emerald-500">منتج</span>
      </div>
      <p className="text-[14px] font-black text-[var(--color-text)] truncate">{name}</p>
      {storeName && <p className="text-[11px] text-[var(--color-text-tertiary)] mt-0.5 truncate flex items-center gap-1"><Store className="w-3 h-3" /> {storeName}</p>}
      {price && <p className="text-[13px] font-black gradient-text-primary mt-1">{price}</p>}
    </div>
  </div>
);

const OfferPreview: React.FC<{ name: string; description?: string; storeName?: string; imageUrl?: string; discount?: string; type?: string; expiresIn?: string }> = ({ name, description, storeName, imageUrl, discount, type = 'offer', expiresIn }) => {
  const isContest = type === 'contest';
  return (
  <div className="rounded-2xl overflow-hidden border border-emerald-100/50 shadow-sm">
    {imageUrl && (
      <div className={`h-32 ${isContest ? 'bg-gradient-to-br from-rose-100 to-pink-100' : 'bg-gradient-to-br from-emerald-100 to-teal-100'} overflow-hidden relative`}>
        <img src={optimizeImage(imageUrl)} alt="" className="w-full h-full object-cover" />
        <div className="absolute top-2 right-2">
          <span className={`text-white text-[10px] font-black px-2.5 py-1 rounded-lg flex items-center gap-1 ${isContest ? 'bg-gradient-to-r from-rose-500 to-pink-500' : 'bg-gradient-to-r from-teal-500 to-emerald-500'}`}>
            {isContest ? <Trophy className="w-3 h-3" /> : <Gift className="w-3 h-3" />}
            {isContest ? 'مسابقة' : 'عرض'}
          </span>
        </div>
      </div>
    )}
    <div className="p-3.5">
      <div className="flex items-center gap-1.5 mb-1">
        {isContest ? <Trophy className="w-3.5 h-3.5 text-rose-500 dark:text-rose-400" /> : <Gift className="w-3.5 h-3.5 text-teal-500" />}
        <span className={`text-[10px] font-bold ${isContest ? 'text-rose-500 dark:text-rose-400' : 'text-teal-500'}`}>{isContest ? 'مسابقة' : 'عرض'}</span>
      </div>
      <p className="text-[14px] font-black text-[var(--color-text)] truncate">{name}</p>
      {storeName && <p className="text-[11px] text-[var(--color-text-tertiary)] mt-0.5">{storeName}</p>}
      <div className="flex items-center gap-2 mt-2">
        {discount && (
          <span className="bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 text-[11px] font-bold px-2 py-0.5 rounded-lg border border-amber-100/60">
            خصم {discount}
          </span>
        )}
        {expiresIn && (
          <span className="text-[var(--color-text-tertiary)] text-[10px] font-medium flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {expiresIn}
          </span>
        )}
      </div>
      {description && <p className="text-[11px] text-[var(--color-text-tertiary)] mt-1.5 line-clamp-2 leading-relaxed">{description}</p>}
    </div>
  </div>
);
};

export const ShareSheet: React.FC<ShareSheetProps> = memo(({
  isOpen, onClose, itemType, itemId, itemName,
  itemDescription, itemPrice, storeName, imageUrl, discount,
}) => {
  const getShareUrl = useShareStore(s => s.getShareUrl);
  const recordShare = useShareStore(s => s.recordShare);
  const shareRecords = useShareStore(s => s.shareRecords);
  const [copied, setCopied] = useState(false);
  const onCloseRef = useRef(onClose);
  // Update ref in effect (React 19 rule: no ref writes during render)
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  // Stable close handler from ref — must be before any early return (hooks rule)
  const stableClose = useCallback(() => onCloseRef.current(), []);

  // Stable escape handler — only depends on isOpen
  const handleEscape = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onCloseRef.current();
  }, []);

  // Scroll lock + escape key — owner-based
  useEffect(() => {
    if (!isOpen) return;
    document.addEventListener('keydown', handleEscape);
    lockScroll('ShareSheet');
    blockPointerEvents('ShareSheet');
    return () => {
      document.removeEventListener('keydown', handleEscape);
      unlockScroll('ShareSheet');
      restorePointerEvents('ShareSheet');
    };
  }, [isOpen, handleEscape]);

  const shareUrl = getShareUrl(itemType, itemId);
  const shareCount = useMemo(() => shareRecords.filter(r => r.itemType === itemType && r.itemId === itemId).length, [shareRecords, itemType, itemId]);

  const getShareText = useCallback(() => {
    const typeLabel: Record<ShareableType, string> = {
      store: '🏪 متجر',
      product: '🛍️ منتج',
      offer: '🎁 عرض',
      contest: '🏆 مسابقة',
    };
    let text = `${typeLabel[itemType]}: ${itemName}`;
    if (storeName && itemType !== 'store') text += `\nمن ${storeName}`;
    if (itemPrice) text += `\n💰 ${itemPrice}`;
    if (discount) text += `\n🔥 خصم ${discount}`;
    if (itemDescription) text += `\n${itemDescription}`;
    text += `\n\n🛒 سوق مارع الإلكتروني`;
    return text;
  }, [itemType, itemName, storeName, itemPrice, discount, itemDescription]);

  const handlePlatformShare = useCallback((platform: typeof PLATFORMS[number]) => {
    const text = getShareText();
    const url = platform.getUrl(shareUrl, text);
    window.open(url, '_blank', 'width=600,height=400');
    recordShare({
      itemType, itemId, itemName, itemNameAr: itemName,
      storeId: itemType !== 'store' ? undefined : itemId,
      storeName, imageUrl, platform: platform.key,
    });
    toast.success(`تمت المشاركة عبر ${platform.label}`);
    onClose();
  }, [getShareText, shareUrl, recordShare, itemType, itemId, itemName, storeName, imageUrl, onClose]);

  const handleCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      recordShare({
        itemType, itemId, itemName, itemNameAr: itemName,
        storeId: itemType !== 'store' ? undefined : itemId,
        storeName, imageUrl, platform: 'copy',
      });
      toast.success('تم نسخ الرابط ✅');
      setTimeout(() => { setCopied(false); onClose(); }, 1200);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = shareUrl;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      recordShare({
        itemType, itemId, itemName, itemNameAr: itemName,
        storeId: itemType !== 'store' ? undefined : itemId,
        storeName, imageUrl, platform: 'copy',
      });
      toast.success('تم نسخ الرابط ✅');
      setTimeout(() => { setCopied(false); onClose(); }, 1200);
    }
  }, [shareUrl, recordShare, itemType, itemId, itemName, storeName, imageUrl, onClose]);

  const handleNativeShare = useCallback(async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${itemName} - سوق مارع`,
          text: getShareText(),
          url: shareUrl,
        });
        recordShare({
          itemType, itemId, itemName, itemNameAr: itemName,
          storeId: itemType !== 'store' ? undefined : itemId,
          storeName, imageUrl, platform: 'native',
        });
        onClose();
      } catch (e: any) {
        if (e.name !== 'AbortError') {
          toast.error('حدث خطأ أثناء المشاركة');
        }
      }
    } else {
      handleCopyLink();
    }
  }, [getShareText, shareUrl, recordShare, itemType, itemId, itemName, storeName, imageUrl, onClose, handleCopyLink]);

  const renderPreview = () => {
    switch (itemType) {
      case 'store':
        return (
          <StorePreview
            name={itemName}
            description={itemDescription}
            imageUrl={imageUrl}
            onOpen={onClose}
          />
        );
      case 'product':
        return (
          <ProductPreview
            name={itemName}
            price={itemPrice}
            storeName={storeName}
            imageUrl={imageUrl}
          />
        );
      case 'offer':
      case 'contest':
        return (
          <OfferPreview
            name={itemName}
            description={itemDescription}
            storeName={storeName}
            imageUrl={imageUrl}
            discount={discount}
            type={itemType}
          />
        );
      default:
        return null;
    }
  };

  // 🔴 FIX: Early return — completely remove from DOM when closed
  // This prevents any invisible overlay from blocking interactions
  if (!isOpen) return null;

  const sheetContent = (
    <>
      {/* Backdrop — CSS-only transition, no AnimatePresence */}
      <div
        onClick={stableClose}
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60] animate-[fadeIn_150ms_ease-out]"
        style={{ pointerEvents: 'auto' }}
      />

      {/* Sheet — CSS-only slide-up animation, anchored to bottom with position: fixed */}
      <div
        className="fixed bottom-0 left-0 right-0 z-[60] bg-[var(--color-surface)] rounded-t-3xl shadow-2xl max-w-lg mx-auto max-h-[90vh] overflow-y-auto animate-[slideUp_250ms_ease-out]"
        style={{ pointerEvents: 'auto' }}
        role="dialog"
        aria-modal="true"
        aria-label="مشاركة"
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 sticky top-0 bg-[var(--color-surface)] z-10">
          <div className="w-10 h-1 rounded-full bg-slate-200" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pb-3 sticky top-5 bg-[var(--color-surface)] z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-md shadow-emerald-500/20">
              <Share2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-[15px] font-black text-[var(--color-text)]">مشاركة</h3>
              <p className="text-[11px] text-[var(--color-text-tertiary)] truncate max-w-[200px]">{itemName}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {shareCount > 0 && (
              <span className="text-[10px] font-bold text-[var(--color-text-tertiary)] bg-slate-50 dark:bg-slate-800/50 px-2 py-1 rounded-full flex items-center gap-1">
                <Share2 className="w-3 h-3" />
                {shareCount}
              </span>
            )}
            <button onClick={stableClose} className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center hover:bg-slate-200 transition-colors">
              <X className="w-4 h-4 text-[var(--color-text-tertiary)]" />
            </button>
          </div>
        </div>

        {/* Preview Card */}
        <div className="mx-5 mb-4">
          {renderPreview()}
        </div>

        {/* Platform Buttons */}
        <div className="px-5 pb-2">
          <div className="grid grid-cols-3 gap-3">
            {PLATFORMS.map(platform => (
              <button
                key={platform.key}
                onClick={() => handlePlatformShare(platform)}
                className={`flex flex-col items-center gap-2 py-4 rounded-2xl ${platform.color} ${platform.hoverColor} text-white transition-all active:scale-95 shadow-md`}
              >
                {platform.icon}
                <span className="text-[12px] font-bold">{platform.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="px-5 pt-3 pb-8 space-y-2.5">
          {/* Copy Link */}
          <button
            onClick={handleCopyLink}
            className={`w-full flex items-center gap-3 py-3.5 px-4 rounded-2xl transition-all active:scale-[0.98] border ${
              copied
                ? 'bg-emerald-100 dark:bg-emerald-900/30 border-emerald-200'
                : 'bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-100 dark:bg-emerald-900/30 border-emerald-100/50'
            }`}
          >
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${copied ? 'bg-emerald-500' : 'bg-emerald-100'}`}>
              {copied ? <Check className="w-4 h-4 text-white" /> : <Copy className="w-4 h-4 text-emerald-600" />}
            </div>
            <div className="flex-1 text-right">
              <p className="text-[13px] font-bold text-[var(--color-text)]">{copied ? 'تم النسخ!' : 'نسخ الرابط'}</p>
              <p className="text-[10px] text-[var(--color-text-tertiary)] truncate font-mono">{shareUrl}</p>
            </div>
          </button>

          {/* Native Share */}
          <button
            onClick={handleNativeShare}
            className="w-full flex items-center gap-3 py-3.5 px-4 rounded-2xl bg-gradient-to-r from-emerald-900 to-teal-900 text-white hover:from-emerald-800 hover:to-teal-800 transition-all active:scale-[0.98] shadow-md shadow-emerald-900/20"
          >
            <div className="w-9 h-9 rounded-xl bg-[var(--color-surface)]/10 flex items-center justify-center">
              <ExternalLink className="w-4 h-4" />
            </div>
            <div className="flex-1 text-right">
              <p className="text-[13px] font-bold">مشاركة أخرى</p>
              <p className="text-[10px] text-emerald-300/60">مشاركة عبر تطبيقات أخرى</p>
            </div>
            <Share2 className="w-4 h-4 text-emerald-300/60" />
          </button>
        </div>
      </div>
    </>
  );

  // 🔥 CRITICAL FIX: Render via Portal to document.body
  // Prevents parent transform/overflow from breaking fixed positioning
  if (typeof window === 'undefined') return null;
  return createPortal(sheetContent, document.body);
});
ShareSheet.displayName = 'ShareSheet';
