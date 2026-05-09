export const runtime = 'nodejs'
import { NextRequest } from 'next/server';
import { requireAuth } from '@/server/lib/auth-guard';
import { getSupabaseAdmin, TABLES, handleResponse } from '@/lib/supabase-db';
import { badRequest, created, apiError, success } from '@/lib/api-response';
import { logger } from '@/lib/logger';
import { withRoute } from '@/server/lib/route-wrapper';

/**
 * POST /api/push/subscribe
 * Save or update a push subscription for the authenticated user.
 */
export const POST = withRoute(async (request: NextRequest) => {
  try {
    const auth = await requireAuth(request);
    if (!auth.success) return auth.response;
    const userId = auth.userId;

    const body = await request.json();
    const { subscription } = body;

    console.log('[Push API] Subscribe request received:', { hasSubscription: !!subscription, hasEndpoint: !!subscription?.endpoint });

    if (!subscription || !subscription.endpoint) {
      return badRequest('بيانات الاشتراك غير صالحة');
    }

    const { endpoint, keys } = subscription;
    if (!keys?.p256dh || !keys?.auth) {
      console.warn('[Push API] Missing keys:', { hasP256dh: !!keys?.p256dh, hasAuth: !!keys?.auth });
      return badRequest('مفاتيح الاشتراك مفقودة');
    }

    const sb = getSupabaseAdmin();

    // Upsert by endpoint — a user may have multiple devices,
    // but each endpoint should only exist once.
    const result = handleResponse(
      await sb
        .from(TABLES.PUSH_SUBSCRIPTIONS)
        .upsert(
          {
            user_id: userId,
            endpoint,
            p256dh: keys.p256dh,
            auth: keys.auth,
          },
          { onConflict: 'endpoint' }
        )
        .select()
        .single(),
      'push/subscribe upsert'
    );

    return created({ subscription: result });
  } catch (error) {
    logger.error('Push subscription save error', 'PushSubscribe', { error: (error as Error)?.message });
    return apiError('حدث خطأ أثناء حفظ الاشتراك', 500, { code: 'PUSH_SUBSCRIBE_FAILED' });
  }
});

/**
 * DELETE /api/push/subscribe
 * Remove a push subscription for the authenticated user.
 */
export const DELETE = withRoute(async (request: NextRequest) => {
  try {
    const auth = await requireAuth(request);
    if (!auth.success) return auth.response;
    const userId = auth.userId;

    const { searchParams } = new URL(request.url);
    const endpoint = searchParams.get('endpoint');

    if (!endpoint) {
      return badRequest('معرف الاشتراك مطلوب');
    }

    const sb = getSupabaseAdmin();

    // Only delete if the subscription belongs to this user
    const { error } = await sb
      .from(TABLES.PUSH_SUBSCRIPTIONS)
      .delete()
      .eq('user_id', userId)
      .eq('endpoint', endpoint);

    if (error) {
      logger.warn('Failed to delete push subscription', 'PushSubscribe', { userId, error: error.message });
      return apiError('حدث خطأ أثناء حذف الاشتراك', 500, { code: 'PUSH_UNSUBSCRIBE_FAILED' });
    }

    return success(null);
  } catch (error) {
    logger.error('Push subscription delete error', 'PushSubscribe', { error: (error as Error)?.message });
    return apiError('حدث خطأ أثناء حذف الاشتراك', 500, { code: 'PUSH_UNSUBSCRIBE_FAILED' });
  }
});
