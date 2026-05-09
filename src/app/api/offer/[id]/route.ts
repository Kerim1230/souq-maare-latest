export const runtime = 'nodejs'
import { withRoute } from '@/server/lib/route-wrapper';
import { NextRequest } from 'next/server';
import { getSupabaseAdmin, updateStoreOffer, TABLES, handleCount } from '@/lib/supabase-db';
import { mapOffer } from '@/lib/api-utils';
import { success, notFound, serverError } from '@/lib/api-response';
import { logger } from '@/lib/logger';

export const GET = withRoute(async (
  _request: NextRequest,
  context: unknown
) => {
  try {
    const { params } = context as { params: Promise<{ id: string }> };
    const { id } = await params;

    const sb = getSupabaseAdmin();

    const { data: offer, error } = await sb.from(TABLES.STORE_OFFERS)
      .select('*, store:stores(id, name, logo_url, is_verified, theme_color)')
      .eq('id', id)
      .single();

    if (error || !offer) {
      return notFound('العرض غير موجود');
    }

    // Count comments
    const commentsCount = await handleCount(
      await sb.from(TABLES.COMMENTS).select('*', { count: 'exact', head: true }).eq('offer_id', id),
      'offerCommentsCount'
    );

    // Increment views (non-critical — best-effort)
    try {
      await updateStoreOffer(id, { views: (offer.views || 0) + 1 });
    } catch (err) {
      logger.warn('Offer view count increment failed (non-critical)', 'OfferDetail', { error: (err as Error)?.message });
    }

    const mapped = mapOffer(offer);

    return success({
      offer: {
        ...mapped,
        views: (offer.views || 0) + 1,
        store_name: offer.store?.name || null,
        store_logo: offer.store?.logo_url || null,
        store_verified: offer.store?.is_verified || false,
        store_theme_color: offer.store?.theme_color || null,
        comments_count: commentsCount,
      },
    });
  } catch (error) {
    logger.error('Offer detail error', 'OfferDetail', { error: (error as Error)?.message });
    return serverError('حدث خطأ أثناء جلب العرض');
  }
})
