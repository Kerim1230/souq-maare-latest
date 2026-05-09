'use client';
import React, { useState, useEffect, useMemo } from 'react';
import {
  ArrowRight, Shield, Home, Flag, Users, Store, Package,
  Tag, Coins, Settings, Activity, Eye, Trash2, Star, StarOff,
  Ban, ShieldOff, Clock, CheckCircle, XCircle, AlertTriangle, User,
  Mail, Send, ShieldCheck, ShieldX, Lock, Bell, BellRing,
  Plus, Minus,
  Trophy, Save, CreditCard,
  FileWarning, Info, Calendar, Megaphone,
  Award, Gift, Building2, ShoppingBag, Hash,
  Pencil, Key, Wrench, UserCog, Bot, MessageSquare
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useAppStore } from '@/store/appStore';
import { useAdminDashboardStore, type AdminDashboardState, type AdminUser as AdminUserType, type AdminStore as AdminStoreType, type AdminProduct as AdminProductType, type AdminOffer as AdminOfferType, type AdminReport as AdminReportType } from '@/store/adminDashboardStore';
import { Button } from '@/components/market/Button';
import { Modal } from '@/components/market/Modal';
import { ImageUploader } from '@/components/market/ImageUploader';
import { StatusBadge, EmptyState, StatCard, SectionHeader, SearchBar, FilterTabs, ConfirmDialog, DataCard, LoadingSpinner, ActionBtn, InfoRow } from '@/components/admin/AdminShared';
import { timeAgo, formatDateAdmin } from '@/lib/date-utils';
import toast from 'react-hot-toast';
import { apiPost, apiPut, apiGet, apiDelete } from '@/lib/fetchApi';
import { MonitoringDashboard } from '@/components/admin/MonitoringDashboard';
import { SystemMonitor } from '@/screens/admin/SystemMonitor';
import { SystemKeys } from '@/screens/admin/SystemKeys';
import { UserManager } from '@/screens/admin/UserManager';
import { MaintenancePanel } from '@/screens/admin/MaintenancePanel';
import { AiHelpSettings } from '@/screens/admin/AiHelpSettings';

// ===== Constants =====
type TabKey = 'home' | 'reports' | 'users' | 'stores' | 'products' | 'offers' | 'points' | 'verification' | 'notifications' | 'activity' | 'systemMonitor' | 'systemKeys' | 'userManager' | 'maintenance' | 'monitoring' | 'aiHelp' | 'support' | 'settings';

const TAB_CONFIG: { key: TabKey; label: string; icon: React.ReactNode; badge?: () => number }[] = [
  { key: 'home', label: 'الرئيسية', icon: <Home className="w-[18px] h-[18px]" /> },
  { key: 'reports', label: 'البلاغات', icon: <Flag className="w-[18px] h-[18px]" /> },
  { key: 'users', label: 'المستخدمين', icon: <Users className="w-[18px] h-[18px]" /> },
  { key: 'stores', label: 'المتاجر', icon: <Store className="w-[18px] h-[18px]" /> },
  { key: 'products', label: 'المنتجات', icon: <Package className="w-[18px] h-[18px]" /> },
  { key: 'offers', label: 'العروض', icon: <Tag className="w-[18px] h-[18px]" /> },
  { key: 'points', label: 'النقاط', icon: <Coins className="w-[18px] h-[18px]" /> },
  { key: 'verification', label: 'التوثيق', icon: <ShieldCheck className="w-[18px] h-[18px]" /> },
  { key: 'notifications', label: 'الإشعارات', icon: <BellRing className="w-[18px] h-[18px]" /> },
  { key: 'activity', label: 'السجل', icon: <Clock className="w-[18px] h-[18px]" /> },
  { key: 'systemMonitor', label: 'مراقبة النظام', icon: <Activity className="w-[18px] h-[18px]" /> },
  { key: 'systemKeys', label: 'المفاتيح', icon: <Key className="w-[18px] h-[18px]" /> },
  { key: 'userManager', label: 'إدارة المستخدمين', icon: <UserCog className="w-[18px] h-[18px]" /> },
  { key: 'maintenance', label: 'الصيانة', icon: <Wrench className="w-[18px] h-[18px]" /> },
  { key: 'monitoring', label: 'المراقبة', icon: <Eye className="w-[18px] h-[18px]" /> },
  { key: 'aiHelp', label: 'المساعد الذكي 🤖', icon: <Bot className="w-[18px] h-[18px]" /> },
  { key: 'support', label: 'الدعم 📩', icon: <Mail className="w-[18px] h-[18px]" /> },
  { key: 'settings', label: 'الإعدادات', icon: <Settings className="w-[18px] h-[18px]" /> },
];

