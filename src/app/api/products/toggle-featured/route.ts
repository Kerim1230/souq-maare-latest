export const runtime = 'nodejs'
import { NextRequest } from 'next/server';
import { requireProductOwner } from '@/server/lib/require-auth';
import { updateProduct } from '@/lib/supabase-db';
import { serverCache } from '@/lib/cache';
import { success, badRequest, serverError } from '@/lib/api-response';
import { logger } from '@/lib/logger';
import { withRoute } from '@/server/lib/route-wrapper';
import { validateId } from '@/utils/validation';

export const PUT = withRoute(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const { productId, isFeatured } = body;

    // Verify the authenticated user owns the store that owns this product
    const auth = await requireProductOwner(request, productId);
    if (!auth.success) return auth.response;

    const productIdCheck = validateId(productId, 'معرف المنتج');
    if (!productIdCheck.valid) return badRequest(productIdCheck.error!);

    if (typeof isFeatured !== 'boolean') {
      return badRequest('قيمة المميز (isFeatured) مطلوبة ويجب أن تكون قيمة منطقية');
    }

    // requireProductOwner already verified the product exists & belongs to user's store
    const product = await updateProduct(productId, { is_featured: isFeatured });

    // Invalidate product and home caches after toggling featured status
    serverCache.invalidateByPrefix('products:');
    serverCache.invalidateByPrefix('home:');

    return success({ product });
  } catch (error: unknown) {
    logger.error('Toggle featured error', 'ToggleFeatured', { error: (error as Error)?.message });
    return serverError('حدث خطأ أثناء تحديث حالة المنتج المميز');
  }
})
