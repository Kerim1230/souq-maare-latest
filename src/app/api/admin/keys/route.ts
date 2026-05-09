export const runtime = 'nodejs'
import { NextRequest } from 'next/server';
import { requireAdmin } from '@/server/lib/auth-guard';
import { getAdminEmail } from '@/server/lib/secrets';
import { badRequest, forbidden, success, serverError } from '@/lib/api-response';
import { withRoute } from '@/server/lib/route-wrapper';
import { logger } from '@/lib/logger';
import { getSupabaseAdmin, logAdminActivity, TABLES, handleResponse } from '@/lib/supabase-db';
import { encrypt, decrypt } from '@/server/lib/encryption';

const MANAGED_KEYS = [
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET',
] as const;

/**
 * GET /api/admin/keys
 * Returns the status of all managed API keys (set/unset, no values exposed).
 * Restricted to the primary admin email only.
 */
export const GET = withRoute(async (request: NextRequest) => {
  const admin = await requireAdmin(request);
  if (!admin.success) return admin.response;

  // Extra check: only the primary admin email can manage keys
  const adminEmail = getAdminEmail();
  if (!adminEmail || admin.email !== adminEmail) {
    return forbidden('هذا الإجراء متاح فقط للمشرف الرئيسي');
  }

  try {
    const sb = getSupabaseAdmin();
    const { data: rows, error } = await sb.from(TABLES.ENCRYPTED_SETTINGS)
      .select('key, updated_at')
      .in('key', [...MANAGED_KEYS]);

    if (error) throw new Error(error.message);

    const rowMap = new Map((rows || []).map((r: Record<string, unknown>) => [r.key, r]));

    const keys = MANAGED_KEYS.map(keyName => {
      const row = rowMap.get(keyName);
      return {
        key: keyName,
        isSet: !!row,
        updatedAt: row ? row.updated_at : null,
      };
    });

    return success({ keys });
  } catch (error) {
    logger.error('Admin keys GET error', 'AdminKeys', { error: (error as Error)?.message });
    return serverError('حدث خطأ أثناء جلب حالة المفاتيح');
  }
});

/**
 * PUT /api/admin/keys
 * Set (encrypt and store) an API key.
 * Body: { key: string, value: string }
 * Restricted to the primary admin email only.
 */
export const PUT = withRoute(async (request: NextRequest) => {
  const admin = await requireAdmin(request);
  if (!admin.success) return admin.response;

  // Extra check: only the primary admin email can manage keys
  const adminEmail = getAdminEmail();
  if (!adminEmail || admin.email !== adminEmail) {
    return forbidden('هذا الإجراء متاح فقط للمشرف الرئيسي');
  }

  try {
    const body = await request.json();
    const { key, value } = body as { key?: string; value?: string };

    if (!key || typeof key !== 'string') {
      return badRequest('اسم المفتاح مطلوب');
    }

    const upperKey = key.toUpperCase();
    if (!(MANAGED_KEYS as readonly string[]).includes(upperKey)) {
      return badRequest('مفتاح غير مدعوم: ' + key);
    }

    if (typeof value !== 'string') {
      return badRequest('قيمة المفتاح مطلوبة');
    }

    const sb = getSupabaseAdmin();

    let result;
    if (!value || value.trim() === '') {
      // Delete the key if empty value provided
      await sb.from(TABLES.ENCRYPTED_SETTINGS).delete().eq('key', upperKey);
      result = { key: upperKey, isSet: false, updatedAt: null };
    } else {
      const encryptedValue = encrypt(value);
      await handleResponse(
        await sb.from(TABLES.ENCRYPTED_SETTINGS).upsert(
          { key: upperKey, encrypted_value: encryptedValue },
          { onConflict: 'key' }
        ).select().single(),
        'setKeyByName'
      );

      const { data: row } = await sb.from(TABLES.ENCRYPTED_SETTINGS).select('updated_at').eq('key', upperKey).single();
      result = { key: upperKey, isSet: true, updatedAt: row?.updated_at || null };
    }

    // Log the action
    await logAdminActivity({
      action: `تحديث مفتاح: ${upperKey}`,
      target_type: 'encrypted_key',
      target_name: upperKey,
      details: value ? 'تم التعيين' : 'تم الحذف',
    });

    return success({ key: result });
  } catch (error) {
    logger.error('Admin keys PUT error', 'AdminKeys', { error: (error as Error)?.message });
    if (error instanceof Error && error.message.includes('غير مدعوم')) {
      return badRequest(error.message);
    }
    return serverError('حدث خطأ أثناء حفظ المفتاح');
  }
});
