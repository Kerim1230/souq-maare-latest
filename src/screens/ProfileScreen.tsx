'use client';
import React, { useState, useEffect, useMemo } from 'react';
import {
  User, Mail, Edit3, Store, LogOut, ChevronLeft, Bell, Globe, MapPin, ChevronDown,
  Shield, Wallet, Coins, History, LayoutDashboard, Clock, Crown, ShieldCheck, Share2,
  MessageCircle, Package, Heart, HelpCircle, Phone,
  AlertTriangle, FileText, Settings
} from 'lucide-react';
import { useChatStore, isUserInConversation } from '@/store/chatStore';
import { useNotificationStore } from '@/store/notificationStore';
import { Button } from '@/components/market/Button';
import { Input } from '@/components/market/Input';
import { Modal } from '@/components/market/Modal';
import { ImageUploader } from '@/components/market/ImageUploader';
import { useAuthStore } from '@/store/authStore';
import { apiPut } from '@/lib/fetchApi';
import { uploadImage } from '@/lib/upload-utils';
import { useAppStore } from '@/store/appStore';
import { usePointsStore } from '@/store/pointsStore';
import { useAutoDeleteStore } from '@/store/autoDeleteStore';
import { useVerificationStore } from '@/store/verificationStore';
import { UserAvatar } from '@/components/market/SafeImage';
import toast from 'react-hot-toast';
import { ReportModal } from '@/components/admin/ReportModal';
import { getCitiesForGovernorate, getGovernorateNames } from '@/lib/syria-data';

interface MenuItemProps {
  icon: React.ReactNode;
  label: string;
  sublabel?: string;
  onClick: () => void;
  color?: string;
  rightBadge?: React.ReactNode;
  danger?: boolean;
}

const MenuItem: React.FC<MenuItemProps> = ({ icon, label, sublabel, onClick, color = 'text-slate-500 dark:text-slate-400', rightBadge, danger }) => (
  <button onClick={onClick} className={`w-full flex items-center gap-3.5 py-3 px-1 rounded-xl transition-colors ${danger ? 'hover:bg-rose-50 dark:hover:bg-rose-900/10' : 'hover:bg-emerald-50/40 dark:hover:bg-emerald-900/10'}`}>
    <div className={`w-9 h-9 rounded-xl bg-emerald-50/60 dark:bg-emerald-900/20 flex items-center justify-center ${color} flex-shrink-0`}>{icon}</div>
    <div className="flex-1 text-right min-w-0">
      <p className={`text-[13px] font-bold truncate ${danger ? 'text-rose-600 dark:text-rose-400' : 'text-[var(--color-text)]'}`}>{label}</p>
      {sublabel && <p className="text-[11px] text-[var(--color-text-tertiary)] mt-0.5 truncate">{sublabel}</p>}
    </div>
    {rightBadge || <ChevronLeft className="w-4 h-4 text-[var(--color-border)] flex-shrink-0" />}
  </button>
);

const StatCard: React.FC<{ icon: React.ReactNode; label: string; value: number; color: string }> = ({ icon, label, value, color }) => (
  <div className="bg-[var(--color-surface)] rounded-2xl p-3.5 border border-[var(--color-border)] shadow-sm text-center flex-1">
    <div className={`w-9 h-9 rounded-xl mx-auto mb-2 flex items-center justify-center ${color}`}>{icon}</div>
    <p className="text-[16px] font-black text-[var(--color-text)]">{value}</p>
    <p className="text-[10px] text-[var(--color-text-tertiary)] font-semibold mt-0.5">{label}</p>
  </div>
);

