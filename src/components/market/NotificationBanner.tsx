'use client';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, CheckCircle, XCircle, AlertTriangle, Info,
  Store, Heart, Shield, Clock, Coins, Package,
  Tag, MessageCircle
} from 'lucide-react';
import { useNotificationStore, Notification, NotificationType } from '@/store/notificationStore';

// ===== Banner Item Props =====
interface BannerNotification {
  id: string;
  notification: Notification;
  timestamp: number;
}

// ===== Icon Mapping =====
function getBannerIcon(type: NotificationType, icon?: string) {
  if (icon === 'success' || icon === 'check') return <CheckCircle className="w-4 h-4" />;
  if (icon === 'error' || icon === 'x') return <XCircle className="w-4 h-4" />;
  if (icon === 'warning') return <AlertTriangle className="w-4 h-4" />;
  if (icon === 'product') return <Package className="w-4 h-4" />;
  if (icon === 'offer') return <Tag className="w-4 h-4" />;
  if (icon === 'points' || icon === 'coins') return <Coins className="w-4 h-4" />;
  if (icon === 'like' || icon === 'heart') return <Heart className="w-4 h-4" />;
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

function getBannerColors(type: NotificationType): { bg: string; border: string; text: string; iconColor: string } {
  switch (type) {
    case 'system':
      return { bg: 'bg-blue-50 dark:bg-blue-900/30', border: 'border-blue-200/60 dark:border-blue-700/40', text: 'text-blue-900 dark:text-blue-100', iconColor: 'text-blue-500 dark:text-blue-400' };
    case 'store':
      return { bg: 'bg-emerald-50 dark:bg-emerald-900/30', border: 'border-emerald-200/60 dark:border-emerald-700/40', text: 'text-emerald-900 dark:text-emerald-100', iconColor: 'text-emerald-500 dark:text-emerald-400' };
    case 'interaction':
      return { bg: 'bg-purple-50 dark:bg-purple-900/30', border: 'border-purple-200/60 dark:border-purple-700/40', text: 'text-purple-900 dark:text-purple-100', iconColor: 'text-purple-500 dark:text-purple-400' };
    case 'admin':
      return { bg: 'bg-rose-50 dark:bg-rose-900/30', border: 'border-rose-200/60 dark:border-rose-700/40', text: 'text-rose-900 dark:text-rose-100', iconColor: 'text-rose-500 dark:text-rose-400' };
    case 'auto':
      return { bg: 'bg-amber-50 dark:bg-amber-900/30', border: 'border-amber-200/60 dark:border-amber-700/40', text: 'text-amber-900 dark:text-amber-100', iconColor: 'text-amber-500 dark:text-amber-400' };
    case 'points':
      return { bg: 'bg-amber-50 dark:bg-amber-900/30', border: 'border-amber-200/60 dark:border-amber-700/40', text: 'text-amber-900 dark:text-amber-100', iconColor: 'text-amber-600 dark:text-amber-400' };
    case 'message':
      return { bg: 'bg-teal-50 dark:bg-teal-900/30', border: 'border-teal-200/60 dark:border-teal-700/40', text: 'text-teal-900 dark:text-teal-100', iconColor: 'text-teal-600 dark:text-teal-400' };
    default:
      return { bg: 'bg-slate-50 dark:bg-slate-800/80', border: 'border-slate-200/60 dark:border-slate-700', text: 'text-slate-900 dark:text-slate-100', iconColor: 'text-[var(--color-text-secondary)]' };
  }
}

// ===== Banner Component =====
const NotificationBanner: React.FC<{
  banner: BannerNotification;
  onDismiss: (_id: string) => void;
  onClick: (_notification: Notification) => void;
}> = ({ banner, onDismiss, onClick }) => {
  const colors = getBannerColors(banner.notification.type);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.95, transition: { duration: 0.15 } }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      className={`${colors.bg} ${colors.border} border rounded-xl shadow-lg overflow-hidden max-w-sm w-full mx-auto backdrop-blur-sm`}
      onClick={() => onClick(banner.notification)}
    >
      <div className="flex items-start gap-2.5 p-2.5">
        <div className={`w-8 h-8 rounded-lg ${colors.bg} flex items-center justify-center flex-shrink-0 ${colors.iconColor} border border-white/60 shadow-sm`}>
          {getBannerIcon(banner.notification.type, banner.notification.icon)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <p className={`text-[12px] font-bold ${colors.text} truncate`}>{banner.notification.title}</p>
          </div>
          <p className={`text-[12px] ${colors.text} opacity-80 leading-relaxed line-clamp-2`}>
            {banner.notification.body}
          </p>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onDismiss(banner.id); }}
          className="w-6 h-6 rounded-lg bg-[var(--color-surface)]/60 flex items-center justify-center text-[var(--color-text-tertiary)] hover:text-slate-600 flex-shrink-0"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    </motion.div>
  );
};

