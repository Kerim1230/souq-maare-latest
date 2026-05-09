export const runtime = 'nodejs'
import { NextRequest } from 'next/server';
import { requireAdmin } from '@/server/lib/admin-auth';
import { checkRateLimit, getClientIp, LIMITS } from '@/server/lib/rate-limiter';
import { success, badRequest, serverError, rateLimited } from '@/lib/api-response';
import { logger } from '@/lib/logger';
import { withRoute } from '@/server/lib/route-wrapper';
import { getSupabaseAdmin, getAppSetting, setAppSetting, logAdminActivity, TABLES, handleResponse } from '@/lib/supabase-db';

const DEFAULT_SETTINGS = {
  appMaintenance: false,
  allowNewStores: true,
  allowNewProducts: true,
  maxReportsPerDay: 5,
  autoBanThreshold: 10,
};

// GET /api/admin/activity — list activity log (+ optional app settings)
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
    const { searchParams } = new URL(request.url);
    const includeSettings = searchParams.get('settings') === 'true';

    // Activity log from Supabase
    const sb = getSupabaseAdmin();
    const { data: activityLog, error } = await sb
      .from(TABLES.ADMIN_ACTIVITY_LOGS)
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500);

    if (error) throw new Error(error.message);

    const mappedLog = (activityLog || []).map((row: Record<string, unknown>) => ({
      id: row.id,
      adminEmail: row.admin_email,
      action: row.action,
      targetType: row.target_type ?? undefined,
      targetId: row.target_id ?? undefined,
      targetName: row.target_name ?? undefined,
      details: row.details,
      createdAt: row.created_at,
    }));

    if (!includeSettings) {
      return success({ activityLog: mappedLog, source: 'database' });
    }

    // Also fetch settings from Supabase
    const settingsValue = await getAppSetting('admin_settings');
    let memSettings = { ...DEFAULT_SETTINGS };
    if (settingsValue) {
      try {
        const parsed = JSON.parse(settingsValue) as Partial<typeof DEFAULT_SETTINGS>;
        memSettings = {
          appMaintenance: parsed.appMaintenance ?? DEFAULT_SETTINGS.appMaintenance,
          allowNewStores: parsed.allowNewStores ?? DEFAULT_SETTINGS.allowNewStores,
          allowNewProducts: parsed.allowNewProducts ?? DEFAULT_SETTINGS.allowNewProducts,
          maxReportsPerDay: parsed.maxReportsPerDay ?? DEFAULT_SETTINGS.maxReportsPerDay,
          autoBanThreshold: parsed.autoBanThreshold ?? DEFAULT_SETTINGS.autoBanThreshold,
        };
      } catch { /* use defaults */ }
    }

    const settings = {
      appMaintenance: memSettings.appMaintenance,
      allowNewStores: memSettings.allowNewStores,
      allowNewProducts: memSettings.allowNewProducts,
      maxReportsPerDay: memSettings.maxReportsPerDay,
      autoBanThreshold: memSettings.autoBanThreshold,
    };

    return success({ activityLog: mappedLog, appSettings: settings, source: 'database' });
  } catch (err) {
    logger.error('Admin activity GET error', 'AdminActivity', { error: (err as Error)?.message });
    const message = process.env.NODE_ENV === 'development'
      ? (err instanceof Error ? err.message : 'Unknown error')
      : 'حدث خطأ غير متوقع';
    return serverError(message);
  }
})

// POST /api/admin/activity — log activity or update settings
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

    // Update settings
    if (body.action === 'update_settings') {
      const { settings: newSettings } = body as { settings: Record<string, unknown> };
      if (!newSettings) {
        return badRequest('settings are required');
      }

      // Get current settings, merge, then save
      const currentValue = await getAppSetting('admin_settings');
      let current = { ...DEFAULT_SETTINGS };
      if (currentValue) {
        try {
          current = { ...current, ...JSON.parse(currentValue) };
        } catch { /* use defaults */ }
      }
      const merged = { ...current, ...newSettings };
      await setAppSetting('admin_settings', JSON.stringify(merged));

      await logAdminActivity({
        action: 'تحديث الإعدادات',
        details: JSON.stringify(newSettings),
      });

      return success({ settings: merged, source: 'database' });
    }

    // Log activity
    const { action, targetType, targetId, targetName, details } = body as {
      action: string;
      targetType?: string;
      targetId?: string;
      targetName?: string;
      details?: string;
    };

    if (!action) {
      return badRequest('action is required');
    }

    const entry = await logAdminActivity({
      action,
      target_type: targetType || undefined,
      target_id: targetId || undefined,
      target_name: targetName || undefined,
      details: details || undefined,
    });

    return success({ entry, source: 'database' });
  } catch (error) {
    logger.error('Admin activity POST error', 'AdminActivity', { error: (error as Error)?.message });
    const message = process.env.NODE_ENV === 'development'
      ? (error instanceof Error ? error.message : 'Unknown error')
      : 'حدث خطأ غير متوقع';
    return serverError(message);
  }
})

/**
 * Re-export logAdminActivity for convenience (Supabase-backed).
 * Replaces the former logAdminAction which was Prisma-backed.
 */
export { logAdminActivity as logAdminAction } from '@/lib/supabase-db';