export const ProfileScreen: React.FC = () => {
  const user = useAuthStore(s => s.user);
  const logout = useAuthStore(s => s.logout);
  const updateUser = useAuthStore(s => s.updateUser);
  const myStore = useAppStore(s => s.myStore);
  const setActiveTab = useAppStore(s => s.setActiveTab);
  const setSubScreen = useAppStore(s => s.setSubScreen);
  const pointsInit = usePointsStore(s => s.initialize);
  const rawExpiredContent = useAutoDeleteStore(s => s.expiredContent);
  const notifUnreadCount = useNotificationStore(s =>
    user ? s.notifications.reduce((c, n) => c + (n.userId === user.id && !n.isRead ? 1 : 0), 0) : 0
  );
  const expiryUnreadCount = useNotificationStore(s =>
    user ? s.notifications.reduce((c, n) => c + (n.userId === user.id && !n.isRead && n.category === 'expiry' ? 1 : 0), 0) : 0
  );
  // ⚡ Stable snapshot: subscribe to raw array ref (same ref unless store updates)
  const allNotifications = useNotificationStore(s => s.notifications);
  // Derived list computed outside selector — no infinite loop
  const expiryNotifs = useMemo(() =>
    user
      ? allNotifications
          .filter(n => n.userId === user.id && n.type === 'auto' && n.category === 'expiry' && !n.isRead)
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .slice(0, 3)
      : [],
    [allNotifications, user]
  );
  const markAllNotifAsRead = useNotificationStore(s => s.markAllAsRead);
  const initNotif = useNotificationStore(s => s.initialize);
  const [showEdit, setShowEdit] = useState(false);
  const [editName, setEditName] = useState(user?.full_name || '');
  const [editAvatar, setEditAvatar] = useState<string | null>(user?.avatar_url || null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [editGovernorate, setEditGovernorate] = useState('');
  const [editCity, setEditCity] = useState('');
  const [showCustomCity, setShowCustomCity] = useState(false);
  const availableCities = useMemo(() => editGovernorate ? getCitiesForGovernorate(editGovernorate) : [], [editGovernorate]);
  const [signingOut, setSigningOut] = useState(false);
  const [reportTarget, setReportTarget] = useState<{ type: 'user'; id: string; name: string } | null>(null);
  const loadStoreVerification = useVerificationStore(s => s.loadStoreVerification);
  const isStoreVerified = useVerificationStore(s => myStore ? s.isStoreVerified(myStore.id) : false);

  useEffect(() => { pointsInit(user?.id); initNotif(); useChatStore.getState().initialize(); }, [pointsInit, user?.id, initNotif]);

  // Load verification data from server when store is available
  useEffect(() => {
    if (myStore?.id) {
      loadStoreVerification(myStore.id);
    }
  }, [myStore?.id, loadStoreVerification]);

  // Reactive wallet selector
  const wallet = usePointsStore(s => user ? s.wallets[user.id] || null : null);

  const chatUnreadCount = useChatStore(s => user ? s.conversations.reduce((sum, c) => sum + (isUserInConversation(c.id, user.id) ? (c.unreadCount || 0) : 0), 0) : 0);
  const totalUnread = notifUnreadCount + expiryUnreadCount;
  const isAdmin = user?.is_admin === true;

  // Activity stats
  const productCount = useMemo(() => user ? rawExpiredContent.filter(i => i.userId === user.id && i.contentType === 'product').length : 0, [rawExpiredContent, user]);
  const storeCount = myStore ? 1 : 0;
  const messageCount = chatUnreadCount;

  const handleSaveProfile = async () => {
    if (!user || !editName.trim()) return;
    setSavingProfile(true);
    try {
      // Upload avatar to Cloudinary if it's a new base64 image
      const avatarUrl = await uploadImage(editAvatar);

      // Warn if avatar upload failed but user had selected a new image
      if (editAvatar && editAvatar.startsWith('data:image/') && !avatarUrl) {
        toast.error('فشل رفع الصورة الشخصية. حاول مرة أخرى.');
        setSavingProfile(false);
        return;
      }

      const finalAvatarUrl = avatarUrl || (editAvatar && !editAvatar.startsWith('data:image/') ? editAvatar.trim() : null);

      const { error } = await apiPut('/api/user', { userId: user.id, full_name: editName.trim(), avatar_url: finalAvatarUrl, governorate: editGovernorate, city: editCity });
      if (error) throw new Error(error);
      updateUser({ full_name: editName.trim(), avatar_url: finalAvatarUrl, governorate: editGovernorate, city: editCity });
      setShowEdit(false);
      toast.success('تم تحديث الملف الشخصي');
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : 'حدث خطأ أثناء تحديث الملف الشخصي');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSignOut = async () => {
    if (!confirm('هل أنت متأكد من تسجيل الخروج؟')) return;
    setSigningOut(true);
    try {
      await logout();
      toast.success('تم تسجيل الخروج بنجاح');
    } catch {
      toast.error('حدث خطأ أثناء تسجيل الخروج');
    } finally {
      setSigningOut(false);
    }
  };

  const expiredCount = useMemo(() => user ? rawExpiredContent.filter(i => i.userId === user.id).length : 0, [rawExpiredContent, user]);

  return (
    <div className="pb-24 min-h-screen bg-[var(--color-bg)]">
      {/* Header */}
      <div className="gradient-dark px-5 pt-8 pb-[4.5rem] relative overflow-hidden">
        <div className="absolute top-[-40px] right-[-30px] w-[180px] h-[180px] rounded-full bg-teal-600/15 blur-[60px]" />
        <div className="absolute bottom-[-40px] left-[-30px] w-[140px] h-[140px] rounded-full bg-emerald-600/10 blur-[60px]" />
        <div className="relative z-10 flex items-center justify-between">
          <div>
            <h1 className="text-white text-[20px] font-black">حسابي</h1>
            <p className="text-teal-300/50 text-[12px] mt-0.5">إدارة حسابك الشخصي</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setSubScreen('notifications')} className="w-10 h-10 bg-white/10 backdrop-blur-sm rounded-xl flex items-center justify-center relative">
              <Bell className="w-[18px] h-[18px] text-teal-300/70" />
              {totalUnread > 0 && <div className="absolute -top-1 -left-1 w-4 h-4 bg-rose-500 rounded-full flex items-center justify-center"><span className="text-[8px] text-white font-bold">{totalUnread > 9 ? '9+' : totalUnread}</span></div>}
            </button>
            <button onClick={() => setSubScreen('settings')} className="w-10 h-10 bg-white/10 backdrop-blur-sm rounded-xl flex items-center justify-center">
              <Settings className="w-[18px] h-[18px] text-teal-300/70" />
            </button>
          </div>
        </div>
      </div>

      {/* Profile Card */}
      <div className="px-4 -mt-10 relative z-10">
        <div className="bg-[var(--color-surface)] rounded-2xl p-4 shadow-sm border border-[var(--color-border)]">
          <div className="flex items-start gap-3.5">
            <UserAvatar
              src={user?.avatar_url}
              name={user?.full_name || user?.email || 'م'}
              size="lg"
              className="gradient-primary overflow-hidden shadow-lg shadow-emerald-500/20 rounded-2xl flex-shrink-0"
            />
            <div className="flex-1 min-w-0">
              <h2 className="text-[16px] font-black text-[var(--color-text)] truncate">{user?.full_name || 'مستخدم سوق شامل'}</h2>
              <p className="text-[12px] text-[var(--color-text-secondary)] mt-0.5 truncate">{user?.email}</p>
              <div className="flex items-center gap-2 mt-1.5">
                {isAdmin && <span className="inline-flex items-center gap-1 bg-gradient-to-r from-amber-400 to-amber-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full"><Shield className="w-3 h-3" />مدير</span>}
                {(user?.governorate || user?.city) && <span className="inline-flex items-center gap-1 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-[9px] font-bold px-2 py-0.5 rounded-full"><MapPin className="w-3 h-3" />{[user?.governorate, user?.city].filter(Boolean).join(' - ')}</span>}
              </div>
            </div>
            <button
              onClick={() => { setEditName(user?.full_name || ''); setEditAvatar(user?.avatar_url || null); const g = user?.governorate || ''; const c = user?.city || ''; setEditGovernorate(g); setEditCity(c); setShowCustomCity(g !== '' && c !== '' && !getCitiesForGovernorate(g).includes(c)); setShowEdit(true); }}
              className="w-8 h-8 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl flex items-center justify-center text-emerald-500 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/30"
            >
              <Edit3 className="w-4 h-4" />
            </button>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2 mt-4">
            <button onClick={() => setSubScreen('wallet')} className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 rounded-xl text-emerald-600 dark:text-emerald-400">
              <Wallet className="w-4 h-4" />
              <span className="text-[12px] font-bold">{wallet ? `${wallet.balance.toLocaleString('ar-SY')} نقطة` : '0 نقطة'}</span>
            </button>
            <button onClick={() => setSubScreen('notifications')} className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl text-blue-600 dark:text-blue-400 relative">
              <Bell className="w-4 h-4" />
              <span className="text-[12px] font-bold">{totalUnread > 0 ? `${totalUnread} إشعار` : 'الإشعارات'}</span>
              {totalUnread > 0 && <div className="w-2 h-2 bg-rose-500 rounded-full" />}
            </button>
            <button onClick={() => setSubScreen('user-messages')} className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-teal-50 to-cyan-50 dark:from-teal-900/20 dark:to-cyan-900/20 rounded-xl text-teal-600 dark:text-teal-400 relative">
              <MessageCircle className="w-4 h-4" />
              <span className="text-[12px] font-bold">{chatUnreadCount > 0 ? `${chatUnreadCount} رسالة` : 'الرسائل'}</span>
              {chatUnreadCount > 0 && <div className="w-2 h-2 bg-rose-500 rounded-full" />}
            </button>
          </div>
        </div>

        {/* Activity Stats */}
        <div className="flex gap-2.5 mt-3">
          <StatCard icon={<Package className="w-4 h-4 text-emerald-500" />} label="المنتجات" value={productCount} color="bg-emerald-50 dark:bg-emerald-900/20" />
          <StatCard icon={<Store className="w-4 h-4 text-amber-500" />} label="المتاجر" value={storeCount} color="bg-amber-50 dark:bg-amber-900/20" />
          <StatCard icon={<MessageCircle className="w-4 h-4 text-teal-500" />} label="الرسائل" value={messageCount} color="bg-teal-50 dark:bg-teal-900/20" />
          <StatCard icon={<Heart className="w-4 h-4 text-rose-500" />} label="المفضلة" value={0} color="bg-rose-50 dark:bg-rose-900/20" />
        </div>

        {/* Menu Sections */}
        <div className="space-y-3 mt-3">

          {/* Expiry Notifications Banner */}
          {expiryUnreadCount > 0 && user && (() => {
            return (
              <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 rounded-2xl p-4 border border-amber-200/60 dark:border-amber-800/30 shadow-sm">
                <div className="flex items-center justify-between mb-2.5">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-amber-100 dark:bg-amber-900/30 rounded-xl flex items-center justify-center">
                      <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    </div>
                    <p className="text-[13px] font-bold text-amber-900 dark:text-amber-300">تنبيهات الانتهاء</p>
                  </div>
                  <span className="bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200 text-[10px] font-bold px-2 py-0.5 rounded-full">{expiryUnreadCount}</span>
                </div>
                <div className="space-y-2">
                  {expiryNotifs.map(notif => (
                    <div key={notif.id} className="flex items-start gap-2 bg-white/60 dark:bg-amber-900/10 rounded-xl p-2.5">
                      <div className="w-1.5 h-1.5 bg-amber-400 rounded-full mt-1.5 flex-shrink-0" />
                      <p className="text-[11px] text-amber-800 dark:text-amber-200 leading-relaxed flex-1">{notif.body}</p>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => markAllNotifAsRead(user.id)}
                  className="mt-2.5 text-[11px] font-bold text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300 transition-colors"
                >
                  قراءة الكل
                </button>
              </div>
            );
          })()}

          {/* Account Section */}
          <div className="bg-[var(--color-surface)] rounded-2xl px-3.5 py-1 shadow-sm border border-[var(--color-border)]">
            <p className="text-[10px] font-bold text-emerald-300 dark:text-emerald-700 pt-3 pb-0.5 px-1 tracking-wide">الحساب</p>
            <MenuItem icon={<Edit3 className="w-4 h-4" />} label="تعديل الملف الشخصي" sublabel="الاسم والصورة والموقع" onClick={() => { setEditName(user?.full_name || ''); setEditAvatar(user?.avatar_url || null); const g = user?.governorate || ''; const c = user?.city || ''; setEditGovernorate(g); setEditCity(c); setShowCustomCity(g !== '' && c !== '' && !getCitiesForGovernorate(g).includes(c)); setShowEdit(true); }} color="text-emerald-500" />
            <div className="border-t border-[var(--color-border)] mx-4" />
            <MenuItem icon={<Store className="w-4 h-4" />} label={myStore ? 'إدارة متجري' : 'إنشاء متجر'} sublabel={myStore ? myStore.name : 'ابدأ البيع الآن'} onClick={() => setActiveTab(1)} color="text-emerald-500" />
            <div className="border-t border-[var(--color-border)] mx-4" />
            <MenuItem icon={<Crown className="w-4 h-4" />} label="نظام التوثيق" sublabel={myStore && isStoreVerified ? 'متجر موثق ✨' : 'ترقية إلى متجر موثق'} onClick={() => setSubScreen('verification')} color={myStore && isStoreVerified ? 'text-amber-500' : 'text-slate-500 dark:text-slate-400'} rightBadge={myStore && isStoreVerified ? <ShieldCheck className="w-4 h-4 text-amber-500" /> : undefined} />
            <div className="border-t border-[var(--color-border)] mx-4" />
            <MenuItem icon={<MessageCircle className="w-4 h-4" />} label="رسائلي" sublabel={chatUnreadCount > 0 ? `${chatUnreadCount} رسالة غير مقروءة` : 'محادثاتي مع المتاجر'} onClick={() => setSubScreen('user-messages')} color="text-teal-600 dark:text-teal-400" rightBadge={chatUnreadCount > 0 ? <span className="bg-rose-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">{chatUnreadCount > 99 ? '99+' : chatUnreadCount}</span> : undefined} />
            <div className="border-t border-[var(--color-border)] mx-4" />
            <MenuItem icon={<Heart className="w-4 h-4" />} label="المفضلة" sublabel="المنتجات المحفوظة" onClick={() => setActiveTab(3)} color="text-rose-500" />
            <div className="border-t border-[var(--color-border)] mx-4" />
            <MenuItem icon={<Share2 className="w-4 h-4" />} label="شارك واربح" sublabel="انشر محتواك واجذب زبائن جدد" onClick={() => setSubScreen('share-earn')} color="text-emerald-500" />
          </div>

          {/* Wallet Section */}
          <div className="bg-[var(--color-surface)] rounded-2xl px-3.5 py-1 shadow-sm border border-[var(--color-border)]">
            <p className="text-[10px] font-bold text-emerald-300 dark:text-emerald-700 pt-3 pb-0.5 px-1 tracking-wide">المحفظة والعمليات</p>
            <MenuItem icon={<Wallet className="w-4 h-4" />} label="محفظتي" sublabel={wallet ? `${wallet.balance.toLocaleString('ar-SY')} نقطة` : '0 نقطة'} onClick={() => setSubScreen('wallet')} color="text-emerald-500" rightBadge={<Coins className="w-4 h-4 text-amber-500" />} />
            <div className="border-t border-[var(--color-border)] mx-4" />
            <MenuItem icon={<Coins className="w-4 h-4" />} label="شراء النقاط" sublabel="عبر شام كاش" onClick={() => setSubScreen('purchase-points')} color="text-amber-500" />
            <div className="border-t border-[var(--color-border)] mx-4" />
            <MenuItem icon={<History className="w-4 h-4" />} label="سجل العمليات" sublabel="جميع تحويلاتك" onClick={() => setSubScreen('transactions')} color="text-blue-500 dark:text-blue-400" />
          </div>

          {/* Content Section */}
          <div className="bg-[var(--color-surface)] rounded-2xl px-3.5 py-1 shadow-sm border border-[var(--color-border)]">
            <p className="text-[10px] font-bold text-emerald-300 dark:text-emerald-700 pt-3 pb-0.5 px-1 tracking-wide">المحتوى</p>
            <MenuItem
              icon={<Clock className="w-4 h-4" />}
              label="المحتوى المنتهي"
              sublabel={expiredCount > 0 ? `${expiredCount} عنصر منتهي - أعد النشر` : 'لا يوجد محتوى منتهي'}
              onClick={() => setSubScreen('expired-content')}
              color={expiredCount > 0 ? 'text-amber-500' : 'text-slate-500 dark:text-slate-400'}
              rightBadge={expiredCount > 0 ? <span className="bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">{expiredCount}</span> : undefined}
            />
          </div>

          {/* Support Section */}
          <div className="bg-[var(--color-surface)] rounded-2xl px-3.5 py-1 shadow-sm border border-[var(--color-border)]">
            <p className="text-[10px] font-bold text-emerald-300 dark:text-emerald-700 pt-3 pb-0.5 px-1 tracking-wide">الدعم</p>
            <MenuItem icon={<HelpCircle className="w-4 h-4" />} label="المساعدة" sublabel="مركز المساعدة الذكي" onClick={() => setSubScreen('help')} color="text-slate-500 dark:text-slate-400" />
            <div className="border-t border-[var(--color-border)] mx-4" />
            <MenuItem icon={<Phone className="w-4 h-4" />} label="تواصل معنا" sublabel="فريق الدعم" onClick={() => setSubScreen('contact-support')} color="text-slate-500 dark:text-slate-400" />
            <div className="border-t border-[var(--color-border)] mx-4" />
            <MenuItem icon={<AlertTriangle className="w-4 h-4" />} label="الإبلاغ عن مشكلة" sublabel="أخبرنا بأي مشكلة تواجهها" onClick={() => { if (user) { setReportTarget({ type: 'user', id: user.id, name: user.full_name || user.email }); } }} color="text-slate-500 dark:text-slate-400" />
            <div className="border-t border-[var(--color-border)] mx-4" />
            <MenuItem icon={<FileText className="w-4 h-4" />} label="سياسة الاستخدام" sublabel="شروط وقواعد الاستخدام" onClick={() => setSubScreen('policy')} color="text-slate-500 dark:text-slate-400" />
          </div>

          {/* Settings Section */}
          <div className="bg-[var(--color-surface)] rounded-2xl px-3.5 py-1 shadow-sm border border-[var(--color-border)]">
            <p className="text-[10px] font-bold text-emerald-300 dark:text-emerald-700 pt-3 pb-0.5 px-1 tracking-wide">الإعدادات</p>
            <MenuItem icon={<Bell className="w-4 h-4" />} label="الإشعارات" sublabel={totalUnread > 0 ? `${totalUnread} إشعار جديد` : 'إدارة الإشعارات'} onClick={() => setSubScreen('notifications')} color="text-slate-500 dark:text-slate-400" rightBadge={totalUnread > 0 ? <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">{totalUnread}</span> : undefined} />
            <div className="border-t border-[var(--color-border)] mx-4" />
            <MenuItem icon={<Settings className="w-4 h-4" />} label="الإعدادات" sublabel="المظهر، الخصوصية، اللغة" onClick={() => setSubScreen('settings')} color="text-slate-500 dark:text-slate-400" />
            <div className="border-t border-[var(--color-border)] mx-4" />
            <MenuItem icon={<Globe className="w-4 h-4" />} label="اللغة" sublabel="العربية" onClick={() => toast.success('العربية هي اللغة الافتراضية')} color="text-slate-500 dark:text-slate-400" />
          </div>

          {/* Admin Section */}
          {isAdmin && (
            <div className="bg-[var(--color-surface)] rounded-2xl px-3.5 py-1 shadow-sm border border-amber-200/60 dark:border-amber-800/30">
              <p className="text-[10px] font-bold text-amber-500 dark:text-amber-400 pt-3 pb-0.5 px-1 tracking-wide">الإدارة</p>
              <MenuItem icon={<LayoutDashboard className="w-4 h-4" />} label="لوحة تحكم المدير" sublabel="إدارة كاملة" onClick={() => setSubScreen('admin-dashboard')} color="text-purple-500 dark:text-purple-400" />
            </div>
          )}

          {/* Logout */}
          <Button variant="danger" fullWidth size="lg" loading={signingOut} onClick={handleSignOut} icon={<LogOut className="w-5 h-5" />}>
            تسجيل الخروج
          </Button>

          {/* Footer */}
          <div className="text-center pt-1 pb-4">
            <p className="text-[11px] gradient-text-primary font-semibold">سوق شامل الإلكتروني</p>
            <p className="text-[10px] text-[var(--color-text-tertiary)] mt-0.5">الإصدار ١.٠.٠</p>
          </div>
        </div>
      </div>

      {/* Edit Profile Modal */}
      <Modal isOpen={showEdit} onClose={() => setShowEdit(false)} title="تعديل الملف الشخصي">
        <div className="space-y-4">
          <Input label="الاسم الكامل" value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="أدخل اسمك الكامل" icon={<User className="w-4 h-4" />} />
          <ImageUploader label="الصورة الشخصية" value={editAvatar} onChange={setEditAvatar} height="h-28" />
          <div className="bg-emerald-50/40 dark:bg-emerald-900/20 rounded-xl p-3.5 border border-emerald-100/40 dark:border-emerald-800/30">
            <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300">
              <Mail className="w-4 h-4" />
              <p className="text-[13px] font-semibold">{user?.email}</p>
            </div>
            <p className="text-[11px] text-[var(--color-text-tertiary)] mt-1 mr-6">لا يمكن تغيير البريد الإلكتروني</p>
          </div>

          {/* 📍 Location Section */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-emerald-500" />
              <p className="text-[13px] font-bold text-emerald-900 dark:text-emerald-300">📍 الموقع</p>
            </div>

            {/* Governorate Select */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-bold text-emerald-900 dark:text-emerald-300 pr-1">المحافظة</label>
              <div className="relative">
                <select
                  value={editGovernorate}
                  onChange={(e) => { setEditGovernorate(e.target.value); setEditCity(''); setShowCustomCity(false); }}
                  className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl py-3 pr-3.5 pl-9 text-[14px] text-[var(--color-text)] font-medium outline-none focus:ring-2 focus:ring-emerald-500/15 focus:border-emerald-400 dark:focus:border-emerald-600 hover:border-emerald-300 dark:hover:border-emerald-700 appearance-none cursor-pointer"
                >
                  <option value="" disabled>اختر المحافظة</option>
                  {getGovernorateNames().map(name => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
                <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-emerald-400">
                  <ChevronDown className="w-4 h-4" />
                </div>
              </div>
            </div>

            {/* City Select */}
            {editGovernorate && (
              <div className="flex flex-col gap-1.5">
                <label className="text-[13px] font-bold text-emerald-900 dark:text-emerald-300 pr-1">المدينة</label>
                <div className="relative">
                  <select
                    value={showCustomCity ? '__custom__' : editCity}
                    onChange={(e) => {
                      if (e.target.value === '__custom__') {
                        setShowCustomCity(true);
                        setEditCity('');
                      } else {
                        setShowCustomCity(false);
                        setEditCity(e.target.value);
                      }
                    }}
                    className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl py-3 pr-3.5 pl-9 text-[14px] text-[var(--color-text)] font-medium outline-none focus:ring-2 focus:ring-emerald-500/15 focus:border-emerald-400 dark:focus:border-emerald-600 hover:border-emerald-300 dark:hover:border-emerald-700 appearance-none cursor-pointer"
                  >
                    <option value="" disabled>اختر المدينة</option>
                    {availableCities.map(city => (
                      <option key={city} value={city}>{city}</option>
                    ))}
                    <option value="__custom__">أخرى (إدخال يدوي)</option>
                  </select>
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-emerald-400">
                    <ChevronDown className="w-4 h-4" />
                  </div>
                </div>
              </div>
            )}

            {/* Custom City Text Input */}
            {showCustomCity && (
              <Input
                label="اسم المدينة"
                value={editCity}
                onChange={(e) => setEditCity(e.target.value)}
                placeholder="أدخل اسم المدينة"
                icon={<MapPin className="w-4 h-4" />}
              />
            )}
          </div>

          <Button fullWidth onClick={handleSaveProfile} loading={savingProfile} disabled={!editName.trim()}>حفظ التغييرات</Button>
        </div>
      </Modal>

      {/* Report Modal */}
      <ReportModal
        isOpen={!!reportTarget}
        onClose={() => setReportTarget(null)}
        targetType={reportTarget?.type || 'user'}
        targetId={reportTarget?.id || ''}
        targetName={reportTarget?.name || ''}
      />
    </div>
  );
};
