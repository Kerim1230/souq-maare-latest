import { create } from 'zustand';
import { usePointsStore } from '@/store/pointsStore';
import { useVerificationStore } from '@/store/verificationStore';
import { useAdminStore } from '@/store/adminStore';
import { useAuthStore } from '@/store/authStore';
import { apiGet, apiPost } from '@/lib/fetchApi';

// ===== Types (matching real DB data) =====
export interface AdminUser {
  id: string;
  email: string;
  fullName: string | null;
  avatarUrl: string | null;
  createdAt: string;
  _count: { stores: number; products: number };
  // Client-only fields
  status: 'active' | 'banned';
  banReason?: string;
  banDuration?: string;
  points?: number;
}

export interface AdminStore {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  logoUrl: string | null;
  coverUrl: string | null;
  category: string | null;
  isVerified: boolean;
  isFeatured: boolean;
  createdAt: string;
  user?: { fullName: string | null; email: string };
  _count: { products: number; follows: number };
  // Aliases for display
  userName: string;
  productsCount: number;
  followersCount: number;
  status?: 'active' | 'banned';
}

export interface AdminProduct {
  id: string;
  storeId: string;
  userId: string;
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
  category: string | null;
  isFeatured: boolean;
  isNew: boolean;
  expiresAt: string | null;
  createdAt: string;
  store?: { name: string; isVerified: boolean };
  storeName: string;
  storeVerified: boolean;
}

export interface AdminOffer {
  id: string;
  storeId: string;
  userId: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  type: string;
  discount: string | null;
  expiresAt: string | null;
  createdAt: string;
  store?: { name: string };
  storeName: string;
  status: 'active' | 'ended';
}

export interface AdminReport {
  id: string;
  targetType: string;
  targetId: string;
  targetName: string;
  reporterId: string;
  reporterName: string;
  reporterEmail: string;
  reason: string;
  description: string;
  images: string[];
  status: 'new' | 'reviewing' | 'action_taken' | 'closed';
  createdAt: string;
  reviewedAt?: string;
  adminNote?: string;
}

interface AdminPointOrder {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  points: number;
  amount: number;
  paymentCode: string;
  receiptImage: string | null;
  status: 'pending' | 'approved' | 'rejected';
  rejectionReason?: string;
  createdAt: string;
  reviewedAt?: string;
}

interface AdminActivityLog {
  id: string;
  adminEmail: string;
  action: string;
  targetType?: string;
  targetId?: string;
  targetName?: string;
  details: string;
  createdAt: string;
}

interface AdminVerification {
  id: string;
  storeId: string;
  storeName: string;
  userName: string;
  userId: string;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  submittedAt: string;
  expiresAt: string | null;
  notes: string | null;
}

interface AdminSentNotification {
  id: string;
  title: string;
  body: string;
  type: 'system' | 'announcement' | 'warning' | 'promotion';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  target: 'all' | 'user' | 'store';
  targetId: string;
  userId: string;
  userName: string;
  readCount: number;
  totalRecipients: number;
  createdAt: string;
}

export interface AdminSettings {
  appMaintenance: boolean;
  allowNewStores: boolean;
  allowNewProducts: boolean;
  maxReportsPerDay: number;
  autoBanThreshold: number;
  pointPrice: number;
  minPointsPurchase: number;
  maxPointsPurchase: number;
  purchaseEnabled: boolean;
  recipientName: string;
  accountNumber: string;
  qrImage: string;
}

// ===== Store =====
export interface AdminDashboardState {
  users: AdminUser[];
  stores: AdminStore[];
  products: AdminProduct[];
  offers: AdminOffer[];
  reports: AdminReport[];
  pointOrders: AdminPointOrder[];
  activityLog: AdminActivityLog[];
  verifications: AdminVerification[];
  sentNotifications: AdminSentNotification[];
  settings: AdminSettings;
  initialized: boolean;
  loading: boolean;

  fetchData: () => Promise<void>;

