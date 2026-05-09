export const runtime = 'nodejs';
import { NextRequest } from 'next/server';
import { withRoute } from '@/server/lib/route-wrapper';
import { getAppSetting } from '@/lib/supabase-db';
import { success, badRequest } from '@/lib/api-response';

const SYSTEM_PROMPT = `أنت مساعد مفيد لمستخدمي تطبيق "سوق مارع" الإلكتروني - منصة سورية للتجارة الإلكترونية.
تساعد المستخدمين في:
- كيفية إنشاء المتاجر وإدارة المنتجات
- نظام النقاط والمحفظة
- التوثيق والتحقق من المتاجر
- البحث عن المنتجات والمتاجر
- الإبلاغ عن المشاكل
- أي استفسارات أخرى عن التطبيق

أجب باللغة العربية دائماً. كن مختصراً ومفيداً. إذا لم تكن متأكداً من إجابة، أرشد المستخدم للتواصل مع الدعم.`;

// Free fallback models that work globally on OpenRouter
const FALLBACK_MODELS = [
  'nvidia/nemotron-nano-9b-v2:free',
  'minimax/minimax-m2.5:free',
];

/** Return provider-specific headers based on baseUrl */
function getProviderHeaders(baseUrl: string): Record<string, string> {
  const headers: Record<string, string> = {};

  if (baseUrl.includes('openrouter.ai')) {
    headers['HTTP-Referer'] = 'https://suq-maraa.com';
    headers['X-Title'] = 'SuqMaraa';
  }

  return headers;
}

interface AiConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  provider: string;
}

async function getAiConfig(): Promise<AiConfig | null> {
  try {
    const value = await getAppSetting('ai_help_config');
    if (!value) return null;
    const parsed = JSON.parse(value);
    return {
      apiKey: parsed.apiKey || '',
      baseUrl: parsed.baseUrl || 'https://api.openai.com/v1',
      model: parsed.model || 'gpt-4o-mini',
      provider: parsed.provider || 'openai',
    };
  } catch {
    return null;
  }
}

/** Check if an error is a region/availability issue that warrants fallback */
function isRegionOrAvailabilityError(status: number, errorDetail: string): boolean {
  const lower = errorDetail.toLowerCase();
  return (
    status === 403 ||
    status === 429 ||
    lower.includes('region') ||
    lower.includes('not available') ||
    lower.includes('rate-limited') ||
    lower.includes('no endpoints') ||
    lower.includes('temporarily')
  );
}

/** Try calling the API with a specific model, return result or null */
async function tryModel(
  apiUrl: string,
  headers: Record<string, string>,
  modelName: string,
  userMessage: string
): Promise<{ reply: string; model: string } | null> {
  const requestBody = {
    model: modelName,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userMessage },
    ],
    max_tokens: 500,
    temperature: 0.7,
  };

  console.log('[AI Chat] Trying model:', modelName);

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
    });

    const responseText = await response.text();

    console.log('[AI Chat] Response for', modelName, ':', {
      status: response.status,
      body: responseText.substring(0, 300),
    });

    if (!response.ok) {
      // Parse error to check if it's a region/availability issue
      let errorDetail = `${response.status}: ${response.statusText}`;
      try {
        const errorJson = JSON.parse(responseText);
        if (errorJson?.error?.message) {
          errorDetail = errorJson.error.message;
        }
      } catch { /* ignore */ }

      console.warn('[AI Chat] Model', modelName, 'failed:', errorDetail);

      if (isRegionOrAvailabilityError(response.status, errorDetail)) {
        return null; // Try next fallback
      }

      // Non-region error — return the error to user
      return { reply: 'عذراً، لم أتمكن من معالجة طلبك حالياً.', model: modelName };
    }

    const data = JSON.parse(responseText);
    const reply = data.choices?.[0]?.message?.content || 'عذراً، لم أتمكن من فهم سؤالك.';
    return { reply, model: modelName };
  } catch (err) {
    console.error('[AI Chat] Model', modelName, 'exception:', err);
    return null;
  }
}

export const POST = withRoute(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const { message } = body;

    // Health check: if message is __check__, just return enabled status + provider
    if (message === '__check__') {
      const config = await getAiConfig();
      return success({
        enabled: !!config?.apiKey,
        provider: config?.provider || '',
        model: config?.model || '',
        reply: '',
      });
    }

    if (!message || typeof message !== 'string' || !message.trim()) {
      return badRequest('يرجى إدخال رسالة');
    }

    const config = await getAiConfig();
    if (!config?.apiKey) {
      return success({
        enabled: false,
        reply: 'مركز المساعدة غير مفعّل حالياً. يرجى التواصل مع الإدارة.',
      });
    }

    // Build the API URL
    let apiBase = config.baseUrl.replace(/\/+$/, '');
    const apiUrl = apiBase.endsWith('/v1')
      ? `${apiBase}/chat/completions`
      : `${apiBase}/v1/chat/completions`;

    // Build headers: base + provider-specific
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
      ...getProviderHeaders(config.baseUrl),
    };

    // Build model list: primary model first, then fallbacks
    const primaryModel = config.model || 'gpt-4o-mini';
    const modelsToTry = [primaryModel];

    // Add fallback models only for OpenRouter (they use free models)
    if (config.baseUrl.includes('openrouter.ai')) {
      for (const fb of FALLBACK_MODELS) {
        if (fb !== primaryModel) {
          modelsToTry.push(fb);
        }
      }
    }

    console.log('[AI Chat] Models to try:', modelsToTry.join(' → '));

    // Try each model in order until one works
    let lastError = '';
    for (const model of modelsToTry) {
      const result = await tryModel(apiUrl, headers, model, message.trim());
      if (result) {
        console.log('[AI Chat] Success with model:', result.model);
        return success({ reply: result.reply, model: result.model });
      }
      lastError = `النموذج "${model}" غير متاح.`;
    }

    // All models failed
    console.error('[AI Chat] All models failed');
    return success({
      reply: 'عذراً، النموذج غير متاح حالياً. جرب نموذجاً آخر في الإعدادات.',
      error: lastError,
    });
  } catch (err) {
    console.error('[AI Chat] Error:', err);
    const errorMessage = err instanceof Error ? err.message : 'حدث خطأ أثناء معالجة الطلب';
    return success({
      reply: 'عذراً، حدث خطأ أثناء معالجة الطلب.',
      error: errorMessage,
    });
  }
});
