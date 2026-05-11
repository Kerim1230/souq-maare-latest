'use client';
import React, { useState, useEffect, useMemo } from 'react';
import {
  ArrowRight, ShoppingCart, History, Shield, LayoutDashboard,
  TrendingUp, ArrowDownLeft, Clock, CheckCircle,
  AlertTriangle, Wallet, Plus, Minus, Award, RefreshCw,
  ChevronLeft, X,
} from 'lucide-react';
import { Button } from '@/components/market/Button';
import { Modal } from '@/components/market/Modal';
import { usePointsStore, Transaction } from '@/store/pointsStore';
import { useAuthStore } from '@/store/authStore';
import { useAppStore } from '@/store/appStore';
import { useVerificationStore } from '@/store/verificationStore';
import toast from 'react-hot-toast';
import { formatDateShort, formatDateFull } from '@/lib/date-utils';
import { apiPut } from '@/lib/fetchApi';
import { VERIFICATION_PLANS, getPlan, type VerificationTier } from '@/lib/constants';

// ===== Constants =====

// ✅ FIX BUG-H2: Stable empty wallet object — prevents re-render loop
// when no wallet data exists yet (Zustand uses Object.is comparison)
const EMPTY_WALLET: import('@/store/pointsStore').Wallet = {
  userId: '', balance: 0, totalUsed: 0, totalPurchased: 0,
};

// ===== Transaction Type Helpers =====
function getTransactionIcon(type: Transaction['type']) {
  switch (type) {
    case 'purchase':
    case 'admin_add':
      return <ArrowDownLeft className="w-4 h-4 text-emerald-500" />;
    case 'verification_deduct':
      return <Shield className="w-4 h-4 text-amber-500 dark:text-amber-400" />;
    case 'admin_reject':
      return <X className="w-4 h-4 text-rose-400" />;
    case 'refund':
      return <RefreshCw className="w-4 h-4 text-blue-500 dark:text-blue-400" />;
    default:
      return <Clock className="w-4 h-4 text-[var(--color-text-tertiary)]" />;
  }
}

function getTransactionTypeLabel(type: Transaction['type']) {
  switch (type) {
    case 'purchase': return 'شراء';
    case 'admin_add': return 'إضافة';
    case 'verification_deduct': return 'توثيق';
    case 'admin_reject': return 'رفض';
    case 'refund': return 'استرداد';
    default: return type;
  }
}

