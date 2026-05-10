export const runtime = 'nodejs'
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin, TABLES, handleCount } from '@/lib/supabase-db';
import { mapProduct, mapStore } from '@/lib/api-utils';
import { checkRateGuard } from '@/server/lib/rate-guard';
import { logger } from '@/lib/logger';
import { perfTimer, checkMemory } from '@/lib/perf-monitor';
import { success, serverError } from '@/lib/api-response';
import { withRoute } from '@/server/lib/route-wrapper';
import { cachedQuery, CACHE_TTL, serverCache } from '@/lib/cache';

const FEATURED_PRODUCTS_LIMIT = 3;
const NEW_PRODUCTS_LIMIT = 3;

function parsePositiveInt(value: string | null, fallback: number): number {
  if (!value) return fallback;
  const n = parseInt(value, 10);
  return Number.isFinite(n) && n >= 1 ? n : fallback;
}

/**
 * GET /api/home?userId=xxx&fpPage=1&npPage=1
 * Combined endpoint that returns home data with server-side pagination.
 * - featured_products: paginated (10 per page)
 * - new_products: paginated (10 per page)
 * - featured_stores: all (horizontal scroll)
 * - offers: all (carousel)
 *
 * Caching strategy: Base data is cached for 2 minutes (shared across users).
 * User-specific follow data is fetched separately after cache hit.
 */
export const GET = withRoute(async (request: NextRequest) => {
  const timer = perfTimer('/api/home');
  try {
    const rl = checkRateGuard(request, { category: 'search' });
    if (rl) return rl;

    const userId = request.nextUrl.searchParams.get('userId');
    const fpPage = parsePositiveInt(request.nextUrl.searchParams.get('fpPage'), 1);
    const npPage = parsePositiveInt(request.nextUrl.searchParams.get('npPage'), 1);
    const fpOffset = (fpPage - 1) * FEATURED_PRODUCTS_LIMIT;
    const npOffset = (npPage - 1) * NEW_PRODUCTS_LIMIT;

    const result = await getHomeData(userId, fpOffset, FEATURED_PRODUCTS_LIMIT, npOffset, NEW_PRODUCTS_LIMIT);

    // Add Cache-Control for client-side and CDN caching
    if (result instanceof NextResponse) {
      result.headers.set('Cache-Control', 'public, max-age=30, s-maxage=30');
    }

    return result;
  } catch (error) {
    logger.error('Home data fetch error', 'Home', { error: (error as Error)?.message });
    return serverError('حدث خطأ أثناء تحميل البيانات');
  } finally {
    timer.end();
    checkMemory();
  }
})

interface HomeBaseData {
  featuredProducts: any[];
  featuredTotal: number;
  newProducts: any[];
  newTotal: number;
  featuredStores: any[];
  offers: any[];
}

