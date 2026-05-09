import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import type { NotificationType, NotificationPriority, NotificationStats, NotificationSettings } from '@/types'
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/fetchApi'
import { isHydrated, markHydrated } from '@/lib/hydration'

export type { NotificationType, NotificationStats }

// ============================================
// Types
// ============================================

export interface Notification {
  id: string
  userId: string
  type: NotificationType
  category: string
  title: string
  body: string
  icon?: string
  imageUrl?: string
  deepLink?: string
  priority: NotificationPriority
  isRead: boolean
  isDeleted: boolean
  createdAt: string
  expiresAt?: string
  data?: Record<string, unknown>
}

// ============================================
// Module-level notification Map (stable across renders)
// Server-authoritative, client-optimized, race-condition safe.
// ============================================

const NOTIFICATION_STORE_LIMIT = 100

// Track locally-dismissed IDs so polling doesn't re-add them
const _dismissedIds = new Set<string>()

/** Core merge function: DB overwrites existing, dismissed are excluded, local-only preserved */
function mergeNotifications(
  existing: Notification[],
  serverList: Notification[],
): Notification[] {
  const map = new Map<string, Notification>()

  // 1. Load existing (local-only optimistic notifications preserved)
  for (const n of existing) {
    if (!_dismissedIds.has(n.id) && !n.isDeleted) {
      map.set(n.id, n)
    }
  }

  // 2. Server notifications overwrite (authoritative) — skip dismissed
  for (const n of serverList) {
    if (!_dismissedIds.has(n.id) && !n.isDeleted) {
      map.set(n.id, n)
    }
  }

  // 3. Sort + limit
  const merged = Array.from(map.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )

  // 4. Growth guard: if over limit, remove oldest
  if (merged.length > NOTIFICATION_STORE_LIMIT) {
    merged.length = NOTIFICATION_STORE_LIMIT
  }

  return merged
}

// ============================================
// Constants
// ============================================

const DEFAULT_SETTINGS: NotificationSettings = {
  enabled: true,
  types: {
    system: true,
    store: true,
    interaction: true,
    admin: true,
    auto: true,
    points: true,
    message: true,
  },
}

export interface PrivacySettings {
  showAvatar: boolean
  showActivity: boolean
  allowMessages: boolean
}

const DEFAULT_PRIVACY: PrivacySettings = {
  showAvatar: true,
  showActivity: true,
  allowMessages: true,
}

const SETTINGS_STORAGE_KEY = 'app_notification_settings';
const PRIVACY_STORAGE_KEY = 'app_privacy_settings';

