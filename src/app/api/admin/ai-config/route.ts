export const runtime = 'nodejs';
import { NextRequest } from 'next/server';
import { withRoute } from '@/server/lib/route-wrapper';
import { requireAuth } from '@/server/lib/auth-guard';
import { success, badRequest, serverError } from '@/lib/api-response';
import { getAppSetting, setAppSetting } from '@/lib/supabase-db';

// GET /api/admin/ai-config — Get AI help configuration (masked API key)
export const GET = withRoute(async (request: NextRequest) => {
  try {
    const auth = await requireAuth(request);
    if (!auth.success) return auth.response;

    const { findUserById } = await import('@/lib/supabase-db');
    let user;
    try {
      user = await findUserById(auth.userId);
    } catch { return badRequest('غير مصرح'); }

    if (!user?.is_admin) {
      return badRequest('غير مصرح');
    }

    const setting = await getAppSetting('ai_help_config');

    if (!setting) {
      return success({
        config: {
          provider: 'openai',
          apiKey: '',
          baseUrl: 'https://api.openai.com/v1',
          model: 'gpt-4o-mini',
        },
      });
    }

    const parsed = JSON.parse(setting);
    const maskedKey = parsed.apiKey
      ? parsed.apiKey.slice(0, 6) + '***' + parsed.apiKey.slice(-4)
      : '';

    return success({
      config: {
        provider: parsed.provider || 'openai',
        apiKey: maskedKey,
        apiKeyFull: parsed.apiKey || '',
        baseUrl: parsed.baseUrl || 'https://api.openai.com/v1',
        model: parsed.model || 'gpt-4o-mini',
      },
    });
  } catch {
    return serverError('حدث خطأ أثناء جلب الإعدادات');
  }
});

// PUT /api/admin/ai-config — Save AI help configuration
export const PUT = withRoute(async (request: NextRequest) => {
  try {
    const auth = await requireAuth(request);
    if (!auth.success) return auth.response;

    const { findUserById } = await import('@/lib/supabase-db');
    let user;
    try {
      user = await findUserById(auth.userId);
    } catch { return badRequest('غير مصرح'); }

    if (!user?.is_admin) {
      return badRequest('غير مصرح');
    }

    const body = await request.json();
    const { provider, apiKey, baseUrl, model } = body;

    if (!apiKey || !baseUrl || !model) {
      return badRequest('يرجى ملء جميع الحقول');
    }

    // Store baseUrl as-is (with /v1 included from the admin UI)
    const configValue = JSON.stringify({
      provider: provider || 'openai',
      apiKey,
      baseUrl,
      model,
    });

    await setAppSetting('ai_help_config', configValue);

    const { logger } = await import('@/lib/logger');
    logger.info('AI Help config updated', 'Admin', { provider, model, baseUrl });

    return success({ message: 'تم حفظ الإعدادات بنجاح' });
  } catch {
    return serverError('حدث خطأ أثناء حفظ الإعدادات');
  }
});
