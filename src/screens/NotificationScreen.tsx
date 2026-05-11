'use client';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRight, Bell, BellOff, BellRing, CheckCheck,
  Info, Store, Heart, Shield, Clock, Coins, X,
  Package, Tag, AlertTriangle, CheckCircle, XCircle,
  Filter, Search, MessageCircle
} from 'lucide-react';
import { useNotificationStore, NotificationType, NOTIFICATION_TYPE_CONFIG, Notification, NotificationStats } from '@/store/notificationStore';
import { useAuthStore } from '@/store/authStore';
import { useAppStore } from '@/store/appStore';
import { timeAgo } from '@/lib/date-utils';

function getIconForType(type: NotificationType, icon?: string) {
  if (icon === 'success' || icon === 'check') return <CheckCircle className="w-4 h-4" />;
  if (icon === 'error' || icon === 'x') return <XCircle className="w-4 h-4" />;
  if (icon === 'warning') return <AlertTriangle className="w-4 h-4" />;
  if (icon === 'product') return <Package className="w-4 h-4" />;
  if (icon === 'offer') return <Tag className="w-4 h-4" />;
  if (icon === 'store') return <Store className="w-4 h-4" />;
  if (icon === 'like' || icon === 'heart') return <Heart className="w-4 h-4" />;
  if (icon === 'points' || icon === 'coins') return <Coins className="w-4 h-4" />;
  if (icon === 'shield' || icon === 'admin') return <Shield className="w-4 h-4" />;
  if (icon === 'message') return <MessageCircle className="w-4 h-4" />;

  switch (type) {
    case 'system': return <Info className="w-4 h-4" />;
    case 'store': return <Store className="w-4 h-4" />;
    case 'interaction': return <Heart className="w-4 h-4" />;
    case 'admin': return <Shield className="w-4 h-4" />;
    case 'auto': return <Clock className="w-4 h-4" />;
    case 'points': return <Coins className="w-4 h-4" />;
    case 'message': return <MessageCircle className="w-4 h-4" />;
  }
}

