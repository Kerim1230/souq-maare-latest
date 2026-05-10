export const runtime = 'nodejs'
import { NextRequest } from 'next/server';
import { mapStore, mapProduct, mapOffer } from '@/lib/api-utils';
import { checkBanAsync, isActionAllowed } from '@/lib/ban-check';
import { requireAuth } from '@/server/lib/auth-guard';
import { success, created, badRequest, forbidden, conflict, notFound, apiError, serverError } from '@/lib/api-response';
import { logger } from '@/lib/logger';
import { withRoute } from '@/server/lib/route-wrapper';
import { validateId, sanitizeAndValidate } from '@/utils/validation';
import {
  getSupabaseAdmin,
  TABLES,
  findStoreByUserId,
  findStoreById,
  createStore,
  deleteStore,
  updateStore,
  findProductById,
  deleteProduct,
  countFollowers,
  handleResponse,
  handleCount,
} from '@/lib/supabase-db';
import { serverCache } from '@/lib/cache';

export const GET = withRoute(async (request: NextRequest) => {
  try {
    const auth = await requireAuth(request);
    if (!auth.success) return auth.response;
    const userId = auth.userId;

    const { searchParams } = new URL(request.url);
    const pageParam = searchParams.get('page');
    const pageSizeParam = searchParams.get('pageSize');
    const page = Math.max(pageParam ? parseInt(pageParam, 10) || 1 : 1, 1);
    const pageSize = Math.min(Math.max(pageSizeParam ? parseInt(pageSizeParam, 10) || 20 : 20, 1), 100);
    const offset = (page - 1) * pageSize;

    const store = await findStoreByUserId(userId);

    if (!store) {
      return success({ store: null, products: [], offers: [], total: 0, page, pageSize });
    }

    const sb = getSupabaseAdmin();
    const storeId = store.id;

    const followersCount = await countFollowers(storeId);

    const [products, productsTotal, offers] = await Promise.all([
      sb
        .from(TABLES.PRODUCTS)
        .select('*')
        .eq('store_id', storeId)
        .order('created_at', { ascending: false })
        .range(offset, offset + pageSize - 1)
        .then(handleResponse),
      sb
        .from(TABLES.PRODUCTS)
        .select('*', { count: 'exact', head: true })
        .eq('store_id', storeId)
        .then((r) => handleCount(r, 'products.count')),
      sb
        .from(TABLES.STORE_OFFERS)
        .select('*')
        .eq('store_id', storeId)
        .order('created_at', { ascending: false })
        .then(handleResponse),
    ]);

    // Get comment counts for offers
    const offerCommentCounts: Record<string, number> = {};
    if (offers.length > 0) {
      const offerIds = offers.map((o: { id: string }) => o.id);
      const { data: comments } = await sb
        .from(TABLES.COMMENTS)
        .select('offer_id')
        .in('offer_id', offerIds);

      for (const c of (comments || [])) {
        if (c.offer_id) {
          offerCommentCounts[c.offer_id] = (offerCommentCounts[c.offer_id] || 0) + 1;
        }
      }
    }

    const offersWithCounts = offers.map((o: Record<string, unknown>) => ({
      ...o,
      _count: { comments: offerCommentCounts[o.id as string] || 0 },
    }));

    return success({
      store: {
        ...mapStore(store),
        followers_count: followersCount,
      },
      products: products.map((p: Record<string, unknown>) => mapProduct(p)),
      offers: offersWithCounts.map(mapOffer),
      total: productsTotal,
      page,
      pageSize,
    });
  } catch (error) {
    logger.error('My store fetch error', 'MyStore', { error: (error as Error)?.message });
    return serverError('حدث خطأ أثناء جلب بيانات المتجر');
  }
})

