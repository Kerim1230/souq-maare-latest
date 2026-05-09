import { create } from 'zustand';
import { AUTO_DELETE_CHECK_INTERVAL_MS } from '@/lib/constants';
import { apiGet, apiPost } from '@/lib/fetchApi';

let _cleanupTimeout: ReturnType<typeof setTimeout> | null = null;
let _isRunning = false;

// ===== TYPES =====
export type DurationDays = 1 | 2 | 3 | 5 | 7 | 10 | 15 | 20 | 25 | 30;

export interface DurationOption {
  days: DurationDays;
  label: string;
}

interface ExpiredContent {
  id: string;
  userId: string;
  contentType: 'product' | 'offer';
  contentId: string;
  contentName: string;
  contentData: Record<string, unknown>;
  expiredAt: string;
  originalDuration: DurationDays;
  createdAt: string;
}

interface AutoDeleteStats {
  totalDeleted: number;
  productsExpiringToday: number;
  offersExpiringToday: number;
}

// ===== CONSTANTS =====
export const DURATION_OPTIONS: DurationOption[] = [
  { days: 1, label: 'يوم واحد' },
  { days: 2, label: 'يومان' },
  { days: 3, label: '3 أيام' },
  { days: 5, label: '5 أيام' },
  { days: 7, label: '7 أيام' },
  { days: 10, label: '10 أيام' },
  { days: 15, label: '15 يوم' },
  { days: 20, label: '20 يوم' },
  { days: 25, label: '25 يوم' },
  { days: 30, label: '30 يوم' },
];

// ===== HELPERS (pure functions — no state) =====
export function getDurationLabel(days: DurationDays): string {
  return DURATION_OPTIONS.find(d => d.days === days)?.label || `${days} يوم`;
}

export function getExpiryDate(durationDays: DurationDays): string {
  return new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString();
}

export function getTimeRemaining(expiresAt: string | null | undefined): {
  total: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  isExpired: boolean;
  text: string;
  urgencyLevel: 'safe' | 'warning' | 'urgent' | 'critical' | 'expired';
} {
  if (!expiresAt) {
    return { total: Infinity, days: 0, hours: 0, minutes: 0, seconds: 0, isExpired: false, text: '', urgencyLevel: 'safe' };
  }

  const now = Date.now();
  const expiry = new Date(expiresAt).getTime();
  const total = expiry - now;

  if (total <= 0) {
    return { total: 0, days: 0, hours: 0, minutes: 0, seconds: 0, isExpired: true, text: 'منتهي', urgencyLevel: 'expired' };
  }

  const seconds = Math.floor((total / 1000) % 60);
  const minutes = Math.floor((total / 1000 / 60) % 60);
  const hours = Math.floor((total / (1000 * 60 * 60)) % 24);
  const days = Math.floor(total / (1000 * 60 * 60 * 24));

  let text = '';
  if (days > 0) text = `${days}ي ${hours}س`;
  else if (hours > 0) text = `${hours}س ${minutes}د`;
  else text = `${minutes}د ${seconds}ث`;

  let urgencyLevel: 'safe' | 'warning' | 'urgent' | 'critical' | 'expired';
  if (days > 3) urgencyLevel = 'safe';
  else if (days > 1) urgencyLevel = 'warning';
  else if (hours > 6) urgencyLevel = 'urgent';
  else urgencyLevel = 'critical';

  return { total, days, hours, minutes, seconds, isExpired: false, text, urgencyLevel };
}

