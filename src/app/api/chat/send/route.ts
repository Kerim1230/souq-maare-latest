export const runtime = 'nodejs'
import { NextRequest } from 'next/server';
import { getSupabaseAdmin, createChatMessage, createNotification, findUserById, findStoreByUserId, handleResponse, TABLES } from '@/lib/supabase-db';
import { checkRateLimit, LIMITS } from '@/server/lib/rate-limiter';
import { rateLimited, badRequest, apiError, success, created } from '@/lib/api-response';
import { requireAuth } from '@/server/lib/auth-guard';
import { validateId, sanitizeAndValidate } from '@/utils/validation';
import { logger } from '@/lib/logger';
import { withRoute } from '@/server/lib/route-wrapper';

/**
 * POST /api/chat/send
 */
export const POST = withRoute(async (request: NextRequest) => {
  try {
    const auth = await requireAuth(request);
    if (!auth.success) return auth.response;
    const senderId = auth.userId;

    // Per-user rate limiting (20 messages per minute per user)
    const rl = checkRateLimit(`chat:send:${senderId}`, LIMITS.chat);
    if (!rl.success) return rateLimited('طلبات إرسال كثيرة. حاول بعد دقيقة');

    const body = await request.json();
    const { receiverId, storeId, content } = body;

    const receiverIdCheck = validateId(receiverId, 'معرف المستقبل');
    if (!receiverIdCheck.valid) return apiError(receiverIdCheck.error!, 400, { code: 'CHAT_MISSING_PARAMS' });

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return apiError('Message content cannot be empty', 400, { code: 'CHAT_EMPTY_CONTENT' });
    }

    const contentCheck = sanitizeAndValidate(content, 2000, 'محتوى الرسالة');
    if (!contentCheck.valid) {
      return badRequest(contentCheck.error!);
    }

    const sanitizedContent = contentCheck.value!;

    // Verify receiver exists
    try {
      await findUserById(receiverId);
    } catch {
      return apiError('المستخدم المستلم غير موجود', 400, { code: 'CHAT_RECEIVER_NOT_FOUND' });
    }

    // Check store ownership and verification
    // There are two scenarios:
    // 1. Buyer → Store owner: receiver owns the store, check verified + chat_enabled
    // 2. Store owner → Buyer: sender owns the store (replying from StoreMessages)
    const receiverStore = await findStoreByUserId(receiverId);
    const senderStore = await findStoreByUserId(senderId);

    // If storeId is provided, it must belong to either the sender or the receiver
    if (storeId) {
      const storeBelongsToReceiver = receiverStore && receiverStore.id === storeId;
      const storeBelongsToSender = senderStore && senderStore.id === storeId;

      if (!storeBelongsToReceiver && !storeBelongsToSender) {
        return apiError('المتجر المحدد لا ينتمي للمرسل أو للمستلم', 400, { code: 'CHAT_STORE_MISMATCH' });
      }

      // If the store belongs to the receiver (buyer messaging a store),
      // verify the store is verified and chat is enabled
      if (storeBelongsToReceiver && (!receiverStore.is_verified || !receiverStore.chat_enabled)) {
        return apiError('لا يمكن مراسلة متجر غير موثق', 403, { code: 'CHAT_STORE_NOT_VERIFIED' });
      }
    } else {
      // No storeId provided — if receiver is a store owner, still check verification
      if (receiverStore && (!receiverStore.is_verified || !receiverStore.chat_enabled)) {
        return apiError('لا يمكن مراسلة متجر غير موثق', 403, { code: 'CHAT_STORE_NOT_VERIFIED' });
      }
    }

    // Prevent duplicate messages (same content within 60 seconds)
    const sixtySecondsAgo = new Date(Date.now() - 60_000).toISOString();
    const sb = getSupabaseAdmin();
    const existingMessages = handleResponse(
      await sb.from(TABLES.CHAT_MESSAGES)
        .select('*, sender:users!chat_messages_sender_id_fkey(id, full_name, avatar_url), receiver:users!chat_messages_receiver_id_fkey(id, full_name, avatar_url)')
        .eq('sender_id', senderId)
        .eq('receiver_id', receiverId)
        .eq('content', sanitizedContent)
        .gte('created_at', sixtySecondsAgo)
        .limit(1),
      'POST /api/chat/send duplicate check'
    );

    // Handle storeId filter — if provided, also filter by store_id
    // Note: the above query doesn't filter by store_id for the duplicate check
    // We need to check if there's a match with the same storeId
    let duplicateMessage = null;
    if (storeId) {
      duplicateMessage = existingMessages.find((m: any) => m.store_id === storeId) || null;
    } else {
      // No storeId — match messages with null store_id
      duplicateMessage = existingMessages.find((m: any) => m.store_id === null) || null;
    }

    if (duplicateMessage) {
      // Supabase already returns snake_case, no need for camelToSnake
      return success({ message: duplicateMessage });
    }

    // Create the chat message
    const message = await createChatMessage({
      sender_id: senderId,
      receiver_id: receiverId,
      store_id: storeId || null,
      content: sanitizedContent,
    });

    // Fetch with relations for response
    const messageWithRelations = handleResponse(
      await sb.from(TABLES.CHAT_MESSAGES)
        .select('*, sender:users!chat_messages_sender_id_fkey(id, full_name, avatar_url), receiver:users!chat_messages_receiver_id_fkey(id, full_name, avatar_url)')
        .eq('id', message.id)
        .single(),
      'POST /api/chat/send fetch after create'
    );

    // Create notification for the receiver
    try {
      const senderUser = await findUserById(senderId);
      const senderName = senderUser?.full_name || senderUser?.phone || 'مستخدم';
      const preview = sanitizedContent.length > 50 ? sanitizedContent.slice(0, 50) + '...' : sanitizedContent;
      // Use the store that's relevant to this conversation
      const relevantStore = storeId
        ? (senderStore?.id === storeId ? senderStore : receiverStore)
        : receiverStore;
      const storeName = relevantStore?.name || '';

      await createNotification({
        user_id: receiverId,
        title: storeName ? `رسالة جديدة في ${storeName}` : `رسالة جديدة من ${senderName}`,
        body: `${senderName}: ${preview}`,
        type: 'message',
        category: 'chat',
        icon: 'MessageCircle',
        priority: 'high',
        deep_link: storeId ? `/chat?storeId=${storeId}` : `/chat?userId=${senderId}`,
      });
    } catch (notifErr) {
      logger.warn('Failed to create chat notification', 'ChatSend', { error: (notifErr as Error)?.message });
    }

    // Supabase already returns snake_case, no need for camelToSnake
    return created({ message: messageWithRelations });
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to send message', 'ChatSend', { error: (err as Error)?.message });
    return apiError('حدث خطأ أثناء إرسال الرسالة', 500, { code: 'CHAT_SEND_FAILED' });
  }
})
