export const runtime = 'nodejs';
import { NextRequest } from 'next/server';
import { requireAdmin } from '@/server/lib/auth-guard';
import { success, serverError } from '@/lib/api-response';
import { withRoute } from '@/server/lib/route-wrapper';
import { getSupabaseAdmin, TABLES } from '@/lib/supabase-db';

// ── In-memory cache (5 min TTL) ────────────────────────────────────────────
let cachedData: Record<string, unknown> | null = null;
let cachedAt = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// ── Supabase Free Tier Limits ──────────────────────────────────────────────
const SUPABASE_FREE_DB_LIMIT_MB = 500;
const SUPABASE_FREE_DB_LIMIT_BYTES = SUPABASE_FREE_DB_LIMIT_MB * 1024 * 1024;

// ── Cloudinary Free Tier Limits ────────────────────────────────────────────
const CLOUDINARY_FREE_STORAGE_GB = 25;
const CLOUDINARY_FREE_TRANSFORMATIONS = 25000;
const CLOUDINARY_FREE_BANDWIDTH_GB = 25;
const CLOUDINARY_FREE_CREDITS = 25;

/**
 * GET /api/admin/system-usage
 * Returns system resource usage: database size, Cloudinary usage, and table counts.
 * Protected by requireAdmin. Results are cached for 5 minutes.
 */
