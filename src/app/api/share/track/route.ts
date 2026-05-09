export const runtime = 'nodejs'
import { NextRequest } from 'next/server';
import { getSupabaseAdmin, findStoreById, findProductById, TABLES } from '@/lib/supabase-db';
import { success, badRequest, serverError } from '@/lib/api-response';
import { logger } from '@/lib/logger';
import { withRoute } from '@/server/lib/route-wrapper';

const VALID_ITEM_TYPES = ['store', 'product', 'offer', 'contest'] as const;

export const POST = withRoute(async (request: NextRequest) => {
  try {
    const { itemType, itemId, referrer } = await request.json();

    if (!itemType || !itemId) {
      return badRequest('Missing required fields');
    }

    if (!VALID_ITEM_TYPES.includes(itemType)) {
      return badRequest('Invalid item type');
    }

    // Get item name (best-effort via Supabase)
    let itemName = '';
    const sb = getSupabaseAdmin();

    try {
      if (itemType === 'store') {
        try {
          const store = await findStoreById(itemId);
          if (store) itemName = store.name;
        } catch { /* not found */ }
      } else if (itemType === 'product') {
        try {
          const product = await findProductById(itemId);
          if (product) itemName = product.name;
        } catch { /* not found */ }
      } else if (itemType === 'offer' || itemType === 'contest') {
        const { data: offer } = await sb.from(TABLES.STORE_OFFERS)
          .select('title')
          .eq('id', itemId)
          .maybeSingle();
        if (offer) itemName = offer.title;
      }
    } catch (err) {
      logger.warn('Share track lookup failed', 'ShareTrack', {
        error: (err as Error)?.message,
      });
    }

    return success({
      itemType,
      itemId,
      itemName,
      referrer: referrer || 'direct',
    });
  } catch (error) {
    logger.error('Share track error', 'ShareTrack', { error: (error as Error)?.message });
    return serverError('Internal server error');
  }
})