// ===== Notification Item =====
const NotificationItem: React.FC<{
  notification: Notification;
  onRead: (_id: string) => void;
  onDelete: (_id: string) => void;
  onClick: (_notif: Notification) => void;
}> = ({ notification, onRead, onDelete, onClick }) => {
  const config = NOTIFICATION_TYPE_CONFIG[notification.type];
  // PRIORITY_CONFIG lookup reserved for future priority-based styling

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -100, transition: { duration: 0.2 } }}
      transition={{ duration: 0.25 }}
      className={`relative group rounded-2xl border overflow-hidden transition-all ${
        notification.isRead
          ? 'bg-[var(--color-surface)]/40 border-[var(--color-border)]/40 opacity-60'
          : `bg-gradient-to-l ${config.bg} border ${config.border} shadow-sm`
      }`}
    >
      <div
        onClick={() => {
          if (!notification.isRead) onRead(notification.id);
          onClick(notification);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            if (!notification.isRead) onRead(notification.id);
            onClick(notification);
          }
        }}
        role="button"
        tabIndex={0}
        className="w-full text-right flex items-start gap-3 p-3.5 cursor-pointer"
      >
        {/* Unread indicator */}
        {!notification.isRead && (
          <div className="absolute top-4 right-1.5 w-2 h-2 rounded-full bg-emerald-500" />
        )}

        {/* Icon */}
        <div className={`w-10 h-10 rounded-xl ${config.bg} flex items-center justify-center flex-shrink-0 ${config.color}`}>
          {getIconForType(notification.type, notification.icon)}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 mr-1">
          <div className="flex items-center gap-2 mb-0.5">
            <span className={`text-[13px] font-bold ${notification.isRead ? 'text-slate-700 dark:text-slate-400' : 'text-[var(--color-text)]'} truncate flex-1`}>
              {notification.title}
            </span>
            {notification.priority === 'urgent' && (
              <span className="flex items-center gap-0.5 bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 text-[9px] font-bold px-1.5 py-0.5 rounded-md">
                <AlertTriangle className="w-2.5 h-2.5" />
                عاجل
              </span>
            )}
          </div>
          <p className={`text-[12px] ${notification.isRead ? 'text-[var(--color-text-tertiary)]' : 'text-[var(--color-text-secondary)]'} leading-relaxed line-clamp-2`}>
            {notification.body}
          </p>
          <div className="flex items-center gap-2 mt-1.5">
            <span className="text-[10px] text-[var(--color-text-tertiary)] font-medium">{timeAgo(notification.createdAt)}</span>
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${config.bg} ${config.color}`}>
              {config.label}
            </span>
          </div>
        </div>

        {/* Delete button — sibling, not nested inside the clickable div */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(notification.id);
          }}
          className="w-7 h-7 rounded-lg bg-slate-50 dark:bg-slate-800/50 flex items-center justify-center text-slate-300 hover:text-rose-500 dark:text-rose-400 hover:bg-rose-50 dark:bg-rose-900/20 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
          aria-label="حذف"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </motion.div>
  );
};

// ===== Filter Tabs =====
type ReadFilter = 'all' | 'unread' | 'read';
const READ_FILTER_TABS: { key: ReadFilter; label: string }[] = [
  { key: 'all', label: 'الكل' },
  { key: 'unread', label: 'غير مقروءة' },
  { key: 'read', label: 'المقروءة' },
];

const TYPE_FILTER_TABS: { key: NotificationType | 'all'; label: string; icon?: any }[] = [
  { key: 'all', label: 'الكل' },
  { key: 'message', label: 'الرسائل', icon: MessageCircle },
  { key: 'system', label: 'النظام' },
  { key: 'store', label: 'المتجر' },
  { key: 'interaction', label: 'التفاعل' },
  { key: 'admin', label: 'الإدارة' },
  { key: 'auto', label: 'تلقائي' },
  { key: 'points', label: 'النقاط' },
];

// ===== Main Screen =====
export const NotificationScreen: React.FC = () => {
  const user = useAuthStore(s => s.user);
  const setSubScreen = useAppStore(s => s.setSubScreen);
  const setSelectedStoreId = useAppStore(s => s.setSelectedStoreId);
  const setSelectedProductId = useAppStore(s => s.setSelectedProductId);
  const setSelectedOfferId = useAppStore(s => s.setSelectedOfferId);
  const notifInitialize = useNotificationStore(s => s.initialize);
  const allNotifications = useNotificationStore(s => s.notifications);
  const markAsRead = useNotificationStore(s => s.markAsRead);
  const markAllAsRead = useNotificationStore(s => s.markAllAsRead);
  const deleteNotification = useNotificationStore(s => s.deleteNotification);
  const clearAllNotifications = useNotificationStore(s => s.clearAllNotifications);
  const settings = useNotificationStore(s => s.settings);
  const updateSettings = useNotificationStore(s => s.updateSettings);

  const [activeFilter, setActiveFilter] = useState<NotificationType | 'all'>('all');
  const [readFilter, setReadFilter] = useState<ReadFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => { notifInitialize(); }, [notifInitialize]);

  const userId = user?.id || '';
  const notifications = useMemo(() => {
    let notifs = allNotifications
      .filter(n => n.userId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    // Read/unread filter
    if (readFilter === 'unread') {
      notifs = notifs.filter(n => !n.isRead);
    } else if (readFilter === 'read') {
      notifs = notifs.filter(n => n.isRead);
    }
    // Type filter
    if (activeFilter !== 'all') {
      notifs = notifs.filter(n => n.type === activeFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      notifs = notifs.filter(n =>
        n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q)
      );
    }
    return notifs;
  }, [allNotifications, userId, activeFilter, readFilter, searchQuery]);

  const unreadCount = useMemo(() => allNotifications.filter(n => n.userId === userId && !n.isRead).length, [allNotifications, userId]);

  const unreadByType = useMemo(() => allNotifications.reduce<Record<NotificationType, number>>((counts, n) => {
    if (n.userId === userId && !n.isRead) counts[n.type]++;
    return counts;
  }, { system: 0, store: 0, interaction: 0, admin: 0, auto: 0, points: 0, message: 0 }), [allNotifications, userId]);

  const stats = useMemo((): NotificationStats => {
    const userNotifs = allNotifications.filter(n => n.userId === userId);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const result: NotificationStats = {
      total: userNotifs.length,
      unread: 0,
      read: 0,
      byType: { system: 0, store: 0, interaction: 0, admin: 0, auto: 0, points: 0, message: 0 },
      today: 0,
      thisWeek: 0,
    };
    for (const n of userNotifs) {
      if (!n.isRead) result.unread++;
      else result.read++;
      result.byType[n.type]++;
      if (new Date(n.createdAt) >= today) result.today++;
      if (new Date(n.createdAt) >= weekAgo) result.thisWeek++;
    }
    return result;
  }, [allNotifications, userId]);

  const handleMarkAllRead = useCallback(() => {
    markAllAsRead(userId);
  }, [markAllAsRead, userId]);

  const handleClearAll = useCallback(() => {
    clearAllNotifications(userId);
    setConfirmClear(false);
  }, [clearAllNotifications, userId]);

  const handleNotificationClick = useCallback((notif: Notification) => {
    if (!notif.deepLink) return;
    const link = notif.deepLink;
    // Normalize: ensure link starts with /
    const normalizedLink = link.startsWith('/') ? link : `/${link}`;

    if (normalizedLink.startsWith('/store/')) {
      const storeId = normalizedLink.replace('/store/', '').split('?')[0];
      if (storeId) {
        setSelectedStoreId(storeId);
        setSubScreen('store-detail');
      }
    } else if (normalizedLink.startsWith('/product/')) {
      const productId = normalizedLink.replace('/product/', '').split('?')[0];
      if (productId) {
        setSelectedProductId(productId);
        setSubScreen('product-detail');
      }
    } else if (normalizedLink.startsWith('/offer/')) {
      const offerId = normalizedLink.replace('/offer/', '').split('?')[0];
      if (offerId) {
        setSelectedOfferId(offerId);
        setSubScreen('offer-detail');
      }
    } else if (normalizedLink.startsWith('/chat')) {
      // Chat notification deep link — e.g. /chat?storeId=xxx
      const urlObj = new URL(normalizedLink, 'https://dummy.base');
      const storeId = urlObj.searchParams.get('storeId');
      if (storeId) {
        setSelectedStoreId(storeId);
      }
      // Navigate to user-messages (customer chatting with store) or store-messages (store owner)
      const myStoreId = useAppStore.getState().myStore?.id;
      if (myStoreId && storeId === myStoreId) {
        setSubScreen('store-messages');
      } else {
        setSubScreen('user-messages');
      }
    } else if (normalizedLink === '/notifications' || normalizedLink.startsWith('/admin')) {
      setSubScreen('notifications');
    } else if (normalizedLink === '/wallet') {
      setSubScreen('wallet');
    } else if (normalizedLink === '/verification') {
      setSubScreen('verification');
    } else if (normalizedLink === '/purchase-points') {
      setSubScreen('purchase-points');
    } else if (normalizedLink === '/transactions') {
      setSubScreen('transactions');
    } else if (normalizedLink === '/share-earn') {
      setSubScreen('share-earn');
    } else if (normalizedLink === '/expired-content') {
      setSubScreen('expired-content');
    }
  }, [setSubScreen, setSelectedStoreId, setSelectedProductId, setSelectedOfferId]);

  const handleDelete = useCallback((id: string) => {
    deleteNotification(id);
  }, [deleteNotification]);

  // Group notifications by date
  const groupedNotifications = useMemo(() => {
    const groups: { label: string; items: Notification[] }[] = [];
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

    let currentGroup: { label: string; items: Notification[] } | null = null;

    notifications.forEach(notif => {
      const date = new Date(notif.createdAt);
      let label: string;
      if (date >= today) label = 'اليوم';
      else if (date >= yesterday) label = 'أمس';
      else if (date >= weekAgo) label = 'هذا الأسبوع';
      else label = 'أقدم';

      if (!currentGroup || currentGroup.label !== label) {
        currentGroup = { label, items: [notif] };
        groups.push(currentGroup);
      } else {
        currentGroup.items.push(notif);
      }
    });

    return groups;
  }, [notifications]);

  return (
    <div className="pb-14 min-h-[100dvh] bg-[var(--color-bg)]">
      {/* Header */}
      <div className="gradient-dark px-5 pt-8 pb-[4.5rem] relative overflow-hidden">
        <div className="absolute top-[-40px] right-[-30px] w-[180px] h-[180px] rounded-full bg-teal-600/15 blur-[60px]" />
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => setSubScreen('none')} className="w-10 h-10 bg-[var(--color-surface)]/10 backdrop-blur-sm rounded-xl flex items-center justify-center hover:bg-[var(--color-surface)]/20 transition-colors">
              <ArrowRight className="w-[18px] h-[18px] text-white" />
            </button>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="flex items-center gap-1.5 px-3 py-2 bg-emerald-500/20 backdrop-blur-sm rounded-xl text-emerald-300 dark:text-emerald-600 text-[11px] font-bold hover:bg-emerald-500/30 transition-colors"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  تحديد الكل كمقروء
                </button>
              )}
              <button
                onClick={() => setShowSettings(!showSettings)}
                className={`w-10 h-10 backdrop-blur-sm rounded-xl flex items-center justify-center transition-colors ${
                  showSettings ? 'bg-emerald-500/30 text-emerald-300' : 'bg-[var(--color-surface)]/10 text-teal-300 dark:text-teal-600/70 hover:bg-[var(--color-surface)]/20'
                }`}
              >
                <Filter className="w-[18px] h-[18px]" />
              </button>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-teal-500/20 backdrop-blur-sm flex items-center justify-center border border-teal-400/20 relative">
              <Bell className="w-5 h-5 text-teal-300" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -left-1 min-w-[18px] h-[18px] bg-rose-500 rounded-full flex items-center justify-center text-[9px] font-black text-white px-1">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </div>
            <div>
              <h1 className="text-white text-[20px] font-black">الإشعارات</h1>
              <p className="text-teal-300 dark:text-teal-600/50 text-[12px] mt-0.5">
                {unreadCount > 0
                  ? `${unreadCount} إشعار غير مقروء من أصل ${stats.total}`
                  : `لا توجد إشعارات جديدة`}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="px-4 -mt-6 relative z-20 mb-3">
        <div className="bg-[var(--color-surface)] rounded-2xl shadow-sm border border-[var(--color-border)] p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <BellRing className="w-3.5 h-3.5 text-emerald-500" />
                <span className="text-[11px] font-bold text-emerald-700">الكل {stats.total}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-[11px] font-bold text-[var(--color-text-secondary)]">غير مقروء {stats.unread}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCheck className="w-3.5 h-3.5 text-[var(--color-text-tertiary)]" />
                <span className="text-[11px] font-bold text-[var(--color-text-tertiary)]">مقروء {stats.read}</span>
              </div>
            </div>
            {stats.total > 0 && (
              <button
                onClick={() => setConfirmClear(!confirmClear)}
                className="text-[11px] font-bold text-rose-400 hover:text-rose-600 dark:text-rose-400 transition-colors"
              >
                {confirmClear ? 'تأكيد الحذف' : 'حذف الكل'}
              </button>
            )}
          </div>
          {confirmClear && (
            <div className="flex items-center gap-2 mt-2 pt-2 border-t border-rose-100">
              <span className="text-[11px] text-rose-600 dark:text-rose-400 flex-1">هل أنت متأكد من حذف جميع الإشعارات؟</span>
              <button onClick={handleClearAll} className="text-[11px] font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/20 px-3 py-1 rounded-lg hover:bg-rose-100 dark:bg-rose-900/30">نعم</button>
              <button onClick={() => setConfirmClear(false)} className="text-[11px] font-bold text-[var(--color-text-secondary)] bg-slate-50 dark:bg-slate-800/50 px-3 py-1 rounded-lg">إلغاء</button>
            </div>
          )}
        </div>
      </div>

      {/* Settings Panel */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="px-4 mb-3 overflow-hidden"
          >
            <div className="bg-[var(--color-surface)] rounded-2xl shadow-sm border border-[var(--color-border)] p-4">
              <p className="text-[10px] font-bold text-emerald-300 dark:text-emerald-600 tracking-wide uppercase mb-3">إعدادات الإشعارات</p>
              <div className="space-y-2.5">
                <ToggleRow
                  label="تفعيل الإشعارات"
                  icon={<Bell className="w-4 h-4" />}
                  value={settings.enabled}
                  onChange={(v) => updateSettings({ enabled: v })}
                />
                {(Object.keys(NOTIFICATION_TYPE_CONFIG) as NotificationType[]).map(type => (
                  <ToggleRow
                    key={type}
                    label={NOTIFICATION_TYPE_CONFIG[type].label}
                    icon={getIconForType(type)}
                    value={settings.types[type] !== false}
                    onChange={(v) => updateSettings({ types: { ...settings.types, [type]: v } })}
                    disabled={!settings.enabled}
                  />
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Search */}
      <div className="px-4 mb-3">
        <div className="relative">
          <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-tertiary)] pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="بحث في الإشعارات..."
            className="w-full h-10 bg-[var(--color-surface)] border border-emerald-100 dark:border-emerald-800 rounded-xl pr-10 pl-4 text-[13px] text-[var(--color-text)] font-medium placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/15 focus:border-emerald-400 shadow-sm"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center">
              <X className="w-3 h-3 text-[var(--color-text-secondary)]" />
            </button>
          )}
        </div>
      </div>

      {/* Read/Unread Filter Tabs */}
      <div className="px-4 mb-3">
        <div className="flex gap-1.5">
          {READ_FILTER_TABS.map(tab => {
            const count = tab.key === 'all'
              ? stats.total
              : tab.key === 'unread'
                ? stats.unread
                : stats.read;
            return (
              <button
                key={tab.key}
                onClick={() => setReadFilter(tab.key)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-bold whitespace-nowrap transition-all flex-shrink-0 ${
                  readFilter === tab.key
                    ? 'gradient-primary text-white shadow-md shadow-emerald-500/20'
                    : 'bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:bg-emerald-50/60 dark:bg-emerald-900/20 border border-[var(--color-border)]'
                }`}
              >
                {tab.label}
                {count > 0 && (
                  <span className={`min-w-[16px] h-4 rounded-md text-[9px] font-black flex items-center justify-center px-1 ${
                    readFilter === tab.key ? 'bg-[var(--color-surface)]/25 text-white' : 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600'
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Type Filter Tabs */}
      <div className="px-4 mb-4">
        <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-1">
          {TYPE_FILTER_TABS.map(tab => {
            const count = tab.key === 'all'
              ? unreadCount
              : unreadByType[tab.key as NotificationType];
            return (
              <button
                key={tab.key}
                onClick={() => setActiveFilter(tab.key)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-bold whitespace-nowrap transition-all flex-shrink-0 ${
                  activeFilter === tab.key
                    ? 'gradient-primary text-white shadow-md shadow-emerald-500/20'
                    : 'bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:bg-emerald-50/60 dark:bg-emerald-900/20 border border-[var(--color-border)]'
                }`}
              >
                {tab.icon && <tab.icon className="w-3 h-3" />}
                {tab.label}
                {count > 0 && (
                  <span className={`min-w-[16px] h-4 rounded-md text-[9px] font-black flex items-center justify-center px-1 ${
                    activeFilter === tab.key ? 'bg-[var(--color-surface)]/25 text-white' : 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600'
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Notifications List */}
      <div className="px-4">
        {notifications.length === 0 ? (
          <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] shadow-sm py-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-emerald-50/60 dark:bg-emerald-900/20 flex items-center justify-center mx-auto mb-4">
              <BellOff className="w-8 h-8 text-emerald-300" />
            </div>
            <p className="text-[14px] font-bold text-[var(--color-text-tertiary)] mb-1">لا توجد إشعارات</p>
            <p className="text-[12px] text-[var(--color-text-tertiary)]">
              {searchQuery ? 'لا توجد نتائج للبحث' : 'ستظهر الإشعارات هنا عند حدوث أحداث'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {groupedNotifications.map(group => (
              <div key={group.label}>
                <p className="text-[10px] font-bold text-emerald-300 dark:text-emerald-600 tracking-wide uppercase mb-2 px-1">
                  {group.label}
                  <span className="text-[var(--color-text-tertiary)] mr-1">({group.items.length})</span>
                </p>
                <AnimatePresence mode="popLayout">
                  {group.items.map(notif => (
                    <NotificationItem
                      key={notif.id}
                      notification={notif}
                      onRead={markAsRead}
                      onDelete={handleDelete}
                      onClick={handleNotificationClick}
                    />
                  ))}
                </AnimatePresence>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ===== Toggle Row =====
const ToggleRow: React.FC<{
  label: string;
  icon: React.ReactNode;
  value: boolean;
  onChange: (_v: boolean) => void;
  disabled?: boolean;
}> = ({ label, icon, value, onChange, disabled }) => (
  <div className={`flex items-center justify-between py-1 ${disabled ? 'opacity-40' : ''}`}>
    <div className="flex items-center gap-2.5">
      <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center text-emerald-500">
        {icon}
      </div>
      <span className="text-[12px] font-bold text-[var(--color-text)]">{label}</span>
    </div>
    <button
      onClick={() => onChange(!value)}
      disabled={disabled}
      className={`w-10 h-6 rounded-full transition-all duration-200 flex items-center px-0.5 ${
        value
          ? 'bg-emerald-500 justify-end'
          : 'bg-slate-200 justify-start'
      }`}
    >
      <div className={`w-5 h-5 rounded-full transition-all duration-200 shadow-sm ${
        value ? 'bg-[var(--color-surface)]' : 'bg-[var(--color-surface)]'
      }`} />
    </button>
  </div>
);

