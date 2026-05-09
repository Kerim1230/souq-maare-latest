'use client';
import React, { useState, useEffect, useCallback } from 'react';
import {
  Palette, Clock, ShieldCheck, Wallet, Check, Loader2,
  Crown, Lock, Sparkles, Eye, MessageCircle, ShoppingBag,
  Package, Star, Layers, Zap, Info
} from 'lucide-react';
import { Modal } from '@/components/market/Modal';
import { useAppStore } from '@/store/appStore';
import { useVerificationStore } from '@/store/verificationStore';
import { useStoreColorStore, STORE_COLORS, type StoreGradientColor } from '@/store/storeColorStore';
import toast from 'react-hot-toast';
import { apiPut } from '@/lib/fetchApi';

// ===== Countdown Timer Hook =====
function useCountdown(targetMs: number, enabled: boolean) {
  const getInitialTime = useCallback((ms: number) => ({
    hours: Math.floor(ms / 3600000),
    minutes: Math.floor((ms % 3600000) / 60000),
    seconds: Math.floor((ms % 60000) / 1000),
  }), []);

  const [time, setTime] = useState({ hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    if (!enabled || targetMs <= 0) return;
    const initTimeout = setTimeout(() => {
      setTime(getInitialTime(targetMs));
    }, 0);
    const interval = setInterval(() => {
      setTime(prev => {
        const total = prev.hours * 3600 + prev.minutes * 60 + prev.seconds;
        if (total <= 1) {
          clearInterval(interval);
          clearTimeout(initTimeout);
          return { hours: 0, minutes: 0, seconds: 0 };
        }
        return getInitialTime((total - 1) * 1000);
      });
    }, 1000);
    return () => { clearInterval(interval); clearTimeout(initTimeout); };
  }, [targetMs, enabled, getInitialTime]);

  return time;
}

// ===== Upgrade Prompt Modal =====
interface UpgradePromptProps {
  isOpen: boolean;
  onClose: () => void;
}

const UpgradePromptModal: React.FC<UpgradePromptProps> = ({ isOpen, onClose }) => {
  const setSubScreen = useAppStore(s => s.setSubScreen);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="">
      <div className="p-6 text-center">
        <div className="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-br from-amber-100 to-amber-50 dark:from-amber-900/20 dark:to-amber-900/10 flex items-center justify-center mb-4 border border-amber-200/50 dark:border-amber-700/30">
          <Crown className="w-10 h-10 text-amber-500" />
        </div>
        <h3 className="text-[17px] font-black text-[var(--color-text)] mb-2">ميزة خاصة بالمتاجر الموثقة</h3>
        <p className="text-[13px] text-[var(--color-text-secondary)] leading-relaxed mb-6">
          تخصيص ألوان المتجر متاح فقط للمتاجر الموثقة. قم بتوثيق متجرك الآن!
        </p>
        <div className="space-y-2.5">
          <button
            onClick={() => { onClose(); setSubScreen('verification'); }}
            className="w-full flex items-center justify-center gap-2.5 py-3 rounded-xl gradient-primary text-white font-bold text-[14px] shadow-md shadow-emerald-500/20 active:scale-[0.98] transition-transform"
          >
            <ShieldCheck className="w-5 h-5" />
            توثيق المتجر الآن
          </button>
          <button
            onClick={() => { onClose(); setSubScreen('wallet'); }}
            className="w-full flex items-center justify-center gap-2.5 py-3 rounded-xl bg-gradient-to-l from-amber-400 to-amber-500 text-white font-bold text-[14px] shadow-md active:scale-[0.98] transition-transform"
          >
            <Wallet className="w-5 h-5" />
            الانتقال إلى المحفظة
          </button>
          <button
            onClick={onClose}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-secondary)] font-bold text-[14px] active:scale-[0.98] transition-transform"
          >
            لاحقاً
          </button>
        </div>
      </div>
    </Modal>
  );
};