export const POST = withRoute(async (request: NextRequest) => {
  try {
    const auth = await requireAuth(request);
    if (!auth.success) return auth.response;
    const userId = auth.userId;

    const body = await request.json();
    const { name, description, logoUrl, coverUrl, category, governorate, city, district, location } = body;

    if (!name) {
      return badRequest('اسم المتجر مطلوب');
    }

    const nameCheck = sanitizeAndValidate(name, 200, 'اسم المتجر');
    if (!nameCheck.valid) {
      return badRequest(nameCheck.error!);
    }

    const banCheck = await checkBanAsync(userId);
    if (banCheck.isBanned && !isActionAllowed(banCheck.banType!, 'post')) {
      return apiError('تم حظر حسابك: ' + (banCheck.reason || ''), 403, { banned: true });
    }

    const existingStore = await findStoreByUserId(userId);
    if (existingStore) {
      return conflict('لديك متجر بالفعل');
    }

    // Try creating store with location field. If the 'location' column doesn't exist
    // in the database yet, retry without it.
    let store;
    try {
      store = await createStore({
        user_id: userId,
        name,
        description: description || undefined,
        logo_url: logoUrl || undefined,
        cover_url: coverUrl || undefined,
        category: category || undefined,
        chat_enabled: false,
        governorate: governorate || undefined,
        city: city || undefined,
        district: district || undefined,
        location: location || undefined,
      });
    } catch (err: any) {
      if ((err?.message?.includes('location') || err?.message?.includes('district')) && (location || district)) {
        // Column doesn't exist yet — retry without the missing column(s)
        const retryData: Record<string, unknown> = {
          user_id: userId,
          name,
          description: description || undefined,
          logo_url: logoUrl || undefined,
          cover_url: coverUrl || undefined,
          category: category || undefined,
          chat_enabled: false,
          governorate: governorate || undefined,
          city: city || undefined,
        };
        // Only include district if the error wasn't about it
        if (!err?.message?.includes('district') && district) retryData.district = district;
        // Only include location if the error wasn't about it
        if (!err?.message?.includes('location') && location) retryData.location = location;
        store = await createStore(retryData as any);
      } else {
        throw err;
      }
    }
    // Note: If the 'location' column doesn't exist yet, Supabase will silently fail
    // on that field but the store will be created without location.

    // Invalidate store and home caches
    serverCache.invalidateByPrefix('stores:');
    serverCache.invalidateByPrefix('home:');

    return created({ store: mapStore(store) });
  } catch (error) {
    logger.error('Store creation error', 'MyStore', { error: (error as Error)?.message });
    return serverError('حدث خطأ أثناء إنشاء المتجر');
  }
})

export const DELETE = withRoute(async (request: NextRequest) => {
  try {
    const auth = await requireAuth(request);
    if (!auth.success) return auth.response;
    const sessionUserId = auth.userId;

    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('productId');
    const storeId = searchParams.get('storeId');

    const banCheck = await checkBanAsync(sessionUserId);
    if (banCheck.isBanned && !isActionAllowed(banCheck.banType!, 'edit')) {
      return apiError('تم حظر حسابك: ' + (banCheck.reason || ''), 403, { banned: true });
    }

    if (storeId) {
      // Get owner to verify ownership
      const sb = getSupabaseAdmin();
      const { data: storeData, error } = await sb
        .from(TABLES.STORES)
        .select('user_id')
        .eq('id', storeId)
        .maybeSingle();

      if (error || !storeData) {
        return notFound('المتجر غير موجود');
      }
      if (storeData.user_id !== sessionUserId) {
        return forbidden('ليس لديك صلاحية لحذف هذا المتجر');
      }
      await deleteStore(storeId);

      // Invalidate store, product, and home caches
      serverCache.invalidateByPrefix('stores:');
      serverCache.invalidateByPrefix('products:');
      serverCache.invalidateByPrefix('home:');
      serverCache.invalidateByPrefix('search:');

      return success(null);
    }

    const productIdCheck = validateId(productId, 'معرف المنتج');
    if (!productIdCheck.valid) return badRequest(productIdCheck.error!);
    const validatedProductId = productIdCheck.value!;

    let product;
    try {
      product = await findProductById(validatedProductId);
    } catch {
      return notFound('المنتج غير موجود');
    }

    if (product.user_id !== sessionUserId && product.store_id) {
      const sb = getSupabaseAdmin();
      const { data: storeOwner } = await sb
        .from(TABLES.STORES)
        .select('user_id')
        .eq('id', product.store_id)
        .maybeSingle();

      if (!storeOwner || storeOwner.user_id !== sessionUserId) {
        return forbidden('ليس لديك صلاحية لحذف هذا المنتج');
      }
    }
    await deleteProduct(validatedProductId);

    // Invalidate product and home caches
    serverCache.invalidateByPrefix('products:');
    serverCache.invalidateByPrefix('home:');

    return success(null);
  } catch (error) {
    logger.error('Deletion error', 'MyStore', { error: (error as Error)?.message });
    return serverError('حدث خطأ أثناء الحذف');
  }
})

