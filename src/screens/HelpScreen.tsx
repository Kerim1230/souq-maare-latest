'use client';
import React, { useState, useRef, useEffect } from 'react';
import { ArrowRight, Send, Bot, User, Loader2, AlertCircle, AlertTriangle } from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { apiPost } from '@/lib/fetchApi';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'error';
  content: string;
  errorDetail?: string;
  model?: string;
}

const PROVIDER_LABELS: Record<string, string> = {
  openai: 'OpenAI',
  openrouter: 'OpenRouter',
  deepseek: 'DeepSeek',
  together: 'Together AI',
  groq: 'Groq',
  custom: 'مخصص',
};

export const HelpScreen: React.FC = () => {
  const setSubScreen = useAppStore(s => s.setSubScreen);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [aiEnabled, setAiEnabled] = useState<boolean | null>(null);
  const [providerName, setProviderName] = useState('');
  const [connectionConfirmed, setConnectionConfirmed] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Check if AI help is enabled + get provider info
  useEffect(() => {
    apiPost<{ enabled: boolean; provider: string; model: string }>('/api/help/ai-chat', { message: '__check__' })
      .then(({ ok, data }) => {
        const enabled = ok && data?.enabled !== false;
        setAiEnabled(enabled);
        if (data?.provider) {
          setProviderName(PROVIDER_LABELS[data.provider] || data.provider);
        }
      })
      .catch(() => {
        setAiEnabled(false);
      });
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const { data, ok, error } = await apiPost<{ reply: string; error?: string; model?: string }>('/api/help/ai-chat', { message: text });
      if (ok && data?.reply && !data.error) {
        setConnectionConfirmed(true);
        const assistantMsg: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: data.reply,
          model: data.model,
        };
        setMessages(prev => [...prev, assistantMsg]);
      } else if (ok && data?.reply && data.error) {
        const errorMsg: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: 'error',
          content: data.reply,
          errorDetail: data.error,
        };
        setMessages(prev => [...prev, errorMsg]);
      } else {
        const errorMsg: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: 'error',
          content: error || 'عذراً، لم أتمكن من معالجة طلبك. يرجى المحاولة لاحقاً.',
        };
        setMessages(prev => [...prev, errorMsg]);
      }
    } catch (err) {
      const errorMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'error',
        content: 'عذراً، حدث خطأ في الاتصال. يرجى المحاولة لاحقاً.',
        errorDetail: err instanceof Error ? err.message : undefined,
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[var(--color-bg)]">
      {/* Header */}
      <div className="gradient-dark px-5 pt-8 pb-4 relative overflow-hidden flex-shrink-0">
        <div className="absolute top-[-30px] right-[-20px] w-[140px] h-[140px] rounded-full bg-teal-600/15 blur-[50px]" />
        <div className="relative z-10 flex items-center gap-3">
          <button onClick={() => setSubScreen('none')} className="w-10 h-10 bg-[var(--color-surface)]/10 backdrop-blur-sm rounded-xl flex items-center justify-center">
            <ArrowRight className="w-[18px] h-[18px] text-white" />
          </button>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 gradient-primary rounded-xl flex items-center justify-center shadow-md shadow-emerald-500/20">
              <Bot className="w-4.5 h-4.5 text-white" />
            </div>
            <div>
              <h1 className="text-white text-lg font-bold">مركز المساعدة الذكي</h1>
              <div className="flex items-center gap-1.5">
                <p className="text-teal-300/60 text-[11px]">اسأل أي سؤال عن سوق شامل</p>
                {providerName && (
                  <>
                    <span className="text-teal-400/30 text-[10px]">•</span>
                    <p className="text-teal-300/40 text-[10px]">{providerName}</p>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* AI Not Enabled State */}
      {aiEnabled === false && (
        <div className="flex-1 flex flex-col items-center justify-center px-6 gap-4">
          <div className="w-16 h-16 bg-amber-50 dark:bg-amber-900/20 rounded-2xl flex items-center justify-center">
            <AlertCircle className="w-8 h-8 text-amber-500" />
          </div>
          <div className="text-center">
            <p className="text-[15px] font-bold text-[var(--color-text)] mb-1">مركز المساعدة غير مفعّل حالياً</p>
            <p className="text-[13px] text-[var(--color-text-tertiary)]">يرجى التواصل مع الإدارة.</p>
          </div>
          <button onClick={() => setSubScreen('contact-support')}
            className="px-5 py-2.5 gradient-primary text-white text-[13px] font-bold rounded-xl shadow-md shadow-emerald-500/20">
            تواصل مع الدعم
          </button>
        </div>
      )}

      {/* Chat Messages */}
      {aiEnabled !== false && (
        <>
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {messages.length === 0 && aiEnabled === null && (
              <div className="flex flex-col items-center justify-center py-12 gap-2">
                <Loader2 className="w-6 h-6 text-emerald-500 animate-spin" />
                <p className="text-[13px] text-[var(--color-text-tertiary)]">جاري التحقق من الاتصال...</p>
              </div>
            )}
            {messages.length === 0 && aiEnabled === true && (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <div className="w-14 h-14 bg-emerald-50/60 dark:bg-emerald-900/20 rounded-xl flex items-center justify-center">
                  <Bot className="w-7 h-7 text-emerald-500" />
                </div>
                <p className="text-[14px] font-bold text-[var(--color-text)]">مرحباً بك! 🤖</p>
                <p className="text-[12px] text-[var(--color-text-tertiary)] text-center max-w-[280px]">اسألني أي سؤال عن سوق شامل وكيفية استخدام التطبيق</p>
                {connectionConfirmed && (
                  <div className="flex items-center gap-1.5 bg-emerald-50/60 dark:bg-emerald-900/15 px-3 py-1.5 rounded-lg">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full" />
                    <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">متصل بنجاح</p>
                  </div>
                )}
                <div className="flex flex-wrap gap-2 justify-center mt-2">
                  {['كيف أبيع منتجاتي؟', 'كيف أنشئ متجر؟', 'ما هي النقاط؟'].map(q => (
                    <button key={q} onClick={() => { setInput(q); }}
                      className="bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 text-[12px] font-medium px-3 py-2 rounded-xl border border-emerald-100/60 dark:border-emerald-800/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-colors">
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map(msg => (
              <div key={msg.id} className={`flex gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  msg.role === 'user' ? 'gradient-primary'
                  : msg.role === 'error' ? 'bg-rose-50 dark:bg-rose-900/20'
                  : 'bg-emerald-50 dark:bg-emerald-900/20'
                }`}>
                  {msg.role === 'user'
                    ? <User className="w-4 h-4 text-white" />
                    : msg.role === 'error'
                      ? <AlertTriangle className="w-4 h-4 text-rose-500" />
                      : <Bot className="w-4 h-4 text-emerald-500" />
                  }
                </div>
                <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-[13px] leading-relaxed ${
                  msg.role === 'user'
                    ? 'gradient-primary text-white rounded-br-md'
                    : msg.role === 'error'
                      ? 'bg-rose-50/60 dark:bg-rose-900/10 text-rose-700 dark:text-rose-400 border border-rose-100/60 dark:border-rose-800/40 rounded-bl-md'
                      : 'bg-[var(--color-surface)] text-[var(--color-text)] border border-[var(--color-border)] rounded-bl-md'
                }`}>
                  <p>{msg.content}</p>
                  {msg.role === 'assistant' && msg.model && (
                    <p className="mt-1 text-[10px] text-[var(--color-text-tertiary)]/60">{msg.model}</p>
                  )}
                  {msg.errorDetail && (
                    <p className="mt-1.5 pt-1.5 border-t border-rose-200/50 dark:border-rose-700/30 text-[11px] text-rose-500/80 dark:text-rose-400/60 font-mono break-all">
                      {msg.errorDetail}
                    </p>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center flex-shrink-0">
                  <Bot className="w-4 h-4 text-emerald-500" />
                </div>
                <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl rounded-bl-md px-4 py-3">
                  <div className="flex gap-1.5">
                    <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="border-t border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 flex-shrink-0">
            <div className="flex items-center gap-2.5">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                placeholder="اكتب سؤالك هنا..."
                disabled={loading}
                className="flex-1 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl px-4 py-2.5 text-[14px] text-[var(--color-text)] placeholder:text-[var(--color-text-tertiary)] outline-none focus:ring-2 focus:ring-emerald-500/15 focus:border-emerald-400 disabled:opacity-50"
              />
              <button
                onClick={handleSend}
                disabled={loading || !input.trim()}
                className="w-10 h-10 gradient-primary rounded-xl flex items-center justify-center shadow-md shadow-emerald-500/20 disabled:opacity-40 disabled:shadow-none"
              >
                <Send className="w-4.5 h-4.5 text-white" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
