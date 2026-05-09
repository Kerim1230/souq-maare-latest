export const runtime = 'nodejs'
import { NextRequest } from 'next/server';
import { requireAuth } from '@/server/lib/auth-guard';
import { getSupabaseAdmin, createChatMessage, markMessagesRead, findUserById, TABLES, handleCount } from '@/lib/supabase-db';
import { forbidden, success, serverError, apiError, created, badRequest } from '@/lib/api-response';
import { logger } from '@/lib/logger';
import { getErrorMessage } from '@/lib/error-utils';
import { withRoute } from '@/server/lib/route-wrapper';
import { checkBanAsync, isActionAllowed } from '@/lib/ban-check';
import { validateRequired } from '@/utils/validation';
import { sanitizeString } from '@/server/lib/sanitize';

const CONV_SEP = '::';

/** Map a raw chat_message row (with sender/receiver joins) to API response format */
function mapMessage(msg: Record<string, unknown>) {
  return {
    id: msg.id,
    senderId: msg.sender_id,
    receiverId: msg.receiver_id,
    storeId: msg.store_id,
    content: msg.content,
    isRead: msg.is_read,
    createdAt: msg.created_at,
    sender: msg.sender
      ? { id: (msg.sender as Record<string, unknown>).id, fullName: (msg.sender as Record<string, unknown>).full_name, avatarUrl: (msg.sender as Record<string, unknown>).avatar_url }
      : null,
    receiver: msg.receiver
      ? { id: (msg.receiver as Record<string, unknown>).id, fullName: (msg.receiver as Record<string, unknown>).full_name, avatarUrl: (msg.receiver as Record<string, unknown>).avatar_url }
      : null,
  };
}

// ── Inline Supabase query helpers (replacing messageService/messageRepo) ──

async function findConversationMessages(
  senderId: string,
  receiverId: string,
  options: { before?: string; limit?: number } = {}
) {
  const sb = getSupabaseAdmin();
  const limit = options.limit || 50;

  let query = sb.from(TABLES.CHAT_MESSAGES)
    .select('*, sender:users!chat_messages_sender_id_fkey(id, full_name, avatar_url), receiver:users!chat_messages_receiver_id_fkey(id, full_name, avatar_url)')
    .or(`and(sender_id.eq.${senderId},receiver_id.eq.${receiverId}),and(sender_id.eq.${receiverId},receiver_id.eq.${senderId})`)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (options.before) {
    query = query.lt('created_at', options.before);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data || []).map(mapMessage);
}

async function findConversationsList(
  userId: string,
  storeId?: string,
  options: { limit?: number } = {}
): Promise<Array<Record<string, unknown>>> {
  const sb = getSupabaseAdmin();
  const maxMessages = options.limit || 500;

  // Fetch messages involving the user
  let query = sb.from(TABLES.CHAT_MESSAGES)
    .select('*, sender:users!chat_messages_sender_id_fkey(id, full_name, avatar_url), receiver:users!chat_messages_receiver_id_fkey(id, full_name, avatar_url)')
    .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
    .order('created_at', { ascending: false })
    .limit(maxMessages);

  if (storeId) {
    query = query.eq('store_id', storeId);
  }

  const { data: messages, error } = await query;
  if (error) throw new Error(error.message);

  // Group by conversation partner (keep only last message per partner)
  const convMap = new Map<string, Record<string, unknown>>();
  for (const msg of (messages || [])) {
    const otherUserId = msg.sender_id === userId ? msg.receiver_id : msg.sender_id;
    if (!convMap.has(otherUserId)) {
      convMap.set(otherUserId, msg);
    }
  }

  // Collect store IDs for batch enrichment
  const storeIds = new Set<string>();
  for (const [, lastMsg] of convMap) {
    if (lastMsg.store_id) storeIds.add(lastMsg.store_id as string);
  }

  // Batch fetch stores
  const storeMap = new Map<string, { name: string; logo_url: string | null; is_verified: boolean }>();
  if (storeIds.size > 0) {
    const { data: stores } = await sb.from(TABLES.STORES)
      .select('id, name, logo_url, is_verified')
      .in('id', Array.from(storeIds));
    for (const store of (stores || [])) {
      storeMap.set(store.id, store);
    }
  }

  // Batch fetch unread counts per conversation partner
  const unreadCountMap = new Map<string, number>();
  const { data: unreadRows } = await sb.from(TABLES.CHAT_MESSAGES)
    .select('sender_id')
    .eq('receiver_id', userId)
    .eq('is_read', false);
  for (const row of (unreadRows || [])) {
    const count = unreadCountMap.get(row.sender_id) || 0;
    unreadCountMap.set(row.sender_id, count + 1);
  }

  const conversations: Array<Record<string, unknown>> = [];
  for (const [convKey, lastMsg] of convMap) {
    const otherUserId = lastMsg.sender_id === userId ? lastMsg.receiver_id : lastMsg.sender_id;
    const otherUser = lastMsg.sender_id === userId ? lastMsg.receiver : lastMsg.sender;

    const unreadCount = unreadCountMap.get(otherUserId) || 0;
    const store = lastMsg.store_id ? storeMap.get(lastMsg.store_id as string) : null;

    conversations.push({
      id: convKey,
      otherUserId,
      otherUserName: (otherUser as Record<string, unknown>)?.full_name || null,
      otherUserAvatar: (otherUser as Record<string, unknown>)?.avatar_url || null,
      storeId: lastMsg.store_id,
      lastMessage: lastMsg.content,
      lastMessageTime: lastMsg.created_at,
      lastMessageSenderId: lastMsg.sender_id,
      unreadCount: unreadCount || 0,
      storeName: store?.name || null,
      storeLogo: store?.logo_url || null,
      storeVerified: store?.is_verified || false,
    });
  }

  // Sort by last message time descending
  conversations.sort(
    (a, b) =>
      new Date(b.lastMessageTime as string).getTime() - new Date(a.lastMessageTime as string).getTime()
  );

  return conversations;
}

