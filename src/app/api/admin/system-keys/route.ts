export const runtime = 'nodejs'
import { NextRequest } from 'next/server';
import { requireAdmin } from '@/server/lib/admin-auth';
import { success, serverError, badRequest, forbidden } from '@/lib/api-response';
import { withRoute } from '@/server/lib/route-wrapper';
import { logger } from '@/lib/logger';
import { getAdminEmail } from '@/server/lib/secrets';
import { getSupabaseAdmin, TABLES } from '@/lib/supabase-db';
import fs from 'fs';
import path from 'path';

// Keys that can be managed
const MANAGED_KEYS = [
  { key: 'NEXT_PUBLIC_SUPABASE_URL', label: 'رابط Supabase', secret: false, validate: 'database' },
  { key: 'SESSION_SECRET', label: 'مفتاح الجلسة', secret: true, validate: 'session' },
  { key: 'ADMIN_EMAIL', label: 'بريد المدير', secret: false, validate: 'email' },
];

function maskValue(value: string, isSecret: boolean): string {
  if (!value) return 'غير محدد';
  if (!isSecret) return value;
  if (value.length <= 8) return '****';
  return value.slice(0, 4) + '****' + value.slice(-4);
}

function validateKey(key: string, value: string): { valid: boolean; message: string } {
  const config = MANAGED_KEYS.find(k => k.key === key);
  if (!config) return { valid: false, message: 'مفتاح غير معروف' };

  switch (config.validate) {
    case 'database': {
      // Check if it's a valid Supabase URL (https://xxx.supabase.co)
      const isSupabaseUrl = value.startsWith('https://') && value.includes('supabase');
      if (isSupabaseUrl) {
        return { valid: true, message: 'رابط Supabase صالح' };
      }
      // Also accept any valid PostgreSQL connection string
      if (value.startsWith('postgresql://') || value.startsWith('postgres://')) {
        return { valid: true, message: 'رابط PostgreSQL صالح' };
      }
      return { valid: false, message: 'رابط Supabase غير صالح' };
    }
    case 'session': {
      const valid = value.length >= 32;
      return {
        valid,
        message: valid ? 'المفتاح صالح (32+ حرف)' : `المفتاح قصير جداً (${value.length}/32)`,
      };
    }
    case 'email': {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const valid = emailRegex.test(value);
      return { valid, message: valid ? 'بريد صالح' : 'بريد غير صالح' };
    }
    default:
      return { valid: true, message: 'تم التعيين' };
  }
}

export const GET = withRoute(async (request: NextRequest) => {
  const admin = await requireAdmin(request);
  if (!admin.success) return admin.response;

  // Only primary admin can view keys
  const adminEmail = getAdminEmail();
  if (!adminEmail || admin.email !== adminEmail) {
    return forbidden('هذا الإجراء متاح فقط للمشرف الرئيسي');
  }

  try {
    // Also verify Supabase connectivity
    let dbConnected = false;
    try {
      const sb = getSupabaseAdmin();
      await sb.from(TABLES.USERS).select('id', { count: 'exact', head: true });
      dbConnected = true;
    } catch {
      dbConnected = false;
    }

    const keys = MANAGED_KEYS.map(config => {
      const value = process.env[config.key] || '';
      const masked = maskValue(value, config.secret);
      const validation = validateKey(config.key, value);

      return {
        key: config.key,
        label: config.label,
        displayValue: masked,
        isSet: !!value,
        isValid: validation.valid,
        validationMessage: validation.message,
        isSecret: config.secret,
      };
    });

    return success({ keys, dbProvider: 'supabase', dbConnected });
  } catch (error) {
    logger.error('System keys GET error', 'SystemKeys', { error: (error as Error)?.message });
    return serverError('حدث خطأ أثناء جلب المفاتيح');
  }
});

export const PUT = withRoute(async (request: NextRequest) => {
  const admin = await requireAdmin(request);
  if (!admin.success) return admin.response;

  const adminEmail = getAdminEmail();
  if (!adminEmail || admin.email !== adminEmail) {
    return forbidden('هذا الإجراء متاح فقط للمشرف الرئيسي');
  }

  try {
    const body = await request.json();
    const { key, value } = body as { key?: string; value?: string };

    if (!key || !MANAGED_KEYS.find(k => k.key === key)) {
      return badRequest('اسم المفتاح غير صالح');
    }

    if (typeof value !== 'string') {
      return badRequest('قيمة المفتاح مطلوبة');
    }

    // Update .env file
    const envPath = path.join(process.cwd(), '.env');
    let envContent = '';
    
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf-8');
    }

    // Check if key already exists in .env
    const keyRegex = new RegExp(`^${key}=.*$`, 'm');
    if (keyRegex.test(envContent)) {
      // Replace existing
      envContent = envContent.replace(keyRegex, `${key}=${value}`);
    } else {
      // Append
      envContent += `\n${key}=${value}`;
    }

    fs.writeFileSync(envPath, envContent, 'utf-8');

    // Update runtime process.env (for current session)
    process.env[key] = value;

    // Validate the new value
    const validation = validateKey(key, value);

    return success({
      key,
      isValid: validation.valid,
      validationMessage: validation.message,
      restarted: false, // Manual restart needed for full effect
    });
  } catch (error) {
    logger.error('System keys PUT error', 'SystemKeys', { error: (error as Error)?.message });
    return serverError('حدث خطأ أثناء تحديث المفتاح');
  }
});
