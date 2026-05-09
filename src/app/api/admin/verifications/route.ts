export const runtime = 'nodejs'
import { NextRequest } from 'next/server';
import { requireAdmin } from '@/server/lib/admin-auth';
import { checkRateLimit, getClientIp, LIMITS } from '@/server/lib/rate-limiter';
import { success, badRequest, notFound, serverError, rateLimited } from '@/lib/api-response';
import { logger } from '@/lib/logger';
import { withRoute } from '@/server/lib/route-wrapper';
import { getSupabaseAdmin, findVerificationByStoreId, findStoreById, createVerification, updateVerification, logAdminActivity, TABLES, handleResponse } from '@/lib/supabase-db';
import { type VerificationTier, getPlan } from '@/lib/constants';

// GET /api/admin/verifications — list all verifications + activity log
export const GET = withRoute(async (request: NextRequest) => {
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

    // Auto-deactivate expired verifications
    const now = new Date().toISOString();
    const { data: expired } = await sb.from(TABLES.VERIFICATIONS)
      .select('*')
      .eq('is_active', true)
      .not('end_date', 'is', null)
      .lte('end_date', now);

    if (expired && expired.length > 0) {
      for (const v of expired) {
        await sb.from(TABLES.VERIFICATIONS).update({ is_active: false }).eq('id', v.id);
        await sb.from(TABLES.VERIFICATION_ACTIVITY_LOGS).insert({
          action: 'verification_expired',
          store_id: v.store_id,
          store_name: v.store_name,
          details: `انتهت صلاحية توثيق "${v.store_name}"`,
        });
      }
    }

    const { data: verifications, error: vError } = await sb.from(TABLES.VERIFICATIONS)
      .select('*')
      .order('created_at', { ascending: false });
    if (vError) throw new Error(vError.message);

    const { data: activityLog, error: aError } = await sb.from(TABLES.VERIFICATION_ACTIVITY_LOGS)
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    if (aError) throw new Error(aError.message);

    const mappedVerifications = await Promise.all((verifications || []).map(mapVerificationData));
    const mappedActivityLog = (activityLog || []).map((l: Record<string, unknown>) => ({
      id: l.id,
      action: l.action,
      storeId: l.store_id,
      storeName: l.store_name,
      details: l.details,
      createdAt: l.created_at,
      performedBy: l.performed_by,
    }));

    return success({ verifications: mappedVerifications, activityLog: mappedActivityLog });
  } catch (error) {
    logger.error('Admin verifications GET error', 'AdminVerifications', { error: (error as Error)?.message });
    const message = process.env.NODE_ENV === 'development'
      ? (error instanceof Error ? error.message : 'Unknown error')
      : 'حدث خطأ غير متوقع';
    return serverError(message);
  }
})

// POST /api/admin/verifications — grant verification
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
    const { storeId, userId, storeName, adminEmail, tier } = body as {
      storeId: string;
      userId: string;
      storeName: string;
      adminEmail: string;
      tier?: string;
    };

    if (!storeId || !userId || !storeName) {
      return badRequest('Missing required fields');
    }

    const validTiers = ['bronze', 'silver', 'gold', 'diamond'];
    const safeTier: VerificationTier = validTiers.includes(tier || '') ? (tier as VerificationTier) : 'bronze';
    const now = new Date();
    const plan = getPlan(safeTier);
    const endDate = new Date(now.getTime() + plan.durationDays * 24 * 60 * 60 * 1000);

    // Check for existing active verification
    const existing = await findVerificationByStoreId(storeId);
    if (existing && existing.is_active && existing.end_date && new Date(existing.end_date) > now) {
      const tierOrder = ['unverified', 'bronze', 'silver', 'gold', 'diamond'];
      const existingTierIdx = tierOrder.indexOf((existing.tier as string) || 'bronze');
      const newTierIdx = tierOrder.indexOf(safeTier);
      if (newTierIdx <= existingTierIdx) {
        return badRequest('يوجد توثيق نشط لهذا المتجر بالفعل');
      }
    }

    // Upsert verification
    const sb = getSupabaseAdmin();
    let v;
    if (existing) {
      v = await handleResponse(
        await sb.from(TABLES.VERIFICATIONS).update({
          user_id: userId,
          store_name: storeName,
          tier: safeTier,
          is_active: true,
          start_date: now.toISOString(),
          end_date: endDate.toISOString(),
          granted_by: adminEmail || admin.email,
        }).eq('id', existing.id).select().single(),
        'grantVerification.update'
      );
    } else {
      v = await handleResponse(
        await sb.from(TABLES.VERIFICATIONS).insert({
          store_id: storeId,
          user_id: userId,
          store_name: storeName,
          tier: safeTier,
          is_active: true,
          start_date: now.toISOString(),
          end_date: endDate.toISOString(),
          granted_by: adminEmail || admin.email,
        }).select().single(),
        'grantVerification.insert'
      );
    }

    // Log activity
    await sb.from(TABLES.VERIFICATION_ACTIVITY_LOGS).insert({
      action: 'verification_granted',
      store_id: storeId,
      store_name: storeName,
      details: `تم منح التوثيق ${plan.nameAr} لـ "${storeName}" لمدة ${plan.durationDays} يوم`,
      performed_by: adminEmail || admin.email,
    });

    return success({ verification: await mapVerificationData(v) });
  } catch (error) {
    logger.error('Admin verifications POST error', 'AdminVerifications', { error: (error as Error)?.message });
    const message = process.env.NODE_ENV === 'development'
      ? (error instanceof Error ? error.message : 'Unknown error')
      : 'حدث خطأ غير متوقع';
    return serverError(message);
  }
})

