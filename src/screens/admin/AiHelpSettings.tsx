'use client';
import React, { useState, useEffect } from 'react';
import { Save, Eye, EyeOff, Loader2, CheckCircle, XCircle, Bot, TestTube, ChevronDown } from 'lucide-react';
import { apiGet, apiPut, apiPost } from '@/lib/fetchApi';
import toast from 'react-hot-toast';

const PROVIDERS = [
  {
    id: 'openai',
    label: 'OpenAI',
    desc: 'موصى به',
    baseUrl: 'https://api.openai.com/v1',
    keyPlaceholder: 'sk-...',
    defaultModel: 'gpt-4o-mini',
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    desc: 'مجاني ومتعدد النماذج',
    baseUrl: 'https://openrouter.ai/api/v1',
    keyPlaceholder: 'sk-or-v1-...',
    defaultModel: 'nvidia/nemotron-nano-9b-v2:free',
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    desc: 'اقتصادي',
    baseUrl: 'https://api.deepseek.com/v1',
    keyPlaceholder: 'sk-...',
    defaultModel: 'deepseek-chat',
  },
  {
    id: 'together',
    label: 'Together AI',
    desc: 'نماذج مفتوحة',
    baseUrl: 'https://api.together.xyz/v1',
    keyPlaceholder: '...',
    defaultModel: 'meta-llama/Llama-3-70b-chat-hf',
  },
  {
    id: 'groq',
    label: 'Groq',
    desc: 'سريع جداً',
    baseUrl: 'https://api.groq.com/openai/v1',
    keyPlaceholder: 'gsk_...',
    defaultModel: 'llama-3.1-8b-instant',
  },
  {
    id: 'custom',
    label: 'مزود آخر',
    desc: 'رابط مخصص',
    baseUrl: '',
    keyPlaceholder: 'مفتاح API...',
    defaultModel: '',
  },
];

