/**
 * Re-exports from auth-guard + owner-based access checks.
 *
 * Authentication is handled via JWT session cookies + Supabase.
 */

import type { NextRequest } from 'next/server';
import { findUserById, findStoreById, findProductById } from '@/lib/supabase-db';
import { unauthorized, forbidden, badRequest, serverError } from '@/lib/api-response';
import { logger } from '@/lib/logger';
import { getSessionUserId } from '@/lib/session';

// ── Re-exports from auth-guard (requireAuth, requireAdmin, requireModerator) ──
export { requireAuth, requireAdmin, requireModerator } from '@/server/lib/auth-guard';

// ── Types ──────────────────────────────────────────────────────────────────

export interface AuthResult {
  success: true;
  userId: string;
  email: string;
}

export interface AuthFailure {
  success: false;
  response: Response;
}

type AuthCheck = AuthResult | AuthFailure;

// ── Owner-based Access Checks ─────────────────────────────────────────────

/**
 * Verify JWT session cookie + check that the authenticated user
 * matches the expected owner ID.
 */
export async function requireOwner(
  request: NextRequest,
  expectedUserId?: string,
): Promise<AuthCheck> {
  try {
    const userId = await getSessionUserId(request);
    if (!userId) {
      return { success: false, response: unauthorized('يجب تسجيل الدخول أولاً') };
    }

    // Look up User by ID via Supabase
    const user = await findUserById(userId);
    if (!user) {
      return { success: false, response: unauthorized('المستخدم غير موجود') };
    }

    if (expectedUserId && user.id !== expectedUserId) {
      return { success: false, response: forbidden('ليس لديك صلاحية لهذا الإجراء') };
    }

    return { success: true, userId: user.id, email: user.email };
  } catch (err) {
    console.error('[require-auth] requireOwner error:', err);
    return { success: false, response: unauthorized('فشل التحقق من الهوية') };
  }
}

/**
 * Verify JWT session cookie + check that the authenticated user
 * owns a specific store.
 */
export async function requireStoreOwner(
  request: NextRequest,
  storeId: string,
): Promise<AuthCheck & { storeUserId?: string }> {
  // Use requireAuth from auth-guard for the secure DB lookup
  const { requireAuth } = await import('@/server/lib/auth-guard');
  const auth = await requireAuth(request);
  if (!auth.success) return auth;

  try {
    const store = await findStoreById(storeId);
    if (!store) {
      return { success: false, response: badRequest('المتجر غير موجود') };
    }
    if (store.user_id !== auth.userId) {
      return { success: false, response: forbidden('ليس لديك صلاحية لهذا المتجر') };
    }
    return {
      success: true,
      userId: auth.userId,
      email: auth.email,
      storeUserId: store.user_id,
    };
  } catch (err) {
    logger.error(
      'requireStoreOwner: unexpected error',
      'Auth',
      { error: err instanceof Error ? err.message : String(err), storeId },
    );
    return { success: false, response: serverError('حدث خطأ أثناء التحقق من المتجر') };
  }
}

/**
 * Verify JWT session cookie + check that the authenticated user
 * owns the store that owns a specific product.
 */
export async function requireProductOwner(
  request: NextRequest,
  productId: string,
): Promise<AuthCheck & { storeId?: string }> {
  // Use requireAuth from auth-guard for the secure DB lookup
  const { requireAuth } = await import('@/server/lib/auth-guard');
  const auth = await requireAuth(request);
  if (!auth.success) return auth;

  try {
    const product = await findProductById(productId);
    if (!product) {
      return { success: false, response: badRequest('المنتج غير موجود') };
    }
    // Verify the user owns the store that this product belongs to
    const store = await findStoreById(product.store_id);
    if (!store || store.user_id !== auth.userId) {
      return { success: false, response: forbidden('ليس لديك صلاحية لهذا المنتج') };
    }
    return {
      success: true,
      userId: auth.userId,
      email: auth.email,
      storeId: store.id,
    };
  } catch (err) {
    logger.error(
      'requireProductOwner: unexpected error',
      'Auth',
      { error: err instanceof Error ? err.message : String(err), productId },
    );
    return { success: false, response: serverError('حدث خطأ أثناء التحقق من المنتج') };
  }
}
