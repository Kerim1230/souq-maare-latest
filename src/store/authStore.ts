import { create } from 'zustand';
import { usePointsStore } from './pointsStore';
import { useNotificationStore } from './notificationStore';
import { WELCOME_BONUS_POINTS } from '@/lib/constants';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/fetchApi';
import { resetHydration } from '@/lib/hydration';

// ─── Types ──────────────────────────────────────────────

export interface UserProfile {
  id: string;
  email: string;
  full_name?: string | null;
  avatar_url?: string | null;
  phone?: string | null;
  city?: string | null;
  governorate?: string | null;
  created_at?: string | null;
  is_admin?: boolean;
  role?: string;
}

interface AuthState {
  user: UserProfile | null;
  loading: boolean;
  error: string | null;
  initialized: boolean;

  initialize: () => Promise<void>;
  login: (_email: string, _password: string) => Promise<{ error: string | null }>;
  signup: (_email: string, _password: string, _fullName?: string, _referrer?: string) => Promise<{ error: string | null }>;
  logout: () => Promise<void>;
  updateUser: (_data: Partial<UserProfile>) => Promise<void>;
  clearError: () => void;
}

// ─── Session Cache ──────────────────────────────────────
// Caches the auth session for 10 minutes to reduce /api/auth calls.
// This saves Supabase queries and Vercel function invocations.

const SESSION_CACHE_KEY = 'suq_auth_session';
const SESSION_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

interface CachedSession {
  user: UserProfile;
  cachedAt: number;
}

function getCachedSession(): UserProfile | null {
  try {
    const raw = sessionStorage.getItem(SESSION_CACHE_KEY);
    if (!raw) return null;
    const cached: CachedSession = JSON.parse(raw);
    if (Date.now() - cached.cachedAt > SESSION_CACHE_TTL) {
      sessionStorage.removeItem(SESSION_CACHE_KEY);
      console.log('[AuthCache] ⏰ Session expired, refetching');
      return null;
    }
    console.log('[AuthCache] ✅ Using cached session');
    return cached.user;
  } catch {
    return null;
  }
}

function setCachedSession(user: UserProfile): void {
  try {
    const cached: CachedSession = { user, cachedAt: Date.now() };
    sessionStorage.setItem(SESSION_CACHE_KEY, JSON.stringify(cached));
    console.log('[AuthCache] 💾 Session cached for 10 minutes');
  } catch {
    // sessionStorage may be unavailable in some environments
  }
}

function clearCachedSession(): void {
  try {
    sessionStorage.removeItem(SESSION_CACHE_KEY);
    console.log('[AuthCache] 🗑️ Session cache cleared');
  } catch {
    // Ignore
  }
}

// ─── منح مكافأة التسجيل ─────────────────────────────────

function awardWelcomeBonus(userId: string) {
  try {
    const pointsStore = usePointsStore.getState();
    pointsStore.addPoints(
      userId,
      WELCOME_BONUS_POINTS,
      `مكافأة التسجيل - ${WELCOME_BONUS_POINTS} نقطة مجانية 🎉`,
      'admin_add'
    );

    const notifStore = useNotificationStore.getState();
    notifStore.createNotification({
      userId,
      type: 'points',
      category: 'welcome_bonus',
      title: '🎁 مرحباً بك في سوق الحرية!',
      body: `لقد حصلت على ${WELCOME_BONUS_POINTS} نقطة مجانية كمكافأة تسجيل! استخدمها لشراء المنتجات أو توثيق متجرك.`,
      icon: 'Gift',
      priority: 'high',
      deepLink: '/wallet',
    });
  } catch {
    // فشل منح المكافأة بصمت
  }
}

// ─── Store ──────────────────────────────────────────────

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  loading: false,
  error: null,
  initialized: false,

  clearError: () => set({ error: null }),

  // ── تهيئة المصادقة — استعادة الجلسة من cache أو cookie ──
  initialize: async () => {
    if (get().initialized) return;

    const timeout = setTimeout(() => {
      if (!get().initialized) set({ initialized: true });
    }, 5000);

    // Check session cache first — skip API call if still valid
    const cachedUser = getCachedSession();
    if (cachedUser) {
      set({ user: cachedUser, initialized: true });
      clearTimeout(timeout);
      return;
    }

    // Cache miss or expired — fetch from API
    const { data, error } = await apiGet<{ user: UserProfile }>('/api/auth');
    if (!error && data?.user) {
      setCachedSession(data.user);
      set({ user: data.user, initialized: true });
      clearTimeout(timeout);
      return;
    }

    set({ initialized: true });
    clearTimeout(timeout);
  },

  // ── تسجيل الدخول ──
  login: async (email, password) => {
    set({ loading: true, error: null });

    const { data, error: apiError } = await apiPost<{ user: UserProfile }>('/api/auth/signin', { email, password });

    if (apiError) {
      const errorMsg = apiError || 'بريد إلكتروني أو كلمة مرور غير صحيحة';
      set({ error: errorMsg, loading: false });
      return { error: errorMsg };
    }

    if (data?.user) {
      const profile: UserProfile = {
        id: data.user.id,
        email: data.user.email,
        full_name: data.user.full_name,
        avatar_url: data.user.avatar_url,
        phone: data.user.phone,
        city: data.user.city,
        governorate: data.user.governorate,
        created_at: data.user.created_at,
        is_admin: data.user.is_admin,
        role: data.user.role,
      };
      setCachedSession(profile);
      set({ user: profile, loading: false });
      return { error: null };
    }

    set({ loading: false });
    return { error: 'حدث خطأ غير متوقع' };
  },

  // ── إنشاء حساب ──
  signup: async (email, password, fullName, referrer) => {
    set({ loading: true, error: null });

    const { data, error: apiError } = await apiPost<{ user: UserProfile }>('/api/auth/signup', { email, password, fullName, referrer });

    if (apiError) {
      const errorMsg = apiError || 'حدث خطأ أثناء إنشاء الحساب';
      set({ error: errorMsg, loading: false });
      return { error: errorMsg };
    }

    if (data?.user) {
      const profile: UserProfile = {
        id: data.user.id,
        email: data.user.email,
        full_name: data.user.full_name,
        avatar_url: data.user.avatar_url,
        phone: data.user.phone,
        city: data.user.city,
        governorate: data.user.governorate,
        created_at: data.user.created_at,
        is_admin: data.user.is_admin,
        role: data.user.role,
      };

      setCachedSession(profile);
      set({ user: profile, loading: false });
      awardWelcomeBonus(data.user.id);
      return { error: null };
    }

    set({ loading: false });
    return { error: 'حدث خطأ أثناء إنشاء الحساب' };
  },

  // ── تسجيل الخروج ──
  logout: async () => {
    try {
      await apiDelete('/api/auth');
    } catch {
      // Continue logout even if API fails — local state is the source of truth for auth
    }
    clearCachedSession();
    set({ user: null, error: null });
    // Reset hydration so next login fetches fresh data
    resetHydration();
  },

  // ── تحديث بيانات المستخدم ──
  updateUser: async (data) => {
    try {
      const { data: result, error } = await apiPut<{ user: UserProfile }>('/api/auth', data);
      if (error) {
        console.error('updateUser API error:', error);
        return;
      }
      if (result?.user) {
        setCachedSession(result.user);
        set({ user: result.user });
      }
    } catch (err) {
      console.error('updateUser unexpected error:', err);
    }
  },
}));
