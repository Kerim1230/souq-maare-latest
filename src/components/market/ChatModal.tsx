'use client';
import React, { useState, useEffect, useCallback, useRef, memo } from 'react';
import { createPortal } from 'react-dom';
import { MessageCircle, Send, X, CheckCheck, AlertTriangle, RefreshCw, Loader2, WifiOff, UserCircle } from 'lucide-react';
import { StoreLogo } from '@/components/market/SafeImage';
import { optimizeImage } from '@/lib/image-optimize';
import { useChatStore, generateConversationId, type ChatMessage, safeMessageTime, EMPTY_MESSAGES } from '@/store/chatStore';
import { mapApiMessages } from '@/lib/chat-utils';
import { lockScroll, unlockScroll, blockPointerEvents, restorePointerEvents } from '@/lib/scroll-lock';
import toast from 'react-hot-toast';
import { apiGet, apiPost } from '@/lib/fetchApi';

interface ChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserId: string;
  storeOwnerId: string;
  storeName: string;
  storeId?: string;
  storeLogoUrl?: string;
}

type ErrorType = 'none' | 'network' | 'server';

export const ChatModal: React.FC<ChatModalProps> = memo(({ isOpen, onClose, currentUserId, storeOwnerId, storeName, storeId, storeLogoUrl }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [errorType, setErrorType] = useState<ErrorType>('none');
  const [errorMsg, setErrorMsg] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastMessageIdRef = useRef<string>('');
  const sendingRef = useRef(false);
  const onCloseRef = useRef(onClose);
  // Update ref in effect (React 19 rule: no ref writes during render)
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // Stable close handler from ref — must be before any early return (hooks rule)
  const stableClose = useCallback(() => onCloseRef.current(), []);

  // Subscribe to messageCache for this conversation
  const convId = generateConversationId(currentUserId, storeOwnerId);
  const cachedMessages = useChatStore(
    useCallback(s => s.messageCache.get(convId) ?? EMPTY_MESSAGES, [convId])
  );

  // Scroll lock + escape key — owner-based, only depends on isOpen
  const handleEscape = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onCloseRef.current();
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    document.addEventListener('keydown', handleEscape);
    lockScroll('ChatModal');
    blockPointerEvents('ChatModal');
    return () => {
      document.removeEventListener('keydown', handleEscape);
      unlockScroll('ChatModal');
      restorePointerEvents('ChatModal');
    };
  }, [isOpen, handleEscape]);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  }, []);

  // Fetch messages
  const fetchMessages = useCallback(async (showLoader = false) => {
    try {
      if (showLoader) setLoading(true);
      setErrorType('none');
      setErrorMsg('');

      const { data, error: fetchErr } = await apiGet(
        `/api/chat/messages?senderId=${currentUserId}&receiverId=${storeOwnerId}`
      );

      if (fetchErr) throw new Error('Failed to fetch messages');

      const msgs = mapApiMessages(data?.messages || []);

      setMessages(msgs);
      if (msgs.length > 0) lastMessageIdRef.current = msgs[msgs.length - 1].id;

      // Mark as read
      try {
        const convId = generateConversationId(currentUserId, storeOwnerId);
        await apiPost('/api/chat/mark-read', { conversationId: convId, userId: currentUserId });
      } catch { /* mark-read is non-critical */ }

      scrollToBottom();
    } catch (err) {
      if ((err as Error).message?.includes('Failed to fetch') || (err as Error).name === 'TypeError') {
        setErrorType('network');
        setErrorMsg('تعذر الاتصال بالخادم. تحقق من اتصالك بالإنترنت.');
      } else {
        setErrorType('server');
        setErrorMsg('حدث خطأ أثناء تحميل المحادثة.');
      }
    } finally {
      setLoading(false);
    }
  }, [currentUserId, storeOwnerId, scrollToBottom]);

  // Send message
  const handleSend = useCallback(async () => {
    if (!newMessage.trim() || sending || sendingRef.current) return;

    const content = newMessage.trim();
    sendingRef.current = true;
    setSending(true);

    try {
      const { data, error: sendError } = await apiPost('/api/chat/send', {
        senderId: currentUserId,
        receiverId: storeOwnerId,
        storeId: storeId || null,
        content,
      });

      if (sendError) {
        toast.error(sendError);
        return;
      }

      const sentMsg: ChatMessage = {
        id: data.message?.id || Date.now().toString(),
        senderId: currentUserId,
        receiverId: storeOwnerId,
        storeId: storeId || undefined,
        content,
        createdAt: data.message?.created_at || data.message?.createdAt || new Date().toISOString(),
        timestamp: Date.now(),
        senderName: data.message?.sender?.full_name || data.message?.sender?.fullName,
        senderAvatar: data.message?.sender?.avatar_url || data.message?.sender?.avatarUrl,
      };

      setMessages(prev => [...prev, sentMsg]);
      lastMessageIdRef.current = sentMsg.id;

      // Update conversation in chat store
      const chatStore = useChatStore.getState();
      const convId = generateConversationId(currentUserId, storeOwnerId);
      chatStore.upsertConversation({
        id: convId,
        otherUserId: storeOwnerId,
        otherUserName: storeName,
        otherUserAvatar: storeLogoUrl || null,
        storeId: storeId || '',
        storeName: storeName,
        lastMessage: content,
        lastMessageTime: new Date().toISOString(),
        lastMessageSenderId: currentUserId,
      });

      setNewMessage('');
      scrollToBottom();
    } catch (err) {
      const isNetworkError = (err as Error).message?.includes('Failed to fetch') || (err as Error).name === 'TypeError';
      toast.error(isNetworkError ? 'لا يوجد اتصال بالإنترنت' : 'فشل إرسال الرسالة، حاول مجدداً');
    } finally {
      setSending(false);
      sendingRef.current = false;
      inputRef.current?.focus();
    }
  }, [newMessage, sending, currentUserId, storeOwnerId, storeId, storeName, storeLogoUrl, scrollToBottom]);

  // Sync cached realtime messages into local state
  useEffect(() => {
    if (!isOpen || cachedMessages.length === 0) return;
    setMessages(prev => {
      const localIds = new Set(prev.map(m => m.id));
      const newMsgs = cachedMessages.filter(m => !localIds.has(m.id));
      if (newMsgs.length === 0) return prev; // no change — returns same reference, no re-render
      lastMessageIdRef.current = newMsgs[newMsgs.length - 1].id;
      scrollToBottom();
      // Mark as read for incoming messages
      const incoming = newMsgs.filter(m => m.senderId === storeOwnerId);
      if (incoming.length > 0) {
        const cid = generateConversationId(currentUserId, storeOwnerId);
        apiPost('/api/chat/mark-read', { conversationId: cid, userId: currentUserId }).catch(() => {});
      }
      return [...prev, ...newMsgs];
    });
  }, [isOpen, cachedMessages, currentUserId, storeOwnerId, scrollToBottom]);

  // Open/close
  useEffect(() => {
    if (!isOpen) {
      setMessages([]);
      setErrorType('none');
      setErrorMsg('');
      return;
    }
    if (!currentUserId || !storeOwnerId || currentUserId === storeOwnerId) return;

    fetchMessages(true);
  }, [isOpen, currentUserId, storeOwnerId, fetchMessages]);

  // Focus input
  useEffect(() => {
    if (isOpen && !loading) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen, loading]);

  if (!isOpen) return null;
  if (currentUserId === storeOwnerId) return null;

  const hasError = errorType !== 'none';

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

  const chatContent = (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center" style={{ pointerEvents: 'auto' }}>
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[3px]" onClick={stableClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`محادثة مع ${storeName}`}
        className="relative w-full max-w-lg bg-[var(--color-bg)] rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden z-10 flex flex-col animate-slideUp"
        style={{ height: '80vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="gradient-dark px-4 py-3 flex items-center gap-3 flex-shrink-0">
          <button onClick={stableClose} className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/10 text-white hover:bg-white/20 transition-colors">
            <X className="w-4 h-4" />
          </button>
          <div className="relative flex-shrink-0">
            <StoreLogo src={storeLogoUrl} name={storeName} size="sm" className="border-2 border-white/20 shadow-sm" />
            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-400 rounded-full border-2 border-[#022c22]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-bold truncate">{storeName}</p>
            <p className={`text-[11px] ${hasError ? 'text-rose-300' : 'text-teal-300/60'}`}>
              {hasError ? 'غير متصل' : 'متصل الآن'}
            </p>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {/* Store Header */}
          <div className="flex flex-col items-center py-2 mb-2">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-100 to-teal-100 dark:from-emerald-900/30 dark:to-teal-900/30 flex items-center justify-center overflow-hidden border-2 border-emerald-200 dark:border-emerald-700/50 mb-2 shadow-sm">
              <StoreLogo src={storeLogoUrl} name={storeName} size="lg" />
            </div>
            <p className="text-[14px] font-bold text-[var(--color-text)]">{storeName}</p>
            <p className="text-[11px] text-[var(--color-text-tertiary)] mt-0.5">مرحباً بك! كيف يمكننا مساعدتك؟</p>
            <div className="flex items-center gap-1.5 mt-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span className="text-[10px] text-emerald-500 font-medium">متصل</span>
            </div>
          </div>

          {hasError && !loading && messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center px-6">
              <div className="w-14 h-14 bg-rose-50 dark:bg-rose-900/20 rounded-2xl flex items-center justify-center mb-3">
                {errorType === 'network' ? <WifiOff className="w-7 h-7 text-rose-400" /> : <AlertTriangle className="w-7 h-7 text-rose-400" />}
              </div>
              <p className="text-sm font-bold text-[var(--color-text)]">فشل تحميل الرسائل</p>
              <p className="text-xs text-[var(--color-text-tertiary)] mt-1">{errorMsg}</p>
              <button onClick={() => fetchMessages(true)} className="mt-4 flex items-center gap-2 px-5 py-2.5 gradient-primary text-white text-sm font-bold rounded-xl shadow-md">
                <RefreshCw className="w-4 h-4" />
                إعادة المحاولة
              </button>
            </div>
          ) : loading && messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Loader2 className="w-7 h-7 text-emerald-500 animate-spin mb-3" />
              <p className="text-sm font-bold text-[var(--color-text)]">جاري التحميل...</p>
            </div>
          ) : messages.length === 0 && !loading ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="w-14 h-14 bg-emerald-50/60 dark:bg-emerald-900/20 rounded-2xl flex items-center justify-center mb-3">
                <MessageCircle className="w-7 h-7 text-emerald-300 dark:text-emerald-600" />
              </div>
              <p className="text-sm font-bold text-[var(--color-text)]">ابدأ المحادثة</p>
              <p className="text-xs text-[var(--color-text-tertiary)] mt-1">اكتب رسالتك الأولى</p>
            </div>
          ) : null}

          {groupedMessages.map((group) => (
            <div key={group.date}>
              <div className="flex items-center gap-3 my-2">
                <div className="flex-1 h-px bg-slate-100 dark:bg-slate-800" />
                <span className="text-[10px] text-[var(--color-text-tertiary)] font-medium px-2">{group.date}</span>
                <div className="flex-1 h-px bg-slate-100 dark:bg-slate-800" />
              </div>
              {group.messages.map((msg, i) => {
                const isMe = msg.senderId === currentUserId;
                const showAvatar = !isMe && (i === 0 || group.messages[i - 1]?.senderId === currentUserId);
                return (
                  <div key={msg.id || i} className={`flex ${isMe ? 'justify-end' : 'justify-start'} ${!isMe && !showAvatar ? 'mt-1' : 'mt-3'}`}>
                    {!isMe && (
                      <div className="flex items-end gap-2">
                        {showAvatar ? (
                          <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-emerald-100 to-teal-100 dark:from-emerald-800 dark:to-teal-800 flex items-center justify-center overflow-hidden flex-shrink-0 mb-1">
                            {msg.senderAvatar ? <img src={optimizeImage(msg.senderAvatar)} alt="" className="w-full h-full object-cover" /> : <UserCircle className="w-4 h-4 text-emerald-400" />}
                          </div>
                        ) : <div className="w-6 flex-shrink-0" />}
                      </div>
                    )}
                    <div className={`max-w-[78%] px-3.5 py-2.5 ${
                      isMe
                        ? 'gradient-primary text-white rounded-2xl rounded-bl-md'
                        : 'bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)] rounded-2xl rounded-br-md shadow-sm'
                    }`}>
                      <p className="text-[13px] leading-relaxed whitespace-pre-wrap break-words">{msg.content}</p>
                      <p className={`text-[10px] mt-1 flex items-center gap-1 justify-end ${isMe ? 'text-white/50' : 'text-[var(--color-text-tertiary)]'}`}>
                        {safeMessageTime(msg)}
                        {isMe && <CheckCheck className="w-3 h-3" />}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-3 bg-[var(--color-surface)] border-t border-[var(--color-border)] flex gap-2 flex-shrink-0">
          <input
            ref={inputRef}
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder="اكتب رسالتك..."
            disabled={sending}
            className="flex-1 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl px-4 py-2.5 text-sm text-[var(--color-text)] placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 disabled:opacity-50 transition-all"
          />
          <button
            onClick={handleSend}
            disabled={sending || !newMessage.trim()}
            className="w-10 h-10 gradient-primary rounded-xl flex items-center justify-center text-white shadow-md shadow-emerald-500/20 disabled:opacity-50 hover:shadow-lg transition-all active:scale-95"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );

  // 🔥 CRITICAL FIX: Render via Portal to document.body
  // Prevents parent transform/overflow from breaking fixed positioning
  if (typeof window === 'undefined') return null;
  return createPortal(chatContent, document.body);
});
ChatModal.displayName = 'ChatModal';
