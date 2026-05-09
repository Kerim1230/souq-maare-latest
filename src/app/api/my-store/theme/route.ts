export const runtime = 'nodejs'
import { NextRequest } from 'next/server';
import { requireStoreOwner } from '@/server/lib/require-auth';
import { success, badRequest, notFound, apiError, serverError } from '@/lib/api-response';
import { logger } from '@/lib/logger';
import { withRoute } from '@/server/lib/route-wrapper';
import { getSupabaseAdmin, TABLES, findStoreById, updateStore } from '@/lib/supabase-db';

// Valid color IDs that the client can send
const VALID_COLOR_IDS = new Set([
  'royal-blue', 'emerald', 'luxury-purple', 'golden', 'cherry-red',
  'modern-teal', 'warm-orange', 'elegant-pink', 'professional', 'luxury-black',
  'sky-blue', 'lime-fresh', 'coral-warm', 'indigo-night', 'mint-cool', 'burgundy-wine',
]);

/**
 * GET /api/my-store/theme?storeId=xxx
 */
export const GET = withRoute(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const storeId = searchParams.get('storeId');

    if (!storeId) {
      return badRequest('storeId is required');
    }

    const sb = getSupabaseAdmin();
    const { data: store, error } = await sb
      .from(TABLES.STORES)
      .select('theme_color, theme_color_changed_at, is_verified')
      .eq('id', storeId)
      .maybeSingle();

    if (error || !store) {
      return notFound('Store not found');
    }

    return success({
      themeColor: store.theme_color || null,
      themeColorChangedAt: store.theme_color_changed_at || null,
      isVerified: store.is_verified,
    });
  } catch (error) {
    logger.error('Failed to get store theme', 'MyStoreTheme', { error: (error as Error)?.message });
    return serverError('Failed to get store theme');
  }
})

/**
 * PUT /api/my-store/theme
 */
export const PUT = withRoute(async (request: NextRequest) => {
  try {
    const { storeId, colorId } = await request.json();

    if (!storeId || !colorId) {
      return badRequest('storeId and colorId are required');
    }

    // Verify authentication + store ownership
    const auth = await requireStoreOwner(request, storeId);
    if (!auth.success) return auth.response;

    if (!VALID_COLOR_IDS.has(colorId)) {
      return apiError('لون غير صالح', 400, { code: 'BIZ_INVALID_COLOR' });
    }

    let store;
    try {
      store = await findStoreById(storeId);
    } catch {
      return notFound('Store not found');
    }

    if (!store.is_verified) {
      return apiError('هذه الميزة متاحة للمتاجر الموثق فقط', 403, { code: 'BIZ_NOT_VERIFIED' });
    }

    // Check 24h cooldown
    if (store.theme_color_changed_at) {
      const lastChange = new Date(store.theme_color_changed_at).getTime();
      const cooldownMs = 24 * 60 * 60 * 1000;
      const remaining = cooldownMs - (Date.now() - lastChange);
      if (remaining > 0) {
        const hours = Math.floor(remaining / (1000 * 60 * 60));
        const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
        return apiError(
          'يمكنك تغيير لون المتجر مرة واحدة كل 24 ساعة',
          429,
          {
            code: 'BIZ_COOLDOWN',
            remainingHours: hours,
            remainingMinutes: minutes,
            canChangeAt: new Date(lastChange + cooldownMs).toISOString(),
          }
        );
      }
    }

    const updatedStore = await updateStore(storeId, {
      theme_color: colorId,
      theme_color_changed_at: new Date().toISOString(),
    });

    return success({
      store: {
        themeColor: updatedStore.theme_color,
        themeColorChangedAt: updatedStore.theme_color_changed_at || null,
      },
      message: `تم تحديث لون متجر "${store.name}" بنجاح`,
    });
  } catch (error) {
    logger.error('Failed to update store theme', 'MyStoreTheme', { error: (error as Error)?.message });
    return serverError('حدث خطأ أثناء تحديث لون المتجر');
  }
})
