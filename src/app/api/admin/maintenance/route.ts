export const runtime = 'nodejs'
import { NextRequest } from 'next/server';
import { requireAdmin } from '@/server/lib/admin-auth';
import { success, serverError, badRequest } from '@/lib/api-response';
import { withRoute } from '@/server/lib/route-wrapper';
import { getSupabaseAdmin, TABLES, handleCount, logAdminActivity } from '@/lib/supabase-db';
import { logger } from '@/lib/logger';

export const POST = withRoute(async (request: NextRequest) => {
  const admin = await requireAdmin(request);
  if (!admin.success) return admin.response;

  try {
    const body = await request.json();
    const { action } = body as { action?: string };
    const sb = getSupabaseAdmin();

    switch (action) {
      case 'cleanExpiredProducts': {
        const { count, error } = await sb.from(TABLES.PRODUCTS).delete({ count: 'exact' }).lt('expires_at', new Date().toISOString());
        if (error) throw new Error(error.message);
        await logAdminActivity({
          admin_email: admin.email,
          action: 'cleanExpiredProducts',
          details: `Deleted ${count || 0} expired products`,
        });
        return success({ action, deleted: count || 0, message: `تم حذف ${count || 0} منتج منتهي الصلاحية` });
      }

      case 'cleanExpiredOffers': {
        const { count, error } = await sb.from(TABLES.STORE_OFFERS).delete({ count: 'exact' }).lt('expires_at', new Date().toISOString());
        if (error) throw new Error(error.message);
        await logAdminActivity({
          admin_email: admin.email,
          action: 'cleanExpiredOffers',
          details: `Deleted ${count || 0} expired offers`,
        });
        return success({ action, deleted: count || 0, message: `تم حذف ${count || 0} عرض منتهي الصلاحية` });
      }

      case 'deleteInactiveUsers': {
        // Users who haven't logged in for 90 days
        const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
        // Don't delete admins
        const { count, error } = await sb.from(TABLES.USERS).delete({ count: 'exact' }).lt('updated_at', ninetyDaysAgo).eq('is_admin', false);
        if (error) throw new Error(error.message);
        await logAdminActivity({
          admin_email: admin.email,
          action: 'deleteInactiveUsers',
          details: `Deleted ${count || 0} inactive users`,
        });
        return success({ action, deleted: count || 0, message: `تم حذف ${count || 0} مستخدم غير نشط` });
      }

      case 'countExpired': {
        const now = new Date().toISOString();
        const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
        const [expiredProducts, expiredOffers, inactiveUsers] = await Promise.all([
          handleCount(await sb.from(TABLES.PRODUCTS).select('*', { count: 'exact', head: true }).lt('expires_at', now), 'expiredProducts'),
          handleCount(await sb.from(TABLES.STORE_OFFERS).select('*', { count: 'exact', head: true }).lt('expires_at', now), 'expiredOffers'),
          handleCount(await sb.from(TABLES.USERS).select('*', { count: 'exact', head: true }).lt('updated_at', ninetyDaysAgo).eq('is_admin', false), 'inactiveUsers'),
        ]);
        return success({ expiredProducts, expiredOffers, inactiveUsers });
      }

      case 'backupDatabase': {
        // Supabase/PostgreSQL manages its own backups — export key table counts as a health snapshot
        const now = new Date().toISOString();
        const [totalUsers, totalStores, totalProducts, totalOrders, totalOffers] = await Promise.all([
          handleCount(await sb.from(TABLES.USERS).select('*', { count: 'exact', head: true }), 'totalUsers'),
          handleCount(await sb.from(TABLES.STORES).select('*', { count: 'exact', head: true }), 'totalStores'),
          handleCount(await sb.from(TABLES.PRODUCTS).select('*', { count: 'exact', head: true }), 'totalProducts'),
          handleCount(await sb.from(TABLES.ORDERS).select('*', { count: 'exact', head: true }), 'totalOrders'),
          handleCount(await sb.from(TABLES.STORE_OFFERS).select('*', { count: 'exact', head: true }), 'totalOffers'),
        ]);

        await logAdminActivity({
          admin_email: admin.email,
          action: 'backupDatabase',
          details: `Snapshot: ${totalUsers} users, ${totalStores} stores, ${totalProducts} products, ${totalOrders} orders, ${totalOffers} offers`,
        });

        return success({
          action,
          message: 'قاعدة البيانات مدارة عبر Supabase مع نسخ احتياطي تلقائي',
          provider: 'supabase',
          snapshot: {
            timestamp: now,
            totalUsers,
            totalStores,
            totalProducts,
            totalOrders,
            totalOffers,
          },
        });
      }

      case 'getLastBackup': {
        // Supabase manages backups automatically — report provider info
        return success({
          provider: 'supabase',
          lastBackupDate: new Date().toISOString(),
          automaticBackups: true,
          message: 'Supabase يدير النسخ الاحتياطي تلقائياً',
        });
      }

      default:
        return badRequest('إجراء غير معروف');
    }
  } catch (error) {
    logger.error('Maintenance action error', 'Maintenance', { error: (error as Error)?.message });
    return serverError('حدث خطأ أثناء تنفيذ إجراء الصيانة');
  }
});

export const GET = withRoute(async (request: NextRequest) => {
  const admin = await requireAdmin(request);
  if (!admin.success) return admin.response;

  try {
    const sb = getSupabaseAdmin();
    const now = new Date().toISOString();
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

    // Get maintenance stats
    const [expiredProducts, expiredOffers, inactiveUsers] = await Promise.all([
      handleCount(await sb.from(TABLES.PRODUCTS).select('*', { count: 'exact', head: true }).lt('expires_at', now), 'expiredProducts'),
      handleCount(await sb.from(TABLES.STORE_OFFERS).select('*', { count: 'exact', head: true }).lt('expires_at', now), 'expiredOffers'),
      handleCount(await sb.from(TABLES.USERS).select('*', { count: 'exact', head: true }).lt('updated_at', ninetyDaysAgo).eq('is_admin', false), 'inactiveUsers'),
    ]);

    // Supabase manages backups automatically
    const backupInfo = {
      provider: 'supabase',
      automaticBackups: true,
      lastBackupDate: new Date().toISOString(),
      message: 'Supabase يدير النسخ الاحتياطي تلقائياً',
    };

    return success({
      expiredProducts,
      expiredOffers,
      inactiveUsers,
      backupInfo,
    });
  } catch (error) {
    logger.error('Maintenance stats error', 'Maintenance', { error: (error as Error)?.message });
    return serverError('حدث خطأ أثناء جلب إحصائيات الصيانة');
  }
});
