export const runtime = 'nodejs'
import { NextRequest } from 'next/server';
import { requireAdmin } from '@/server/lib/auth-guard';
import { sendPushToUser, sendPushToUsers } from '@/lib/vapid';
import { badRequest, success, apiError } from '@/lib/api-response';
import { logger } from '@/lib/logger';
import { withRoute } from '@/server/lib/route-wrapper';

/**
 * POST /api/push/send
 * Admin-only endpoint to send push notifications.
 *
 * Body: { userId?, title, body, url?, tag? }
 * - If userId is provided → send to that user only.
 * - If userId is omitted → broadcast to all subscribed users.
 */
export const POST = withRoute(async (request: NextRequest) => {
  try {
    const auth = await requireAdmin(request);
    if (!auth.success) return auth.response;

    const body = await request.json();
    const { userId, title, body: messageBody, url } = body;

    if (!title || !messageBody) {
      return badRequest('العنوان والمحتوى مطلوبان');
    }

    let sentCount: number;

    if (userId) {
      // Send to a specific user
      sentCount = await sendPushToUser(userId, title, messageBody, url);
    } else {
      // Broadcast to all users — fetch all user IDs with subscriptions
      const { getSupabaseAdmin, TABLES } = await import('@/lib/supabase-db');
      const sb = getSupabaseAdmin();
      const { data, error } = await sb
        .from(TABLES.PUSH_SUBSCRIPTIONS)
        .select('user_id')
        .limit(10000);

      if (error) {
        logger.error('Failed to fetch subscribers for broadcast', 'PushSend', { error: error.message });
        return apiError('حدث خطأ أثناء جلب المشتركين', 500, { code: 'PUSH_BROADCAST_FAILED' });
      }

      const uniqueUserIds = [...new Set((data || []).map((r: { user_id: string }) => r.user_id))];
      sentCount = await sendPushToUsers(uniqueUserIds, title, messageBody, url);
    }

    return success({ sentCount });
  } catch (error) {
    logger.error('Push send error', 'PushSend', { error: (error as Error)?.message });
    return apiError('حدث خطأ أثناء إرسال الإشعار', 500, { code: 'PUSH_SEND_FAILED' });
  }
});