// ===== Main Component =====
export const AdminDashboard: React.FC = () => {
  const user = useAuthStore(s => s.user);
  const setSubScreen = useAppStore(s => s.setSubScreen);
  // Granular selectors — each only triggers re-render when its specific field changes
  const users = useAdminDashboardStore(s => s.users);
  const stores = useAdminDashboardStore(s => s.stores);
  const products = useAdminDashboardStore(s => s.products);
  const offers = useAdminDashboardStore(s => s.offers);
  const reports = useAdminDashboardStore(s => s.reports);
  const pointOrders = useAdminDashboardStore(s => s.pointOrders);
  const verifications = useAdminDashboardStore(s => s.verifications);
  const activityLog = useAdminDashboardStore(s => s.activityLog);
  const sentNotifications = useAdminDashboardStore(s => s.sentNotifications);
  const settings = useAdminDashboardStore(s => s.settings);
  const loading = useAdminDashboardStore(s => s.loading);
  const initialized = useAdminDashboardStore(s => s.initialized);

  // Stable store methods — extracted once via getState(), never cause re-renders
  // Zustand actions are stable and use get() internally to access latest state
  const storeMethods = useMemo(() => ({
    fetchData: useAdminDashboardStore.getState().fetchData,
    deleteUser: useAdminDashboardStore.getState().deleteUser,
    banUser: useAdminDashboardStore.getState().banUser,
    unbanUser: useAdminDashboardStore.getState().unbanUser,
    addUserPoints: useAdminDashboardStore.getState().addUserPoints,
    deleteStore: useAdminDashboardStore.getState().deleteStore,
    toggleStoreFeatured: useAdminDashboardStore.getState().toggleStoreFeatured,
    toggleStoreVerified: useAdminDashboardStore.getState().toggleStoreVerified,
    deleteProduct: useAdminDashboardStore.getState().deleteProduct,
    toggleProductFeatured: useAdminDashboardStore.getState().toggleProductFeatured,
    deleteOffer: useAdminDashboardStore.getState().deleteOffer,
    updateReportStatus: useAdminDashboardStore.getState().updateReportStatus,
    approvePointOrder: useAdminDashboardStore.getState().approvePointOrder,
    rejectPointOrder: useAdminDashboardStore.getState().rejectPointOrder,
    logActivity: useAdminDashboardStore.getState().logActivity,
    updateSettings: useAdminDashboardStore.getState().updateSettings,
    extendVerification: useAdminDashboardStore.getState().extendVerification,
    rejectVerification: useAdminDashboardStore.getState().rejectVerification,
    sendNotification: useAdminDashboardStore.getState().sendNotification,
    getStats: useAdminDashboardStore.getState().getStats,
  }), []);

  // Combined store object for tab components (conforms to AdminDashboardState)
  const store = useMemo(() => ({
    ...storeMethods,
    users, stores, products, offers, reports, pointOrders,
    verifications, activityLog, sentNotifications, settings,
    loading, initialized,
  }), [users, stores, products, offers, reports, pointOrders,
    verifications, activityLog, sentNotifications, settings,
    loading, initialized, storeMethods]);

  const [activeTab, setActiveTab] = useState<TabKey>('home');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    // Only fetch admin data if the user actually has admin access
    if (user?.is_admin !== true && user?.role !== 'admin') return;
    let cancelled = false;
    storeMethods.fetchData().then(() => {
      if (cancelled) return;
      // fetchData resolves after debounce + fetch
    });
    return () => { cancelled = true; };
  }, [storeMethods, user?.is_admin, user?.role]);

  const handleTabChange = (tab: TabKey) => {
    setActiveTab(tab);
    setSearchQuery('');
  };

  const hasAccess = user?.is_admin === true || user?.role === 'admin';
  // Memoize stats — 13 filter operations only re-run when underlying data changes
  const stats = useMemo(() => ({
    totalUsers: users.length,
    activeUsers: users.filter(u => u.status === 'active').length,
    bannedUsers: users.filter(u => u.status === 'banned').length,
    totalStores: stores.length,
    verifiedStores: stores.filter(s => s.isVerified).length,
    featuredStores: stores.filter(s => s.isFeatured).length,
    totalProducts: products.length,
    featuredProducts: products.filter(p => p.isFeatured).length,
    totalOffers: offers.filter(o => o.type === 'offer').length,
    activeOffers: offers.filter(o => o.type === 'offer' && o.status === 'active').length,
    totalContests: offers.filter(o => o.type === 'contest').length,
    newReports: reports.filter(r => r.status === 'new').length,
    pendingPointOrders: pointOrders.filter(o => o.status === 'pending').length,
    pendingVerifications: verifications.filter(v => v.status === 'pending').length,
  }), [users, stores, products, offers, reports, pointOrders, verifications]);

  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-[var(--color-bg)] flex flex-col items-center justify-center px-6">
        <div className="w-20 h-20 rounded-3xl bg-rose-50 dark:bg-rose-900/20 flex items-center justify-center mb-5">
          <Lock className="w-10 h-10 text-rose-400" />
        </div>
        <h1 className="text-lg font-black text-[var(--color-text)] mb-2">ليس لديك صلاحية الوصول</h1>
        <p className="text-[13px] text-[var(--color-text-tertiary)] text-center mb-6">هذه الصفحة متاحة للمسؤول فقط</p>
        <Button variant="primary" onClick={() => setSubScreen('none')} icon={<ArrowRight className="w-4 h-4" />}>العودة</Button>
      </div>
    );
  }

  return (
    <div className="pb-8 min-h-screen bg-[var(--color-bg)]">
      {/* Header */}
      <div className="gradient-dark px-5 pt-8 pb-[4.5rem] relative overflow-hidden">
        <div className="absolute top-[-40px] right-[-30px] w-[180px] h-[180px] rounded-full bg-teal-600/15 blur-[60px]" />
        <div className="absolute bottom-[-30px] left-[-20px] w-[120px] h-[120px] rounded-full bg-emerald-600/10 blur-[50px]" />
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => setSubScreen('none')} className="w-10 h-10 bg-[var(--color-surface)]/10 backdrop-blur-sm rounded-xl flex items-center justify-center hover:bg-[var(--color-surface)]/20 transition-colors">
              <ArrowRight className="w-[18px] h-[18px] text-white" />
            </button>
            <button onClick={() => handleTabChange('reports')} className="relative w-10 h-10 bg-[var(--color-surface)]/10 backdrop-blur-sm rounded-xl flex items-center justify-center hover:bg-[var(--color-surface)]/20 transition-colors">
              <Bell className="w-[18px] h-[18px] text-teal-300 dark:text-teal-600/70" />
              {(stats.newReports + stats.pendingPointOrders) > 0 && (
                <span className="absolute -top-1 -left-1 min-w-[18px] h-[18px] bg-rose-500 rounded-full flex items-center justify-center text-[9px] font-black text-white px-1">
                  {stats.newReports + stats.pendingPointOrders}
                </span>
              )}
            </button>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-teal-500/20 backdrop-blur-sm flex items-center justify-center border border-teal-400/20">
              <Shield className="w-5 h-5 text-teal-300" />
            </div>
            <div>
              <h1 className="text-white text-[20px] font-black">لوحة تحكم المدير</h1>
              <p className="text-teal-300 dark:text-teal-600/50 text-[12px] mt-0.5">سوق مارع الإلكتروني</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="px-4 -mt-8 relative z-20 mb-4">
        <div className="bg-[var(--color-surface)] rounded-2xl shadow-sm border border-[var(--color-border)] p-1.5 overflow-x-auto scrollbar-hide">
          <div className="flex gap-1 min-w-max">
            {TAB_CONFIG.map(tab => {
              const isActive = activeTab === tab.key;
              const badge = tab.badge ? tab.badge() : 0;
              return (
                <button key={tab.key} onClick={() => handleTabChange(tab.key)}
                  className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-[12px] font-bold whitespace-nowrap transition-all ${
                    isActive ? 'gradient-primary text-white shadow-md shadow-emerald-500/20' : 'text-[var(--color-text-secondary)] hover:bg-emerald-50/60 dark:bg-emerald-900/20'
                  }`}>
                  {tab.icon}
                  {tab.label}
                  {badge > 0 && <span className={`w-5 h-5 rounded-full text-[10px] font-black flex items-center justify-center ${isActive ? 'bg-[var(--color-surface)]/25 text-white' : 'bg-rose-100 dark:bg-rose-900/30 text-rose-600'}`}>{badge}</span>}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Search */}
      {activeTab !== 'home' && activeTab !== 'settings' && activeTab !== 'systemMonitor' && activeTab !== 'systemKeys' && activeTab !== 'maintenance' && activeTab !== 'monitoring' && activeTab !== 'aiHelp' && activeTab !== 'support' && (
        <div className="px-4 mb-4">
          <SearchBar value={searchQuery} onChange={setSearchQuery} placeholder={`بحث في ${TAB_CONFIG.find(t => t.key === activeTab)?.label}...`} />
        </div>
      )}

      {/* Content */}
      <div className="px-4">
        {activeTab === 'home' && <HomeTab store={store} stats={stats} setActiveTab={setActiveTab} />}
        {activeTab === 'reports' && <ReportsTab store={store} searchQuery={searchQuery} />}
        {activeTab === 'users' && <UsersTab store={store} searchQuery={searchQuery} />}
        {activeTab === 'stores' && <StoresTab store={store} searchQuery={searchQuery} />}
        {activeTab === 'products' && <ProductsTab store={store} searchQuery={searchQuery} />}
        {activeTab === 'offers' && <OffersTab store={store} searchQuery={searchQuery} />}
        {activeTab === 'points' && <PointsTab store={store} searchQuery={searchQuery} />}
        {activeTab === 'verification' && <VerificationTab store={store} searchQuery={searchQuery} />}
        {activeTab === 'notifications' && <NotificationsTab store={store} />}
        {activeTab === 'activity' && <ActivityTab store={store} searchQuery={searchQuery} />}
        {activeTab === 'systemMonitor' && <SystemMonitor />}
        {activeTab === 'systemKeys' && <SystemKeys />}
        {activeTab === 'userManager' && <UserManager store={store} searchQuery={searchQuery} />}
        {activeTab === 'maintenance' && <MaintenancePanel />}
        {activeTab === 'monitoring' && <MonitoringTab />}
        {activeTab === 'aiHelp' && <AiHelpSettings />}
        {activeTab === 'support' && <SupportTab />}
        {activeTab === 'settings' && <SettingsTab store={store} />}
      </div>
    </div>
  );
};

// ===== Helper to get store methods type =====
type StoreType = AdminDashboardState;

// ===== HOME TAB =====
function HomeTab({ store, stats, setActiveTab }: { store: StoreType; stats: ReturnType<StoreType['getStats']>; setActiveTab: (_t: TabKey) => void }) {
  return (
    <div className="space-y-4 pb-4">
      {store.loading && <div className="flex justify-center py-8"><LoadingSpinner /></div>}
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="المستخدمين" count={stats.totalUsers} color="emerald" icon={<Users className="w-4 h-4" />} onClick={() => setActiveTab('users')} />
        <StatCard label="المتاجر" count={stats.totalStores} color="teal" icon={<Building2 className="w-4 h-4" />} onClick={() => setActiveTab('stores')} />
        <StatCard label="المنتجات" count={stats.totalProducts} color="sky" icon={<ShoppingBag className="w-4 h-4" />} onClick={() => setActiveTab('products')} />
        <StatCard label="العروض النشطة" count={stats.activeOffers} color="amber" icon={<Tag className="w-4 h-4" />} onClick={() => setActiveTab('offers')} />
        <StatCard label="المسابقات" count={stats.totalContests} color="violet" icon={<Trophy className="w-4 h-4" />} onClick={() => setActiveTab('offers')} />
        <StatCard label="المنتجات المميزة" count={stats.featuredProducts} color="emerald" icon={<Star className="w-4 h-4" />} onClick={() => setActiveTab('products')} />
        <StatCard label="المتاجر المميزة" count={stats.featuredStores} color="teal" icon={<Award className="w-4 h-4" />} onClick={() => setActiveTab('stores')} />
        <StatCard label="البلاغات الجديدة" count={stats.newReports} color="rose" icon={<Flag className="w-4 h-4" />} onClick={() => setActiveTab('reports')} />
        <StatCard label="طلبات النقاط" count={stats.pendingPointOrders} color="amber" icon={<Coins className="w-4 h-4" />} onClick={() => setActiveTab('points')} />
        <StatCard label="طلبات التوثيق" count={stats.pendingVerifications} color="sky" icon={<ShieldCheck className="w-4 h-4" />} onClick={() => setActiveTab('verification')} />
        <StatCard label="المتاجر الموثقة" count={stats.verifiedStores} color="emerald" icon={<ShieldCheck className="w-4 h-4" />} onClick={() => setActiveTab('verification')} />
        <StatCard label="المحظورين" count={stats.bannedUsers} color="rose" icon={<Ban className="w-4 h-4" />} onClick={() => setActiveTab('users')} />
      </div>

      {/* Quick Actions */}
      <DataCard>
        <SectionHeader title="إجراءات سريعة" />
        <div className="grid grid-cols-4 gap-2">
          {TAB_CONFIG.filter(t => t.key !== 'home').map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className="flex flex-col items-center gap-2 py-3 rounded-xl bg-emerald-50/40 dark:bg-emerald-900/20 hover:bg-emerald-50 dark:bg-emerald-900/20 transition-colors border border-emerald-100/30 active:scale-95">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center text-white shadow-sm shadow-emerald-500/20">
                {tab.icon}
              </div>
              <span className="text-[10px] font-bold text-emerald-900 dark:text-emerald-300 leading-tight text-center">{tab.label}</span>
            </button>
          ))}
        </div>
      </DataCard>

      {/* Recent Activity */}
      <DataCard>
        <SectionHeader title="آخر النشاطات" action={{ label: 'عرض الكل', onClick: () => setActiveTab('activity') }} />
        {store.activityLog.length === 0 ? (
          <div className="text-center py-4"><p className="text-[13px] text-[var(--color-text-tertiary)]">لا توجد نشاطات بعد</p></div>
        ) : (
          <div className="space-y-1">
            {store.activityLog.slice(0, 8).map(entry => (
              <div key={entry.id} className="flex items-start gap-3 py-2 border-b border-[var(--color-border)] last:border-0">
                <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Activity className="w-3.5 h-3.5 text-emerald-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-bold text-[var(--color-text)] truncate">{entry.action}</p>
                  {entry.targetName && <p className="text-[11px] text-[var(--color-text-tertiary)] truncate">{entry.targetName}</p>}
                  <p className="text-[10px] text-[var(--color-text-tertiary)] mt-0.5">{timeAgo(entry.createdAt)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </DataCard>
    </div>
  );
}

// ===== REPORTS TAB =====
function ReportsTab({ store, searchQuery }: { store: StoreType; searchQuery: string }) {
  const [filter, setFilter] = useState<AdminReportType['status'] | 'all'>('all');
  const [selectedReport, setSelectedReport] = useState<AdminReportType | null>(null);

  const filtered = useMemo(() => {
    let data = store.reports;
    if (filter !== 'all') data = data.filter(r => r.status === filter);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      data = data.filter(r => r.targetName.toLowerCase().includes(q) || r.reporterName.toLowerCase().includes(q) || r.reason.toLowerCase().includes(q));
    }
    return data;
  }, [store.reports, filter, searchQuery]);

  const filterTabs = [
    { key: 'all', label: 'الكل', count: store.reports.length },
    { key: 'new', label: 'جديد', count: store.reports.filter(r => r.status === 'new').length },
    { key: 'reviewing', label: 'مراجعة', count: store.reports.filter(r => r.status === 'reviewing').length },
    { key: 'action_taken', label: 'تم الإجراء', count: store.reports.filter(r => r.status === 'action_taken').length },
    { key: 'closed', label: 'مغلق', count: store.reports.filter(r => r.status === 'closed').length },
  ];

  return (
    <div className="space-y-4 pb-4">
      <FilterTabs tabs={filterTabs} activeKey={filter} onChange={(k) => setFilter(k as AdminReportType['status'] | 'all')} />

      {filtered.length === 0 ? (
        <EmptyState icon={<Flag className="w-7 h-7" />} message="لا توجد بلاغات" subMessage="لا توجد بلاغات تطابق البحث أو الفلتر" />
      ) : (
        filtered.map(report => (
          <DataCard key={report.id}>
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-900/20 flex items-center justify-center flex-shrink-0">
                  <FileWarning className="w-5 h-5 text-rose-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-bold text-[var(--color-text)] truncate">{report.targetName}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] font-bold text-[var(--color-text-tertiary)] bg-slate-50 dark:bg-slate-800/50 px-1.5 py-0.5 rounded">{report.targetType === 'contest' ? 'مسابقة' : report.targetType === 'product' ? 'منتج' : report.targetType === 'store' ? 'متجر' : 'عرض'}</span>
                    <span className="text-[10px] text-[var(--color-text-tertiary)]">{report.reason}</span>
                  </div>
                </div>
              </div>
              <StatusBadge status={report.status} />
            </div>

            <div className="bg-slate-50/60 rounded-xl p-3 mb-3">
              <p className="text-[12px] text-[var(--color-text-secondary)] leading-relaxed">{report.description}</p>
            </div>

            <div className="flex items-center gap-2 text-[11px] text-[var(--color-text-tertiary)] mb-3">
              <User className="w-3 h-3" />
              <span>المرسل: {report.reporterName}</span>
              <span className="text-slate-200">|</span>
              <Clock className="w-3 h-3" />
              <span>{timeAgo(report.createdAt)}</span>
            </div>

            {report.adminNote && (
              <div className="bg-emerald-50/50 rounded-lg p-2.5 mb-3 border border-emerald-100/40 dark:border-emerald-800/30">
                <p className="text-[11px] text-emerald-700 font-bold">ملاحظة المدير:</p>
                <p className="text-[11px] text-emerald-600 mt-0.5">{report.adminNote}</p>
              </div>
            )}

            <div className="flex flex-wrap gap-2 pt-2 border-t border-[var(--color-border)]">
              {report.status === 'new' && (
                <>
                  <ActionBtn icon={<Eye className="w-3.5 h-3.5" />} label="مراجعة" onClick={() => store.updateReportStatus(report.id, 'reviewing')} variant="warning" />
                  <ActionBtn icon={<Trash2 className="w-3.5 h-3.5" />} label="حذف العنصر" onClick={async () => { if (confirm('هل أنت متأكد؟')) { try { const r = store.reports.find(x => x.id === report.id); if (r) { if (r.targetType === 'product') await store.deleteProduct(r.targetId); else if (r.targetType === 'store') await store.deleteStore(r.targetId); else await store.deleteOffer(r.targetId); } toast.success('تم الحذف'); } catch { toast.error('فشل الحذف'); } } }} variant="danger" />
                  <ActionBtn icon={<Ban className="w-3.5 h-3.5" />} label="حظر المرسل" onClick={() => {
                    // Find the content owner (the offender), NOT the reporter
                    let offenderId: string | null = null;
                    if (report.targetType === 'store') {
                      offenderId = store.stores.find(s => s.id === report.targetId)?.userId ?? null;
                    } else if (report.targetType === 'product') {
                      offenderId = store.products.find(p => p.id === report.targetId)?.userId ?? null;
                    } else {
                      offenderId = store.offers.find(o => o.id === report.targetId)?.userId ?? null;
                    }
                    if (offenderId) {
                      store.banUser(offenderId, '7 أيام', `بلاغ: ${report.reason}`);
                      toast.success('تم حظر صاحب المحتوى المخالف');
                    } else {
                      toast.error('لم يتم العثور على صاحب المحتوى');
                    }
                  }} variant="danger" />
                </>
              )}
              {report.status === 'reviewing' && (
                <>
                  <ActionBtn icon={<CheckCircle className="w-3.5 h-3.5" />} label="اتخاذ إجراء" onClick={() => store.updateReportStatus(report.id, 'action_taken', 'تم اتخاذ إجراء')} variant="success" />
                  <ActionBtn icon={<Trash2 className="w-3.5 h-3.5" />} label="حذف العنصر" onClick={async () => { if (confirm('هل أنت متأكد؟')) { try { const r = store.reports.find(x => x.id === report.id); if (r) { if (r.targetType === 'product') await store.deleteProduct(r.targetId); else if (r.targetType === 'store') await store.deleteStore(r.targetId); else await store.deleteOffer(r.targetId); } toast.success('تم الحذف'); } catch { toast.error('فشل الحذف'); } } }} variant="danger" />
                  <ActionBtn icon={<Ban className="w-3.5 h-3.5" />} label="حظر المرسل" onClick={() => {
                    // Find the content owner (the offender), NOT the reporter
                    let offenderId: string | null = null;
                    if (report.targetType === 'store') {
                      offenderId = store.stores.find(s => s.id === report.targetId)?.userId ?? null;
                    } else if (report.targetType === 'product') {
                      offenderId = store.products.find(p => p.id === report.targetId)?.userId ?? null;
                    } else {
                      offenderId = store.offers.find(o => o.id === report.targetId)?.userId ?? null;
                    }
                    if (offenderId) {
                      store.banUser(offenderId, '7 أيام', `بلاغ: ${report.reason}`);
                      toast.success('تم حظر صاحب المحتوى المخالف');
                    } else {
                      toast.error('لم يتم العثور على صاحب المحتوى');
                    }
                  }} variant="danger" />
                  <ActionBtn icon={<XCircle className="w-3.5 h-3.5" />} label="تجاهل" onClick={() => store.updateReportStatus(report.id, 'closed', 'تم التجاهل')} />
                </>
              )}
              {report.status !== 'closed' && (
                <ActionBtn icon={<XCircle className="w-3.5 h-3.5" />} label="إغلاق" onClick={() => store.updateReportStatus(report.id, 'closed', 'تم الإغلاق')} />
              )}
              <ActionBtn icon={<Eye className="w-3.5 h-3.5" />} label="التفاصيل" onClick={() => setSelectedReport(report)} />
            </div>
          </DataCard>
        ))
      )}

      {/* Report Detail Modal */}
      <Modal isOpen={!!selectedReport} onClose={() => setSelectedReport(null)} title="تفاصيل البلاغ" size="lg">
        {selectedReport && (
          <div className="space-y-3">
            <InfoRow label="نوع البلاغ" value={selectedReport.targetType === 'contest' ? 'مسابقة' : selectedReport.targetType === 'product' ? 'منتج' : selectedReport.targetType === 'store' ? 'متجر' : 'عرض'} icon={<Tag className="w-3.5 h-3.5" />} />
            <InfoRow label="العنصر" value={selectedReport.targetName} icon={<Package className="w-3.5 h-3.5" />} />
            <InfoRow label="السبب" value={selectedReport.reason} icon={<AlertTriangle className="w-3.5 h-3.5" />} />
            <InfoRow label="المرسل" value={selectedReport.reporterName} icon={<User className="w-3.5 h-3.5" />} />
            <InfoRow label="البريد" value={selectedReport.reporterEmail} icon={<Mail className="w-3.5 h-3.5" />} />
            <InfoRow label="الحالة" value={selectedReport.status} icon={<Info className="w-3.5 h-3.5" />} />
            <InfoRow label="التاريخ" value={formatDateAdmin(selectedReport.createdAt)} icon={<Calendar className="w-3.5 h-3.5" />} />
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3">
              <p className="text-[11px] text-[var(--color-text-tertiary)] font-bold mb-1">الوصف</p>
              <p className="text-[12px] text-slate-600 leading-relaxed">{selectedReport.description}</p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

// ===== USERS TAB =====
function UsersTab({ store, searchQuery }: { store: StoreType; searchQuery: string }) {
  const [filter, setFilter] = useState<'all' | 'active' | 'banned'>('all');
  const [banModal, setBanModal] = useState<AdminUserType | null>(null);
  const [banDuration, setBanDuration] = useState('7 أيام');
  const [banReason, setBanReason] = useState('');
  const [pointsModal, setPointsModal] = useState<AdminUserType | null>(null);
  const [pointsAmount, setPointsAmount] = useState('');
  const [pointsAction, setPointsAction] = useState<'add' | 'subtract'>('add');
  const [pointsReason, setPointsReason] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<AdminUserType | null>(null);

  const durations = ['1 يوم', '3 أيام', '7 أيام', '30 يوم', 'دائم'];

  const filtered = useMemo(() => {
    let data = store.users;
    if (filter !== 'all') data = data.filter(u => u.status === filter);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      data = data.filter(u => (u.fullName || '').toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
    }
    return data;
  }, [store.users, filter, searchQuery]);

  const filterTabs = [
    { key: 'all', label: 'الكل', count: store.users.length },
    { key: 'active', label: 'نشط', count: store.users.filter(u => u.status === 'active').length },
    { key: 'banned', label: 'محظور', count: store.users.filter(u => u.status === 'banned').length },
  ];

  return (
    <div className="space-y-4 pb-4">
      <FilterTabs tabs={filterTabs} activeKey={filter} onChange={(k) => setFilter(k as 'all' | 'active' | 'banned')} />

      {filtered.length === 0 ? (
        <EmptyState icon={<Users className="w-7 h-7" />} message="لا يوجد مستخدمين" />
      ) : (
        filtered.map(u => (
          <DataCard key={u.id}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-100 to-teal-100 flex items-center justify-center text-emerald-600 font-black text-[16px] flex-shrink-0">
                {(u.fullName || '?').charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-[14px] font-bold text-[var(--color-text)] truncate">{u.fullName}</p>
                  {u.status === 'banned' && <StatusBadge status="banned" />}
                </div>
                <p className="text-[11px] text-[var(--color-text-tertiary)] truncate">{u.email}</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 mb-3">
              <div className="bg-emerald-50/30 rounded-lg p-2 text-center">
                <p className="text-[15px] font-black text-emerald-700">{(u.points ?? 0).toLocaleString('ar-SY')}</p>
                <p className="text-[10px] text-[var(--color-text-tertiary)] font-semibold">النقاط</p>
              </div>
              <div className="bg-teal-50 dark:bg-teal-900/20 rounded-lg p-2 text-center">
                <p className="text-[15px] font-black text-teal-700">{(u._count?.stores ?? 0)}</p>
                <p className="text-[10px] text-[var(--color-text-tertiary)] font-semibold">المتاجر</p>
              </div>
              <div className="bg-slate-50/60 rounded-lg p-2 text-center">
                <p className="text-[15px] font-black text-slate-600">{timeAgo(u.createdAt)}</p>
                <p className="text-[10px] text-[var(--color-text-tertiary)] font-semibold">الانضمام</p>
              </div>
            </div>

            {u.status === 'banned' && u.banReason && (
              <div className="bg-rose-50 dark:bg-rose-900/20 rounded-lg p-2 mb-3 border border-rose-100/40">
                <p className="text-[11px] text-rose-600 dark:text-rose-400"><span className="font-bold">سبب الحظر: </span>{u.banReason} ({u.banDuration})</p>
              </div>
            )}

            <div className="flex flex-wrap gap-2 pt-2 border-t border-[var(--color-border)]">
              {u.status === 'active' ? (
                <>
                  <ActionBtn icon={<Ban className="w-3.5 h-3.5" />} label="حظر" onClick={() => { setBanModal(u); setBanDuration('7 أيام'); setBanReason(''); }} variant="danger" />
                  <ActionBtn icon={<Plus className="w-3.5 h-3.5" />} label="إضافة نقاط" onClick={() => { setPointsModal(u); setPointsAmount(''); setPointsAction('add'); setPointsReason(''); }} variant="success" />
                  <ActionBtn icon={<Minus className="w-3.5 h-3.5" />} label="خصم نقاط" onClick={() => { setPointsModal(u); setPointsAmount(''); setPointsAction('subtract'); setPointsReason(''); }} variant="warning" />
                  <ActionBtn icon={<Trash2 className="w-3.5 h-3.5" />} label="حذف" onClick={() => setConfirmDelete(u)} variant="danger" />
                </>
              ) : (
                <ActionBtn icon={<ShieldOff className="w-3.5 h-3.5" />} label="فك الحظر" onClick={() => { store.unbanUser(u.id); toast.success('تم فك الحظر'); }} variant="success" />
              )}
            </div>
          </DataCard>
        ))
      )}

      {/* Ban Modal */}
      <Modal isOpen={!!banModal} onClose={() => setBanModal(null)} title={`حظر ${banModal?.fullName}`}>
        <div className="space-y-4">
          <div className="bg-rose-50 dark:bg-rose-900/30 rounded-xl p-3 border border-rose-100/40">
            <p className="text-[13px] font-bold text-rose-600 dark:text-rose-400 flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> تحذير</p>
            <p className="text-[12px] text-rose-500 dark:text-rose-400 mt-1">سيتم حظر هذا المستخدم عن استخدام المنصة</p>
          </div>
          <div>
            <label className="text-[13px] font-bold text-emerald-900 dark:text-emerald-300 block mb-2">مدة الحظر</label>
            <div className="flex flex-wrap gap-2">
              {durations.map(d => (
                <button key={d} onClick={() => setBanDuration(d)}
                  className={`px-3 py-2 rounded-lg text-[12px] font-bold transition-all ${banDuration === d ? 'gradient-primary text-white shadow-md' : 'bg-slate-100 dark:bg-slate-800 text-[var(--color-text-secondary)] hover:bg-slate-200'}`}>
                  {d}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-[13px] font-bold text-emerald-900 dark:text-emerald-300 block mb-1.5">سبب الحظر</label>
            <textarea value={banReason} onChange={e => setBanReason(e.target.value)} rows={3} placeholder="اكتب سبب الحظر..."
              className="w-full bg-[var(--color-surface)] border border-emerald-100 dark:border-emerald-800 rounded-xl py-3 px-4 text-[14px] text-[var(--color-text)] placeholder:text-[var(--color-text-tertiary)] outline-none focus:ring-2 focus:ring-emerald-500/15 resize-none" />
          </div>
          <Button variant="danger" fullWidth onClick={() => { if (banModal && banReason.trim()) { store.banUser(banModal.id, banDuration, banReason.trim()); toast.success('تم حظر المستخدم'); setBanModal(null); } else toast.error('يرجى كتابة سبب الحظر'); }} icon={<Ban className="w-4 h-4" />}>
            تأكيد الحظر
          </Button>
        </div>
      </Modal>

      {/* Points Modal */}
      <Modal isOpen={!!pointsModal} onClose={() => setPointsModal(null)} title={`${pointsAction === 'add' ? 'إضافة' : 'خصم'} نقاط - ${pointsModal?.fullName}`}>
        <div className="space-y-4">
          <div>
            <label className="text-[13px] font-bold text-emerald-900 dark:text-emerald-300 block mb-1.5">عدد النقاط</label>
            <input type="number" value={pointsAmount} onChange={e => setPointsAmount(e.target.value)} placeholder="0"
              className="w-full h-11 bg-[var(--color-surface)] border border-emerald-100 dark:border-emerald-800 rounded-xl px-4 text-[14px] text-[var(--color-text)] placeholder:text-[var(--color-text-tertiary)] outline-none focus:ring-2 focus:ring-emerald-500/15" />
          </div>
          <div>
            <label className="text-[13px] font-bold text-emerald-900 dark:text-emerald-300 block mb-1.5">السبب</label>
            <textarea value={pointsReason} onChange={e => setPointsReason(e.target.value)} rows={2} placeholder="سبب إضافة/خصم النقاط..."
              className="w-full bg-[var(--color-surface)] border border-emerald-100 dark:border-emerald-800 rounded-xl py-3 px-4 text-[14px] text-[var(--color-text)] placeholder:text-[var(--color-text-tertiary)] outline-none focus:ring-2 focus:ring-emerald-500/15 resize-none" />
          </div>
          <p className="text-[12px] text-[var(--color-text-tertiary)]">الرصيد الحالي: <span className="font-bold text-emerald-700">{(pointsModal?.points ?? 0).toLocaleString('ar-SY')}</span> نقطة</p>
          <Button variant={pointsAction === 'add' ? 'success' : 'warning'} fullWidth
            onClick={async () => {
              if (pointsModal && pointsAmount && pointsReason.trim()) {
                const pts = parseInt(pointsAmount);
                if (pts > 0) {
                  await store.addUserPoints(pointsModal.id, pointsAction === 'add' ? pts : -pts, pointsReason.trim());
                  toast.success(pointsAction === 'add' ? 'تمت إضافة النقاط' : 'تم خصم النقاط');
                  setPointsModal(null);
                } else toast.error('يرجى إدخال عدد صحيح');
              } else toast.error('يرجى ملء جميع الحقول');
            }}
            icon={pointsAction === 'add' ? <Plus className="w-4 h-4" /> : <Minus className="w-4 h-4" />}>
            {pointsAction === 'add' ? 'إضافة النقاط' : 'خصم النقاط'}
          </Button>
        </div>
      </Modal>

      {/* Delete Confirm */}
      <ConfirmDialog isOpen={!!confirmDelete} onClose={() => setConfirmDelete(null)}
        onConfirm={async () => { if (confirmDelete) { try { await store.deleteUser(confirmDelete.id); toast.success('تم حذف المستخدم'); setConfirmDelete(null); } catch { toast.error('فشل حذف المستخدم'); } } }}
        title="حذف مستخدم" message={`هل أنت متأكد من حذف "${confirmDelete?.fullName}"؟ سيتم حذف جميع متاجهه ومنتجاته.`} variant="danger" />
    </div>
  );
}

// ===== STORES TAB =====
function StoresTab({ store, searchQuery }: { store: StoreType; searchQuery: string }) {
  const [filter, setFilter] = useState<'all' | 'verified' | 'unverified' | 'featured' | 'banned'>('all');
  const [confirmDelete, setConfirmDelete] = useState<AdminStoreType | null>(null);

  const filtered = useMemo(() => {
    let data = store.stores;
    if (filter === 'verified') data = data.filter(s => s.isVerified);
    else if (filter === 'unverified') data = data.filter(s => !s.isVerified);
    else if (filter === 'featured') data = data.filter(s => s.isFeatured);
    else if (filter === 'banned') data = data.filter(s => store.users.find(u => u.id === s.userId)?.status === 'banned');
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      data = data.filter(s => s.name.toLowerCase().includes(q) || (s.category || '').toLowerCase().includes(q) || (s.userName || '').toLowerCase().includes(q));
    }
    return data;
  }, [store.stores, store.users, filter, searchQuery]);

  const filterTabs = [
    { key: 'all', label: 'الكل', count: store.stores.length },
    { key: 'verified', label: 'موثق', count: store.stores.filter(s => s.isVerified).length },
    { key: 'unverified', label: 'غير موثق', count: store.stores.filter(s => !s.isVerified).length },
    { key: 'featured', label: 'مميز', count: store.stores.filter(s => s.isFeatured).length },
    { key: 'banned', label: 'محظور', count: store.stores.filter(s => store.users.find(u => u.id === s.userId)?.status === 'banned').length },
  ];

  return (
    <div className="space-y-4 pb-4">
      <FilterTabs tabs={filterTabs} activeKey={filter} onChange={(k) => setFilter(k as typeof filter)} />

      {filtered.length === 0 ? (
        <EmptyState icon={<Store className="w-7 h-7" />} message="لا توجد متاجر" />
      ) : (
        filtered.map(s => (
          <DataCard key={s.id}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-100 to-teal-100 flex items-center justify-center text-emerald-600 font-black text-[14px] flex-shrink-0">
                {s.name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-[14px] font-bold text-[var(--color-text)] truncate">{s.name}</p>
                  {s.isVerified && <span className="text-emerald-500"><ShieldCheck className="w-3.5 h-3.5" /></span>}
                  {s.isFeatured && <span className="text-amber-500 dark:text-amber-400"><Star className="w-3.5 h-3.5" /></span>}
                  {store.users.find(u => u.id === s.userId)?.status === 'banned' && <StatusBadge status="banned" />}
                </div>
                <p className="text-[11px] text-[var(--color-text-tertiary)]">{s.userName} · {s.category}</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 mb-3">
              <div className="bg-emerald-50/30 rounded-lg p-2 text-center">
                <p className="text-[15px] font-black text-emerald-700">{s.followersCount.toLocaleString('ar-SY')}</p>
                <p className="text-[10px] text-[var(--color-text-tertiary)] font-semibold">متابع</p>
              </div>
              <div className="bg-teal-50 dark:bg-teal-900/20 rounded-lg p-2 text-center">
                <p className="text-[15px] font-black text-teal-700">{s.productsCount}</p>
                <p className="text-[10px] text-[var(--color-text-tertiary)] font-semibold">منتج</p>
              </div>
              <div className="bg-slate-50/60 rounded-lg p-2 text-center">
                <p className="text-[15px] font-black text-slate-600">{timeAgo(s.createdAt)}</p>
                <p className="text-[10px] text-[var(--color-text-tertiary)] font-semibold">التأسيس</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-2 border-t border-[var(--color-border)]">
              {s.isVerified ? (
                <ActionBtn icon={<ShieldX className="w-3.5 h-3.5" />} label="إلغاء التوثيق" onClick={async () => { try { await store.toggleStoreVerified(s.id); toast.success('تم إلغاء التوثيق'); } catch { toast.error('فشل التحديث'); } }} variant="warning" />
              ) : (
                <ActionBtn icon={<ShieldCheck className="w-3.5 h-3.5" />} label="توثيق" onClick={async () => { try { await store.toggleStoreVerified(s.id); toast.success('تم توثيق المتجر'); } catch { toast.error('فشل التحديث'); } }} variant="success" />
              )}
              {s.isFeatured ? (
                <ActionBtn icon={<StarOff className="w-3.5 h-3.5" />} label="إلغاء التمييز" onClick={async () => { try { await store.toggleStoreFeatured(s.id); toast.success('تم إلغاء التمييز'); } catch { toast.error('فشل التحديث'); } }} variant="warning" />
              ) : (
                <ActionBtn icon={<Star className="w-3.5 h-3.5" />} label="تمييز" onClick={async () => { try { await store.toggleStoreFeatured(s.id); toast.success('تم تمييز المتجر'); } catch { toast.error('فشل التحديث'); } }} variant="success" />
              )}
              {store.users.find(u => u.id === s.userId)?.status !== 'banned' && <ActionBtn icon={<Ban className="w-3.5 h-3.5" />} label="حظر الصاحب" onClick={() => { store.banUser(s.userId, '7 أيام', 'حظر صاحب متجر مخالف'); toast.success('تم حظر صاحب المتجر'); }} variant="danger" />}
              <ActionBtn icon={<Trash2 className="w-3.5 h-3.5" />} label="حذف" onClick={() => setConfirmDelete(s)} variant="danger" />
            </div>
          </DataCard>
        ))
      )}

      <ConfirmDialog isOpen={!!confirmDelete} onClose={() => setConfirmDelete(null)}
        onConfirm={async () => { if (confirmDelete) { try { await store.deleteStore(confirmDelete.id); toast.success('تم حذف المتجر'); setConfirmDelete(null); } catch { toast.error('فشل حذف المتجر'); } } }}
        title="حذف متجر" message={`هل أنت متأكد من حذف "${confirmDelete?.name}"؟ سيتم حذف جميع المنتجات والعروض المرتبطة.`} variant="danger" />
    </div>
  );
}

// ===== PRODUCTS TAB =====
function ProductsTab({ store, searchQuery }: { store: StoreType; searchQuery: string }) {
  const [filter, setFilter] = useState<'all' | 'featured' | 'new'>('all');
  const [confirmDelete, setConfirmDelete] = useState<AdminProductType | null>(null);

  const filtered = useMemo(() => {
    let data = store.products;
    if (filter === 'featured') data = data.filter(p => p.isFeatured);
    else if (filter === 'new') data = data.filter(p => p.isNew);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      data = data.filter(p => p.name.toLowerCase().includes(q) || (p.category || '').toLowerCase().includes(q) || (p.storeName || '').toLowerCase().includes(q));
    }
    return data.slice(0, 30);
  }, [store.products, filter, searchQuery]);

  const filterTabs = [
    { key: 'all', label: 'الكل', count: store.products.length },
    { key: 'featured', label: 'مميز', count: store.products.filter(p => p.isFeatured).length },
    { key: 'new', label: 'جديد', count: store.products.filter(p => p.isNew).length },
  ];

  return (
    <div className="space-y-4 pb-4">
      <FilterTabs tabs={filterTabs} activeKey={filter} onChange={(k) => setFilter(k as typeof filter)} />

      {filtered.length === 0 ? (
        <EmptyState icon={<Package className="w-7 h-7" />} message="لا توجد منتجات" />
      ) : (
        filtered.map(p => (
          <DataCard key={p.id}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-50 dark:from-emerald-900/20 to-teal-50 dark:to-teal-900/20 flex items-center justify-center text-emerald-500 flex-shrink-0 overflow-hidden">
                <ShoppingBag className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-[14px] font-bold text-[var(--color-text)] truncate">{p.name}</p>
                  {p.isFeatured && <span className="text-amber-500 dark:text-amber-400"><Star className="w-3.5 h-3.5" /></span>}
                  {p.isNew && <span className="text-[9px] font-bold text-sky-600 bg-sky-50 px-1.5 py-0.5 rounded">جديد</span>}
                </div>
                <p className="text-[11px] text-[var(--color-text-tertiary)]">{p.storeName}</p>
              </div>
              <div className="text-left flex-shrink-0">
                <p className="text-[14px] font-black text-emerald-700">{p.price.toLocaleString('ar-SY')}</p>
                <p className="text-[10px] text-[var(--color-text-tertiary)]">ل.س</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 mb-3">
              <div className="bg-emerald-50/30 rounded-lg p-2 text-center">
                <p className="text-[12px] font-black text-emerald-700">{p.category}</p>
                <p className="text-[10px] text-[var(--color-text-tertiary)] font-semibold">التصنيف</p>
              </div>
              <div className="bg-teal-50 dark:bg-teal-900/20 rounded-lg p-2 text-center">
                <p className="text-[12px] font-black text-teal-700">{p.storeName}</p>
                <p className="text-[10px] text-[var(--color-text-tertiary)] font-semibold">المتجر</p>
              </div>
              <div className="bg-slate-50/60 rounded-lg p-2 text-center">
                <p className="text-[12px] font-black text-slate-600">{timeAgo(p.createdAt)}</p>
                <p className="text-[10px] text-[var(--color-text-tertiary)] font-semibold">التاريخ</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-2 border-t border-[var(--color-border)]">
              {p.isFeatured ? (
                <ActionBtn icon={<StarOff className="w-3.5 h-3.5" />} label="إزالة التمييز" onClick={async () => { try { await store.toggleProductFeatured(p.id); toast.success('تم إزالة التمييز'); } catch { toast.error('فشل التحديث'); } }} variant="warning" />
              ) : (
                <ActionBtn icon={<Star className="w-3.5 h-3.5" />} label="تمييز" onClick={async () => { try { await store.toggleProductFeatured(p.id); toast.success('تم تمييز المنتج'); } catch { toast.error('فشل التحديث'); } }} variant="success" />
              )}
              <ActionBtn icon={<Trash2 className="w-3.5 h-3.5" />} label="حذف" onClick={() => setConfirmDelete(p)} variant="danger" />
            </div>
          </DataCard>
        ))
      )}

      {filtered.length >= 30 && <p className="text-center text-[12px] text-[var(--color-text-tertiary)] pb-2">عرض أول 30 منتج - استخدم البحث لتصفية النتائج</p>}

      <ConfirmDialog isOpen={!!confirmDelete} onClose={() => setConfirmDelete(null)}
        onConfirm={async () => { if (confirmDelete) { try { await store.deleteProduct(confirmDelete.id); toast.success('تم حذف المنتج'); setConfirmDelete(null); } catch { toast.error('فشل حذف المنتج'); } } }}
        title="حذف منتج" message={`هل أنت متأكد من حذف "${confirmDelete?.name}"؟`} variant="danger" />
    </div>
  );
}

// ===== OFFERS TAB =====
function OffersTab({ store, searchQuery }: { store: StoreType; searchQuery: string }) {
  const [filter, setFilter] = useState<'all' | 'offer' | 'contest' | 'active' | 'ended'>('all');
  const [confirmDelete, setConfirmDelete] = useState<AdminOfferType | null>(null);
  const now = new Date();
  const isOfferActive = (o: AdminOfferType) => !o.expiresAt || new Date(o.expiresAt) > now;

  const filtered = useMemo(() => {
    let data = store.offers;
    const _now = new Date();
    const _isActive = (o: AdminOfferType) => !o.expiresAt || new Date(o.expiresAt) > _now;
    if (filter === 'offer') data = data.filter(o => o.type === 'offer');
    else if (filter === 'contest') data = data.filter(o => o.type === 'contest');
    else if (filter === 'active') data = data.filter(o => _isActive(o));
    else if (filter === 'ended') data = data.filter(o => o.expiresAt && new Date(o.expiresAt) <= _now);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      data = data.filter(o => o.title.toLowerCase().includes(q) || (o.storeName || '').toLowerCase().includes(q));
    }
    return data;
  }, [store.offers, filter, searchQuery]);

  const filterTabs = [
    { key: 'all', label: 'الكل', count: store.offers.length },
    { key: 'offer', label: 'عروض', count: store.offers.filter(o => o.type === 'offer').length },
    { key: 'contest', label: 'مسابقات', count: store.offers.filter(o => o.type === 'contest').length },
    { key: 'active', label: 'نشط', count: store.offers.filter(o => isOfferActive(o)).length },
    { key: 'ended', label: 'منتهي', count: store.offers.filter(o => o.expiresAt && new Date(o.expiresAt) <= now).length },
  ];

  return (
    <div className="space-y-4 pb-4">
      <FilterTabs tabs={filterTabs} activeKey={filter} onChange={(k) => setFilter(k as typeof filter)} />

      {filtered.length === 0 ? (
        <EmptyState icon={<Tag className="w-7 h-7" />} message="لا توجد عروض أو مسابقات" />
      ) : (
        filtered.map(o => (
          <DataCard key={o.id}>
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${o.type === 'contest' ? 'bg-violet-50 text-violet-500' : 'bg-amber-50 dark:bg-amber-900/20 text-amber-500 dark:text-amber-400'}`}>
                {o.type === 'contest' ? <Trophy className="w-5 h-5" /> : <Tag className="w-5 h-5" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-[14px] font-bold text-[var(--color-text)] truncate">{o.title}</p>
                  <StatusBadge status={isOfferActive(o) ? 'active' : 'expired'} />
                </div>
                <p className="text-[11px] text-[var(--color-text-tertiary)]">{o.storeName}</p>
              </div>
            </div>

            <p className="text-[12px] text-[var(--color-text-secondary)] mb-3 leading-relaxed">{o.description}</p>

            <div className="grid grid-cols-2 gap-2 mb-3">
              {o.type === 'offer' && o.discount && (
                <div className="bg-rose-50 dark:bg-rose-900/25 rounded-lg p-2 text-center">
                  <p className="text-[16px] font-black text-rose-600 dark:text-rose-400">-{o.discount}%</p>
                  <p className="text-[10px] text-[var(--color-text-tertiary)] font-semibold">الخصم</p>
                </div>
              )}
              {o.type === 'contest' && (
                <div className="bg-violet-50/40 rounded-lg p-2 text-center">
                  <p className="text-[12px] font-black text-violet-700">مسابقة</p>
                  <p className="text-[10px] text-[var(--color-text-tertiary)] font-semibold">النوع</p>
                </div>
              )}
              <div className="bg-slate-50/60 rounded-lg p-2 text-center">
                <p className="text-[12px] font-black text-slate-600">{o.expiresAt ? timeAgo(o.expiresAt) : '-'}</p>
                <p className="text-[10px] text-[var(--color-text-tertiary)] font-semibold">الانتهاء</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-2 border-t border-[var(--color-border)]">
              <ActionBtn icon={<Trash2 className="w-3.5 h-3.5" />} label="حذف" onClick={() => setConfirmDelete(o)} variant="danger" />
            </div>
          </DataCard>
        ))
      )}

      <ConfirmDialog isOpen={!!confirmDelete} onClose={() => setConfirmDelete(null)}
        onConfirm={async () => { if (confirmDelete) { try { await store.deleteOffer(confirmDelete.id); toast.success('تم الحذف'); setConfirmDelete(null); } catch { toast.error('فشل الحذف'); } } }}
        title="حذف عرض/مسابقة" message={`هل أنت متأكد من حذف "${confirmDelete?.title}"؟`} variant="danger" />
    </div>
  );
}