// PUT /api/admin/verifications — extend or revoke verification
export const PUT = withRoute(async (request: NextRequest) => {
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
    const { storeId, adminEmail, action, days } = body as {
      storeId: string;
      adminEmail: string;
      action: 'extend' | 'revoke';
      days?: number;
    };

    if (!storeId || !action) {
      return badRequest('Missing required fields');
    }

    const sb = getSupabaseAdmin();

    if (action === 'extend') {
      if (!days || days <= 0) {
        return badRequest('days must be positive');
      }
      const existing = await findVerificationByStoreId(storeId);
      if (!existing) return notFound('Verification not found');

      const now = new Date();
      const baseDate = existing.is_active && existing.end_date && new Date(existing.end_date) > now
        ? new Date(existing.end_date)
        : now;
      const newEndDate = new Date(baseDate.getTime() + days * 24 * 60 * 60 * 1000);

      const updated = await updateVerification(existing.id, {
        is_active: true,
        end_date: newEndDate.toISOString(),
      });

      await sb.from(TABLES.VERIFICATION_ACTIVITY_LOGS).insert({
        action: 'verification_extended',
        store_id: storeId,
        store_name: existing.store_name,
        details: `تم تمديد توثيق "${existing.store_name}" لمدة ${days} يوم`,
        performed_by: adminEmail || admin.email,
      });

      return success({ verification: await mapVerificationData(updated) });
    }

    if (action === 'revoke') {
      const existing = await findVerificationByStoreId(storeId);
      if (!existing) return notFound('Verification not found');

      const updated = await updateVerification(existing.id, {
        is_active: false,
        end_date: null,
      });

      await sb.from(TABLES.VERIFICATION_ACTIVITY_LOGS).insert({
        action: 'verification_revoked',
        store_id: storeId,
        store_name: existing.store_name,
        details: `تم إلغاء توثيق "${existing.store_name}"`,
        performed_by: adminEmail || admin.email,
      });

      return success({ verification: await mapVerificationData(updated) });
    }

    return badRequest('Invalid action');
  } catch (error) {
    logger.error('Admin verifications PUT error', 'AdminVerifications', { error: (error as Error)?.message });
    const message = process.env.NODE_ENV === 'development'
      ? (error instanceof Error ? error.message : 'Unknown error')
      : 'حدث خطأ غير متوقع';
    return serverError(message);
  }
})

async function mapVerificationData(v: Record<string, unknown>) {
  let chatEnabled = false;
  try {
    const store = await findStoreById(v.store_id as string);
    chatEnabled = store?.chat_enabled ?? false;
  } catch { /* non-critical */ }

  return {
    storeId: v.store_id,
    userId: v.user_id,
    storeName: v.store_name,
    tier: v.tier || 'bronze',
    isActive: v.is_active,
    startDate: v.start_date || null,
    endDate: v.end_date || null,
    grantedBy: v.granted_by,
    chatEnabled,
  };
}
