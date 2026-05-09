export const runtime = 'nodejs'
import { NextRequest } from 'next/server';
import { getSupabaseAdmin, handleResponse, TABLES } from '@/lib/supabase-db';
import { requireAuth } from '@/server/lib/auth-guard';
import { badRequest, success, serverError } from '@/lib/api-response';
import { logger } from '@/lib/logger';
import { withRoute } from '@/server/lib/route-wrapper';

/**
 * GET /api/chat/messages?receiverId=xxx
 */
export const GET = withRoute(async (request: NextRequest) => {
  try {
    const auth = await requireAuth(request);
    if (!auth.success) return auth.response;
    const senderId = auth.userId;

    const { searchParams } = new URL(request.url);
    const receiverId = searchParams.get('receiverId');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);
    const before = searchParams.get('before');

    if (!receiverId) return badRequest('receiverId is required');

    const sb = getSupabaseAdmin();

    // Fetch messages between senderId and receiverId in both directions
    let query = sb.from(TABLES.CHAT_MESSAGES)
      .select('*, sender:users!chat_messages_sender_id_fkey(id, full_name, avatar_url), receiver:users!chat_messages_receiver_id_fkey(id, full_name, avatar_url)')
      .or(`and(sender_id.eq.${senderId},receiver_id.eq.${receiverId}),and(sender_id.eq.${receiverId},receiver_id.eq.${senderId})`);

    if (before) {
      query = query.lt('created_at', before);
    }

    query = query.order('created_at', { ascending: true }).limit(limit);

    const messages = handleResponse(await query, 'GET /api/chat/messages');

    return success({ messages });
  } catch (error) {
    logger.error('Failed to fetch messages', 'ChatMessages', { error: (error as Error)?.message });
    return serverError('Failed to load messages');
  }
})