// ===== POINTS TAB =====
function PointsTab({ store, searchQuery }: { store: StoreType; searchQuery: string }) {
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [rejectModal, setRejectModal] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const filtered = useMemo(() => {
    let data = store.pointOrders;
    if (filter !== 'all') data = data.filter(o => o.status === filter);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      data = data.filter(o => (o.userName || '').toLowerCase().includes(q) || o.paymentCode.toLowerCase().includes(q));
    }
    return data;
  }, [store.pointOrders, filter, searchQuery]);

  const filterTabs = [
    { key: 'all', label: 'الكل', count: store.pointOrders.length },
    { key: 'pending', label: 'معلق', count: store.pointOrders.filter(o => o.status === 'pending').length },
    { key: 'approved', label: 'مقبول', count: store.pointOrders.filter(o => o.status === 'approved').length },
    { key: 'rejected', label: 'مرفوض', count: store.pointOrders.filter(o => o.status === 'rejected').length },
  ];

  return (
    <div className="space-y-4 pb-4">
      <FilterTabs tabs={filterTabs} activeKey={filter} onChange={(k) => setFilter(k as typeof filter)} />

      {filtered.length === 0 ? (
        <EmptyState icon={<Coins className="w-7 h-7" />} message="لا توجد طلبات" />
      ) : (
        filtered.map(order => (
          <DataCard key={order.id}>
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="w-10 h-10 rounded-xl bg-emerald-50/60 dark:bg-emerald-900/20 flex items-center justify-center flex-shrink-0">
                  <User className="w-5 h-5 text-emerald-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-bold text-[var(--color-text)] truncate">{order.userName}</p>
                  <p className="text-[11px] text-[var(--color-text-tertiary)] truncate">{order.userEmail}</p>
                </div>
              </div>
              <StatusBadge status={order.status} />
            </div>

            <div className="grid grid-cols-2 gap-2 mb-3">
              <div className="bg-emerald-50/30 rounded-xl p-2.5">
                <p className="text-[10px] text-[var(--color-text-tertiary)] font-semibold flex items-center gap-1"><Coins className="w-3 h-3" />النقاط</p>
                <p className="text-[15px] font-black text-emerald-700 mt-0.5">{order.points.toLocaleString('ar-SY')}</p>
              </div>
              <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-2.5">
                <p className="text-[10px] text-[var(--color-text-tertiary)] font-semibold flex items-center gap-1"><CreditCard className="w-3 h-3" />المبلغ</p>
                <p className="text-[15px] font-black text-amber-700 mt-0.5">{order.amount.toLocaleString('ar-SY')} ل.س</p>
              </div>
            </div>

            <div className="bg-slate-50/60 rounded-xl p-2.5 mb-3">
              <p className="text-[10px] text-[var(--color-text-tertiary)] font-semibold flex items-center gap-1"><Hash className="w-3 h-3" />رمز العملية</p>
              <p className="text-[13px] font-bold text-slate-700 font-mono tracking-wider mt-0.5">{order.paymentCode}</p>
            </div>

            {order.status === 'rejected' && order.rejectionReason && (
              <div className="bg-rose-50 dark:bg-rose-900/20 rounded-lg p-2 mb-3 border border-rose-100/40">
                <p className="text-[11px] text-rose-600 dark:text-rose-400"><span className="font-bold">سبب الرفض: </span>{order.rejectionReason}</p>
              </div>
            )}

            <p className="text-[11px] text-[var(--color-text-tertiary)] flex items-center gap-1 mb-3"><Clock className="w-3 h-3" />{formatDateAdmin(order.createdAt)}</p>

            {order.status === 'pending' && (
              <div className="flex gap-2 pt-2 border-t border-[var(--color-border)]">
                <Button variant="success" fullWidth size="sm" onClick={() => { store.approvePointOrder(order.id); toast.success('تم قبول الطلب ✅'); }}
                  icon={<CheckCircle className="w-4 h-4" />}>قبول</Button>
                <Button variant="danger" fullWidth size="sm" onClick={() => { setRejectModal(order.id); setRejectReason(''); }}
                  icon={<XCircle className="w-4 h-4" />}>رفض</Button>
              </div>
            )}
          </DataCard>
        ))
      )}

      <Modal isOpen={!!rejectModal} onClose={() => setRejectModal(null)} title="رفض طلب شراء النقاط">
        <div className="space-y-4">
          <div className="bg-rose-50 dark:bg-rose-900/30 rounded-xl p-3 border border-rose-100/40">
            <p className="text-[13px] font-bold text-rose-600 dark:text-rose-400 flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> تأكيد الرفض</p>
            <p className="text-[12px] text-rose-500 dark:text-rose-400 mt-1">سيتم إشعار المستخدم بسبب الرفض</p>
          </div>
          <div>
            <label className="text-[13px] font-bold text-emerald-900 dark:text-emerald-300 block mb-1.5">سبب الرفض</label>
            <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} rows={3} placeholder="اكتب سبب رفض الطلب..."
              className="w-full bg-[var(--color-surface)] border border-emerald-100 dark:border-emerald-800 rounded-xl py-3 px-4 text-[14px] text-[var(--color-text)] placeholder:text-[var(--color-text-tertiary)] outline-none focus:ring-2 focus:ring-rose-500/15 resize-none" />
          </div>
          <div className="flex gap-3">
            <Button variant="danger" fullWidth onClick={() => { if (rejectModal && rejectReason.trim()) { store.rejectPointOrder(rejectModal, rejectReason.trim()); toast.success('تم رفض الطلب ❌'); setRejectModal(null); } else toast.error('يرجى كتابة سبب الرفض'); }}
              icon={<XCircle className="w-4 h-4" />}>تأكيد الرفض</Button>
            <Button variant="ghost" fullWidth onClick={() => setRejectModal(null)}>إلغاء</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ===== VERIFICATION TAB =====
