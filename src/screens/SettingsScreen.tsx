'use client';
import React, { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import {
  ArrowRight, Sun, Moon, Monitor, Bell, Mail, Phone, Lock,
  Shield, Eye, MessageCircle, Globe, Check, Volume2,
  UserCheck, Package, Gift, Store, AlertCircle,
  Trash2, HardDrive, Clock, Database, RefreshCw, ShieldAlert
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useAppStore } from '@/store/appStore';
import { useNotificationStore } from '@/store/notificationStore';
import { Button } from '@/components/market/Button';
import { Input } from '@/components/market/Input';
import { PushSubscribe } from '@/components/PushSubscribe';
import toast from 'react-hot-toast';
import { apiPut } from '@/lib/fetchApi';

interface ToggleProps {
  enabled: boolean;
  onChange: (_val: boolean) => void;
  label: string;
  description?: string;
  icon?: React.ReactNode;
}

const Toggle: React.FC<ToggleProps> = ({ enabled, onChange, label, description, icon }) => (
  <div className="flex items-center justify-between py-3.5 gap-3">
    <div className="flex items-center gap-3 flex-1 min-w-0">
      {icon && <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-500 dark:text-emerald-400 flex-shrink-0">{icon}</div>}
      <div className="min-w-0">
        <p className="text-[13px] font-bold text-[var(--color-text)] truncate">{label}</p>
        {description && <p className="text-[11px] text-[var(--color-text-tertiary)] mt-0.5 truncate">{description}</p>}
      </div>
    </div>
    <button
      onClick={() => onChange(!enabled)}
      className={`relative w-12 h-7 rounded-full transition-all duration-300 flex-shrink-0 ${enabled ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-700'}`}
    >
      <div className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow-md transition-all duration-300 ${enabled ? 'left-0.5' : 'left-[22px]'}`} />
    </button>
  </div>
);

export const SettingsScreen: React.FC = () => {
  const user = useAuthStore(s => s.user);
  const updateUser = useAuthStore(s => s.updateUser);
  const setSubScreen = useAppStore(s => s.setSubScreen);
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [activeSection, setActiveSection] = useState('account');
  const [cleaning, setCleaning] = useState(false);

  // Account settings
  const [editName, setEditName] = useState(user?.full_name || '');
  const [editPhone, setEditPhone] = useState(user?.phone || '');
  const [editCity, setEditCity] = useState(user?.city || '');
  const [saving, setSaving] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  // Notification settings (persisted via notificationStore)
  const notifStoreSettings = useNotificationStore(s => s.settings);
  const updateNotifStoreSettings = useNotificationStore(s => s.updateSettings);

  // Privacy settings (via notificationStore — single source of truth)
  const privacySettings = useNotificationStore(s => s.privacy);
  const updatePrivacySettings = useNotificationStore(s => s.updatePrivacySettings);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSaveProfile = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const res = await apiPut('/api/user', {
        userId: user.id,
        full_name: editName.trim(),
        phone: editPhone.trim(),
        city: editCity.trim(),
      });
      if (res.error) throw new Error(res.error);
      updateUser({ full_name: editName.trim(), phone: editPhone.trim() || null, city: editCity.trim() || null });
      toast.success('تم حفظ التعديلات');
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : 'حدث خطأ أثناء الحفظ');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      toast.error('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('كلمات المرور غير متطابقة');
      return;
    }
    setChangingPassword(true);
    try {
      const res = await apiPut('/api/user', {
        userId: user?.id,
        currentPassword: currentPassword || undefined,
        newPassword,
      });
      if (res.error) throw new Error();
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast.success('تم تغيير كلمة المرور');
    } catch {
      toast.error('حدث خطأ أثناء تغيير كلمة المرور');
    } finally {
      setChangingPassword(false);
    }
  };

  const themeOptions = [
    { id: 'light', label: 'الوضع النهاري', icon: <Sun className="w-5 h-5" />, desc: 'مظهر فاتح مريح للعين' },
    { id: 'dark', label: 'الوضع الليلي', icon: <Moon className="w-5 h-5" />, desc: 'مظهر داكن للحماية من الضوء' },
    { id: 'system', label: 'تلقائي', icon: <Monitor className="w-5 h-5" />, desc: 'يتغير حسب إعدادات الهاتف' },
  ];

  const cleanupItems = [
    { id: 'notifications', label: 'حذف الإشعارات القديمة', description: 'مسح جميع الإشعارات المحفوظة محلياً', icon: <Bell className="w-4 h-4" />, keys: ['suq_maraa_notifications'] },
    { id: 'cache', label: 'حذف Cache محلي', description: 'مسح البيانات المؤقتة المخزنة للتطبيق', icon: <HardDrive className="w-4 h-4" />, keys: ['suq_cache_products', 'suq_cache_stores', 'suq_cache_data'] },
    { id: 'temp', label: 'حذف بيانات مؤقتة', description: 'حذف البيانات المؤقتة وغير الدائمة', icon: <Clock className="w-4 h-4" />, keys: [] },
    { id: 'favorites', label: 'تنظيف المفضلة التالفة', description: 'إزالة المنتجات المحذوفة من المفضلة', icon: <Database className="w-4 h-4" />, keys: [] },
    { id: 'search', label: 'تنظيف نتائج بحث محفوظة', description: 'مسح سجل البحث المحفوظ', icon: <RefreshCw className="w-4 h-4" />, keys: ['suq_search_history'] },
    { id: 'chat', label: 'تنظيف سجل الدردشة المحلي', description: 'مسح محادثات الدردشة المحفوظة', icon: <MessageCircle className="w-4 h-4" />, keys: ['mar3_chat_conversations_v2', 'mar3_chat_archived_v2', 'mar3_chat_starred_v2'] },
  ];

  const runCleanup = async () => {
    setCleaning(true);
    try {
      // 1. Notifications — clear via notificationStore (single source)
      try {
        const userId = useAuthStore.getState().user?.id;
        if (userId) {
          useNotificationStore.getState().clearAllNotifications(userId);
        }
      } catch { /* notificationStore clear failed — non-critical */ }
      try {
        const favoritesState = useAppStore.getState().favorites;
        const brokenFavs = favoritesState.filter(f => !f.product);
        brokenFavs.forEach(f => useAppStore.getState().removeFavorite(f.id));
      } catch { /* favorites cleanup failed — non-critical */ }
      try {
        const legacyKeys = [
          'suq_cache_products', 'suq_cache_stores', 'suq_cache_data',
          'suq_search_history',
          'mar3_chat_conversations_v2', 'mar3_chat_archived_v2', 'mar3_chat_starred_v2',
        ];
        legacyKeys.forEach(key => { try { localStorage.removeItem(key); } catch { /* localStorage unavailable */ } });
      } catch { /* legacy cleanup failed — non-critical */ }

      toast.success('تم تنظيف التطبيق بنجاح ✨');
    } catch {
      toast.error('حدث خطأ أثناء التنظيف');
    } finally {
      setCleaning(false);
    }
  };

  const sections = [
    { id: 'account', label: 'الحساب', icon: <UserCheck className="w-4 h-4" /> },
    { id: 'notifications', label: 'الإشعارات', icon: <Bell className="w-4 h-4" /> },
    { id: 'privacy', label: 'الخصوصية', icon: <Shield className="w-4 h-4" /> },
    { id: 'appearance', label: 'المظهر', icon: <Eye className="w-4 h-4" /> },
    { id: 'cleanup', label: 'تنظيف', icon: <Trash2 className="w-4 h-4" /> },
  ];

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-[var(--color-bg)] pb-24">
      {/* Header */}
      <div className="gradient-dark px-5 pt-8 pb-5 relative overflow-hidden">
        <div className="absolute top-[-40px] right-[-30px] w-[180px] h-[180px] rounded-full bg-teal-600/15 blur-[60px]" />
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => setSubScreen('none')} className="w-9 h-9 bg-white/10 backdrop-blur-sm rounded-xl flex items-center justify-center text-white hover:bg-white/20">
              <ArrowRight className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-white text-[18px] font-black">الإعدادات</h1>
              <p className="text-teal-300/50 text-[11px] mt-0.5">إدارة حسابك وتفضيلاتك</p>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 mt-4 space-y-4">
        {/* Section Tabs */}
        <div className="bg-[var(--color-surface)] rounded-2xl p-1.5 border border-[var(--color-border)] shadow-sm flex gap-1">
          {sections.map((sec) => (
            <button
              key={sec.id}
              onClick={() => setActiveSection(sec.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[11px] font-bold transition-all duration-200 ${
                activeSection === sec.id
                  ? 'gradient-primary text-white shadow-md shadow-emerald-500/20'
                  : 'text-[var(--color-text-secondary)] hover:bg-emerald-50 dark:hover:bg-emerald-900/20'
              }`}
            >
              {sec.icon}
              <span className="hidden sm:inline">{sec.label}</span>
            </button>
          ))}
        </div>

        {/* Account Settings */}
        {activeSection === 'account' && (
          <div className="space-y-4 animate-[fadeIn_200ms_ease-out]">
            {/* Personal Info */}
            <div className="bg-[var(--color-surface)] rounded-2xl p-4 border border-[var(--color-border)] shadow-sm">
              <h3 className="text-[13px] font-bold text-emerald-500 dark:text-emerald-400 mb-4 flex items-center gap-2">
                <Mail className="w-4 h-4" />
                المعلومات الشخصية
              </h3>
              <div className="space-y-3">
                <Input
                  label="الاسم الكامل"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="أدخل اسمك الكامل"
                  icon={<UserCheck className="w-4 h-4" />}
                />
                <Input
                  label="رقم الهاتف (اختياري)"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  placeholder="مثال: 09XXXXXXXX"
                  icon={<Phone className="w-4 h-4" />}
                  type="tel"
                />
                <Input
                  label="المدينة (اختياري)"
                  value={editCity}
                  onChange={(e) => setEditCity(e.target.value)}
                  placeholder="مثال: دمشق"
                  icon={<Globe className="w-4 h-4" />}
                />
                <div className="bg-emerald-50/40 dark:bg-emerald-900/20 rounded-xl p-3 border border-emerald-100/40 dark:border-emerald-800/30">
                  <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300">
                    <Mail className="w-4 h-4" />
                    <p className="text-[13px] font-semibold">{user?.email}</p>
                  </div>
                  <p className="text-[11px] text-[var(--color-text-tertiary)] mt-1 mr-6">لا يمكن تغيير البريد الإلكتروني</p>
                </div>
                <Button fullWidth onClick={handleSaveProfile} loading={saving} disabled={!editName.trim()}>
                  حفظ التعديلات
                </Button>
              </div>
            </div>

            {/* Change Password */}
            <div className="bg-[var(--color-surface)] rounded-2xl p-4 border border-[var(--color-border)] shadow-sm">
              <h3 className="text-[13px] font-bold text-emerald-500 dark:text-emerald-400 mb-4 flex items-center gap-2">
                <Lock className="w-4 h-4" />
                تغيير كلمة المرور
              </h3>
              <div className="space-y-3">
                <Input
                  label="كلمة المرور الحالية (إن وجدت)"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="••••••"
                  type="password"
                  icon={<Lock className="w-4 h-4" />}
                />
                <Input
                  label="كلمة المرور الجديدة"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="6 أحرف على الأقل"
                  type="password"
                  icon={<Lock className="w-4 h-4" />}
                />
                <Input
                  label="تأكيد كلمة المرور"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="أعد كتابة كلمة المرور"
                  type="password"
                  icon={<Lock className="w-4 h-4" />}
                />
                <Button fullWidth onClick={handleChangePassword} loading={changingPassword} disabled={!newPassword}>
                  تغيير كلمة المرور
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Notification Settings */}
        {activeSection === 'notifications' && (
          <div className="space-y-4 animate-[fadeIn_200ms_ease-out]">
            <div className="bg-[var(--color-surface)] rounded-2xl p-4 border border-[var(--color-border)] shadow-sm">
              <h3 className="text-[13px] font-bold text-emerald-500 dark:text-emerald-400 mb-2 flex items-center gap-2">
                <Bell className="w-4 h-4" />
                إعدادات الإشعارات
              </h3>
              <p className="text-[11px] text-[var(--color-text-tertiary)] mb-3">تحكم في الإشعارات التي تتلقاها</p>
              <div className="divide-y divide-[var(--color-border)]">
                {/* Push Notifications Subscription */}
                <PushSubscribe />

                <Toggle
                  enabled={notifStoreSettings.enabled}
                  onChange={(v) => updateNotifStoreSettings({ enabled: v })}
                  label="تفعيل الإشعارات"
                  description="تفعيل/تعطيل جميع الإشعارات"
                  icon={<Bell className="w-4 h-4" />}
                />
                <Toggle
                  enabled={notifStoreSettings.types.message !== false}
                  onChange={(v) => updateNotifStoreSettings({ types: { ...notifStoreSettings.types, message: v } })}
                  label="إشعارات الرسائل"
                  description="إشعار عند استلام رسالة جديدة"
                  icon={<MessageCircle className="w-4 h-4" />}
                />
                <Toggle
                  enabled={notifStoreSettings.types.store !== false}
                  onChange={(v) => updateNotifStoreSettings({ types: { ...notifStoreSettings.types, store: v } })}
                  label="المنتجات والعروض الجديدة"
                  description="إشعار عند نشر منتج أو عرض من متجر تتابعه"
                  icon={<Package className="w-4 h-4" />}
                />
                <Toggle
                  enabled={notifStoreSettings.types.system !== false}
                  onChange={(v) => updateNotifStoreSettings({ types: { ...notifStoreSettings.types, system: v } })}
                  label="إشعارات النظام"
                  description="تحديثات النظام والصيانة"
                  icon={<AlertCircle className="w-4 h-4" />}
                />
                <Toggle
                  enabled={notifStoreSettings.types.admin !== false}
                  onChange={(v) => updateNotifStoreSettings({ types: { ...notifStoreSettings.types, admin: v } })}
                  label="إشعارات الإدارة"
                  description="توثيق، نقاط، وإجراءات إدارية"
                  icon={<Shield className="w-4 h-4" />}
                />
                <Toggle
                  enabled={notifStoreSettings.types.points !== false}
                  onChange={(v) => updateNotifStoreSettings({ types: { ...notifStoreSettings.types, points: v } })}
                  label="إشعارات النقاط"
                  description="شراء وكسب وخصم النقاط"
                  icon={<Gift className="w-4 h-4" />}
                />
                <Toggle
                  enabled={notifStoreSettings.types.interaction !== false}
                  onChange={(v) => updateNotifStoreSettings({ types: { ...notifStoreSettings.types, interaction: v } })}
                  label="التفاعلات"
                  description="إعجابات وتعليقات ومشاركات"
                  icon={<Store className="w-4 h-4" />}
                />
              </div>
            </div>
          </div>
        )}

        {/* Privacy Settings */}
        {activeSection === 'privacy' && (
          <div className="space-y-4 animate-[fadeIn_200ms_ease-out]">
            <div className="bg-[var(--color-surface)] rounded-2xl p-4 border border-[var(--color-border)] shadow-sm">
              <h3 className="text-[13px] font-bold text-emerald-500 dark:text-emerald-400 mb-2 flex items-center gap-2">
                <Shield className="w-4 h-4" />
                إعدادات الخصوصية
              </h3>
              <p className="text-[11px] text-[var(--color-text-tertiary)] mb-3">تحكم في خصوصيتك ومعلوماتك الشخصية</p>
              <div className="divide-y divide-[var(--color-border)]">
                <Toggle
                  enabled={privacySettings.showAvatar}
                  onChange={(v) => updatePrivacySettings({ showAvatar: v })}
                  label="إظهار الصورة الشخصية"
                  description="السماح للمستخدمين برؤية صورتك"
                  icon={<Eye className="w-4 h-4" />}
                />
                <Toggle
                  enabled={privacySettings.showActivity}
                  onChange={(v) => updatePrivacySettings({ showActivity: v })}
                  label="إظهار حالة النشاط"
                  description="إظهار آخر ظهور لك في الدردشة"
                  icon={<Volume2 className="w-4 h-4" />}
                />
                <Toggle
                  enabled={privacySettings.allowMessages}
                  onChange={(v) => updatePrivacySettings({ allowMessages: v })}
                  label="السماح بالرسائل"
                  description="السماح للمستخدمين بإرسال رسائل"
                  icon={<MessageCircle className="w-4 h-4" />}
                />
              </div>
            </div>
          </div>
        )}

        {/* Appearance Settings */}
        {activeSection === 'appearance' && (
          <div className="space-y-4 animate-[fadeIn_200ms_ease-out]">
            <div className="bg-[var(--color-surface)] rounded-2xl p-4 border border-[var(--color-border)] shadow-sm">
              <h3 className="text-[13px] font-bold text-emerald-500 dark:text-emerald-400 mb-2 flex items-center gap-2">
                <Eye className="w-4 h-4" />
                المظهر
              </h3>
              <p className="text-[11px] text-[var(--color-text-tertiary)] mb-4">اختر المظهر المناسب لك</p>
              <div className="space-y-2.5">
                {themeOptions.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => setTheme(opt.id)}
                    className={`w-full flex items-center gap-3.5 p-3.5 rounded-xl border-2 transition-all duration-200 ${
                      theme === opt.id
                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 shadow-sm'
                        : 'border-[var(--color-border)] hover:border-emerald-300 dark:hover:border-emerald-700'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      theme === opt.id
                        ? 'gradient-primary text-white'
                        : 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-500 dark:text-emerald-400'
                    }`}>
                      {opt.icon}
                    </div>
                    <div className="flex-1 text-right">
                      <p className={`text-[13px] font-bold ${theme === opt.id ? 'text-emerald-700 dark:text-emerald-300' : 'text-[var(--color-text)]'}`}>
                        {opt.label}
                      </p>
                      <p className="text-[11px] text-[var(--color-text-tertiary)]">{opt.desc}</p>
                    </div>
                    {theme === opt.id && (
                      <div className="w-6 h-6 rounded-full gradient-primary flex items-center justify-center flex-shrink-0">
                        <Check className="w-3.5 h-3.5 text-white" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Language */}
            <div className="bg-[var(--color-surface)] rounded-2xl p-4 border border-[var(--color-border)] shadow-sm">
              <h3 className="text-[13px] font-bold text-emerald-500 dark:text-emerald-400 mb-4 flex items-center gap-2">
                <Globe className="w-4 h-4" />
                اللغة
              </h3>
              <div className="flex items-center gap-3 p-3.5 rounded-xl border-2 border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20">
                <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center text-white text-[15px] font-bold">ع</div>
                <div className="flex-1 text-right">
                  <p className="text-[13px] font-bold text-emerald-700 dark:text-emerald-300">العربية</p>
                  <p className="text-[11px] text-[var(--color-text-tertiary)]">اللغة الافتراضية</p>
                </div>
                <div className="w-6 h-6 rounded-full gradient-primary flex items-center justify-center">
                  <Check className="w-3.5 h-3.5 text-white" />
                </div>
              </div>
              <div className="mt-2.5 flex items-center gap-2 p-3 rounded-xl bg-[var(--color-bg)] opacity-50">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-500 dark:text-emerald-400 text-[15px] font-bold">En</div>
                <div className="flex-1 text-right">
                  <p className="text-[13px] font-bold text-[var(--color-text-secondary)]">English</p>
                  <p className="text-[11px] text-[var(--color-text-tertiary)]">قريباً</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Cleanup Section */}
        {activeSection === 'cleanup' && (
          <div className="space-y-4 animate-[fadeIn_200ms_ease-out]">
            {/* Warning Banner */}
            <div className="bg-amber-50/60 dark:bg-amber-900/15 rounded-2xl p-3.5 border border-amber-200/50 dark:border-amber-800/30 flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                <ShieldAlert className="w-4.5 h-4.5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-[13px] font-bold text-amber-800 dark:text-amber-300">تنظيف التطبيق</p>
                <p className="text-[11px] text-amber-700/70 dark:text-amber-400/70 mt-0.5 leading-relaxed">هذه الأدوات ستساعدك في تحرير المساحة وتنظيف البيانات غير الضرورية المخزنة على جهازك.</p>
              </div>
            </div>

            {/* Cleanup Options */}
            <div className="bg-[var(--color-surface)] rounded-2xl p-4 border border-[var(--color-border)] shadow-sm">
              <h3 className="text-[13px] font-bold text-emerald-500 dark:text-emerald-400 mb-2 flex items-center gap-2">
                <Trash2 className="w-4 h-4" />
                تنظيف التطبيق
              </h3>
              <p className="text-[11px] text-[var(--color-text-tertiary)] mb-3">اختر العناصر التي تريد تنظيفها</p>
              <div className="space-y-1">
                {cleanupItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 p-3 rounded-xl hover:bg-emerald-50/50 dark:hover:bg-emerald-900/10 transition-colors"
                  >
                    <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-500 dark:text-emerald-400 flex-shrink-0">
                      {item.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-bold text-[var(--color-text)]">{item.label}</p>
                      <p className="text-[10px] text-[var(--color-text-tertiary)] mt-0.5">{item.description}</p>
                    </div>
                    <Trash2 className="w-4 h-4 text-[var(--color-text-tertiary)] flex-shrink-0" />
                  </div>
                ))}
              </div>
            </div>

            {/* Clean All Button */}
            <div className="bg-[var(--color-surface)] rounded-2xl p-4 border border-[var(--color-border)] shadow-sm">
              <Button
                fullWidth
                onClick={runCleanup}
                loading={cleaning}
                icon={cleaning ? undefined : <Trash2 className="w-4 h-4" />}
              >
                تنظيف الآن
              </Button>
              <p className="text-[10px] text-[var(--color-text-tertiary)] text-center mt-2">سيتم تنظيف جميع العناصر المذكورة أعلاه دفعة واحدة</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
