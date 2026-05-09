'use client';
import React, { useState, useEffect, useRef, useCallback, useMemo, Component, ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRight, Send, X, Search, Archive, Trash2, Star,
  StarOff, MoreVertical, CheckCheck,
  Reply, Loader2, MessageSquare, UserCircle, AlertTriangle, RefreshCw,
  MessageCircle
} from 'lucide-react';
import {
  useChatStore, type ChatMessage,
  generateConversationId, safeTimeAgo, safeMessageTime,
  QUICK_REPLIES, EMPTY_MESSAGES
} from '@/store/chatStore';
import type { ChatConversation } from '@/types';
import { useAuthStore } from '@/store/authStore';
import { useAppStore } from '@/store/appStore';
import { mapApiMessages } from '@/lib/chat-utils';
import toast from 'react-hot-toast';
import { apiGet, apiPost, apiDelete } from '@/lib/fetchApi';
import { optimizeImage } from '@/lib/image-optimize';

// ===== Error Boundary =====
class StoreMessagesErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="h-full flex flex-col items-center justify-center p-6 bg-[var(--color-bg)]">
          <div className="w-16 h-16 bg-rose-50 dark:bg-rose-900/20 rounded-2xl flex items-center justify-center mb-4">
            <AlertTriangle className="w-8 h-8 text-rose-400" />
          </div>
          <p className="text-sm font-bold text-[var(--color-text)] mb-1">حدث خطأ</p>
          <p className="text-xs text-[var(--color-text-tertiary)] mb-4">يرجى المحاولة مرة أخرى</p>
          <button onClick={() => this.setState({ hasError: false })} className="flex items-center gap-2 px-5 py-2.5 gradient-primary text-white text-sm font-bold rounded-xl shadow-md">
            <RefreshCw className="w-4 h-4" />
            إعادة المحاولة
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ===== Conversation Item =====
const ConversationItem: React.FC<{
  conversation: ChatConversation;
  onClick: () => void;
  onArchive: () => void;
  onDelete: () => void;
  onStar: () => void;
}> = ({ conversation, onClick, onArchive, onDelete, onStar }) => {
  const [showMenu, setShowMenu] = useState(false);
  const isStarred = useChatStore((s) => s.starredIds.has(conversation.id));
  const avatarUrl = typeof conversation.otherUserAvatar === 'string' && conversation.otherUserAvatar ? conversation.otherUserAvatar : null;

  return (
    <motion.div layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: 60 }} className="relative">
      <div
        onClick={onClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
        className="w-full text-right flex items-center gap-3 p-3 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)]/60 hover:border-emerald-200 dark:hover:border-emerald-800/60 hover:shadow-sm transition-all active:scale-[0.98] duration-150 cursor-pointer"
      >
        {/* Avatar */}
        <div className="relative flex-shrink-0">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-50 dark:from-emerald-900/20 to-teal-50 dark:to-teal-900/20 border border-emerald-100 dark:border-emerald-800/50 flex items-center justify-center overflow-hidden">
            {avatarUrl ? (
              <img src={optimizeImage(avatarUrl)} alt="" className="w-full h-full object-cover" />
            ) : (
              <UserCircle className="w-7 h-7 text-emerald-400 dark:text-emerald-500" />
            )}
          </div>
          {isStarred && (
            <div className="absolute -top-1 -right-1 w-4 h-4 bg-amber-400 rounded-full flex items-center justify-center shadow-sm">
              <Star className="w-2.5 h-2.5 text-white fill-white" />
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-0.5">
            <span className="text-[13px] font-bold text-[var(--color-text)] truncate flex-1 min-w-0">{conversation.otherUserName || 'مستخدم'}</span>
            <span className="text-[10px] text-[var(--color-text-tertiary)] font-medium flex-shrink-0 mr-2">{safeTimeAgo(conversation.lastMessageTime)}</span>
          </div>
          <p className="text-[12px] text-[var(--color-text-secondary)] truncate leading-relaxed">
            {conversation.lastMessage || 'لا توجد رسائل'}
          </p>
        </div>

        {/* Unread Badge */}
        {(conversation.unreadCount || 0) > 0 && (
          <div className="flex-shrink-0 min-w-[20px] h-5 bg-rose-500 rounded-full flex items-center justify-center px-1 shadow-sm">
            <span className="text-[9px] font-black text-white">{conversation.unreadCount > 99 ? '99+' : conversation.unreadCount}</span>
          </div>
        )}

        {/* Actions Menu Button */}
        <button
          onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--color-text-tertiary)] hover:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all flex-shrink-0"
        >
          <MoreVertical className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Context Menu */}
      <AnimatePresence>
        {showMenu && (
          <>
            <div className="fixed inset-0 z-10" onClick={(e) => { e.stopPropagation(); setShowMenu(false); }} />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: -4 }}
              className="absolute left-3 top-12 z-20 bg-[var(--color-surface)] rounded-xl shadow-xl border border-[var(--color-border)] py-1 min-w-[150px] overflow-hidden"
            >
              <button onClick={(e) => { e.stopPropagation(); onStar(); setShowMenu(false); }} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[11px] font-bold text-[var(--color-text-secondary)] hover:bg-amber-50 dark:hover:bg-amber-900/20 hover:text-amber-600 transition-colors">
                {isStarred ? <StarOff className="w-3.5 h-3.5" /> : <Star className="w-3.5 h-3.5" />}
                {isStarred ? 'إزالة التمييز' : 'تمييز مهم'}
              </button>
              <button onClick={(e) => { e.stopPropagation(); onArchive(); setShowMenu(false); }} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[11px] font-bold text-[var(--color-text-secondary)] hover:bg-emerald-50 dark:hover:bg-emerald-900/20 hover:text-emerald-600 transition-colors">
                <Archive className="w-3.5 h-3.5" />
                أرشفة
              </button>
              <button onClick={(e) => { e.stopPropagation(); onDelete(); setShowMenu(false); }} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[11px] font-bold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors">
                <Trash2 className="w-3.5 h-3.5" />
                حذف المحادثة
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// ===== Chat View (Full conversation for store owner) =====
const ChatView: React.FC<{
  conversation: ChatConversation;
  storeOwnerId: string;
  storeName: string;
  storeLogoUrl?: string;
  storeId: string;
  onBack: () => void;
}> = ({ conversation, storeOwnerId, storeName, storeLogoUrl, storeId, onBack }) => {
  // storeLogoUrl reserved for future store branding in chat header
  void storeLogoUrl;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loadingMsgs, setLoadingMsgs] = useState(true);
  const [sending, setSending] = useState(false);
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastMsgIdRef = useRef<string>('');
    // ⚡ Stable: subscribe to raw ref, merge outside selector
  const customQuickReplies = useChatStore(s => s.customQuickReplies);
  const quickReplies = useMemo(() => [...QUICK_REPLIES, ...customQuickReplies], [customQuickReplies]);

  const otherUserId = conversation.otherUserId || '';
  const otherName = conversation.otherUserName || 'مستخدم';
  const avatarUrl = typeof conversation.otherUserAvatar === 'string' && conversation.otherUserAvatar ? conversation.otherUserAvatar : null;

  const scrollToBottom = useCallback(() => {
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  }, []);

  // Fetch messages
  const fetchMessages = useCallback(async (showLoader = false) => {
    if (!otherUserId || !storeOwnerId) return;
    try {
      if (showLoader) setLoadingMsgs(true);
      const { data } = await apiGet(`/api/chat/messages?senderId=${storeOwnerId}&receiverId=${otherUserId}`);
      if (!data) return;
      const msgs = mapApiMessages(data.messages);
      setMessages(msgs);
      if (msgs.length > 0) lastMsgIdRef.current = msgs[msgs.length - 1].id;
      scrollToBottom();

      // Mark as read
      try {
        const convId = generateConversationId(storeOwnerId, otherUserId);
        await apiPost('/api/chat/mark-read', { conversationId: convId, userId: storeOwnerId });
      } catch { /* mark-read is non-critical */ }
    } catch {
      // silent
    } finally {
      setLoadingMsgs(false);
    }
  }, [storeOwnerId, otherUserId, scrollToBottom]);

  // Subscribe to messageCache for this conversation
  const convId = generateConversationId(storeOwnerId, otherUserId);
  const cachedMessages = useChatStore(
    useCallback(s => s.messageCache.get(convId) ?? EMPTY_MESSAGES, [convId])
  );

  useEffect(() => {
    if (!otherUserId || !storeOwnerId) return;
    fetchMessages(true);
    useChatStore.getState().clearUnread(convId);
  }, [storeOwnerId, otherUserId, convId, fetchMessages]);

  // Sync cached realtime messages into local state
  useEffect(() => {
    if (cachedMessages.length === 0) return;
    setMessages(prev => {
      const localIds = new Set(prev.map(m => m.id));
      const newMsgs = cachedMessages.filter(m => !localIds.has(m.id));
      if (newMsgs.length === 0) return prev; // no change — returns same reference, no re-render
      lastMsgIdRef.current = newMsgs[newMsgs.length - 1].id;
      scrollToBottom();
      // Mark as read for incoming messages
      const incoming = newMsgs.filter(m => m.senderId !== storeOwnerId);
      if (incoming.length > 0) {
        apiPost('/api/chat/mark-read', { conversationId: convId, userId: storeOwnerId }).catch(() => {});
      }
      return [...prev, ...newMsgs];
    });
  }, [cachedMessages, storeOwnerId, convId, scrollToBottom]);

  // Auto-focus input
  useEffect(() => {
    if (!loadingMsgs) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [loadingMsgs]);

  const handleSend = useCallback(async (text?: string) => {
    if (!otherUserId || !storeOwnerId) return;
    const content = text || newMessage;
    if (!content.trim() || sending) return;

    setSending(true);
    try {
      const { data, error: sendError } = await apiPost('/api/chat/send', {
        senderId: storeOwnerId,
        receiverId: otherUserId,
        storeId,
        content: content.trim(),
      });

      if (sendError) {
        toast.error(sendError);
        return;
      }

      const msg: ChatMessage = {
        id: data.message?.id || Date.now().toString(),
        senderId: storeOwnerId,
        receiverId: otherUserId,
        storeId: storeId || undefined,
        content: content.trim(),
        createdAt: data.message?.created_at || data.message?.createdAt || new Date().toISOString(),
        timestamp: Date.now(),
        senderName: data.message?.sender?.full_name || data.message?.sender?.fullName,
        senderAvatar: data.message?.sender?.avatar_url || data.message?.sender?.avatarUrl,
      };

      setMessages(prev => [...prev, msg]);
      lastMsgIdRef.current = msg.id;
      scrollToBottom();

      // Update conversation in store
      const convId = generateConversationId(storeOwnerId, otherUserId);
      useChatStore.getState().upsertConversation({
        id: convId,
        otherUserId,
        otherUserName: otherName,
        otherUserAvatar: avatarUrl,
        storeId,
        storeName,
        lastMessage: content.trim(),
        lastMessageTime: new Date().toISOString(),
        lastMessageSenderId: storeOwnerId,
      });

      if (!text) setNewMessage('');
      inputRef.current?.focus();
      setShowQuickReplies(false);
    } catch (err) {
      const isNetworkError = (err as Error).message?.includes('Failed to fetch') || (err as Error).name === 'TypeError';
      toast.error(isNetworkError ? 'لا يوجد اتصال بالإنترنت' : 'فشل إرسال الرسالة');
    } finally {
      setSending(false);
    }
  }, [newMessage, sending, otherUserId, storeOwnerId, storeId, storeName, otherName, avatarUrl, scrollToBottom]);

  // Group messages by date
  const groupedMessages = messages.reduce((groups: { date: string; messages: ChatMessage[] }[], msg) => {
    if (!msg.createdAt) return groups;
    const date = new Date(msg.createdAt).toLocaleDateString('ar-SY', { year: 'numeric', month: 'long', day: 'numeric' });
    const lastGroup = groups[groups.length - 1];
    if (lastGroup && lastGroup.date === date) {
      lastGroup.messages.push(msg);
    } else {
      groups.push({ date, messages: [msg] });
    }
    return groups;
  }, []);

  return (
    <div className="flex flex-col h-full bg-[var(--color-bg)]">
      {/* Chat Header */}
      <div className="gradient-dark px-4 py-3 flex items-center gap-3 flex-shrink-0 shadow-lg">
        <button onClick={onBack} className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/10 text-white hover:bg-white/20 transition-colors">
          <ArrowRight className="w-5 h-5" />
        </button>
        <div className="relative flex-shrink-0">
          <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center overflow-hidden border-2 border-white/20">
            {avatarUrl ? (
              <img src={optimizeImage(avatarUrl)} alt="" className="w-full h-full object-cover" />
            ) : (
              <UserCircle className="w-6 h-6 text-teal-300" />
            )}
          </div>
          <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-400 rounded-full border-2 border-[#022c22]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white text-sm font-bold truncate">{otherName}</p>
          <p className="text-teal-300/70 text-[11px]">عميل في {storeName}</p>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {/* Conversation header */}
        <div className="flex flex-col items-center py-3">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-100 to-teal-100 dark:from-emerald-900/30 dark:to-teal-900/30 flex items-center justify-center overflow-hidden border-2 border-emerald-200 dark:border-emerald-700/50 mb-2 shadow-sm">
            {avatarUrl ? (
              <img src={optimizeImage(avatarUrl)} alt="" className="w-full h-full object-cover" />
            ) : (
              <UserCircle className="w-8 h-8 text-emerald-400" />
            )}
          </div>
          <p className="text-[13px] font-bold text-[var(--color-text)]">{otherName}</p>
          <div className="flex items-center gap-1.5 mt-1">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span className="text-[10px] text-emerald-500 font-medium">متصل</span>
          </div>
        </div>

        {loadingMsgs && messages.length === 0 ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="w-6 h-6 text-emerald-500 animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-center">
            <div className="w-14 h-14 bg-emerald-50/60 dark:bg-emerald-900/20 rounded-2xl flex items-center justify-center mb-3">
              <MessageSquare className="w-7 h-7 text-emerald-300 dark:text-emerald-600" />
            </div>
            <p className="text-sm font-bold text-[var(--color-text)]">ابدأ المحادثة</p>
            <p className="text-xs text-[var(--color-text-tertiary)] mt-1">أرسل رسالتك الأولى لهذا العميل</p>
          </div>
        ) : (
          groupedMessages.map((group) => (
            <div key={group.date}>
              {/* Date Separator */}
              <div className="flex items-center gap-3 my-2">
                <div className="flex-1 h-px bg-slate-100 dark:bg-slate-800" />
                <span className="text-[10px] text-[var(--color-text-tertiary)] font-medium px-2 bg-[var(--color-bg)]">{group.date}</span>
                <div className="flex-1 h-px bg-slate-100 dark:bg-slate-800" />
              </div>
              {group.messages.map((msg, i) => {
                const isMe = msg.senderId === storeOwnerId;
                const showAvatar = !isMe && (i === 0 || group.messages[i - 1]?.senderId === storeOwnerId);
                return (
                  <div key={msg.id || i} className={`flex ${isMe ? 'justify-end' : 'justify-start'} ${!isMe && !showAvatar ? 'mt-1' : 'mt-3'}`}>
                    {!isMe && (
                      <div className="flex items-end gap-2">
                        {showAvatar ? (
                          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-100 to-teal-100 dark:from-emerald-800 dark:to-teal-800 flex items-center justify-center overflow-hidden flex-shrink-0 mb-1">
                            {avatarUrl ? <img src={optimizeImage(avatarUrl)} alt="" className="w-full h-full object-cover" /> : <UserCircle className="w-4 h-4 text-emerald-400" />}
                          </div>
                        ) : <div className="w-7 flex-shrink-0" />}
                      </div>
                    )}
                    <div className={`max-w-[78%] px-3.5 py-2.5 ${
                      isMe
                        ? 'gradient-primary text-white rounded-2xl rounded-bl-md'
                        : 'bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)] rounded-2xl rounded-br-md shadow-sm'
                    }`}>
                      <p className="text-[13px] leading-relaxed whitespace-pre-wrap break-words">{msg.content}</p>
                      <p className={`text-[10px] mt-1 flex items-center gap-1 justify-end ${isMe ? 'text-white/50' : 'text-slate-400 dark:text-slate-500'}`}>
                        {safeMessageTime(msg)}
                        {isMe && <CheckCheck className="w-3 h-3" />}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Replies Panel */}
      <AnimatePresence>
        {showQuickReplies && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-[var(--color-border)] bg-[var(--color-surface)]"
          >
            <div className="p-2 flex gap-1.5 overflow-x-auto scrollbar-hide">
              {quickReplies.map((reply) => (
                <button key={reply.id} onClick={() => handleSend(reply.text)} className="flex-shrink-0 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800/50 rounded-xl text-[11px] font-bold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-colors whitespace-nowrap">
                  {reply.text.length > 28 ? reply.text.slice(0, 28) + '...' : reply.text}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input */}
      <div className="p-3 bg-[var(--color-surface)] border-t border-[var(--color-border)] flex gap-2 flex-shrink-0">
        <button
          onClick={() => setShowQuickReplies(!showQuickReplies)}
          className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors flex-shrink-0 ${
            showQuickReplies
              ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600'
              : 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/30'
          }`}
        >
          <Reply className="w-4 h-4" />
        </button>
        <input
          ref={inputRef}
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
          placeholder="اكتب رسالتك..."
          disabled={sending}
          className="flex-1 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl px-4 py-2.5 text-sm text-[var(--color-text)] placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 disabled:opacity-50 transition-all"
        />
        <button
          onClick={() => handleSend()}
          disabled={sending || !newMessage.trim()}
          className="w-10 h-10 gradient-primary rounded-xl flex items-center justify-center text-white shadow-md shadow-emerald-500/20 disabled:opacity-50 hover:shadow-lg transition-all active:scale-95"
        >
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
};

// ===== Main Store Messages Component =====
export const StoreMessages: React.FC = () => {
  const user = useAuthStore(s => s.user);
  const myStore = useAppStore(s => s.myStore);
  const myStoreId = useAppStore(s => s.myStore?.id);
  const myStoreName = useAppStore(s => s.myStore?.name);
  const setSubScreen = useAppStore(s => s.setSubScreen);
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeConv, setActiveConv] = useState<ChatConversation | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'starred' | 'archived'>('all');
  const [loading, setLoading] = useState(true);
  const [totalUnread, setTotalUnread] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => { useChatStore.getState().initialize(); }, []);

  const parseConversation = useCallback((c: any): ChatConversation => ({
    id: c.id || '',
    otherUserId: c.otherUserId || '',
    otherUserName: c.otherUserName || 'مستخدم',
    otherUserAvatar: c.otherUserAvatar || null,
    storeId: c.storeId || '',
    storeName: c.storeName || c.store?.name || myStoreName || '',
    lastMessage: c.lastMessage || '',
    lastMessageTime: c.lastMessageTime || new Date().toISOString(),
    lastMessageSenderId: c.lastMessageSenderId || '',
    unreadCount: typeof c.unreadCount === 'number' ? c.unreadCount : 0,
    isArchived: useChatStore.getState().isArchived(c.id),
    isStarred: useChatStore.getState().isStarred(c.id),
    updatedAt: c.updatedAt || new Date().toISOString(),
  }), [myStoreName]);

  // Use ref for myStore object to avoid effect restarts on reference changes
  const myStoreRef = useRef(myStore);
  myStoreRef.current = myStore;

  const loadConversations = useCallback(async () => {
    const store = myStoreRef.current;
    if (!user || !store) return;
    setLoading(true);
    try {
      const { data, error: convErr } = await apiGet(`/api/chat/conversations?userId=${user.id}&storeId=${store.id}`);
      if (!convErr) {
        const convs: ChatConversation[] = (data?.conversations || []).map(parseConversation);

        // Merge with local conversations
        const localConvs = useChatStore.getState().getConversationsForStore(store.id);
        const mergedMap = new Map<string, ChatConversation>();
        convs.forEach(c => mergedMap.set(c.id, c));
        localConvs.forEach(lc => {
          if (!mergedMap.has(lc.id)) {
            mergedMap.set(lc.id, lc);
          } else {
            const existing = mergedMap.get(lc.id)!;
            try {
              const existingTime = new Date(existing.lastMessageTime).getTime() || 0;
              const localTime = new Date(lc.lastMessageTime).getTime() || 0;
              if (localTime > existingTime) mergedMap.set(lc.id, lc);
            } catch { /* date parse fallback — keep existing entry */ }
          }
        });

        const merged = Array.from(mergedMap.values())
          .sort((a, b) => {
            try { return (new Date(b.lastMessageTime).getTime() || 0) - (new Date(a.lastMessageTime).getTime() || 0); } catch { return 0; }
          });

        setConversations(merged);
        setTotalUnread(merged.reduce((sum, c) => sum + (c.unreadCount || 0), 0));
      }
    } catch {
      try {
        const localConvs = useChatStore.getState().getConversationsForStore(store.id);
        setConversations(localConvs);
        setTotalUnread(localConvs.reduce((sum, c) => sum + (c.unreadCount || 0), 0));
      } catch { /* local fallback failed — still show empty state */ }
    } finally {
      setLoading(false);
    }
  }, [user, myStoreId, parseConversation]);

  useEffect(() => {
    loadConversations();
    pollRef.current = setInterval(loadConversations, 30000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [loadConversations]);

  // Filter conversations
  const filteredConversations = (() => {
    let convs = conversations;
    switch (activeTab) {
      case 'starred': convs = convs.filter(c => useChatStore.getState().isStarred(c.id)); break;
      case 'archived': convs = convs.filter(c => useChatStore.getState().isArchived(c.id)); break;
      default: convs = convs.filter(c => !useChatStore.getState().isArchived(c.id));
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      convs = convs.filter(c => (c.otherUserName || '').toLowerCase().includes(q) || (c.lastMessage || '').toLowerCase().includes(q));
    }
    return convs;
  })();

  const handleArchive = (convId: string) => {
    useChatStore.getState().archiveConversation(convId);
    setConversations(prev => prev.map(c => c.id === convId ? { ...c, isArchived: true } : c));
    toast.success('تمت أرشفة المحادثة');
  };

  const handleUnarchive = (convId: string) => {
    useChatStore.getState().unarchiveConversation(convId);
    setConversations(prev => prev.map(c => c.id === convId ? { ...c, isArchived: false } : c));
    toast.success('تمت إزالة الأرشفة');
  };

  const handleDelete = async (convId: string) => {
    if (!window.confirm('هل أنت متأكد من حذف هذه المحادثة؟')) return;
    const conv = conversations.find(c => c.id === convId);
    if (!conv || !user) return;
    try {
      await apiDelete(`/api/chat/conversations?conversationId=${convId}`);
    } catch { /* delete API failed — remove locally anyway */ }
    useChatStore.getState().deleteConversation(convId);
    setConversations(prev => prev.filter(c => c.id !== convId));
    toast.success('تم حذف المحادثة');
  };

  const handleStar = (convId: string) => {
    if (useChatStore.getState().isStarred(convId)) {
      useChatStore.getState().unstarConversation(convId);
      toast.success('تمت إزالة التمييز');
    } else {
      useChatStore.getState().starConversation(convId);
      toast.success('تم تمييز المحادثة');
    }
    setConversations(prev => [...prev]);
  };

  // Show chat view when conversation is selected
  if (activeConv && myStore && user) {
    return (
      <ChatView
        conversation={activeConv}
        storeOwnerId={user.id}
        storeName={myStore.name}
        storeLogoUrl={myStore.logo_url || undefined}
        storeId={myStore.id}
        onBack={() => { setActiveConv(null); loadConversations(); }}
      />
    );
  }

  const activeConvs = conversations.filter(c => !useChatStore.getState().isArchived(c.id)).length;
  const starredConvs = conversations.filter(c => useChatStore.getState().isStarred(c.id)).length;
  const archivedConvs = conversations.filter(c => useChatStore.getState().isArchived(c.id)).length;

  return (
    <div className="h-full flex flex-col bg-[var(--color-bg)]">
      {/* Header */}
      <div className="gradient-dark px-5 pt-8 pb-16 relative overflow-hidden flex-shrink-0">
        <div className="absolute top-[-40px] right-[-30px] w-[180px] h-[180px] rounded-full bg-teal-600/15 blur-[60px]" />
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => setSubScreen('none')} className="w-10 h-10 bg-white/10 backdrop-blur-sm rounded-xl flex items-center justify-center hover:bg-white/20 transition-colors">
              <ArrowRight className="w-[18px] h-[18px] text-white" />
            </button>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 backdrop-blur-sm flex items-center justify-center border border-emerald-400/20 relative">
              <MessageSquare className="w-6 h-6 text-teal-300" />
              {totalUnread > 0 && <span className="absolute -top-1 -left-1 min-w-[18px] h-[18px] bg-rose-500 rounded-full flex items-center justify-center text-[9px] font-black text-white px-1 shadow-sm">{totalUnread > 99 ? '99+' : totalUnread}</span>}
            </div>
            <div>
              <h1 className="text-white text-[20px] font-black">رسائل المتجر</h1>
              <p className="text-teal-300/50 text-[12px] mt-0.5">
                {totalUnread > 0 ? `${totalUnread} رسالة غير مقروءة` : `${conversations.length} محادثة`}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Content - scrollable area */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-4 -mt-8 relative z-20">
          {/* Tabs Card */}
          <div className="bg-[var(--color-surface)] rounded-2xl shadow-lg border border-[var(--color-border)] overflow-hidden mb-3">
            <div className="p-1 flex">
              {[
                { id: 'all' as const, label: 'الكل', count: activeConvs },
                { id: 'starred' as const, label: 'المميزة', count: starredConvs },
                { id: 'archived' as const, label: 'الأرشيف', count: archivedConvs },
              ].map(tab => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                  activeTab === tab.id
                    ? 'gradient-primary text-white shadow-md shadow-emerald-500/20'
                    : 'text-[var(--color-text-tertiary)] hover:text-emerald-600 dark:hover:text-emerald-400'
                }`}>
                  {tab.label}
                  {tab.id === 'all' && totalUnread > 0 && (
                    <span className="min-w-[16px] h-4 rounded-md text-[9px] font-black flex items-center justify-center px-1 bg-rose-500 text-white">{totalUnread > 99 ? '99+' : totalUnread}</span>
                  )}
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="px-3 pb-3">
              <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-tertiary)] pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="بحث عن محادثة..."
                  className="w-full h-9 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl pr-10 pl-4 text-[12px] text-[var(--color-text)] font-medium placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/15 focus:border-emerald-400 transition-all"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="absolute left-2.5 top-1/2 -translate-y-1/2 w-5 h-5 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center">
                    <X className="w-3 h-3 text-[var(--color-text-tertiary)]" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Conversation List */}
          <div className="space-y-1.5 pb-24">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-16">
                <Loader2 className="w-6 h-6 text-emerald-500 animate-spin mb-3" />
                <p className="text-[12px] text-[var(--color-text-tertiary)]">جاري تحميل المحادثات...</p>
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] py-16 text-center">
                <div className="w-16 h-16 rounded-2xl bg-emerald-50/60 dark:bg-emerald-900/20 flex items-center justify-center mx-auto mb-4">
                  {activeTab === 'all' ? <MessageCircle className="w-8 h-8 text-emerald-300 dark:text-emerald-600" /> : activeTab === 'starred' ? <Star className="w-8 h-8 text-amber-300 dark:text-amber-600" /> : <Archive className="w-8 h-8 text-slate-300 dark:text-slate-600" />}
                </div>
                <p className="text-[14px] font-bold text-[var(--color-text)] mb-1">
                  {searchQuery ? 'لا توجد نتائج' : activeTab === 'archived' ? 'لا توجد محادثات مؤرشفة' : activeTab === 'starred' ? 'لا توجد محادثات مميزة' : 'لا توجد رسائل بعد'}
                </p>
                <p className="text-[12px] text-[var(--color-text-tertiary)] mt-1">
                  {searchQuery ? 'جرب كلمة بحث أخرى' : 'ستظهر رسائل العملاء هنا عندما يتواصلون معك'}
                </p>
              </div>
            ) : (
              <AnimatePresence mode="popLayout">
                {filteredConversations.map(conv => (
                  <ConversationItem
                    key={conv.id}
                    conversation={conv}
                    onClick={() => setActiveConv(conv)}
                    onArchive={() => activeTab === 'archived' ? handleUnarchive(conv.id) : handleArchive(conv.id)}
                    onDelete={() => handleDelete(conv.id)}
                    onStar={() => handleStar(conv.id)}
                  />
                ))}
              </AnimatePresence>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ===== Export with Error Boundary =====
export const StoreMessagesSafe: React.FC = () => (
  <StoreMessagesErrorBoundary>
    <StoreMessages />
  </StoreMessagesErrorBoundary>
);
