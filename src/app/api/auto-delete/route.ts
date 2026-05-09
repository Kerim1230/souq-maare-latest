export const runtime = 'nodejs'
import { NextRequest } from 'next/server';
import { requireAdmin } from '@/server/lib/admin-auth';
import { success, badRequest, notFound, serverError } from '@/lib/api-response';
import { logger } from '@/lib/logger';
import { withRoute } from '@/server/lib/route-wrapper';
import { getSupabaseAdmin, updateProduct, updateStoreOffer, findProductById, TABLES, handleCount } from '@/lib/supabase-db';
import { INACTIVE_ACCOUNT_DAYS } from '@/lib/constants';

// GET: Get stats about expiring content + inactive accounts (admin-only)
export const GET = withRoute(async (request: NextRequest) => {
  try {
    const admin = await requireAdmin(request);
    if (!admin.success) return admin.response;
    const sb = getSupabaseAdmin();
    const now = new Date();
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);
    const twentyFourHoursFromNow = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const nowISO = now.toISOString();
    const endOfDayISO = endOfDay.toISOString();
    const soonISO = twentyFourHoursFromNow.toISOString();

    // ── Supabase queries for stats ──
    const [
      productsExpiringToday,
      activeProductsWithExpiry,
      offersExpiringToday,
      activeOffersWithExpiry,
      messagesToDelete,
      productsExpiringSoon,
      offersExpiringSoon,
      totalExpiredProducts,
      totalExpiredOffers,
      inactiveAccounts,
    ] = await Promise.all([
      // Products expiring today
      handleCount(await sb.from(TABLES.PRODUCTS).select('*', { count: 'exact', head: true }).gt('expires_at', nowISO).lte('expires_at', endOfDayISO), 'productsExpiringToday'),
      // All active products with expiry
      handleCount(await sb.from(TABLES.PRODUCTS).select('*', { count: 'exact', head: true }).gt('expires_at', nowISO), 'activeProductsWithExpiry'),
      // Offers expiring today
      handleCount(await sb.from(TABLES.STORE_OFFERS).select('*', { count: 'exact', head: true }).gt('expires_at', nowISO).lte('expires_at', endOfDayISO), 'offersExpiringToday'),
      // Active offers with expiry
      handleCount(await sb.from(TABLES.STORE_OFFERS).select('*', { count: 'exact', head: true }).gt('expires_at', nowISO), 'activeOffersWithExpiry'),
      // Chat messages older than 48 hours
      handleCount(await sb.from(TABLES.CHAT_MESSAGES).select('*', { count: 'exact', head: true }).lt('created_at', new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()), 'messagesToDelete'),
      // Products expiring soon (with store info)
      sb.from(TABLES.PRODUCTS).select('*, store:stores(name)').gt('expires_at', nowISO).lte('expires_at', soonISO),
      // Offers expiring soon (with store info)
      sb.from(TABLES.STORE_OFFERS).select('*, store:stores(name)').gt('expires_at', nowISO).lte('expires_at', soonISO),
      // Total expired products
      handleCount(await sb.from(TABLES.PRODUCTS).select('*', { count: 'exact', head: true }).lt('expires_at', nowISO), 'totalExpiredProducts'),
      // Total expired offers
      handleCount(await sb.from(TABLES.STORE_OFFERS).select('*', { count: 'exact', head: true }).lt('expires_at', nowISO), 'totalExpiredOffers'),
      // Inactive accounts
      handleCount(await sb.from(TABLES.USERS).select('*', { count: 'exact', head: true }).eq('is_admin', false).lt('updated_at', new Date(Date.now() - INACTIVE_ACCOUNT_DAYS * 24 * 60 * 60 * 1000).toISOString()), 'inactiveAccounts'),
    ]);

    // Near-deletion accounts (last 7 days before cutoff)
    const nearDeletionCutoff = new Date(
      Date.now() - (INACTIVE_ACCOUNT_DAYS - 7) * 24 * 60 * 60 * 1000
    ).toISOString();
    const inactiveCutoff = new Date(Date.now() - INACTIVE_ACCOUNT_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const { data: nearDeletionUsers } = await sb.from(TABLES.USERS)
      .select('id, email, full_name, updated_at, created_at')
      .eq('is_admin', false)
      .lt('updated_at', nearDeletionCutoff)
      .gt('updated_at', inactiveCutoff)
      .limit(20);

    const productsData = productsExpiringSoon.data || [];
    const offersData = offersExpiringSoon.data || [];

    return success({
      stats: {
        productsExpiringToday,
        offersExpiringToday,
        messagesToDelete,
        activeProductsWithExpiry,
        activeOffersWithExpiry,
        totalExpired: totalExpiredProducts + totalExpiredOffers,
        inactiveAccounts,
        inactiveAccountDays: INACTIVE_ACCOUNT_DAYS,
      },
      expiringItems: [
        ...productsData.map((p: Record<string, unknown>) => ({
          id: p.id,
          name: p.name,
          expiresAt: p.expires_at,
          userId: p.user_id,
          contentType: 'product' as const,
          storeName: (p as Record<string, unknown>).store ? ((p as Record<string, unknown>).store as Record<string, unknown>)?.name : undefined,
        })),
        ...offersData.map((o: Record<string, unknown>) => ({
          id: o.id,
          name: o.title,
          expiresAt: o.expires_at,
          userId: o.user_id,
          contentType: 'offer' as const,
          storeName: (o as Record<string, unknown>).store ? ((o as Record<string, unknown>).store as Record<string, unknown>)?.name : undefined,
        })),
      ],
      nearDeletionAccounts: (nearDeletionUsers || []).map((u: Record<string, unknown>) => ({
        id: u.id,
        email: u.email,
        full_name: u.full_name,
        lastActiveAt: u.updated_at,
        createdAt: u.created_at,
      })),
    });
  } catch (error) {
    logger.error('Auto-delete stats error', 'AutoDelete', { error: (error as Error)?.message });
    return serverError('حدث خطأ');
  }
})

