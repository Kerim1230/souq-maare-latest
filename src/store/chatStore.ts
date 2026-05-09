import { create } from 'zustand';
import type { ChatConversation, ChatMessage, QuickReply } from '@/types';
import { apiGet, apiPost, apiDelete } from '@/lib/fetchApi';
import { isHydrated, markHydrated } from '@/lib/hydration';

export type { ChatMessage };

// ===== Built-in quick replies (static, never persisted) =====
export const QUICK_REPLIES: QuickReply[] = [
  { id: 'qr_1', text: 'مرحباً، كيف يمكنني مساعدتك؟' },
  { id: 'qr_2', text: 'شكراً لتواصلك معنا!' },
  { id: 'qr_3', text: 'سأرجع إليك قريباً' },
  { id: 'qr_4', text: 'نعم، المنتج متوفر' },
  { id: 'qr_5', text: 'تم شكراً لطلبك 🎉' },
  { id: 'qr_6', text: 'يرجى الانتظار قليلاً' },
];

const CONV_SEP = '::';

// Stable empty array for Zustand selectors — prevents new `[]` references on every store update
export const EMPTY_MESSAGES: ChatMessage[] = [];

// ===== Generate a deterministic conversation key using :: separator =====
export function generateConversationId(userA: string, userB: string): string {
  return [userA, userB].sort().join(CONV_SEP);
}

// ===== Parse conversation ID back to user IDs =====
export function parseConversationId(convId: string): [string, string] | null {
  if (!convId) return null;
  const idx = convId.indexOf(CONV_SEP);
  if (idx <= 0) return null;
  return [convId.substring(0, idx), convId.substring(idx + CONV_SEP.length)];
}

// ===== Check if userId is part of a conversationId =====
export function isUserInConversation(conversationId: string, userId: string): boolean {
  if (!conversationId || !userId) return false;
  return conversationId.includes(userId + CONV_SEP) || conversationId.endsWith(CONV_SEP + userId);
}

