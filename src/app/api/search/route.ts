export const runtime = 'nodejs'
import { NextRequest } from 'next/server';
import { checkRateGuard } from '@/server/lib/rate-guard';
import { success, serverError } from '@/lib/api-response';
import { logger } from '@/lib/logger';
import { withRoute } from '@/server/lib/route-wrapper';
import { getSupabaseAdmin, TABLES } from '@/lib/supabase-db';
import { mapProduct, mapStore, mapOffer } from '@/lib/api-utils';
import { cachedQuery, CACHE_TTL } from '@/lib/cache';

/**
 * Escape special characters in a search query for PostgreSQL ILIKE patterns.
 * Replaces % → \% and _ → \_ to prevent them from being treated as wildcards.
 */
function escapeIlike(str: string): string {
  return str.replace(/%/g, '\\%').replace(/_/g, '\\_');
}

/**
 * GET /api/search?q=...&limit=10&type=all|products|stores|offers
 *
 * Aggregated search endpoint — returns products, stores, and offers
 * in a single request using Supabase/PostgreSQL.
 * Cached for 1 minute — search results are volatile.
 */
export const GET = withRoute(async (request: NextRequest) => {
  try {
    const rl = checkRateGuard(request, { category: 'search' });
    if (rl) return rl;

    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q')?.trim();
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '10', 10) || 10, 1), 50);
    const type = searchParams.get('type') || 'all';

    if (!query) {
      return success({ products: [], stores: [], offers: [] });
    }

    // Build cache key from search params
    const cacheKey = `search:q=${query}:limit=${limit}:type=${type}`;

    const data = await cachedQuery(
      cacheKey,
      () => searchFromSupabase(query, limit, type),
      CACHE_TTL.SEARCH,
    );

    return success(data);
  } catch (error) {
    logger.error('Aggregated search error', 'Search', { error: (error as Error)?.message });
    return serverError('حدث خطأ أثناء البحث');
  }
});

// ── Supabase Search ────────────────────────────────────────────────────────────

async function searchFromSupabase(query: string, limit: number, type: string) {
  const sb = getSupabaseAdmin();
  const escaped = escapeIlike(query);
  const tasks: Promise<void>[] = [];
  let products: any[] = [];
  let stores: any[] = [];
  let offers: any[] = [];

  if (type === 'all' || type === 'products') {
    tasks.push(
      sb
        .from(TABLES.PRODUCTS)
        .select('*')
        .or(`name.ilike.%${escaped}%,description.ilike.%${escaped}%,category.ilike.%${escaped}%`)
        .order('created_at', { ascending: false })
        .limit(limit)
        .then(({ data, error }) => {
          if (error) {
            logger.warn('Product search failed', 'Search', { error: error.message });
            return;
          }
          products = (data || []).map((p: any) => ({
            ...mapProduct(p),
            title: p.name,
          }));
        })
        .catch((err) => { logger.warn('Product search failed', 'Search', { error: (err as Error)?.message }); }),
    );
  }

  if (type === 'all' || type === 'stores') {
    tasks.push(
      sb
        .from(TABLES.STORES)
        .select('*')
        .or(`name.ilike.%${escaped}%,description.ilike.%${escaped}%,category.ilike.%${escaped}%`)
        .order('created_at', { ascending: false })
        .limit(limit)
        .then(({ data, error }) => {
          if (error) {
            logger.warn('Store search failed', 'Search', { error: error.message });
            return;
          }
          stores = (data || []).map((s: any) => mapStore(s));
        })
        .catch((err) => { logger.warn('Store search failed', 'Search', { error: (err as Error)?.message }); }),
    );
  }

  if (type === 'all' || type === 'offers') {
    tasks.push(
      sb
        .from(TABLES.STORE_OFFERS)
        .select('*, store:stores(name)')
        .or(`title.ilike.%${escaped}%,description.ilike.%${escaped}%`)
        .order('created_at', { ascending: false })
        .limit(limit)
        .then(({ data, error }) => {
          if (error) {
            logger.warn('Offer search failed', 'Search', { error: error.message });
            return;
          }
          offers = (data || []).map((o: any) => ({
            ...mapOffer(o),
            store_name: o.store?.name || null,
          }));
        })
        .catch((err) => { logger.warn('Offer search failed', 'Search', { error: (err as Error)?.message }); }),
    );
  }

  await Promise.allSettled(tasks);

  return { products, stores, offers };
}
