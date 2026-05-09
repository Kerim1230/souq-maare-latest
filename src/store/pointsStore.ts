import { create } from 'zustand';
// Note: VERIFICATION_COST and VERIFICATION_DAYS are used in WalletScreen/VerificationScreen
// pointsStore provides the deductPoints/addPoints API but does not directly use verification constants
import { apiGet, apiPost, apiPut } from '@/lib/fetchApi';
import { isHydrated, markHydrated } from '@/lib/hydration';

// ===== TYPES =====
export type TransactionType = 'purchase' | 'verification_deduct' | 'admin_add' | 'admin_reject' | 'refund';
export type OrderStatus = 'pending' | 'approved' | 'rejected';

export interface Transaction {
  id: string;
  userId: string;
  type: TransactionType;
  amount: number;
  description: string;
  createdAt: string;
  relatedOrderId?: string;
}

export interface PointOrder {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  points: number;
  amount: number;
  paymentCode: string;
  receiptImage: string | null;
  status: OrderStatus;
  rejectionReason?: string;
  createdAt: string;
  reviewedAt?: string;
}

export interface Wallet {
  userId: string;
  balance: number;
  totalUsed: number;
  totalPurchased: number;
}

export interface ShamCashSettings {
  recipientName: string;
  accountNumber: string;
  qrImage: string;
  pointPrice: number;
  purchaseEnabled: boolean;
  minPoints: number;
  maxPoints: number;
}

// ===== DEFAULT SETTINGS (in-memory UI preference) =====
const DEFAULT_SHAM_CASH: ShamCashSettings = {
  recipientName: 'سوق مارع',
  accountNumber: '0961234567',
  qrImage: '',
  pointPrice: 1,
  purchaseEnabled: true,
  minPoints: 100,
  maxPoints: 100000,
};

const SHAMCASH_STORAGE_KEY = 'app_shamcash_settings';

// ===== FetchWallet Result Type =====
export interface FetchWalletResult {
  ok: boolean;
  reason?: 'in-flight' | 'auth' | 'network';
}

// ===== STORE INTERFACE =====
interface PointsState {
  // Core Data
  wallets: Record<string, Wallet>;
  orders: PointOrder[];
  transactions: Transaction[];
  shamCashSettings: ShamCashSettings;
  loadingOps: Set<string>;
  error: string | null;

  // Actions
  initialize: (_userId?: string) => void;
  clearError: () => void;

  // Wallet
  fetchWallet: (_userId: string) => Promise<FetchWalletResult>;
  /** Force-refresh wallet, bypassing the in-flight dedup guard.
   *  Use after mutations (verification purchase, etc.) to guarantee the
   *  latest balance is fetched, even if a regular fetchWallet is in-flight. */
  forceRefreshWallet: (_userId: string) => Promise<FetchWalletResult>;
  addPoints: (_userId: string, _amount: number, _description: string, _type: TransactionType) => Promise<void>;
  deductPoints: (_userId: string, _amount: number, _description: string, _type: TransactionType) => Promise<void>;

  // Orders
  fetchOrders: () => Promise<void>;
  createOrder: (_userId: string, _userName: string, _userEmail: string, _points: number, _paymentCode: string, _receiptImage: string | null) => Promise<PointOrder | null>;
  getOrders: () => PointOrder[];
  approveOrder: (_orderId: string) => Promise<void>;
  rejectOrder: (_orderId: string, _reason: string) => Promise<void>;

  // Admin Settings (in-memory only)
  getAdminSettings: () => ShamCashSettings;
  updateAdminSettings: (_settings: Partial<ShamCashSettings>) => void;
}

