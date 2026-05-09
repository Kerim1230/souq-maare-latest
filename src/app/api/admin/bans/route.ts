export const runtime = 'nodejs'
import { NextRequest } from 'next/server';
import { requireAdmin } from '@/server/lib/admin-auth';
import { checkRateLimit, getClientIp, LIMITS } from '@/server/lib/rate-limiter';
import { success, badRequest, serverError, rateLimited } from '@/lib/api-response';
import { logger } from '@/lib/logger';
// logAdminAction replaced with logAdminActivity from supabase-db (no Prisma)
import { withRoute } from '@/server/lib/route-wrapper';
import { getSupabaseAdmin, findActiveBan, logAdminActivity, TABLES, handleResponse } from '@/lib/supabase-db';

const PERMANENT_BAN_EXPIRY = '9999-12-31T23:59:59.999Z';

// GET /api/admin/bans — list all bans (admin) OR check ban status (public with ?userId=)
export const GET = withRoute(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const checkUserId = searchParams.get('userId');

  // Public endpoint: check ban status for a specific user
  if (checkUserId) {
    // Rate limit public ban checks to prevent enumeration
    const ip = getClientIp(request);
    const rl = checkRateLimit(`ban:check:${ip}`, LIMITS.general);
    if (!rl.success) return rateLimited();

    try {
      const memBan = await findActiveBan(checkUserId);
      if (memBan) {
        return success({ isBanned: true, ban: mapBan(memBan), source: 'database' });
      }
      return success({ isBanned: false, source: 'database' });
    } catch (err) {
      logger.error('Admin bans check error', 'AdminBans', { error: (err as Error)?.message });
      return success({ isBanned: false, source: 'error' });
    }
  }

  // Admin endpoint: list all bans
  const admin = await requireAdmin(request);
  if (!admin.success) return admin.response;

  // Rate limiting
  const ip = getClientIp(request);
  const rateCheck = checkRateLimit(`admin:${ip}`, LIMITS.admin);
  if (!rateCheck.success) {
    return rateLimited();
  }

  try {
    const sb = getSupabaseAdmin();
    // Deactivate expired bans first
    await sb.from(TABLES.USER_BANS)
      .update({ is_active: false })
      .eq('is_active', true)
      .neq('duration', 'permanent')
      .lt('expires_at', new Date().toISOString());

    const { data: bans, error } = await sb
      .from(TABLES.USER_BANS)
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return success({ bans: (bans || []).map(mapBan), source: 'database' });
  } catch (err) {
    logger.error('Admin bans GET error', 'AdminBans', { error: (err as Error)?.message });
    return success({ bans: [], source: 'fallback' });
  }
})

// POST /api/admin/bans — create ban
export const POST = withRoute(async (request: NextRequest) => {
  const admin = await requireAdmin(request);
  if (!admin.success) return admin.response;

  // Rate limiting
  const ip = getClientIp(request);
  const rateCheck = checkRateLimit(`admin:${ip}`, LIMITS.admin);
  if (!rateCheck.success) {
    return rateLimited();
  }

  try {
    const body = await request.json();
    const { userId, userEmail, userName, banType, duration, reason, expiresAt } = body as {
      userId: string;
      userEmail: string;
      userName: string;
      banType: 'login' | 'post' | 'edit' | 'message' | 'full';
      duration: '1d' | '3d' | '7d' | '15d' | '30d' | 'permanent';
      reason: string;
      expiresAt: string;
    };

    if (!userId || !duration || !reason) {
      return badRequest('Missing required fields');
    }

    const sb = getSupabaseAdmin();
    // Deactivate existing active bans for this user
    await sb.from(TABLES.USER_BANS).update({ is_active: false }).eq('user_id', userId).eq('is_active', true);

    // Determine expires_at
    const banExpiresAt = duration === 'permanent'
      ? PERMANENT_BAN_EXPIRY
      : expiresAt;

    const ban = await handleResponse(
      await sb.from(TABLES.USER_BANS).insert({
        user_id: userId,
        user_email: userEmail || '',
        user_name: userName || '',
        ban_type: banType || 'full',
        duration,
        reason,
        is_active: true,
        expires_at: banExpiresAt,
      }).select().single(),
      'banUser'
    );

    // Audit log via Supabase
    await logAdminActivity({
      admin_email: admin.email,
      action: 'حظر مستخدم',
      target_type: 'user',
      target_id: userId,
      target_name: userName || '',
      details: `المدة: ${duration} - السبب: ${reason}`,
    });
    return success({ ban: mapBan(ban), source: 'database' });
  } catch (error) {
    logger.error('Admin bans POST error', 'AdminBans', { error: (error as Error)?.message });
    const message = process.env.NODE_ENV === 'development'
      ? (error instanceof Error ? error.message : 'Unknown error')
      : 'حدث خطأ غير متوقع';
    return serverError(message);
  }
})

// DELETE /api/admin/bans?userId=xxx — unban
export const DELETE = withRoute(async (request: NextRequest) => {
  const admin = await requireAdmin(request);
  if (!admin.success) return admin.response;

  // Rate limiting
  const ip = getClientIp(request);
  const rateCheck = checkRateLimit(`admin:${ip}`, LIMITS.admin);
  if (!rateCheck.success) {
    return rateLimited();
  }

  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return badRequest('userId is required');
    }

    const sb = getSupabaseAdmin();
    await sb.from(TABLES.USER_BANS).update({ is_active: false }).eq('user_id', userId).eq('is_active', true);

    // Audit log via Supabase
    await logAdminActivity({
      admin_email: admin.email,
      action: 'إلغاء حظر مستخدم',
      target_type: 'user',
      target_id: userId,
    });
    return success({ source: 'database' });
  } catch (error) {
    logger.error('Admin bans DELETE error', 'AdminBans', { error: (error as Error)?.message });
    const message = process.env.NODE_ENV === 'development'
      ? (error instanceof Error ? error.message : 'Unknown error')
      : 'حدث خطأ غير متوقع';
    return serverError(message);
  }
})

/** Map a Supabase ban row to the expected response format */
function mapBan(row: Record<string, unknown>) {
  return {
    id: row.id,
    userId: row.user_id,
    userEmail: row.user_email,
    userName: row.user_name,
    banType: row.ban_type,
    duration: row.duration,
    reason: row.reason,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    isActive: row.is_active,
  };
}
