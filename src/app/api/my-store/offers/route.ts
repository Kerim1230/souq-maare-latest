export const runtime = 'nodejs'
import { NextRequest } from 'next/server';
import { mapOffer } from '@/lib/api-utils';
import { requireAuth } from '@/server/lib/auth-guard';
import { success, created, badRequest, forbidden, notFound, serverError } from '@/lib/api-response';
import { logger } from '@/lib/logger';
import { withRoute } from '@/server/lib/route-wrapper';
import { validateId, sanitizeAndValidate } from '@/utils/validation';
import {
  getSupabaseAdmin,
  TABLES,
  findStoreById,
  createStoreOffer,
  updateStoreOffer,
  deleteStoreOffer,
  getFollowerIds,
  handleResponse,
  handleCount,
} from '@/lib/supabase-db';
import { serverCache } from '@/lib/cache';

export const GET = withRoute(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const storeId = searchParams.get('storeId');
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? parseInt(limitParam, 10) : undefined;
    const pageParam = searchParams.get('page');
    const pageSizeParam = searchParams.get('pageSize');
    const page = Math.max(pageParam ? parseInt(pageParam, 10) || 1 : 1, 1);
    const pageSize = Math.min(Math.max(pageSizeParam ? parseInt(pageSizeParam, 10) || 20 : 20, 1), 100);
    const offset = (page - 1) * pageSize;

    const sb = getSupabaseAdmin();

    if (!storeId) {
      // Fetch ALL recent offers from any store
      const offers = handleResponse(
        await sb
          .from(TABLES.STORE_OFFERS)
          .select('*, stores(name)')
          .order('created_at', { ascending: false })
          .limit(limit || 50),
        'offers.findAll'
      );

      // Get comment counts
      const commentCounts: Record<string, number> = {};
      if (offers.length > 0) {
        const offerIds = offers.map((o: { id: string }) => o.id);
        const { data: comments } = await sb
          .from(TABLES.COMMENTS)
          .select('offer_id')
          .in('offer_id', offerIds);

        for (const c of (comments || [])) {
          if (c.offer_id) {
            commentCounts[c.offer_id] = (commentCounts[c.offer_id] || 0) + 1;
          }
        }
      }

      return success({
        offers: offers.map((o: Record<string, unknown>) => ({
          ...mapOffer(o),
          store_name: (o.stores as { name: string } | null)?.name || null,
          comments_count: commentCounts[o.id as string] || 0,
        })),
      });
    }

    // Fetch offers for a specific store
    const [offers, offersTotal] = await Promise.all([
      sb
        .from(TABLES.STORE_OFFERS)
        .select('*')
        .eq('store_id', storeId)
        .order('created_at', { ascending: false })
        .range(offset, offset + pageSize - 1)
        .then(handleResponse),
      sb
        .from(TABLES.STORE_OFFERS)
        .select('*', { count: 'exact', head: true })
        .eq('store_id', storeId)
        .then((r) => handleCount(r, 'offers.count')),
    ]);

    const commentCounts: Record<string, number> = {};
    if (offers.length > 0) {
      const offerIds = offers.map((o: { id: string }) => o.id);
      const { data: comments } = await sb
        .from(TABLES.COMMENTS)
        .select('offer_id')
        .in('offer_id', offerIds);

      for (const c of (comments || [])) {
        if (c.offer_id) {
          commentCounts[c.offer_id] = (commentCounts[c.offer_id] || 0) + 1;
        }
      }
    }

    return success({
      offers: offers.map((o: Record<string, unknown>) => ({
        ...mapOffer(o),
        comments_count: commentCounts[o.id as string] || 0,
      })),
      total: offersTotal,
      page,
      pageSize,
    });
  } catch (error) {
    logger.error('Store offers fetch error', 'StoreOffers', { error: (error as Error)?.message });
    return serverError('حدث خطأ أثناء جلب العروض');
  }
})