// ===== Color Card =====
interface ColorCardProps {
  color: StoreGradientColor;
  isSelected: boolean;
  isDisabled: boolean;
  onClick: () => void;
  compact?: boolean;
}

const ColorCard: React.FC<ColorCardProps> = ({ color, isSelected, isDisabled, onClick, compact }) => (
  <button
    onClick={isDisabled ? undefined : onClick}
    disabled={isDisabled}
    className={`relative rounded-2xl overflow-hidden transition-all duration-200 flex flex-col items-center justify-center ${
      compact ? 'p-2 gap-1' : 'p-3 gap-2'
    } ${
      isSelected
        ? 'ring-2 ring-offset-2 ring-offset-[var(--color-surface)] scale-[1.02] shadow-lg'
        : isDisabled
          ? 'opacity-40 cursor-not-allowed'
          : 'hover:scale-[1.03] hover:shadow-md cursor-pointer active:scale-[0.97]'
    }`}
    style={{ '--color-ring': color.solid } as React.CSSProperties}
  >
    {/* Gradient Preview */}
    <div
      className={`w-full rounded-xl mb-1 shadow-sm ${compact ? 'h-7' : 'h-10'}`}
      style={{ background: `linear-gradient(135deg, ${color.from}, ${color.to})` }}
    />
    {/* Color Name */}
    <p className={`text-center leading-tight font-bold ${compact ? 'text-[9px]' : 'text-[11px]'} text-[var(--color-text)]`}>{color.name}</p>
    {/* Selected Check */}
    {isSelected && (
      <div
        className={`absolute ${compact ? 'top-1 left-1 w-4 h-4' : 'top-1.5 left-1.5 w-5 h-5'} rounded-full flex items-center justify-center shadow-md`}
        style={{ background: `linear-gradient(135deg, ${color.from}, ${color.to})` }}
      >
        <Check className={`${compact ? 'w-2.5 h-2.5' : 'w-3 h-3'} text-white`} strokeWidth={3} />
      </div>
    )}
  </button>
);

// ===== Cooldown helper (uses server timestamp as source of truth) =====
function getCooldownFromServer(themeColorChangedAt: string | null | undefined): { allowed: boolean; remainingMs: number } {
  const COOLDOWN_MS = 24 * 60 * 60 * 1000;
  if (!themeColorChangedAt) return { allowed: true, remainingMs: 0 };
  const elapsed = Date.now() - new Date(themeColorChangedAt).getTime();
  const remaining = COOLDOWN_MS - elapsed;
  if (remaining <= 0) return { allowed: true, remainingMs: 0 };
  return { allowed: false, remainingMs: remaining };
}

// ===== Mini Preview Components =====

const MiniStoreCover: React.FC<{ color: StoreGradientColor }> = ({ color }) => (
  <div
    className="h-20 rounded-t-xl relative overflow-hidden"
    style={{ background: `linear-gradient(135deg, ${color.from}, ${color.to})` }}
  >
    <div className="absolute inset-0 bg-black/15" />
    <div className="absolute bottom-2.5 right-2.5 left-2.5 flex items-center gap-2">
      <div className="px-2 py-0.5 rounded-md bg-white/20 backdrop-blur-sm">
        <span className="text-[9px] text-white font-bold">اسم المتجر</span>
      </div>
      <div className="flex items-center gap-1 bg-black/20 backdrop-blur-sm rounded-md px-1.5 py-0.5">
        <span className="text-[8px] text-white/90">👥 120</span>
      </div>
    </div>
    <div className="absolute top-2 right-2">
      <span
        className="px-1.5 py-0.5 rounded-full text-[7px] font-black text-white"
        style={{ background: color.solidLight, boxShadow: `0 1px 4px ${color.shadow}` }}
      >
        موثق ✨
      </span>
    </div>
  </div>
);

