export const runtime = 'nodejs'
import { NextRequest } from 'next/server';
import { getSupabaseAdmin, markMessagesRead, TABLES } from '@/lib/supabase-db';
import { requireAuth } from '@/server/lib/auth-guard';
import { badRequest, forbidden, success, serverError } from '@/lib/api-response';
import { logger } from '@/lib/logger';
import { withRoute } from '@/server/lib/route-wrapper';

const CONV_SEP = '::';

/**
 * POST /api/chat/mark-read
 */
export const POST = withRoute(async (request: NextRequest) => {
  try {
    const auth = await requireAuth(request);
    if (!auth.success) return auth.response;
    const userId = auth.userId;

    const body = await request.json();
    const { conversationId, senderId, receiverId, storeId } = body;

    let userA = '';
    let userB = '';

    if (senderId && receiverId) {
      userA = senderId;
      userB = receiverId;
    } else if (conversationId) {
      const idx = conversationId.indexOf(CONV_SEP);
      if (idx > 0) {
        userA = conversationId.substring(0, idx);
        userB = conversationId.substring(idx + CONV_SEP.length);
      } else {
        const lastIdx = conversationId.lastIndexOf('-');
        if (lastIdx > 0) {
          userA = conversationId.substring(0, lastIdx);
          userB = conversationId.substring(lastIdx + 1);
        }
      }
    }

    if (!userA || !userB) return badRequest('تنسيق معرف المحادثة غير صالح');

    if (userId !== userA && userId !== userB) {
      return forbidden('ليس لديك صلاحية لهذا الإجراء');
    }

    let totalMarked = 0;

    const sb = getSupabaseAdmin();

    // Mark messages from userA → userId as read (userId is the receiver)
    if (userB === userId) {
      let query = sb.from(TABLES.CHAT_MESSAGES)
        .update({ is_read: true }, { count: 'exact' })
        .eq('sender_id', userA)
        .eq('receiver_id', userId)
        .eq('is_read', false);
      if (storeId) query = query.eq('store_id', storeId);
      const resp = await query;
      if (resp.error) {
        logger.error('Failed to mark messages read (userA→userId)', 'ChatMarkRead', { error: resp.error.message });
      } else {
        totalMarked += resp.count ?? 0;
      }
    }

    // Mark messages from userB → userId as read (userId is the receiver)
    if (userA === userId) {
      let query = sb.from(TABLES.CHAT_MESSAGES)
        .update({ is_read: true }, { count: 'exact' })
        .eq('sender_id', userB)
        .eq('receiver_id', userId)
        .eq('is_read', false);
      if (storeId) query = query.eq('store_id', storeId);
      const resp = await query;
      if (resp.error) {
        logger.error('Failed to mark messages read (userB→userId)', 'ChatMarkRead', { error: resp.error.message });
      } else {
        totalMarked += resp.count ?? 0;
      }
    }

    return success({ messagesMarked: totalMarked });
  } catch (error) {
    logger.error('Failed to mark messages as read', 'ChatMarkRead', { error: (error as Error)?.message });
    return serverError('Failed to mark messages as read');
  }
})
