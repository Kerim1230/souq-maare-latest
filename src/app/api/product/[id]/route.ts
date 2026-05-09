export const runtime = 'nodejs'
import { withRoute } from '@/server/lib/route-wrapper';
import { NextRequest } from 'next/server';
import { getSupabaseAdmin, findProductById, updateProduct, TABLES } from '@/lib/supabase-db';
import { success, notFound, serverError } from '@/lib/api-response';
import { logger } from '@/lib/logger';

export const GET = withRoute(async (
  _request: NextRequest,
  context: unknown
) => {
  try {
    const { params } = context as { params: Promise<{ id: string }> };
    const { id } = await params;

    // Fetch product with store join
    const sb = getSupabaseAdmin();
    const { data: product, error } = await sb
      .from(TABLES.PRODUCTS)
      .select('*, store:stores(id, name, logo_url, is_verified, chat_enabled)')
      .eq('id', id)
      .single();

    if (error || !product) {
      return notFound('المنتج غير موجود');
    }

    // Increment view count using Supabase RPC-style update
    // PostgreSQL: views = COALESCE(views, 0) + 1
    try {
      await updateProduct(id, { views: (product.views || 0) + 1 });
    } catch (err) {
      logger.warn('Product view count increment failed (non-critical)', 'ProductDetail', { error: (err as Error)?.message });
    }

    const store = product.store as any;

    return success({
      product: {
        id: product.id,
        store_id: product.store_id,
        user_id: product.user_id,
        title: product.name,
        name: product.name,
        description: product.description,
        price: product.price,
        image_url: product.image_url,
        category: product.category,
        is_featured: product.is_featured,
        is_new: product.is_new,
        views: (product.views || 0) + 1,
        expires_at: typeof product.expires_at === 'string' ? product.expires_at : product.expires_at?.toISOString?.() || null,
        created_at: typeof product.created_at === 'string' ? product.created_at : product.created_at?.toISOString?.() || null,
        updated_at: typeof product.updated_at === 'string' ? product.updated_at : product.updated_at?.toISOString?.() || null,
        store_name: store?.name || null,
        store_logo: store?.logo_url || null,
        store_verified: store?.is_verified || false,
        store_chat_enabled: store?.chat_enabled || false,
      },
    });
  } catch (error) {
    logger.error('Product detail error', 'ProductDetail', { error: (error as Error)?.message });
    return serverError('حدث خطأ أثناء جلب المنتج');
  }
})
