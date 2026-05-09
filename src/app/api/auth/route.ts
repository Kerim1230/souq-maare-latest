export const runtime = 'nodejs'
import { NextRequest } from 'next/server';
import { badRequest, unauthorized, serverError, success, ok, forbidden } from '@/lib/api-response';
import { logger } from '@/lib/logger';
import { withRoute } from '@/server/lib/route-wrapper';
import { sanitizeAndValidate } from '@/utils/validation';
import { getSessionUserId, clearSessionCookie } from '@/lib/session';
import { findUserById, updateUser } from '@/lib/supabase-db';

/** Map Supabase user row to API response format (snake_case) */
function mapUser(user: {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  city: string | null;
  created_at: string;
  is_admin: boolean;
}) {
  return {
    id: user.id,
    email: user.email,
    full_name: user.full_name ?? null,
    avatar_url: user.avatar_url ?? null,
    phone: user.phone ?? null,
    city: user.city ?? null,
    created_at: user.created_at ?? null,
    is_admin: user.is_admin ?? false,
    role: user.is_admin ? 'admin' : 'user',
  };
}

// GET /api/auth — جلب الجلسة الحالية (JWT session cookie)
export const GET = withRoute(async (request: NextRequest) => {
  try {
    const userId = await getSessionUserId(request);

    if (!userId) {
      const res = ok({ user: null });
      return res;
    }

    // Look up Supabase public.users by ID
    const user = await findUserById(userId).catch(() => null);

    if (!user) {
      const res = ok({ user: null });
      return res;
    }

    const res = ok({ user: mapUser(user) });
    return res;
  } catch (error: unknown) {
    logger.error('Auth session GET error', 'Auth', { error: (error as Error)?.message });
    return serverError('حدث خطأ أثناء جلب الجلسة');
  }
})

// POST /api/auth — DISABLED: Session fixation risk
export const POST = withRoute(async () => {
  return forbidden('هذا المسار معطّل. استخدم تسجيل الدخول بالبريد الإلكتروني وكلمة السر.');
})

// PUT /api/auth — تحديث بيانات المستخدم (JWT session cookie)
export const PUT = withRoute(async (request: NextRequest) => {
  try {
    const userId = await getSessionUserId(request);
    if (!userId) {
      return unauthorized('يجب تسجيل الدخول أولاً');
    }

    const user = await findUserById(userId).catch(() => null);
    if (!user) {
      return unauthorized('المستخدم غير موجود');
    }

    const body = await request.json();
    const { full_name, avatar_url, phone, city } = body;

    const updateData: Record<string, unknown> = {};
    if (full_name !== undefined) {
      const nameCheck = sanitizeAndValidate(full_name, 100, 'الاسم');
      if (!nameCheck.valid) return badRequest(nameCheck.error!);
      updateData.full_name = nameCheck.value!;
    }
    if (avatar_url !== undefined) {
      const url = String(avatar_url).trim();
      if (url.length > 500) return badRequest('رابط الصورة طويل جداً');
      updateData.avatar_url = url;
    }
    if (phone !== undefined) {
      const phoneCheck = sanitizeAndValidate(phone, 20, 'رقم الهاتف');
      if (!phoneCheck.valid) return badRequest(phoneCheck.error!);
      updateData.phone = phoneCheck.value!;
    }
    if (city !== undefined) {
      const cityCheck = sanitizeAndValidate(city, 100, 'المدينة');
      if (!cityCheck.valid) return badRequest(cityCheck.error!);
      updateData.city = cityCheck.value!;
    }

    const updatedUser = await updateUser(user.id, updateData);

    const res = ok({ user: mapUser(updatedUser) });
    return res;
  } catch (error: unknown) {
    logger.error('Auth PUT error', 'Auth', { error: (error as Error)?.message });
    return serverError('حدث خطأ أثناء تحديث البيانات');
  }
})

// DELETE /api/auth — تسجيل الخروج (مسح JWT session cookie)
export const DELETE = withRoute(async () => {
  try {
    const res = success(null);
    clearSessionCookie(res);
    return res;
  } catch (error: unknown) {
    logger.error('Auth DELETE error', 'Auth', { error: (error as Error)?.message });
    const res = success(null);
    clearSessionCookie(res);
    return res;
  }
})
