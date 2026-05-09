export const runtime = 'nodejs'
import { withRoute } from '@/server/lib/route-wrapper';
import { NextRequest } from 'next/server';
import { getSupabaseAdmin, findFavorite, createFavorite, deleteFavorite, findProductById, findStoreById, findUserById, handleResponse, handleCount, TABLES, paginate } from '@/lib/supabase-db';
import { mapFavorite } from '@/lib/api-utils';
import { checkRateLimit, getClientIp, LIMITS } from '@/server/lib/rate-limiter';
import { rateLimited, success, created, badRequest, notFound, forbidden, serverError } from '@/lib/api-response';
import { checkRateGuard } from '@/server/lib/rate-guard';
import { requireAuth } from '@/server/lib/auth-guard';
import { logger } from '@/lib/logger';
import { getErrorMessage } from '@/lib/error-utils';
import { validateId } from '@/utils/validation';

export const GET = withRoute(async (request: NextRequest) => {
  try {
    const auth = await requireAuth(request);
    if (!auth.success) return auth.response;
    const userId = auth.userId;

    const { searchParams } = new URL(request.url);
    const pageParam = searchParams.get('page');
    const pageSizeParam = searchParams.get('pageSize');
    const page = pageParam ? Math.max(parseInt(pageParam, 10) || 1, 1) : null;
    const pageSize = pageSizeParam ? Math.min(Math.max(parseInt(pageSizeParam, 10) || 20, 1), 100) : null;
    const hasPagination = page !== null && pageSize !== null;
    const effectivePage = page || 1;
    const effectivePageSize = pageSize || 20;

    const sb = getSupabaseAdmin();

    // Fetch favorites with count in parallel
    let favoritesQuery = sb
      .from(TABLES.FAVORITES)
      .select('*, product:products(*, store:stores(*)), store:stores(*)', { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (hasPagination) {
      const { from, to } = paginate(effectivePage, effectivePageSize);
      favoritesQuery = favoritesQuery.range(from, to);
    }

    const [favoritesResult] = await Promise.all([
      favoritesQuery,
    ]);

    if (favoritesResult.error) {
      logger.error('Favorites fetch error', 'Favorites', { error: favoritesResult.error.message });
      return serverError('حدث خطأ أثناء جلب المفضلات');
    }

    const favorites = favoritesResult.data || [];
    const total = favoritesResult.count ?? 0;

    // If joins didn't populate product/store, do separate fetches
    const productIds = favorites
      .map((f: any) => f.product_id)
      .filter(Boolean) as string[];
    const storeIds = favorites
      .map((f: any) => f.store_id)
      .filter(Boolean) as string[];

    // Check if any joins are missing data
    const needsProductFetch = productIds.length > 0 && favorites.some((f: any) => f.product_id && !f.product);
    const needsStoreFetch = storeIds.length > 0 && favorites.some((f: any) => f.store_id && !f.store);

    if (needsProductFetch || needsStoreFetch) {
      const productFetch = needsProductFetch && productIds.length > 0
        ? sb.from(TABLES.PRODUCTS).select('*, store:stores(*)').in('id', productIds)
        : Promise.resolve({ data: [], error: null });
      const storeFetch = needsStoreFetch && storeIds.length > 0
        ? sb.from(TABLES.STORES).select('*').in('id', storeIds)
        : Promise.resolve({ data: [], error: null });

      const [productResult, storeResult] = await Promise.all([productFetch, storeFetch]);

      const productMap = new Map((productResult.data || []).map((p: any) => [p.id, p]));
      const storeMap = new Map((storeResult.data || []).map((s: any) => [s.id, s]));

      for (const fav of favorites) {
        if (fav.product_id && !fav.product) {
          fav.product = productMap.get(fav.product_id) || null;
        }
        if (fav.store_id && !fav.store) {
          fav.store = storeMap.get(fav.store_id) || null;
        }
      }
    }

    return success({
      favorites: favorites.map((f: any) => mapFavorite(f)),
      total,
      page: effectivePage,
      pageSize: effectivePageSize,
    });
  } catch (error) {
    logger.error('Favorites fetch error', 'Favorites', { error: getErrorMessage(error) });
    return serverError('حدث خطأ أثناء جلب المفضلات');
  }
})

export const POST = withRoute(async (request: NextRequest) => {
  try {
    const ip = getClientIp(request);
    const rl = checkRateLimit(`favorites:${ip}`, LIMITS.general);
    if (!rl.success) return rateLimited();

    const auth = await requireAuth(request);
    if (!auth.success) return auth.response;
    const userId = auth.userId;

    const body = await request.json();
    const { productId, storeId } = body;

    if (!productId && !storeId) {
      return badRequest('معرف المنتج أو المتجر مطلوب');
    }

    // Verify that the referenced product or store exists
    if (productId) {
      try {
        await findProductById(productId);
      } catch {
        return notFound('المنتج غير موجود');
      }
    }
    if (storeId) {
      try {
        await findStoreById(storeId);
      } catch {
        return notFound('المتجر غير موجود');
      }
    }

    // Check if already favorited
    const existing = await findFavorite(userId, productId || undefined, storeId || undefined);

    let favorite: any;
    if (existing) {
      // Already favorited — fetch full data with product/store/user
      const sb = getSupabaseAdmin();
      const [favResult, productResult, storeResult, userResult] = await Promise.all([
        sb.from(TABLES.FAVORITES).select('*').eq('id', existing.id).single(),
        existing.product_id
          ? sb.from(TABLES.PRODUCTS).select('*, store:stores(*), user:users(id)').eq('id', existing.product_id).single()
          : Promise.resolve({ data: null, error: null }),
        existing.store_id
          ? sb.from(TABLES.STORES).select('*, user:users(id)').eq('id', existing.store_id).single()
          : Promise.resolve({ data: null, error: null }),
        sb.from(TABLES.USERS).select('id, email, full_name').eq('id', userId).single(),
      ]);

      favorite = favResult.data;
      if (favorite) {
        favorite.product = productResult?.data || null;
        favorite.store = storeResult?.data || null;
        favorite.user = userResult?.data || null;
      }
    } else {
      // Create new favorite
      favorite = await createFavorite({
        user_id: userId,
        product_id: productId || undefined,
        store_id: storeId || undefined,
      });

      // Fetch related data for the newly created favorite
      const sb = getSupabaseAdmin();
      const [productResult, storeResult, userResult] = await Promise.all([
        favorite.product_id
          ? sb.from(TABLES.PRODUCTS).select('*, store:stores(*), user:users(id)').eq('id', favorite.product_id).single()
          : Promise.resolve({ data: null, error: null }),
        favorite.store_id
          ? sb.from(TABLES.STORES).select('*, user:users(id)').eq('id', favorite.store_id).single()
          : Promise.resolve({ data: null, error: null }),
        sb.from(TABLES.USERS).select('id, email, full_name').eq('id', userId).single(),
      ]);

      favorite.product = productResult?.data || null;
      favorite.store = storeResult?.data || null;
      favorite.user = userResult?.data || null;
    }

    // Build notification only if this is a NEW favorite (not a re-favorite)
    let notification: Record<string, unknown> | null = null;
    if (!existing && favorite) {
      const recipientId = favorite.product?.store?.user_id || favorite.store?.user_id;
      const recipientIsOwner = recipientId === userId;

      if (recipientId && !recipientIsOwner) {
        if (favorite.product_id && favorite.product) {
          notification = {
            user_id: recipientId,
            type: 'interaction',
            category: 'product_like',
            title: 'إعجاب جديد بمنتجك',
            body: `أعجب ${favorite.user?.full_name || 'مستخدم'} بمنتجك "${favorite.product.name}"`,
            icon: 'Heart',
            priority: 'medium',
            deep_link: `/product/${productId}`,
          };
        } else if (favorite.store_id && favorite.store) {
          notification = {
            user_id: recipientId,
            type: 'interaction',
            category: 'store_like',
            title: 'إعجاب جديد بمتجرك',
            body: `أعجب ${favorite.user?.full_name || 'مستخدم'} بمتجرك "${favorite.store.name}"`,
            icon: 'Heart',
            priority: 'medium',
            deep_link: `/store/${storeId}`,
          };
        }
      }
    }

    return created({ favorite: favorite ? mapFavorite(favorite) : null, notification });
  } catch (error) {
    logger.error('Favorite creation error', 'Favorites', { error: getErrorMessage(error) });
    return serverError('حدث خطأ أثناء إضافة المفضلة');
  }
})

export const DELETE = withRoute(async (request: NextRequest) => {
  try {
    const rl = checkRateGuard(request, { category: 'favorite' });
    if (rl) return rl;

    const auth = await requireAuth(request);
    if (!auth.success) return auth.response;
    const userId = auth.userId;

    const { searchParams } = new URL(request.url);
    const favoriteId = searchParams.get('favoriteId');
    const deleteAll = searchParams.get('deleteAll');

    // Bulk delete: ?deleteAll=true
    if (deleteAll === 'true') {
      const sb = getSupabaseAdmin();
      const { count } = await sb
        .from(TABLES.FAVORITES)
        .delete({ count: 'exact' })
        .eq('user_id', userId);
      return success({ deletedCount: count ?? 0 });
    }

    // Single delete: ?favoriteId=xxx
    const favoriteIdCheck = validateId(favoriteId, 'معرف المفضلة');
    if (!favoriteIdCheck.valid) return badRequest(favoriteIdCheck.error!);

    const validatedFavoriteId = favoriteIdCheck.value!;
    const sb = getSupabaseAdmin();
    const { data: favorite, error: favError } = await sb
      .from(TABLES.FAVORITES)
      .select('*')
      .eq('id', validatedFavoriteId)
      .single();

    if (favError || !favorite) {
      return notFound('المفضلة غير موجودة');
    }
    if (favorite.user_id !== userId) {
      return forbidden('غير مصرح بحذف هذه المفضلة');
    }
    await deleteFavorite(validatedFavoriteId);
    return success(null);
  } catch (error) {
    logger.error('Favorite deletion error', 'Favorites', { error: getErrorMessage(error) });
    return serverError('حدث خطأ أثناء حذف المفضلة');
  }
})
