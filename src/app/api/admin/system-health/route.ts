export const runtime = 'nodejs'
import { NextRequest } from 'next/server';
import { requireAdmin } from '@/server/lib/admin-auth';
import { success, serverError } from '@/lib/api-response';
import { withRoute } from '@/server/lib/route-wrapper';
import { getSupabaseAdmin, TABLES, handleCount } from '@/lib/supabase-db';
import { isCloudinaryConfigured } from '@/lib/cloudinary';
import { logger } from '@/lib/logger';

export const GET = withRoute(async (request: NextRequest) => {
  const admin = await requireAdmin(request);
  if (!admin.success) return admin.response;

  try {
    // Server status - always "connected" if this endpoint responds
    const serverStatus = 'connected' as const;

    // Database status - try a simple Supabase query
    const sb = getSupabaseAdmin();
    let dbStatus: 'connected' | 'error' = 'connected';
    try {
      await sb.from(TABLES.USERS).select('id', { count: 'exact', head: true });
    } catch {
      dbStatus = 'error';
    }

    // Storage status - check Cloudinary configuration
    let storageStatus: 'connected' | 'error' = 'connected';
    try {
      const configured = await isCloudinaryConfigured();
      storageStatus = configured ? 'connected' : 'error';
    } catch {
      storageStatus = 'error';
    }

    // Active users (sessions valid in last 30 minutes)
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    let activeUsersCount = 0;
    try {
      activeUsersCount = handleCount(
        await sb.from(TABLES.USERS).select('*', { count: 'exact', head: true }).gte('updated_at', thirtyMinAgo),
        'activeUsers'
      );
    } catch {
      // fallback
    }

    // Server uptime
    const uptimeSeconds = process.uptime();

    // Memory usage
    const memory = process.memoryUsage();

    // Database stats
    const now = new Date().toISOString();
    const [totalUsers, totalStores, totalProducts, activeOffers, pendingReports] = await Promise.all([
      handleCount(await sb.from(TABLES.USERS).select('*', { count: 'exact', head: true }), 'totalUsers'),
      handleCount(await sb.from(TABLES.STORES).select('*', { count: 'exact', head: true }), 'totalStores'),
      handleCount(await sb.from(TABLES.PRODUCTS).select('*', { count: 'exact', head: true }), 'totalProducts'),
      handleCount(await sb.from(TABLES.STORE_OFFERS).select('*', { count: 'exact', head: true }).gt('expires_at', now), 'activeOffers'),
      handleCount(await sb.from(TABLES.REPORTS).select('*', { count: 'exact', head: true }).eq('status', 'new'), 'pendingReports'),
    ]);

    // Users active today
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const activeUsersToday = handleCount(
      await sb.from(TABLES.USERS).select('*', { count: 'exact', head: true }).gte('updated_at', todayStart.toISOString()),
      'activeUsersToday'
    );

    // New products last 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const newProducts7d = handleCount(
      await sb.from(TABLES.PRODUCTS).select('*', { count: 'exact', head: true }).gte('created_at', sevenDaysAgo),
      'newProducts7d'
    );

    // New users last 7 days
    const newUsers7d = handleCount(
      await sb.from(TABLES.USERS).select('*', { count: 'exact', head: true }).gte('created_at', sevenDaysAgo),
      'newUsers7d'
    );

    // Products by day (last 7 days)
    const productsByDay: { date: string; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const dayStart = new Date();
      dayStart.setDate(dayStart.getDate() - i);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);
      const count = handleCount(
        await sb.from(TABLES.PRODUCTS).select('*', { count: 'exact', head: true }).gte('created_at', dayStart.toISOString()).lt('created_at', dayEnd.toISOString()),
        'productsByDay'
      );
      productsByDay.push({ date: dayStart.toISOString().split('T')[0], count });
    }

    // Users by day (last 7 days)
    const usersByDay: { date: string; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const dayStart = new Date();
      dayStart.setDate(dayStart.getDate() - i);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);
      const count = handleCount(
        await sb.from(TABLES.USERS).select('*', { count: 'exact', head: true }).gte('created_at', dayStart.toISOString()).lt('created_at', dayEnd.toISOString()),
        'usersByDay'
      );
      usersByDay.push({ date: dayStart.toISOString().split('T')[0], count });
    }

    // Last 20 errors from AdminActivityLog where action contains 'خطأ' or 'error'
    const { data: recentErrors } = await sb
      .from(TABLES.ADMIN_ACTIVITY_LOGS)
      .select('*')
      .or('action.ilike.%خطأ%,action.ilike.%error%,action.ilike.%فشل%')
      .order('created_at', { ascending: false })
      .limit(20);

    return success({
      server: { status: serverStatus, uptime: uptimeSeconds, nodeVersion: process.version },
      database: { status: dbStatus, provider: 'supabase' },
      storage: { status: storageStatus, provider: 'cloudinary' },
      activeUsers: activeUsersCount,
      stats: {
        totalUsers,
        activeUsersToday,
        totalStores,
        totalProducts,
        activeOffers,
        pendingReports,
        newProducts7d,
        newUsers7d,
      },
      charts: {
        productsByDay,
        usersByDay,
      },
      recentErrors: (recentErrors || []).map((e: Record<string, unknown>) => ({
        id: e.id,
        time: e.created_at,
        type: e.target_type || 'unknown',
        message: e.details || e.action,
      })),
      memory: {
        rss: Math.round(memory.rss / 1024 / 1024),
        heapUsed: Math.round(memory.heapUsed / 1024 / 1024),
        heapTotal: Math.round(memory.heapTotal / 1024 / 1024),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('System health error', 'SystemHealth', { error: (error as Error)?.message });
    return serverError('حدث خطأ أثناء فحص حالة النظام');
  }
});