async function markAsReadSupabase(userA: string, userB: string, userId: string) {
  const sb = getSupabaseAdmin();
  // Mark messages from the OTHER user to the current user as read
  const otherUserId = userA === userId ? userB : userA;
  const { count, error } = await sb.from(TABLES.CHAT_MESSAGES)
    .update({ is_read: true }, { count: 'exact' })
    .eq('sender_id', otherUserId)
    .eq('receiver_id', userId)
    .eq('is_read', false);
  if (error) throw new Error(error.message);
  return count || 0;
}

async function deleteConversationSupabase(userA: string, userB: string) {
  const sb = getSupabaseAdmin();
  const { count, error } = await sb.from(TABLES.CHAT_MESSAGES)
    .delete({ count: 'exact' })
    .or(`and(sender_id.eq.${userA},receiver_id.eq.${userB}),and(sender_id.eq.${userB},receiver_id.eq.${userA})`);
  if (error) throw new Error(error.message);
  return count || 0;
}

function parseConversationId(conversationId: string): { userA: string; userB: string } | null {
  // Try :: separator first
  const idx = conversationId.indexOf(CONV_SEP);
  if (idx > 0) {
    return {
      userA: conversationId.substring(0, idx),
      userB: conversationId.substring(idx + CONV_SEP.length),
    };
  }
  // Fallback for old format with - separator
  const lastIdx = conversationId.lastIndexOf('-');
  if (lastIdx > 0) {
    return {
      userA: conversationId.substring(0, lastIdx),
      userB: conversationId.substring(lastIdx + 1),
    };
  }
  return null;
}

// ── Route Handlers ──

export const GET = withRoute(async (request: NextRequest) => {
  try {
    const auth = await requireAuth(request);
    if (!auth.success) return auth.response;

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    if (action === 'conversations') {
      // IDOR: Authenticated user must be the userId in the request
      const userId = searchParams.get('userId');
      if (userId && userId !== auth.userId) {
        return forbidden('غير مصرح بالوصول لهذه المحادثات');
      }
      const storeId = searchParams.get('storeId') || undefined;
      const conversations = await findConversationsList(userId || auth.userId, storeId);
      return success({ conversations });
    }

    // Default: get messages between two users
    const senderId = searchParams.get('senderId');
    const receiverId = searchParams.get('receiverId');
    if (!senderId || !receiverId) {
      return badRequest('معرف المرسل والمستقبل مطلوبان');
    }
    // IDOR: Authenticated user must be senderId or receiverId
    if (senderId !== auth.userId && receiverId !== auth.userId) {
      return forbidden('غير مصرح بالوصول لهذه الرسائل');
    }
    const limit = parseInt(searchParams.get('limit') || '200', 10);
    const before = searchParams.get('before') || undefined;
    const messages = await findConversationMessages(senderId, receiverId, { limit, before });
    return success({ messages });
  } catch (error: unknown) {
    logger.error('Messages GET error', 'Messages', { error: getErrorMessage(error) });
    return serverError('حدث خطأ أثناء جلب الرسائل');
  }
})