// ===== Main Component =====
export const WalletScreen: React.FC = () => {
  const user = useAuthStore(s => s.user);
  const setSubScreen = useAppStore(s => s.setSubScreen);
  const myStore = useAppStore(s => s.myStore);
  const pointsInitialize = usePointsStore(s => s.initialize);

  // ✅ FIX BUG-H2: Stable wallet selector with stable fallback reference
  // Previously, the inline fallback created a NEW object every render,
  // causing re-renders even when wallet state hadn't changed.
  const walletKey = user?.id || '';
  const wallet = usePointsStore(s => s.wallets[walletKey] || EMPTY_WALLET);

  // Reactive transactions selector — subscribes to raw array, useMemo for filtering
  const allTransactions = usePointsStore(s => s.transactions);
  const transactions = useMemo(() =>
    allTransactions.filter(t => t.userId === (user?.id || '')).slice(0, 5),
    [allTransactions, user?.id]
  );

  // Reactive verification selectors (from verificationStore state, not getters)
  const storeVerification = useVerificationStore(s => myStore ? s.verifications[myStore.id] || null : null);
  const storeVerified = useMemo(() => {
    if (!storeVerification) return false;
    return storeVerification.isActive && !!storeVerification.endDate && new Date(storeVerification.endDate) > new Date();
  }, [storeVerification]);
  const verificationStatus = useMemo(() => {
    if (!storeVerification || !storeVerification.isActive || !storeVerification.endDate) {
      return null;
    }
    const endDate = new Date(storeVerification.endDate);
    const now = new Date();
    const isVerified = endDate > now;
    const daysRemaining = isVerified ? Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : 0;
    return {
      isVerified,
      daysRemaining: isVerified ? daysRemaining : null,
      expiresAt: isVerified ? storeVerification.endDate : null,
    };
  }, [storeVerification]);

  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [selectedTier, setSelectedTier] = useState<VerificationTier>('bronze');

  // ✅ Initialize points store on mount (one-time)
  useEffect(() => {
    pointsInitialize(user?.id);
  }, [pointsInitialize, user?.id]);

  // Admin check
  const isAdmin = user?.is_admin === true;

  // Verification expiry (computed from reactive verificationStatus)
  const verificationExpiry = verificationStatus
    ? { isExpired: !verificationStatus.isVerified, daysRemaining: verificationStatus.daysRemaining || 0 }
    : { isExpired: true, daysRemaining: 0 };

  // ===== Handlers =====
  const handleVerification = () => {
    if (!myStore) {
      toast.error('لا يوجد متجر مرتبط بحسابك');
      return;
    }
    setShowVerificationModal(true);
  };

  const handlePurchaseVerification = async () => {
    if (!user || !myStore) return;
    const plan = getPlan(selectedTier);
    const cost = plan.costPerMonth;
    if (wallet.balance < cost) {
      toast.error('رصيدك غير كاف، قم بشراء نقاط أولاً');
      return;
    }
    setVerifying(true);
    try {
      // ── Server-first approach: /api/stores/verify handles EVERYTHING ──
      // It checks auth, verifies ownership, deducts points, updates the store,
      // and creates/updates the verification record — all in one atomic request.
      const { data, error: verifyError } = await apiPut<{ store: any; tier: VerificationTier; verification?: any }>('/api/stores/verify', {
        storeId: myStore.id,
        isVerified: true,
        tier: selectedTier,
      });

      if (verifyError) {
        // Always refresh wallet on error — points may have been deducted
        // server-side even if the response was an error.
        await usePointsStore.getState().forceRefreshWallet(user.id);
        toast.error(verifyError);
        return;
      }

      // Force-refresh wallet balance (points were deducted server-side)
      // Using forceRefreshWallet to bypass the in-flight dedup guard.
      await usePointsStore.getState().forceRefreshWallet(user.id);

      // Update the app store with the verified store data
      if (data?.store) {
        useAppStore.getState().setMyStore(data.store);
      }

      // Update verification store
      if (data?.verification) {
        const verifications = { ...useVerificationStore.getState().verifications };
        verifications[myStore.id] = data.verification;
        useVerificationStore.setState({ verifications });
      } else {
        await useVerificationStore.getState().loadStoreVerification(myStore.id);
      }

      toast.success(`تم توثيق متجرك بنجاح بخطة ${plan.emoji} ${plan.nameAr} لمدة ${plan.durationDays} يوم!`);
      setShowVerificationModal(false);
    } catch {
      toast.error('حدث خطأ أثناء التوثيق');
    } finally {
      setVerifying(false);
    }
  };

  const handleRenewVerification = () => {
    setShowVerificationModal(true);
  };

  // ===== Quick Actions =====
  const quickActions = [
    {
      icon: <ShoppingCart className="w-5 h-5" />,
      label: 'شراء النقاط',
      desc: 'زيادة رصيدك',
      gradient: 'from-emerald-500 to-teal-500',
      shadowColor: 'shadow-emerald-500/20',
      onClick: () => setSubScreen('purchase-points'),
    },
    {
      icon: <History className="w-5 h-5" />,
      label: 'سجل العمليات',
      desc: 'جميع المعاملات',
      gradient: 'from-blue-500 to-cyan-500',
      shadowColor: 'shadow-blue-500/20',
      onClick: () => setSubScreen('transactions'),
    },
    {
      icon: <Shield className="w-5 h-5" />,
      label: 'توثيق متجري',
      desc: myStore ? (storeVerified ? 'مُوثّق ✓' : 'غير موثق') : 'لا يوجد متجر',
      gradient: myStore && storeVerified ? 'from-emerald-500 to-green-500' : 'from-amber-500 to-orange-500',
      shadowColor: myStore && storeVerified ? 'shadow-emerald-500/20' : 'shadow-amber-500/20',
      onClick: handleVerification,
    },
    ...(isAdmin ? [{
      icon: <LayoutDashboard className="w-5 h-5" />,
      label: 'لوحة التحكم',
      desc: 'إدارة النقاط',
      gradient: 'from-purple-500 to-violet-500',
      shadowColor: 'shadow-purple-500/20',
      onClick: () => setSubScreen('admin-dashboard'),
    }] : []),
  ];

  // ===== Stats Data =====
  const stats = [
    {
      icon: <TrendingUp className="w-4 h-4 text-emerald-500" />,
      value: wallet.totalPurchased.toLocaleString('ar-SY'),
      label: 'المشتريات',
      color: 'text-emerald-600',
      bg: 'bg-emerald-50 dark:bg-emerald-900/20',
    },
    {
      icon: <Minus className="w-4 h-4 text-amber-500 dark:text-amber-400" />,
      value: wallet.totalUsed.toLocaleString('ar-SY'),
      label: 'المستخدمة',
      color: 'text-amber-600',
      bg: 'bg-amber-50 dark:bg-amber-900/20',
    },
    {
      icon: <Wallet className="w-4 h-4 text-teal-500" />,
      value: wallet.balance.toLocaleString('ar-SY'),
      label: 'الرصيد الحالي',
      color: 'text-teal-600',
      bg: 'bg-teal-50',
    },
  ];

  return (
    <div className="pb-14 min-h-[100dvh] bg-[var(--color-bg)]">
      {/* Header */}
      <div className="gradient-dark px-5 pt-8 pb-[4.5rem] relative overflow-hidden">
        <div className="absolute top-[-40px] right-[-30px] w-[180px] h-[180px] rounded-full bg-teal-600/15 blur-[60px]" />
        <div className="absolute bottom-[-30px] left-[-20px] w-[120px] h-[120px] rounded-full bg-emerald-500/10 blur-[50px]" />
        <div className="relative z-10 flex items-center justify-between">
          <div>
            <h1 className="text-white text-[20px] font-black">محفظتي</h1>
            <p className="text-teal-300 dark:text-teal-600/50 text-[12px] mt-0.5">إدارة نقاطك</p>
          </div>
          <button
            onClick={() => setSubScreen('none')}
            className="w-10 h-10 bg-[var(--color-surface)]/10 backdrop-blur-sm rounded-xl flex items-center justify-center active:bg-[var(--color-surface)]/20"
          >
            <ArrowRight className="w-[18px] h-[18px] text-teal-300 dark:text-teal-600/70" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 -mt-10 relative z-10">
        {/* ===== Wallet Balance Card ===== */}
        <div className="bg-[var(--color-surface)] rounded-2xl shadow-sm border border-[var(--color-border)] overflow-hidden">
          {/* Top shimmer decoration */}
          <div className="gradient-card-shimmer h-1.5" />

          <div className="p-5">
            {/* Balance */}
            <div className="text-center mb-5">
              <p className="text-[11px] text-[var(--color-text-tertiary)] mb-1.5 font-semibold">رصيدك الحالي</p>
              <div className="flex items-center justify-center gap-2">
                <span className="text-[42px] font-black leading-none gradient-text-primary">
                  {wallet.balance.toLocaleString('ar-SY')}
                </span>
                <span className="text-[14px] text-[var(--color-text-tertiary)] font-semibold mt-3">نقطة</span>
              </div>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-3 gap-2">
              {stats.map((stat) => (
                <div
                  key={stat.label}
                  className={`${stat.bg} rounded-xl p-3 text-center border border-white/60`}
                >
                  <div className="flex justify-center mb-1.5">
                    {stat.icon}
                  </div>
                  <p className={`text-[15px] font-black ${stat.color}`}>{stat.value}</p>
                  <p className="text-[10px] text-[var(--color-text-tertiary)] mt-0.5 font-semibold">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ===== Quick Actions Grid ===== */}
        <div className="mt-4">
          <p className="text-[10px] font-bold text-emerald-300 dark:text-emerald-600 pb-2 px-1 tracking-wide uppercase">
            إجراءات سريعة
          </p>
          <div className="grid grid-cols-2 gap-3">
            {quickActions.map((action) => (
              <button
                key={action.label}
                onClick={action.onClick}
                className="bg-[var(--color-surface)] rounded-2xl p-4 shadow-sm border border-[var(--color-border)] text-right active:scale-[0.98] transition-transform"
              >
                <div
                  className={`w-11 h-11 rounded-xl bg-gradient-to-br ${action.gradient} flex items-center justify-center text-white shadow-lg ${action.shadowColor} mb-3`}
                >
                  {action.icon}
                </div>
                <p className="text-[13px] font-bold text-[var(--color-text)]">{action.label}</p>
                <p className="text-[11px] text-[var(--color-text-tertiary)] mt-0.5">{action.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* ===== Store Verification Status ===== */}
        {myStore && storeVerification && (
          <div className="mt-4">
            <p className="text-[10px] font-bold text-emerald-300 dark:text-emerald-600 pb-2 px-1 tracking-wide uppercase">
              حالة التوثيق
            </p>
            <div className="bg-[var(--color-surface)] rounded-2xl p-4 shadow-sm border border-[var(--color-border)]">
              <div className="flex items-start gap-3">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    storeVerified
                      ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-500'
                      : 'bg-amber-50 dark:bg-amber-900/20 text-amber-500 dark:text-amber-400'
                  }`}
                >
                  {storeVerified ? (
                    <CheckCircle className="w-5 h-5" />
                  ) : (
                    <AlertTriangle className="w-5 h-5" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-bold text-[var(--color-text)]">
                    {storeVerified ? 'المتجر مُوثّق' : 'التوثيق منتهي'}
                  </p>
                  {storeVerification.startDate && (
                    <p className="text-[11px] text-[var(--color-text-tertiary)] mt-0.5">
                      تاريخ البدء: {formatDateFull(storeVerification.startDate)}
                    </p>
                  )}
                  {storeVerification.endDate && (
                    <p className="text-[11px] text-[var(--color-text-tertiary)] mt-0.5">
                      تاريخ الانتهاء: {formatDateFull(storeVerification.endDate)}
                    </p>
                  )}
                  {storeVerified && (
                    <div className="mt-2 flex items-center gap-2">
                      <span
                        className={`text-[12px] font-bold ${
                          verificationExpiry.daysRemaining <= 3
                            ? 'text-rose-500 dark:text-rose-400'
                            : 'text-emerald-600'
                        }`}
                      >
                        متبقي {verificationExpiry.daysRemaining} يوم
                      </span>
                      {verificationExpiry.daysRemaining <= 3 && (
                        <span className="text-[10px] bg-rose-50 dark:bg-rose-900/20 text-rose-500 dark:text-rose-400 px-2 py-0.5 rounded-full font-bold">
                          قارب على الانتهاء
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
              {(storeVerified && verificationExpiry.daysRemaining <= 7) || !storeVerified ? (
                <Button
                  variant="primary"
                  fullWidth
                  size="sm"
                  className="mt-3"
                  onClick={handleRenewVerification}
                  icon={<RefreshCw className="w-4 h-4" />}
                >
                  تمديد التوثيق
                </Button>
              ) : null}
            </div>
          </div>
        )}

        {/* ===== Recent Transactions ===== */}
        <div className="mt-4">
          <div className="flex items-center justify-between px-1 pb-2">
            <p className="text-[10px] font-bold text-emerald-300 dark:text-emerald-600 tracking-wide uppercase">
              آخر العمليات
            </p>
            {transactions.length > 0 && (
              <button
                onClick={() => setSubScreen('transactions')}
                className="text-[11px] font-bold text-emerald-500 active:text-emerald-700 flex items-center gap-0.5"
              >
                عرض الكل
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="bg-[var(--color-surface)] rounded-2xl shadow-sm border border-[var(--color-border)] overflow-hidden">
            {transactions.length === 0 ? (
              <div className="p-8 text-center">
                <div className="w-14 h-14 rounded-2xl bg-emerald-50/60 dark:bg-emerald-900/20 flex items-center justify-center mx-auto mb-3">
                  <Clock className="w-6 h-6 text-emerald-300" />
                </div>
                <p className="text-[13px] font-bold text-[var(--color-text-tertiary)]">لا توجد عمليات بعد</p>
                <p className="text-[11px] text-[var(--color-text-tertiary)] mt-1">ابدأ بشراء النقاط لتظهر هنا</p>
              </div>
            ) : (
              <div>
                {transactions.map((tx, index) => (
                  <div key={tx.id}>
                    <div className="flex items-center gap-3 px-4 py-3">
                      {/* Icon */}
                      <div className="w-9 h-9 rounded-xl bg-emerald-50/60 dark:bg-emerald-900/20 flex items-center justify-center flex-shrink-0">
                        {getTransactionIcon(tx.type)}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-bold text-[var(--color-text)] truncate">
                          {tx.description}
                        </p>
                        <p className="text-[10px] text-[var(--color-text-tertiary)] mt-0.5">
                          {getTransactionTypeLabel(tx.type)} • {formatDateShort(tx.createdAt)}
                        </p>
                      </div>

                      {/* Amount */}
                      <div className="flex-shrink-0 text-left">
                        <p
                          className={`text-[13px] font-black ${
                            tx.amount > 0 ? 'text-emerald-500' : tx.amount < 0 ? 'text-rose-500 dark:text-rose-400' : 'text-[var(--color-text-tertiary)]'
                          }`}
                        >
                          {tx.amount > 0 ? '+' : ''}{tx.amount.toLocaleString('ar-SY')}
                        </p>
                      </div>
                    </div>
                    {index < transactions.length - 1 && (
                      <div className="border-t border-[var(--color-border)]/40 mx-4" />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ===== Footer ===== */}
        <div className="text-center pt-4 pb-4">
          <p className="text-[11px] gradient-text-primary font-semibold">سوق شامل الإلكتروني</p>
          <p className="text-[10px] text-[var(--color-text-tertiary)] mt-0.5">نظام إدارة النقاط</p>
        </div>
      </div>

      {/* ===== Verification Modal ===== */}
      <Modal
        isOpen={showVerificationModal}
        onClose={() => setShowVerificationModal(false)}
        title="توثيق المتجر"
      >
        <div className="space-y-4">
          {/* Tier Selector */}
          <div>
            <p className="text-[12px] font-bold text-[var(--color-text-secondary)] mb-2">اختر خطة التوثيق</p>
            <div className="grid grid-cols-2 gap-2">
              {VERIFICATION_PLANS.filter(p => p.tier !== 'unverified').map(plan => (
                <button
                  key={plan.tier}
                  type="button"
                  onClick={() => setSelectedTier(plan.tier)}
                  className={`relative rounded-xl p-3 border-2 text-right transition-all ${
                    selectedTier === plan.tier
                      ? `border-emerald-500 bg-gradient-to-br ${plan.lightGradientClass} shadow-sm`
                      : 'border-[var(--color-border)] bg-[var(--color-surface)]'
                  }`}
                >
                  {selectedTier === plan.tier && (
                    <div className="absolute top-1.5 left-1.5 w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center">
                      <CheckCircle className="w-3 h-3 text-white" />
                    </div>
                  )}
                  <div className="text-[20px] mb-1">{plan.emoji}</div>
                  <p className={`text-[13px] font-black ${plan.colorClass}`}>{plan.nameAr}</p>
                  <p className="text-[11px] text-[var(--color-text-tertiary)] mt-0.5">{plan.costPerMonth} نقطة/شهر</p>
                  <p className="text-[10px] text-[var(--color-text-tertiary)]">{plan.durationDays} يوم</p>
                </button>
              ))}
            </div>
          </div>

          {/* Info Card */}
          <div className="bg-emerald-50/40 dark:bg-emerald-900/20 rounded-xl p-4 border border-emerald-100/40 dark:border-emerald-800/30">
            <div className="flex items-center gap-2 mb-3">
              <Award className="w-5 h-5 text-emerald-500" />
              <p className="text-[13px] font-bold text-emerald-800 dark:text-emerald-300">مميزات الخطة {getPlan(selectedTier).emoji} {getPlan(selectedTier).nameAr}</p>
            </div>
            <ul className="space-y-2 mr-7">
              <li className="text-[12px] text-slate-600 flex items-center gap-2">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-400 dark:text-emerald-500 flex-shrink-0" />
                شارة التوثيق على متجرك
              </li>
              <li className="text-[12px] text-slate-600 flex items-center gap-2">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-400 dark:text-emerald-500 flex-shrink-0" />
                ظهور متجرك في المتاجر الموثقة
              </li>
              <li className="text-[12px] text-slate-600 flex items-center gap-2">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-400 dark:text-emerald-500 flex-shrink-0" />
                إنشاء حتى {getPlan(selectedTier).limits.maxProductsPerMonth} منتج شهرياً
              </li>
              <li className="text-[12px] text-slate-600 flex items-center gap-2">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-400 dark:text-emerald-500 flex-shrink-0" />
                مدة محتوى حتى {getPlan(selectedTier).limits.maxDurationDays} يوم
              </li>
            </ul>
          </div>

          {/* Cost Info */}
          <div className="gradient-warm rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/80 text-[11px] font-semibold">التكلفة</p>
                <p className="text-white text-[18px] font-black mt-0.5">{getPlan(selectedTier).costPerMonth} نقطة</p>
              </div>
              <div className="text-left">
                <p className="text-white/80 text-[11px] font-semibold">المدة</p>
                <p className="text-white text-[18px] font-black mt-0.5">{getPlan(selectedTier).durationDays} يوم</p>
              </div>
            </div>
          </div>

          {/* Current Balance */}
          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3.5 border border-slate-100">
            <div className="flex items-center justify-between">
              <p className="text-[12px] text-[var(--color-text-secondary)] font-semibold">رصيدك الحالي</p>
              <p className={`text-[14px] font-black ${wallet.balance >= getPlan(selectedTier).costPerMonth ? 'text-emerald-600' : 'text-rose-500 dark:text-rose-400'}`}>
                {wallet.balance.toLocaleString('ar-SY')} نقطة
              </p>
            </div>
          </div>

          {/* Action */}
          {wallet.balance >= getPlan(selectedTier).costPerMonth ? (
            <Button
              variant="primary"
              fullWidth
              size="lg"
              loading={verifying}
              onClick={handlePurchaseVerification}
              icon={<Shield className="w-5 h-5" />}
            >
              توثيق بخطة {getPlan(selectedTier).emoji} {getPlan(selectedTier).nameAr}
            </Button>
          ) : (
            <div>
              <div className="bg-rose-50 dark:bg-rose-900/20 rounded-xl p-3.5 border border-rose-100 mb-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-500 dark:text-rose-400 flex-shrink-0" />
                  <p className="text-[12px] font-bold text-rose-600 dark:text-rose-400">
                    رصيدك غير كاف — تحتاج {getPlan(selectedTier).costPerMonth} نقطة
                  </p>
                </div>
              </div>
              <Button
                variant="secondary"
                fullWidth
                size="lg"
                onClick={() => {
                  setShowVerificationModal(false);
                  setSubScreen('purchase-points');
                }}
                icon={<Plus className="w-5 h-5" />}
              >
                شراء النقاط
              </Button>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};

