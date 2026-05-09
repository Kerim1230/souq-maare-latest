export const runtime = 'nodejs'
import { withRoute } from '@/server/lib/route-wrapper';
import { NextRequest } from 'next/server';
import { mapStore } from '@/lib/api-utils';
import { requireStoreOwner } from '@/server/lib/require-auth';
import { success, badRequest, serverError } from '@/lib/api-response';
import { logger } from '@/lib/logger';
import { validateId } from '@/utils/validation';
import { updateStore } from '@/lib/supabase-db';
import { serverCache } from '@/lib/cache';

export const PUT = withRoute(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const { storeId, isFeatured } = body;

    // Verify the authenticated user owns this store (or is admin)
    const auth = await requireStoreOwner(request, storeId);
    if (!auth.success) return auth.response;

    const storeIdCheck = validateId(storeId, 'معرف المتجر');
    if (!storeIdCheck.valid) return badRequest(storeIdCheck.error!);
    if (typeof isFeatured !== 'boolean') {
      return badRequest('حالة التمييز مطلوبة');
    }

    // requireStoreOwner already verified the store exists & belongs to the user
    const updatedStore = await updateStore(storeId, { is_featured: isFeatured });

    // Invalidate store and home caches after toggling featured status
    serverCache.invalidateByPrefix('stores:');
    serverCache.invalidateByPrefix('home:');

    return success({ store: mapStore(updatedStore) });
  } catch (error) {
    logger.error('Toggle store featured error', 'ToggleFeatured', { error: (error as Error)?.message });
    return serverError('حدث خطأ أثناء تحديث حالة التمييز');
  }
})
