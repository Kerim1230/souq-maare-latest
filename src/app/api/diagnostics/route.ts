export const runtime = 'nodejs'
/**
 * Detailed diagnostics endpoint (admin only).
 * Returns recent errors, slow queries, rate limit store summary,
 * circuit breaker states, memory usage details, and more.
 */

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/server/lib/auth-guard';
import { getRecentErrors, getEndpointStats } from '@/lib/error-tracker';
import { getSlowQueries, getQueryStats } from '@/lib/db-profiler';
import { getAllCircuitStates } from '@/lib/circuit-breaker';
import { getRateLimitSummary } from '@/server/lib/rate-limiter';
import { getBufferedLogs } from '@/lib/logger';
import { logger } from '@/lib/logger';
import { getPerfStats, checkMemory } from '@/lib/perf-monitor';
import { success, apiError } from '@/lib/api-response';
import { withRoute } from '@/server/lib/route-wrapper';

function getDetailedMemoryUsage() {
  const mem = process.memoryUsage();

  return {
    heapUsed: mem.heapUsed,
    heapTotal: mem.heapTotal,
    heapUsedFormatted: formatBytes(mem.heapUsed),
    heapTotalFormatted: formatBytes(mem.heapTotal),
    heapPercentage: mem.heapTotal > 0
      ? Math.round((mem.heapUsed / mem.heapTotal) * 1000) / 10
      : 0,
    rss: mem.rss,
    rssFormatted: formatBytes(mem.rss),
    external: mem.external,
    externalFormatted: formatBytes(mem.external),
    arrayBuffers: (mem as unknown as Record<string, number>).arrayBuffers || 0,
  };
}

function getProcessInfo() {
  return {
    pid: process.pid,
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
    uptime: Math.round(process.uptime()),
    uptimeFormatted: formatUptime(process.uptime()),
  };
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  const parts: string[] = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  parts.push(`${s}s`);
  return parts.join(' ');
}

export const GET = withRoute(async (request: NextRequest) => {
  // Auth check
  const auth = await requireAdmin(request);
  if (!auth.success) {
    return auth.response;
  }

  try {
    const recentErrors = getRecentErrors(50);
    const slowQueries = getSlowQueries(50);
    const queryStats = getQueryStats();
    const endpointStats = getEndpointStats();
    const circuitStates = getAllCircuitStates();
    const rateLimitSummary = getRateLimitSummary();
    const recentLogs = getBufferedLogs(50).map((b) => b.entry);
    const memory = getDetailedMemoryUsage();
    const processInfo = getProcessInfo();
    const perfStats = getPerfStats();
    const memoryCheck = checkMemory();

    // Estimate active requests (rough: count of trace IDs in recent logs)
    const recentTraceIds = new Set(
      recentLogs
        .filter((l) => l.traceId)
        .map((l) => l.traceId)
    );
    const estimatedActiveRequests = recentTraceIds.size;

    return success({
      timestamp: new Date().toISOString(),
      process: processInfo,
      memory,
      estimatedActiveRequests,
      errors: {
        recent: recentErrors,
        total: recentErrors.length,
        endpointStats,
      },
      queries: {
        slow: slowQueries,
        stats: queryStats,
      },
      rateLimits: rateLimitSummary,
      circuits: circuitStates,
      logs: {
        recent: recentLogs,
        buffered: recentLogs.length,
      },
      performance: {
        apiStats: perfStats,
        memoryStatus: memoryCheck,
      },
    });
  } catch (error) {
    logger.captureError(error, 'Diagnostics endpoint failed');

    return apiError('فشل في جمع بيانات التشخيص', 500, { code: 'DIAG_DIAGNOSTICS_FAILED' });
  }
})
