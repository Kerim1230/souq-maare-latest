// Centralized constants for the entire application
//
// ⚠️ SECURITY: NEVER put server-only env vars here.
//    This file is imported by CLIENT components (screens, stores).
//    Only put public constants (numbers, arrays, strings).

// ===== Roles =====
// Roles that grant admin-level access
export const ADMIN_ROLES = ['admin', 'moderator', 'superadmin'] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

// Roles that grant moderator-level or above access
export const MODERATOR_ROLES = ['moderator', 'admin', 'superadmin'] as const;
export type ModeratorRole = (typeof MODERATOR_ROLES)[number];

// ===== Verification Tier System =====
export type VerificationTier = 'unverified' | 'bronze' | 'silver' | 'gold' | 'diamond';

export const VERIFICATION_TIERS: Record<VerificationTier, string> = {
  unverified: 'غير موثّق',
  bronze: 'برونزي',
  silver: 'فضي',
  gold: 'ذهبي',
  diamond: 'ألماسي',
};

export interface VerificationPlan {
  tier: VerificationTier;
  nameAr: string;
  costPerMonth: number;
  durationDays: number;
  emoji: string;
  colorClass: string;
  gradientClass: string;
  lightGradientClass: string;
  limits: {
    maxProductsPerMonth: number;
    maxOffersPerMonth: number;
    maxContestsPerMonth: number;
    maxFeaturedProductsPerMonth: number;
    maxStoreEditsPerWeek: number;
    maxSettingsChangesPerMonth: number;
    maxDurationDays: number;
    autoPinned: boolean;
  };
}

export const VERIFICATION_PLANS: VerificationPlan[] = [
  {
    tier: 'unverified',
    nameAr: 'غير موثّق',
    costPerMonth: 0,
    durationDays: 1, // products auto-delete after 1 day
    emoji: '🆓',
    colorClass: 'text-slate-500',
    gradientClass: 'from-slate-400 to-slate-600',
    lightGradientClass: 'from-slate-50 to-slate-100',
    limits: {
      maxProductsPerMonth: 10,
      maxOffersPerMonth: 0,
      maxContestsPerMonth: 0,
      maxFeaturedProductsPerMonth: 0,
      maxStoreEditsPerWeek: 0, // 1 edit per month (special case handled in store)
      maxSettingsChangesPerMonth: 0,
      maxDurationDays: 2,
      autoPinned: false,
    },
  },
  {
    tier: 'bronze',
    nameAr: 'برونزي',
    costPerMonth: 100,
    durationDays: 30,
    emoji: '🥉',
    colorClass: 'text-amber-700',
    gradientClass: 'from-amber-600 to-amber-800',
    lightGradientClass: 'from-amber-50 to-amber-100',
    limits: {
      maxProductsPerMonth: 50,
      maxOffersPerMonth: 1,
      maxContestsPerMonth: 1,
      maxFeaturedProductsPerMonth: 2,
      maxStoreEditsPerWeek: 1,
      maxSettingsChangesPerMonth: 1,
      maxDurationDays: 7,
      autoPinned: true,
    },
  },
  {
    tier: 'silver',
    nameAr: 'فضي',
    costPerMonth: 200,
    durationDays: 30,
    emoji: '🥈',
    colorClass: 'text-gray-400',
    gradientClass: 'from-gray-300 to-gray-500',
    lightGradientClass: 'from-gray-50 to-gray-100',
    limits: {
      maxProductsPerMonth: 100,
      maxOffersPerMonth: 3,
      maxContestsPerMonth: 3,
      maxFeaturedProductsPerMonth: 5,
      maxStoreEditsPerWeek: 2,
      maxSettingsChangesPerMonth: 2,
      maxDurationDays: 14,
      autoPinned: true,
    },
  },
  {
    tier: 'gold',
    nameAr: 'ذهبي',
    costPerMonth: 375,
    durationDays: 30,
    emoji: '🥇',
    colorClass: 'text-yellow-500',
    gradientClass: 'from-yellow-400 to-yellow-600',
    lightGradientClass: 'from-yellow-50 to-yellow-100',
    limits: {
      maxProductsPerMonth: 200,
      maxOffersPerMonth: 7,
      maxContestsPerMonth: 7,
      maxFeaturedProductsPerMonth: 10,
      maxStoreEditsPerWeek: 4,
      maxSettingsChangesPerMonth: 4,
      maxDurationDays: 21,
      autoPinned: true,
    },
  },
  {
    tier: 'diamond',
    nameAr: 'ألماسي',
    costPerMonth: 500,
    durationDays: 30,
    emoji: '💎',
    colorClass: 'text-cyan-400',
    gradientClass: 'from-cyan-400 to-blue-600',
    lightGradientClass: 'from-cyan-50 to-blue-100',
    limits: {
      maxProductsPerMonth: 400,
      maxOffersPerMonth: 15,
      maxContestsPerMonth: 15,
      maxFeaturedProductsPerMonth: 30,
      maxStoreEditsPerWeek: 7,
      maxSettingsChangesPerMonth: 10,
      maxDurationDays: 30,
      autoPinned: true,
    },
  },
];

/** Get a plan by tier, defaults to unverified */
export function getPlan(tier: VerificationTier | string | null | undefined): VerificationPlan {
  return VERIFICATION_PLANS.find(p => p.tier === tier) ?? VERIFICATION_PLANS[0];
}

/** Get duration options for a given tier */
export function getDurationOptions(tier: VerificationTier | string | null | undefined): number[] {
  const plan = getPlan(tier);
  const max = plan.limits.maxDurationDays;
  const options: number[] = [];
  for (let d = 1; d <= max; d++) {
    options.push(d);
  }
  // For long durations, skip some to keep the list reasonable
  if (options.length > 10) {
    const reduced = [1, 2, 3, 5, 7, 10, 14, 21, 30].filter(d => d <= max);
    return reduced.length > 0 ? reduced : options.slice(0, 10);
  }
  return options;
}

// ===== Legacy Compatibility =====
// These are kept for backward compatibility with existing screens.
// New code should use VERIFICATION_PLANS directly.
export const VERIFICATION_COST = 100; // Bronze tier cost
export const VERIFICATION_DAYS = 30;  // Standard verification period

// ===== Welcome Bonus =====
export const WELCOME_BONUS_POINTS = 150;

// ===== Chat =====
export const CHAT_POLL_INTERVAL = 3000; // 3 seconds

// ===== Notifications =====
export const NOTIFICATION_MAX_PER_USER = 200;

// ===== Search =====
export const SEARCH_DEBOUNCE_MS = 300;

// ===== Upload =====
export const MAX_IMAGE_SIZE_MB = 5;
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

// ===== Auto Delete =====
export const AUTO_DELETE_CHECK_INTERVAL_MS = 60000; // 1 minute

// ===== Inactive Account Cleanup =====
export const INACTIVE_ACCOUNT_DAYS = 60; // حذف الحسابات غير النشطة بعد 60 يوم