// ===== Provider Component =====
export const NotificationProvider: React.FC<{
  userId: string;
  onNavigate?: (_notification: Notification) => void;
}> = ({ userId, onNavigate }) => {
  const markAsRead = useNotificationStore(s => s.markAsRead);
  const [banners, setBanners] = useState<BannerNotification[]>([]);
  const prevCountRef = useRef(-1);
  const autoDismissTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismissBanner = useCallback((id: string) => {
    const timer = autoDismissTimers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      autoDismissTimers.current.delete(id);
    }
    setBanners(prev => prev.filter(b => b.id !== id));
  }, []);

  const addBanner = useCallback((notification: Notification) => {
    const bannerId = `banner_${notification.id}_${Date.now()}`;
    const banner: BannerNotification = { id: bannerId, notification, timestamp: Date.now() };

    // Max 2 banners at a time
    setBanners(prev => [...prev, banner].slice(-2));

    // Auto-dismiss after 4 seconds
    const timer = setTimeout(() => dismissBanner(bannerId), 4000);
    autoDismissTimers.current.set(bannerId, timer);
  }, [dismissBanner]);

  /**
   * ✅ FIX BUG-C2: Removed redundant ChatMessage realtime subscription.
   *
   * Previously, NotificationProvider subscribed to ChatMessage INSERT and did:
   *   1. incrementUnread() — DUPLICATE (useChatSocket already does this)
   *   2. upsertConversation() — DUPLICATE (useChatSocket already does this)
   *   3. createNotification() — DUPLICATE (useChatSocket already does this)
   *   4. addBanner() — DUPLICATE (useChatSocket already triggers notifications which get picked up below)
   *
   * This caused 2x notifications, 2x unread increments, and 2x API calls per message.
   * Chat messages are now handled exclusively by useChatSocket.ts.
   *
   * This component only watches the notificationStore for new unread notifications
   * (which catches all types: system, admin, points, etc.) and shows banners.
   */

  // ✅ Reactive: watch notificationStore for new unread notifications.
  // NO polling — uses Zustand subscribe for instant reaction.
  // LAYER 4: Notifications arrive via realtime → store update → this fires.
  useEffect(() => {
    // Initialize prevCount with current unread count
    const store = useNotificationStore.getState();
    prevCountRef.current = store.getUnreadNotifications(userId).length;

    const unsub = useNotificationStore.subscribe(
      (state) =>
        state.notifications.filter((n) => n.userId === userId && !n.isRead && !n.isDeleted).length,
      (newCount: number, oldCount: number) => {
        if (newCount > oldCount && oldCount >= 0) {
          const s = useNotificationStore.getState();
          const unreadNotifs = s.getUnreadNotifications(userId);
          const newNotifs = unreadNotifs.slice(0, newCount - oldCount);
          newNotifs.forEach((notif) => {
            if (s.isTypeEnabled(notif.type)) {
              addBanner(notif);
            }
          });
        }
        prevCountRef.current = newCount;
      },
    );

    return unsub;
  }, [userId, addBanner]);

  const handleBannerClick = useCallback((notification: Notification) => {
    markAsRead(notification.id);
    onNavigate?.(notification);
    setBanners(prev => {
      prev.forEach(b => dismissBanner(b.id));
      return [];
    });
  }, [markAsRead, onNavigate, dismissBanner]);

  // ✅ FIX BUG-H3: Cleanup timers properly
  useEffect(() => {
    const timers = autoDismissTimers.current;
    return () => {
      timers.forEach(timer => clearTimeout(timer));
    };
  }, []);

  const content = (
    <div className="fixed top-0 left-0 right-0 z-[100] pointer-events-none flex flex-col items-center gap-2 p-3 pt-12">
      <AnimatePresence mode="popLayout">
        {banners.map(banner => (
          <div key={banner.id} className="pointer-events-auto">
            <NotificationBanner
              banner={banner}
              onDismiss={dismissBanner}
              onClick={handleBannerClick}
            />
          </div>
        ))}
      </AnimatePresence>
    </div>
  );

  // Render via portal to document.body so fixed positioning is never
  // affected by ancestor CSS transforms.
  if (typeof window !== 'undefined') {
    return createPortal(content, document.body);
  }
  return content;
};