export const POST = withRoute(async (request: NextRequest) => {
  try {
    const auth = await requireAuth(request);
    if (!auth.success) return auth.response;

    const body = await request.json();
    const { action } = body;

    if (action === 'markRead') {
      // IDOR: Authenticated user must be the userId marking as read
      if (body.userId && body.userId !== auth.userId) {
        return forbidden('غير مصرح بتحديث هذه الرسائل');
      }

      const { userId, senderId, receiverId, conversationId } = body;
      if (!userId) {
        return badRequest('معرف المستخدم مطلوب');
      }

      let userA = '';
      let userB = '';
      if (senderId && receiverId) {
        userA = senderId;
        userB = receiverId;
      } else if (conversationId) {
        const parsed = parseConversationId(conversationId);
        if (parsed) {
          userA = parsed.userA;
          userB = parsed.userB;
        }
      }

      if (!userA || !userB) {
        return badRequest('صيغة معرف المحادثة غير صحيحة');
      }

      const messagesMarked = await markAsReadSupabase(userA, userB, userId);
      return success({ success: true, messagesMarked });
    }

    // Default: send message
    // IDOR: Authenticated user must be the senderId
    if (body.senderId && body.senderId !== auth.userId) {
      return forbidden('غير مصرح بإرسال الرسالة باسم مستخدم آخر');
    }

    const { senderId, receiverId, storeId, content } = body;

    // Validate required fields
    const senderRequired = validateRequired(senderId, 'معرف المرسل');
    if (!senderRequired.valid) return badRequest(senderRequired.error!);

    const receiverRequired = validateRequired(receiverId, 'معرف المستقبل');
    if (!receiverRequired.valid) return badRequest(receiverRequired.error!);

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return badRequest('محتوى الرسالة لا يمكن أن يكون فارغاً');
    }

    // Ban check for messaging
    const banCheck = await checkBanAsync(senderId);
    if (banCheck.isBanned && !isActionAllowed(banCheck.banType!, 'message')) {
      return apiError('تم حظر حسابك: ' + (banCheck.reason || ''), 403);
    }

    // Ensure both users exist (skip — Supabase FK constraints handle this)
    // Verify receiver exists
    try {
      await findUserById(receiverId);
    } catch {
      return badRequest('المستقبل غير موجود');
    }

    // Sanitize content
    const sanitizedContent = sanitizeString(content, 5000);

    // Create message
    const message = await createChatMessage({
      sender_id: senderId,
      receiver_id: receiverId,
      store_id: storeId || undefined,
      content: sanitizedContent,
    });

    // Fetch with relations for response
    const sb = getSupabaseAdmin();
    const { data: fullMessage, error } = await sb.from(TABLES.CHAT_MESSAGES)
      .select('*, sender:users!chat_messages_sender_id_fkey(id, full_name, avatar_url), receiver:users!chat_messages_receiver_id_fkey(id, full_name, avatar_url)')
      .eq('id', message.id)
      .single();
    if (error) throw new Error(error.message);

    return created({ message: mapMessage(fullMessage) });
  } catch (error: unknown) {
    logger.error('Messages POST error', 'Messages', { error: getErrorMessage(error) });
    return serverError('حدث خطأ أثناء إرسال الرسالة');
  }
})

export const PUT = withRoute(async (request: NextRequest) => {
  try {
    const auth = await requireAuth(request);
    if (!auth.success) return auth.response;

    const body = await request.json();
    // IDOR: Authenticated user must be the userId marking as read
    if (body.userId && body.userId !== auth.userId) {
      return forbidden('غير مصرح بتحديث هذه الرسائل');
    }

    const { userId, senderId, receiverId, conversationId } = body;
    if (!userId) {
      return badRequest('معرف المستخدم مطلوب');
    }

    let userA = '';
    let userB = '';
    if (senderId && receiverId) {
      userA = senderId;
      userB = receiverId;
    } else if (conversationId) {
      const parsed = parseConversationId(conversationId);
      if (parsed) {
        userA = parsed.userA;
        userB = parsed.userB;
      }
    }

    if (!userA || !userB) {
      return badRequest('صيغة معرف المحادثة غير صحيحة');
    }

    const messagesMarked = await markAsReadSupabase(userA, userB, userId);
    return success({ success: true, messagesMarked });
  } catch (error: unknown) {
    logger.error('Messages PUT error', 'Messages', { error: getErrorMessage(error) });
    return serverError('حدث خطأ أثناء تحديث الرسالة');
  }
})

export const DELETE = withRoute(async (request: NextRequest) => {
  try {
    const auth = await requireAuth(request);
    if (!auth.success) return auth.response;

    const { searchParams } = new URL(request.url);
    const senderId = searchParams.get('senderId');
    const receiverId = searchParams.get('receiverId');
    if (!senderId || !receiverId) {
      return badRequest('معرف المرسل والمستقبل مطلوبان');
    }
    // IDOR: Authenticated user must be senderId or receiverId
    if (senderId !== auth.userId && receiverId !== auth.userId) {
      return forbidden('غير مصرح بحذف هذه المحادثة');
    }

    const deletedCount = await deleteConversationSupabase(senderId, receiverId);
    return success({ success: true, deletedCount });
  } catch (error: unknown) {
    logger.error('Messages DELETE error', 'Messages', { error: getErrorMessage(error) });
    return serverError('حدث خطأ أثناء حذف المحادثة');
  }
})
