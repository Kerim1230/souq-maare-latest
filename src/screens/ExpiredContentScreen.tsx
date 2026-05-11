'use client';
import React, { useState, useMemo } from 'react';
import {
  ArrowRight, Clock, RotateCcw, Trash2, Package, Tag,
  Calendar, Timer, AlertCircle, Inbox, CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/market/Button';
import { Modal } from '@/components/market/Modal';
import { useAppStore } from '@/store/appStore';
import { useAuthStore } from '@/store/authStore';
import { useAutoDeleteStore, getDurationLabel, type DurationDays, DURATION_OPTIONS, getExpiryDate } from '@/store/autoDeleteStore';
import type { Product } from '@/store/appStore';
import toast from 'react-hot-toast';
import { apiPost } from '@/lib/fetchApi';
import { formatDateFull, formatShortDateTime } from '@/lib/date-utils';

// ===== Main Component =====
export const ExpiredContentScreen: React.FC = () => {
  const user = useAuthStore(s => s.user);
  const setSubScreen = useAppStore(s => s.setSubScreen);
  const myStore = useAppStore(s => s.myStore);
  const rawExpiredContent = useAutoDeleteStore(s => s.expiredContent);
  const removeFromExpired = useAutoDeleteStore(s => s.removeFromExpired);
  const clearExpired = useAutoDeleteStore(s => s.clearExpired);
  const autoDeleteInitialize = useAutoDeleteStore(s => s.initialize);

  // Initialize on first render
  React.useEffect(() => {
    autoDeleteInitialize();
  }, [autoDeleteInitialize]);

  const userId = user?.id || '';
  const expiredItems = useMemo(() => rawExpiredContent.filter(i => i.userId === userId), [rawExpiredContent, userId]);

  const [republishItem, setRepublishItem] = useState<(typeof expiredItems)[number] | null>(null);
  const [selectedDuration, setSelectedDuration] = useState<DurationDays>(7);
  const [republishing, setRepublishing] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // ===== Handlers =====
  const handleRepublish = async () => {
    if (!republishItem || !myStore) {
      toast.error('لا يوجد متجر مرتبط بحسابك');
      return;
    }

    setRepublishing(true);
    try {
      const expiresAt = getExpiryDate(selectedDuration);

      if (republishItem.contentType === 'product') {
        const productData = republishItem.contentData as Partial<Product>;
        const { error: republishError } = await apiPost('/api/my-store', {
          storeId: myStore.id,
          name: republishItem.contentName,
          description: productData.description || '',
          price: productData.price || 0,
          image: productData.image_url || '',
          category: productData.category || '',
          expiresAt,
        });

        if (republishError) {
          toast.error(republishError);
          return;
        }
      } else {
        const offerData = republishItem.contentData as Record<string, unknown>;
        const { error: offerError } = await apiPost('/api/my-store/offers', {
          storeId: myStore.id,
          title: republishItem.contentName,
          description: offerData?.description || '',
          image: offerData?.image_url || '',
          type: offerData?.type || 'discount',
          discount: offerData?.discount || 0,
          expiresAt,
        });

        if (offerError) {
          toast.error(offerError);
          return;
        }
      }

      // Remove from expired list
      removeFromExpired(republishItem.id);
      toast.success('تم إعادة النشر بنجاح ✓');
      setRepublishItem(null);
      setSelectedDuration(7);
    } catch {
      toast.error('تعذر الاتصال بالخادم');
    } finally {
      setRepublishing(false);
    }
  };

  const handleClearAll = async () => {
    setClearing(true);
    try {
      clearExpired(userId);
      toast.success('تم مسح السجل بنجاح');
      setShowClearConfirm(false);
    } catch {
      toast.error('حدث خطأ أثناء المسح');
    } finally {
      setClearing(false);
    }
  };

  // ===== Stats =====
  const productCount = expiredItems.filter(i => i.contentType === 'product').length;
  const offerCount = expiredItems.filter(i => i.contentType === 'offer').length;

  return (
    <div className="pb-14 min-h-[100dvh] bg-[var(--color-bg)]">
      {/* ===== Header ===== */}
      <div className="gradient-dark px-5 pt-8 pb-[4.5rem] relative overflow-hidden">
        <div className="absolute top-[-40px] right-[-30px] w-[180px] h-[180px] rounded-full bg-teal-600/15 blur-[60px]" />
        <div className="absolute bottom-[-30px] left-[-20px] w-[120px] h-[120px] rounded-full bg-emerald-500/10 blur-[50px]" />
        <div className="relative z-10 flex items-center justify-between">
          <div>
            <h1 className="text-white text-[20px] font-black">المحتوى المنتهي</h1>
            <p className="text-teal-300 dark:text-teal-600/50 text-[12px] mt-0.5">إدارة المحتوى منتهي الصلاحية</p>
          </div>
          <button
            onClick={() => setSubScreen('none')}
            className="w-10 h-10 bg-[var(--color-surface)]/10 backdrop-blur-sm rounded-xl flex items-center justify-center active:bg-[var(--color-surface)]/20"
          >
            <ArrowRight className="w-[18px] h-[18px] text-teal-300 dark:text-teal-600/70" />
          </button>
        </div>
      </div>

      {/* ===== Content ===== */}
      <div className="px-4 -mt-10 relative z-10">

        {/* Stats Cards */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="bg-[var(--color-surface)] rounded-2xl p-3 shadow-sm border border-[var(--color-border)] text-center">
            <div className="w-9 h-9 rounded-xl bg-rose-50 dark:bg-rose-900/20 flex items-center justify-center mx-auto mb-1.5">
              <Clock className="w-4.5 h-4.5 text-rose-400" />
            </div>
            <p className="text-[15px] font-black text-[var(--color-text)]">{expiredItems.length}</p>
            <p className="text-[10px] text-[var(--color-text-tertiary)] font-semibold">الإجمالي</p>
          </div>
          <div className="bg-[var(--color-surface)] rounded-2xl p-3 shadow-sm border border-[var(--color-border)] text-center">
            <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center mx-auto mb-1.5">
              <Package className="w-4.5 h-4.5 text-amber-400" />
            </div>
            <p className="text-[15px] font-black text-[var(--color-text)]">{productCount}</p>
            <p className="text-[10px] text-[var(--color-text-tertiary)] font-semibold">منتجات</p>
          </div>
          <div className="bg-[var(--color-surface)] rounded-2xl p-3 shadow-sm border border-[var(--color-border)] text-center">
            <div className="w-9 h-9 rounded-xl bg-purple-50 dark:bg-purple-900/20 dark:bg-purple-900/20 flex items-center justify-center mx-auto mb-1.5">
              <Tag className="w-4.5 h-4.5 text-purple-400" />
            </div>
            <p className="text-[15px] font-black text-[var(--color-text)]">{offerCount}</p>
            <p className="text-[10px] text-[var(--color-text-tertiary)] font-semibold">عروض</p>
          </div>
        </div>

        {/* Section Header */}
        <div className="flex items-center justify-between px-1 pb-2">
          <p className="text-[10px] font-bold text-emerald-300 dark:text-emerald-600 tracking-wide uppercase">
            القائمة
          </p>
          {expiredItems.length > 0 && (
            <button
              onClick={() => setShowClearConfirm(true)}
              className="text-[11px] font-bold text-rose-400 active:text-rose-600 dark:text-rose-400 flex items-center gap-1"
            >
              <Trash2 className="w-3.5 h-3.5" />
              مسح الكل
            </button>
          )}
        </div>

        {/* ===== Empty State ===== */}
        {expiredItems.length === 0 && (
          <div className="bg-[var(--color-surface)] rounded-2xl shadow-sm border border-[var(--color-border)] overflow-hidden">
            <div className="p-8 text-center">
              {/* Illustration */}
              <div className="relative w-24 h-24 mx-auto mb-4">
                <div className="absolute inset-0 rounded-full bg-emerald-50/80 flex items-center justify-center">
                  <Inbox className="w-10 h-10 text-emerald-200" />
                </div>
                <div className="absolute -bottom-1 -left-1 w-10 h-10 rounded-xl bg-emerald-100/80 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                </div>
              </div>
              <p className="text-[15px] font-black text-[var(--color-text)] mb-1">لا يوجد محتوى منتهي</p>
              <p className="text-[12px] text-[var(--color-text-tertiary)] leading-relaxed">
                جميع منتجاتك وعروضك نشطة ولا توجد عناصر منتهية الصلاحية
              </p>
              <div className="mt-4 flex justify-center">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSubScreen('none')}
                  icon={<ArrowRight className="w-4 h-4" />}
                >
                  العودة
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ===== Expired Items List ===== */}
        {expiredItems.length > 0 && (
          <div className="space-y-3">
            {expiredItems.map((item) => {
              const isProduct = item.contentType === 'product';
              const productData = item.contentData as Partial<Product>;
              return (
                <div
                  key={item.id}
                  className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] shadow-sm overflow-hidden"
                >
                  {/* Card shimmer */}
                  <div className="h-0.5 bg-gradient-to-l from-slate-200/60 via-slate-100/40 to-transparent" />

                  <div className="p-4">
                    <div className="flex items-start gap-3">
                      {/* Type Icon */}
                      <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        isProduct
                          ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-500 dark:text-amber-400'
                          : 'bg-purple-50 dark:bg-purple-900/20 dark:bg-purple-900/20 text-purple-500'
                      }`}>
                        {isProduct
                          ? <Package className="w-5 h-5" />
                          : <Tag className="w-5 h-5" />
                        }
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        {/* Name & Badge */}
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-[13px] font-bold text-[var(--color-text)] truncate">
                            {item.contentName}
                          </p>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${
                            isProduct
                              ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border border-amber-100/60'
                              : 'bg-purple-50 dark:bg-purple-900/20 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 border border-purple-100/60'
                          }`}>
                            {isProduct ? 'منتج' : 'عرض'}
                          </span>
                        </div>

                        {/* Details */}
                        <div className="flex items-center gap-3 mt-1.5">
                          <div className="flex items-center gap-1">
                            <Timer className="w-3 h-3 text-[var(--color-text-tertiary)]" />
                            <span className="text-[11px] text-[var(--color-text-tertiary)]">
                              {getDurationLabel(item.originalDuration)}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-[var(--color-text-tertiary)]" />
                            <span className="text-[11px] text-[var(--color-text-tertiary)]">
                              {formatShortDateTime(item.expiredAt)}
                            </span>
                          </div>
                        </div>

                        {/* Product price if available */}
                        {isProduct && productData.price ? (
                          <p className="text-[11px] text-[var(--color-text-tertiary)] mt-1">
                            السعر: <span className="font-bold text-emerald-700">{productData.price.toLocaleString('ar-SY')}</span> ل.س
                          </p>
                        ) : null}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[var(--color-border)]/60">
                      {/* Re-publish Button */}
                      <button
                        onClick={() => {
                          setRepublishItem(item);
                          setSelectedDuration(7);
                        }}
                        className="flex-1 flex items-center justify-center gap-1.5 gradient-primary text-white text-[12px] font-bold py-2.5 rounded-xl shadow-sm shadow-emerald-500/15 active:scale-[0.98] transition-transform"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        إعادة النشر
                      </button>

                      {/* Remove Button */}
                      <button
                        onClick={() => {
                          removeFromExpired(item.id);
                          toast.success('تم الحذف من السجل');
                        }}
                        className="w-10 h-10 flex items-center justify-center rounded-xl bg-rose-50 dark:bg-rose-900/20 text-rose-400 active:bg-rose-100 dark:bg-rose-900/30 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ===== No Store Warning ===== */}
        {!myStore && expiredItems.length > 0 && (
          <div className="mt-4 bg-amber-50/ dark:bg-amber-900/20/60 rounded-2xl p-4 border border-amber-100/50">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-500 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-[13px] font-bold text-amber-800 dark:text-amber-200">لا يوجد متجر</p>
                <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1 leading-relaxed">
                  يجب إنشاء متجر أولاً قبل إعادة نشر المحتوى المنتهي
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="text-center pt-5 pb-4">
          <p className="text-[11px] gradient-text-primary font-semibold">سوق شامل الإلكتروني</p>
          <p className="text-[10px] text-[var(--color-text-tertiary)] mt-0.5">إدارة المحتوى المنتهي</p>
        </div>
      </div>

      {/* ===== Re-publish Modal ===== */}
      <Modal
        isOpen={!!republishItem}
        onClose={() => {
          setRepublishItem(null);
          setSelectedDuration(7);
        }}
        title="إعادة النشر"
      >
        {republishItem && (
          <div className="space-y-4">
            {/* Item Info */}
            <div className="bg-emerald-50/40 dark:bg-emerald-900/20 rounded-xl p-3.5 border border-emerald-100/40 dark:border-emerald-800/30">
              <div className="flex items-center gap-2.5">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  republishItem.contentType === 'product'
                    ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600'
                    : 'bg-purple-100 text-purple-600'
                }`}>
                  {republishItem.contentType === 'product'
                    ? <Package className="w-5 h-5" />
                    : <Tag className="w-5 h-5" />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-bold text-[var(--color-text)] truncate">
                    {republishItem.contentName}
                  </p>
                  <p className="text-[11px] text-[var(--color-text-tertiary)] mt-0.5">
                    كان ينتهي في {formatDateFull(republishItem.expiredAt)}
                  </p>
                </div>
              </div>
            </div>

            {/* Duration Picker */}
            <div>
              <p className="text-[12px] font-bold text-[var(--color-text)] mb-2.5">اختر مدة النشر الجديدة</p>
              <div className="grid grid-cols-2 gap-2">
                {DURATION_OPTIONS.map((option) => {
                  const isSelected = selectedDuration === option.days;
                  return (
                    <button
                      key={option.days}
                      onClick={() => setSelectedDuration(option.days)}
                      className={`relative py-2.5 px-3 rounded-xl text-[12px] font-bold transition-all duration-150 ${
                        isSelected
                          ? 'gradient-primary text-white shadow-md shadow-emerald-500/20'
                          : 'bg-emerald-50/60 dark:bg-emerald-900/20 text-emerald-700 border border-emerald-100/60 active:bg-emerald-100'
                      }`}
                    >
                      {option.label}
                      {isSelected && (
                        <CheckCircle2 className="w-3.5 h-3.5 absolute top-1.5 left-1.5" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Expiry Preview */}
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 border border-slate-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[var(--color-text-tertiary)]" />
                  <span className="text-[12px] text-[var(--color-text-secondary)] font-semibold">تاريخ الانتهاء</span>
                </div>
                <span className="text-[12px] font-bold text-emerald-700">
                  {formatDateFull(getExpiryDate(selectedDuration))}
                </span>
              </div>
            </div>

            {/* Action */}
            {!myStore ? (
              <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-3.5 border border-amber-100">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-500 dark:text-amber-400 flex-shrink-0" />
                  <p className="text-[12px] font-bold text-amber-700">
                    يجب إنشاء متجر أولاً لإعادة النشر
                  </p>
                </div>
              </div>
            ) : (
              <Button
                variant="primary"
                fullWidth
                size="lg"
                loading={republishing}
                onClick={handleRepublish}
                icon={<RotateCcw className="w-5 h-5" />}
              >
                إعادة النشر — {getDurationLabel(selectedDuration)}
              </Button>
            )}
          </div>
        )}
      </Modal>

      {/* ===== Clear All Confirm Modal ===== */}
      <Modal
        isOpen={showClearConfirm}
        onClose={() => setShowClearConfirm(false)}
        title="مسح السجل"
        size="sm"
      >
        <div className="space-y-4">
          {/* Warning */}
          <div className="bg-rose-50 dark:bg-rose-900/20/60 rounded-xl p-4 border border-rose-100/50">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-5 h-5 text-rose-500 dark:text-rose-400" />
              </div>
              <div>
                <p className="text-[13px] font-bold text-rose-800">هل أنت متأكد؟</p>
                <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-1 leading-relaxed">
                  سيتم حذف جميع سجلات المحتوى المنتهي نهائياً. هذا الإجراء لا يمكن التراجع عنه.
                </p>
              </div>
            </div>
          </div>

          {/* Count */}
          <div className="text-center">
            <p className="text-[12px] text-[var(--color-text-tertiary)]">
              عدد العناصر: <span className="font-bold text-[var(--color-text)]">{expiredItems.length}</span>
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              fullWidth
              onClick={() => setShowClearConfirm(false)}
            >
              إلغاء
            </Button>
            <Button
              variant="danger"
              size="sm"
              fullWidth
              loading={clearing}
              onClick={handleClearAll}
              icon={<Trash2 className="w-4 h-4" />}
            >
              مسح الكل
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
