'use client';
import React, { useEffect, useState, useMemo } from 'react';
import {
  ArrowRight, ShieldCheck, ShieldX, Crown, Star, Package, Gift, Trophy,
  ShoppingBag, Clock, XCircle, Zap, TrendingUp,
  Lock, AlertTriangle, Award, Sparkles, Timer, BarChart3,
  ChevronLeft, Calendar, Flame, Target, Settings, Check, Gem, Store
} from 'lucide-react';
import { Button } from '@/components/market/Button';
import { useAuthStore } from '@/store/authStore';
import { useAppStore } from '@/store/appStore';
import { useVerificationStore, UNVERIFIED_LIMITS } from '@/store/verificationStore';
import { usePointsStore } from '@/store/pointsStore';
import { useNotificationStore } from '@/store/notificationStore';
import { apiPut } from '@/lib/fetchApi';
import {
  type VerificationTier,
  VERIFICATION_PLANS,
  getPlan,
  getDurationOptions,
} from '@/lib/constants';
import toast from 'react-hot-toast';

// ⚡ Stable fallback — prevents new [] on every selector call
const EMPTY_ARR: never[] = [];

// ===== Tier Visual Config =====
const TIER_CONFIG: Record<VerificationTier, {
  emoji: string;
  nameAr: string;
  gradientClass: string;
  lightGradientClass: string;
  badgeGradient: string;
  borderClass: string;
  textClass: string;
  bgLightClass: string;
}> = {
  unverified: {
    emoji: '🆓',
    nameAr: 'غير موثّق',
    gradientClass: 'from-slate-400 to-slate-600',
    lightGradientClass: 'from-slate-50 to-slate-100',
    badgeGradient: 'from-slate-300 to-slate-500',
    borderClass: 'border-slate-200',
    textClass: 'text-slate-600',
    bgLightClass: 'bg-slate-50',
  },
  bronze: {
    emoji: '🥉',
    nameAr: 'برونزي',
    gradientClass: 'from-amber-600 to-amber-800',
    lightGradientClass: 'from-amber-50 to-amber-100',
    badgeGradient: 'from-amber-400 to-amber-700',
    borderClass: 'border-amber-200',
    textClass: 'text-amber-700',
    bgLightClass: 'bg-amber-50',
  },
  silver: {
    emoji: '🥈',
    nameAr: 'فضي',
    gradientClass: 'from-gray-300 to-gray-500',
    lightGradientClass: 'from-gray-50 to-gray-100',
    badgeGradient: 'from-gray-300 to-gray-500',
    borderClass: 'border-gray-200',
    textClass: 'text-gray-600',
    bgLightClass: 'bg-gray-50',
  },
  gold: {
    emoji: '🥇',
    nameAr: 'ذهبي',
    gradientClass: 'from-yellow-400 to-yellow-600',
    lightGradientClass: 'from-yellow-50 to-yellow-100',
    badgeGradient: 'from-yellow-400 to-yellow-600',
    borderClass: 'border-yellow-200',
    textClass: 'text-yellow-700',
    bgLightClass: 'bg-yellow-50',
  },
  diamond: {
    emoji: '💎',
    nameAr: 'ألماسي',
    gradientClass: 'from-cyan-400 to-blue-600',
    lightGradientClass: 'from-cyan-50 to-blue-100',
    badgeGradient: 'from-cyan-400 to-blue-600',
    borderClass: 'border-cyan-200',
    textClass: 'text-cyan-700',
    bgLightClass: 'bg-cyan-50',
  },
};

// Tier order for comparison
const TIER_ORDER: VerificationTier[] = ['unverified', 'bronze', 'silver', 'gold', 'diamond'];

// ===== Helper Components =====
const UsageBar: React.FC<{ label: string; current: number; limit: number; icon: React.ReactNode; color?: string }> = ({ label, current, limit, icon, color = 'emerald' }) => {
  const percentage = limit > 0 ? Math.min((current / limit) * 100, 100) : 0;
  const isNearLimit = percentage >= 75;
  const isAtLimit = percentage >= 100;
  const remaining = Math.max(0, limit - current);

  const colorClasses: Record<string, { bar: string; text: string }> = {
    emerald: { bar: 'bg-emerald-500', text: 'text-emerald-600' },
    blue: { bar: 'bg-blue-500', text: 'text-blue-600' },
    amber: { bar: 'bg-amber-500', text: 'text-amber-600' },
    purple: { bar: 'bg-purple-500', text: 'text-purple-600' },
    rose: { bar: 'bg-rose-500', text: 'text-rose-600' },
    cyan: { bar: 'bg-cyan-500', text: 'text-cyan-600' },
  };
  const c = colorClasses[color] || colorClasses.emerald;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className={`${isAtLimit ? 'text-rose-400' : 'text-emerald-400'}`}>{icon}</span>
          <span className="text-[12px] font-bold text-[var(--color-text)]">{label}</span>
        </div>
        <div className="flex items-center gap-1.5">
          {!isAtLimit && remaining <= 1 && limit > 0 && (
            <span className="text-[9px] font-bold text-amber-500 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-1.5 py-0.5 rounded-full">اقتربت!</span>
          )}
          <span className={`text-[11px] font-bold ${isAtLimit ? 'text-rose-500 dark:text-rose-400' : isNearLimit ? 'text-amber-500 dark:text-amber-400' : 'text-[var(--color-text-tertiary)]'}`}>
            {current} / {limit}
          </span>
        </div>
      </div>
      <div className="h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${
            isAtLimit ? 'bg-rose-500' : isNearLimit ? 'bg-amber-400' : c.bar
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {isAtLimit && (
        <div className="flex items-center gap-1 text-[10px] text-rose-500 dark:text-rose-400 font-bold">
          <XCircle className="w-3 h-3" />
          وصلت للحد الأقصى
        </div>
      )}
    </div>
  );
};