export const usePointsStore = create<PointsState>((set, get) => ({
  wallets: {},
  orders: [],
  transactions: [],
  shamCashSettings: DEFAULT_SHAM_CASH,
  loadingOps: new Set<string>(),
  error: null,

  initialize: (userId) => {
    if (typeof window === 'undefined') return;
    if (isHydrated('wallet')) return;
    markHydrated('wallet');

    // Load persisted ShamCash settings from localStorage
    try {
      const savedShamCash = localStorage.getItem(SHAMCASH_STORAGE_KEY);
      if (savedShamCash) {
        const parsed = JSON.parse(savedShamCash);
        set({ shamCashSettings: { ...DEFAULT_SHAM_CASH, ...parsed } });
      }
    } catch { /* localStorage parse failed — use defaults */ }
    apiGet<{ settings: Partial<ShamCashSettings> }>('/api/payment-settings')
      .then(({ data }) => {
        if (data?.settings) {
          const server = data.settings;
          const merged = { ...get().shamCashSettings, ...server };
          set({ shamCashSettings: merged });
          try { localStorage.setItem(SHAMCASH_STORAGE_KEY, JSON.stringify(merged)); } catch { /* localStorage write failed — non-critical */ }
        }
      })
      .catch(() => { /* non-critical: localStorage values are used as fallback */ });

    // Fetch wallet balance if userId is provided
    if (userId) {
      get().fetchWallet(userId);
    }
  },

  clearError: () => set({ error: null }),

  // ===== WALLET (Production Smart Fetch) =====

  fetchWallet: async (userId) => {
    const op = 'wallet';
    const state = get();

    // 🛑 Guard: prevent duplicate in-flight requests
    if (state.loadingOps.has(op)) {
      console.debug('[pointsStore] SKIP duplicate fetchWallet (in-flight)');
      return { ok: false, reason: 'in-flight' };
    }

    try {
      set({ loadingOps: new Set(state.loadingOps).add(op), error: null });

      const { data, error: apiError, status } = await apiGet<{ wallet: Wallet; transaction?: Transaction; transactions?: Transaction[] }>('/api/points');

      // 🔴 Auth errors → stop polling completely
      if (status === 401 || status === 403) {
        console.warn(`[pointsStore] AUTH ERROR (status=${status}) — stop polling`);
        const ops = new Set(get().loadingOps);
        ops.delete(op);
        set({ loadingOps: ops, error: 'AUTH_ERROR' });
        return { ok: false, reason: 'auth' };
      }

      if (apiError || !data) {
        throw new Error('API_ERROR');
      }

      const currentWallet = get().wallets[userId];
      const newWallet = data.wallet;

      // 🧠 Skip state update if nothing changed (prevents render storm)
      if (
        currentWallet &&
        currentWallet.balance === newWallet.balance &&
        currentWallet.totalUsed === newWallet.totalUsed &&
        currentWallet.totalPurchased === newWallet.totalPurchased
      ) {
        console.debug(`[pointsStore] NO CHANGE — skip set (balance=${newWallet.balance})`);
      } else {
        const wallets = { ...get().wallets, [userId]: newWallet };
        console.debug(`[pointsStore] UPDATED userId=${userId} balance=${newWallet.balance}`);

        // ✅ Merge transactions safely (avoid wiping other users' data)
        const newTxs = [data.transaction, ...(data.transactions || [])].filter(Boolean) as Transaction[];
        const existingIds = new Set(get().transactions.map(t => t.id));
        const mergedTxs = [...newTxs.filter(t => !existingIds.has(t.id)), ...get().transactions].slice(0, 200);

        set({ wallets, transactions: mergedTxs });
        markHydrated('wallet');
      }

      return { ok: true };
    } catch (err) {
      console.warn(`[pointsStore] fetchWallet FAILED userId=${userId}`, err);
      set({ error: 'NETWORK_ERROR' });
      return { ok: false, reason: 'network' };
    } finally {
      const ops = new Set(get().loadingOps);
      ops.delete(op);
      set({ loadingOps: ops });
    }
  },

  // Force-refresh wallet — bypasses the in-flight dedup guard.
  // Use after server-side mutations (verification purchase, point deduction)
  // to guarantee the latest balance is reflected in the UI.
  forceRefreshWallet: async (userId) => {
    const op = 'wallet-force';
    try {
      set({ loadingOps: new Set(get().loadingOps).add(op), error: null });

      const { data, error: apiError, status } = await apiGet<{ wallet: Wallet; transaction?: Transaction; transactions?: Transaction[] }>('/api/points');

      if (status === 401 || status === 403) {
        const ops = new Set(get().loadingOps);
        ops.delete(op);
        set({ loadingOps: ops, error: 'AUTH_ERROR' });
        return { ok: false, reason: 'auth' };
      }

      if (apiError || !data) {
        throw new Error('API_ERROR');
      }

      const newWallet = data.wallet;
      const wallets = { ...get().wallets, [userId]: newWallet };
      console.log(`[pointsStore] FORCE REFRESH userId=${userId} balance=${newWallet.balance}`);

      const newTxs = [data.transaction, ...(data.transactions || [])].filter(Boolean) as Transaction[];
      const existingIds = new Set(get().transactions.map(t => t.id));
      const mergedTxs = [...newTxs.filter(t => !existingIds.has(t.id)), ...get().transactions].slice(0, 200);

      set({ wallets, transactions: mergedTxs });
      markHydrated('wallet');

      return { ok: true };
    } catch (err) {
      console.warn(`[pointsStore] forceRefreshWallet FAILED userId=${userId}`, err);
      return { ok: false, reason: 'network' };
    } finally {
      const ops = new Set(get().loadingOps);
      ops.delete(op);
      set({ loadingOps: ops });
    }
  },

  addPoints: async (userId, amount, description, type) => {
    const op = 'addPoints';
    try {
      set({ loadingOps: new Set(get().loadingOps).add(op), error: null });
      const { data, error: apiError } = await apiPost<{ wallet: Wallet; transaction?: Transaction }>('/api/points/wallet', { userId, amount, description, type });
      if (apiError) throw new Error('Failed to add points');

      // Update local state
      const wallets = { ...get().wallets };
      wallets[userId] = data!.wallet;
      const transactions: Transaction[] = [data!.transaction, ...get().transactions].filter((t): t is Transaction => Boolean(t)).slice(0, 100);
      const ops = new Set(get().loadingOps);
      ops.delete(op);
      set({ wallets, transactions, loadingOps: ops });

      // Delegate notification to notificationStore (canonical)
      if (amount >= 100) {
        import('@/store/notificationStore').then(({ useNotificationStore }) => {
          useNotificationStore.getState().createNotification({
            userId,
            type: 'points',
            category: type === 'admin_add' ? 'points_approved' : 'points_earned',
            title: 'تم إضافة نقاط 💰',
            body: `تم إضافة ${amount.toLocaleString('ar-SY')} نقطة إلى محفظتك. رصيدك الحالي: ${data!.wallet.balance.toLocaleString('ar-SY')} نقطة.`,
            icon: 'Coins',
            priority: amount >= 1000 ? 'high' : 'medium',
            deepLink: '/wallet',
            data: { amount, newBalance: data!.wallet.balance, transactionType: type },
          });
        }).catch(() => { /* notification store not available */ });
      }
    } catch {
      const ops = new Set(get().loadingOps);
      ops.delete(op);
      set({ loadingOps: ops, error: 'فشل إضافة النقاط' });
    }
  },

  deductPoints: async (userId, amount, description, type) => {
    const op = 'deductPoints';
    try {
      set({ loadingOps: new Set(get().loadingOps).add(op), error: null });
      const { data, error: apiError } = await apiPost<{ wallet: Wallet; transaction?: Transaction }>('/api/points/wallet', { userId, amount: -amount, description, type });
      if (apiError) throw new Error('Failed to deduct points');

      // Update local state
      const wallets = { ...get().wallets };
      wallets[userId] = data!.wallet;
      const transactions: Transaction[] = [data!.transaction, ...get().transactions].filter((t): t is Transaction => Boolean(t)).slice(0, 100);
      const ops = new Set(get().loadingOps);
      ops.delete(op);
      set({ wallets, transactions, loadingOps: ops });

      // Delegate notification to notificationStore (canonical)
      if (amount >= 50) {
        import('@/store/notificationStore').then(({ useNotificationStore }) => {
          useNotificationStore.getState().createNotification({
            userId,
            type: 'points',
            category: type === 'verification_deduct' ? 'verification_purchase' : 'points_spent',
            title: type === 'verification_deduct' ? 'تم خصم نقاط للتوثيق 🛡️' : 'تم خصم نقاط',
            body: `تم خصم ${amount.toLocaleString('ar-SY')} نقطة من محفظتك (${description}). رصيدك المتبقي: ${data!.wallet.balance.toLocaleString('ar-SY')} نقطة.`,
            icon: 'Coins',
            priority: amount >= 500 ? 'high' : 'medium',
            deepLink: '/wallet',
            data: { amount: -amount, newBalance: data!.wallet.balance, transactionType: type, description },
          });
        }).catch(() => { /* notification store not available */ });
      }
    } catch {
      const ops = new Set(get().loadingOps);
      ops.delete(op);
      set({ loadingOps: ops, error: 'فشل خصم النقاط' });
    }
  },

  // ===== ORDERS =====

  fetchOrders: async () => {
    const op = 'orders';
    try {
      set({ loadingOps: new Set(get().loadingOps).add(op), error: null });
      const { data, error: apiError } = await apiGet<{ orders: PointOrder[] }>('/api/points/order');
      if (apiError) throw new Error('Failed to fetch orders');
      const ops = new Set(get().loadingOps);
      ops.delete(op);
      set({ orders: data!.orders || [], loadingOps: ops });
    } catch {
      const ops = new Set(get().loadingOps);
      ops.delete(op);
      set({ loadingOps: ops, error: 'فشل جلب الطلبات' });
    }
  },

  createOrder: async (userId, userName, userEmail, points, paymentCode, receiptImage) => {
    const op = 'createOrder';
    try {
      set({ loadingOps: new Set(get().loadingOps).add(op), error: null });
      const { data, error: apiError } = await apiPost<{ order: PointOrder }>('/api/points/order', {
        userId, userName, userEmail, points, paymentCode, receiptImage,
        pointPrice: get().shamCashSettings.pointPrice,
      });
      if (apiError) throw new Error('Failed to create order');
      const orders = [data!.order, ...get().orders];
      const ops = new Set(get().loadingOps);
      ops.delete(op);
      set({ orders, loadingOps: ops });
      return data!.order;
    } catch {
      const ops = new Set(get().loadingOps);
      ops.delete(op);
      set({ loadingOps: ops, error: 'فشل إنشاء الطلب' });
      return null;
    }
  },

  getOrders: () => get().orders,

  approveOrder: async (orderId) => {
    const op = 'approveOrder';
    try {
      set({ loadingOps: new Set(get().loadingOps).add(op), error: null });
      const { data, error: apiError } = await apiPut<{ order: PointOrder }>('/api/points/order', { orderId, status: 'approved' });
      if (apiError) throw new Error('Failed to approve order');

      const orders = get().orders.map(o =>
        o.id === orderId ? { ...o, status: 'approved' as OrderStatus, reviewedAt: new Date().toISOString() } : o
      );
      const ops = new Set(get().loadingOps);
      ops.delete(op);
      set({ orders, loadingOps: ops });

      // Refresh wallet for the user
      const order = data!.order;
      if (order) {
        get().fetchWallet(order.userId);
      }

      // Send notification via notificationStore (canonical)
      import('@/store/notificationStore').then(({ useNotificationStore }) => {
        useNotificationStore.getState().createNotification({
          userId: order.userId,
          type: 'admin',
          category: 'points_approved',
          title: 'تم قبول طلب شراء النقاط ✅',
          body: `تم إضافة ${order.points.toLocaleString('ar-SY')} نقطة إلى محفظتك بنجاح!`,
          icon: 'check',
          priority: 'high',
          deepLink: '/wallet',
        });
      }).catch(() => {});
    } catch {
      const ops = new Set(get().loadingOps);
      ops.delete(op);
      set({ loadingOps: ops, error: 'فشل قبول الطلب' });
    }
  },

  rejectOrder: async (orderId, reason) => {
    const op = 'rejectOrder';
    try {
      set({ loadingOps: new Set(get().loadingOps).add(op), error: null });
      const { data, error: apiError } = await apiPut<{ order: PointOrder }>('/api/points/order', { orderId, status: 'rejected', rejectionReason: reason });
      if (apiError) throw new Error('Failed to reject order');

      const orders = get().orders.map(o =>
        o.id === orderId ? { ...o, status: 'rejected' as OrderStatus, rejectionReason: reason, reviewedAt: new Date().toISOString() } : o
      );
      const transactions = [data!.order ? {
        id: `rej_${Date.now()}`,
        userId: data!.order.userId,
        type: 'admin_reject' as TransactionType,
        amount: 0,
        description: `تم رفض طلب شراء ${data!.order.points.toLocaleString('ar-SY')} نقطة - ${reason || 'بدون سبب'}`,
        createdAt: new Date().toISOString(),
        relatedOrderId: orderId,
      } : null, ...get().transactions].filter(Boolean) as Transaction[];
      const ops = new Set(get().loadingOps);
      ops.delete(op);
      set({ orders, transactions, loadingOps: ops });

      // Send notification via notificationStore (canonical)
      const order = data!.order;
      if (order) {
        import('@/store/notificationStore').then(({ useNotificationStore }) => {
          useNotificationStore.getState().createNotification({
            userId: order.userId,
            type: 'admin',
            category: 'points_rejected',
            title: 'تم رفض طلب شراء النقاط ❌',
            body: reason || 'تم رفض طلبك. يمكنك المحاولة مرة أخرى.',
            icon: 'error',
            priority: 'high',
            deepLink: '/purchase-points',
          });
        }).catch(() => {});
      }
    } catch {
      const ops = new Set(get().loadingOps);
      ops.delete(op);
      set({ loadingOps: ops, error: 'فشل رفض الطلب' });
    }
  },

  // ===== TRANSACTIONS =====

  // ===== ADMIN SETTINGS (in-memory only — UI preference) =====

  getAdminSettings: () => get().shamCashSettings,

  updateAdminSettings: (settings) => {
    const merged = { ...get().shamCashSettings, ...settings };
    set({ shamCashSettings: merged });
    try { localStorage.setItem(SHAMCASH_STORAGE_KEY, JSON.stringify(merged)); } catch { /* localStorage write failed — non-critical */ }
  },
}));

// ===== RATE LIMITER (delegated to @/lib/rate-limit) =====

export { canSubmit, checkSubmitCooldown } from '@/lib/rate-limit';