export const NOTIFICATION_TYPE_CONFIG: Record<NotificationType, { label: string; color: string; bg: string; border: string; icon: string }> = {
  system: { label: 'النظام', color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200/40', icon: 'Info' },
  store: { label: 'المتجر', color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200/40', icon: 'Store' },
  interaction: { label: 'تفاعل', color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-200/40', icon: 'Heart' },
  admin: { label: 'الإدارة', color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-200/40', icon: 'Shield' },
  auto: { label: 'تلقائي', color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200/40', icon: 'Clock' },
  points: { label: 'النقاط', color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200/40', icon: 'Coins' },
  message: { label: 'الرسائل', color: 'text-teal-600', bg: 'bg-teal-50', border: 'border-teal-200/40', icon: 'MessageCircle' },
}

export const PRIORITY_CONFIG: Record<NotificationPriority, { label: string; color: string; bg: string; dot: string }> = {
  low: { label: 'منخفض', color: 'text-slate-500', bg: 'bg-slate-50', dot: 'bg-slate-400' },
  medium: { label: 'متوسط', color: 'text-blue-600', bg: 'bg-blue-50', dot: 'bg-blue-400' },
  high: { label: 'مرتفع', color: 'text-amber-600', bg: 'bg-amber-50', dot: 'bg-amber-400' },
  urgent: { label: 'عاجل', color: 'text-rose-600', bg: 'bg-rose-50', dot: 'bg-rose-500' },
}

// ============================================
// Store Interface
// ============================================

interface NotificationState {
  notifications: Notification[]
  loading: boolean
  error: string | null
  settings: NotificationSettings
  privacy: PrivacySettings

  // Init
  initialize: () => void

  // Core CRUD via API
  fetchNotifications: (_userId: string) => Promise<void>
  createNotification: (_params: {
    userId: string
    type: NotificationType
    category: string
    title: string
    body: string
    icon?: string
    imageUrl?: string
    deepLink?: string
    priority?: NotificationPriority
    data?: Record<string, unknown>
  }) => Promise<Notification | null>
  markAsRead: (_notificationId: string) => Promise<void>
  markAllAsRead: (_userId: string) => Promise<void>

  /** Soft-delete: removes from UI immediately, syncs to server (sets isDeleted=true) */
  dismissNotification: (_notificationId: string) => Promise<void>

  /** @deprecated Use dismissNotification instead — kept for backward compatibility */
  deleteNotification: (_notificationId: string) => Promise<void>

  /** Bulk soft-delete: dismisses all notifications for a user */
  clearAllNotifications: (_userId: string) => Promise<void>

  // Queries (client-side computed)
  getNotifications: (_userId: string, _type?: NotificationType) => Notification[]
  getUnreadNotifications: (_userId: string) => Notification[]

  /** Remove notifications older than 7 days and cap at 100 */
  cleanOldNotifications: () => void

  // Settings (local only — UI preferences)
  updateSettings: (_settings: Partial<NotificationSettings>) => void
  isTypeEnabled: (_type: NotificationType) => boolean

  // Privacy (local only — UI preferences)
  updatePrivacySettings: (_settings: Partial<PrivacySettings>) => void
}

export const useNotificationStore = create<NotificationState>()(subscribeWithSelector((set, get) => ({
  notifications: [],
  loading: false,
  error: null,
  settings: DEFAULT_SETTINGS,
  privacy: DEFAULT_PRIVACY,

  initialize: () => {
    if (typeof window === 'undefined') return;

    try {
      const savedSettings = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings);
        // Deep-merge types to avoid losing default keys
        const mergedTypes = { ...DEFAULT_SETTINGS.types, ...(parsed.types || {}) };
        set({ settings: { ...DEFAULT_SETTINGS, ...parsed, types: mergedTypes } });
      }
      const savedPrivacy = localStorage.getItem(PRIVACY_STORAGE_KEY);
      if (savedPrivacy) {
        const parsed = JSON.parse(savedPrivacy);
        set({ privacy: { ...DEFAULT_PRIVACY, ...parsed } });
      }
    } catch { /* ignore parse errors */ }

    // Clean old notifications on init
    get().cleanOldNotifications();
  },

  // ===== API Calls =====

  fetchNotifications: async (userId: string) => {
    if (get().loading) return

    // Hydration guard: skip if already loaded this session
    if (isHydrated('notifications')) return

    set({ loading: true, error: null })
    try {
      const { data, error: apiError } = await apiGet<{ notifications: Record<string, unknown>[] }>(`/api/notifications?user_id=${encodeURIComponent(userId)}`)
      if (apiError) {
        set({ error: apiError || 'فشل جلب الإشعارات' })
        return
      }

      // Parse server notifications (API already filters isDeleted=false)
      const serverNotifs: Notification[] = (data?.notifications || []).map((n: Record<string, unknown>) => ({
        id: n.id as string,
        userId: (n.user_id as string) || userId,
        type: (n.type as NotificationType) || 'system',
        category: (n.category as string) || 'general',
        title: (n.title as string) || '',
        body: (n.body as string) || '',
        icon: (n.icon as string) || undefined,
        imageUrl: (n.image_url as string) || undefined,
        deepLink: (n.deep_link as string) || undefined,
        priority: (n.priority as NotificationPriority) || 'medium',
        isRead: !!(n.is_read),
        isDeleted: false, // Server already filters these out
        createdAt: (n.created_at as string) || new Date().toISOString(),
        data: n.data as Record<string, unknown> | undefined,
      }))

      // ⚡ Merge via Map: server overwrites, dismissed excluded, local-only preserved
      const merged = mergeNotifications(get().notifications, serverNotifs)
      set({ notifications: merged })
      markHydrated('notifications')
    } catch {
      set({ error: 'تعذر الاتصال بالخادم' })
    } finally {
      set({ loading: false })
    }
  },

  createNotification: async (params) => {
    try {
      const { data, error: apiError } = await apiPost<{ notification: Record<string, unknown> }>('/api/notifications', {
        user_id: params.userId,
        title: params.title,
        body: params.body,
        type: params.type,
        category: params.category,
        icon: params.icon,
        image_url: params.imageUrl,
        deep_link: params.deepLink,
        priority: params.priority || 'medium',
        data: params.data,
      })
      if (apiError) {
        set({ error: apiError || 'فشل إنشاء الإشعار' })
        return null
      }

      const dbNotif = data?.notification;
      if (!dbNotif) {
        set({ error: 'فشل إنشاء الإشعار — لا بيانات' });
        return null;
      }
      const notif: Notification = {
        id: dbNotif.id as string,
        userId: (dbNotif.user_id as string) || params.userId,
        type: params.type,
        category: params.category,
        title: params.title,
        body: params.body,
        icon: params.icon,
        imageUrl: params.imageUrl,
        deepLink: params.deepLink,
        priority: params.priority || 'medium',
        isRead: false,
        isDeleted: false,
        createdAt: (dbNotif.created_at as string) || new Date().toISOString(),
        data: params.data,
      }

      // 🛑 Dedup guard: skip if already exists
      if (get().notifications.some(n => n.id === notif.id)) {
        return notif
      }

      // Optimistically prepend via merge
      const merged = mergeNotifications([notif, ...get().notifications], [])
      set({ notifications: merged })

      return notif
    } catch {
      set({ error: 'تعذر الاتصال بالخادم' })
      return null
    }
  },

  markAsRead: async (notificationId: string) => {
    const prev = get().notifications
    // Optimistic: update in local array
    set({
      notifications: get().notifications.map(n =>
        n.id === notificationId ? { ...n, isRead: true } : n,
      ),
    })
    try {
      const { error: apiError } = await apiPut('/api/notifications', { id: notificationId, is_read: true });
      if (apiError) {
        set({ notifications: prev })
      }
    } catch {
      set({ notifications: prev })
    }
  },

  markAllAsRead: async (userId: string) => {
    try {
      const unread = get().notifications.filter(
        (n) => n.userId === userId && !n.isRead,
      )
      if (unread.length === 0) return

      // Optimistic: mark all as read locally
      set({
        notifications: get().notifications.map(n =>
          n.userId === userId ? { ...n, isRead: true } : n,
        ),
      })

      try {
        const { error: batchError } = await apiPut('/api/notifications', { action: 'mark_all_read', user_id: userId });
        if (batchError) {
          // Batch failed — individual fallback would be complex, let polling reconcile
        }
      } catch {
        // Network error — optimistic state is acceptable, will sync on next poll
      }
    } catch {
      // صمت
    }
  },

  // ===== Dismiss (Soft Delete — server + client) =====

  dismissNotification: async (notificationId: string) => {
    // 1. Optimistic: remove from local state immediately
    set({
      notifications: get().notifications.filter(n => n.id !== notificationId),
    })

    // 2. Track as dismissed so polling won't re-add
    _dismissedIds.add(notificationId)

    // 3. Server sync (fire-and-forget)
    try {
      await apiPut('/api/notifications', { action: 'dismiss', notificationId })
    } catch {
      // Soft-delete already in local state — acceptable
    }
  },

  // ===== Backward-compatible delete (alias for dismiss) =====
  deleteNotification: async (notificationId: string) => {
    return get().dismissNotification(notificationId)
  },

  // ===== Clear all (bulk dismiss) =====
  clearAllNotifications: async (userId: string) => {
    // 1. Optimistic: remove all user notifications locally
    const prev = get().notifications
    set({
      notifications: get().notifications.filter(n => n.userId !== userId),
    })

    // 2. Track all as dismissed
    for (const n of prev) {
      if (n.userId === userId) {
        _dismissedIds.add(n.id)
      }
    }

    // 3. Server sync (fire-and-forget)
    try {
      await apiDelete(`/api/notifications?user_id=${encodeURIComponent(userId)}`)
    } catch {
      // Local state already updated — acceptable
    }
  },

  // ===== Client-side Queries =====

  getNotifications: (userId, type?) => {
    let notifs = get().notifications.filter(n => n.userId === userId && !n.isDeleted)
    if (type) notifs = notifs.filter(n => n.type === type)
    return notifs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  },

  getUnreadNotifications: (userId) => {
    return get()
      .notifications.filter(n => n.userId === userId && !n.isRead && !n.isDeleted)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  },

  // ===== Settings (local only) =====

  updateSettings: (partial) => {
    const merged = { ...get().settings, ...partial };
    set({ settings: merged });
    try { localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(merged)); } catch { /* localStorage write failed — non-critical */ }
  },

  isTypeEnabled: (type) => {
    const settings = get().settings
    return settings.enabled && settings.types[type] !== false
  },

  // ===== Privacy (local only) =====

  updatePrivacySettings: (partial) => {
    const merged = { ...get().privacy, ...partial };
    set({ privacy: merged });
    try { localStorage.setItem(PRIVACY_STORAGE_KEY, JSON.stringify(merged)); } catch { /* localStorage write failed — non-critical */ }
  },

  // ===== Cleanup =====

  cleanOldNotifications: () => {
    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
    const cutoff = Date.now() - SEVEN_DAYS_MS;
    const current = get().notifications;

    // Remove notifications older than 7 days (only read ones — unread always preserved)
    const cleaned = current.filter(n => {
      if (!n.isRead) return true; // Always keep unread
      const created = new Date(n.createdAt).getTime();
      return created >= cutoff;
    });

    // Cap at NOTIFICATION_STORE_LIMIT (100)
    if (cleaned.length > NOTIFICATION_STORE_LIMIT) {
      cleaned.length = NOTIFICATION_STORE_LIMIT;
    }

    if (cleaned.length !== current.length) {
      set({ notifications: cleaned });
    }
  },
})))
