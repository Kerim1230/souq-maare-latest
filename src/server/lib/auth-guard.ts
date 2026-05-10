/**
 * Auth Guards — Local JWT session cookies + Supabase profile lookup.
 *
 * Authentication is handled via JWT session cookies (suq_shamel_sid).
 * Supabase public.users table stores profile data (is_admin, email, etc.).
 */

import type { NextRequest } from 'next/server';
import { findUserById, findUserByEmailSafe } from '@/lib/supabase-db';
import { unauthorized, forbidden } from '@/lib/api-response';
import { ADMIN_ROLES, MODERATOR_ROLES } from '@/lib/constants';
import { getAdminEmail } from '@/server/lib/secrets';
import { logger } from '@/lib/logger';
import { getSessionUserId } from '@/lib/session';

// ── Types ──────────────────────────────────────────────────────────────────

interface AuthSuccess {
  success: true;
  userId: string;
  email: string;
}

interface AuthFailure {
  success: false;
  response: Response;
}

interface AdminSuccess {
  success: true;
  userId: string;
  email: string;
  role: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Look up a Supabase public.users record by ID (safe — returns null on error).
 */
async function findUserByIdSafe(id: string): Promise<{
  id: string;
  email: string;
  is_admin: boolean;
} | null> {
  try {
    const user = await findUserById(id);
    if (!user) return null;
    return { id: user.id, email: user.email, is_admin: user.is_admin };
  } catch {
    return null;
  }
}

/**
 * Look up a Supabase public.users record by email (safe — returns null on error).
 */
async function findUserByEmailLocal(email: string): Promise<{
  id: string;
  email: string;
  is_admin: boolean;
} | null> {
  const user = await findUserByEmailSafe(email);
  if (!user) return null;
  return { id: user.id, email: user.email, is_admin: user.is_admin };
}

/**
 * Resolve the admin role for a Supabase user.
 */
function resolveAdminRole(user: { is_admin: boolean }): string | null {
  if (user.is_admin && (ADMIN_ROLES as readonly string[]).includes('admin')) {
    return 'admin';
  }
  return null;
}

/**
 * Resolve the moderator role for a Supabase user.
 */
function resolveModeratorRole(user: { is_admin: boolean }): string | null {
  if (user.is_admin && (MODERATOR_ROLES as readonly string[]).includes('admin')) {
    return 'admin';
  }
  return null;
}

/**
 * Get authenticated user from JWT session cookie.
 * Returns { userId, email } on success, null on failure.
 */
async function getAuthenticatedUser(request: NextRequest): Promise<{ userId: string; email: string } | null> {
  try {
    const userId = await getSessionUserId(request);
    if (!userId) return null;

    const user = await findUserByIdSafe(userId);
    if (user) {
      return { userId: user.id, email: user.email };
    }
  } catch (err) {
    logger.warn('JWT auth check failed in auth-guard', 'Auth', {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  return null;
}

// ── Exported Functions ─────────────────────────────────────────────────────

/**
 * Require basic authentication (JWT session cookie).
 */
export async function requireAuth(request: NextRequest): Promise<AuthSuccess | AuthFailure> {
  try {
    const authed = await getAuthenticatedUser(request);
    if (!authed) {
      return { success: false, response: unauthorized('يجب تسجيل الدخول أولاً') };
    }
    return {
      success: true,
      userId: authed.userId,
      email: authed.email,
    };
  } catch (err) {
    console.error('[auth-guard] requireAuth error:', err);
    return { success: false, response: unauthorized('فشل التحقق من الهوية') };
  }
}

/**
 * Require admin-level access.
 * Checks User.is_admin or ADMIN_EMAIL match.
 */
export async function requireAdmin(request: NextRequest): Promise<AdminSuccess | AuthFailure> {
  try {
    const authed = await getAuthenticatedUser(request);
    if (!authed) {
      return { success: false, response: unauthorized('يجب تسجيل الدخول أولاً') };
    }

    const user = await findUserByEmailLocal(authed.email);
    if (!user) {
      return { success: false, response: unauthorized('المستخدم غير موجود') };
    }

    const dbRole = resolveAdminRole(user);
    if (dbRole) {
      return {
        success: true,
        userId: user.id,
        email: user.email,
        role: dbRole,
      };
    }

    const adminEmail = getAdminEmail();
    if (!adminEmail) {
      return { success: false, response: forbidden('إعدادات الأمان غير مكتملة') };
    }

    if (user.email === adminEmail) {
      return {
        success: true,
        userId: user.id,
        email: user.email,
        role: 'admin',
      };
    }

    return { success: false, response: forbidden('ليس لديك صلاحية الوصول لهذا المسار') };
  } catch {
    return { success: false, response: unauthorized('فشل التحقق من الهوية') };
  }
}

/**
 * Require moderator-level or higher access.
 */
export async function requireModerator(request: NextRequest): Promise<AdminSuccess | AuthFailure> {
  try {
    const authed = await getAuthenticatedUser(request);
    if (!authed) {
      return { success: false, response: unauthorized('يجب تسجيل الدخول أولاً') };
    }

    const user = await findUserByEmailLocal(authed.email);
    if (!user) {
      return { success: false, response: unauthorized('المستخدم غير موجود') };
    }

    const dbRole = resolveModeratorRole(user);
    if (dbRole) {
      return {
        success: true,
        userId: user.id,
        email: user.email,
        role: dbRole,
      };
    }

    const adminEmail = getAdminEmail();
    if (adminEmail && user.email === adminEmail) {
      return {
        success: true,
        userId: user.id,
        email: user.email,
        role: 'admin',
      };
    }

    return { success: false, response: forbidden('ليس لديك صلاحية الوصول لهذا المسار') };
  } catch {
    return { success: false, response: unauthorized('فشل التحقق من الهوية') };
  }
}
