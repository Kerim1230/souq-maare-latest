export const runtime = 'nodejs'
import { NextRequest } from 'next/server';
import { getSupabaseAdmin, handleResponse, TABLES } from '@/lib/supabase-db';
import { requireAuth } from '@/server/lib/auth-guard';
import { success, badRequest, forbidden, serverError } from '@/lib/api-response';
import { logger } from '@/lib/logger';
import { getErrorMessage } from '@/lib/error-utils';
import { withRoute } from '@/server/lib/route-wrapper';

const CONV_SEP = '::';

/**
 * GET /api/chat/conversations?storeId=xxx
 */
export const GET = withRoute(async (request: NextRequest) => {
  try {
    const auth = await requireAuth(request);
    if (!auth.success) return auth.response;
    const userId = auth.userId;

    const { searchParams } = new URL(request.url);
    const storeId = searchParams.get('storeId');

    const sb = getSupabaseAdmin();

    // Fetch recent messages where user is sender or receiver
    let query = sb.from(TABLES.CHAT_MESSAGES)
      .select('*, sender:users!chat_messages_sender_id_fkey(id, full_name, avatar_url, phone), receiver:users!chat_messages_receiver_id_fkey(id, full_name, avatar_url, phone)')
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
      .order('created_at', { ascending: false })
      .limit(200);

    if (storeId) query = query.eq('store_id', storeId);

    const recentMessages = handleResponse(await query, 'GET /api/chat/conversations');

    const messages = recentMessages.map((m: any) => ({
      ...m,
      sender_id: m.sender_id,
      receiver_id: m.receiver_id,
      store_id: m.store_id,
      is_read: m.is_read,
      created_at: m.created_at,
      sender: m.sender ? {
        full_name: m.sender.full_name,
        avatar_url: m.sender.avatar_url,
        phone: m.sender.phone,
      } : null,
      receiver: m.receiver ? {
        full_name: m.receiver.full_name,
        avatar_url: m.receiver.avatar_url,
        phone: m.receiver.phone,
      } : null,
    }));

    const conversationMap = new Map<string, Record<string, unknown>>();

    for (const msg of messages) {
      const otherUserId = msg.sender_id === userId ? msg.receiver_id : msg.sender_id;
      const otherUser = msg.sender_id === userId ? msg.receiver : msg.sender;
      const convKey = [userId, otherUserId].sort().join(CONV_SEP);

      if (!conversationMap.has(convKey)) {
        conversationMap.set(convKey, {
          id: convKey,
          otherUserId,
          otherUserName: (otherUser?.full_name as string) || 'مستخدم',
          otherUserAvatar: (otherUser?.avatar_url as string) || null,
          otherUserPhone: (otherUser?.phone as string) || null,
          storeId: msg.store_id || null,
          lastMessage: msg.content,
          lastMessageTime: msg.created_at,
          lastMessageSenderId: msg.sender_id,
          unreadCount: 0,
        });
      }

      if (msg.receiver_id === userId && !msg.is_read) {
        const conv = conversationMap.get(convKey)!;
        conv.unreadCount = (conv.unreadCount as number) + 1;
      }
    }

    const conversations = Array.from(conversationMap.values())
      .sort((a, b) => {
        try {
          return new Date(b.lastMessageTime as string).getTime() - new Date(a.lastMessageTime as string).getTime();
        } catch (err) { logger.warn('Date parsing failed in sort', 'ChatConversations', { error: (err as Error)?.message }); return 0; }
      });

    // Enrich with store info
    const storeIds = [...new Set(conversations.map((c) => c.storeId).filter((s): s is string => !!s))];
    const storeMap: Record<string, { id: string; name: string; logo_url: string | null }> = {};
    if (storeIds.length > 0) {
      const stores = handleResponse(
        await sb.from(TABLES.STORES).select('id, name, logo_url').in('id', storeIds),
        'GET /api/chat/conversations stores'
      );
      for (const s of stores) storeMap[s.id] = { id: s.id, name: s.name, logo_url: s.logo_url };
    }

    const enrichedConversations = conversations.map((conv) => {
      const storeInfo = conv.storeId ? storeMap[conv.storeId as string] || null : null;
      return {
        ...conv,
        storeName: storeInfo?.name || null,
        storeLogo: storeInfo?.logo_url || null,
        store: storeInfo,
      };
    });

    return success({ conversations: enrichedConversations });
  } catch (error) {
    logger.error('Failed to load conversations', 'ChatConversations', { error: getErrorMessage(error) });
    return serverError('Failed to load conversations');
  }
})

/**
 * DELETE /api/chat/conversations?conversationId=xxx
 */
export const DELETE = withRoute(async (request: NextRequest) => {
  try {
    const auth = await requireAuth(request);
    if (!auth.success) return auth.response;
    const sessionUserId = auth.userId;

    const { searchParams } = new URL(request.url);
    const conversationId = searchParams.get('conversationId');

    if (!conversationId) return badRequest('معرف المحادثة مطلوب');

    let userA = '';
    let userB = '';
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

    if (!userA || !userB) return badRequest('تنسيق معرف المحادثة غير صالح');
    if (sessionUserId !== userA && sessionUserId !== userB) {
      return forbidden('ليس لديك صلاحية لحذف هذه المحادثة');
    }

    const sb = getSupabaseAdmin();

    // Delete messages in both directions
    const resp1 = await sb.from(TABLES.CHAT_MESSAGES).delete({ count: 'exact' }).eq('sender_id', userA).eq('receiver_id', userB);
    const count1 = resp1.count ?? 0;
    if (resp1.error) {
      logger.error('Failed to delete messages direction 1', 'ChatConversations', { error: resp1.error.message });
    }

    const resp2 = await sb.from(TABLES.CHAT_MESSAGES).delete({ count: 'exact' }).eq('sender_id', userB).eq('receiver_id', userA);
    const count2 = resp2.count ?? 0;
    if (resp2.error) {
      logger.error('Failed to delete messages direction 2', 'ChatConversations', { error: resp2.error.message });
    }

    const totalCount = count1 + count2;
    return success({ deletedCount: totalCount });
  } catch (error) {
    logger.error('Failed to delete conversation', 'ChatConversations', { error: getErrorMessage(error) });
    return serverError('Failed to delete conversation');
  }
})
