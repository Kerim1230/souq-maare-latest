export const runtime = 'nodejs'
import { NextRequest } from 'next/server'
import { getSupabaseAdmin, findProductById, createProduct, updateProduct, deleteProduct, findStoreByUserId, findStoreById, getFollowerIds, createManyNotifications, TABLES, paginate, searchFilter } from '@/lib/supabase-db'
import { requireAuth } from '@/server/lib/auth-guard'
import { checkRateGuard } from '@/server/lib/rate-guard'
import { success, created, badRequest, forbidden, notFound, serverError } from '@/lib/api-response'
import { logger } from '@/lib/logger'
import { withRoute } from '@/server/lib/route-wrapper'
import { validatePrice, validateId, sanitizeAndValidate } from '@/utils/validation';
import { sanitizeString } from '@/server/lib/sanitize'
import { mapProduct } from '@/lib/api-utils'
import { cachedQuery, CACHE_TTL, serverCache } from '@/lib/cache'

/**
 * Notify store followers about a new product.
 */
async function notifyStoreFollowers(storeId: string, excludeUserId: string, productName: string, price: number): Promise<void> {
  try {
    const store = await findStoreById(storeId);
    const storeName = store?.name || 'متجر';

    const followerIds = await getFollowerIds(storeId, excludeUserId);

    if (followerIds.length > 0) {
      await createManyNotifications(
        followerIds.map(uid => ({
          user_id: uid,
          title: `منتج جديد من ${storeName}`,
          body: `تم إضافة منتج "${productName}" بقيمة ${price} ل.س`,
          type: 'store',
          category: 'new_product',
          icon: 'product',
          deep_link: `/store/${storeId}`,
        })),
      );
    }
  } catch (err) {
    logger.warn('Failed to notify store followers (non-critical)', 'Products', {
      error: err instanceof Error ? err.message : String(err),
      storeId,
    });
  }
}

// GET /api/products?store_id=xxx&user_id=xxx&search=xxx&category=xxx&limit=50&offset=0
export const GET = withRoute(async (request: NextRequest) => {
  try {
    const rl = checkRateGuard(request, { category: 'search' });
    if (rl) return rl;

    const { searchParams } = new URL(request.url)
    const store_id = searchParams.get('store_id') || searchParams.get('storeId')
    const user_id = searchParams.get('user_id') || searchParams.get('userId')
    const search = searchParams.get('search')
    const category = searchParams.get('category')
    const is_featured = searchParams.get('is_featured')
    const limit = searchParams.get('limit')
    const offset = searchParams.get('offset')

    if (search) {
      logger.info('Product search query', 'Products', { search, store_id, category })
    }

    // Build cache key from query params
    const cacheKey = `products:list:store=${store_id || 'any'}:user=${user_id || 'any'}:search=${search || 'none'}:cat=${category || 'any'}:featured=${is_featured || 'any'}:limit=${limit || '50'}:offset=${offset || '0'}`

    const data = await cachedQuery<any>(
      cacheKey,
      () => getProductsFromSupabase({ store_id, user_id, search, category, is_featured, limit, offset }),
      CACHE_TTL.PRODUCTS,
    )

    return data
  } catch {
    return serverError('حدث خطأ أثناء جلب المنتجات')
  }
})

// ── Supabase GET Path ────────────────────────────────────────────────────────────

async function getProductsFromSupabase(
  params: { store_id: string | null; user_id: string | null; search: string | null; category: string | null; is_featured: string | null; limit: string | null; offset: string | null },
) {
  const { store_id, user_id, search, category, is_featured, limit, offset } = params;
  const limitNum = Math.min(Math.max(parseInt(limit || '50', 10) || 50, 1), 200);
  const offsetNum = Math.max(parseInt(offset || '0', 10) || 0, 0);

  const sb = getSupabaseAdmin();
  let query = sb.from(TABLES.PRODUCTS).select('*');

  if (store_id) query = query.eq('store_id', store_id);
  if (user_id) query = query.eq('user_id', user_id);
  if (category) query = query.eq('category', category);
  if (is_featured === 'true') query = query.eq('is_featured', true);

  if (search) {
    query = query.or(searchFilter('name', search));
  }

  query = query.order('created_at', { ascending: false }).range(offsetNum, offsetNum + limitNum - 1);

  const { data, error } = await query;
  if (error) {
    logger.error('Supabase product query failed', 'Products', { error: error.message });
    return serverError('حدث خطأ أثناء جلب المنتجات');
  }

  return success({
    products: (data || []).map(p => ({
      ...mapProduct(p),
      title: p.name,
    })),
  });
}

