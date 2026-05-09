import { create } from 'zustand';
import { apiGet, apiPost, apiPut } from '@/lib/fetchApi';
import {
  type VerificationTier,
  VERIFICATION_PLANS,
  getPlan,
  getDurationOptions,
} from '@/lib/constants';

// ===== TYPES =====
export interface VerificationData {
  storeId: string;
  userId: string;
  storeName: string;
  tier: VerificationTier;
  isActive: boolean;
  startDate: string | null;
  endDate: string | null;
  grantedBy: string | null;
  chatEnabled: boolean;
}

interface DailyUsage {
  date: string;
  productsCreated: number;
  storeEdits: number;
  featuredProducts: number;
  offersCreated: number;
  contestsCreated: number;
  settingsChanges: number;
}

export interface ActivityLogEntry {
  id: string;
  action: string;
  storeId: string;
  storeName: string;
  details: string;
  createdAt: string;
  performedBy: string | null;
}

export interface LimitsConfig {
  maxProductsPerMonth: number;
  maxOffersPerMonth: number;
  maxContestsPerMonth: number;
  maxFeaturedProductsPerMonth: number;
  maxStoreEditsPerWeek: number;
  maxSettingsChangesPerMonth: number;
  maxDurationDays: number;
  autoPinned: boolean;
}

// ===== LEGACY COMPAT (re-exported for any remaining imports) =====
export const UNVERIFIED_LIMITS: LimitsConfig = VERIFICATION_PLANS[0].limits;
export const VERIFIED_LIMITS: LimitsConfig = VERIFICATION_PLANS[1].limits;
export const UNVERIFIED_DURATION_OPTIONS: number[] = getDurationOptions('unverified');
export const VERIFIED_DURATION_OPTIONS: number[] = getDurationOptions('diamond');

const DAILY_USAGE_STORAGE_KEY = 'app_verification_daily_usage';

// ===== HELPERS =====
function getTodayKey(): string {
  return new Date().toISOString().split('T')[0];
}

function getWeekStart(): Date {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const start = new Date(now.setDate(diff));
  start.setHours(0, 0, 0, 0);
  return start;
}

function getMonthStart(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
}

// ===== STORE INTERFACE =====
interface VerificationState {
  verifications: Record<string, VerificationData>;
  dailyUsage: Record<string, DailyUsage[]>;
  activityLog: ActivityLogEntry[];
  initialized: boolean;
  loading: boolean;
  error: string | null;

  // Core
  initialize: () => Promise<void>;
  loadStoreVerification: (_storeId: string) => Promise<void>;
  clearError: () => void;

  // Verification Status (client-side computed from local state)
  isStoreVerified: (_storeId: string) => boolean;

  // Chat availability (verified + chat_enabled)
  canStoreChat: (_storeId: string) => boolean;

  // Tier
  getStoreTier: (_storeId: string) => VerificationTier;

  // Limits
  getLimits: (_storeId: string) => LimitsConfig;

  // Duration
  getDurationOptionsForStore: (_storeId: string) => number[];

  // Usage Stats
  _getDailyUsage: (_storeId: string) => DailyUsage;
  _getMonthlyUsage: (_storeId: string) => { products: number; offers: number; contests: number; featured: number; settingsChanges: number };
  _updateDailyUsage: (_storeId: string, _updater: (_day: DailyUsage) => void) => void;
  getWeeklyEdits: (_storeId: string) => number;

  // Permission Checks (client-side computed)
  canCreateProduct: (_storeId: string) => { allowed: boolean; message: string };
  canEditStore: (_storeId: string) => { allowed: boolean; message: string; nextAvailableDate?: string };
  canCreateOffer: (_storeId: string, _offerType: 'offer' | 'contest') => { allowed: boolean; message: string };
  canUseDuration: (_storeId: string, _days: number) => boolean;
  canToggleFeaturedStore: (_storeId: string) => { allowed: boolean; message: string };
  canToggleFeaturedProduct: (_storeId: string) => { allowed: boolean; message: string };
  canUseSettings: (_storeId: string) => { allowed: boolean; message: string };

