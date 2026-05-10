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
 * GET /api/search?q=...&limit=10&type=all|products|stores|offers&governorate=...&city=...
 *
 * Aggregated search endpoint — returns products, stores, and offers
 * in a single request using Supabase/PostgreSQL.
 * Cached for 1 minute — search results are volatile.
 *
 * Optional location filters:
 *   ?governorate=دمشق   — filter stores/products/offers by governorate
 *   ?city=المزة          — filter stores/products/offers by city
 */
export const GET = withRoute(async (request: NextRequest) => {
  try {
    const rl = checkRateGuard(request, { category: 'search' });
    if (rl) return rl;

    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q')?.trim();
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '10', 10) || 10, 1), 50);
    const type = searchParams.get('type') || 'all';
    const governorate = searchParams.get('governorate')?.trim() || undefined;
    const city = searchParams.get('city')?.trim() || undefined;

    if (!query) {
      return success({ products: [], stores: [], offers: [] });
    }

    // Build cache key from search params (include location filters if present)
    const cacheKey = `search:q=${query}:limit=${limit}:type=${type}:gov=${governorate ?? ''}:city=${city ?? ''}`;

    const data = await cachedQuery(
      cacheKey,
      () => searchFromSupabase(query, limit, type, governorate, city),
      CACHE_TTL.SEARCH,
    );

    return success(data);
  } catch (error) {
    logger.error('Aggregated search error', 'Search', { error: (error as Error)?.message });
    return serverError('حدث خطأ أثناء البحث');
  }
});

// ── Supabase Search ────────────────────────────────────────────────────────────

async function searchFromSupabase(
  query: string,
  limit: number,
  type: string,
  governorate?: string,
  city?: string,
) {
  const sb = getSupabaseAdmin();
  const escaped = escapeIlike(query);
  const hasLocationFilter = !!(governorate || city);
  const tasks: Promise<void>[] = [];
  let products: any[] = [];
  let stores: any[] = [];
  let offers: any[] = [];

  if (type === 'all' || type === 'products') {
    // When filtering by location, use an inner join with stores so we can
    // filter on store.governorate / store.city
    // Note: If governorate/city columns don't exist yet, fall back to regular search
    const selectFields = hasLocationFilter
      ? '*, store:stores!inner(governorate, city)'
      : '*';

    let productQuery = sb
      .from(TABLES.PRODUCTS)
      .select(selectFields)
      .or(`name.ilike.%${escaped}%,description.ilike.%${escaped}%,category.ilike.%${escaped}%`);

    if (hasLocationFilter && governorate) productQuery = productQuery.eq('store.governorate', governorate);
    if (hasLocationFilter && city) productQuery = productQuery.eq('store.city', city);

    tasks.push(
      productQuery
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
    let storeQuery = sb
      .from(TABLES.STORES)
      .select('*')
      .or(`name.ilike.%${escaped}%,description.ilike.%${escaped}%,category.ilike.%${escaped}%`);

    if (hasLocationFilter && governorate) storeQuery = storeQuery.eq('governorate', governorate);
    if (hasLocationFilter && city) storeQuery = storeQuery.eq('city', city);

    tasks.push(
      storeQuery
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
    // When filtering by location, use an inner join with stores
    const offerSelect = hasLocationFilter
      ? '*, store:stores!inner(name, governorate, city)'
      : '*, store:stores(name)';

    let offerQuery = sb
      .from(TABLES.STORE_OFFERS)
      .select(offerSelect)
      .or(`title.ilike.%${escaped}%,description.ilike.%${escaped}%`);

    if (hasLocationFilter && governorate) offerQuery = offerQuery.eq('store.governorate', governorate);
    if (hasLocationFilter && city) offerQuery = offerQuery.eq('store.city', city);

    tasks.push(
      offerQuery
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