function VerificationTab({ store, searchQuery }: { store: StoreType; searchQuery: string }) {
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected' | 'expired'>('all');
  const [extendModal, setExtendModal] = useState<string | null>(null);
  const [extendDays, setExtendDays] = useState(30);

  const filtered = useMemo(() => {
    let data = store.verifications;
    if (filter !== 'all') data = data.filter(v => v.status === filter);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      data = data.filter(v => (v.storeName || '').toLowerCase().includes(q) || (v.userName || '').toLowerCase().includes(q));
    }
    return data;
  }, [store.verifications, filter, searchQuery]);

  const filterTabs = [
    { key: 'all', label: 'الكل', count: store.verifications.length },
    { key: 'pending', label: 'معلق', count: store.verifications.filter(v => v.status === 'pending').length },
    { key: 'approved', label: 'مقبول', count: store.verifications.filter(v => v.status === 'approved').length },
    { key: 'rejected', label: 'مرفوض', count: store.verifications.filter(v => v.status === 'rejected').length },
  ];

  return (
    <div className="space-y-4 pb-4">
      <FilterTabs tabs={filterTabs} activeKey={filter} onChange={(k) => setFilter(k as typeof filter)} />

      {filtered.length === 0 ? (
        <EmptyState icon={<ShieldCheck className="w-7 h-7" />} message="لا توجد طلبات توثيق" />
      ) : (
        filtered.map(v => (
          <DataCard key={v.id}>
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${v.status === 'pending' ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-500 dark:text-amber-400' : v.status === 'approved' ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-500' : 'bg-rose-50 dark:bg-rose-900/20 text-rose-500 dark:text-rose-400'}`}>
                {v.status === 'pending' ? <Clock className="w-5 h-5" /> : v.status === 'approved' ? <ShieldCheck className="w-5 h-5" /> : <ShieldX className="w-5 h-5" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-[14px] font-bold text-[var(--color-text)] truncate">{v.storeName}</p>
                </div>
                <p className="text-[11px] text-[var(--color-text-tertiary)]">{v.userName}</p>
              </div>
              <StatusBadge status={v.status === 'approved' ? 'approved' : v.status === 'rejected' ? 'rejected' : 'pending'} />
            </div>

            <div className="flex items-center gap-3 text-[11px] text-[var(--color-text-tertiary)] mb-3">
              <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />تقديم: {formatDateAdmin(v.submittedAt)}</span>
              {v.expiresAt && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />الانتهاء: {formatDateAdmin(v.expiresAt)}</span>}
            </div>

            {v.notes && (
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-2 mb-3">
                <p className="text-[11px] text-[var(--color-text-secondary)]">{v.notes}</p>
              </div>
            )}

            <div className="flex flex-wrap gap-2 pt-2 border-t border-[var(--color-border)]">
              {v.status === 'pending' && (
                <>
                  <ActionBtn icon={<CheckCircle className="w-3.5 h-3.5" />} label="قبول" onClick={async () => { try { await store.toggleStoreVerified(v.storeId); toast.success('تم توثيق المتجر ✅'); } catch { toast.error('فشل التحديث'); } }} variant="success" />
                  <ActionBtn icon={<XCircle className="w-3.5 h-3.5" />} label="رفض" onClick={async () => { try { await store.rejectVerification(v.storeId); toast.success('تم رفض طلب التوثيق'); } catch { toast.error('فشل التحديث'); } }} variant="danger" />
                </>
              )}
              {v.status === 'approved' && v.expiresAt && (
                <ActionBtn icon={<Clock className="w-3.5 h-3.5" />} label="تمديد" onClick={() => { setExtendModal(v.id); setExtendDays(30); }} variant="warning" />
              )}
              {v.status === 'approved' && (
                <ActionBtn icon={<ShieldX className="w-3.5 h-3.5" />} label="إلغاء التوثيق" onClick={async () => { try { await store.toggleStoreVerified(v.storeId); toast.success('تم إلغاء التوثيق'); } catch { toast.error('فشل التحديث'); } }} variant="danger" />
              )}
            </div>
          </DataCard>
        ))
      )}

      <Modal isOpen={!!extendModal} onClose={() => setExtendModal(null)} title="تمديد التوثيق">
        <div className="space-y-4">
          <div>
            <label className="text-[13px] font-bold text-emerald-900 dark:text-emerald-300 block mb-2">مدة التمديد</label>
            <div className="flex flex-wrap gap-2">
              {[15, 30, 90, 180, 365].map(d => (
                <button key={d} onClick={() => setExtendDays(d)}
                  className={`px-3 py-2 rounded-lg text-[12px] font-bold transition-all ${extendDays === d ? 'gradient-primary text-white shadow-md' : 'bg-slate-100 dark:bg-slate-800 text-[var(--color-text-secondary)] hover:bg-slate-200'}`}>
                  {d} يوم
                </button>
              ))}
            </div>
          </div>
          <Button variant="primary" fullWidth onClick={() => { if (extendModal) { store.extendVerification(extendModal, extendDays); toast.success('تم تمديد التوثيق بنجاح'); setExtendModal(null); } }}
            icon={<Clock className="w-4 h-4" />}>تأكيد التمديد</Button>
        </div>
      </Modal>
    </div>
  );
}

// ===== NOTIFICATIONS TAB =====
function NotificationsTab({ store }: { store: StoreType }) {
  const [target, setTarget] = useState<'all' | 'user' | 'store'>('all');
  const [type, setType] = useState<'system' | 'announcement' | 'warning' | 'promotion'>('announcement');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [targetId, setTargetId] = useState('');

  const sentNotifs = store.sentNotifications;

  const typeConfig: Record<string, { label: string; bg: string; icon: React.ReactNode }> = {
    system: { label: 'نظام', bg: 'bg-slate-100 dark:bg-slate-800 text-slate-600', icon: <Info className="w-4 h-4" /> },
    announcement: { label: 'إعلان', bg: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600', icon: <Megaphone className="w-4 h-4" /> },
    warning: { label: 'تحذير', bg: 'bg-amber-50 dark:bg-amber-900/20 text-amber-600', icon: <AlertTriangle className="w-4 h-4" /> },
    promotion: { label: 'ترويج', bg: 'bg-rose-50 dark:bg-rose-900/20 text-rose-600', icon: <Gift className="w-4 h-4" /> },
  };

  return (
    <div className="space-y-4 pb-4">
      {/* Send Form */}
      <DataCard>
        <SectionHeader title="إرسال إشعار جديد" />
        <div className="space-y-3">
          <div>
            <label className="text-[12px] font-bold text-[var(--color-text-secondary)] block mb-1.5">الوجهة</label>
            <div className="flex gap-2">
              {([['all', 'الجميع'], ['user', 'مستخدم'], ['store', 'متجر']] as const).map(([k, l]) => (
                <button key={k} onClick={() => setTarget(k)}
                  className={`px-4 py-2 rounded-lg text-[12px] font-bold transition-all ${target === k ? 'gradient-primary text-white shadow-md' : 'bg-slate-100 dark:bg-slate-800 text-[var(--color-text-secondary)]'}`}>
                  {l}
                </button>
              ))}
            </div>
          </div>

          {target !== 'all' && (
            <div>
              <label className="text-[12px] font-bold text-[var(--color-text-secondary)] block mb-1.5">{target === 'user' ? 'معرف المستخدم' : 'معرف المتجر'}</label>
              <input type="text" value={targetId} onChange={e => setTargetId(e.target.value)} placeholder={target === 'user' ? 'u1' : 's1'}
                className="w-full h-10 bg-[var(--color-surface)] border border-emerald-100 dark:border-emerald-800 rounded-lg px-3 text-[13px] text-[var(--color-text)] placeholder:text-[var(--color-text-tertiary)] outline-none focus:ring-2 focus:ring-emerald-500/15" />
            </div>
          )}

          <div>
            <label className="text-[12px] font-bold text-[var(--color-text-secondary)] block mb-1.5">النوع</label>
            <div className="flex gap-2">
              {Object.entries(typeConfig).map(([k, c]) => (
                <button key={k} onClick={() => setType(k as typeof type)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-bold transition-all ${type === k ? 'ring-2 ring-emerald-400 ' + c.bg : 'bg-slate-100 dark:bg-slate-800 text-[var(--color-text-secondary)]'}`}>
                  {c.icon}{c.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[12px] font-bold text-[var(--color-text-secondary)] block mb-1.5">الأولوية</label>
            <div className="flex gap-2">
              {([['low', 'منخفضة'], ['medium', 'متوسطة'], ['high', 'عالية'], ['urgent', 'عاجلة']] as const).map(([k, l]) => (
                <button key={k} onClick={() => setPriority(k)}
                  className={`px-3 py-2 rounded-lg text-[12px] font-bold transition-all ${priority === k ? 'gradient-primary text-white shadow-md' : 'bg-slate-100 dark:bg-slate-800 text-[var(--color-text-secondary)]'}`}>
                  {l}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[12px] font-bold text-[var(--color-text-secondary)] block mb-1.5">العنوان</label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="عنوان الإشعار"
              className="w-full h-10 bg-[var(--color-surface)] border border-emerald-100 dark:border-emerald-800 rounded-lg px-3 text-[13px] text-[var(--color-text)] placeholder:text-[var(--color-text-tertiary)] outline-none focus:ring-2 focus:ring-emerald-500/15" />
          </div>

          <div>
            <label className="text-[12px] font-bold text-[var(--color-text-secondary)] block mb-1.5">المحتوى</label>
            <textarea value={body} onChange={e => setBody(e.target.value)} rows={3} placeholder="محتوى الإشعار..."
              className="w-full bg-[var(--color-surface)] border border-emerald-100 dark:border-emerald-800 rounded-lg py-2.5 px-3 text-[13px] text-[var(--color-text)] placeholder:text-[var(--color-text-tertiary)] outline-none focus:ring-2 focus:ring-emerald-500/15 resize-none" />
          </div>

          <Button variant="primary" fullWidth onClick={() => {
            if (!title.trim() || !body.trim()) { toast.error('يرجى ملء العنوان والمحتوى'); return; }
            if (target !== 'all' && !targetId.trim()) { toast.error('يرجى إدخال معرف الوجهة'); return; }
            store.sendNotification({ title: title.trim(), body: body.trim(), type, priority, target, targetId: targetId.trim() });
            toast.success('تم إرسال الإشعار بنجاح');
            setTitle(''); setBody(''); setTargetId('');
          }} icon={<Send className="w-4 h-4" />}>
            إرسال الإشعار
          </Button>
        </div>
      </DataCard>

      {/* Sent Notifications */}
      <DataCard>
        <SectionHeader title="الإشعارات المرسلة" subtitle={`${sentNotifs.length} إشعار`} />
        {sentNotifs.length === 0 ? (
          <p className="text-center text-[13px] text-[var(--color-text-tertiary)] py-4">لا توجد إشعارات مرسلة</p>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {sentNotifs.map(n => (
              <div key={n.id} className="flex items-start gap-3 py-2.5 border-b border-[var(--color-border)] last:border-0">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${typeConfig[n.type]?.bg || 'bg-slate-100 dark:bg-slate-800 text-slate-600'}`}>
                  {typeConfig[n.type]?.icon || <Bell className="w-4 h-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-[12px] font-bold text-[var(--color-text)] truncate">{n.title}</p>
                    <StatusBadge status={n.priority === 'urgent' ? 'banned' : n.priority === 'high' ? 'reviewing' : 'active'} label={n.priority === 'urgent' ? 'عاجل' : n.priority === 'high' ? 'عالية' : n.priority === 'medium' ? 'متوسطة' : 'منخفضة'} />
                  </div>
                  <p className="text-[11px] text-[var(--color-text-tertiary)] truncate mt-0.5">{n.body}</p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-[10px] text-[var(--color-text-tertiary)]">{timeAgo(n.createdAt)}</span>
                    <span className="text-[10px] text-[var(--color-text-tertiary)]">{n.target === 'all' ? 'الجميع' : n.target === 'user' ? `مستخدم: ${n.userName}` : 'متجر'}</span>
                    {n.readCount !== undefined && n.totalRecipients && (
                      <span className="text-[10px] text-[var(--color-text-tertiary)]">{n.readCount}/{n.totalRecipients} قراءة</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </DataCard>
    </div>
  );
}

// ===== ACTIVITY TAB =====
function ActivityTab({ store, searchQuery }: { store: StoreType; searchQuery: string }) {
  const [filter, setFilter] = useState('all');

  const actionTypes = useMemo(() => {
    const types = new Set(store.activityLog.map(e => e.action));
    return Array.from(types);
  }, [store.activityLog]);

  const filtered = useMemo(() => {
    let data = store.activityLog;
    if (filter !== 'all') data = data.filter(e => e.action === filter);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      data = data.filter(e => e.action.toLowerCase().includes(q) || (e.targetName || '').toLowerCase().includes(q) || e.details.toLowerCase().includes(q));
    }
    return data;
  }, [store.activityLog, filter, searchQuery]);

  const actionIcon = (action: string) => {
    if (action.includes('حظر')) return <Ban className="w-3.5 h-3.5 text-rose-400" />;
    if (action.includes('إلغاء حظر')) return <ShieldOff className="w-3.5 h-3.5 text-emerald-400" />;
    if (action.includes('حذف')) return <Trash2 className="w-3.5 h-3.5 text-rose-400" />;
    if (action.includes('تمييز')) return <Star className="w-3.5 h-3.5 text-amber-400" />;
    if (action.includes('توثيق')) return <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />;
    if (action.includes('نقاط')) return <Coins className="w-3.5 h-3.5 text-amber-400" />;
    if (action.includes('إشعار')) return <Bell className="w-3.5 h-3.5 text-sky-400" />;
    if (action.includes('إعدادات')) return <Settings className="w-3.5 h-3.5 text-[var(--color-text-tertiary)]" />;
    if (action.includes('تعديل')) return <Pencil className="w-3.5 h-3.5 text-sky-400" />;
    return <Activity className="w-3.5 h-3.5 text-emerald-400" />;
  };

  return (
    <div className="space-y-4 pb-4">
      <div className="flex gap-2 bg-[var(--color-surface)] rounded-2xl p-1.5 shadow-sm border border-[var(--color-border)] overflow-x-auto scrollbar-hide">
        <button onClick={() => setFilter('all')}
          className={`px-3 py-2.5 rounded-xl text-[12px] font-bold transition-all whitespace-nowrap ${filter === 'all' ? 'gradient-primary text-white shadow-md' : 'text-[var(--color-text-secondary)]'}`}>
          الكل ({store.activityLog.length})
        </button>
        {actionTypes.slice(0, 5).map(t => (
          <button key={t} onClick={() => setFilter(t)}
            className={`px-3 py-2.5 rounded-xl text-[12px] font-bold transition-all whitespace-nowrap ${filter === t ? 'gradient-primary text-white shadow-md' : 'text-[var(--color-text-secondary)]'}`}>
            {t}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={<Activity className="w-7 h-7" />} message="لا توجد نشاطات" />
      ) : (
        <div className="space-y-2">
          {filtered.map(entry => (
            <DataCard key={entry.id} className="!p-3">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  {actionIcon(entry.action)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-bold text-[var(--color-text)]">{entry.action}</p>
                  {entry.targetName && <p className="text-[11px] text-[var(--color-text-tertiary)] truncate">{entry.targetName}</p>}
                  {entry.details && <p className="text-[11px] text-[var(--color-text-tertiary)] truncate mt-0.5">{entry.details}</p>}
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] text-[var(--color-text-tertiary)]">{formatDateAdmin(entry.createdAt)}</span>
                    <span className="text-[10px] text-emerald-400 dark:text-emerald-500 font-bold">{entry.adminEmail}</span>
                  </div>
                </div>
              </div>
            </DataCard>
          ))}
        </div>
      )}
    </div>
  );
}

// ===== SETTINGS TAB =====
function SettingsTab({ store }: { store: StoreType }) {
  const [settings, setSettings] = useState(store.settings);
  const [saving, setSaving] = useState(false);
  const [paymentSaving, setPaymentSaving] = useState(false);
  const [recipientName, setRecipientName] = useState(store.settings.recipientName || '');
  const [accountNumber, setAccountNumber] = useState(store.settings.accountNumber || '');
  const [qrImage, setQrImage] = useState<string | null>(store.settings.qrImage || null);
  const [loadingPayment, setLoadingPayment] = useState(false);

  React.useEffect(() => {
    setSettings(store.settings);
    setRecipientName(store.settings.recipientName || '');
    setAccountNumber(store.settings.accountNumber || '');
    setQrImage(store.settings.qrImage || null);
  }, [store.settings]);

  // Load payment settings from server on mount
  React.useEffect(() => {
    const controller = new AbortController();
    setLoadingPayment(true);
    const currentStore = store; // capture for effect closure
    apiGet('/api/payment-settings', { signal: controller.signal })
      .then(({ data }) => {
        if (controller.signal.aborted) return;
        if (data?.settings) {
          const s = data.settings;
          setRecipientName(s.recipientName || '');
          setAccountNumber(s.accountNumber || '');
          setQrImage(s.qrImage || null);
          // Also update the store settings
          currentStore.updateSettings({
            recipientName: s.recipientName || '',
            accountNumber: s.accountNumber || '',
            qrImage: s.qrImage || '',
          });
        }
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        /* fallback to current store values */
      })
      .finally(() => { if (!controller.signal.aborted) setLoadingPayment(false); });
    return () => controller.abort();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- store is stable (Zustand reference)
  }, []);

  const handleSave = () => {
    setSaving(true);
    setTimeout(() => {
      store.updateSettings(settings);
      toast.success('تم حفظ الإعدادات بنجاح ✅');
      setSaving(false);
    }, 500);
  };

  const handleSavePayment = async () => {
    setPaymentSaving(true);
    try {
      // Upload QR image if it's a base64 data URL
      let finalQrImage = qrImage || '';
      if (finalQrImage && finalQrImage.startsWith('data:')) {
        const { data: uploadData, error: uploadError } = await apiPost<{ imageUrl: string }>('/api/upload-image', { image: finalQrImage });
        if (uploadError) {
          toast.error('فشل رفع صورة QR');
          setPaymentSaving(false);
          return;
        }
        finalQrImage = uploadData?.imageUrl || finalQrImage;
        setQrImage(finalQrImage);
      }

      const { error } = await apiPut('/api/payment-settings', {
          recipientName: recipientName.trim(),
          accountNumber: accountNumber.trim(),
          qrImage: finalQrImage,
      });

      if (error) {
        toast.error(error || 'فشل حفظ إعدادات الدفع');
        setPaymentSaving(false);
        return;
      }

      // Sync to store
      store.updateSettings({
        recipientName: recipientName.trim(),
        accountNumber: accountNumber.trim(),
        qrImage: finalQrImage,
      });

      toast.success('تم حفظ إعدادات الدفع بنجاح ✅');
    } catch {
      toast.error('حدث خطأ أثناء حفظ الإعدادات');
    } finally {
      setPaymentSaving(false);
    }
  };

  return (
    <div className="space-y-4 pb-4">
      <DataCard>
        <SectionHeader title="إعدادات التطبيق" />
        <div className="space-y-4">
          {/* Maintenance */}
          <SettingToggle label="وضع الصيانة" description="تعطيل التطبيق مؤقتاً للصيانة"
            value={settings.appMaintenance} onChange={(v) => setSettings({ ...settings, appMaintenance: v })}
            iconOn={<AlertTriangle className="w-4 h-4" />} iconOff={<CheckCircle className="w-4 h-4" />} />

          {/* Allow New Stores */}
          <SettingToggle label="السماح بإنشاء متاجر جديدة" description="تفعيل أو تعطيل إنشاء المتاجر"
            value={settings.allowNewStores} onChange={(v) => setSettings({ ...settings, allowNewStores: v })}
            iconOn={<Store className="w-4 h-4" />} iconOff={<Store className="w-4 h-4" />} />

          {/* Allow New Products */}
          <SettingToggle label="السماح بإضافة منتجات جديدة" description="تفعيل أو تعطيل إضافة المنتجات"
            value={settings.allowNewProducts} onChange={(v) => setSettings({ ...settings, allowNewProducts: v })}
            iconOn={<Package className="w-4 h-4" />} iconOff={<Package className="w-4 h-4" />} />

          {/* Purchase Points */}
          <SettingToggle label="تفعيل شراء النقاط" description="السماح للمستخدمين بشراء النقاط"
            value={settings.purchaseEnabled} onChange={(v) => setSettings({ ...settings, purchaseEnabled: v })}
            iconOn={<Coins className="w-4 h-4" />} iconOff={<Coins className="w-4 h-4" />} />

          <div className="h-px bg-emerald-50/80" />

          {/* Number Inputs */}
          <SettingInput label="سعر النقطة (ل.س)" value={settings.pointPrice} onChange={(v) => setSettings({ ...settings, pointPrice: v })}
            icon={<Coins className="w-4 h-4" />} min={1} />
          <SettingInput label="الحد الأدنى لشراء النقاط" value={settings.minPointsPurchase} onChange={(v) => setSettings({ ...settings, minPointsPurchase: v })}
            icon={<Minus className="w-4 h-4" />} min={1} />
          <SettingInput label="الحد الأقصى لشراء النقاط" value={settings.maxPointsPurchase} onChange={(v) => setSettings({ ...settings, maxPointsPurchase: v })}
            icon={<Plus className="w-4 h-4" />} min={1} />
          <SettingInput label="الحد الأقصى للبلاغات يومياً" value={settings.maxReportsPerDay} onChange={(v) => setSettings({ ...settings, maxReportsPerDay: v })}
            icon={<Flag className="w-4 h-4" />} min={1} />
          <SettingInput label="حد الحظر التلقائي" value={settings.autoBanThreshold} onChange={(v) => setSettings({ ...settings, autoBanThreshold: v })}
            icon={<Ban className="w-4 h-4" />} min={1} />

          <Button variant="primary" fullWidth onClick={handleSave} loading={saving} icon={<Save className="w-4 h-4" />}>
            حفظ الإعدادات
          </Button>
        </div>
      </DataCard>

      {/* ShamCash Payment Settings */}
      <DataCard>
        <SectionHeader title="إعدادات الدفع عبر شام كاش" />
        {loadingPayment ? (
          <div className="flex justify-center py-6"><LoadingSpinner /></div>
        ) : (
          <div className="space-y-4">
            <p className="text-[12px] text-[var(--color-text-tertiary)] bg-emerald-50/30 rounded-xl p-3 border border-emerald-100/40">
              هذه الإعدادات تظهر لجميع المستخدمين عند شراء النقاط. يتم حفظها على الخادم.
            </p>

            {/* Recipient Name */}
            <div className="bg-emerald-50/30 rounded-xl p-3.5 border border-emerald-100/40 dark:border-emerald-800/30">
              <div className="flex items-center gap-2.5 mb-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 flex items-center justify-center">
                  <User className="w-4 h-4" />
                </div>
                <p className="text-[13px] font-bold text-[var(--color-text)]">اسم المستلم</p>
              </div>
              <input
                type="text"
                value={recipientName}
                onChange={e => setRecipientName(e.target.value)}
                placeholder="مثال: سوق مارع"
                className="w-full h-11 bg-[var(--color-surface)] border border-emerald-100 dark:border-emerald-800 rounded-xl px-4 text-[14px] text-[var(--color-text)] placeholder:text-[var(--color-text-tertiary)] outline-none focus:ring-2 focus:ring-emerald-500/15"
              />
            </div>

            {/* Account Number */}
            <div className="bg-emerald-50/30 rounded-xl p-3.5 border border-emerald-100/40 dark:border-emerald-800/30">
              <div className="flex items-center gap-2.5 mb-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 flex items-center justify-center">
                  <Hash className="w-4 h-4" />
                </div>
                <p className="text-[13px] font-bold text-[var(--color-text)]">رقم الحساب / رقم الهاتف</p>
              </div>
              <input
                type="text"
                value={accountNumber}
                onChange={e => setAccountNumber(e.target.value)}
                placeholder="مثال: 0961234567"
                dir="ltr"
                className="w-full h-11 bg-[var(--color-surface)] border border-emerald-100 dark:border-emerald-800 rounded-xl px-4 text-left text-[14px] text-[var(--color-text)] placeholder:text-[var(--color-text-tertiary)] outline-none focus:ring-2 focus:ring-emerald-500/15"
              />
            </div>

            {/* QR Code Image */}
            <div className="bg-emerald-50/30 rounded-xl p-3.5 border border-emerald-100/40 dark:border-emerald-800/30">
              <div className="flex items-center gap-2.5 mb-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 flex items-center justify-center">
                  <CreditCard className="w-4 h-4" />
                </div>
                <p className="text-[13px] font-bold text-[var(--color-text)]">صورة QR للدفع</p>
              </div>
              <ImageUploader
                value={qrImage}
                onChange={setQrImage}
                height="h-40"
              />
            </div>

            <Button variant="primary" fullWidth onClick={handleSavePayment} loading={paymentSaving} icon={<Save className="w-4 h-4" />}>
              حفظ إعدادات الدفع
            </Button>
          </div>
        )}
      </DataCard>
    </div>
  );
}

// ===== Settings Sub-components =====
function SettingToggle({ label, description, value, onChange, iconOn, iconOff }: {
  label: string; description: string; value: boolean; onChange: (_v: boolean) => void;
  iconOn: React.ReactNode; iconOff: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between bg-emerald-50/30 rounded-xl p-3.5 border border-emerald-100/40 dark:border-emerald-800/30">
      <div className="flex items-center gap-2.5 flex-1 min-w-0">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${value ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
          {value ? iconOn : iconOff}
        </div>
        <div className="min-w-0">
          <p className="text-[13px] font-bold text-[var(--color-text)]">{label}</p>
          <p className="text-[11px] text-[var(--color-text-tertiary)] mt-0.5 truncate">{description}</p>
        </div>
      </div>
      <button onClick={() => onChange(!value)} className={`relative w-12 h-7 rounded-full transition-colors flex-shrink-0 ${value ? 'bg-emerald-500' : 'bg-slate-300'}`}>
        <span className={`absolute top-0.5 w-6 h-6 bg-[var(--color-surface)] rounded-full shadow-sm transition-all ${value ? 'left-0.5' : 'left-5'}`} />
      </button>
    </div>
  );
}

function SettingInput({ label, value, onChange, icon, min = 0 }: {
  label: string; value: number; onChange: (_v: number) => void; icon: React.ReactNode; min?: number;
}) {
  return (
    <div className="flex items-center justify-between bg-emerald-50/30 rounded-xl p-3.5 border border-emerald-100/40 dark:border-emerald-800/30">
      <div className="flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 flex items-center justify-center">{icon}</div>
        <p className="text-[13px] font-bold text-[var(--color-text)]">{label}</p>
      </div>
      <input type="number" value={value} onChange={e => onChange(Math.max(min, parseInt(e.target.value) || 0))} min={min}
        className="w-20 h-9 bg-[var(--color-surface)] border border-emerald-100 dark:border-emerald-800 rounded-lg px-3 text-center text-[14px] font-bold text-[var(--color-text)] outline-none focus:ring-2 focus:ring-emerald-500/15" />
    </div>
  );
}

// ===== MONITORING TAB =====
function MonitoringTab() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-[16px] font-black text-[var(--color-text)]">لوحة المراقبة المباشرة</h2>
        <span className="text-[11px] text-emerald-500 font-semibold animate-pulse">● مباشر</span>
      </div>
      <MonitoringDashboard />
    </div>
  );
}

// ===== SUPPORT TICKETS TAB =====
function SupportTab() {
  const [tickets, setTickets] = useState<Array<{
    id: string; userId: string; userName: string; userEmail: string;
    subject: string; message: string; status: string; createdAt: string; updatedAt: string;
  }>>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'open' | 'closed'>('all');

  useEffect(() => {
    let cancelled = false;
    const url = `/api/admin/support-tickets${filter !== 'all' ? `?status=${filter}` : ''}`;
    apiGet<{ tickets: typeof tickets }>(url)
      .then(({ data, ok }) => {
        if (!cancelled && ok && data) setTickets(data.tickets || []);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [filter]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleFilterChange = (f: 'all' | 'open' | 'closed') => {
    setFilter(f);
    setLoading(true);
  };

  const handleStatusChange = async (id: string, status: string) => {
    try {
      const { ok } = await apiPut('/api/admin/support-tickets', { id, status });
      if (ok) {
        setTickets(prev => prev.map(t => t.id === id ? { ...t, status, updatedAt: new Date().toISOString() } : t));
        toast.success('تم تحديث الحالة');
      }
    } catch {
      toast.error('حدث خطأ');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف التذكرة؟')) return;
    try {
      const { ok } = await apiDelete(`/api/admin/support-tickets?id=${id}`);
      if (ok) {
        setTickets(prev => prev.filter(t => t.id !== id));
        toast.success('تم حذف التذكرة');
      }
    } catch {
      toast.error('حدث خطأ');
    }
  };

  const subjectLabels: Record<string, string> = {
    technical: 'مشكلة تقنية',
    suggestion: 'اقتراح',
    inquiry: 'استفسار',
    complaint: 'بلاغ',
  };

  return (
    <div className="space-y-4 pb-4">
      <div className="flex items-center gap-2 flex-wrap">
        {[
          { key: 'all' as const, label: 'الكل', count: tickets.length },
          { key: 'open' as const, label: 'مفتوح', count: tickets.filter(t => t.status === 'open').length },
          { key: 'closed' as const, label: 'مغلق', count: tickets.filter(t => t.status === 'closed').length },
        ].map(f => (
          <button key={f.key} onClick={() => handleFilterChange(f.key)}
            className={`px-3 py-2 rounded-xl text-[12px] font-bold transition-all ${
              filter === f.key
                ? 'gradient-primary text-white shadow-md shadow-emerald-500/20'
                : 'bg-emerald-50/60 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-100/60'
            }`}>
            {f.label} ({f.count})
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><LoadingSpinner /></div>
      ) : tickets.length === 0 ? (
        <EmptyState icon={<Mail className="w-7 h-7" />} message="لا توجد تذاكر دعم" />
      ) : (
        tickets.map(ticket => (
          <DataCard key={ticket.id}>
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center flex-shrink-0">
                  <MessageSquare className="w-5 h-5 text-purple-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-bold text-[var(--color-text)] truncate">
                    {subjectLabels[ticket.subject] || ticket.subject}
                  </p>
                  <p className="text-[11px] text-[var(--color-text-tertiary)] truncate">
                    {ticket.userName} · {ticket.userEmail}
                  </p>
                </div>
              </div>
              <StatusBadge status={ticket.status === 'open' ? 'new' : 'closed'} />
            </div>

            <div className="bg-slate-50/60 dark:bg-slate-800/50 rounded-xl p-3 mb-3">
              <p className="text-[12px] text-[var(--color-text-secondary)] leading-relaxed">{ticket.message}</p>
            </div>

            <div className="flex items-center gap-2 text-[11px] text-[var(--color-text-tertiary)] mb-3">
              <Clock className="w-3 h-3" />
              <span>{timeAgo(ticket.createdAt)}</span>
            </div>

            <div className="flex flex-wrap gap-2 pt-2 border-t border-[var(--color-border)]">
              {ticket.status === 'open' && (
                <ActionBtn icon={<CheckCircle className="w-3.5 h-3.5" />} label="إغلاق" onClick={() => handleStatusChange(ticket.id, 'closed')} variant="success" />
              )}
              {ticket.status === 'closed' && (
                <ActionBtn icon={<XCircle className="w-3.5 h-3.5" />} label="إعادة فتح" onClick={() => handleStatusChange(ticket.id, 'open')} variant="warning" />
              )}
              <ActionBtn icon={<Trash2 className="w-3.5 h-3.5" />} label="حذف" onClick={() => handleDelete(ticket.id)} variant="danger" />
            </div>
          </DataCard>
        ))
      )}
    </div>
  );
}
