export const runtime = 'nodejs'
import { withRoute } from '@/server/lib/route-wrapper';
import { NextRequest } from 'next/server';
import { requireAuth } from '@/server/lib/auth-guard';
import { findVerificationByStoreId, findStoreById } from '@/lib/supabase-db';
import { success, badRequest, serverError } from '@/lib/api-response';
import { logger } from '@/lib/logger';
import { type VerificationTier, getPlan } from '@/lib/constants';

// GET /api/verification?storeId=... — fetch verification data for a specific store
export const GET = withRoute(async (request: NextRequest) => {
  const auth = await requireAuth(request);
  if (!auth.success) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const storeId = searchParams.get('storeId');

    if (!storeId) {
      return badRequest('معرف المتجر مطلوب');
    }

    const v = await findVerificationByStoreId(storeId);

    if (!v) {
      // No verification record — still return chatEnabled from the store
      let chatEnabled = false;
      try {
        const store = await findStoreById(storeId);
        chatEnabled = store?.chat_enabled ?? false;
      } catch { /* non-critical */ }
      return success({ verification: null, chatEnabled });
    }

    // Also fetch chat_enabled from the store
    let chatEnabled = false;
    try {
      const store = await findStoreById(storeId);
      chatEnabled = store?.chat_enabled ?? false;
    } catch { /* non-critical */ }

    return success({
      verification: {
        storeId: v.store_id,
        userId: v.user_id,
        storeName: v.store_name,
        tier: (v.tier as VerificationTier) || 'bronze',
        isActive: v.is_active,
        startDate: v.start_date || null,
        endDate: v.end_date || null,
        grantedBy: v.granted_by || null,
        chatEnabled,
      },
    });
  } catch (error) {
    logger.error('Verification GET error', 'VerificationAPI', { error: (error as Error)?.message });
    console.error('[VerificationAPI] GET error:', error);
    return serverError('حدث خطأ أثناء جلب بيانات التوثيق');
  }
})
