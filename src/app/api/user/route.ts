export const runtime = 'nodejs'
import { withRoute } from '@/server/lib/route-wrapper';
import { NextRequest } from 'next/server';
import { findUserById, updateUser } from '@/lib/supabase-db';
import { requireAuth } from '@/server/lib/auth-guard';
import { checkRateGuard } from '@/server/lib/rate-guard';
import { badRequest, unauthorized, forbidden, serverError, success } from '@/lib/api-response';
import { logger } from '@/lib/logger';
import { validatePassword, validateId, sanitizeAndValidate } from '@/utils/validation';
import { createAdminClient } from '@/lib/supabase/admin';

// GET /api/user — Get current user's profile
export const GET = withRoute(async (request: NextRequest) => {
  try {
    const auth = await requireAuth(request);
    if (!auth.success) return auth.response;
    const sessionUserId = auth.userId;

    let user;
    try {
      user = await findUserById(sessionUserId);
    } catch {
      return unauthorized('المستخدم غير موجود');
    }

    return success({
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        avatar_url: user.avatar_url,
        phone: user.phone,
        city: user.city,
        is_admin: user.is_admin,
        created_at: user.created_at,
      },
    });
  } catch (err) {
    logger.warn('User profile fetch failed', 'User', { error: (err as Error)?.message });
    return serverError('حدث خطأ أثناء جلب بيانات المستخدم');
  }
})

export const PUT = withRoute(async (request: NextRequest) => {
  try {
    const rl = checkRateGuard(request, { category: 'mutation' });
    if (rl) return rl;

    // ── Auth check ──
    const auth = await requireAuth(request);
    if (!auth.success) return auth.response;
    const sessionUserId = auth.userId;

    const body = await request.json();
    const { userId, full_name, avatar_url, phone, city, currentPassword, newPassword } = body;

    const userIdCheck = validateId(userId, 'معرف المستخدم');
    if (!userIdCheck.valid) return badRequest(userIdCheck.error!);

    // ── Ownership verification ──
    if (userId !== sessionUserId) {
      return forbidden('غير مصرح بتعديل بيانات مستخدم آخر');
    }

    // ── Build update data ──
    const supabaseUpdate: Record<string, string | null> = {};
    if (full_name !== undefined) {
      const trimmedName = String(full_name).trim();
      if (!trimmedName) return badRequest('الاسم مطلوب');
      const nameCheck = sanitizeAndValidate(trimmedName, 100, 'الاسم');
      if (!nameCheck.valid) return badRequest(nameCheck.error!);
      supabaseUpdate.full_name = nameCheck.value!;
    }
    if (avatar_url !== undefined) {
      const url = String(avatar_url).trim();
      if (url.length > 500) return badRequest('رابط الصورة طويل جداً');
      supabaseUpdate.avatar_url = url || null;
    }
    if (phone !== undefined) {
      const trimmedPhone = String(phone).trim();
      if (trimmedPhone) {
        const phoneCheck = sanitizeAndValidate(trimmedPhone, 20, 'رقم الهاتف');
        if (!phoneCheck.valid) return badRequest(phoneCheck.error!);
        supabaseUpdate.phone = phoneCheck.value!;
      } else {
        supabaseUpdate.phone = null;
      }
    }
    if (city !== undefined) {
      const trimmedCity = String(city).trim();
      if (trimmedCity) {
        const cityCheck = sanitizeAndValidate(trimmedCity, 100, 'المدينة');
        if (!cityCheck.valid) return badRequest(cityCheck.error!);
        supabaseUpdate.city = cityCheck.value!;
      } else {
        supabaseUpdate.city = null;
      }
    }

    // Password change — uses Supabase Auth
    if (newPassword) {
      if (!currentPassword) {
        return badRequest('كلمة المرور الحالية مطلوبة لتغييرها');
      }
      const pwValidation = validatePassword(newPassword);
      if (!pwValidation.valid) {
        return badRequest(pwValidation.error || 'كلمة المرور غير صالحة');
      }

      // Verify current password via Supabase Auth
      try {
        const { createClient } = await import('@supabase/supabase-js');
        const authClient = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        );

        // First verify current credentials
        const { error: verifyError } = await authClient.auth.signInWithPassword({
          email: (await findUserById(userId)).email,
          password: currentPassword,
        });

        if (verifyError) {
          return unauthorized('كلمة المرور الحالية غير صحيحة');
        }

        // Update password via admin client
        const supabase = createAdminClient();
        const { error: updateError } = await supabase.auth.admin.updateUserById(
          userId,
          { password: newPassword }
        );

        if (updateError) {
          logger.error('Supabase password update failed', 'User', { error: updateError.message, userId });
          return serverError('حدث خطأ أثناء تحديث كلمة المرور');
        }

        logger.info('Password updated via Supabase Auth', 'User', { userId });
      } catch (err) {
        logger.error('Password change error', 'User', { error: (err as Error)?.message, userId });
        return badRequest('لا يمكن تغيير كلمة المرور لهذا الحساب');
      }
    }

    const updatedUser = await updateUser(userId, supabaseUpdate);

    return success({
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        full_name: updatedUser.full_name,
        avatar_url: updatedUser.avatar_url,
        phone: updatedUser.phone,
        city: updatedUser.city,
        created_at: updatedUser.created_at,
      },
    });
  } catch (error) {
    logger.error('User update error', 'User', { error: (error as Error)?.message });
    return serverError('حدث خطأ أثناء تحديث بيانات المستخدم');
  }
})