// ===== Safe time formatting =====
// Chat-specific time formatting — differs from timeAgo() in date-utils by showing a formatted date for older messages (> 7 days)
export function safeTimeAgo(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  try {
    const now = Date.now();
    const then = new Date(dateStr).getTime();
    const diff = Math.floor((now - then) / 1000);
    if (diff < 60) return 'الآن';
    if (diff < 3600) return `منذ ${Math.floor(diff / 60)} دقيقة`;
    if (diff < 86400) return `منذ ${Math.floor(diff / 3600)} ساعة`;
    if (diff < 604800) return `منذ ${Math.floor(diff / 86400)} يوم`;
    return new Date(dateStr).toLocaleDateString('ar-SY', { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

export function safeMessageTime(msg: { createdAt?: string; timestamp?: number }): string {
  try {
    const dateVal = msg.createdAt || (msg.timestamp ? new Date(msg.timestamp).toISOString() : null);
    if (!dateVal) return '';
    return new Date(dateVal).toLocaleTimeString('ar-SY', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

// ===== Store =====
interface ChatState {
  conversations: ChatConversation[];
  archivedIds: Set<string>;
  starredIds: Set<string>;
  customQuickReplies: QuickReply[];
  messageCache: Map<string, ChatMessage[]>;
  loading: boolean;
  error: string | null;

  // Init
  initialize: () => Promise<void>;

  // Conversations
  upsertConversation: (_conv: Partial<ChatConversation> & { id: string; otherUserId: string; storeId: string }) => Promise<void>;
  deleteConversation: (_conversationId: string) => Promise<void>;

  // Message cache (in-memory only — no persistence)
  addMessageToCache: (_conversationId: string, _message: ChatMessage) => void;

  // Computed queries
  getConversationsForStore: (_storeId: string) => ChatConversation[];
  getConversationsForUser: (_userId: string) => ChatConversation[];
  incrementUnread: (_conversationId: string) => void;
  clearUnread: (_conversationId: string) => void;

  // Archive (local UI state only)
  archiveConversation: (_conversationId: string) => void;
  unarchiveConversation: (_conversationId: string) => void;
  isArchived: (_conversationId: string) => boolean;

  // Star (local UI state only)
  starConversation: (_conversationId: string) => void;
  unstarConversation: (_conversationId: string) => void;
  isStarred: (_conversationId: string) => boolean;

}

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: [],
  archivedIds: new Set<string>(),
  starredIds: new Set<string>(),
  customQuickReplies: [],
  messageCache: new Map<string, ChatMessage[]>(),
  loading: false,
  error: null,

  initialize: async () => {
    if (typeof window === 'undefined') return;

    // Hydration guard: skip if already loaded this session
    if (isHydrated('chat')) {
      return;
    }

    set({ loading: true, error: null });
    try {
      const { data, error: apiError } = await apiGet<{ conversations: Record<string, unknown>[] }>('/api/chat/conversations');
      if (apiError) throw new Error('فشل في تحميل المحادثات');
      const conversations: ChatConversation[] = (data?.conversations || []).map((c: Record<string, unknown>) => ({
        id: c.id as string,
        otherUserId: (c.otherUserId as string) || '',
        otherUserName: (c.otherUserName as string) || 'مستخدم',
        otherUserAvatar: (c.otherUserAvatar as string | null) || null,
        storeId: (c.storeId as string) || '',
        storeName: (c.storeName as string) || '',
        lastMessage: (c.lastMessage as string) || '',
        lastMessageTime: (c.lastMessageTime as string) || new Date().toISOString(),
        lastMessageSenderId: (c.lastMessageSenderId as string) || '',
        unreadCount: (c.unreadCount as number) || 0,
        isArchived: false,
        isStarred: false,
        updatedAt: (c.lastMessageTime as string) || new Date().toISOString(),
      }));
      set({ conversations, loading: false });
      markHydrated('chat');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'فشل في تحميل المحادثات';
      set({ error: message, loading: false });
    }
  },

  upsertConversation: async (conv) => {
    // Optimistic local update first
    const conversations = get().conversations;
    const existingIdx = conversations.findIndex(c => c.id === conv.id);
    let updated: ChatConversation[];

    if (existingIdx >= 0) {
      updated = [...conversations];
      updated[existingIdx] = {
        ...updated[existingIdx],
        otherUserName: conv.otherUserName || updated[existingIdx].otherUserName,
        otherUserAvatar: conv.otherUserAvatar !== undefined ? conv.otherUserAvatar : updated[existingIdx].otherUserAvatar,
        storeName: conv.storeName || updated[existingIdx].storeName,
        lastMessage: conv.lastMessage || updated[existingIdx].lastMessage,
        lastMessageTime: conv.lastMessageTime || updated[existingIdx].lastMessageTime,
        lastMessageSenderId: conv.lastMessageSenderId || updated[existingIdx].lastMessageSenderId,
        updatedAt: new Date().toISOString(),
      };
    } else {
      const newConv: ChatConversation = {
        id: conv.id,
        otherUserId: conv.otherUserId,
        otherUserName: conv.otherUserName || 'مستخدم',
        otherUserAvatar: conv.otherUserAvatar || null,
        storeId: conv.storeId,
        storeName: conv.storeName || '',
        lastMessage: conv.lastMessage || '',
        lastMessageTime: conv.lastMessageTime || new Date().toISOString(),
        lastMessageSenderId: conv.lastMessageSenderId || '',
        unreadCount: 0,
        isArchived: false,
        isStarred: false,
        updatedAt: new Date().toISOString(),
      };
      updated = [newConv, ...conversations];
    }

    // Move updated/new conversation to top
    if (existingIdx >= 0) {
      const [moved] = updated.splice(existingIdx, 1);
      updated.unshift(moved);
    }

    set({ conversations: updated });

    // ✅ FIX BUG-C4: Removed fetchConversations API call.
    // Previously, every upsertConversation (called by useChatSocket on every realtime message)
    // triggered a fetchConversations API call. Under 50 concurrent users, this created
    // a storm of redundant API calls. The optimistic local state is sufficient for UI;
    // conversations are refreshed on screen navigation via fetchConversations.
  },

  deleteConversation: async (conversationId) => {
    // Optimistic local removal
    set({
      conversations: get().conversations.filter(c => c.id !== conversationId),
    });

    try {
      const parsed = parseConversationId(conversationId);
      const params = new URLSearchParams({ conversationId });
      if (parsed) {
        params.set('senderId', parsed[0]);
        params.set('receiverId', parsed[1]);
      }
      const { error: apiError } = await apiDelete(`/api/chat/conversations?${params.toString()}`);
      if (apiError) throw new Error('فشل في حذف المحادثة');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'فشل في حذف المحادثة';
      set({ error: message });
    }
  },

  getConversationsForStore: (storeId) => {
    return get().conversations
      .filter(c => c.storeId === storeId && !get().archivedIds.has(c.id))
      .sort((a, b) => {
        try { return new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime(); } catch { return 0; }
      });
  },

  getConversationsForUser: (userId) => {
    return get().conversations
      .filter(c => {
        if (get().archivedIds.has(c.id)) return false;
        return isUserInConversation(c.id, userId);
      })
      .sort((a, b) => {
        try { return new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime(); } catch { return 0; }
      });
  },

  incrementUnread: (conversationId) => {
    const updated = get().conversations.map(c =>
      c.id === conversationId ? { ...c, unreadCount: (c.unreadCount || 0) + 1 } : c
    );
    set({ conversations: updated });
  },

  clearUnread: (conversationId) => {
    const updated = get().conversations.map(c =>
      c.id === conversationId ? { ...c, unreadCount: 0 } : c
    );
    set({ conversations: updated });

    // Fire-and-forget: mark messages as read on the server
    const parsed = parseConversationId(conversationId);
    if (parsed) {
      apiPost('/api/chat/mark-read', { senderId: parsed[0], receiverId: parsed[1] })
        .catch(() => {
          // silently ignore — local state is already updated
        });
    }
  },

  // ===== Message cache (in-memory only — no persistence) =====
  addMessageToCache: (conversationId, message) => {
    const cache = new Map(get().messageCache);
    const existing = cache.get(conversationId) || [];
    // Avoid duplicates by id
    if (!existing.some(m => m.id === message.id)) {
      cache.set(conversationId, [...existing, message]);
    }
    // Cap messages per conversation to 200
    if (cache.get(conversationId)!.length > 200) {
      cache.set(conversationId, cache.get(conversationId)!.slice(-200));
    }
    // LRU: Remove oldest conversation cache if over 50
    if (cache.size > 50) {
      const oldestKey = cache.keys().next().value as string | undefined;
      if (oldestKey) cache.delete(oldestKey);
    }
    set({ messageCache: cache });
  },

  // ===== Archive (local UI state only — no persistence) =====
  archiveConversation: (conversationId) => {
    const archived = new Set(get().archivedIds);
    archived.add(conversationId);
    set({ archivedIds: archived });
  },

  unarchiveConversation: (conversationId) => {
    const archived = new Set(get().archivedIds);
    archived.delete(conversationId);
    set({ archivedIds: archived });
  },

  isArchived: (conversationId) => get().archivedIds.has(conversationId),

  // ===== Star (local UI state only — no persistence) =====
  starConversation: (conversationId) => {
    const starred = new Set(get().starredIds);
    starred.add(conversationId);
    set({ starredIds: starred });
  },

  unstarConversation: (conversationId) => {
    const starred = new Set(get().starredIds);
    starred.delete(conversationId);
    set({ starredIds: starred });
  },

  isStarred: (conversationId) => get().starredIds.has(conversationId),

}));
