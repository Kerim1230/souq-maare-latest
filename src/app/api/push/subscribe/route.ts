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
 *
 * The `push_subscriptions` table stores the full PushSubscription object
 * in a `subscription` jsonb column (not separate endpoint/p256dh/auth columns).
 * This matches the Supabase table schema:
 *   - id (uuid, PK)
 *   - user_id (uuid, FK → users.id)
 *   - subscription (jsonb)
 *   - user_agent (text, nullable)
 *   - created_at (timestamptz)
 *   - updated_at (timestamptz)
 */
export const POST = withRoute(async (request: NextRequest) => {
  try {
    console.log('[Push API] POST /api/push/subscribe — request received');

    const auth = await requireAuth(request);
    if (!auth.success) {
      console.warn('[Push API] Auth failed:', auth.response?.status);
      return auth.response;
    }
    const userId = auth.userId;
    console.log('[Push API] Authenticated user:', userId);

    const body = await request.json();
    const { subscription } = body;

    console.log('[Push API] Subscription data:', {
      hasSubscription: !!subscription,
      hasEndpoint: !!subscription?.endpoint,
      endpointPrefix: subscription?.endpoint?.substring(0, 50),
      hasP256dh: !!subscription?.keys?.p256dh,
      hasAuth: !!subscription?.keys?.auth,
    });

    if (!subscription || !subscription.endpoint) {
      console.warn('[Push API] Missing subscription or endpoint');
      return badRequest('بيانات الاشتراك غير صالحة');
    }

    const { keys } = subscription;
    if (!keys?.p256dh || !keys?.auth) {
      console.warn('[Push API] Missing keys:', { hasP256dh: !!keys?.p256dh, hasAuth: !!keys?.auth });
      return badRequest('مفاتيح الاشتراك مفقودة');
    }

    const sb = getSupabaseAdmin();
    const endpoint = subscription.endpoint;

    // ── Find existing subscription for this user with the same endpoint ──
    // The subscription is stored as jsonb, so we query by user_id first
    // then filter in JS for the matching endpoint.
    console.log('[Push API] Checking for existing subscription for user:', userId);
    const { data: existing, error: fetchError } = await sb
      .from(TABLES.PUSH_SUBSCRIPTIONS)
      .select('id, subscription')
      .eq('user_id', userId);

    if (fetchError) {
      console.error('[Push API] Error fetching existing subscriptions:', fetchError.message);
      throw new Error(fetchError.message);
    }

    // Find a row whose stored subscription has the same endpoint
    const match = (existing || []).find((row: any) => {
      try {
        const sub = typeof row.subscription === 'string'
          ? JSON.parse(row.subscription)
          : row.subscription;
        return sub?.endpoint === endpoint;
      } catch {
        return false;
      }
    });

    let result;

    if (match) {
      // Update existing subscription
      console.log('[Push API] Updating existing subscription, id:', match.id);
      result = handleResponse(
        await sb
          .from(TABLES.PUSH_SUBSCRIPTIONS)
          .update({
            subscription,
            updated_at: new Date().toISOString(),
          })
          .eq('id', match.id)
          .select()
          .single(),
        'push/subscribe update'
      );
    } else {
      // Insert new subscription
      console.log('[Push API] Inserting new subscription for user:', userId);
      result = handleResponse(
        await sb
          .from(TABLES.PUSH_SUBSCRIPTIONS)
          .insert({
            user_id: userId,
            subscription,
          })
          .select()
          .single(),
        'push/subscribe insert'
      );
    }

    console.log('[Push API] ✅ Subscription saved successfully');
    return created({ subscription: result });
  } catch (error) {
    logger.error('Push subscription save error', 'PushSubscribe', { error: (error as Error)?.message });
    console.error('[Push API] ❌ Error:', (error as Error)?.message);
    return apiError('حدث خطأ أثناء حفظ الاشتراك', 500, { code: 'PUSH_SUBSCRIBE_FAILED' });
  }
});

/**
 * DELETE /api/push/subscribe
 * Remove a push subscription for the authenticated user.
 * Accepts the endpoint as a query parameter.
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

    // Find subscriptions for this user, then match by endpoint in the jsonb
    const { data: subs, error: fetchError } = await sb
      .from(TABLES.PUSH_SUBSCRIPTIONS)
      .select('id, subscription')
      .eq('user_id', userId);

    if (fetchError) {
      logger.warn('Failed to fetch subscriptions for delete', 'PushSubscribe', { userId, error: fetchError.message });
      return apiError('حدث خطأ أثناء حذف الاشتراك', 500, { code: 'PUSH_UNSUBSCRIBE_FAILED' });
    }

    const match = (subs || []).find((row: any) => {
      try {
        const sub = typeof row.subscription === 'string'
          ? JSON.parse(row.subscription)
          : row.subscription;
        return sub?.endpoint === endpoint;
      } catch {
        return false;
      }
    });

    if (!match) {
      // Subscription not found — already deleted, that's OK
      return success(null);
    }

    const { error } = await sb
      .from(TABLES.PUSH_SUBSCRIPTIONS)
      .delete()
      .eq('id', match.id)
      .eq('user_id', userId);

    if (error) {
      logger.warn('Failed to delete push subscription', 'PushSubscribe', { userId, error: error.message });
      return apiError('حدث خطأ أثناء حذف الاشتراك', 500, { code: 'PUSH_UNSUBSCRIBE_FAILED' });
    }

    console.log('[Push API] ✅ Subscription deleted, id:', match.id);
    return success(null);
  } catch (error) {
    logger.error('Push subscription delete error', 'PushSubscribe', { error: (error as Error)?.message });
    return apiError('حدث خطأ أثناء حذف الاشتراك', 500, { code: 'PUSH_UNSUBSCRIBE_FAILED' });
  }
});