const CountdownTimer: React.FC<{ expiresAt: string }> = ({ expiresAt }) => {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    const update = () => {
      const now = Date.now();
      const expiry = new Date(expiresAt).getTime();
      const diff = Math.max(0, expiry - now);

      setTimeLeft({
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((diff / (1000 * 60)) % 60),
        seconds: Math.floor((diff / 1000) % 60),
      });
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  const isUrgent = timeLeft.days <= 3;

  return (
    <div className={`grid grid-cols-4 gap-2 ${isUrgent ? 'animate-pulse' : ''}`}>
      {[
        { value: timeLeft.days, label: 'يوم' },
        { value: timeLeft.hours, label: 'ساعة' },
        { value: timeLeft.minutes, label: 'دقيقة' },
        { value: timeLeft.seconds, label: 'ثانية' },
      ].map((unit) => (
        <div key={unit.label} className={`text-center p-2.5 rounded-xl ${isUrgent ? 'bg-rose-50 dark:bg-rose-900/20 border border-rose-100' : 'bg-[var(--color-surface)] border border-[var(--color-border)]'}`}>
          <p className={`text-xl font-black tabular-nums ${isUrgent ? 'text-rose-600' : 'text-emerald-700'}`}>
            {String(unit.value).padStart(2, '0')}
          </p>
          <p className={`text-[9px] font-bold mt-0.5 ${isUrgent ? 'text-rose-400' : 'text-[var(--color-text-tertiary)]'}`}>
            {unit.label}
          </p>
        </div>
      ))}
    </div>
  );
};

const FeatureItem: React.FC<{ icon: React.ReactNode; text: string; available: boolean }> = ({ icon, text, available }) => (
  <div className={`flex items-center gap-2.5 py-2 px-3 rounded-lg transition-colors ${
    available ? 'bg-emerald-50/40' : 'bg-slate-50/60'
  }`}>
    <div className={`w-6 h-6 rounded-md flex items-center justify-center ${
      available ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-[var(--color-text-tertiary)]'
    }`}>
      {available ? icon : <XCircle className="w-3.5 h-3.5" />}
    </div>
    <span className={`text-[12px] font-medium ${available ? 'text-emerald-800' : 'text-[var(--color-text-tertiary)]'}`}>{text}</span>
  </div>
);

export const VerificationScreen: React.FC = () => {
  const user = useAuthStore(s => s.user);
  const myStore = useAppStore(s => s.myStore);
  const setActiveTab = useAppStore(s => s.setActiveTab);
  const setSubScreen = useAppStore(s => s.setSubScreen);
  const verificationInit = useVerificationStore(s => s.initialize);
  const storeVerification = useVerificationStore(s => myStore ? s.verifications[myStore.id] ?? null : null);
  // ⚡ Stable: module-level empty array avoids new [] every render
  const storeDailyUsage = useVerificationStore(s => myStore ? s.dailyUsage[myStore.id] ?? EMPTY_ARR : EMPTY_ARR);
  // grantVerification removed — self-upgrade now goes through /api/stores/verify (server-first)
  const getStoreTierFn = useVerificationStore(s => s.getStoreTier);
  const getLimitsFn = useVerificationStore(s => s.getLimits);
  const getDurationOptionsForStoreFn = useVerificationStore(s => s.getDurationOptionsForStore);
  const verificationInitialized = useVerificationStore(s => s.initialized);
  const initPoints = usePointsStore(s => s.initialize);
  // Reactive wallet balance selector
  const walletBalance = usePointsStore(s => s.wallets[user?.id || '']?.balance ?? 0);
  // Hook-based action references (avoids getState() bypassing React lifecycle)
  // deductPoints removed — points are now deducted server-side by /api/stores/verify
  const createNotification = useNotificationStore(s => s.createNotification);

  // Flag for no-store state
  const noStore = !myStore;

  const [isVerifying, setIsVerifying] = useState(false);
  const [activeSection, setActiveSection] = useState<'overview' | 'usage' | 'compare' | 'badge'>('overview');

  useEffect(() => { verificationInit(); initPoints(user?.id); }, [verificationInit, initPoints, user?.id]);

  // ===== Current Tier =====
  const currentTier: VerificationTier = useMemo(() => {
    if (!myStore) return 'unverified';
    return getStoreTierFn(myStore.id);
  }, [myStore, getStoreTierFn]);

  const currentConfig = TIER_CONFIG[currentTier];
  const isVerified = currentTier !== 'unverified';

  // ===== Limits & Usage =====
  const limits = useMemo(() => {
    if (!myStore) return UNVERIFIED_LIMITS;
    return getLimitsFn(myStore.id);
  }, [myStore, getLimitsFn]);

  const durationOptions = useMemo(() => {
    if (!myStore) return getDurationOptions('unverified');
    return getDurationOptionsForStoreFn(myStore.id);
  }, [myStore, getDurationOptionsForStoreFn]);

  const { status, stats } = useMemo(() => {
    const ver = storeVerification;
    const now = new Date();

    const endDate = ver?.endDate ? new Date(ver.endDate) : null;
    const daysRemaining = (isVerified && endDate) ? Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : 0;

    const st: { isVerified: boolean; daysRemaining: number | null; expiresAt: string | null } = {
      isVerified,
      daysRemaining: isVerified ? daysRemaining : null,
      expiresAt: isVerified && ver?.endDate ? ver.endDate : null,
    };

    // Monthly usage
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const monthly = (storeDailyUsage as Array<{ date: string; productsCreated: number; storeEdits: number; featuredProducts: number; offersCreated: number; contestsCreated: number; settingsChanges?: number }>)
      .filter(d => d.date >= monthStart)
      .reduce((acc, d) => ({
        products: acc.products + d.productsCreated,
        offers: acc.offers + d.offersCreated,
        contests: acc.contests + d.contestsCreated,
        featured: acc.featured + d.featuredProducts,
        settingsChanges: acc.settingsChanges + (d.settingsChanges || 0),
      }), { products: 0, offers: 0, contests: 0, featured: 0, settingsChanges: 0 });

    // Weekly edits
    const weekDay = now.getDay();
    const weekDiff = now.getDate() - weekDay + (weekDay === 0 ? -6 : 1);
    const weekStartDate = new Date(now); weekStartDate.setDate(weekDiff); weekStartDate.setHours(0, 0, 0, 0);
    const weeklyEdits = (storeDailyUsage as Array<{ date: string; storeEdits: number }>)
      .filter(d => new Date(d.date) >= weekStartDate)
      .reduce((acc, d) => acc + d.storeEdits, 0);

    const usageStats = {
      productsThisMonth: monthly.products,
      productsLimit: limits.maxProductsPerMonth,
      editsThisWeek: weeklyEdits,
      editsLimit: limits.maxStoreEditsPerWeek,
      offersThisMonth: monthly.offers,
      offersLimit: limits.maxOffersPerMonth,
      contestsThisMonth: monthly.contests,
      contestsLimit: limits.maxContestsPerMonth,
      featuredThisMonth: monthly.featured,
      featuredLimit: limits.maxFeaturedProductsPerMonth,
      settingsThisMonth: monthly.settingsChanges,
      settingsLimit: limits.maxSettingsChangesPerMonth,
    };
    return { status: st, stats: usageStats };
  }, [storeVerification, storeDailyUsage, isVerified, limits]);

  // ===== Upgrade Handler =====
  const handleUpgrade = async (tier: VerificationTier) => {
    if (!user || !myStore) return;
    const plan = getPlan(tier);
    if (plan.costPerMonth === 0) return;
    if (walletBalance < plan.costPerMonth) {
      toast.error('رصيدك غير كاف، قم بشراء نقاط أولاً');
      return;
    }
    setIsVerifying(true);
    try {
      // ── Server-first approach: /api/stores/verify handles EVERYTHING ──
      // It checks auth, verifies ownership, deducts points, updates the store,
      // and creates/updates the verification record — all in one atomic request.
      const { data, error: verifyError } = await apiPut<{ store: any; tier: VerificationTier; verification?: any }>('/api/stores/verify', {
        storeId: myStore.id,
        isVerified: true,
        tier,
      });

      if (verifyError) {
        // Always refresh wallet on error — points may have been deducted
        // server-side even if the response was an error (e.g., verification
        // record creation failed after successful deduction).
        await usePointsStore.getState().forceRefreshWallet(user.id);
        toast.error(verifyError);
        return;
      }

      // ── Refresh local stores from server state ──
      // Force-refresh wallet balance (points were deducted server-side)
      // Using forceRefreshWallet to bypass the in-flight dedup guard.
      await usePointsStore.getState().forceRefreshWallet(user.id);

      // Update the app store with the verified store data
      if (data?.store) {
        useAppStore.getState().setMyStore(data.store);
      }

      // Update verification store — prefer the verification object returned
      // by the API (avoids an extra round-trip to /api/verification), but
      // fall back to loadStoreVerification if the API didn't return it.
      if (data?.verification) {
        const verifications = { ...useVerificationStore.getState().verifications };
        verifications[myStore.id] = data.verification;
        useVerificationStore.setState({ verifications });
      } else {
        await useVerificationStore.getState().loadStoreVerification(myStore.id);
      }

      // Notification
      createNotification({
        userId: user.id,
        type: 'admin',
        category: 'verification_granted',
        title: `تم ترقية متجرك إلى مستوى ${plan.nameAr} ${plan.emoji}`,
        body: `تم ترقية متجر "${myStore.name}" إلى مستوى ${plan.nameAr} بنجاح لمدة ${plan.durationDays} يوم. استمتع بالمزايا الجديدة!`,
        icon: 'ShieldCheck',
        priority: 'high',
        deepLink: '/my-store',
        data: { storeId: myStore.id, storeName: myStore.name, tier, days: plan.durationDays },
      });

      toast.success(`تم ترقية متجرك إلى مستوى ${plan.nameAr} بنجاح!`, { duration: 3000, icon: '🎉' });
    } catch {
      toast.error('حدث خطأ أثناء الترقية');
    } finally {
      setIsVerifying(false);
    }
  };

  if (!verificationInitialized) {
    return (
      <div className="min-h-screen bg-[var(--color-bg)] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[var(--color-border)]0 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const sections = [
    { id: 'overview' as const, label: 'نظرة عامة', icon: <BarChart3 className="w-4 h-4" /> },
    { id: 'usage' as const, label: 'الاستخدام', icon: <Zap className="w-4 h-4" /> },
    { id: 'compare' as const, label: 'المقارنة', icon: <TrendingUp className="w-4 h-4" /> },
    { id: 'badge' as const, label: 'الشارة', icon: <Award className="w-4 h-4" /> },
  ];

  // Paid plans only (for upgrade section)
  const paidPlans = VERIFICATION_PLANS.filter(p => p.tier !== 'unverified');

  return (
    <div className="min-h-screen bg-[var(--color-bg)] pb-24">
      {/* ===== No-Store Warning Banner ===== */}
      {noStore && (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/30 dark:to-orange-900/30 border-b border-amber-200/60 dark:border-amber-700/40 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 dark:bg-amber-800/40 rounded-xl flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-black text-amber-900 dark:text-amber-200">يجب إنشاء متجر أولاً</p>
              <p className="text-[11px] text-amber-700 dark:text-amber-300 mt-0.5">لتتمكن من التوثيق والاستفادة من المزايا، تحتاج إلى إنشاء متجر أولاً</p>
            </div>
            <Button
              size="sm"
              onClick={() => setActiveTab(1)}
              icon={<Store className="w-3.5 h-3.5" />}
            >
              إنشاء متجر
            </Button>
          </div>
        </div>
      )}

      {/* ===== Header ===== */}
      <div className="gradient-dark px-5 pt-8 pb-[5.5rem] relative overflow-hidden">
        <div className="absolute top-[-40px] right-[-30px] w-[180px] h-[180px] rounded-full bg-teal-600/15 blur-[60px]" />
        <div className="absolute bottom-[-30px] left-[-20px] w-[120px] h-[120px] rounded-full bg-emerald-600/10 blur-[50px]" />
        <div className="absolute top-[-10px] left-[40%] w-[80px] h-[80px] rounded-full bg-amber-500/5 blur-[40px]" />
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => setSubScreen('none')} className="w-10 h-10 bg-[var(--color-surface)]/10 backdrop-blur-sm rounded-xl flex items-center justify-center hover:bg-[var(--color-surface)]/20 transition-colors">
              <ArrowRight className="w-[18px] h-[18px] text-white" />
            </button>
          </div>
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${isVerified ? `bg-gradient-to-br ${currentConfig.gradientClass} shadow-lg` : 'bg-[var(--color-surface)]/10 backdrop-blur-sm'}`}>
              {isVerified ? (
                <ShieldCheck className="w-6 h-6 text-white" />
              ) : (
                <ShieldX className="w-6 h-6 text-white/60" />
              )}
            </div>
            <div>
              <h1 className="text-white text-[20px] font-black">نظام التوثيق</h1>
              <p className="text-teal-300 dark:text-teal-600/50 text-[12px] mt-0.5">
                {isVerified ? `متجرك موثّق ✨ — مستوى ${currentConfig.nameAr}` : 'متجر غير موثّق'}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 -mt-10 relative z-10 space-y-4">

        {/* ===== Status Card ===== */}
        <div className={`rounded-2xl p-4 border shadow-sm ${isVerified ? `bg-gradient-to-br ${currentConfig.lightGradientClass} ${currentConfig.borderClass}` : 'bg-[var(--color-surface)] border-[var(--color-border)]'}`}>
          <div className="flex items-center gap-3 mb-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isVerified ? `bg-gradient-to-br ${currentConfig.gradientClass} shadow-md` : 'bg-slate-100 dark:bg-slate-800'}`}>
              {isVerified ? (
                <span className="text-lg">{currentConfig.emoji}</span>
              ) : (
                <Lock className="w-5 h-5 text-[var(--color-text-tertiary)]" />
              )}
            </div>
            <div className="flex-1">
              <h2 className={`text-[15px] font-black ${isVerified ? currentConfig.textClass : 'text-[var(--color-text)]'}`}>
                {isVerified ? `مستوى ${currentConfig.nameAr} ${currentConfig.emoji}` : 'متجر غير موثّق'}
              </h2>
              <p className={`text-[11px] ${isVerified ? currentConfig.textClass + '/70' : 'text-[var(--color-text-tertiary)]'}`}>
                {isVerified
                  ? status.daysRemaining !== null
                    ? `متبقي ${status.daysRemaining} يوم على انتهاء التوثيق`
                    : 'متجر موثّق'
                  : 'قم بالترقية للحصول على مزايا إضافية'
                }
              </p>
            </div>
            {isVerified ? (
              <span className={`bg-gradient-to-r ${currentConfig.badgeGradient} text-white text-[10px] font-black px-2.5 py-1 rounded-full flex items-center gap-1 shadow-sm`}>
                <ShieldCheck className="w-3 h-3" />
                {currentConfig.nameAr}
              </span>
            ) : (
              <span className="bg-slate-100 dark:bg-slate-800 text-[var(--color-text-secondary)] text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
                <ShieldX className="w-3 h-3" />
                عادي
              </span>
            )}
          </div>

          {/* Countdown Timer for Verified Stores */}
          {isVerified && status.expiresAt && (
            <div className="bg-[var(--color-surface)]/60 rounded-xl p-3 border border-[var(--color-border)]/40 space-y-3">
              <div className="flex items-center justify-between text-[11px]">
                <span className={`${currentConfig.textClass} font-bold flex items-center gap-1.5`}>
                  <Timer className="w-3.5 h-3.5" />
                  العد التنازلي لانتهاء التوثيق
                </span>
                <span className={`${currentConfig.textClass}/70 font-medium flex items-center gap-1`}>
                  <Calendar className="w-3 h-3" />
                  {new Date(status.expiresAt).toLocaleDateString('ar-SY', { year: 'numeric', month: 'long', day: 'numeric' })}
                </span>
              </div>
              <CountdownTimer expiresAt={status.expiresAt} />
              {status.daysRemaining !== null && status.daysRemaining <= 7 && (
                <div className="flex items-center gap-1.5 text-[10px] text-rose-600 dark:text-rose-400 font-bold bg-rose-50 dark:bg-rose-900/20 rounded-lg px-3 py-2 border border-rose-100/60">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  التوثيق على وشك الانتهاء! قم بتجديده من بطاقات الترقية.
                </div>
              )}
            </div>
          )}

          {/* Quick Stats for Current Tier */}
          <div className="grid grid-cols-3 gap-2 mt-3">
            {[
              { label: 'المنتجات/شهر', value: `${stats.productsThisMonth}/${stats.productsLimit}`, icon: <Package className="w-3.5 h-3.5" />, color: stats.productsThisMonth >= stats.productsLimit ? 'text-rose-500 dark:text-rose-400' : 'text-emerald-600' },
              { label: 'التعديلات/أسبوع', value: `${stats.editsThisWeek}/${stats.editsLimit}`, icon: <ShoppingBag className="w-3.5 h-3.5" />, color: 'text-blue-600' },
              { label: 'العروض/شهر', value: `${stats.offersThisMonth}/${stats.offersLimit}`, icon: <Gift className="w-3.5 h-3.5" />, color: 'text-amber-600' },
            ].map((stat) => (
              <div key={stat.label} className="bg-[var(--color-surface)]/60 rounded-xl p-2.5 text-center border border-[var(--color-border)]/40">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <span className="text-emerald-400">{stat.icon}</span>
                  <span className={`text-sm font-black ${stat.color}`}>{stat.value}</span>
                </div>
                <p className="text-[9px] text-[var(--color-text-tertiary)] font-bold">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ===== Upgrade Section (Tier Cards) ===== */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-500" />
            <h3 className="text-[13px] font-black text-[var(--color-text)]">
              {isVerified ? 'ترقية إلى مستوى أعلى' : 'رقّي متجرك الآن!'}
            </h3>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin" dir="rtl">
            {paidPlans.map((plan) => {
              const planConfig = TIER_CONFIG[plan.tier];
              const isCurrent = currentTier === plan.tier;
              // Check if this tier is lower or equal to current
              const currentIdx = TIER_ORDER.indexOf(currentTier);
              const planIdx = TIER_ORDER.indexOf(plan.tier);
              const isLowerTier = planIdx <= currentIdx;

              return (
                <div key={plan.tier} className="min-w-[200px] flex-shrink-0">
                  <div className={`rounded-2xl border-2 overflow-hidden transition-all h-full flex flex-col ${
                    isCurrent ? `border-emerald-400 shadow-lg shadow-emerald-500/10` :
                    isLowerTier ? 'border-slate-200 opacity-50' :
                    `border-[var(--color-border)] shadow-sm hover:shadow-md`
                  }`}>
                    {/* Tier Header */}
                    <div className={`bg-gradient-to-br ${planConfig.gradientClass} p-3 text-white text-center relative`}>
                      {isCurrent && (
                        <span className="absolute top-2 left-2 bg-white/20 backdrop-blur-sm text-[8px] font-black px-2 py-0.5 rounded-full">
                          الخطة الحالية
                        </span>
                      )}
                      <span className="text-2xl">{planConfig.emoji}</span>
                      <p className="text-[14px] font-black mt-1">{planConfig.nameAr}</p>
                      <p className="text-[11px] text-white/80">{plan.costPerMonth} نقطة/شهر</p>
                    </div>

                    {/* Tier Benefits */}
                    <div className="p-3 space-y-1.5 bg-[var(--color-surface)] flex-1">
                      {[
                        { icon: <Package className="w-3 h-3" />, text: `${plan.limits.maxProductsPerMonth} منتج/شهر` },
                        { icon: <Gift className="w-3 h-3" />, text: `${plan.limits.maxOffersPerMonth} عرض + ${plan.limits.maxContestsPerMonth} مسابقة` },
                        { icon: <Star className="w-3 h-3" />, text: `${plan.limits.maxFeaturedProductsPerMonth} مميز/شهر` },
                        { icon: <ShoppingBag className="w-3 h-3" />, text: `${plan.limits.maxStoreEditsPerWeek} تعديل/أسبوع` },
                        { icon: <Settings className="w-3 h-3" />, text: `${plan.limits.maxSettingsChangesPerMonth} إعدادات/شهر` },
                        { icon: <Clock className="w-3 h-3" />, text: `مدة حتى ${plan.limits.maxDurationDays} يوم` },
                      ].map((item, i) => (
                        <div key={i} className="flex items-center gap-1.5">
                          <span className="text-emerald-400">{item.icon}</span>
                          <span className="text-[10px] text-[var(--color-text)] font-medium">{item.text}</span>
                        </div>
                      ))}
                    </div>

                    {/* Action */}
                    <div className="px-3 pb-3">
                      {isCurrent ? (
                        <div className="flex items-center justify-center gap-1.5 py-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl text-emerald-600 text-[11px] font-bold">
                          <Check className="w-3.5 h-3.5" />
                          خطتك الحالية
                        </div>
                      ) : isLowerTier ? (
                        <div className="flex items-center justify-center gap-1.5 py-2 bg-slate-50 dark:bg-slate-800/50 rounded-xl text-[var(--color-text-tertiary)] text-[11px] font-bold">
                          <Lock className="w-3.5 h-3.5" />
                          مستوى أدنى
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          <Button
                            fullWidth
                            size="sm"
                            onClick={() => handleUpgrade(plan.tier)}
                            loading={isVerifying}
                            disabled={noStore || walletBalance < plan.costPerMonth}
                            icon={<ShieldCheck className="w-3.5 h-3.5" />}
                          >
                            ترقية
                          </Button>
                          {walletBalance < plan.costPerMonth && (
                            <button
                              onClick={() => setSubScreen('wallet')}
                              className="w-full text-[10px] text-amber-600 dark:text-amber-400 font-bold flex items-center justify-center gap-1 hover:underline"
                            >
                              <Crown className="w-3 h-3" />
                              تحتاج {plan.costPerMonth - walletBalance} نقطة
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ===== Wallet Balance Quick Info ===== */}
        <div className="flex items-center gap-3 p-3 bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] shadow-sm">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-sm shadow-amber-500/20 flex-shrink-0">
            <Crown className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1">
            <p className="text-[11px] font-bold text-[var(--color-text-tertiary)]">رصيدك الحالي</p>
            <p className="text-[15px] font-black text-[var(--color-text)]">{walletBalance.toLocaleString('ar-SY')} نقطة</p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setSubScreen('wallet')}
            icon={<Crown className="w-3.5 h-3.5" />}
          >
            شراء نقاط
          </Button>
        </div>

        {/* ===== Section Tabs ===== */}
        <div className="bg-[var(--color-surface)] rounded-2xl p-1 flex border border-[var(--color-border)] shadow-sm">
          {sections.map(section => (
            <button key={section.id} onClick={() => setActiveSection(section.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[11px] font-bold transition-all ${
                activeSection === section.id
                  ? 'gradient-primary text-white shadow-md'
                  : 'text-[var(--color-text-tertiary)] hover:text-emerald-600'
              }`}>
              {section.icon}
              <span>{section.label}</span>
            </button>
          ))}
        </div>

        {/* ===== Overview Section ===== */}
        {activeSection === 'overview' && (
          <>
            {/* Current Tier Benefits */}
            <div className="bg-[var(--color-surface)] rounded-2xl p-4 shadow-sm border border-[var(--color-border)]">
              <h3 className="text-[13px] font-black text-[var(--color-text)] mb-3 flex items-center gap-2">
                <Target className="w-4 h-4 text-emerald-500" />
                {isVerified ? `صلاحياتك الحالية — مستوى ${currentConfig.nameAr}` : 'صلاحياتك حالياً كمتجر عادي'}
              </h3>
              <div className="space-y-1.5">
                <FeatureItem icon={<Package className="w-4 h-4" />} text={`إنشاء ${limits.maxProductsPerMonth} منتج شهرياً`} available={true} />
                <FeatureItem icon={<Gift className="w-4 h-4" />} text={`إنشاء ${limits.maxOffersPerMonth} عرض و ${limits.maxContestsPerMonth} مسابقة شهرياً`} available={limits.maxOffersPerMonth > 0 || limits.maxContestsPerMonth > 0} />
                <FeatureItem icon={<ShoppingBag className="w-4 h-4" />} text={`${limits.maxStoreEditsPerWeek > 0 ? `${limits.maxStoreEditsPerWeek} تعديل أسبوعياً` : 'تعديل واحد شهرياً'}`} available={true} />
                <FeatureItem icon={<Clock className="w-4 h-4" />} text={`مدة بقاء المحتوى حتى ${limits.maxDurationDays} يوم`} available={true} />
                <FeatureItem icon={<Star className="w-4 h-4" />} text={`إضافة ${limits.maxFeaturedProductsPerMonth} منتج مميز شهرياً`} available={limits.maxFeaturedProductsPerMonth > 0} />
                <FeatureItem icon={<Settings className="w-4 h-4" />} text={`${limits.maxSettingsChangesPerMonth} تغيير إعدادات شهرياً`} available={limits.maxSettingsChangesPerMonth > 0} />
                <FeatureItem icon={<Award className="w-4 h-4" />} text='متجر مميز تلقائياً' available={limits.autoPinned} />
              </div>
            </div>

            {/* Duration Options Info */}
            <div className="bg-[var(--color-surface)] rounded-2xl p-4 shadow-sm border border-[var(--color-border)]">
              <h3 className="text-[13px] font-black text-[var(--color-text)] mb-3 flex items-center gap-2">
                <Clock className="w-4 h-4 text-emerald-500" />
                مدة بقاء المحتوى
              </h3>
              <div className="flex flex-wrap gap-2">
                {durationOptions.map((days) => (
                  <span
                    key={days}
                    className={`text-[11px] font-bold px-3 py-1.5 rounded-lg ${
                      days > 1
                        ? `bg-gradient-to-br ${currentConfig.lightGradientClass} ${currentConfig.textClass} border ${currentConfig.borderClass}`
                        : 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 border border-emerald-100'
                    }`}
                  >
                    {days} يوم
                  </span>
                ))}
                {/* Show locked durations from higher tiers */}
                {(() => {
                  const maxAvailable = limits.maxDurationDays;
                  const nextTiers = TIER_ORDER.filter(t => {
                    const p = getPlan(t);
                    return p.limits.maxDurationDays > maxAvailable;
                  });
                  if (nextTiers.length === 0) return null;
                  const nextTier = nextTiers[0];
                  const lockedDurations = getDurationOptions(nextTier).filter(d => d > maxAvailable);
                  return lockedDurations.slice(0, 5).map((days) => (
                    <span
                      key={`locked-${days}`}
                      className="text-[11px] font-bold px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 text-[var(--color-text-tertiary)] border border-slate-100 relative overflow-hidden"
                    >
                      {days} يوم
                      <Lock className="w-2.5 h-2.5 text-[var(--color-text-tertiary)] absolute top-1/2 left-1 -translate-y-1/2" />
                    </span>
                  ));
                })()}
              </div>
              {!isVerified && (
                <div className="flex items-center gap-1.5 mt-2.5 bg-amber-50 dark:bg-amber-900/20 rounded-lg px-3 py-2 border border-amber-100/40">
                  <Lock className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
                  <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">للوصول إلى مدة أطول، قم بترقية متجرك</p>
                </div>
              )}
            </div>
          </>
        )}

        {/* ===== Usage Section ===== */}
        {activeSection === 'usage' && (
          <div className="bg-[var(--color-surface)] rounded-2xl p-4 shadow-sm border border-[var(--color-border)]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[13px] font-black text-[var(--color-text)] flex items-center gap-2">
                <Zap className="w-4 h-4 text-emerald-500" />
                الاستخدام الحالي
              </h3>
              <span className={`bg-gradient-to-r ${currentConfig.badgeGradient} text-white text-[9px] font-black px-2 py-0.5 rounded-full shadow-sm flex items-center gap-0.5`}>
                {isVerified && <span className="text-[8px]">{currentConfig.emoji}</span>}
                {currentConfig.nameAr}
              </span>
            </div>
            <div className="space-y-4">
              <UsageBar
                label="المنتجات المنشورة (هذا الشهر)"
                current={stats.productsThisMonth}
                limit={stats.productsLimit}
                icon={<Package className="w-3.5 h-3.5" />}
                color="emerald"
              />
              <UsageBar
                label="تعديلات المتجر (هذا الأسبوع)"
                current={stats.editsThisWeek}
                limit={stats.editsLimit}
                icon={<ShoppingBag className="w-3.5 h-3.5" />}
                color="blue"
              />
              <UsageBar
                label="العروض (هذا الشهر)"
                current={stats.offersThisMonth}
                limit={stats.offersLimit}
                icon={<Gift className="w-3.5 h-3.5" />}
                color="amber"
              />
              <UsageBar
                label="المسابقات (هذا الشهر)"
                current={stats.contestsThisMonth}
                limit={stats.contestsLimit}
                icon={<Trophy className="w-3.5 h-3.5" />}
                color="purple"
              />
              {limits.maxFeaturedProductsPerMonth > 0 && (
                <UsageBar
                  label="منتجات مميزة (هذا الشهر)"
                  current={stats.featuredThisMonth}
                  limit={stats.featuredLimit}
                  icon={<Star className="w-3.5 h-3.5" />}
                  color="cyan"
                />
              )}
              {limits.maxSettingsChangesPerMonth > 0 && (
                <UsageBar
                  label="تغييرات الإعدادات (هذا الشهر)"
                  current={stats.settingsThisMonth}
                  limit={stats.settingsLimit}
                  icon={<Settings className="w-3.5 h-3.5" />}
                  color="rose"
                />
              )}
            </div>

            {/* Tips */}
            <div className="mt-4 p-3 bg-emerald-50/40 dark:bg-emerald-900/20 rounded-xl border border-emerald-100/30">
              <p className="text-[11px] font-bold text-emerald-700 flex items-center gap-1.5 mb-1.5">
                <Flame className="w-3.5 h-3.5" />
                نصائح
              </p>
              <ul className="space-y-1 text-[10px] text-emerald-600">
                <li className="flex items-start gap-1.5">
                  <ChevronLeft className="w-3 h-3 mt-0.5 flex-shrink-0" />
                  <span>يتم إعادة تعيين العدادات الأسبوعية كل يوم إثنين</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <ChevronLeft className="w-3 h-3 mt-0.5 flex-shrink-0" />
                  <span>يتم إعادة تعيين عدادات الشهرية في أول يوم من كل شهر</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <ChevronLeft className="w-3 h-3 mt-0.5 flex-shrink-0" />
                  <span>الترقية لمستوى أعلى تزيد حدودك فوراً</span>
                </li>
              </ul>
            </div>
          </div>
        )}

        {/* ===== Compare Section ===== */}
        {activeSection === 'compare' && (
          <div className="bg-[var(--color-surface)] rounded-2xl p-4 shadow-sm border border-[var(--color-border)]">
            <h3 className="text-[13px] font-black text-[var(--color-text)] mb-3 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-500" />
              مقارنة المستويات
            </h3>
            {/* Comparison Table */}
            <div className="overflow-x-auto -mx-4 px-4">
              <table className="w-full text-[10px] min-w-[500px]">
                <thead>
                  <tr className="border-b border-[var(--color-border)]">
                    <th className="text-right py-2 px-1 font-bold text-[var(--color-text-tertiary)]">الميزة</th>
                    {TIER_ORDER.map(tier => {
                      const cfg = TIER_CONFIG[tier];
                      const isCurrent = currentTier === tier;
                      return (
                        <th key={tier} className={`text-center py-2 px-1 font-black ${isCurrent ? cfg.textClass : 'text-[var(--color-text-tertiary)]'}`}>
                          <div className="flex flex-col items-center gap-0.5">
                            <span className="text-sm">{cfg.emoji}</span>
                            <span>{cfg.nameAr}</span>
                            {isCurrent && <span className="text-[7px] bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 px-1 rounded-full">الحالي</span>}
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {[
                    { label: 'المنتجات/شهر', key: 'maxProductsPerMonth' as const },
                    { label: 'العروض/شهر', key: 'maxOffersPerMonth' as const },
                    { label: 'المسابقات/شهر', key: 'maxContestsPerMonth' as const },
                    { label: 'مميز/شهر', key: 'maxFeaturedProductsPerMonth' as const },
                    { label: 'تعديل/أسبوع', key: 'maxStoreEditsPerWeek' as const },
                    { label: 'إعدادات/شهر', key: 'maxSettingsChangesPerMonth' as const },
                    { label: 'أقصى مدة', key: 'maxDurationDays' as const, suffix: ' يوم' },
                  ].map(row => (
                    <tr key={row.key} className={`border-b border-[var(--color-border)]/30 ${currentTier === 'unverified' && row.key !== 'maxProductsPerMonth' ? '' : ''}`}>
                      <td className="py-2 px-1 font-bold text-[var(--color-text)]">{row.label}</td>
                      {TIER_ORDER.map(tier => {
                        const plan = getPlan(tier);
                        const val = plan.limits[row.key];
                        const isCurrent = currentTier === tier;
                        const isZero = val === 0;
                        return (
                          <td key={tier} className={`text-center py-2 px-1 font-bold ${isCurrent ? 'bg-emerald-50/50 dark:bg-emerald-900/10 rounded-lg' : ''} ${isZero ? 'text-[var(--color-text-tertiary)]' : 'text-[var(--color-text)]'}`}>
                            {isZero ? '—' : `${val}${row.suffix || ''}`}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                  {/* Auto-pinned row */}
                  <tr>
                    <td className="py-2 px-1 font-bold text-[var(--color-text)]">تثبيت تلقائي</td>
                    {TIER_ORDER.map(tier => {
                      const plan = getPlan(tier);
                      const isCurrent = currentTier === tier;
                      return (
                        <td key={tier} className={`text-center py-2 px-1 font-bold ${isCurrent ? 'bg-emerald-50/50 dark:bg-emerald-900/10 rounded-lg' : ''}`}>
                          {plan.limits.autoPinned ? (
                            <Check className="w-4 h-4 text-emerald-500 mx-auto" />
                          ) : (
                            <XCircle className="w-4 h-4 text-slate-300 mx-auto" />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                  {/* Cost row */}
                  <tr>
                    <td className="py-2 px-1 font-bold text-[var(--color-text)]">التكلفة/شهر</td>
                    {TIER_ORDER.map(tier => {
                      const plan = getPlan(tier);
                      const isCurrent = currentTier === tier;
                      return (
                        <td key={tier} className={`text-center py-2 px-1 font-black ${isCurrent ? 'bg-emerald-50/50 dark:bg-emerald-900/10 rounded-lg' : ''} text-[var(--color-text)]`}>
                          {plan.costPerMonth === 0 ? 'مجاني' : `${plan.costPerMonth}`}
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ===== Badge Section ===== */}
        {activeSection === 'badge' && (
          <div className="bg-[var(--color-surface)] rounded-2xl p-4 shadow-sm border border-[var(--color-border)]">
            <h3 className="text-[13px] font-black text-[var(--color-text)] mb-3 flex items-center gap-2">
              <Award className="w-4 h-4 text-emerald-500" />
              شارة التوثيق
            </h3>

            {/* Badge Preview - Current */}
            <p className="text-[11px] font-bold text-[var(--color-text-tertiary)] mb-2">الحالة الحالية</p>
            <div className={`flex items-center gap-4 p-4 bg-gradient-to-br ${currentConfig.lightGradientClass} rounded-xl mb-4`}>
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-md shadow-emerald-500/20">
                <ShoppingBag className="w-7 h-7 text-white" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-[14px] font-black text-[var(--color-text)]">{myStore?.name || 'متجرك'}</p>
                  {isVerified ? (
                    <span className={`inline-flex items-center gap-1 bg-gradient-to-r ${currentConfig.badgeGradient} text-white text-[9px] font-black px-2 py-0.5 rounded-full shadow-sm`}>
                      <ShieldCheck className="w-3 h-3" />
                      {currentConfig.nameAr}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 bg-slate-200 text-[var(--color-text-secondary)] text-[9px] font-bold px-2 py-0.5 rounded-full">
                      <ShieldX className="w-3 h-3" />
                      غير موثق
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-[var(--color-text-tertiary)] mt-0.5">كما يراك العملاء الآن</p>
              </div>
            </div>

            {/* Badge Preview - Next Tier (if unverified or can upgrade) */}
            {currentTier !== 'diamond' && (
              <>
                <p className="text-[11px] font-bold text-[var(--color-text-tertiary)] mb-2 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  {isVerified ? 'هكذا ستكون بعد الترقية' : 'هكذا ستكون بعد التوثيق'}
                </p>
                {(() => {
                  const nextTierIdx = TIER_ORDER.indexOf(currentTier) + 1;
                  const nextTier = TIER_ORDER[Math.min(nextTierIdx, TIER_ORDER.length - 1)];
                  const nextConfig = TIER_CONFIG[nextTier];
                  return (
                    <div className={`flex items-center gap-4 p-4 bg-gradient-to-br ${nextConfig.lightGradientClass} rounded-xl border-2 border-dashed ${nextConfig.borderClass}`}>
                      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                        <ShoppingBag className="w-7 h-7 text-white" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-[14px] font-black text-[var(--color-text)]">{myStore?.name || 'متجرك'}</p>
                          <span className={`inline-flex items-center gap-1 bg-gradient-to-r ${nextConfig.badgeGradient} text-white text-[9px] font-black px-2 py-0.5 rounded-full shadow-sm animate-pulse`}>
                            <ShieldCheck className="w-3 h-3" />
                            {nextConfig.nameAr}
                          </span>
                        </div>
                        <p className={`text-[11px] ${nextConfig.textClass} mt-0.5 font-medium`}>ستظهر في المتاجر المميزة أيضاً</p>
                      </div>
                    </div>
                  );
                })()}
              </>
            )}

            {/* Badge Styles Gallery */}
            <div className="mt-4 space-y-2">
              <p className="text-[11px] font-bold text-[var(--color-text-tertiary)]">معرض الشارات حسب المستوى</p>
              <div className="flex flex-wrap gap-3 p-3 bg-slate-50/50 dark:bg-slate-800/30 rounded-xl">
                {TIER_ORDER.filter(t => t !== 'unverified').map(tier => {
                  const cfg = TIER_CONFIG[tier];
                  const tierPlan = getPlan(tier);
                  const isCurrent = currentTier === tier;
                  return (
                    <div key={tier} className={`flex flex-col items-center gap-1.5 p-2 rounded-xl ${isCurrent ? 'bg-emerald-50 dark:bg-emerald-900/20 ring-1 ring-emerald-400' : ''}`}>
                      <span className={`inline-flex items-center gap-1 bg-gradient-to-r ${cfg.badgeGradient} text-white text-[9px] font-black px-2.5 py-1 rounded-full ${isCurrent ? 'shadow-md' : 'shadow-sm'}`}>
                        <ShieldCheck className="w-3 h-3" />
                        {cfg.nameAr}
                      </span>
                      <span className="text-[8px] text-[var(--color-text-tertiary)] font-bold">{tierPlan.costPerMonth} نقطة</span>
                      {isCurrent && <span className="text-[7px] text-emerald-600 font-bold">✓ خطتك</span>}
                    </div>
                  );
                })}
              </div>

              {/* Tier Badge Circles */}
              <div className="flex flex-wrap gap-4 p-3 bg-slate-50/50 dark:bg-slate-800/30 rounded-xl">
                {TIER_ORDER.filter(t => t !== 'unverified').map(tier => {
                  const cfg = TIER_CONFIG[tier];
                  const isCurrent = currentTier === tier;
                  return (
                    <div key={`circle-${tier}`} className="flex flex-col items-center gap-1">
                      <div className={`w-10 h-10 bg-gradient-to-br ${cfg.badgeGradient} rounded-full flex items-center justify-center shadow-sm ${isCurrent ? 'ring-2 ring-emerald-400 ring-offset-1' : ''}`}>
                        {tier === 'bronze' ? <Crown className="w-5 h-5 text-white" /> :
                         tier === 'silver' ? <Star className="w-5 h-5 text-white" /> :
                         tier === 'gold' ? <Award className="w-5 h-5 text-white" /> :
                         <Gem className="w-5 h-5 text-white" />}
                      </div>
                      <span className="text-[8px] text-[var(--color-text-tertiary)] font-bold">{cfg.nameAr}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