// POST /api/products { name, description, price, image_url, store_id, user_id, category?, is_new?, is_featured?, expires_at? }
export const POST = withRoute(async (request: NextRequest) => {
  try {
    const rl = checkRateGuard(request, { category: 'mutation' });
    if (rl) return rl;

    const auth = await requireAuth(request)
    if (!auth.success) return auth.response
    const sessionUserId = auth.userId

    const body = await request.json()
    const {
      name, title, description, price,
      image_url, imageUrl,
      store_id, storeId,
      user_id, userId,
      category,
      is_new, isNew,
      is_featured, isFeatured,
      expires_at, expiresAt,
    } = body

    const productName = name || title;
    const effectiveImageUrl = image_url || imageUrl;
    const effectiveStoreIdParam = store_id || storeId;
    const effectiveUserIdParam = user_id || userId;
    const effectiveIsNew = is_new ?? isNew;
    const effectiveIsFeatured = is_featured ?? isFeatured;
    const effectiveExpiresAt = expires_at || expiresAt;

    if (!productName || price === undefined) {
      return badRequest('الرجاء إدخال اسم المنتج والسعر')
    }

    const productNameCheck = sanitizeAndValidate(productName, 200, 'اسم المنتج');
    if (!productNameCheck.valid) return badRequest(productNameCheck.error!);
    const sanitizedName = productNameCheck.value!;

    const priceCheck = validatePrice(price)
    if (!priceCheck.valid) {
      return badRequest(priceCheck.error || 'السعر غير صالح')
    }
    const validatedPrice = priceCheck.value!

    const sanitizedDescription = description ? sanitizeString(String(description), 2000) : null

    const effectiveUserId = effectiveUserIdParam || sessionUserId;
    if (effectiveUserId !== sessionUserId) {
      return forbidden('ليس لديك صلاحية لإنشاء منتج لحساب آخر')
    }

    let effectiveStoreId = effectiveStoreIdParam;
    if (!effectiveStoreId) {
      const userStore = await findStoreByUserId(sessionUserId);
      if (userStore) effectiveStoreId = userStore.id;
    }

    if (effectiveStoreId) {
      const storeOwner = await findStoreById(effectiveStoreId);
      if (!storeOwner) {
        return badRequest('المتجر المحدد غير موجود');
      }
      if (storeOwner.user_id !== sessionUserId) {
        return forbidden('ليس لديك صلاحية لإضافة منتجات لهذا المتجر');
      }
    }

    const product = await createProduct({
      name: sanitizedName,
      description: sanitizedDescription || undefined,
      price: validatedPrice,
      image_url: effectiveImageUrl || undefined,
      user_id: effectiveUserId,
      store_id: effectiveStoreId || undefined,
      category: category || undefined,
      is_new: effectiveIsNew ?? true,
      is_featured: effectiveIsFeatured ?? false,
      expires_at: effectiveExpiresAt ? new Date(effectiveExpiresAt).toISOString() : undefined,
    });

    // Invalidate product and home caches after mutation
    serverCache.invalidateByPrefix('products:');
    serverCache.invalidateByPrefix('home:');

    if (effectiveStoreId) {
      const storeIdForNotif = effectiveStoreId;
      notifyStoreFollowers(storeIdForNotif, effectiveUserId, productName, validatedPrice).catch(err => {
        logger.warn('Failed to notify store followers (non-critical)', 'Products', {
          error: err instanceof Error ? err.message : String(err),
          storeId: storeIdForNotif,
        });
      });
    }

    return created({
      product: {
        ...mapProduct(product),
        title: product.name,
      },
    });
  } catch {
    return serverError('حدث خطأ أثناء إنشاء المنتج')
  }
})

