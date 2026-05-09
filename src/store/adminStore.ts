import { create } from 'zustand';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/fetchApi';

// ===== TYPES =====
export type ReportTargetType = 'product' | 'store' | 'offer' | 'user' | 'contest';
type ReportStatus = 'new' | 'reviewing' | 'action_taken' | 'closed';
type BanDuration = '1d' | '3d' | '7d' | '15d' | '30d' | 'permanent';
type BanType = 'login' | 'post' | 'edit' | 'message' | 'full';

interface Report {
  id: string;
  targetId: string;
  targetType: ReportTargetType;
  targetName: string;
  reporterId: string;
  reporterName: string;
  reporterEmail: string;
  reason: string;
  description: string;
  images: string[];
  status: ReportStatus;
  adminNote?: string;
  actionTaken?: string;
  createdAt: string;
  reviewedAt?: string;
}

interface UserBan {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  banType: BanType;
  duration: BanDuration;
  reason: string;
  createdAt: string;
  expiresAt: string;
  isActive: boolean;
}

interface ActivityLogEntry {
  id: string;
  adminEmail: string;
  action: string;
  targetType?: string;
  targetId?: string;
  targetName?: string;
  details: string;
  createdAt: string;
}

interface AdminAppSettings {
  appMaintenance: boolean;
  allowNewStores: boolean;
  allowNewProducts: boolean;
  maxReportsPerDay: number;
  autoBanThreshold: number;
}

const DEFAULT_SETTINGS: AdminAppSettings = {
  appMaintenance: false,
  allowNewStores: true,
  allowNewProducts: true,
  maxReportsPerDay: 5,
  autoBanThreshold: 10,
};

// ===== STORE =====
interface AdminState {
  reports: Report[];
  bans: UserBan[];
  activityLog: ActivityLogEntry[];
  appSettings: AdminAppSettings;
  initialized: boolean;

  initialize: () => Promise<void>;

  // Reports
  fetchReports: () => Promise<void>;
  createReport: (_data: Omit<Report, 'id' | 'status' | 'createdAt'>) => Promise<void>;
  updateReportStatus: (_reportId: string, _status: ReportStatus, _note?: string, _action?: string) => Promise<void>;

  // Bans
  fetchBans: () => Promise<void>;
  banUser: (_data: Omit<UserBan, 'id' | 'createdAt' | 'isActive'>) => Promise<void>;
  unbanUser: (_userId: string) => Promise<void>;
  // Activity
  fetchActivityLog: () => Promise<void>;
  logActivity: (_action: string, _targetType?: string, _targetId?: string, _targetName?: string, _details?: string) => Promise<void>;
  // Settings
  fetchSettings: () => Promise<void>;
  updateAppSettings: (_settings: Partial<AdminAppSettings>) => Promise<void>;

  // Helpers
  getBanDurationDays: (_duration: BanDuration) => number;
  getBanDurationLabel: (_duration: BanDuration) => string;
}