export function getUrgencyColors(level: string): { bg: string; text: string; border: string; dot: string } {
  switch (level) {
    case 'safe': return { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200/60', dot: 'bg-emerald-400' };
    case 'warning': return { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200/60', dot: 'bg-amber-400' };
    case 'urgent': return { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200/60', dot: 'bg-orange-400' };
    case 'critical': return { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200/60', dot: 'bg-rose-400' };
    case 'expired': return { bg: 'bg-slate-100', text: 'text-slate-500', border: 'border-slate-200/60', dot: 'bg-slate-400' };
    default: return { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200/60', dot: 'bg-emerald-400' };
  }
}

// ===== STORE =====
interface AutoDeleteState {
  expiredContent: ExpiredContent[];
  stats: AutoDeleteStats;
  sentNotificationIds24h: string[];
  sentNotificationIds1h: string[];
  initialized: boolean;

  initialize: () => void;

  // Expiry tracking (in-memory)
  checkAndNotifyExpiry: (_items: { id: string; name: string; expiresAt: string; userId: string; contentType: 'product' | 'offer' }[]) => void;

  // Expired content archive (in-memory)
  addToExpired: (_item: Omit<ExpiredContent, 'id' | 'expiredAt' | 'createdAt'>) => void;
  removeFromExpired: (_id: string) => void;
  clearExpired: (_userId?: string) => void;

  // Stats (in-memory)
  incrementDeletedCount: (_count?: number) => void;

  // Timer
  startAutoDeleteTimer: (_callback: () => Promise<void>) => void;
  stopAutoDeleteTimer: () => void;

  // Archive + cleanup
  archiveAndCleanup: () => Promise<void>;
}

export const useAutoDeleteStore = create<AutoDeleteState>((set, get) => ({
  expiredContent: [],
  stats: { totalDeleted: 0, productsExpiringToday: 0, offersExpiringToday: 0 },
  sentNotificationIds24h: [],
  sentNotificationIds1h: [],
  initialized: false,

  initialize: () => {
    if (typeof window === 'undefined') return;
    if (get().initialized) return;
    set({ initialized: true });
  },

  // ===== EXPIRY TRACKING — delegates to notificationStore =====
  checkAndNotifyExpiry: (items) => {
    const now = Date.now();
    const state = get();
    const new24hIds: string[] = [];
    const new1hIds: string[] = [];

    items.forEach(item => {
      if (!item.expiresAt) return;
      const expiryTime = new Date(item.expiresAt).getTime();
      const itemKey = `${item.contentType}_${item.id}`;

      // Check 24h notification
      const hours24 = 24 * 60 * 60 * 1000;
      if (expiryTime - now <= hours24 && expiryTime - now > 0 && !state.sentNotificationIds24h.includes(itemKey)) {
        const msg = `${item.contentType === 'product' ? 'منتجك' : 'عرضك'} "${item.name}" سينتهي خلال 24 ساعة. يمكنك إعادة نشره لاحقاً.`;
        import('@/store/notificationStore').then(({ useNotificationStore }) => {
          useNotificationStore.getState().createNotification({
            userId: item.userId,
            type: 'auto',
            category: 'expiry',
            title: `${item.contentType === 'product' ? 'منتج' : 'عرض'} ينتهي خلال 24 ساعة`,
            body: msg,
            icon: 'Clock',
            priority: 'medium',
            data: { contentType: item.contentType, contentId: item.id, contentName: item.name, expiresAt: item.expiresAt, expiryType: '24h' },
          });
        }).catch(() => {});
        new24hIds.push(itemKey);
      }

      // Check 1h notification
      const hours1 = 60 * 60 * 1000;
      if (expiryTime - now <= hours1 && expiryTime - now > 0 && !state.sentNotificationIds1h.includes(itemKey)) {
        const msg = `${item.contentType === 'product' ? 'منتجك' : 'عرضك'} "${item.name}" سينتهي خلال ساعة واحدة!`;
        import('@/store/notificationStore').then(({ useNotificationStore }) => {
          useNotificationStore.getState().createNotification({
            userId: item.userId,
            type: 'auto',
            category: 'expiry',
            title: `${item.contentType === 'product' ? 'منتج' : 'عرض'} ينتهي خلال ساعة!`,
            body: msg,
            icon: 'AlertTriangle',
            priority: 'high',
            data: { contentType: item.contentType, contentId: item.id, contentName: item.name, expiresAt: item.expiresAt, expiryType: '1h' },
          });
        }).catch(() => {});
        new1hIds.push(itemKey);
      }
    });

    if (new24hIds.length > 0 || new1hIds.length > 0) {
      const all24hIds = [...state.sentNotificationIds24h, ...new24hIds].slice(-500);
      const all1hIds = [...state.sentNotificationIds1h, ...new1hIds].slice(-500);

      set({
        sentNotificationIds24h: all24hIds,
        sentNotificationIds1h: all1hIds,
      });
    }
  },

  // ===== EXPIRED CONTENT ARCHIVE (in-memory) =====
  addToExpired: (item) => {
    const expired: ExpiredContent = {
      ...item,
      id: `ad_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      expiredAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
    const expiredContent = [expired, ...get().expiredContent].slice(0, 100);
    set({ expiredContent });
  },

  removeFromExpired: (id) => {
    const expiredContent = get().expiredContent.filter(i => i.id !== id);
    set({ expiredContent });
  },

  clearExpired: (userId) => {
    const expiredContent = userId ? get().expiredContent.filter(i => i.userId !== userId) : [];
    set({ expiredContent });
  },

  // ===== STATS (in-memory) =====
  incrementDeletedCount: (count = 1) => {
    const stats = { ...get().stats, totalDeleted: get().stats.totalDeleted + count };
    set({ stats });
  },

  // ===== TIMER =====
  startAutoDeleteTimer: (callback) => {
    if (_cleanupTimeout) return;

    // Recursive setTimeout loop with mutex — no overlap possible
    const tick = async () => {
      if (_isRunning) return; // Skip if previous tick is still running
      _isRunning = true;
      try { await callback(); } catch { /* auto-delete tick failed — will retry next interval */ } finally { _isRunning = false; }
      _cleanupTimeout = setTimeout(tick, AUTO_DELETE_CHECK_INTERVAL_MS);
    };

    // Run immediately once, then schedule next
    callback().catch(() => {});
    _cleanupTimeout = setTimeout(tick, AUTO_DELETE_CHECK_INTERVAL_MS);
  },

  stopAutoDeleteTimer: () => {
    if (_cleanupTimeout) {
      clearTimeout(_cleanupTimeout);
      _cleanupTimeout = null;
    }
    _isRunning = false;
  },

  // ===== ARCHIVE + CLEANUP =====
  archiveAndCleanup: async () => {
    try {
      // 1. Get archivable items before cleanup
      const { data: archiveData, error: archiveError } = await apiPost<{ archivable: Record<string, unknown>[] }>('/api/auto-delete', { action: 'get-archivable' });

      if (!archiveError && archiveData?.archivable) {
        const archivable = archiveData.archivable;

        // Archive expired items to local store
        for (const item of archivable) {
          const state = get();
          // Check if already archived
          const alreadyArchived = state.expiredContent.some(e => e.contentId === item.contentId);
          if (!alreadyArchived) {
            get().addToExpired({
              userId: String(item.userId || ''),
              contentType: String(item.contentType || 'product') as 'product' | 'offer',
              contentId: String(item.contentId || ''),
              contentName: String(item.contentName || ''),
              contentData: (item.contentData || {}) as Record<string, unknown>,
              originalDuration: Number(item.originalDuration || 7) as DurationDays,
            });
          }
        }
      }

      // 2. Run cleanup (delete expired items from DB)
      const { data: cleanupData, error: cleanupError } = await apiPost<{ deleted: { products: number; offers: number; messages: number } }>('/api/auto-delete', { action: 'cleanup' });

      if (!cleanupError && cleanupData?.deleted) {
        const deleted = cleanupData.deleted;
        const totalDeleted = deleted.products + deleted.offers + deleted.messages;

        if (totalDeleted > 0) {
          get().incrementDeletedCount(totalDeleted);
        }
      }

      // 3. Check and send expiry notifications
      const { data: statsData, error: statsError } = await apiGet<{ expiringItems: Record<string, unknown>[]; stats?: { productsExpiringToday: number; offersExpiringToday: number } }>('/api/auto-delete');
      if (!statsError && statsData?.expiringItems) {
        const expiringItems = statsData.expiringItems;
        if (expiringItems.length > 0) {
          get().checkAndNotifyExpiry(
            expiringItems.map((item: Record<string, unknown>) => ({
              id: String(item.id || ''),
              name: String(item.name || ''),
              expiresAt: String(item.expiresAt || ''),
              userId: String(item.userId || ''),
              contentType: String(item.contentType || 'product') as 'product' | 'offer',
            }))
          );
        }
        // Update stats
        if (statsData.stats) {
          const currentStats = { ...get().stats };
          currentStats.productsExpiringToday = statsData.stats.productsExpiringToday;
          currentStats.offersExpiringToday = statsData.stats.offersExpiringToday;
          set({ stats: currentStats });
        }
      }

    } catch {
      // Archive and cleanup failed silently
    }
  },
}));