export const PUT = withRoute(async (request: NextRequest) => {
  try {
    const auth = await requireAuth(request);
    if (!auth.success) return auth.response;
    const sessionUserId = auth.userId;

    const body = await request.json();
    const { storeId, name, description, logoUrl, coverUrl, category, chatEnabled, governorate, city, district, location } = body;

    const storeIdCheck = validateId(storeId, 'معرف المتجر');
    if (!storeIdCheck.valid) return badRequest(storeIdCheck.error!);

    // Verify ownership — need raw store to access both user_id and is_verified
    let storeData;
    try {
      storeData = await findStoreById(storeId);
    } catch {
      return notFound('المتجر غير موجود');
    }

    if (storeData.user_id !== sessionUserId) {
      return forbidden('ليس لديك صلاحية لتعديل هذا المتجر');
    }

    const banCheck = await checkBanAsync(sessionUserId);
    if (banCheck.isBanned && !isActionAllowed(banCheck.banType!, 'edit')) {
      return apiError('تم حظر حسابك: ' + (banCheck.reason || ''), 403, { banned: true });
    }

    if (chatEnabled === true && !storeData.is_verified) {
      return forbidden('يجب توثيق المتجر أولاً لتفعيل الدردشة');
    }

    const updateData: Record<string, unknown> = {};
    if (name) updateData.name = name;
    if (description !== undefined) updateData.description = description || null;
    if (logoUrl !== undefined) updateData.logo_url = logoUrl || null;
    if (coverUrl !== undefined) updateData.cover_url = coverUrl || null;
    if (category !== undefined) updateData.category = category || null;
    if (chatEnabled !== undefined) updateData.chat_enabled = chatEnabled;
    if (governorate !== undefined) updateData.governorate = governorate || null;
    if (city !== undefined) updateData.city = city || null;
    if (district !== undefined) updateData.district = district || null;
    if (location !== undefined) updateData.location = location || null;

    let store;
    try {
      store = await updateStore(storeId, updateData);
    } catch (err: any) {
      // If 'location' or 'district' column doesn't exist yet, retry without it
      const missingColumns: string[] = [];
      if (err?.message?.includes('location') && updateData.location !== undefined) missingColumns.push('location');
      if (err?.message?.includes('district') && updateData.district !== undefined) missingColumns.push('district');
      if (missingColumns.length > 0) {
        for (const col of missingColumns) delete updateData[col];
        store = await updateStore(storeId, updateData);
      } else {
        throw err;
      }
    }

    // Invalidate store and home caches
    serverCache.invalidateByPrefix('stores:');
    serverCache.invalidateByPrefix('home:');

    return success({ store: mapStore(store) });
  } catch (error: any) {
    logger.error('Store update error', 'MyStore', { error: (error as Error)?.message });
    return serverError('حدث خطأ أثناء تحديث المتجر');
  }
})