  // Record Actions (in-memory daily usage)
  recordProductCreation: (_storeId: string, _storeName: string) => void;
  recordStoreEdit: (_storeId: string, _storeName: string) => void;
  recordOfferCreation: (_storeId: string, _storeName: string, _offerType: 'offer' | 'contest') => void;
  recordFeaturedProduct: (_storeId: string, _storeName: string) => void;
  recordSettingsChange: (_storeId: string, _storeName: string) => void;
  recordLimitReached: (_storeId: string, _storeName: string, _action: string) => void;

  // Admin Actions (via API)
  fetchVerifications: () => Promise<void>;
  grantVerification: (_storeId: string, _userId: string, _storeName: string, _adminEmail: string, _tier?: VerificationTier) => Promise<void>;
  extendVerification: (_storeId: string, _adminEmail: string, _days: number) => Promise<void>;
  revokeVerification: (_storeId: string, _adminEmail: string) => Promise<void>;

  // Admin Queries
  getAllVerifications: () => VerificationData[];
}

export const useVerificationStore = create<VerificationState>((set, get) => ({
  verifications: {},
  dailyUsage: {},
  activityLog: [],
  initialized: false,
  loading: false,
  error: null,

  initialize: async () => {
    if (typeof window === 'undefined') return;
    if (get().initialized) return;
    try {
      // Load persisted daily usage from localStorage
      try {
        const savedUsage = localStorage.getItem(DAILY_USAGE_STORAGE_KEY);
        if (savedUsage) {
          const parsed = JSON.parse(savedUsage);
          // Migrate old entries that don't have settingsChanges
          for (const storeId of Object.keys(parsed)) {
            for (const day of parsed[storeId]) {
              if (day.settingsChanges === undefined) {
                day.settingsChanges = 0;
              }
            }
          }
          set({ dailyUsage: parsed });
        }
      } catch (e) { console.error('[verificationStore] localStorage parse failed:', e); }
      set({ initialized: true });
    } catch (e) {
      console.error('[verificationStore] initialize failed:', e);
      set({ initialized: true });
    }
  },

  loadStoreVerification: async (storeId: string) => {
    try {
      const { data, error: apiError } = await apiGet<{ verification: VerificationData | null; chatEnabled?: boolean }>(`/api/verification?storeId=${storeId}`);
      if (apiError) {
        console.error('[verificationStore] loadStoreVerification API error:', apiError);
        return;
      }
      const verifications = { ...get().verifications };
      if (data!.verification) {
        // If the verification record exists but has expired, mark isActive=false
        // locally so isStoreVerified() returns the correct value even when the
        // server-side is_active column hasn't been reset yet.
        const ver = data!.verification;
        if (ver.isActive && ver.endDate && new Date(ver.endDate) <= new Date()) {
          ver.isActive = false;
        }
        // Ensure chatEnabled is populated (from API response)
        if (ver.chatEnabled === undefined) {
          ver.chatEnabled = data!.chatEnabled ?? false;
        }
        verifications[storeId] = ver;
      } else {
        // No verification record — still store chatEnabled so canStoreChat works
        // (it will return false since isVerified is false, but chatEnabled is
        // available for other consumers)
        verifications[storeId] = {
          storeId,
          userId: '',
          storeName: '',
          tier: 'unverified',
          isActive: false,
          startDate: null,
          endDate: null,
          grantedBy: null,
          chatEnabled: data!.chatEnabled ?? false,
        };
      }
      set({ verifications });
    } catch (e) {
      console.error('[verificationStore] loadStoreVerification failed:', e);
    }
  },

  clearError: () => set({ error: null }),

  // ===== VERIFICATION STATUS (client-side computed) =====

  isStoreVerified: (storeId) => {
    const ver = get().verifications[storeId];
    if (!ver || !ver.isActive || !ver.endDate) return false;
    return new Date(ver.endDate) > new Date();
  },

  canStoreChat: (storeId) => {
    const ver = get().verifications[storeId];
    if (!ver) return false;
    // Store must be verified AND have chat enabled
    const isVerified = ver.isActive && ver.endDate && new Date(ver.endDate) > new Date();
    return isVerified && ver.chatEnabled;
  },

  getStoreTier: (storeId) => {
    const ver = get().verifications[storeId];
    if (!ver || !ver.isActive || !ver.endDate) return 'unverified';
    if (new Date(ver.endDate) <= new Date()) return 'unverified';
    return ver.tier || 'bronze';
  },

  getLimits: (storeId) => {
    const tier = get().getStoreTier(storeId);
    const plan = getPlan(tier);
    return plan.limits;
  },

  getDurationOptionsForStore: (storeId) => {
    const tier = get().getStoreTier(storeId);
    return getDurationOptions(tier);
  },

  _getDailyUsage: (storeId) => {
    const todayKey = getTodayKey();
    const allDays = get().dailyUsage[storeId] || [];
    const today = allDays.find(d => d.date === todayKey);
    return today || {
      date: todayKey,
      productsCreated: 0,
      storeEdits: 0,
      featuredProducts: 0,
      offersCreated: 0,
      contestsCreated: 0,
      settingsChanges: 0,
    };
  },

  _getMonthlyUsage: (storeId) => {
    const monthStart = getMonthStart();
    const allDays = get().dailyUsage[storeId] || [];
    return allDays
      .filter(d => d.date >= monthStart)
      .reduce((acc, d) => ({
        products: acc.products + d.productsCreated,
        offers: acc.offers + d.offersCreated,
        contests: acc.contests + d.contestsCreated,
        featured: acc.featured + d.featuredProducts,
        settingsChanges: acc.settingsChanges + (d.settingsChanges || 0),
      }), { products: 0, offers: 0, contests: 0, featured: 0, settingsChanges: 0 });
  },

  getWeeklyEdits: (storeId) => {
    const weekStart = getWeekStart();
    const allDays = get().dailyUsage[storeId] || [];
    return allDays
      .filter(d => new Date(d.date) >= weekStart)
      .reduce((acc, d) => acc + d.storeEdits, 0);
  },

  // ===== PERMISSION CHECKS =====

  canCreateProduct: (storeId) => {
    const limits = get().getLimits(storeId);
    const monthly = get()._getMonthlyUsage(storeId);
    if (monthly.products >= limits.maxProductsPerMonth) {
      return {
        allowed: false,
        message: `وصلت للحد الأقصى لإنشاء المنتجات هذا الشهر (${limits.maxProductsPerMonth}). قم بالترقية أو حاول الشهر القادم.`,
      };
    }
    return { allowed: true, message: '' };
  },

  canEditStore: (storeId) => {
    const tier = get().getStoreTier(storeId);
    const limits = get().getLimits(storeId);

    if (tier === 'unverified') {
      // Unverified: 1 edit per month
      const monthStart = getMonthStart();
      const allDays = get().dailyUsage[storeId] || [];
      const editsThisMonth = allDays
        .filter(d => d.date >= monthStart)
        .reduce((acc, d) => acc + d.storeEdits, 0);

      if (editsThisMonth >= 1) {
        const nextMonth = new Date();
        nextMonth.setMonth(nextMonth.getMonth() + 1, 1);
        nextMonth.setHours(0, 0, 0, 0);
        return {
          allowed: false,
          message: `يمكنك تعديل المتجر مرة واحدة شهرياً فقط. حاول بعد ${nextMonth.toLocaleDateString('ar-SY')}.`,
          nextAvailableDate: nextMonth.toISOString(),
        };
      }
      return { allowed: true, message: '' };
    } else {
      // Verified tiers: weekly edit limit
      const weeklyEdits = get().getWeeklyEdits(storeId);
      if (weeklyEdits >= limits.maxStoreEditsPerWeek) {
        const nextWeek = new Date(getWeekStart());
        nextWeek.setDate(nextWeek.getDate() + 7);
        return {
          allowed: false,
          message: `وصلت للحد الأقصى لتعديل المتجر هذا الأسبوع (${limits.maxStoreEditsPerWeek}). حاول بعد ${nextWeek.toLocaleDateString('ar-SY')}.`,
          nextAvailableDate: nextWeek.toISOString(),
        };
      }
      return { allowed: true, message: '' };
    }
  },

  canCreateOffer: (storeId, offerType) => {
    const limits = get().getLimits(storeId);
    const monthly = get()._getMonthlyUsage(storeId);

    if (offerType === 'offer') {
      if (limits.maxOffersPerMonth === 0) {
        return { allowed: false, message: 'لا يمكنك إنشاء عروض. قم بالترقية إلى خطة موثّقة.' };
      }
      if (monthly.offers >= limits.maxOffersPerMonth) {
        return { allowed: false, message: `وصلت للحد الأقصى لإنشاء العروض هذا الشهر (${limits.maxOffersPerMonth}).` };
      }
    }
    if (offerType === 'contest') {
      if (limits.maxContestsPerMonth === 0) {
        return { allowed: false, message: 'لا يمكنك إنشاء مسابقات. قم بالترقية إلى خطة موثّقة.' };
      }
      if (monthly.contests >= limits.maxContestsPerMonth) {
        return { allowed: false, message: `وصلت للحد الأقصى لإنشاء المسابقات هذا الشهر (${limits.maxContestsPerMonth}).` };
      }
    }
    return { allowed: true, message: '' };
  },

  canUseDuration: (storeId, days) => {
    const limits = get().getLimits(storeId);
    return days <= limits.maxDurationDays;
  },

  canToggleFeaturedStore: (storeId) => {
    const tier = get().getStoreTier(storeId);
    if (tier === 'unverified') {
      return { allowed: false, message: 'لا يمكن تمييز المتجر. قم بالترقية إلى خطة موثّقة أولاً.' };
    }
    return { allowed: true, message: '' };
  },

  canToggleFeaturedProduct: (storeId) => {
    const limits = get().getLimits(storeId);
    const tier = get().getStoreTier(storeId);
    if (tier === 'unverified') {
      return { allowed: false, message: 'لا يمكن تمييز المنتج. قم بالترقية إلى خطة موثّقة أولاً.' };
    }
    const monthly = get()._getMonthlyUsage(storeId);
    if (monthly.featured >= limits.maxFeaturedProductsPerMonth) {
      return { allowed: false, message: `وصلت للحد الأقصى للمنتجات المميزة هذا الشهر (${limits.maxFeaturedProductsPerMonth}).` };
    }
    return { allowed: true, message: '' };
  },

  canUseSettings: (storeId) => {
    const limits = get().getLimits(storeId);
    const tier = get().getStoreTier(storeId);
    if (tier === 'unverified') {
      return { allowed: false, message: 'لا يمكنك استخدام إعدادات المتجر. قم بالترقية إلى خطة موثّقة.' };
    }
    const monthly = get()._getMonthlyUsage(storeId);
    if ((monthly.settingsChanges || 0) >= limits.maxSettingsChangesPerMonth) {
      return { allowed: false, message: `وصلت للحد الأقصى لتغيير الإعدادات هذا الشهر (${limits.maxSettingsChangesPerMonth}).` };
    }
    return { allowed: true, message: '' };
  },

  // ===== RECORD ACTIONS (in-memory daily usage — resets on refresh) =====

  recordProductCreation: (storeId, _storeName) => {
    get()._updateDailyUsage(storeId, (d) => { d.productsCreated += 1; });
  },

  recordStoreEdit: (storeId, _storeName) => {
    get()._updateDailyUsage(storeId, (d) => { d.storeEdits += 1; });
  },

  recordOfferCreation: (storeId, _storeName, offerType) => {
    get()._updateDailyUsage(storeId, (d) => {
      if (offerType === 'offer') d.offersCreated += 1;
      else d.contestsCreated += 1;
    });
  },

  recordFeaturedProduct: (storeId, _storeName) => {
    get()._updateDailyUsage(storeId, (d) => { d.featuredProducts += 1; });
  },

  recordSettingsChange: (storeId, _storeName) => {
    get()._updateDailyUsage(storeId, (d) => { d.settingsChanges = (d.settingsChanges || 0) + 1; });
  },

  recordLimitReached: (_storeId, _storeName, _action) => {
    // No-op — limit tracking is ephemeral (in-memory only)
  },

  // ===== ADMIN ACTIONS (via API) =====

  fetchVerifications: async () => {
    try {
      set({ loading: true, error: null });
      const { data, error: apiError } = await apiGet<{ verifications: VerificationData[]; activityLog?: ActivityLogEntry[] }>('/api/admin/verifications');
      if (apiError) throw new Error('Failed to fetch verifications');

      const verifications: Record<string, VerificationData> = {};
      for (const v of (data!.verifications || [])) {
        verifications[v.storeId] = v;
      }
      set({ verifications, activityLog: data!.activityLog || [], loading: false });
    } catch (e) {
      console.error('[verificationStore] fetchVerifications failed:', e);
      set({ loading: false, error: 'فشل جلب بيانات التوثيق' });
    }
  },

  grantVerification: async (storeId, userId, storeName, adminEmail, tier = 'bronze') => {
    try {
      set({ loading: true, error: null });
      const { data, error: apiError } = await apiPost<{ verification: VerificationData }>('/api/admin/verifications', { storeId, userId, storeName, adminEmail, tier });
      if (apiError) throw new Error('Failed to grant verification');
      const verifications = { ...get().verifications };
      verifications[storeId] = data!.verification;
      set({ verifications, loading: false });
    } catch (e) {
      console.error('[verificationStore] grantVerification failed:', e);
      set({ loading: false, error: 'فشل منح التوثيق' });
    }
  },

  extendVerification: async (storeId, adminEmail, days) => {
    try {
      set({ loading: true, error: null });
      const { data, error: apiError } = await apiPut<{ verification: VerificationData }>('/api/admin/verifications', { storeId, adminEmail, action: 'extend', days });
      if (apiError) throw new Error('Failed to extend verification');
      const verifications = { ...get().verifications };
      verifications[storeId] = data!.verification;
      set({ verifications, loading: false });
    } catch (e) {
      console.error('[verificationStore] extendVerification failed:', e);
      set({ loading: false, error: 'فشل تمديد التوثيق' });
    }
  },

  revokeVerification: async (storeId, adminEmail) => {
    try {
      set({ loading: true, error: null });
      const { data, error: apiError } = await apiPut<{ verification: VerificationData }>('/api/admin/verifications', { storeId, adminEmail, action: 'revoke' });
      if (apiError) throw new Error('Failed to revoke verification');
      const verifications = { ...get().verifications };
      verifications[storeId] = data!.verification;
      set({ verifications, loading: false });
    } catch (e) {
      console.error('[verificationStore] revokeVerification failed:', e);
      set({ loading: false, error: 'فشل إلغاء التوثيق' });
    }
  },

  // ===== ADMIN QUERIES =====

  getAllVerifications: () => {
    return Object.values(get().verifications);
  },

  // ===== INTERNAL HELPERS =====

  _updateDailyUsage: (storeId, updater: (_day: DailyUsage) => void) => {
    const todayKey = getTodayKey();
    const allDays = [...(get().dailyUsage[storeId] || [])];
    let todayEntry = allDays.find(d => d.date === todayKey);
    if (!todayEntry) {
      todayEntry = {
        date: todayKey,
        productsCreated: 0,
        storeEdits: 0,
        featuredProducts: 0,
        offersCreated: 0,
        contestsCreated: 0,
        settingsChanges: 0,
      };
      allDays.unshift(todayEntry);
    }
    updater(todayEntry);

    // Keep only last 60 days of usage data
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
    const filteredDays = allDays.filter(d => new Date(d.date) >= sixtyDaysAgo);

    const dailyUsage = { ...get().dailyUsage, [storeId]: filteredDays };
    set({ dailyUsage });

    // Persist to localStorage so usage survives refreshes
    try {
      localStorage.setItem(DAILY_USAGE_STORAGE_KEY, JSON.stringify(dailyUsage));
    } catch (e) { console.error('[verificationStore] localStorage write failed:', e); }
  },
}));