  // Users
  deleteUser: (_userId: string) => Promise<void>;
  banUser: (_userId: string, _duration: string, _reason: string) => void;
  unbanUser: (_userId: string) => void;
  addUserPoints: (_userId: string, _points: number, _reason: string) => Promise<void>;

  // Stores
  deleteStore: (_storeId: string) => Promise<void>;
  toggleStoreFeatured: (_storeId: string) => Promise<void>;
  toggleStoreVerified: (_storeId: string) => Promise<void>;
  rejectVerification: (_storeId: string) => Promise<void>;

  // Products
  deleteProduct: (_productId: string) => Promise<void>;
  toggleProductFeatured: (_productId: string) => Promise<void>;

  // Offers
  deleteOffer: (_offerId: string) => Promise<void>;

  // Reports
  updateReportStatus: (_reportId: string, _status: AdminReport['status'], _note?: string) => void;

  // Point Orders
  approvePointOrder: (_orderId: string) => void;
  rejectPointOrder: (_orderId: string, _reason: string) => void;

  // Activity
  logActivity: (_action: string, _targetType?: string, _targetId?: string, _targetName?: string, _details?: string) => void;

  // Settings
  updateSettings: (_settings: Partial<AdminSettings>) => void;

  // Verifications
  extendVerification: (_storeId: string, _days: number) => void;

  // Notifications
  sendNotification: (_data: {
    title: string;
    body: string;
    type: AdminSentNotification['type'];
    priority: AdminSentNotification['priority'];
    target: AdminSentNotification['target'];
    targetId: string;
  }) => Promise<void>;

  // Stats
  getStats: () => {
    totalUsers: number; activeUsers: number; bannedUsers: number;
    totalStores: number; verifiedStores: number; featuredStores: number;
    totalProducts: number; featuredProducts: number;
    totalOffers: number; activeOffers: number; totalContests: number;
    newReports: number; pendingPointOrders: number;
    pendingVerifications: number;
  };
}

const defaultSettings: AdminSettings = {
  appMaintenance: false,
  allowNewStores: true,
  allowNewProducts: true,
  maxReportsPerDay: 5,
  autoBanThreshold: 10,
  pointPrice: 1,
  minPointsPurchase: 100,
  maxPointsPurchase: 100000,
  purchaseEnabled: true,
  recipientName: '',
  accountNumber: '',
  qrImage: '',
};

