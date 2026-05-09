export const runtime = 'nodejs'
import { withRoute } from '@/server/lib/route-wrapper';
import { getAllCategories } from '@/lib/supabase-db';
import { success, serverError } from '@/lib/api-response';
import { logger } from '@/lib/logger';
import { cachedQuery, CACHE_TTL, serverCache } from '@/lib/cache';

/**
 * GET /api/categories
 * Returns all categories from the Category table (250 Syrian marketplace categories).
 * Cached for 10 minutes — categories rarely change.
 */
export const GET = withRoute(async () => {
  try {
    const categories = await cachedQuery(
      'categories:all',
      () => getAllCategories(),
      CACHE_TTL.CATEGORIES,
    );
    return success({ categories });
  } catch (err) {
    logger.warn('Categories fetch failed', 'Categories', { error: (err as Error)?.message });
    return serverError('حدث خطأ أثناء جلب التصنيفات');
  }
})
