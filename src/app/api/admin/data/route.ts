export const runtime = 'nodejs'
import { NextRequest } from 'next/server';
import { requireAdmin } from '@/server/lib/admin-auth';
import { checkRateLimit, getClientIp, LIMITS } from '@/server/lib/rate-limiter';
import { success, serverError, rateLimited } from '@/lib/api-response';
import { logger } from '@/lib/logger';
import { getSupabaseAdmin, TABLES, handleCount } from '@/lib/supabase-db';
import { withRoute } from '@/server/lib/route-wrapper';

export const GET = withRoute(async (request: NextRequest) => {
  // Verify admin access
  const admin = await requireAdmin(request);
  if (!admin.success) return admin.response;

  // Rate limiting
  const ip = getClientIp(request);
  const rateCheck = checkRateLimit(`admin:${ip}`, LIMITS.admin);
  if (!rateCheck.success) {
    return rateLimited();
  }

  try {
    // ── Users ordered by created_at desc with counts ──
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '100', 10);
    const safeLimit = Math.min(limit, 500);
    const sb = getSupabaseAdmin();

    const [users, stores, products, offers] = await Promise.all([
      sb.from(TABLES.USERS).select('*').order('created_at', { ascending: false }).limit(safeLimit),
      sb.from(TABLES.STORES).select('*, user:users(full_name, email)').order('created_at', { ascending: false }).limit(safeLimit),
      sb.from(TABLES.PRODUCTS).select('*, store:stores(name, is_verified)').order('created_at', { ascending: false }).limit(safeLimit),
      sb.from(TABLES.STORE_OFFERS).select('*, store:stores(name), comments:comments(id)').order('created_at', { ascending: false }).limit(safeLimit),
    ]);

    // Get store/product counts per user
    const [storeCounts, productCounts] = await Promise.all([
      sb.from(TABLES.STORES).select('user_id'),
      sb.from(TABLES.PRODUCTS).select('user_id'),
    ]);

    const storeCountMap = new Map<string, number>();
    for (const s of (storeCounts.data || [])) {
      storeCountMap.set(s.user_id, (storeCountMap.get(s.user_id) || 0) + 1);
    }
    const productCountMap = new Map<string, number>();
    for (const p of (productCounts.data || [])) {
      productCountMap.set(p.user_id, (productCountMap.get(p.user_id) || 0) + 1);
    }

    const mappedUsers = (users.data || []).map((u: Record<string, unknown>) => ({
      id: u.id,
      email: u.email,
      fullName: u.full_name,
      avatarUrl: u.avatar_url,
      createdAt: u.created_at,
      _count: {
        stores: storeCountMap.get(u.id as string) || 0,
        products: productCountMap.get(u.id as string) || 0,
      },
    }));

    // Get follower/product counts per store
    const storeIds = (stores.data || []).map((s: Record<string, unknown>) => s.id);
    let followerCounts = new Map<string, number>();
    let storeProductCounts = new Map<string, number>();
    if (storeIds.length > 0) {
      const [followData, spData] = await Promise.all([
        sb.from(TABLES.STORE_FOLLOWS).select('store_id').in('store_id', storeIds),
        sb.from(TABLES.PRODUCTS).select('store_id').in('store_id', storeIds),
      ]);
      for (const f of (followData.data || [])) {
        followerCounts.set(f.store_id, (followerCounts.get(f.store_id) || 0) + 1);
      }
      for (const p of (spData.data || [])) {
        storeProductCounts.set(p.store_id, (storeProductCounts.get(p.store_id) || 0) + 1);
      }
    }

    const mappedStores = (stores.data || []).map((s: Record<string, unknown>) => ({
      id: s.id,
      user_id: s.user_id,
      name: s.name,
      description: s.description,
      logo_url: s.logo_url,
      cover_url: s.cover_url,
      category: s.category,
      is_verified: s.is_verified,
      chat_enabled: s.chat_enabled,
      theme_color: s.theme_color || null,
      is_featured: s.is_featured,
      followers_count: followerCounts.get(s.id as string) || 0,
      is_following: false,
      user: (s as Record<string, unknown>).user ? { fullName: ((s as Record<string, unknown>).user as Record<string, unknown>)?.full_name, email: ((s as Record<string, unknown>).user as Record<string, unknown>)?.email } : null,
      productCount: storeProductCounts.get(s.id as string) || 0,
      followerCount: followerCounts.get(s.id as string) || 0,
    }));

    const mappedProducts = (products.data || []).map((p: Record<string, unknown>) => ({
      id: p.id,
      store_id: p.store_id,
      user_id: p.user_id,
      name: p.name,
      description: p.description,
      price: p.price,
      image_url: p.image_url,
      category: p.category,
      is_featured: p.is_featured,
      is_new: p.is_new,
      views: p.views,
      expires_at: p.expires_at ?? null,
      created_at: p.created_at,
      store: (p as Record<string, unknown>).store ? { name: ((p as Record<string, unknown>).store as Record<string, unknown>)?.name, isVerified: ((p as Record<string, unknown>).store as Record<string, unknown>)?.is_verified } : null,
    }));

    const mappedOffers = (offers.data || []).map((o: Record<string, unknown>) => ({
      id: o.id,
      store_id: o.store_id,
      user_id: o.user_id,
      title: o.title,
      description: o.description,
      image_url: o.image_url,
      type: o.type,
      discount: o.discount,
      views: o.views,
      expires_at: o.expires_at ?? null,
      created_at: o.created_at,
      comments_count: Array.isArray((o as Record<string, unknown>).comments) ? ((o as Record<string, unknown>).comments as unknown[]).length : 0,
      store: (o as Record<string, unknown>).store ? { name: ((o as Record<string, unknown>).store as Record<string, unknown>)?.name } : null,
    }));

    // ── Additional admin stats ──
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const [activeUsersNow, newProducts7d, newUsers7d] = await Promise.all([
      handleCount(await sb.from(TABLES.USERS).select('*', { count: 'exact', head: true }).gte('updated_at', thirtyMinAgo), 'activeUsersNow'),
      handleCount(await sb.from(TABLES.PRODUCTS).select('*', { count: 'exact', head: true }).gte('created_at', sevenDaysAgo), 'newProducts7d'),
      handleCount(await sb.from(TABLES.USERS).select('*', { count: 'exact', head: true }).gte('created_at', sevenDaysAgo), 'newUsers7d'),
    ]);

    return success({
      users: mappedUsers,
      stores: mappedStores,
      products: mappedProducts,
      offers: mappedOffers,
      reports: [],
      pointOrders: [],
      activityLog: [],
      verifications: [],
      adminStats: {
        activeUsersNow,
        newProducts7d,
        newUsers7d,
      },
    });
  } catch (error) {
    logger.error('Admin data fetch error', 'AdminData', { error: (error as Error)?.message });
    const message = process.env.NODE_ENV === 'development'
      ? (error instanceof Error ? error.message : 'Unknown error')
      : 'حدث خطأ غير متوقع';
    return serverError(message);
  }
})