export const GET = withRoute(async (request: NextRequest) => {
  const admin = await requireAdmin(request);
  if (!admin.success) return admin.response;

  // Return cached data if fresh
  const now = Date.now();
  if (cachedData && (now - cachedAt) < CACHE_TTL_MS) {
    return success({
      ...cachedData,
      cached: true,
      cachedAgo: Math.round((now - cachedAt) / 1000),
    });
  }

  try {
    const sb = getSupabaseAdmin();

    // ── 1. Database Size ─────────────────────────────────────────────────
    let dbSizeBytes = 0;
    let dbSizeMB = 0;
    let dbPercent = 0;
    try {
      const { data: dbSizeResult, error: dbSizeError } = await sb.rpc('get_database_size');
      if (!dbSizeError && dbSizeResult) {
        dbSizeBytes = Number(dbSizeResult);
        dbSizeMB = Math.round((dbSizeBytes / (1024 * 1024)) * 100) / 100;
        dbPercent = Math.round((dbSizeBytes / SUPABASE_FREE_DB_LIMIT_BYTES) * 10000) / 100;
      }
    } catch (err) {
      console.warn('[system-usage] get_database_size RPC not available:', err);
    }

    const dbRemainingMB = Math.max(0, Math.round((SUPABASE_FREE_DB_LIMIT_MB - dbSizeMB) * 100) / 100);

    // ── 2. Cloudinary Usage ──────────────────────────────────────────────
    let cloudinaryData: Record<string, unknown> = {
      available: false,
      error: 'Cloudinary credentials not configured',
    };

    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (cloudName && apiKey && apiSecret) {
      try {
        const authHeader = 'Basic ' + Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');
        const response = await fetch(
          `https://api.cloudinary.com/v1_1/${cloudName}/usage`,
          {
            headers: { Authorization: authHeader },
            signal: AbortSignal.timeout(10000), // 10s timeout
          }
        );

        if (response.ok) {
          const usage = await response.json();

          const storageUsage = usage.storage?.usage || 0; // bytes
          const storageLimit = usage.storage?.limit || CLOUDINARY_FREE_STORAGE_GB * 1024 * 1024 * 1024;
          const storagePercent = storageLimit > 0 ? Math.round((storageUsage / storageLimit) * 10000) / 100 : 0;

          const transformationsUsage = usage.transformations?.usage || 0;
          const transformationsLimit = usage.transformations?.limit || CLOUDINARY_FREE_TRANSFORMATIONS;
          const transformationsPercent = transformationsLimit > 0 ? Math.round((transformationsUsage / transformationsLimit) * 10000) / 100 : 0;

          const bandwidthUsage = usage.bandwidth?.usage || 0; // bytes
          const bandwidthLimit = usage.bandwidth?.limit || CLOUDINARY_FREE_BANDWIDTH_GB * 1024 * 1024 * 1024;
          const bandwidthPercent = bandwidthLimit > 0 ? Math.round((bandwidthUsage / bandwidthLimit) * 10000) / 100 : 0;

          const creditsUsage = usage.credits?.usage || 0;
          const creditsLimit = usage.credits?.limit || CLOUDINARY_FREE_CREDITS;
          const creditsPercent = creditsLimit > 0 ? Math.round((creditsUsage / creditsLimit) * 10000) / 100 : 0;

          const storageUsedGB = Math.round((storageUsage / (1024 * 1024 * 1024)) * 1000) / 1000;
          const storageLimitGB = Math.round((storageLimit / (1024 * 1024 * 1024)) * 100) / 100;
          const bandwidthUsedGB = Math.round((bandwidthUsage / (1024 * 1024 * 1024)) * 1000) / 1000;
          const bandwidthLimitGB = Math.round((bandwidthLimit / (1024 * 1024 * 1024)) * 100) / 100;

          // Rate limit info
          const rateLimitRemaining = response.headers.get('x-featureratelimit-remaining');
          const rateLimitReset = response.headers.get('x-featureratelimit-reset');

          cloudinaryData = {
            available: true,
            storage: {
              usedBytes: storageUsage,
              usedGB: storageUsedGB,
              limitGB: storageLimitGB,
              percent: storagePercent,
              remainingGB: Math.max(0, Math.round((storageLimitGB - storageUsedGB) * 1000) / 1000),
            },
            transformations: {
              usage: transformationsUsage,
              limit: transformationsLimit,
              percent: transformationsPercent,
              remaining: Math.max(0, transformationsLimit - transformationsUsage),
            },
            bandwidth: {
              usedBytes: bandwidthUsage,
              usedGB: bandwidthUsedGB,
              limitGB: bandwidthLimitGB,
              percent: bandwidthPercent,
              remainingGB: Math.max(0, Math.round((bandwidthLimitGB - bandwidthUsedGB) * 1000) / 1000),
            },
            credits: {
              usage: creditsUsage,
              limit: creditsLimit,
              percent: creditsPercent,
              remaining: Math.max(0, creditsLimit - creditsUsage),
            },
            rateLimit: {
              remaining: rateLimitRemaining ? parseInt(rateLimitRemaining) : null,
              resetAt: rateLimitReset || null,
            },
            lastUpdated: usage.last_updated || null,
          };
        } else {
          cloudinaryData = { available: false, error: `Cloudinary API returned ${response.status}` };
        }
      } catch (err) {
        console.warn('[system-usage] Cloudinary API error:', err);
        cloudinaryData = { available: false, error: 'Failed to fetch Cloudinary usage' };
      }
    }

    // ── 3. Table Counts ──────────────────────────────────────────────────
    const [usersCount, storesCount, productsCount, offersCount] = await Promise.all([
      sb.from(TABLES.USERS).select('*', { count: 'exact', head: true }),
      sb.from(TABLES.STORES).select('*', { count: 'exact', head: true }),
      sb.from(TABLES.PRODUCTS).select('*', { count: 'exact', head: true }),
      sb.from(TABLES.STORE_OFFERS).select('*', { count: 'exact', head: true }),
    ]);

    const result = {
      database: {
        sizeBytes: dbSizeBytes,
        sizeMB: dbSizeMB,
        limitMB: SUPABASE_FREE_DB_LIMIT_MB,
        percent: dbPercent,
        remainingMB: dbRemainingMB,
        plan: 'Free',
      },
      cloudinary: cloudinaryData,
      counts: {
        users: usersCount.count ?? 0,
        stores: storesCount.count ?? 0,
        products: productsCount.count ?? 0,
        offers: offersCount.count ?? 0,
      },
      timestamp: new Date().toISOString(),
    };

    // Cache the result
    cachedData = result;
    cachedAt = now;

    return success({ ...result, cached: false });
  } catch (err) {
    console.error('[system-usage] Error:', err);
    return serverError('فشل في جلب بيانات استخدام النظام');
  }
});
