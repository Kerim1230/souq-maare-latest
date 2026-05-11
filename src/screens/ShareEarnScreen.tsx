'use client';
import React, { useEffect, useState, useCallback } from 'react';
import {
  ArrowRight, Share2, Users, Gift, CheckCircle, Clock, AlertCircle,
  Copy, MessageCircle, Send, TrendingUp, Loader2, Link2, Award
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useAppStore } from '@/store/appStore';
import { apiGet } from '@/lib/fetchApi';
import toast from 'react-hot-toast';

interface ReferralRecord {
  id: string;
  referrerId: string;
  referredEmail: string;
  referredUserId: string | null;
  status: 'registered' | 'active' | 'rewarded';
  createdAt: string;
  activatedAt: string | null;
  rewardedAt: string | null;
}

interface ReferralStats {
  total: number;
  active: number;
  rewarded: number;
  totalPointsEarned: number;
}

export const ShareEarnScreen: React.FC = () => {
  const user = useAuthStore(s => s.user);
  const myStore = useAppStore(s => s.myStore);
  const setSubScreen = useAppStore(s => s.setSubScreen);
  const [referrals, setReferrals] = useState<ReferralRecord[]>([]);
  const [stats, setStats] = useState<ReferralStats>({ total: 0, active: 0, rewarded: 0, totalPointsEarned: 0 });
  const [loading, setLoading] = useState(true);

  const referralLink = user ? `${typeof window !== 'undefined' ? window.location.origin : ''}/signup?ref=${user.id}` : '';

  const fetchReferrals = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await apiGet<{ referrals: ReferralRecord[]; stats: ReferralStats }>('/api/referrals');
      if (error) throw new Error(error);
      if (data) {
        setReferrals(data.referrals || []);
        setStats(data.stats || { total: 0, active: 0, rewarded: 0, totalPointsEarned: 0 });
      }
    } catch {
      toast.error('حدث خطأ في تحميل بيانات الإحالة');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchReferrals();
  }, [fetchReferrals]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      toast.success('تم نسخ رابط الإحالة ✅');
    } catch {
      toast.error('فشل نسخ الرابط');
    }
  };

  const shareWhatsApp = () => {
    const text = `🏪 سوق شامل الإلكتروني\nسجّل الآن واكتشف أفضل المتاجر والمنتجات المحلية!\n\n${referralLink}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const shareTelegram = () => {
    const text = `🏪 سوق شامل الإلكتروني - سجّل الآن واكتشف أفضل المتاجر والمنتجات المحلية!`;
    window.open(`https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${encodeURIComponent(text)}`, '_blank');
  };

  const statusConfig: Record<string, { label: string; icon: React.ReactNode; color: string; bg: string }> = {
    registered: {
      label: 'مسجّل',
      icon: <Clock className="w-3.5 h-3.5" />,
      color: 'text-amber-600 dark:text-amber-400',
      bg: 'bg-amber-50 dark:bg-amber-900/20',
    },
    active: {
      label: 'نشط',
      icon: <CheckCircle className="w-3.5 h-3.5" />,
      color: 'text-emerald-600 dark:text-emerald-400',
      bg: 'bg-emerald-50 dark:bg-emerald-900/20',
    },
    rewarded: {
      label: 'مكافأة',
      icon: <Gift className="w-3.5 h-3.5" />,
      color: 'text-sky-600 dark:text-sky-400',
      bg: 'bg-sky-50 dark:bg-sky-900/20',
    },
  };

  const maskEmail = (email: string) => {
    if (!email) return '***';
    const [local, domain] = email.split('@');
    if (!domain) return '***';
    const visible = local.slice(0, 2);
    return `${visible}***@${domain}`;
  };

  return (
    <div className="min-h-[100dvh] bg-[var(--color-bg)] pb-14">
      {/* Header */}
      <div className="gradient-dark px-5 pt-8 pb-[5rem] relative overflow-hidden">
        <div className="absolute top-[-40px] right-[-30px] w-[180px] h-[180px] rounded-full bg-teal-600/15 blur-[60px]" />
        <div className="absolute bottom-[-30px] left-[-20px] w-[120px] h-[120px] rounded-full bg-emerald-600/10 blur-[50px]" />
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => setSubScreen('none')} className="w-10 h-10 bg-[var(--color-surface)]/10 backdrop-blur-sm rounded-xl flex items-center justify-center hover:bg-[var(--color-surface)]/20 transition-colors">
              <ArrowRight className="w-[18px] h-[18px] text-white" />
            </button>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-400 shadow-lg shadow-emerald-500/30 flex items-center justify-center">
              <Share2 className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-white text-[20px] font-black">شارك واربح</h1>
              <p className="text-teal-300 text-[12px] mt-0.5">ادعُ أصدقاءك واحصل على 5 نقاط لكل إحالة</p>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 -mt-10 relative z-10 space-y-4">

        {/* Referral Link Card */}
        <div className="bg-gradient-to-br from-emerald-900 to-teal-900 rounded-2xl p-5 relative overflow-hidden">
          <div className="absolute top-[-20px] left-[-20px] w-[100px] h-[100px] rounded-full bg-emerald-500/10 blur-[40px]" />
          <div className="absolute bottom-[-20px] right-[-20px] w-[80px] h-[80px] rounded-full bg-teal-500/10 blur-[40px]" />
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-4">
              <Link2 className="w-5 h-5 text-emerald-400" />
              <h3 className="text-white text-[15px] font-black">رابط الإحالة الخاص بك</h3>
            </div>
            <div className="bg-black/20 backdrop-blur-sm rounded-xl p-3 mb-4 border border-white/10">
              <p className="text-emerald-200 text-[12px] font-mono break-all leading-relaxed" dir="ltr">
                {referralLink || '...جاري التحميل'}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={copyLink}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 transition-colors border border-emerald-400/30 text-[13px] font-bold text-emerald-200"
              >
                <Copy className="w-4 h-4" />
                نسخ الرابط
              </button>
              <button
                onClick={shareWhatsApp}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 transition-colors text-[13px] font-bold text-white shadow-md shadow-emerald-500/20"
              >
                <MessageCircle className="w-4 h-4" />
                واتساب
              </button>
              <button
                onClick={shareTelegram}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-sky-600 hover:bg-sky-700 transition-colors text-[13px] font-bold text-white shadow-md shadow-sky-500/20"
              >
                <Send className="w-4 h-4" />
                تيليجرام
              </button>
            </div>
          </div>
        </div>

        {/* How It Works */}
        <div className="bg-[var(--color-surface)] rounded-2xl p-4 shadow-sm border border-[var(--color-border)]">
          <h3 className="text-[13px] font-black text-[var(--color-text)] mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-500" />
            كيف تعمل الإحالة؟
          </h3>
          <div className="space-y-3">
            {[
              { step: '١', title: 'شارك رابطك', desc: 'انسخ رابط الإحالة وأرسله لأصدقائك' },
              { step: '٢', title: 'سجّل صديقك', desc: 'عند تسجيل صديقك عبر رابطك يُسجَّل كإحالة' },
              { step: '٣', title: 'يكون نشطاً', desc: 'إذا سجّل الدخول خلال 24 ساعة من التسجيل' },
              { step: '٤', title: 'اربح 5 نقاط', desc: 'تحصل على 5 نقاط تلقائياً لكل إحالة نشطة' },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full gradient-primary flex items-center justify-center flex-shrink-0 shadow-sm shadow-emerald-500/20">
                  <span className="text-white text-[12px] font-black">{item.step}</span>
                </div>
                <div>
                  <p className="text-[12px] font-bold text-[var(--color-text)]">{item.title}</p>
                  <p className="text-[10px] text-[var(--color-text-tertiary)]">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Stats Cards */}
        <div className="bg-[var(--color-surface)] rounded-2xl p-4 shadow-sm border border-[var(--color-border)]">
          <h3 className="text-[13px] font-black text-[var(--color-text)] mb-3 flex items-center gap-2">
            <Award className="w-4 h-4 text-emerald-500" />
            إحصائيات الإحالات
          </h3>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 text-emerald-500 animate-spin" />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-emerald-50/50 dark:bg-emerald-900/20 rounded-xl p-3.5 text-center">
                <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{stats.total}</p>
                <p className="text-[10px] text-[var(--color-text-tertiary)] mt-1">إجمالي الإحالات</p>
              </div>
              <div className="bg-sky-50/50 dark:bg-sky-900/20 rounded-xl p-3.5 text-center">
                <p className="text-2xl font-black text-sky-600 dark:text-sky-400">{stats.active}</p>
                <p className="text-[10px] text-[var(--color-text-tertiary)] mt-1">إحالات نشطة</p>
              </div>
              <div className="bg-amber-50/50 dark:bg-amber-900/20 rounded-xl p-3.5 text-center">
                <p className="text-2xl font-black text-amber-600 dark:text-amber-400">{stats.rewarded}</p>
                <p className="text-[10px] text-[var(--color-text-tertiary)] mt-1">إحالات مكافأة</p>
              </div>
              <div className="bg-purple-50/50 dark:bg-purple-900/20 rounded-xl p-3.5 text-center">
                <p className="text-2xl font-black text-purple-600 dark:text-purple-400">{stats.totalPointsEarned}</p>
                <p className="text-[10px] text-[var(--color-text-tertiary)] mt-1">نقاط مكتسبة</p>
              </div>
            </div>
          )}
        </div>

        {/* Referral History */}
        <div className="bg-[var(--color-surface)] rounded-2xl p-4 shadow-sm border border-[var(--color-border)]">
          <h3 className="text-[13px] font-black text-[var(--color-text)] mb-3 flex items-center gap-2">
            <Users className="w-4 h-4 text-emerald-500" />
            سجل الإحالات
          </h3>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 text-emerald-500 animate-spin" />
            </div>
          ) : referrals.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="w-14 h-14 bg-emerald-50/60 dark:bg-emerald-900/20 rounded-2xl flex items-center justify-center mb-3">
                <Users className="w-7 h-7 text-emerald-300 dark:text-emerald-700" />
              </div>
              <p className="text-sm font-bold text-[var(--color-text)]">لا توجد إحالات بعد</p>
              <p className="text-xs text-[var(--color-text-tertiary)] mt-1">شارك رابطك مع الأصدقاء لبدء جمع النقاط</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {referrals.map((ref) => {
                const cfg = statusConfig[ref.status] || statusConfig.registered;
                return (
                  <div key={ref.id} className="flex items-center gap-3 p-3 rounded-xl bg-[var(--color-bg)] border border-[var(--color-border)]/50">
                    <div className={`w-9 h-9 rounded-xl ${cfg.bg} flex items-center justify-center flex-shrink-0 ${cfg.color}`}>
                      {cfg.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-bold text-[var(--color-text)]" dir="ltr">{maskEmail(ref.referredEmail)}</p>
                      <p className="text-[10px] text-[var(--color-text-tertiary)]">
                        {new Date(ref.createdAt).toLocaleDateString('ar-SY', { year: 'numeric', month: 'short', day: 'numeric' })}
                      </p>
                    </div>
                    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-lg ${cfg.bg} ${cfg.color}`}>
                      {cfg.icon}
                      {cfg.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Quick Share Your Store */}
        {myStore && (
          <div className="bg-[var(--color-surface)] rounded-2xl p-4 shadow-sm border border-[var(--color-border)]">
            <h3 className="text-[13px] font-black text-[var(--color-text)] mb-3 flex items-center gap-2">
              <Share2 className="w-4 h-4 text-emerald-500" />
              مشاركة متجرك أيضاً
            </h3>
            <p className="text-[11px] text-[var(--color-text-tertiary)] mb-3">شارك متجرك مباشرة لجذب المزيد من الزبائن</p>
            <div className="flex gap-2">
              <button
                onClick={async () => {
                  const storeUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/share/store/${myStore.id}?ref=${user?.id || ''}`;
                  try { await navigator.clipboard.writeText(storeUrl); } catch { /* fallback */ }
                  toast.success('تم نسخ رابط المتجر ✅');
                }}
                className="flex-1 py-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-100 dark:bg-emerald-900/30 transition-colors border border-emerald-100 dark:border-emerald-800 text-[13px] font-bold text-emerald-700 flex items-center justify-center gap-2"
              >
                <Copy className="w-4 h-4" />
                نسخ رابط المتجر
              </button>
              <a
                href={`https://wa.me/?text=${encodeURIComponent(`🏪 متجر: ${myStore.name}\n${myStore.description || ''}\n\n🛒 سوق شامل الإلكتروني\n${typeof window !== 'undefined' ? window.location.origin : ''}/share/store/${myStore.id}?ref=${user?.id || ''}`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 transition-colors text-[13px] font-bold text-white flex items-center justify-center gap-2 shadow-sm shadow-emerald-500/20"
              >
                <MessageCircle className="w-4 h-4" />
                مشاركة واتساب
              </a>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="text-center pt-2 pb-4">
          <p className="text-[11px] text-[var(--color-text-tertiary)]">نظام الإحالات - سوق شامل الإلكتروني</p>
        </div>
      </div>
    </div>
  );
};
