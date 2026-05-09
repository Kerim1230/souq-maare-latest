export const runtime = 'nodejs'
import { withRoute } from '@/server/lib/route-wrapper';
import { NextRequest } from 'next/server';
import { getSupabaseAdmin, TABLES } from '@/lib/supabase-db';
import { checkRateGuard } from '@/server/lib/rate-guard';
import { success, serverError } from '@/lib/api-response';
import { logger } from '@/lib/logger';

/**
 * GET /api/offers?storeId=xxx&search=xxx&limit=50
 * Returns a list of store offers.
 * - storeId: optional filter for a specific store (scoped)
 * - search: optional text search in title (global discovery)
 */
export const GET = withRoute(async (request: NextRequest) => {
  try {
    const rl = checkRateGuard(request, { category: 'search' });
    if (rl) return rl;

    const { searchParams } = new URL(request.url);
    const storeId = searchParams.get('storeId');
    const search = searchParams.get('search');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);

    const sb = getSupabaseAdmin();
    let query = sb.from(TABLES.STORE_OFFERS)
      .select('*, store:stores(name), comments:comments(id)')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (storeId) {
      query = query.eq('store_id', storeId);
    }

    if (search) {
      query = query.ilike('title', `%${search}%`);
    }

    const { data: offers, error } = await query;
    if (error) throw new Error(error.message);

    return success({
      offers: (offers || []).map((o: Record<string, unknown>) => ({
        id: o.id,
        store_id: o.store_id || null,
        user_id: o.user_id || null,
        title: o.title || '',
        description: o.description || '',
        image_url: o.image_url || null,
        type: o.type || 'offer',
        discount: o.discount || null,
        views: o.views || 0,
        expires_at: o.expires_at || null,
        store_name: (o.store as Record<string, unknown>)?.name || null,
        created_at: o.created_at,
        comments_count: Array.isArray(o.comments) ? o.comments.length : 0,
      })),
    });
  } catch (err) {
    logger.warn('Offers fetch failed', 'Offers', { error: (err as Error)?.message });
    return serverError('حدث خطأ أثناء جلب العروض');
  }
})