// POST: Execute auto-deletion of expired content + inactive accounts (admin-only)
export const POST = withRoute(async (request: NextRequest) => {
  try {
    const admin = await requireAdmin(request);
    if (!admin.success) return admin.response;
    const body = await request.json();
    const { action } = body;
    const sb = getSupabaseAdmin();
    const now = new Date();
    const nowISO = now.toISOString();
    let deletedProducts = 0;
    let deletedOffers = 0;
    let deletedMessages = 0;
    let deletedUsers = 0;

    if (action === 'cleanup' || !action) {
      // ── Batch delete expired products ──
      try {
        const { count } = await sb.from(TABLES.PRODUCTS).delete({ count: 'exact' }).lt('expires_at', nowISO);
        deletedProducts = count || 0;
      } catch (err) {
        logger.error('Failed to delete expired products', 'AutoDelete', { error: (err as Error)?.message });
      }

      // ── Batch delete expired offers ──
      try {
        const { count } = await sb.from(TABLES.STORE_OFFERS).delete({ count: 'exact' }).lt('expires_at', nowISO);
        deletedOffers = count || 0;
      } catch (err) {
        logger.error('Failed to delete expired offers', 'AutoDelete', { error: (err as Error)?.message });
      }

      // ── Batch delete chat messages older than 48 hours ──
      const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
      try {
        const { count } = await sb.from(TABLES.CHAT_MESSAGES).delete({ count: 'exact' }).lt('created_at', fortyEightHoursAgo);
        deletedMessages = count || 0;
      } catch (err) {
        logger.error('Failed to delete old chat messages', 'AutoDelete', { error: (err as Error)?.message });
      }

      // ── حذف الحسابات غير النشطة (> 60 يوم) ──
      const inactiveCutoff = new Date(
        Date.now() - INACTIVE_ACCOUNT_DAYS * 24 * 60 * 60 * 1000
      ).toISOString();

      try {
        // Find inactive non-admin users
        const { data: inactiveUsers } = await sb.from(TABLES.USERS)
          .select('id')
          .eq('is_admin', false)
          .lt('updated_at', inactiveCutoff)
          .limit(100);

        if (inactiveUsers && inactiveUsers.length > 0) {
          const userIds = inactiveUsers.map((u: Record<string, unknown>) => u.id as string);
          const { count } = await sb.from(TABLES.USERS).delete({ count: 'exact' }).in('id', userIds);
          deletedUsers = count || 0;

          logger.info('Inactive accounts cleaned up', 'AutoDelete', {
            deletedUsers,
            userIds,
          });
        }
      } catch (err) {
        logger.error('Inactive account cleanup error', 'AutoDelete', {
          error: (err as Error)?.message,
        });
      }
    }

    // Extend duration for a specific item
    if (action === 'extend') {
      const { itemId, itemType, extraDays } = body;
      if (!itemId || !itemType || !extraDays) {
        return badRequest('بيانات غير كاملة');
      }

      if (itemType === 'product') {
        let product;
        try { product = await findProductById(itemId); } catch { return notFound('المنتج غير موجود'); }

        const currentExpiry = product.expires_at ? new Date(product.expires_at).getTime() : Date.now();
        const newExpiry = new Date(Math.max(Date.now(), currentExpiry) + extraDays * 24 * 60 * 60 * 1000);

        await updateProduct(itemId, { expires_at: newExpiry.toISOString() });
        return success({ message: 'تم تمديد مدة المنتج' });
      }

      if (itemType === 'offer') {
        const { data: offer } = await sb.from(TABLES.STORE_OFFERS).select('expires_at').eq('id', itemId).maybeSingle();
        if (!offer) return notFound('العرض غير موجود');

        const currentExpiry = offer.expires_at ? new Date(offer.expires_at).getTime() : Date.now();
        const newExpiry = new Date(Math.max(Date.now(), currentExpiry) + extraDays * 24 * 60 * 60 * 1000);

        await updateStoreOffer(itemId, { expires_at: newExpiry.toISOString() });
        return success({ message: 'تم تمديد مدة العرض' });
      }
    }

    // Archive action
    if (action === 'get-archivable') {
      const [archivableProducts, archivableOffers] = await Promise.all([
        sb.from(TABLES.PRODUCTS).select('id, name, user_id, store_id, description, price, image_url, category, expires_at').lt('expires_at', nowISO).limit(50),
        sb.from(TABLES.STORE_OFFERS).select('id, title, user_id, store_id, description, image_url, type, discount, expires_at').lt('expires_at', nowISO).limit(50),
      ]);

      return success({
        archivable: [
          ...(archivableProducts.data || []).map((p: Record<string, unknown>) => ({
            id: p.id,
            userId: p.user_id,
            contentType: 'product' as const,
            contentId: p.id,
            contentName: p.name,
            contentData: {
              name: p.name,
              description: p.description,
              price: p.price,
              image_url: p.image_url,
              category: p.category,
            },
            originalDuration: Math.max(1, Math.min(30, Math.round(
              (new Date(p.expires_at as string || Date.now()).getTime() - Date.now()) / (24 * 60 * 60 * 1000)
            ))) as 1 | 2 | 3 | 5 | 7 | 10 | 15 | 20 | 25 | 30,
          })),
          ...(archivableOffers.data || []).map((o: Record<string, unknown>) => ({
            id: o.id,
            userId: o.user_id,
            contentType: 'offer' as const,
            contentId: o.id,
            contentName: o.title,
            contentData: {
              title: o.title,
              description: o.description,
              image_url: o.image_url,
              type: o.type,
              discount: o.discount,
            },
            originalDuration: Math.max(1, Math.min(30, Math.round(
              (new Date(o.expires_at as string || Date.now()).getTime() - Date.now()) / (24 * 60 * 60 * 1000)
            ))) as 1 | 2 | 3 | 5 | 7 | 10 | 15 | 20 | 25 | 30,
          })),
        ],
      });
    }

    return success({
      deleted: {
        products: deletedProducts,
        offers: deletedOffers,
        messages: deletedMessages,
        inactiveAccounts: deletedUsers,
      },
    });
  } catch (error) {
    logger.error('Auto-delete cleanup error', 'AutoDelete', { error: (error as Error)?.message });
    return serverError('حدث خطأ أثناء التنظيف');
  }
})
