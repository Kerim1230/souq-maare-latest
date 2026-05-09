import type { ChatMessage } from '@/types';

/**
 * Map raw API message data to ChatMessage format.
 * Used by ChatModal, UserMessages, and StoreMessages.
 *
 * API returns snake_case (sender_id, receiver_id, is_read, created_at, etc.)
 * from Supabase, so we map from snake_case → camelCase here.
 */
export function mapApiMessages(data: any[]): ChatMessage[] {
  return (data || []).map((m: any) => ({
    id: m.id || '',
    senderId: m.sender_id || m.senderId || '',
    receiverId: m.receiver_id || m.receiverId || '',
    storeId: m.store_id || m.storeId || undefined,
    content: m.content || '',
    createdAt: m.created_at || m.createdAt || '',
    timestamp: (m.created_at || m.createdAt) ? new Date(m.created_at || m.createdAt).getTime() : undefined,
    isRead: m.is_read ?? m.isRead ?? true,
    senderName: m.sender?.full_name || m.sender?.fullName,
    senderAvatar: m.sender?.avatar_url || m.sender?.avatarUrl,
  }));
}