// PUT /api/products { id, name?, description?, price?, image_url?, category?, is_featured?, is_new?, expires_at? }
export const PUT = withRoute(async (request: NextRequest) => {
  try {
    const rl = checkRateGuard(request, { category: 'mutation' });
    if (rl) return rl;

    const body = await request.json()
    const { id: bodyId, productId, _user_id, ...updates } = body
    const id = bodyId || productId

    const idCheck = validateId(id, 'معرف المنتج');
    if (!idCheck.valid) return badRequest(idCheck.error!);

    const auth = await requireAuth(request)
    if (!auth.success) return auth.response
    const sessionUserId = auth.userId

    const allUpdates: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) allUpdates[key] = value
    }
    if (Object.keys(allUpdates).length === 0) {
      return badRequest('لم يتم تقديم بيانات للتحديث')
    }

    let existing: any;
    try {
      existing = await findProductById(id);
    } catch {
      return notFound('المنتج غير موجود');
    }
    if (existing.user_id !== sessionUserId) {
      return forbidden('ليس لديك صلاحية لتعديل هذا المنتج')
    }

    const supabaseUpdates: Record<string, unknown> = {};
    if (updates.name) supabaseUpdates.name = sanitizeString(String(updates.name), 200);
    if (updates.description !== undefined) supabaseUpdates.description = updates.description ? sanitizeString(String(updates.description), 2000) : null;
    if (updates.price !== undefined) {
      const priceCheck = validatePrice(updates.price);
      if (!priceCheck.valid) return badRequest(priceCheck.error || 'السعر غير صالح');
      supabaseUpdates.price = priceCheck.value!;
    }
    const updateImageUrl = updates.image_url !== undefined ? updates.image_url : updates.imageUrl;
    if (updateImageUrl !== undefined) supabaseUpdates.image_url = updateImageUrl || null;
    if (updates.category !== undefined) supabaseUpdates.category = updates.category || null;
    if (updates.is_featured !== undefined) supabaseUpdates.is_featured = updates.is_featured;
    if (updates.is_new !== undefined) supabaseUpdates.is_new = updates.is_new;
    const updateExpiresAt = updates.expires_at || updates.expiresAt;
    if (updateExpiresAt) supabaseUpdates.expires_at = new Date(updateExpiresAt).toISOString();

    const product = await updateProduct(id, supabaseUpdates);

    // Invalidate product and home caches after mutation
    serverCache.invalidateByPrefix('products:');
    serverCache.invalidateByPrefix('home:');

    return success({
      product: {
        ...mapProduct(product),
        title: product.name,
      },
    });
  } catch {
    return serverError('حدث خطأ أثناء تحديث المنتج')
  }
})

// DELETE /api/products?id=xxx
export const DELETE = withRoute(async (request: NextRequest) => {
  try {
    const rl = checkRateGuard(request, { category: 'mutation' });
    if (rl) return rl;

    const auth = await requireAuth(request)
    if (!auth.success) return auth.response
    const sessionUserId = auth.userId

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    const idCheck = validateId(id, 'معرف المنتج');
    if (!idCheck.valid) return badRequest(idCheck.error!);
    const validatedProductId = idCheck.value!;

    let existing: any;
    try {
      existing = await findProductById(validatedProductId);
    } catch {
      return notFound('المنتج غير موجود')
    }
    if (existing.user_id !== sessionUserId) {
      if (existing.store_id) {
        const store = await findStoreById(existing.store_id);
        if (!store || store.user_id !== sessionUserId) {
          return forbidden('ليس لديك صلاحية لحذف هذا المنتج')
        }
      } else {
        return forbidden('ليس لديك صلاحية لحذف هذا المنتج')
      }
    }
    await deleteProduct(validatedProductId);

    // Invalidate product and home caches after mutation
    serverCache.invalidateByPrefix('products:');
    serverCache.invalidateByPrefix('home:');

    return success(null)
  } catch {
    return serverError('حدث خطأ أثناء حذف المنتج')
  }
})
