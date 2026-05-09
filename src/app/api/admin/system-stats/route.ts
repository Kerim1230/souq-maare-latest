export const runtime = 'nodejs'
import { NextRequest } from 'next/server';
import { requireAdmin } from '@/server/lib/auth-guard';
import { success, serverError } from '@/lib/api-response';
import { withRoute } from '@/server/lib/route-wrapper';
import { getSupabaseAdmin, TABLES, handleCount } from '@/lib/supabase-db';
import { logger } from '@/lib/logger';

/**
 * GET /api/admin/system-stats
 * Returns live system statistics for the admin monitoring dashboard.
 * Protected by requireAdmin.
 */
export const GET = withRoute(async (request: NextRequest) => {
  const admin = await requireAdmin(request);
  if (!admin.success) return admin.response;

  try {
    // System-level stats
    const memory = process.memoryUsage();
    const uptime = process.uptime();
    const cpu = process.cpuUsage();
    const nodeVersion = process.version;

    // Database-level stats (parallel queries for speed)
    const sb = getSupabaseAdmin();
    const [userCount, productCount, storeCount, orderCount, reportCount] = await Promise.all([
      handleCount(await sb.from(TABLES.USERS).select('*', { count: 'exact', head: true }), 'userCount'),
      handleCount(await sb.from(TABLES.PRODUCTS).select('*', { count: 'exact', head: true }), 'productCount'),
      handleCount(await sb.from(TABLES.STORES).select('*', { count: 'exact', head: true }), 'storeCount'),
      handleCount(await sb.from(TABLES.ORDERS).select('*', { count: 'exact', head: true }), 'orderCount'),
      handleCount(await sb.from(TABLES.REPORTS).select('*', { count: 'exact', head: true }), 'reportCount'),
    ]);

    return success({
      memory: {
        rss: Math.round(memory.rss / 1024 / 1024),           // MB
        heapUsed: Math.round(memory.heapUsed / 1024 / 1024),  // MB
        heapTotal: Math.round(memory.heapTotal / 1024 / 1024), // MB
        external: Math.round(memory.external / 1024 / 1024),   // MB
      },
      uptime: Math.round(uptime),
      uptimeFormatted: formatUptime(uptime),
      cpu: {
        user: cpu.user,
        system: cpu.system,
      },
      nodeVersion,
      dbStats: {
        users: userCount,
        products: productCount,
        stores: storeCount,
        orders: orderCount,
        reports: reportCount,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('System stats error', 'SystemStats', { error: (error as Error)?.message });
    return serverError('حدث خطأ أثناء جلب إحصائيات النظام');
  }
});

/** Format uptime seconds into a human-readable string */
function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  parts.push(`${secs}s`);

  return parts.join(' ');
}