export const AiHelpSettings: React.FC = () => {
  const [provider, setProvider] = useState('openai');
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('https://api.openai.com/v1');
  const [model, setModel] = useState('gpt-4o-mini');
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);
  const [testErrorDetail, setTestErrorDetail] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [showProviderList, setShowProviderList] = useState(false);

  useEffect(() => {
    apiGet<{ config: { apiKey: string; apiKeyFull: string; baseUrl: string; model: string; provider: string } }>('/api/admin/ai-config')
      .then(({ data, ok }) => {
        if (ok && data?.config) {
          setApiKey(data.config.apiKeyFull || '');
          setBaseUrl(data.config.baseUrl || 'https://api.openai.com/v1');
          setModel(data.config.model || 'gpt-4o-mini');
          setProvider(data.config.provider || 'openai');
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const currentProvider = PROVIDERS.find(p => p.id === provider) || PROVIDERS[PROVIDERS.length - 1];

  const handleProviderSelect = (p: typeof PROVIDERS[number]) => {
    setProvider(p.id);
    if (p.baseUrl) setBaseUrl(p.baseUrl);
    if (p.defaultModel) setModel(p.defaultModel);
    setShowProviderList(false);
  };

  const handleSave = async () => {
    if (!apiKey.trim()) { toast.error('يرجى إدخال مفتاح API'); return; }
    if (!baseUrl.trim()) { toast.error('يرجى إدخال رابط API'); return; }
    if (!model.trim()) { toast.error('يرجى إدخال اسم النموذج'); return; }
    setSaving(true);
    try {
      const { ok, error } = await apiPut('/api/admin/ai-config', {
        provider,
        apiKey: apiKey.trim(),
        baseUrl: baseUrl.trim(),
        model: model.trim(),
      });
      if (ok) {
        toast.success('تم حفظ الإعدادات بنجاح');
      } else {
        toast.error(error || 'حدث خطأ أثناء الحفظ');
      }
    } catch {
      toast.error('حدث خطأ أثناء الحفظ');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    setTestErrorDetail('');
    try {
      // First save current settings so the test uses them
      if (apiKey.trim() && baseUrl.trim() && model.trim()) {
        await apiPut('/api/admin/ai-config', {
          provider,
          apiKey: apiKey.trim(),
          baseUrl: baseUrl.trim(),
          model: model.trim(),
        });
      }
      const { ok, data } = await apiPost<{ reply: string; error?: string }>('/api/help/ai-chat', {
        message: 'Hello, this is a connection test.',
      });
      if (ok && data?.reply && !data.error) {
        setTestResult('success');
        toast.success('تم الاتصال بنجاح! ✅');
      } else {
        setTestResult('error');
        setTestErrorDetail(data?.error || 'استجابة غير متوقعة');
        toast.error('فشل الاتصال');
      }
    } catch (err) {
      setTestResult('error');
      setTestErrorDetail(err instanceof Error ? err.message : 'خطأ في الاتصال');
      toast.error('فشل الاتصال');
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 text-emerald-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-[var(--color-surface)] rounded-2xl p-4 border border-[var(--color-border)] shadow-sm">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-9 h-9 bg-purple-50 dark:bg-purple-900/20 rounded-xl flex items-center justify-center">
            <Bot className="w-4.5 h-4.5 text-purple-500" />
          </div>
          <div>
            <p className="text-[14px] font-bold text-[var(--color-text)]">إعدادات المساعد الذكي</p>
            <p className="text-[11px] text-[var(--color-text-tertiary)]">تكوين API للمحادثة الذكية</p>
          </div>
        </div>

        <div className="space-y-3">
          {/* Provider Selection */}
          <div className="relative">
            <label className="text-[13px] font-bold text-emerald-900 dark:text-emerald-300 block mb-1.5">مزود الخدمة</label>
            <button
              onClick={() => setShowProviderList(!showProviderList)}
              className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl px-4 py-2.5 text-[14px] text-[var(--color-text)] outline-none flex items-center justify-between hover:border-emerald-400 transition-colors"
            >
              <span className="flex items-center gap-2">
                <span className="font-bold">{currentProvider.label}</span>
                <span className="text-[11px] text-[var(--color-text-tertiary)]">({currentProvider.desc})</span>
              </span>
              <ChevronDown className={`w-4 h-4 text-[var(--color-text-tertiary)] transition-transform ${showProviderList ? 'rotate-180' : ''}`} />
            </button>

            {showProviderList && (
              <div className="absolute top-full mt-1 right-0 left-0 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl shadow-lg z-50 overflow-hidden">
                {PROVIDERS.map(p => (
                  <button
                    key={p.id}
                    onClick={() => handleProviderSelect(p)}
                    className={`w-full px-4 py-3 text-right flex items-center justify-between hover:bg-emerald-50/50 dark:hover:bg-emerald-900/10 transition-colors ${
                      provider === p.id ? 'bg-emerald-50/60 dark:bg-emerald-900/15' : ''
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span className="text-[14px] font-bold text-[var(--color-text)]">{p.label}</span>
                      <span className="text-[11px] text-[var(--color-text-tertiary)]">{p.desc}</span>
                    </span>
                    {provider === p.id && (
                      <CheckCircle className="w-4 h-4 text-emerald-500" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Base URL */}
          <div>
            <label className="text-[13px] font-bold text-emerald-900 dark:text-emerald-300 block mb-1.5">رابط API</label>
            <input
              type="text"
              value={baseUrl}
              onChange={e => setBaseUrl(e.target.value)}
              placeholder="https://api.openai.com/v1"
              className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl px-4 py-2.5 text-[14px] text-[var(--color-text)] placeholder:text-[var(--color-text-tertiary)] outline-none focus:ring-2 focus:ring-emerald-500/15 focus:border-emerald-400"
            />
            <p className="text-[10px] text-[var(--color-text-tertiary)] mt-1">
              يتضمن /v1 في النهاية تلقائياً حسب المزود
            </p>
          </div>

          {/* API Key */}
          <div>
            <label className="text-[13px] font-bold text-emerald-900 dark:text-emerald-300 block mb-1.5">مفتاح API</label>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                placeholder={currentProvider.keyPlaceholder}
                className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl px-4 py-2.5 text-[14px] text-[var(--color-text)] placeholder:text-[var(--color-text-tertiary)] outline-none focus:ring-2 focus:ring-emerald-500/15 focus:border-emerald-400 pl-11"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center text-[var(--color-text-tertiary)] hover:text-emerald-500"
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Model - Free text */}
          <div>
            <label className="text-[13px] font-bold text-emerald-900 dark:text-emerald-300 block mb-1.5">النموذج</label>
            <input
              type="text"
              value={model}
              onChange={e => setModel(e.target.value)}
              placeholder={currentProvider.defaultModel || 'أدخل اسم النموذج'}
              className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl px-4 py-2.5 text-[14px] text-[var(--color-text)] placeholder:text-[var(--color-text-tertiary)] outline-none focus:ring-2 focus:ring-emerald-500/15 focus:border-emerald-400"
            />
            {currentProvider.defaultModel && (
              <button
                onClick={() => setModel(currentProvider.defaultModel)}
                className="text-[11px] text-emerald-500 hover:text-emerald-600 mt-1 font-medium"
              >
                استخدام الافتراضي: {currentProvider.defaultModel}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 py-3 gradient-primary text-white text-[14px] font-bold rounded-xl shadow-md shadow-emerald-500/20 flex items-center justify-center gap-2 disabled:opacity-40"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          حفظ الإعدادات
        </button>
        <button
          onClick={handleTest}
          disabled={testing}
          className="py-3 px-5 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 text-[14px] font-bold rounded-xl border border-purple-100/60 dark:border-purple-800/40 flex items-center gap-2 disabled:opacity-40"
        >
          {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <TestTube className="w-4 h-4" />}
          اختبار
        </button>
      </div>

      {/* Test Result */}
      {testResult && (
        <div className={`rounded-2xl p-4 border ${
          testResult === 'success'
            ? 'bg-emerald-50/40 dark:bg-emerald-900/10 border-emerald-100/40 dark:border-emerald-800/30'
            : 'bg-rose-50/40 dark:bg-rose-900/10 border-rose-100/40 dark:border-rose-800/30'
        }`}>
          <div className="flex items-center gap-2">
            {testResult === 'success'
              ? <CheckCircle className="w-5 h-5 text-emerald-500" />
              : <XCircle className="w-5 h-5 text-rose-500" />
            }
            <p className={`text-[13px] font-bold ${
              testResult === 'success' ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'
            }`}>
              {testResult === 'success' ? 'الاتصال ناجح! المساعد الذكي يعمل.' : 'فشل الاتصال. تحقق من المفتاح والرابط.'}
            </p>
          </div>
          {testErrorDetail && (
            <p className="mt-2 text-[11px] text-rose-500/80 dark:text-rose-400/60 font-mono break-all border-t border-rose-200/30 dark:border-rose-700/20 pt-2">
              {testErrorDetail}
            </p>
          )}
        </div>
      )}
    </div>
  );
};