const MiniProductCard: React.FC<{ color: StoreGradientColor }> = ({ color }) => (
  <div className="bg-[var(--color-surface)] rounded-lg overflow-hidden border border-[var(--color-border)] shadow-sm">
    <div
      className="aspect-square relative"
      style={{ background: `linear-gradient(135deg, ${color.lightFrom}80, ${color.lightTo}80)` }}
    >
      <div className="absolute inset-0 flex items-center justify-center">
        <Package className="w-5 h-5" style={{ color: color.solid }} />
      </div>
      <div className="absolute top-1 right-1">
        <span
          className="text-white text-[7px] font-bold px-1 py-0.5 rounded-full"
          style={{ background: `linear-gradient(135deg, ${color.from}, ${color.to})` }}
        >جديد</span>
      </div>
    </div>
    <div className="p-1.5">
      <p className="text-[8px] font-bold text-[var(--color-text)] truncate">اسم المنتج</p>
      <p
        className="text-[9px] font-black mt-0.5"
        style={{ background: `linear-gradient(135deg, ${color.from}, ${color.to})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}
      >25,000 ل.س</p>
    </div>
  </div>
);

const MiniButtonRow: React.FC<{ color: StoreGradientColor }> = ({ color }) => (
  <div className="flex gap-1.5">
    <div
      className="flex-1 py-1.5 rounded-lg text-white text-[8px] font-bold text-center"
      style={{ background: `linear-gradient(135deg, ${color.from}, ${color.to})`, boxShadow: `0 2px 6px ${color.shadowLight}` }}
    >متابعة</div>
    <div
      className="flex-1 py-1.5 rounded-lg text-center text-[8px] font-bold border"
      style={{ borderColor: color.solidLight + '40', color: color.solid, background: color.solidLight + '10' }}
    >تواصل</div>
  </div>
);

const MiniTabBar: React.FC<{ color: StoreGradientColor }> = ({ color }) => (
  <div className="flex gap-0.5 bg-[var(--color-bg)] p-0.5 rounded-lg">
    {['المنتجات', 'العروض', 'المميزة', 'عن المتجر'].map((tab, i) => (
      <div
        key={i}
        className={`flex-1 py-1 rounded-md text-center text-[7px] font-bold ${
          i === 0 ? 'text-white' : 'text-[var(--color-text-tertiary)]'
        }`}
        style={i === 0 ? { background: `linear-gradient(135deg, ${color.from}, ${color.to})` } : undefined}
      >{tab}</div>
    ))}
  </div>
);

const MiniChatBubble: React.FC<{ color: StoreGradientColor }> = ({ color }) => (
  <div className="space-y-1.5">
    <div className="flex gap-1.5 items-end">
      <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ background: `linear-gradient(135deg, ${color.from}, ${color.to})` }} />
      <div
        className="rounded-lg rounded-br-sm px-2 py-1 text-[7px] text-white max-w-[70%]"
        style={{ background: `linear-gradient(135deg, ${color.from}, ${color.to})` }}
      >مرحباً! كيف يمكنني مساعدتك؟</div>
    </div>
    <div className="flex gap-1.5 items-end justify-end">
      <div className="rounded-lg rounded-bl-sm bg-[var(--color-bg)] px-2 py-1 text-[7px] text-[var(--color-text)] max-w-[70%]">
        أريد الاستفسار عن المنتج
      </div>
    </div>
  </div>
);

const MiniBadgeRow: React.FC<{ color: StoreGradientColor }> = ({ color }) => (
  <div className="flex flex-wrap gap-1">
    <span className="text-[7px] font-bold px-2 py-0.5 rounded-full text-white" style={{ background: `linear-gradient(135deg, ${color.from}, ${color.to})` }}>مميز</span>
    <span className="text-[7px] font-bold px-2 py-0.5 rounded-lg" style={{ background: color.solidLight + '18', color: color.solid }}>إلكترونيات</span>
    <span className="text-[7px] font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">خصم 20%</span>
    <span className="text-[7px] font-bold px-2 py-0.5 rounded-lg" style={{ background: color.solidLight + '12', color: color.solidLight }}>جديد</span>
  </div>
);

// ===== Theme application info cards =====
const THEME_APPLY_ITEMS = [
  { icon: Layers, label: 'غلاف المتجر', desc: 'خلفية صفحة متجرك' },
  { icon: ShoppingBag, label: 'بطاقات المنتجات', desc: 'ألوان المنتجات والأسعار' },
  { icon: Star, label: 'شارات التمييز', desc: 'مميز، جديد، التصنيف' },
  { icon: MessageCircle, label: 'فقاعات الدردشة', desc: 'رسائل العملاء' },
  { icon: Zap, label: 'الأزرار والتبويبات', desc: 'متابعة، تواصل، القوائم' },
  { icon: Package, label: 'بطاقات العروض', desc: 'عروض ومسابقات المتجر' },
];

// ===== Main Store Color Picker =====
export const StoreColorPicker: React.FC = () => {
  const myStore = useAppStore(s => s.myStore);
  const setMyStore = useAppStore(s => s.setMyStore);
  const storeVerification = useVerificationStore(s => myStore ? s.verifications[myStore.id] : undefined);
  const isVerified = myStore && storeVerification && storeVerification.isActive && storeVerification.endDate
    ? new Date(storeVerification.endDate) > new Date()
    : myStore ? !!myStore.is_verified : false;
  const getStoreColorById = useStoreColorStore(s => s.getStoreColorById);
  const [saving, setSaving] = useState(false);
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);
  const [selectedColorId, setSelectedColorId] = useState<string | null>(null);
  const [activePreviewTab, setActivePreviewTab] = useState<'store' | 'product' | 'chat' | 'badges'>('store');


  const currentColor = myStore?.theme_color ? getStoreColorById(myStore.theme_color) : null;
  const displayColor = selectedColorId ? getStoreColorById(selectedColorId) : currentColor;

  // Cooldown from server (source of truth)
  const serverCooldown = getCooldownFromServer(myStore?.theme_color_changed_at);
  const countdown = useCountdown(serverCooldown.remainingMs, !serverCooldown.allowed);

  // On mount and when myStore.theme_color changes, sync selectedColorId
  useEffect(() => {
    if (currentColor) {
      setSelectedColorId(currentColor.id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- currentColor.id is the stable trigger
  }, [currentColor?.id]);

  const handleSave = useCallback(async () => {
    if (!myStore || !selectedColorId || saving) return;

    setSaving(true);
    try {
      const { data, error } = await apiPut('/api/my-store/theme', { storeId: myStore.id, colorId: selectedColorId });

      if (error) {
        // Check for NOT_VERIFIED error to show upgrade prompt
        if (error.includes('NOT_VERIFIED') || error.includes('موثق')) {
          setShowUpgradePrompt(true);
          return;
        }
        toast.error(error);
        return;
      }

      const savedColorId = data?.store?.themeColor;
      const savedAt = data?.store?.themeColorChangedAt || null;

      setMyStore({
        ...myStore,
        theme_color: savedColorId,
        theme_color_changed_at: savedAt,
      });

      setSelectedColorId(savedColorId);
      toast.success(data?.message || 'تم تحديث لون المتجر بنجاح ✨');
    } catch (err) {
      console.error('Store color save error:', err);
      toast.error('حدث خطأ أثناء حفظ اللون');
    } finally {
      setSaving(false);
    }
  }, [myStore, selectedColorId, saving, setMyStore]);

  const previewTabs = [
    { id: 'store' as const, label: 'المتجر', icon: ShoppingBag },
    { id: 'product' as const, label: 'المنتجات', icon: Package },
    { id: 'chat' as const, label: 'الدردشة', icon: MessageCircle },
    { id: 'badges' as const, label: 'الشارات', icon: Star },
  ];

  // ===== Non-verified State =====
  if (!isVerified) {
    return (
      <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] shadow-sm overflow-hidden">
        {/* Locked Header */}
        <div className="bg-gradient-to-l from-slate-100 to-slate-50 dark:from-slate-800/60 dark:to-slate-800/30 px-4 py-4 flex items-center gap-3 relative">
          <div className="w-10 h-10 rounded-xl bg-slate-200/60 dark:bg-slate-700/40 flex items-center justify-center">
            <Lock className="w-5 h-5 text-slate-400" />
          </div>
          <div className="text-right flex-1">
            <h3 className="text-[14px] font-bold text-slate-500 dark:text-slate-400">تخصيص لون المتجر 🎨</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">ميزة خاصة بالمتاجر الموثق فقط</p>
          </div>
          <button
            onClick={() => setShowUpgradePrompt(true)}
            className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-1.5 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-colors"
          >
            توثيق الآن
          </button>
        </div>

        {/* Preview Grid (disabled) */}
        <div className="p-4">
          <p className="text-[12px] text-slate-400 text-center mb-3">{STORE_COLORS.length} لون متاح بعد التوثيق</p>
          <div className="grid grid-cols-5 gap-2 opacity-40 pointer-events-none">
            {STORE_COLORS.slice(0, 10).map(color => (
              <div key={color.id} className="rounded-xl overflow-hidden flex flex-col items-center p-2 gap-1">
                <div className="w-full h-8 rounded-lg" style={{ background: `linear-gradient(135deg, ${color.from}, ${color.to})` }} />
                <span className="text-[9px] text-slate-500 text-center">{color.name}</span>
              </div>
            ))}
          </div>
          {STORE_COLORS.length > 10 && (
            <div className="grid grid-cols-5 gap-2 opacity-40 pointer-events-none mt-2">
              {STORE_COLORS.slice(10, 16).map(color => (
                <div key={color.id} className="rounded-xl overflow-hidden flex flex-col items-center p-2 gap-1">
                  <div className="w-full h-8 rounded-lg" style={{ background: `linear-gradient(135deg, ${color.from}, ${color.to})` }} />
                  <span className="text-[9px] text-slate-500 text-center">{color.name}</span>
                </div>
              ))}
            </div>
          )}

          {/* Theme apply info */}
          <div className="mt-4 p-3 bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-slate-100">
            <p className="text-[11px] font-bold text-slate-500 mb-2 flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5" />
              اللون يطبّق على جميع صفحات متجرك
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              {THEME_APPLY_ITEMS.slice(0, 4).map(item => (
                <div key={item.label} className="flex items-center gap-1.5">
                  <item.icon className="w-3 h-3 text-slate-400" />
                  <span className="text-[10px] text-slate-400">{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] shadow-sm overflow-hidden">
      {/* Header */}
      <div
        className="px-4 py-4 flex items-center gap-3 relative"
        style={{ background: displayColor ? `linear-gradient(135deg, ${displayColor.from}, ${displayColor.to})` : undefined }}
      >
        <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
          <Palette className="w-5 h-5 text-white" />
        </div>
        <div className="text-right flex-1">
          <h3 className="text-[14px] font-bold text-white">تخصيص لون المتجر 🎨</h3>
          <p className="text-[11px] text-white/70 mt-0.5">اللون يُطبّق على جميع صفحات متجرك</p>
        </div>
        <div className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center">
          <Sparkles className="w-4 h-4 text-white" />
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Current Color Info */}
        <div className="flex items-center gap-3 p-3 bg-[var(--color-bg)] rounded-xl">
          {currentColor && (
            <div
              className="w-10 h-10 rounded-xl shadow-sm flex items-center justify-center flex-shrink-0"
              style={{ background: `linear-gradient(135deg, ${currentColor.from}, ${currentColor.to})` }}
            >
              <span className="text-sm">{currentColor.icon}</span>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-bold text-[var(--color-text)]">اللون الحالي</p>
            <p className="text-[11px] text-[var(--color-text-tertiary)]">{currentColor?.name || 'الافتراضي'}</p>
          </div>
          {currentColor && (
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: `linear-gradient(135deg, ${currentColor.from}, ${currentColor.to})` }}
            >
              <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />
            </div>
          )}
        </div>

        {/* Color Grid */}
        <div>
          <p className="text-[12px] font-bold text-[var(--color-text)] mb-3 flex items-center gap-2">
            <Palette className="w-4 h-4 text-[var(--color-text-secondary)]" />
            اختر اللون المناسب
            <span className="text-[10px] font-normal text-[var(--color-text-tertiary)]">({STORE_COLORS.length} لون)</span>
          </p>
          <div className="grid grid-cols-5 gap-2.5">
            {STORE_COLORS.map(color => (
              <ColorCard
                key={color.id}
                color={color}
                isSelected={selectedColorId === color.id}
                isDisabled={false}
                onClick={() => setSelectedColorId(color.id)}
              />
            ))}
          </div>
        </div>

        {/* Live Preview */}
        {displayColor && (
          <div>
            <p className="text-[12px] font-bold text-[var(--color-text)] mb-3 flex items-center gap-2">
              <Eye className="w-4 h-4 text-[var(--color-text-secondary)]" />
              معاينة مباشرة
            </p>

            {/* Preview Tabs */}
            <div className="flex gap-1 mb-3 bg-[var(--color-bg)] p-0.5 rounded-lg">
              {previewTabs.map(tab => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActivePreviewTab(tab.id)}
                    className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-md text-[10px] font-bold transition-all ${
                      activePreviewTab === tab.id
                        ? 'text-white shadow-sm'
                        : 'text-[var(--color-text-tertiary)] hover:text-[var(--color-text)]'
                    }`}
                    style={activePreviewTab === tab.id ? { background: `linear-gradient(135deg, ${displayColor.from}, ${displayColor.to})` } : undefined}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Preview Content */}
            <div className="rounded-xl overflow-hidden border border-[var(--color-border)]">
              {activePreviewTab === 'store' && (
                <>
                  <MiniStoreCover color={displayColor} />
                  <div className="p-2.5 space-y-2 bg-[var(--color-surface)]">
                    <MiniTabBar color={displayColor} />
                    <MiniButtonRow color={displayColor} />
                  </div>
                </>
              )}
              {activePreviewTab === 'product' && (
                <div className="p-2.5 bg-[var(--color-surface)]">
                  <div className="grid grid-cols-2 gap-2">
                    <MiniProductCard color={displayColor} />
                    <MiniProductCard color={displayColor} />
                    <MiniProductCard color={displayColor} />
                    <MiniProductCard color={displayColor} />
                  </div>
                </div>
              )}
              {activePreviewTab === 'chat' && (
                <div className="p-2.5 bg-[var(--color-surface)]">
                  <div className="flex items-center gap-2 mb-2 pb-2 border-b border-gray-100">
                    <div className="w-5 h-5 rounded-full" style={{ background: `linear-gradient(135deg, ${displayColor.from}, ${displayColor.to})` }} />
                    <span className="text-[9px] font-bold text-[var(--color-text)]">اسم المتجر</span>
                    <span className="text-[7px] text-green-500 dark:text-green-400">● متصل</span>
                  </div>
                  <MiniChatBubble color={displayColor} />
                  <div className="mt-2">
                    <MiniButtonRow color={displayColor} />
                  </div>
                </div>
              )}
              {activePreviewTab === 'badges' && (
                <div className="p-3 bg-[var(--color-surface)] space-y-3">
                  <MiniBadgeRow color={displayColor} />
                  <div className="flex items-center gap-2 p-2 rounded-lg" style={{ background: displayColor.solidLight + '10' }}>
                    <div className="w-5 h-5 rounded-md flex items-center justify-center" style={{ background: displayColor.solidLight + '20', color: displayColor.solid }}>
                      <Star className="w-3 h-3" />
                    </div>
                    <div>
                      <p className="text-[8px] font-bold" style={{ color: displayColor.solid }}>إلكترونيات</p>
                      <p className="text-[7px] text-[var(--color-text-tertiary)]">تصنيف المتجر</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 p-2 rounded-lg" style={{ background: displayColor.solidLight + '10' }}>
                    <div className="w-5 h-5 rounded-md flex items-center justify-center" style={{ background: displayColor.solidLight + '20', color: displayColor.solid }}>
                      <ShieldCheck className="w-3 h-3" />
                    </div>
                    <div>
                      <p className="text-[8px] font-bold" style={{ color: displayColor.solid }}>متجر موثق ✨</p>
                      <p className="text-[7px] text-[var(--color-text-tertiary)]">حالة التوثيق</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Theme Apply Info */}
            <div className="mt-3 p-3 bg-[var(--color-bg)] rounded-xl">
              <p className="text-[11px] font-bold text-[var(--color-text-secondary)] mb-2 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5" />
                يطبّق اللون على {THEME_APPLY_ITEMS.length} عناصر في متجرك
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                {THEME_APPLY_ITEMS.map(item => (
                  <div key={item.label} className="flex items-center gap-1.5">
                    <div className="w-4 h-4 rounded flex items-center justify-center" style={{ background: displayColor.solidLight + '18', color: displayColor.solid }}>
                      <item.icon className="w-2.5 h-2.5" />
                    </div>
                    <div>
                      <span className="text-[9px] font-bold text-[var(--color-text)]">{item.label}</span>
                      <p className="text-[7px] text-[var(--color-text-tertiary)] leading-none">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Cooldown Timer */}
        {!serverCooldown.allowed && (
          <div className="flex items-center gap-3 p-3 bg-amber-50 dark:bg-amber-900/15 rounded-xl border border-amber-200/60 dark:border-amber-700/30">
            <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
              <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="text-right flex-1">
              <p className="text-[12px] font-bold text-amber-700 dark:text-amber-400">يمكنك التغيير مرة أخرى بعد انتهاء المهلة</p>
              <p className="text-[11px] text-amber-600/80 dark:text-amber-500/60 font-mono tabular-nums mt-0.5">
                {String(countdown.hours).padStart(2, '0')}:{String(countdown.minutes).padStart(2, '0')}:{String(countdown.seconds).padStart(2, '0')} متبقي
              </p>
            </div>
          </div>
        )}

        {/* Save Button */}
        <button
          onClick={handleSave}
          disabled={!selectedColorId || (selectedColorId === myStore?.theme_color) || saving || !serverCooldown.allowed}
          className={`w-full flex items-center justify-center gap-2.5 py-3.5 rounded-xl font-bold text-[14px] transition-all duration-200 ${
            (!selectedColorId || (selectedColorId === myStore?.theme_color) || saving || !serverCooldown.allowed)
              ? 'bg-slate-200 dark:bg-slate-700 text-slate-400 cursor-not-allowed'
              : 'text-white active:scale-[0.98] shadow-lg hover:shadow-xl'
          }`}
          style={
            (!selectedColorId || (selectedColorId === myStore?.theme_color) || saving || !serverCooldown.allowed)
              ? undefined
              : { background: `linear-gradient(135deg, ${displayColor?.from}, ${displayColor?.to})`, boxShadow: `0 4px 14px ${displayColor?.shadow}` }
          }
        >
          {saving ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              <Palette className="w-5 h-5" />
              {selectedColorId === myStore?.theme_color ? 'اللون الحالي محفوظ' : 'حفظ اللون'}
            </>
          )}
        </button>
      </div>

      {/* Upgrade Prompt Modal */}
      <UpgradePromptModal isOpen={showUpgradePrompt} onClose={() => setShowUpgradePrompt(false)} />
    </div>
  );
};

