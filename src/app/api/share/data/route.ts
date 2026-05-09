export const runtime = 'nodejs'
import { NextRequest } from 'next/server';
import { getSupabaseAdmin, findStoreById, findProductById, TABLES, handleCount } from '@/lib/supabase-db';
import { success, badRequest, notFound, serverError } from '@/lib/api-response';
import { logger } from '@/lib/logger';
import { withRoute } from '@/server/lib/route-wrapper';

const VALID_TYPES = ['store', 'product', 'offer', 'contest'] as const;
type ValidType = (typeof VALID_TYPES)[number];

/** Basic UUID format check. */
function isUUID(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export const GET = withRoute(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const id = searchParams.get('id');

    if (!type || !id) {
      return badRequest('Missing type or id');
    }

    if (!VALID_TYPES.includes(type as ValidType)) {
      return badRequest('Invalid type');
    }

    if (!isUUID(id)) {
      return badRequest('Invalid id format');
    }

    const sb = getSupabaseAdmin();

    if (type === 'store') {
      let store;
      try {
        store = await findStoreById(id);
      } catch {
        return notFound('Not found');
      }

      const [productsCount, followersCount] = await Promise.all([
        handleCount(await sb.from(TABLES.PRODUCTS).select('*', { count: 'exact', head: true }).eq('store_id', id), 'shareStoreProducts'),
        handleCount(await sb.from(TABLES.STORE_FOLLOWS).select('*', { count: 'exact', head: true }).eq('store_id', id), 'shareStoreFollowers'),
      ]);

      return success({
        type: 'store',
        id: store.id,
        name: store.name,
        description: store.description,
        logo_url: store.logo_url,
        cover_url: store.cover_url,
        category: store.category,
        products_count: productsCount,
        followers_count: followersCount,
        is_verified: store.is_verified,
      });
    }

    if (type === 'product') {
      let product;
      try {
        product = await findProductById(id);
      } catch {
        return notFound('Not found');
      }

      // Fetch store info separately
      let storeName: string | null = null;
      let storeLogo: string | null = null;
      if (product.store_id) {
        try {
          const store = await findStoreById(product.store_id);
          storeName = store.name;
          storeLogo = store.logo_url;
        } catch {
          // Store not found — proceed without store info
        }
      }

      return success({
        type: 'product',
        id: product.id,
        name: product.name,
        description: product.description,
        price: product.price,
        image_url: product.image_url,
        category: product.category,
        is_featured: product.is_featured,
        is_new: product.is_new,
        store_name: storeName,
        store_logo: storeLogo,
      });
    }

    if (type === 'offer' || type === 'contest') {
      const { data: offer, error } = await sb.from(TABLES.STORE_OFFERS)
        .select('*, store:stores(name, logo_url)')
        .eq('id', id)
        .single();

      if (error || !offer) {
        return notFound('Not found');
      }

      const commentsCount = await handleCount(
        await sb.from(TABLES.COMMENTS).select('*', { count: 'exact', head: true }).eq('offer_id', id),
        'shareOfferComments'
      );

      return success({
        type: offer.type === 'contest' ? 'contest' : 'offer',
        id: offer.id,
        title: offer.title,
        description: offer.description,
        image_url: offer.image_url,
        discount: offer.discount,
        expires_at: offer.expires_at || null,
        store_name: (offer.store as Record<string, unknown>)?.name || null,
        store_logo: (offer.store as Record<string, unknown>)?.logo_url || null,
        comments_count: commentsCount,
      });
    }

    return badRequest('Invalid type');
  } catch (err) {
    logger.warn('Share data fetch failed', 'ShareData', { error: (err as Error)?.message });
    return serverError('Internal server error');
  }
})