function _generateId(prefix: string = 'id'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

// Debounce timer for fetchData to prevent overlapping reloads
let _fetchDataTimeout: ReturnType<typeof setTimeout> | null = null;

export const useAdminDashboardStore = create<AdminDashboardState>((set, get) => ({
  users: [],
  stores: [],
  products: [],
  offers: [],
  reports: [],
  pointOrders: [],
  activityLog: [],
  verifications: [],
  sentNotifications: [],
  settings: defaultSettings,
  initialized: false,
  loading: false,

  fetchData: async () => {
    if (typeof window === 'undefined') return;

    // Debounce: cancel any pending fetch and schedule a new one
    if (_fetchDataTimeout) clearTimeout(_fetchDataTimeout);

    return new Promise<void>((resolve) => {
      _fetchDataTimeout = setTimeout(async () => {
        set({ loading: true });
        try {
          // 1. Fetch main admin data (users, stores, products, offers) — unique to dashboard
          const { data, error: fetchError, status: fetchStatus } = await apiGet('/api/admin/data');
          if (fetchStatus === 401 || fetchStatus === 403) {
            // Not an admin — silently skip
            set({ loading: false, initialized: true });
            return;
          }
          if (fetchError) throw new Error(`Failed to fetch admin data: ${fetchError}`);

          // 2. Fetch sub-store data via their own methods (single source of truth)
          const adminStore = useAdminStore.getState();
          const pointsStore = usePointsStore.getState();
          const verificationStore = useVerificationStore.getState();

          const fetchResults = await Promise.allSettled([
            adminStore.fetchBans(),
            adminStore.fetchReports(),
            adminStore.fetchActivityLog(),
            pointsStore.fetchOrders(),
            verificationStore.fetchVerifications(),
            // Fetch admin sent notifications from server for persistence
            apiGet<{ notifications: Record<string, unknown>[] }>('/api/notifications?scope=admin')
              .then(({ data: notifData }) => notifData?.notifications || [])
              .catch(() => [] as Record<string, unknown>[]),
            // Fetch all wallets for user points display
            apiGet<{ wallets: Record<string, { balance: number }> }>('/api/points/wallets')
              .then(({ data: walletData }) => walletData?.wallets || {})
              .catch(() => ({} as Record<string, { balance: number }>)),
          ]);

          // Parse admin sent notifications from server
          const notifsResult = fetchResults[5];
          if (notifsResult?.status === 'fulfilled' && notifsResult.value) {
            const serverNotifs: AdminSentNotification[] = (notifsResult.value as Record<string, unknown>[]).map((n: Record<string, unknown>) => ({
              id: String(n.id || ''),
              title: String(n.title || ''),
              body: String(n.body || ''),
              type: (n.type as AdminSentNotification['type']) || 'announcement',
              priority: (n.priority as AdminSentNotification['priority']) || 'medium',
              target: (n.target as AdminSentNotification['target']) || 'all',
              targetId: String(n.target_id || n.targetId || ''),
              userId: String(n.user_id || n.userId || ''),
              userName: String(n.user_name || n.userName || ''),
              readCount: Number(n.read_count || n.readCount || 0),
              totalRecipients: Number(n.total_recipients || n.totalRecipients || 0),
              createdAt: String(n.created_at || n.createdAt || ''),
            }));
            set({ sentNotifications: serverNotifs });
          }

          // 3. Build ban map from adminStore (single source)
          const banMap = new Map<string, { reason: string; duration: string }>();
          for (const b of adminStore.bans) {
            if (b.isActive) {
              banMap.set(b.userId, { reason: b.reason, duration: b.duration });
            }
          }

          // Extract wallet balances for user points display
          const walletsMap = fetchResults[6]?.status === 'fulfilled'
            ? (fetchResults[6].value as Record<string, { balance: number }>)
            : {};

          // Map users with ban status and real wallet balance
          const users: AdminUser[] = (data!.users || []).map((u: Record<string, unknown>) => {
            const ban = banMap.get(u.id as string);
            const userWallet = walletsMap[u.id as string];
            return {
              ...u,
              status: ban ? 'banned' as const : 'active' as const,
              banReason: ban?.reason,
              banDuration: ban ? adminStore.getBanDurationLabel(ban.duration as '1d' | '3d' | '7d' | '15d' | '30d' | 'permanent') : undefined,
              points: userWallet?.balance ?? 0,
              storeCount: (u._count as Record<string, number>)?.stores || 0,
            };
          });

          // Map stores
          const stores: AdminStore[] = (data!.stores || []).map((s: Record<string, unknown>) => ({
            ...s,
            userName: (s.user as Record<string, unknown>)?.fullName || (s.user as Record<string, unknown>)?.email || 'غير معروف',
            productsCount: (s._count as Record<string, number>)?.products || 0,
            followersCount: (s._count as Record<string, number>)?.follows || 0,
          }));

          // Map products
          const products: AdminProduct[] = (data!.products || []).map((p: Record<string, unknown>) => ({
            ...p,
            storeName: (p.store as Record<string, unknown>)?.name || 'غير معروف',
            storeVerified: (p.store as Record<string, unknown>)?.isVerified || false,
          }));

          // Map offers
          const offers: AdminOffer[] = (data!.offers || []).map((o: Record<string, unknown>) => ({
            ...o,
            storeName: (o.store as Record<string, unknown>)?.name || 'غير معروف',
            status: (o.expiresAt && new Date(o.expiresAt as string) < new Date()) ? 'ended' as const : 'active' as const,
          }));

          // Read reports from adminStore (single source)
          const reports: AdminReport[] = adminStore.reports.map((r) => ({
            id: r.id,
            targetType: r.targetType,
            targetId: r.targetId,
            targetName: r.targetName,
            reporterId: r.reporterId,
            reporterName: r.reporterName,
            reporterEmail: r.reporterEmail,
            reason: r.reason,
            description: r.description,
            images: r.images || [],
            status: r.status,
            createdAt: r.createdAt,
            reviewedAt: r.reviewedAt,
            adminNote: r.adminNote,
          }));

          // Read point orders from pointsStore (single source)
          const pointOrders: AdminPointOrder[] = pointsStore.orders.map((o) => ({
            id: o.id,
            userId: o.userId,
            userName: o.userName,
            userEmail: o.userEmail,
            points: o.points,
            amount: o.amount,
            paymentCode: o.paymentCode,
            receiptImage: o.receiptImage,
            status: o.status,
            rejectionReason: o.rejectionReason,
            createdAt: o.createdAt,
            reviewedAt: o.reviewedAt,
          }));

          // Read activity log from adminStore (single source)
          const activityLog: AdminActivityLog[] = adminStore.activityLog.map((a) => ({
            id: a.id,
            adminEmail: a.adminEmail,
            action: a.action,
            targetType: a.targetType,
            targetId: a.targetId,
            targetName: a.targetName,
            details: a.details,
            createdAt: a.createdAt,
          }));

          // Read verifications from verificationStore (single source)
          const allVerifications = verificationStore.getAllVerifications();
          const now = new Date();
          const verifications: AdminVerification[] = allVerifications.map((v) => {
            let status: AdminVerification['status'] = 'approved';
            if (v.isActive && v.endDate) {
              if (new Date(v.endDate) <= now) {
                status = 'expired';
              }
            } else if (!v.isActive) {
              status = 'rejected';
            }
            const storeOwner = users.find(u => u.id === v.userId);
            return {
              id: v.storeId,
              storeId: v.storeId,
              storeName: v.storeName || stores.find(s => s.id === v.storeId)?.name || 'غير معروف',
              userName: storeOwner?.fullName || storeOwner?.email || 'غير معروف',
              userId: v.userId,
              status,
              submittedAt: v.startDate || now.toISOString(),
              expiresAt: v.endDate,
              notes: v.grantedBy ? `بواسطة: ${v.grantedBy}` : null,
            };
          });

          set({
            users,
            stores,
            products,
            offers,
            reports,
            pointOrders,
            activityLog,
            verifications,
            initialized: true,
            loading: false,
          });
        } catch (error) {
          console.warn('Admin data fetch error:', error);
          set({ loading: false, initialized: true });
        }
        resolve();
      }, 300);
    });
  },

  // ===== Users =====
  deleteUser: async (userId: string) => {
    try {
      const { error: apiError } = await apiPost('/api/admin/action', { action: 'deleteUser', userId });
      if (apiError) throw new Error('Failed to delete user');
      const user = get().users.find(u => u.id === userId);
      get().logActivity('حذف مستخدم', 'user', userId, user?.fullName ?? undefined);
      await get().fetchData();
    } catch (error) {
      console.error('Delete user error:', error);
      throw error;
    }
  },

  banUser: (userId, duration, reason) => {
    const adminStore = useAdminStore.getState();
    const durationMap: Record<string, '1d' | '3d' | '7d' | '15d' | '30d' | 'permanent'> = {
      '1 يوم': '1d', '3 أيام': '3d', '7 أيام': '7d',
      '15 يوم': '15d', '30 يوم': '30d', 'دائم': 'permanent',
    };
    const banDuration = durationMap[duration] || '7d';
    adminStore.banUser({
      userId,
      userEmail: get().users.find(u => u.id === userId)?.email || '',
      userName: get().users.find(u => u.id === userId)?.fullName || '',
      banType: 'full',
      duration: banDuration,
      reason,
      expiresAt: new Date(Date.now() + adminStore.getBanDurationDays(banDuration) * 86400000).toISOString(),
    });
    // Refresh to update ban status
    get().fetchData();
  },

  unbanUser: (userId) => {
    const adminStore = useAdminStore.getState();
    adminStore.unbanUser(userId);
    get().fetchData();
  },

  addUserPoints: async (userId, points, reason) => {
    // Use admin action API (bypasses wallet endpoint's type restriction)
    try {
      const { error: apiError } = await apiPost('/api/admin/action', { action: 'addUserPoints', userId, points, reason });
      if (apiError) {
        console.warn('Admin addPoints error:', apiError);
        return;
      }
    } catch (err) {
      console.warn('Admin addPoints network error:', err);
      return;
    }
    const user = get().users.find(u => u.id === userId);
    get().logActivity(points > 0 ? 'إضافة نقاط' : 'خصم نقاط', 'user', userId, user?.fullName ?? undefined, `${points > 0 ? '+' : ''}${points} نقطة - ${reason}`);
    get().fetchData();
  },

  // ===== Stores =====
  deleteStore: async (storeId: string) => {
    try {
      const { error: apiError } = await apiPost('/api/admin/action', { action: 'deleteStore', storeId });
      if (apiError) throw new Error('Failed to delete store');
      const store = get().stores.find(s => s.id === storeId);
      get().logActivity('حذف متجر', 'store', storeId, store?.name);
      await get().fetchData();
    } catch (error) {
      console.error('Delete store error:', error);
      throw error;
    }
  },

  toggleStoreFeatured: async (storeId: string) => {
    try {
      const { error: apiError } = await apiPost('/api/admin/action', { action: 'toggleStoreFeatured', storeId });
      if (apiError) throw new Error('Failed to toggle featured');
      const store = get().stores.find(s => s.id === storeId);
      get().logActivity(store?.isFeatured ? 'إلغاء تمييز متجر' : 'تمييز متجر', 'store', storeId, store?.name);
      await get().fetchData();
    } catch (error) {
      console.error('Toggle store featured error:', error);
      throw error;
    }
  },

  toggleStoreVerified: async (storeId: string) => {
    try {
      const { error: apiError } = await apiPost('/api/admin/action', { action: 'toggleStoreVerified', storeId });
      if (apiError) throw new Error('Failed to toggle verified');

      const store = get().stores.find(s => s.id === storeId);
      const storeName = store?.name || 'غير معروف';
      const userId = store?.userId || '';
      const isCurrentlyVerified = store?.isVerified || false;

      // Sync with verificationStore (canonical source for verification)
      const verificationStore = useVerificationStore.getState();
      if (!isCurrentlyVerified) {
        verificationStore.grantVerification(storeId, userId, storeName, useAuthStore.getState().user?.email || 'admin');
      } else {
        verificationStore.revokeVerification(storeId, useAuthStore.getState().user?.email || 'admin');
      }

      get().logActivity(isCurrentlyVerified ? 'إلغاء توثيق متجر' : 'توثيق متجر', 'store', storeId, storeName);
      await get().fetchData();
    } catch (error) {
      console.error('Toggle store verified error:', error);
      throw error;
    }
  },

  rejectVerification: async (storeId: string) => {
    try {
      const { error: apiError } = await apiPost('/api/admin/action', { action: 'rejectVerification', storeId });
      if (apiError) throw new Error('Failed to reject verification');

      const store = get().stores.find(s => s.id === storeId);
      const storeName = store?.name || 'غير معروف';

      // Sync with verificationStore
      const verificationStore = useVerificationStore.getState();
      verificationStore.revokeVerification(storeId, useAuthStore.getState().user?.email || 'admin');

      get().logActivity('رفض طلب توثيق متجر', 'store', storeId, storeName);
      await get().fetchData();
    } catch (error) {
      console.error('Reject verification error:', error);
      throw error;
    }
  },

  // ===== Products =====
  deleteProduct: async (productId: string) => {
    try {
      const { error: apiError } = await apiPost('/api/admin/action', { action: 'deleteProduct', productId });
      if (apiError) throw new Error('Failed to delete product');
      const product = get().products.find(p => p.id === productId);
      get().logActivity('حذف منتج', 'product', productId, product?.name);
      await get().fetchData();
    } catch (error) {
      console.error('Delete product error:', error);
      throw error;
    }
  },

  toggleProductFeatured: async (productId: string) => {
    try {
      const { error: apiError } = await apiPost('/api/admin/action', { action: 'toggleProductFeatured', productId });
      if (apiError) throw new Error('Failed to toggle featured');
      const product = get().products.find(p => p.id === productId);
      get().logActivity(product?.isFeatured ? 'إلغاء تمييز منتج' : 'تمييز منتج', 'product', productId, product?.name);
      await get().fetchData();
    } catch (error) {
      console.error('Toggle product featured error:', error);
      throw error;
    }
  },

  // ===== Offers =====
  deleteOffer: async (offerId: string) => {
    try {
      const { error: apiError } = await apiPost('/api/admin/action', { action: 'deleteOffer', offerId });
      if (apiError) throw new Error('Failed to delete offer');
      const offer = get().offers.find(o => o.id === offerId);
      get().logActivity('حذف عرض/مسابقة', 'offer', offerId, offer?.title);
      await get().fetchData();
    } catch (error) {
      console.error('Delete offer error:', error);
      throw error;
    }
  },

  // ===== Reports (via adminStore → API) =====
  updateReportStatus: (reportId, status, note) => {
    const adminStore = useAdminStore.getState();
    adminStore.updateReportStatus(reportId, status, note);
    get().fetchData();
  },

  // ===== Point Orders (via pointsStore → API) =====
  approvePointOrder: (orderId) => {
    const pointsStore = usePointsStore.getState();
    pointsStore.approveOrder(orderId);
    get().logActivity('قبول طلب نقاط', 'order', orderId);
    get().fetchData();
  },

  rejectPointOrder: (orderId, reason) => {
    const pointsStore = usePointsStore.getState();
    pointsStore.rejectOrder(orderId, reason);
    get().logActivity('رفض طلب نقاط', 'order', orderId, undefined, reason);
    get().fetchData();
  },

  // ===== Activity (via adminStore → API) =====
  logActivity: (action, targetType, targetId, targetName, details) => {
    const adminStore = useAdminStore.getState();
    adminStore.logActivity(action, targetType, targetId, targetName, details);
  },

  // ===== Settings =====
  updateSettings: (settings) => {
    set(state => ({ settings: { ...state.settings, ...settings } }));

    // Sync maintenance/ban settings to adminStore
    const adminStore = useAdminStore.getState();
    adminStore.updateAppSettings({
      appMaintenance: settings.appMaintenance ?? get().settings.appMaintenance,
      allowNewStores: settings.allowNewStores ?? get().settings.allowNewStores,
      allowNewProducts: settings.allowNewProducts ?? get().settings.allowNewProducts,
      maxReportsPerDay: settings.maxReportsPerDay ?? get().settings.maxReportsPerDay,
      autoBanThreshold: settings.autoBanThreshold ?? get().settings.autoBanThreshold,
    });

    // Sync points/shamcash settings to pointsStore
    const pointsStore = usePointsStore.getState();
    pointsStore.updateAdminSettings({
      pointPrice: settings.pointPrice ?? get().settings.pointPrice,
      purchaseEnabled: settings.purchaseEnabled ?? get().settings.purchaseEnabled,
      minPoints: settings.minPointsPurchase ?? get().settings.minPointsPurchase,
      maxPoints: settings.maxPointsPurchase ?? get().settings.maxPointsPurchase,
      recipientName: settings.recipientName ?? get().settings.recipientName,
      accountNumber: settings.accountNumber ?? get().settings.accountNumber,
      qrImage: settings.qrImage ?? get().settings.qrImage,
    });

    get().logActivity('تحديث الإعدادات', undefined, undefined, undefined, 'تم تحديث إعدادات التطبيق');
  },

  // ===== Verifications =====
  extendVerification: (storeId: string, days: number) => {
    const verificationStore = useVerificationStore.getState();
    verificationStore.extendVerification(storeId, useAuthStore.getState().user?.email || 'admin', days);

    const store = get().stores.find(s => s.id === storeId);
    get().logActivity('تمديد توثيق متجر', 'store', storeId, store?.name, `تمديد لمدة ${days} يوم`);
    get().fetchData();
  },

  // ===== Notifications =====
  sendNotification: async (data) => {
    const { title, body, type, priority, target, targetId } = data;

    // Determine recipients
    let totalRecipients = 0;
    let userName = '';

    if (target === 'all') {
      totalRecipients = get().users.length;
    } else if (target === 'user') {
      const user = get().users.find(u => u.id === targetId);
      if (user) {
        totalRecipients = 1;
        userName = user.fullName || user.email;
      }
    } else if (target === 'store') {
      const store = get().stores.find(s => s.id === targetId);
      if (store) {
        const user = get().users.find(u => u.id === store.userId);
        if (user) {
          totalRecipients = 1;
          userName = user.fullName || user.email;
        }
      }
    }

    // Create admin sent-notification record (session display log)
    const sentNotification: AdminSentNotification = {
      id: _generateId('adm_notif'),
      title,
      body,
      type,
      priority,
      target,
      targetId,
      userId: target === 'all' ? '' : (target === 'user' ? targetId : get().stores.find(s => s.id === targetId)?.userId || ''),
      userName: target === 'all' ? 'الجميع' : userName || 'غير معروف',
      readCount: 0,
      totalRecipients,
      createdAt: new Date().toISOString(),
    };

    // Save in session display log
    const sentNotifications = [sentNotification, ...get().sentNotifications];
    set({ sentNotifications });

    // Persist admin notification record to server
    try {
      await apiPost('/api/notifications', {
        scope: 'admin',
        title,
        body,
        type,
        priority,
        target,
        targetId,
        userName: sentNotification.userName,
        totalRecipients: sentNotification.totalRecipients,
      });
    } catch { /* non-critical */ }

    // Delegate actual notification delivery to notificationStore
    const recipientUserId = sentNotification.userId;
    if (recipientUserId) {
      import('@/store/notificationStore').then(({ useNotificationStore }) => {
        useNotificationStore.getState().createNotification({
          userId: recipientUserId,
          type: 'admin',
          category: 'admin_sent',
          title,
          body,
          priority,
        });
      }).catch(() => {});
    } else if (target === 'all' && totalRecipients > 0) {
      // P0 FIX: Broadcast to all users with concurrency limit of 10
      // (prevents self-DDoS when there are many users)
      const CONCURRENCY_LIMIT = 10;
      const allUsers = get().users;
      for (let i = 0; i < allUsers.length; i += CONCURRENCY_LIMIT) {
        const batch = allUsers.slice(i, i + CONCURRENCY_LIMIT);
        await Promise.allSettled(
          batch.map(u =>
            import('@/store/notificationStore').then(({ useNotificationStore }) => {
              useNotificationStore.getState().createNotification({
                userId: u.id,
                type: 'admin',
                category: 'admin_sent',
                title,
                body,
                priority,
              });
            }).catch(() => {})
          )
        );
      }
    }

    get().logActivity('إرسال إشعار', target, targetId || undefined, title);
  },

  // ===== Stats =====
  getStats: () => {
    const state = get();
    return {
      totalUsers: state.users.length,
      activeUsers: state.users.filter(u => u.status === 'active').length,
      bannedUsers: state.users.filter(u => u.status === 'banned').length,
      totalStores: state.stores.length,
      verifiedStores: state.stores.filter(s => s.isVerified).length,
      featuredStores: state.stores.filter(s => s.isFeatured).length,
      totalProducts: state.products.length,
      featuredProducts: state.products.filter(p => p.isFeatured).length,
      totalOffers: state.offers.filter(o => o.type === 'offer').length,
      activeOffers: state.offers.filter(o => o.type === 'offer' && o.status === 'active').length,
      totalContests: state.offers.filter(o => o.type === 'contest').length,
      newReports: state.reports.filter(r => r.status === 'new').length,
      pendingPointOrders: state.pointOrders.filter(o => o.status === 'pending').length,
      pendingVerifications: state.verifications.filter(v => v.status === 'pending').length,
    };
  },
}));
