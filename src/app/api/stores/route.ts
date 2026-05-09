export const runtime = 'nodejs'
import { withRoute } from '@/server/lib/route-wrapper';
import { NextRequest } from 'next/server';
import { checkRateGuard } from '@/server/lib/rate-guard';
import { logger } from '@/lib/logger';
import { success, notFound, serverError } from '@/lib/api-response';
import { getSupabaseAdmin, TABLES, countFollowers, findFollow, handleResponse } from '@/lib/supabase-db';
import { mapStore } from '@/lib/api-utils';
import { cachedQuery, CACHE_TTL, serverCache } from '@/lib/cache';

/**
 * GET /api/stores?search=...&id=...&is_featured=true&userId=...&limit=...
 *
 * Caching strategy: Base store data is cached for 5 minutes.
 * User-specific follow data is fetched separately after cache hit.
 * Mutations (in other routes) should invalidate the 'stores:' prefix.
 */
export const GET = withRoute(async (request: NextRequest) => {
  try {
    const rl = checkRateGuard(request, { category: 'search' });
    if (rl) return rl;

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || undefined;
    const userId = searchParams.get('userId') || undefined;
    const id = searchParams.get('id');
    const isFeatured = searchParams.get('is_featured');
    const limit = searchParams.get('limit')
      ? Math.min(parseInt(searchParams.get('limit')!, 10), 200)
      : undefined;

    // ── Single store by ID ──
    if (id) {
      const cacheKey = `stores:single:${id}`;
      const store = await cachedQuery<any>(
        cacheKey,
        async () => {
          const sb = getSupabaseAdmin();
          const { data, error } = await sb
            .from(TABLES.STORES)
            .select('*')
            .eq('id', id)
            .maybeSingle();
          if (error || !data) return null;
          return data;
        },
        CACHE_TTL.STORES,
      );

      if (!store) {
        return notFound('المتجر غير موجود');
      }

      // User-specific follow data (not cached per-user)
      const followersCount = await countFollowers(id);
      let isFollowing = false;
      if (userId) {
        const follow = await findFollow(userId, id);
        isFollowing = !!follow;
      }

      return success({
        stores: [{
          ...mapStore(store),
          followers_count: followersCount,
          is_following: isFollowing,
        }],
      });
    }

    // ── List stores ──
    // Build cache key from query params (excluding userId — that's user-specific)
    const limitNum = Math.min(limit || 50, 200);
    const listCacheKey = `stores:list:featured=${isFeatured || 'any'}:search=${search || 'none'}:limit=${limitNum}`;

    const stores = await cachedQuery<any[]>(
      listCacheKey,
      async () => {
        const sb = getSupabaseAdmin();
        let query = sb
          .from(TABLES.STORES)
          .select('*')
          .order('created_at', { ascending: false })
          .limit(limitNum);

        if (isFeatured === 'true') {
          query = query.eq('is_featured', true);
        }

        // Note: userId filter is for "my stores" — we don't cache that per user
        // because it's a lightweight query and user-specific
        if (userId) {
          query = query.eq('user_id', userId);
        }

        if (search) {
          query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%,category.ilike.%${search}%`);
        }

        return handleResponse(await query, 'stores.findAll');
      },
      CACHE_TTL.STORES,
    );

    if (stores.length === 0) {
      return success({ stores: [] });
    }

    // Get follow data for all stores (user-specific, not cached per-user)
    const storeIds = stores.map((s: { id: string }) => s.id);
    const followerCounts: Record<string, number> = {};
    const followStatus: Record<string, boolean> = {};

    try {
      const sb = getSupabaseAdmin();
      const { data: follows } = await sb
        .from(TABLES.STORE_FOLLOWS)
        .select('store_id')
        .in('store_id', storeIds);

      for (const f of (follows || [])) {
        followerCounts[f.store_id] = (followerCounts[f.store_id] || 0) + 1;
      }

      if (userId) {
        const { data: userFollows } = await sb
          .from(TABLES.STORE_FOLLOWS)
          .select('store_id')
          .eq('user_id', userId)
          .in('store_id', storeIds);

        for (const f of (userFollows || [])) {
          followStatus[f.store_id] = true;
        }
      }
    } catch {
      // Follow table may not exist
    }

    const mappedStores = stores.map((s: Record<string, unknown>) => ({
      ...mapStore(s),
      followers_count: followerCounts[s.id as string] || 0,
      is_following: followStatus[s.id as string] || false,
    }));

    return success({ stores: mappedStores });
  } catch (error) {
    logger.error('Stores fetch error', 'Stores', { error: (error as Error)?.message });
    return serverError('حدث خطأ أثناء جلب المتاجر');
  }
})
