export const runtime = 'nodejs'
import { withRoute } from '@/server/lib/route-wrapper';
import { NextRequest } from 'next/server';
import { requireAuth } from '@/server/lib/auth-guard';
import { forbidden, success, serverError } from '@/lib/api-response';
import { logger } from '@/lib/logger';
import { getSupabaseAdmin, TABLES, handleResponse } from '@/lib/supabase-db';
import { mapStore } from '@/lib/api-utils';

/**
 * GET /api/stores/followed?userId=xxx
 * Returns stores followed by the authenticated user.
 *
 * MIGRATED: Direct Supabase queries replacing followRepo.
 */
export const GET = withRoute(async (request: NextRequest) => {
  try {
    const auth = await requireAuth(request);
    if (!auth.success) return auth.response;

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId') || auth.userId;

    if (userId !== auth.userId) {
      return forbidden('ليس لديك صلاحية لعرض متاجر هذا المستخدم');
    }

    const sb = getSupabaseAdmin();
    const follows = handleResponse(
      await sb
        .from(TABLES.STORE_FOLLOWS)
        .select('*, stores(*)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false }),
      'findFollowedStores'
    );

    const stores = follows
      .filter((f: Record<string, unknown>) => f.stores)
      .map((f: Record<string, unknown>) => mapStore(f.stores));

    return success({ stores });
  } catch (error) {
    logger.error('Followed stores fetch error', 'FollowedStores', { error: (error as Error)?.message });
    return serverError('حدث خطأ أثناء جلب المتاجر المتابعة');
  }
})
