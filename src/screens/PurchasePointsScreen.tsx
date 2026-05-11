'use client';
import React, { useState, useEffect, useMemo } from 'react';
import {
  ArrowRight, Coins, Copy, QrCode, Hash, CheckCircle2,
  Clock, XCircle, AlertCircle, Receipt, Wallet, Info
} from 'lucide-react';
import { Button } from '@/components/market/Button';
import { Input } from '@/components/market/Input';
import { ImageUploader } from '@/components/market/ImageUploader';
import { usePointsStore, canSubmit, checkSubmitCooldown, type OrderStatus } from '@/store/pointsStore';
import { useAuthStore } from '@/store/authStore';
import { useAppStore } from '@/store/appStore';
import toast from 'react-hot-toast';
import { formatShortDateTime } from '@/lib/date-utils';

const PRESET_AMOUNTS = [100, 250, 500, 1000, 5000, 10000];

const statusConfig: Record<OrderStatus, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  pending: { label: 'قيد المراجعة', color: 'text-amber-700', bg: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200', icon: <Clock className="w-3.5 h-3.5" /> },
  approved: { label: 'تمت الموافقة', color: 'text-emerald-700', bg: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200', icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  rejected: { label: 'مرفوض', color: 'text-rose-700', bg: 'bg-rose-50 dark:bg-rose-900/20 border-rose-200', icon: <XCircle className="w-3.5 h-3.5" /> },
};

export const PurchasePointsScreen: React.FC = () => {
  const user = useAuthStore(s => s.user);
  const setSubScreen = useAppStore(s => s.setSubScreen);
  const shamCashSettings = usePointsStore(s => s.shamCashSettings);
  const pointsInitialize = usePointsStore(s => s.initialize);
  const createOrder = usePointsStore(s => s.createOrder);
  const orders = usePointsStore(s => s.orders);

  // State
  const [selectedPoints, setSelectedPoints] = useState<number>(0);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [isCustom, setIsCustom] = useState(false);
  const [paymentCode, setPaymentCode] = useState('');
  const [receiptImage, setReceiptImage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Initialize store on mount
  useEffect(() => {
    pointsInitialize(user?.id);
  }, [pointsInitialize, user?.id]);

  // Active points amount (preset or custom)
  const activePoints = useMemo(() => {
    if (isCustom) {
      const parsed = parseInt(customAmount, 10);
      return isNaN(parsed) || parsed < 0 ? 0 : parsed;
    }
    return selectedPoints;
  }, [selectedPoints, customAmount, isCustom]);

  // Calculated total price
  const totalPrice = useMemo(() => {
    return activePoints * shamCashSettings.pointPrice;
  }, [activePoints, shamCashSettings.pointPrice]);

  // User's orders (reactive selector)
  const userOrders = useMemo(() => {
    if (!user) return [];
    return orders.filter(o => o.userId === user.id);
  }, [user, orders]);

  // Handle preset selection
  const handlePresetSelect = (amount: number) => {
    setIsCustom(false);
    setCustomAmount('');
    setSelectedPoints(amount);
  };

  // Handle custom input
  const handleCustomInput = (value: string) => {
    setIsCustom(true);
    setSelectedPoints(0);
    setCustomAmount(value);
  };

  // Copy to clipboard
  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('تم النسخ');
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      toast.success('تم النسخ');
    }
  };

  // Format number with Arabic-Syrian locale
  const formatNumber = (num: number) => num.toLocaleString('ar-SY');

  // Submit order
  const handleSubmit = async () => {
    if (!user) {
      toast.error('يجب تسجيل الدخول أولاً');
      return;
    }

    // Validation
    if (activePoints <= 0) {
      toast.error('يرجى اختيار كمية النقاط');
      return;
    }

    if (!paymentCode.trim()) {
      toast.error('يرجى إدخال رمز عملية الدفع');
      return;
    }

    if (!receiptImage) {
      toast.error('يرجى رفع صورة إيصال الدفع');
      return;
    }

    // Rate limiting
    if (!canSubmit()) {
      const cooldown = checkSubmitCooldown();
      toast.error(`يرجى الانتظار ${Math.ceil(cooldown / 1000)} ثانية قبل إعادة المحاولة`);
      return;
    }

    setSubmitting(true);
    try {
      // Simulate a small delay for UX
      await new Promise((resolve) => setTimeout(resolve, 500));

      createOrder(
        user.id,
        user.full_name || user.email,
        user.email,
        activePoints,
        paymentCode.trim(),
        receiptImage
      );

      toast.success('تم إرسال طلب شراء النقاط بنجاح!');

      // Reset form
      setSelectedPoints(0);
      setCustomAmount('');
      setIsCustom(false);
      setPaymentCode('');
      setReceiptImage(null);

      // Navigate back to wallet
      setSubScreen('wallet');
    } catch {
      toast.error('حدث خطأ أثناء إرسال الطلب. يرجى المحاولة مرة أخرى.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="pb-14 min-h-[100dvh] bg-[var(--color-bg)]">
      {/* ===== Header ===== */}
      <div className="gradient-dark px-5 pt-8 pb-[4.5rem] relative overflow-hidden">
        <div className="absolute top-[-40px] right-[-30px] w-[180px] h-[180px] rounded-full bg-teal-600/15 blur-[60px]" />
        <div className="absolute bottom-[-20px] left-[-20px] w-[120px] h-[120px] rounded-full bg-amber-500/10 blur-[50px]" />
        <div className="relative z-10 flex items-center gap-3">
          <button
            onClick={() => setSubScreen('wallet')}
            className="w-10 h-10 bg-[var(--color-surface)]/10 backdrop-blur-sm rounded-xl flex items-center justify-center hover:bg-[var(--color-surface)]/20 transition-colors"
          >
            <ArrowRight className="w-5 h-5 text-teal-300" />
          </button>
          <div className="flex-1">
            <h1 className="text-white text-[20px] font-black">شراء النقاط</h1>
            <p className="text-teal-300 dark:text-teal-600/50 text-[12px] mt-0.5">إضافة نقاط إلى محفظتك عبر شام كاش</p>
          </div>
          <div className="w-10 h-10 bg-amber-500/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
            <Coins className="w-5 h-5 text-amber-400" />
          </div>
        </div>
      </div>

      <div className="px-4 -mt-10 relative z-10 space-y-4">
        {/* ===== Info Banner ===== */}
        <div className="bg-[var(--color-surface)] rounded-2xl p-4 shadow-sm border border-[var(--color-border)]">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl flex items-center justify-center flex-shrink-0">
              <Info className="w-5 h-5 text-emerald-500" />
            </div>
            <div className="flex-1">
              <h3 className="text-[14px] font-bold text-[var(--color-text)]">كيفية الشراء؟</h3>
              <p className="text-[12px] text-[var(--color-text-secondary)] mt-1 leading-relaxed">
                قم بتحويل المبلغ المطلوب عبر شام كاش إلى الحساب الموضح أدناه، ثم أدخل رمز العملية وارفع إيصال الدفع.
              </p>
            </div>
          </div>
          <div className="mt-3 bg-gradient-to-l from-emerald-50 dark:from-emerald-900/20 to-teal-50/60 rounded-xl px-4 py-3 border border-emerald-100/60">
            <div className="flex items-center justify-center gap-2">
              <Coins className="w-4 h-4 text-emerald-500" />
              <span className="text-[15px] font-black gradient-text-primary">
                كل نقطة = {formatNumber(shamCashSettings.pointPrice)} ليرة سورية
              </span>
            </div>
          </div>
        </div>

        {/* ===== Quick Select Points ===== */}
        <div className="bg-[var(--color-surface)] rounded-2xl p-4 shadow-sm border border-[var(--color-border)]">
          <h3 className="text-[14px] font-bold text-[var(--color-text)] mb-3">اختر كمية النقاط</h3>

          {/* Preset Grid */}
          <div className="grid grid-cols-3 gap-2.5 mb-4">
            {PRESET_AMOUNTS.map((amount) => {
              const isSelected = !isCustom && selectedPoints === amount;
              const price = amount * shamCashSettings.pointPrice;
              return (
                <button
                  key={amount}
                  onClick={() => handlePresetSelect(amount)}
                  className={`
                    relative rounded-xl py-3 px-2 text-center transition-all duration-200
                    ${isSelected
                      ? 'gradient-primary text-white shadow-md shadow-emerald-500/25 ring-2 ring-emerald-400/40'
                      : 'bg-emerald-50/50 border border-emerald-100/80 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-50 dark:bg-emerald-900/20 hover:border-emerald-200 dark:border-emerald-700 active:scale-[0.97]'
                    }
                  `}
                >
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <Coins className={`w-3.5 h-3.5 ${isSelected ? 'text-emerald-200' : 'text-emerald-400'}`} />
                    <span className="text-[16px] font-black">{formatNumber(amount)}</span>
                  </div>
                  <span className={`text-[10px] font-semibold ${isSelected ? 'text-emerald-200' : 'text-[var(--color-text-tertiary)]'}`}>
                    {formatNumber(price)} ل.س
                  </span>
                  {isSelected && (
                    <div className="absolute -top-1.5 -left-1.5 w-5 h-5 bg-[var(--color-surface)] rounded-full flex items-center justify-center shadow-sm">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Custom Amount */}
          <div>
            <label className="text-[12px] font-bold text-[var(--color-text-tertiary)] block mb-1.5">أو أدخل كمية مخصصة</label>
            <Input
              type="number"
              placeholder="أدخل عدد النقاط"
              value={customAmount}
              onChange={(e) => handleCustomInput(e.target.value)}
              icon={<Wallet className="w-4 h-4" />}
              min={0}
            />
          </div>
        </div>

        {/* ===== Order Summary ===== */}
        {activePoints > 0 && (
          <div className="bg-[var(--color-surface)] rounded-2xl p-4 shadow-sm border border-[var(--color-border)]">
            <div className="flex items-center gap-2 mb-3">
              <Receipt className="w-4 h-4 text-emerald-500" />
              <h3 className="text-[14px] font-bold text-[var(--color-text)]">ملخص الطلب</h3>
            </div>
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-[var(--color-text-secondary)]">عدد النقاط</span>
                <span className="text-[14px] font-bold text-emerald-800 dark:text-emerald-300">{formatNumber(activePoints)} نقطة</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-[var(--color-text-secondary)]">سعر النقطة</span>
                <span className="text-[14px] font-bold text-emerald-800 dark:text-emerald-300">{formatNumber(shamCashSettings.pointPrice)} ل.س</span>
              </div>
              <div className="border-t border-dashed border-emerald-100 dark:border-emerald-800 pt-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[15px] font-black text-[var(--color-text)]">المجموع</span>
                  <span className="text-[20px] font-black gradient-text-primary">
                    {formatNumber(totalPrice)} ل.س
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===== Payment Section ===== */}
        <div className="bg-[var(--color-surface)] rounded-2xl p-4 shadow-sm border border-[var(--color-border)]">
          <div className="flex items-center gap-2 mb-3">
            <QrCode className="w-4 h-4 text-emerald-500" />
            <h3 className="text-[14px] font-bold text-[var(--color-text)]">بيانات التحويل</h3>
          </div>

          <div className="space-y-3">
            {/* Recipient Name */}
            <div className="bg-emerald-50/40 dark:bg-emerald-900/20 rounded-xl p-3 border border-emerald-100/50">
              <p className="text-[11px] text-[var(--color-text-tertiary)] font-semibold mb-1">اسم المستلم</p>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[14px] font-bold text-[var(--color-text)] truncate">
                  {shamCashSettings.recipientName}
                </span>
                <button
                  onClick={() => handleCopy(shamCashSettings.recipientName)}
                  className="w-8 h-8 bg-emerald-100/60 rounded-lg flex items-center justify-center hover:bg-emerald-100 dark:bg-emerald-900/30 transition-colors flex-shrink-0"
                >
                  <Copy className="w-3.5 h-3.5 text-emerald-600" />
                </button>
              </div>
            </div>

            {/* Account Number */}
            <div className="bg-emerald-50/40 dark:bg-emerald-900/20 rounded-xl p-3 border border-emerald-100/50">
              <p className="text-[11px] text-[var(--color-text-tertiary)] font-semibold mb-1">رقم الحساب</p>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[14px] font-bold text-[var(--color-text)] tracking-wider" dir="ltr">
                  {shamCashSettings.accountNumber}
                </span>
                <button
                  onClick={() => handleCopy(shamCashSettings.accountNumber)}
                  className="w-8 h-8 bg-emerald-100/60 rounded-lg flex items-center justify-center hover:bg-emerald-100 dark:bg-emerald-900/30 transition-colors flex-shrink-0"
                >
                  <Copy className="w-3.5 h-3.5 text-emerald-600" />
                </button>
              </div>
            </div>

            {/* QR Image */}
            {shamCashSettings.qrImage && (
              <div className="flex justify-center pt-1">
                <div className="bg-[var(--color-surface)] rounded-xl p-3 border border-emerald-100/50 shadow-sm">
                  <img
                    src={shamCashSettings.qrImage}
                    alt="رمز QR للدفع"
                    className="w-36 h-36 object-contain"
                  />
                  <p className="text-[10px] text-center text-[var(--color-text-tertiary)] mt-1.5 font-medium">امسح الرمز للدفع</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ===== Payment Details Form ===== */}
        <div className="bg-[var(--color-surface)] rounded-2xl p-4 shadow-sm border border-[var(--color-border)]">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className="w-4 h-4 text-emerald-500" />
            <h3 className="text-[14px] font-bold text-[var(--color-text)]">تأكيد الدفع</h3>
          </div>

          <div className="space-y-4">
            {/* Payment Code */}
            <Input
              label="رمز عملية الدفع"
              value={paymentCode}
              onChange={(e) => setPaymentCode(e.target.value)}
              placeholder="أدخل رمز التحويل"
              icon={<Hash className="w-4 h-4" />}
            />

            {/* Receipt Image */}
            <ImageUploader
              label="صورة إيصال الدفع"
              value={receiptImage}
              onChange={setReceiptImage}
              height="h-32"
            />

            <div className="bg-amber-50/ dark:bg-amber-900/20/50 rounded-xl p-3 border border-amber-100/40">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-500 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <p className="text-[11px] text-amber-700 leading-relaxed">
                  تأكد من صحة رمز العملية وصورة الإيصال قبل الإرسال. سيتم مراجعة طلبك في أقرب وقت.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ===== Submit Button ===== */}
        <Button
          variant="primary"
          fullWidth
          size="lg"
          loading={submitting}
          disabled={activePoints <= 0 || !paymentCode.trim() || !receiptImage || submitting}
          onClick={handleSubmit}
          icon={<Wallet className="w-5 h-5" />}
        >
          {activePoints > 0
            ? `تم الدفع — ${formatNumber(totalPrice)} ل.س`
            : 'تم الدفع'
          }
        </Button>

        {/* ===== My Orders ===== */}
        {userOrders.length > 0 && (
          <div className="bg-[var(--color-surface)] rounded-2xl p-4 shadow-sm border border-[var(--color-border)]">
            <div className="flex items-center gap-2 mb-3">
              <Receipt className="w-4 h-4 text-emerald-500" />
              <h3 className="text-[14px] font-bold text-[var(--color-text)]">طلباتي</h3>
              <span className="text-[11px] font-bold text-[var(--color-text-tertiary)] bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                {userOrders.length}
              </span>
            </div>

            <div className="space-y-2.5">
              {userOrders.map((order) => {
                const status = statusConfig[order.status];
                return (
                  <div
                    key={order.id}
                    className="bg-gradient-to-l from-emerald-50/30 to-transparent rounded-xl p-3 border border-emerald-100/40 dark:border-emerald-800/30"
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[14px] font-bold text-[var(--color-text)]">
                            {formatNumber(order.points)} نقطة
                          </span>
                          <span className="text-[11px] text-[var(--color-text-tertiary)]">
                            ({formatNumber(order.amount)} ل.س)
                          </span>
                        </div>
                        <p className="text-[10px] text-[var(--color-text-tertiary)] mt-0.5">
                          {formatShortDateTime(order.createdAt)}
                        </p>
                      </div>
                      <div className={`flex items-center gap-1 px-2.5 py-1 rounded-full border text-[11px] font-bold ${status.color} ${status.bg}`}>
                        {status.icon}
                        {status.label}
                      </div>
                    </div>

                    {/* Rejection reason */}
                    {order.status === 'rejected' && order.rejectionReason && (
                      <div className="bg-rose-50 dark:bg-rose-900/20 rounded-lg p-2.5 border border-rose-100/60">
                        <p className="text-[11px] text-rose-600 dark:text-rose-400 leading-relaxed">
                          <span className="font-bold">سبب الرفض: </span>
                          {order.rejectionReason}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Footer spacer */}
        <div className="h-4" />
      </div>
    </div>
  );
};
