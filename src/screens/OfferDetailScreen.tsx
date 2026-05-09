'use client';
import React, { useEffect, useState, useCallback } from 'react';
import {
  ArrowRight, Share2, Store as StoreIcon, Eye, Clock, Gift, Trophy,
  ImageIcon, ShieldCheck, Flag, CalendarDays, Tag, Percent
} from 'lucide-react';
import { StoreLogo } from '@/components/market/SafeImage';
import { CommentsSection } from '@/components/market/CommentsSection';
import { ImageLightbox } from '@/components/market/ImageLightbox';
import { ShareSheet } from '@/components/market/ShareSheet';
import { ReportModal } from '@/components/admin/ReportModal';
import { optimizeImage } from '@/lib/image-optimize';
import { useAppStore } from '@/store/appStore';
import { apiGet } from '@/lib/fetchApi';
import { useStoreColorStore } from '@/store/storeColorStore';
import { getTimeRemaining, getUrgencyColors } from '@/store/autoDeleteStore';
import toast from 'react-hot-toast';

interface OfferDetailData {
  id: string;
  store_id: string;
  user_id: string;
  title: string;
  description?: string;
  image_url?: string;
  type: string;
  discount?: string;
  views: number;
  expires_at?: string | null;
  created_at: string;
  comments_count: number;
  store_name?: string;
  store_logo?: string;
  store_verified?: boolean;
  store_theme_color?: string | null;
}

// Default colors for offers/contests when no store theme
const DEFAULT_OFFER_COLOR = '#059669';
const DEFAULT_CONTEST_COLOR = '#e11d48';