async function getHomeData(userId: string | null, fpOffset: number, fpLimit: number, npOffset: number, npLimit: number) {
  // Cache base data (shared across all users) with pagination in the key
  const cacheKey = `home:base:fp=${fpOffset}:${fpLimit}:np=${npOffset}:${npLimit}`;

  const baseData = await cachedQuery<HomeBaseData>(
    cacheKey,
    async () => {
      const sb = getSupabaseAdmin();

      const [
        featuredProductsRes,
        featuredTotalRes,
        newProductsRes,
        newTotalRes,
        featuredStoresRes,
        offersRes,
      ] = await Promise.all([
        // Featured products with store join
        sb
          .from(TABLES.PRODUCTS)
          .select('*, store:stores(id, name, logo_url, is_verified)')
          .eq('is_featured', true)
          .order('created_at', { ascending: false })
          .range(fpOffset, fpOffset + fpLimit - 1),
        // Featured products count
        sb
          .from(TABLES.PRODUCTS)
          .select('*', { count: 'exact', head: true })
          .eq('is_featured', true),
        // New products with store join
        sb
          .from(TABLES.PRODUCTS)
          .select('*, store:stores(id, name, logo_url, is_verified)')
          .eq('is_new', true)
          .order('created_at', { ascending: false })
          .range(npOffset, npOffset + npLimit - 1),
        // New products count
        sb
          .from(TABLES.PRODUCTS)
          .select('*', { count: 'exact', head: true })
          .eq('is_new', true),
        // Featured stores (reduced for performance)
        sb
          .from(TABLES.STORES)
          .select('*')
          .eq('is_featured', true)
          .order('created_at', { ascending: false })
          .limit(5),
        // Offers with store join (reduced for performance)
        sb
          .from(TABLES.STORE_OFFERS)
          .select('*, store:stores(name, theme_color)')
          .order('created_at', { ascending: false })
          .limit(5),
      ]);

      return {
        featuredProducts: featuredProductsRes.data || [],
        featuredTotal: handleCount(featuredTotalRes, 'home/featuredTotal'),
        newProducts: newProductsRes.data || [],
        newTotal: handleCount(newTotalRes, 'home/newTotal'),
        featuredStores: featuredStoresRes.data || [],
        offers: offersRes.data || [],
      };
    },
    CACHE_TTL.HOME,
  );

  // Fetch user-specific follow data (not cached — lightweight query)
  const storeIds = baseData.featuredStores.map(s => s.id);
  const followerCounts: Record<string, number> = {};
  const followStatus: Record<string, boolean> = {};

  if (storeIds.length > 0) {
    // Try to get follower counts from a shorter cache
    const followerCacheKey = `home:followers:${storeIds.sort().join(',')}`;
    const cachedFollowers = serverCache.get<Record<string, number>>(followerCacheKey);

    if (cachedFollowers) {
      Object.assign(followerCounts, cachedFollowers);
    }

    // Fetch follower counts AND user follow status in parallel
    const [followerResult, userFollowResult] = await Promise.all([
      cachedFollowers
        ? Promise.resolve(null)
        : getSupabaseAdmin()
            .from(TABLES.STORE_FOLLOWS)
            .select('store_id')
            .in('store_id', storeIds),
      userId
        ? getSupabaseAdmin()
            .from(TABLES.STORE_FOLLOWS)
            .select('store_id')
            .eq('user_id', userId)
            .in('store_id', storeIds)
        : Promise.resolve(null),
    ]);

    if (!cachedFollowers && followerResult?.data) {
      for (const f of followerResult.data) {
        followerCounts[f.store_id] = (followerCounts[f.store_id] || 0) + 1;
      }
      serverCache.set(followerCacheKey, { ...followerCounts }, CACHE_TTL.HOME);
    }

    if (userFollowResult?.data) {
      for (const f of userFollowResult.data) followStatus[f.store_id] = true;
    }
  }

  return success({
    featured_products: baseData.featuredProducts.map((p: any) => ({
      ...mapProduct(p),
      store_name: p.store?.name || null,
      store_logo: p.store?.logo_url || null,
      store_verified: p.store?.is_verified || false,
    })),
    new_products: baseData.newProducts.map((p: any) => ({
      ...mapProduct(p),
      store_name: p.store?.name || null,
      store_logo: p.store?.logo_url || null,
      store_verified: p.store?.is_verified || false,
    })),
    featured_stores: baseData.featuredStores.map((s: any) => ({
      ...mapStore(s),
      followers_count: followerCounts[s.id] || 0,
      is_following: followStatus[s.id] || false,
    })),
    offers: baseData.offers.map((o: any) => ({
      id: o.id,
      store_id: o.store_id || null,
      title: o.title || '',
      description: o.description || '',
      image_url: o.image_url || null,
      type: o.type || 'offer',
      discount: o.discount || null,
      expires_at: typeof o.expires_at === 'string' ? o.expires_at : o.expires_at?.toISOString?.() || null,
      store_name: o.store?.name || null,
      store_theme_color: o.store?.theme_color || null,
    })),
    featured_total: baseData.featuredTotal,
    new_total: baseData.newTotal,
  });
}