export const POST = withRoute(async (request: NextRequest) => {
  try {
    const auth = await requireAuth(request);
    if (!auth.success) return auth.response;
    const userId = auth.userId;

    const body = await request.json();
    const { storeId, title, description, imageUrl, type, discount, expiresAt } = body;

    if (!storeId || !title) {
      return badRequest('معرف المتجر وعنوان العرض مطلوبان');
    }

    const storeIdCheck = validateId(storeId, 'معرف المتجر');
    if (!storeIdCheck.valid) return badRequest(storeIdCheck.error!);
    const titleCheck = sanitizeAndValidate(title, 200, 'عنوان العرض');
    if (!titleCheck.valid) return badRequest(titleCheck.error!);

    let storeData;
    try {
      storeData = await findStoreById(storeId);
    } catch {
      return notFound('المتجر غير موجود');
    }
    if (storeData.user_id !== userId) {
      return forbidden('ليس لديك صلاحية لإضافة عروض لهذا المتجر');
    }

    const offer = await createStoreOffer({
      store_id: storeId,
      user_id: userId,
      title,
      description: description || undefined,
      image_url: imageUrl || undefined,
      type: type || 'offer',
      discount: discount || undefined,
      expires_at: expiresAt || undefined,
    });

    // Build notifications for followers AND persist to DB
    const followerIds = await getFollowerIds(storeId, userId);

    let storeName: string | null = null;
    try {
      const storeInfo = await findStoreById(storeId);
      storeName = storeInfo.name;
    } catch {
      // Store may not exist
    }

    const offerLabel = (type || 'offer') === 'contest' ? 'مسابقة' : 'عرض';
    const notifData = {
      type: 'store' as const,
      category: 'new_offer',
      title: `${offerLabel} جديد`,
      body: `أضاف ${storeName || 'متجر'} ${offerLabel}اً جديداً: ${title}`,
      icon: type === 'contest' ? 'Trophy' : 'Gift',
      priority: 'medium' as const,
      deepLink: `/store/${storeId}`,
    };

    // Return notifications to client for creation via notificationStore
    // (do NOT persist server-side — client handles creation to avoid duplicates)
    const notifications = followerIds.map(fId => ({
      userId: fId,
      ...notifData,
      data: { offerId: offer.id, offerTitle: title, storeId, storeName, offerType: type },
    }));

    // Invalidate home and search caches after offer creation
    serverCache.invalidateByPrefix('home:');
    serverCache.invalidateByPrefix('search:');

    return created({ offer: mapOffer(offer), notifications });
  } catch (error) {
    logger.error('Offer creation error', 'StoreOffers', { error: (error as Error)?.message });
    return serverError('حدث خطأ أثناء إنشاء العرض');
  }
})

export const DELETE = withRoute(async (request: NextRequest) => {
  try {
    const auth = await requireAuth(request);
    if (!auth.success) return auth.response;
    const userId = auth.userId;

    const { searchParams } = new URL(request.url);
    const offerId = searchParams.get('offerId');

    const offerIdCheck = validateId(offerId, 'معرف العرض');
    if (!offerIdCheck.valid) return badRequest(offerIdCheck.error!);
    const validatedOfferId = offerIdCheck.value!;

    const sb = getSupabaseAdmin();
    const { data: offerData, error } = await sb
      .from(TABLES.STORE_OFFERS)
      .select('user_id')
      .eq('id', validatedOfferId)
      .maybeSingle();

    if (error || !offerData) {
      return notFound('العرض غير موجود');
    }
    if (offerData.user_id !== userId) {
      return forbidden('ليس لديك صلاحية لحذف هذا العرض');
    }
    await deleteStoreOffer(validatedOfferId);

    // Invalidate home and search caches after offer deletion
    serverCache.invalidateByPrefix('home:');
    serverCache.invalidateByPrefix('search:');

    return success(null);
  } catch (error: any) {
    logger.error('Offer deletion error', 'StoreOffers', { error: (error as Error)?.message });
    return serverError('حدث خطأ أثناء حذف العرض');
  }
})

export const PUT = withRoute(async (request: NextRequest) => {
  try {
    const auth = await requireAuth(request);
    if (!auth.success) return auth.response;
    const userId = auth.userId;

    const body = await request.json();
    const { offerId, title, description, imageUrl, type, discount, expiresAt } = body;

    const offerIdCheck = validateId(offerId, 'معرف العرض');
    if (!offerIdCheck.valid) return badRequest(offerIdCheck.error!);
    const validatedOfferId = offerIdCheck.value!;

    const sb = getSupabaseAdmin();
    const { data: offerData, error } = await sb
      .from(TABLES.STORE_OFFERS)
      .select('user_id')
      .eq('id', validatedOfferId)
      .maybeSingle();

    if (error || !offerData) {
      return notFound('العرض غير موجود');
    }
    if (offerData.user_id !== userId) {
      return forbidden('ليس لديك صلاحية لتعديل هذا العرض');
    }

    const updateData: Record<string, unknown> = {};
    if (title) updateData.title = title;
    if (description !== undefined) updateData.description = description || null;
    if (imageUrl !== undefined) updateData.image_url = imageUrl || null;
    if (type) updateData.type = type;
    if (discount !== undefined) updateData.discount = discount || null;
    if (expiresAt !== undefined) updateData.expires_at = expiresAt || null;

    const offer = await updateStoreOffer(validatedOfferId, updateData);

    // Invalidate home and search caches after offer update
    serverCache.invalidateByPrefix('home:');
    serverCache.invalidateByPrefix('search:');

    return success({ offer: mapOffer(offer) });
  } catch (error: any) {
    logger.error('Offer update error', 'StoreOffers', { error: (error as Error)?.message });
    return serverError('حدث خطأ أثناء تحديث العرض');
  }
})