export const OfferDetailScreen: React.FC = () => {
  const selectedOfferId = useAppStore(s => s.selectedOfferId);
  const goBack = useAppStore(s => s.goBack);
  const openStoreDetail = useAppStore(s => s.openStoreDetail);
  const getStoreColorById = useStoreColorStore(s => s.getStoreColorById);
  const [offer, setOffer] = useState<OfferDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showShareSheet, setShowShareSheet] = useState(false);
  const [showLightbox, setShowLightbox] = useState(false);
  const [reportModal, setReportModal] = useState<{ isOpen: boolean; targetType: 'product' | 'store' | 'offer'; targetId: string; targetName: string }>({ isOpen: false, targetType: 'offer', targetId: '', targetName: '' });

  const isContest = offer?.type === 'contest';

  const loadOffer = useCallback(async () => {
    if (!selectedOfferId) return;
    setLoading(true);
    try {
      const { data, error } = await apiGet<{ offer: OfferDetailData }>(`/api/offer/${selectedOfferId}`);
      if (error) throw new Error();
      setOffer(data?.offer || null);
    } catch {
      toast.error('حدث خطأ في تحميل العرض');
    } finally {
      setLoading(false);
    }
  }, [selectedOfferId]);

  useEffect(() => { loadOffer(); }, [loadOffer]);

  const handleGoToStore = () => {
    if (offer?.store_id) {
      openStoreDetail(offer.store_id);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--color-bg)]">
        <div className="h-12 bg-[var(--color-surface)] border-b border-[var(--color-border)]" />
        <div className="w-full aspect-[16/9] bg-emerald-50 dark:bg-emerald-900/20 animate-pulse" />
        <div className="px-4 py-4 space-y-3">
          <div className="h-6 w-3/4 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg animate-pulse" />
          <div className="h-4 w-full bg-emerald-50 dark:bg-emerald-900/20 rounded-lg animate-pulse" />
          <div className="h-4 w-2/3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg animate-pulse" />
          <div className="h-32 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl animate-pulse mt-4" />
        </div>
      </div>
    );
  }

  if (!offer) {
    return (
      <div className="min-h-screen bg-[var(--color-bg)] flex flex-col items-center justify-center">
        <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl flex items-center justify-center mb-4">
          <ImageIcon className="w-8 h-8 text-emerald-300" />
        </div>
        <p className="text-[var(--color-text-tertiary)] text-sm font-medium">
          {isContest ? 'لم يتم العثور على المسابقة' : 'لم يتم العثور على العرض'}
        </p>
        <button onClick={goBack} className="mt-4 text-sm text-emerald-600 font-bold">العودة</button>
      </div>
    );
  }

  const timeInfo = getTimeRemaining(offer.expires_at);
  const urgencyColors = getUrgencyColors(timeInfo.urgencyLevel);

  // Resolve store theme color ID → StoreGradientColor
  const storeColorObj = offer.store_theme_color ? getStoreColorById(offer.store_theme_color) : undefined;
  const themeColor = storeColorObj?.solid || (isContest ? DEFAULT_CONTEST_COLOR : DEFAULT_OFFER_COLOR);
  const themeFrom = storeColorObj?.from || themeColor;
  const themeTo = storeColorObj?.to || themeColor;
  const themeLightBg = storeColorObj ? `${themeColor}15` : (isContest ? '#ec489915' : '#10b98115');
  const themeLightBg2 = storeColorObj ? `${themeColor}10` : (isContest ? '#ec489910' : '#10b98110');

  return (
    <div className="min-h-screen bg-[var(--color-bg)] pb-24">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-[var(--color-surface)]/80 backdrop-blur-lg border-b border-[var(--color-border)]/60">
        <div className="flex items-center justify-between px-4 py-3">
          <button
            onClick={goBack}
            className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors"
            style={{ background: themeLightBg, color: themeColor }}
          >
            <ArrowRight className="w-5 h-5" />
          </button>
          <h1 className="text-sm font-bold text-[var(--color-text)] line-clamp-1 flex-1 text-center px-4">{offer.title}</h1>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setShowShareSheet(true)}
              className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors"
              style={{ background: themeLightBg, color: themeColor }}
            >
              <Share2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setReportModal({ isOpen: true, targetType: 'offer', targetId: offer.id, targetName: offer.title })}
              className="w-9 h-9 rounded-xl bg-rose-50 dark:bg-rose-900/20 flex items-center justify-center text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/30 transition-colors"
            >
              <Flag className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Hero Image */}
      <div className="relative">
        <div
          className="w-full aspect-[16/9] overflow-hidden"
          style={{ background: `linear-gradient(135deg, ${themeFrom}, ${themeTo})` }}
        >
          {offer.image_url ? (
            <div className="w-full h-full cursor-zoom-in" onClick={() => setShowLightbox(true)}>
              <img
                src={optimizeImage(offer.image_url)}
                alt={offer.title}
                className="w-full h-full object-cover opacity-70"
                loading="eager"
              />
            </div>
          ) : (
            <div className="w-full h-full flex items-center justify-center opacity-50">
              {isContest ? <Trophy className="w-20 h-20 text-white" /> : <Gift className="w-20 h-20 text-white" />}
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/20" />

          {/* Overlay Content */}
          <div className="absolute bottom-0 left-0 right-0 p-5">
            <div className="flex items-center gap-2 mb-2">
              <span className="bg-[var(--color-surface)]/20 backdrop-blur-sm text-white text-xs font-bold px-3 py-1 rounded-full">
                {isContest ? 'مسابقة' : 'عرض حصري'}
              </span>
              {offer.discount && (
                <span className="text-white text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1" style={{ background: `${themeColor}dd` }}>
                  <Percent className="w-3 h-3" />
                  {offer.discount}
                </span>
              )}
            </div>
            <h2 className="text-white font-black text-xl leading-tight">{offer.title}</h2>
            {offer.store_name && (
              <p className="text-white/70 text-sm mt-1">{offer.store_name}</p>
            )}
          </div>
        </div>
      </div>

      {/* Lightbox */}
      {offer.image_url && (
        <ImageLightbox
          images={[{ src: offer.image_url, alt: offer.title }]}
          isOpen={showLightbox}
          onClose={() => setShowLightbox(false)}
        />
      )}

      {/* Content */}
      <div className="px-4 -mt-4 relative z-10">
        <div className="bg-[var(--color-surface)] rounded-t-3xl border border-[var(--color-border)]/60 shadow-sm pt-5 pb-4">
          {/* Store Info */}
          <button
            onClick={handleGoToStore}
            className="flex items-center gap-2 mb-4 group w-full"
          >
            <StoreLogo src={offer.store_logo} name={offer.store_name || 'م'} size="sm" />
            <div className="flex-1 text-right">
              <div className="flex items-center gap-1">
                <span className="text-sm font-bold transition-colors" style={{ color: themeColor }}>{offer.store_name || 'متجر'}</span>
                {offer.store_verified && <ShieldCheck className="w-4 h-4" style={{ color: themeColor }} />}
              </div>
            </div>
            <span className="text-xs font-bold flex items-center gap-1" style={{ color: themeColor }}>
              الانتقال للمتجر
              <ArrowRight className="w-3.5 h-3.5" />
            </span>
          </button>

          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            {/* Views */}
            <div className="rounded-xl p-3 flex items-center gap-2.5" style={{ background: themeLightBg }}>
              <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: themeLightBg2 }}>
                <Eye className="w-4 h-4" style={{ color: themeColor }} />
              </div>
              <div>
                <p className="text-xs text-[var(--color-text-secondary)]">المشاهدات</p>
                <p className="text-sm font-bold text-[var(--color-text)]">{(offer.views || 0).toLocaleString('ar-SY')}</p>
              </div>
            </div>
            {/* Discount */}
            {offer.discount && (
              <div className="rounded-xl p-3 flex items-center gap-2.5" style={{ background: themeLightBg }}>
                <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: themeLightBg2 }}>
                  <Percent className="w-4 h-4" style={{ color: themeColor }} />
                </div>
                <div>
                  <p className="text-xs text-[var(--color-text-secondary)]">الخصم</p>
                  <p className="text-sm font-bold" style={{ color: themeColor }}>{offer.discount}</p>
                </div>
              </div>
            )}
            {/* Comments */}
            <div className="rounded-xl p-3 flex items-center gap-2.5" style={{ background: themeLightBg }}>
              <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: themeLightBg2 }}>
                <Tag className="w-4 h-4" style={{ color: themeColor }} />
              </div>
              <div>
                <p className="text-xs text-[var(--color-text-secondary)]">التعليقات</p>
                <p className="text-sm font-bold text-[var(--color-text)]">{offer.comments_count || 0}</p>
              </div>
            </div>
            {/* Time remaining */}
            {!timeInfo.isExpired && timeInfo.text && offer.expires_at ? (
              <div className={`${urgencyColors.bg} rounded-xl p-3 flex items-center gap-2.5`}>
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${urgencyColors.border} border`}>
                  <Clock className={`w-4 h-4 ${urgencyColors.text}`} />
                </div>
                <div>
                  <p className="text-xs text-[var(--color-text-secondary)]">المتبقي</p>
                  <p className={`text-sm font-bold ${urgencyColors.text}`}>{timeInfo.text}</p>
                </div>
              </div>
            ) : (
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 flex items-center gap-2.5">
                <div className="w-9 h-9 bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center justify-center">
                  <CalendarDays className="w-4 h-4 text-[var(--color-text-tertiary)]" />
                </div>
                <div>
                  <p className="text-xs text-[var(--color-text-secondary)]">تاريخ الانتهاء</p>
                  <p className="text-sm font-bold text-slate-600">
                    {offer.expires_at
                      ? new Date(offer.expires_at).toLocaleDateString('ar-SY', { year: 'numeric', month: 'long', day: 'numeric' })
                      : 'غير محدد'}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Description */}
          <div className="mb-4">
            <h3 className="text-sm font-bold text-[var(--color-text)] mb-2">
              {isContest ? 'وصف المسابقة' : 'تفاصيل العرض'}
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
              {offer.description || `لا توجد تفاصيل إضافية لهذا ${isContest ? 'المسابقة' : 'العرض'}`}
            </p>
          </div>

          {/* Contest specific: conditions */}
          {isContest && (
            <div className="mb-4 rounded-xl p-4" style={{ background: `linear-gradient(to left, ${themeColor}10, ${themeColor}05)`, borderColor: `${themeColor}20`, borderWidth: '1px' }}>
              <h3 className="text-sm font-bold mb-2 flex items-center gap-1.5" style={{ color: themeColor }}>
                <Trophy className="w-4 h-4" />
                شروط المشاركة
              </h3>
              <ul className="text-sm space-y-1.5" style={{ color: `${themeColor}cc` }}>
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: themeColor }} />
                  يجب تسجيل الدخول للمشاركة
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: themeColor }} />
                  يحق لكل مستخدم مشاركة واحدة فقط
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: themeColor }} />
                  يتم الإعلان عن النتائج عند انتهاء المسابقة
                </li>
              </ul>
            </div>
          )}

          {/* Date Info */}
          {offer.expires_at && (
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 flex items-center gap-3 mb-4">
              <CalendarDays className="w-5 h-5 text-[var(--color-text-tertiary)]" />
              <div className="flex-1">
                <p className="text-xs text-[var(--color-text-secondary)]">تاريخ البداية</p>
                <p className="text-sm font-bold text-[var(--color-text)]">
                  {new Date(offer.created_at).toLocaleDateString('ar-SY', { year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
              </div>
              <div className="w-px h-8 bg-slate-200" />
              <div className="flex-1">
                <p className="text-xs text-[var(--color-text-secondary)]">تاريخ النهاية</p>
                <p className="text-sm font-bold text-[var(--color-text)]">
                  {new Date(offer.expires_at).toLocaleDateString('ar-SY', { year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2">
            <button
              onClick={handleGoToStore}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-[var(--color-surface)] text-sm font-bold transition-colors border"
              style={{ color: themeColor, borderColor: `${themeColor}30` }}
            >
              <StoreIcon className="w-4 h-4" />
              الانتقال إلى المتجر
            </button>
            <button
              onClick={() => setShowShareSheet(true)}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-white text-sm font-bold transition-colors shadow-md"
              style={{ background: `linear-gradient(135deg, ${themeFrom}, ${themeTo})`, boxShadow: `0 4px 14px ${themeColor}33` }}
            >
              <Share2 className="w-4 h-4" />
              مشاركة
            </button>
          </div>

          {/* Contest participation button */}
          {isContest && !timeInfo.isExpired && (
            <button
              onClick={() => toast.success('تم تسجيل مشاركتك بنجاح! ✨')}
              className="w-full mt-2 flex items-center justify-center gap-2 py-3 rounded-xl text-white text-sm font-bold transition-all shadow-md"
              style={{ background: `linear-gradient(to left, ${themeFrom}, ${themeTo})`, boxShadow: `0 4px 14px ${themeColor}33` }}
            >
              <Trophy className="w-4 h-4" />
              المشاركة في المسابقة
            </button>
          )}
        </div>
      </div>

      {/* Go to Store Banner */}
      <div className="px-4 mt-4">
        <button
          onClick={handleGoToStore}
          className="w-full rounded-2xl p-4 flex items-center gap-3 shadow-lg transition-shadow"
          style={{ background: `linear-gradient(to left, ${themeFrom}, ${themeTo})`, boxShadow: `0 4px 20px ${themeColor}25` }}
        >
          <div className="w-12 h-12 bg-[var(--color-surface)]/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
            <StoreIcon className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1 text-right">
            <p className="text-white font-bold text-sm">الانتقال إلى المتجر</p>
            <p className="text-white/60 text-xs">{offer.store_name || 'متجر'}</p>
          </div>
          <ArrowRight className="w-5 h-5 text-white/60" />
        </button>
      </div>

      {/* Comments Section */}
      <div className="px-4 mt-4">
        <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)]/60 shadow-sm p-4">
          <CommentsSection targetId={offer.id} targetType="offer" ownerId={offer.user_id} />
        </div>
      </div>

      {/* Share Sheet */}
      {offer && (
        <ShareSheet
          isOpen={showShareSheet}
          onClose={() => setShowShareSheet(false)}
          itemType={isContest ? 'contest' : 'offer'}
          itemId={offer.id}
          itemName={offer.title}
          itemDescription={offer.description}
          storeName={offer.store_name}
          imageUrl={offer.image_url}
          discount={offer.discount}
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
