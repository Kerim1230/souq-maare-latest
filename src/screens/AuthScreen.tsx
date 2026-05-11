'use client';
import React, { useState, useEffect } from 'react';
import { Mail, Lock, User, LogIn, Sparkles } from 'lucide-react';
import { Button } from '@/components/market/Button';
import { Input } from '@/components/market/Input';
import { useAuthStore } from '@/store/authStore';
import toast from 'react-hot-toast';

type AuthMode = 'login' | 'signup';

export const AuthScreen: React.FC = () => {
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const login = useAuthStore(s => s.login);
  const signup = useAuthStore(s => s.signup);
  const loading = useAuthStore(s => s.loading);

  // ── Referral code from URL ──
  // Use a ref to avoid the react-hooks/set-state-in-effect lint error.
  // We read the referrer lazily when the form is submitted.
  const referrerRef = React.useRef<string | null>(null);
  const [hasReferrer, setHasReferrer] = useState(false);

  // Read referrer from URL or localStorage on mount
  React.useLayoutEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref');
    if (ref) {
      referrerRef.current = ref;
      try { localStorage.setItem('suq_referrer', ref); } catch { /* ignore */ }
      setHasReferrer(true);
      return;
    }
    try {
      const stored = localStorage.getItem('suq_referrer');
      if (stored) {
        referrerRef.current = stored;
        setHasReferrer(true);
      }
    } catch { /* ignore */ }
  }, []);

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!email) newErrors.email = 'البريد الإلكتروني مطلوب';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) newErrors.email = 'بريد إلكتروني غير صالح';
    if (!password) newErrors.password = 'كلمة المرور مطلوبة';
    else if (password.length < 6) newErrors.password = 'كلمة المرور يجب أن تكون 6 أحرف على الأقل';
    if (mode === 'signup' && !fullName) newErrors.fullName = 'الاسم الكامل مطلوب';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    if (mode === 'login') {
      const { error } = await login(email, password);
      if (error) {
        if (error.includes('CSRF') || error.includes('رمز')) {
          toast.error('خطأ في التحقق من الطلب. يُرجى تحديث الصفحة والمحاولة مجدداً');
        } else if (error.includes('كثيرة') || error.includes('حاول')) {
          toast.error(error);
        } else {
          toast.error('بريد إلكتروني أو كلمة مرور غير صحيحة');
        }
      } else {
        toast.success('مرحباً بك في سوق شامل!');
      }
    } else {
      // Pass referrer to signup if available
      const { error } = await signup(email, password, fullName, referrerRef.current || undefined);
      if (error) {
        if (error.includes('مسجل') || error.includes('مستخدم')) {
          toast.error('هذا البريد الإلكتروني مسجل مسبقاً');
        } else {
          toast.error('حدث خطأ أثناء إنشاء الحساب');
        }
      } else {
        toast.success('تم إنشاء حسابك بنجاح!');
        // Clear referrer after successful signup
        try { localStorage.removeItem('suq_referrer'); } catch { /* ignore */ }
      }
    }
  };

  const switchMode = (newMode: AuthMode) => {
    setMode(newMode);
    setErrors({});
    setEmail('');
    setPassword('');
    setFullName('');
  };

  return (
    <div className="min-h-[100dvh] flex flex-col bg-[var(--color-bg)]">
      {/* ── Gradient Top Section ── */}
      <div className="gradient-dark px-6 pt-12 pb-14 flex flex-col items-center relative overflow-hidden">
        {/* Decorative orbs */}
        <div className="absolute top-[-40px] right-[-30px] w-[160px] h-[160px] rounded-full bg-teal-600/20 blur-[60px]" />
        <div className="absolute bottom-[-20px] left-[-20px] w-[100px] h-[100px] rounded-full bg-emerald-600/15 blur-[50px]" />
        
        <div className="relative z-10">
          {/* Logo */}
          <div className="w-16 h-16 rounded-2xl overflow-hidden shadow-xl shadow-emerald-500/30 mb-4 glow-primary">
            <img src="/app-icon.png" alt="سوق شامل" className="w-full h-full object-cover" />
          </div>

          {/* Title */}
          <h1 className="text-[22px] font-black text-white tracking-tight text-center">
            سوق شامل
          </h1>
          <p className="text-teal-300 dark:text-teal-600/60 text-[13px] mt-1 font-semibold text-center">
            الإلكتروني
          </p>
        </div>
      </div>

      {/* ── White Bottom Card ── */}
      <div className="flex-1 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-t-[28px] -mt-6 relative z-10 shadow-[0_-4px_30px_rgba(5,150,105,0.06)]">
        <div className="px-6 pt-7 pb-8">
          {/* Tab Switcher */}
          <div className="flex bg-emerald-50/60 dark:bg-emerald-900/20 rounded-2xl p-1 mb-7 relative">
            {/* Sliding indicator */}
            <div
              className="absolute top-1 bottom-1 w-[calc(50%-4px)] gradient-primary rounded-xl shadow-md shadow-emerald-500/20 transition-all duration-200 ease-out"
              style={{
                right: mode === 'login' ? '4px' : undefined,
                left: mode === 'signup' ? '4px' : undefined,
              }}
            />
            {(['login', 'signup'] as AuthMode[]).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => switchMode(tab)}
                className={`flex-1 py-3 rounded-xl text-[14px] font-bold relative z-10 transition-colors duration-150 ${
                  mode === tab ? 'text-white' : 'text-slate-400'
                }`}
              >
                {tab === 'login' ? 'تسجيل الدخول' : 'إنشاء حساب'}
              </button>
            ))}
          </div>

          {/* Referral banner */}
          {mode === 'signup' && hasReferrer && (
            <div className="mb-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200/60 dark:border-amber-800/40 rounded-2xl p-3.5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-amber-100 dark:bg-amber-800/40 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Sparkles className="w-[18px] h-[18px] text-amber-600 dark:text-amber-400" />
                </div>
                <p className="text-[12px] text-amber-700 dark:text-amber-300 font-bold leading-relaxed">
                  🎁 تم تفعيل رابط الإحالة! ستحصل على مكافأة عند التسجيل
                </p>
              </div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <Input
                label="الاسم الكامل"
                type="text"
                placeholder="أدخل اسمك الكامل"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                error={errors.fullName}
                icon={<User className="w-[18px] h-[18px]" />}
              />
            )}

            <Input
              label="البريد الإلكتروني"
              type="email"
              placeholder="example@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={errors.email}
              icon={<Mail className="w-[18px] h-[18px]" />}
            />

            <Input
              label="كلمة المرور"
              type="password"
              placeholder="أدخل كلمة المرور"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={errors.password}
              icon={<Lock className="w-[18px] h-[18px]" />}
            />

            {/* Welcome Message */}
            {mode === 'signup' && (
              <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200/60 rounded-2xl p-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 gradient-primary rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm">
                    <Sparkles className="w-[18px] h-[18px] text-white" />
                  </div>
                  <p className="text-[13px] text-slate-700 font-semibold leading-relaxed">
                    انضم إلى سوق شامل واكتشف{' '}
                    <span className="text-emerald-600 font-black text-[15px]">أفضل المتاجر</span>{' '}
                    والمنتجات المحلية
                  </p>
                </div>
              </div>
            )}

            <Button
              type="submit"
              fullWidth
              size="lg"
              loading={loading}
              icon={<LogIn className="w-5 h-5" />}
            >
              {mode === 'login' ? 'تسجيل الدخول' : 'إنشاء الحساب'}
            </Button>
          </form>

          {/* Demo Hint */}
          <div className="mt-7">
            <div className="bg-emerald-50/40 dark:bg-emerald-900/20 rounded-2xl p-4 border border-emerald-100/40 dark:border-emerald-800/30">
              <p className="text-[12px] text-[var(--color-text-tertiary)] text-center font-medium leading-relaxed">
                💡 أنشئ حسابك الآن وانضم إلى سوق شامل
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