export const useAdminStore = create<AdminState>((set, get) => ({
  reports: [],
  bans: [],
  activityLog: [],
  appSettings: DEFAULT_SETTINGS,
  initialized: false,

  initialize: async () => {
    if (typeof window === 'undefined') return;
    if (get().initialized) return;
    try {
      await Promise.all([
        get().fetchReports(),
        get().fetchBans(),
        get().fetchActivityLog(),
        get().fetchSettings(),
      ]);
      set({ initialized: true });
    } catch {
      set({ initialized: true });
    }
  },

  // ===== REPORTS =====

  fetchReports: async () => {
    try {
      const { data, error: apiError } = await apiGet<{ reports: Report[] }>('/api/admin/reports');
      if (apiError) throw new Error('Failed to fetch reports');
      set({ reports: data!.reports || [] });
    } catch {
      // Silent fail — reports are non-critical
    }
  },

  createReport: async (data) => {
    try {
      const { data: result, error: apiError } = await apiPost<{ report: Report }>('/api/admin/reports', data);
      if (apiError) throw new Error('Failed to create report');
      const reports = [result!.report, ...get().reports];
      set({ reports });
    } catch {
      // Silent fail
    }
  },

  updateReportStatus: async (reportId, status, note, action) => {
    try {
      const { error: apiError } = await apiPut('/api/admin/reports', { reportId, status, adminNote: note, actionTaken: action });
      if (apiError) throw new Error('Failed to update report');
      const reports = get().reports.map(r =>
        r.id === reportId ? { ...r, status, adminNote: note, actionTaken: action, reviewedAt: new Date().toISOString() } : r
      );
      set({ reports });
    } catch {
      // Silent fail
    }
  },

  // ===== BANS =====

  fetchBans: async () => {
    try {
      const { data, error: apiError } = await apiGet<{ bans: UserBan[] }>('/api/admin/bans');
      if (apiError) throw new Error('Failed to fetch bans');
      set({ bans: data!.bans || [] });
    } catch {
      // Silent fail
    }
  },

  banUser: async (data) => {
    try {
      const { data: result, error: apiError } = await apiPost<{ ban: UserBan }>('/api/admin/bans', data);
      if (apiError) throw new Error('Failed to create ban');
      const bans = [result!.ban, ...get().bans.map(b => b.userId === data.userId ? { ...b, isActive: false } : b)];
      set({ bans });
    } catch {
      // Silent fail
    }
  },

  unbanUser: async (userId) => {
    try {
      const { error: apiError } = await apiDelete(`/api/admin/bans?userId=${encodeURIComponent(userId)}`);
      if (apiError) throw new Error('Failed to unban user');
      const bans = get().bans.map(b => b.userId === userId ? { ...b, isActive: false } : b);
      set({ bans });
    } catch {
      // Silent fail
    }
  },

  // ===== ACTIVITY =====

  fetchActivityLog: async () => {
    try {
      const { data, error: apiError } = await apiGet<{ activityLog: ActivityLogEntry[] }>('/api/admin/activity');
      if (apiError) throw new Error('Failed to fetch activity log');
      set({ activityLog: data!.activityLog || [] });
    } catch {
      // Silent fail
    }
  },

  logActivity: async (action, targetType, targetId, targetName, details) => {
    try {
      const { data: result, error: apiError } = await apiPost<{ entry: ActivityLogEntry }>('/api/admin/activity', { action, targetType, targetId, targetName, details });
      if (apiError) throw new Error('Failed to log activity');
      const log = [result!.entry, ...get().activityLog].slice(0, 500);
      set({ activityLog: log });
    } catch {
      // Silent fail
    }
  },

  // ===== SETTINGS =====

  fetchSettings: async () => {
    try {
      const { data } = await apiGet<{ appSettings?: AdminAppSettings }>('/api/admin/activity?settings=true');
      if (data?.appSettings) {
        set({ appSettings: data.appSettings });
      }
    } catch {
      // Silent fail — use defaults
    }
  },

  updateAppSettings: async (settings) => {
    try {
      const { data, error: apiError } = await apiPost<{ settings: AdminAppSettings }>('/api/admin/activity', { action: 'update_settings', settings });
      if (!apiError && data?.settings) {
        set({ appSettings: data.settings });
      }
      // 🔴 FIX: Don't apply locally on failure — would cause client/server state mismatch
    } catch {
      // Silently fail — server is the source of truth for admin settings
    }
  },

  // ===== HELPERS =====
  getBanDurationDays: (duration) => {
    const map: Record<BanDuration, number> = { '1d': 1, '3d': 3, '7d': 7, '15d': 15, '30d': 30, 'permanent': 36500 };
    return map[duration];
  },

  getBanDurationLabel: (duration) => {
    const map: Record<BanDuration, string> = { '1d': 'يوم واحد', '3d': '3 أيام', '7d': '7 أيام', '15d': '15 يوم', '30d': '30 يوم', 'permanent': 'دائم' };
    return map[duration];
  },
}));

// ===== REPORT REASONS =====
export const REPORT_REASONS = [
  { value: 'fraud', label: 'احتيال' },
  { value: 'inappropriate', label: 'محتوى مخالف' },
  { value: 'spam', label: 'سبام' },
  { value: 'fake_price', label: 'أسعار وهمية' },
  { value: 'fake_images', label: 'صور مزيفة' },
  { value: 'abuse', label: 'إساءة' },
  { value: 'duplicate', label: 'تكرار' },
  { value: 'prohibited', label: 'منتج ممنوع' },
  { value: 'fake_store', label: 'متجر مزيف' },
  { value: 'other', label: 'سبب آخر' },
] as const;

export const TARGET_TYPE_LABELS: Record<ReportTargetType, string> = {
  product: 'منتج',
  store: 'متجر',
  offer: 'عرض',
  user: 'مستخدم',
  contest: 'مسابقة',
};

