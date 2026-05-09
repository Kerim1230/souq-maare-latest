export const runtime = 'nodejs'
import { NextRequest } from 'next/server';
import { validateEmail } from '@/utils/validation';
import { logger } from '@/lib/logger';
import { withRoute } from '@/server/lib/route-wrapper';
import { checkRateLimit, getClientIp, LIMITS } from '@/server/lib/rate-limiter';
import { badRequest, unauthorized, serverError, success, rateLimited } from '@/lib/api-response';
import { setSessionCookie } from '@/lib/session';
import { findUserByEmailSafe, findUserById } from '@/lib/supabase-db';

export const POST = withRoute(async (request: NextRequest) => {
  try {
    const ip = getClientIp(request);
    const rl = checkRateLimit(`auth:signin:${ip}`, LIMITS.auth);
    if (!rl.success) return rateLimited('طلبات تسجيل دخول كثيرة. حاول بعد دقيقة');

    const body = await request.json();
    const { email, password } = body as { email?: string; password?: string };

    if (!email) {
      return badRequest('البريد الإلكتروني مطلوب');
    }
    const normalizedEmail = email.toLowerCase().trim();
    if (!validateEmail(normalizedEmail)) {
      return badRequest('صيغة البريد الإلكتروني غير صحيحة');
    }
    if (!password) {
      return badRequest('كلمة المرور مطلوبة');
    }

    // Note: Password format validation (min length, etc.) is only enforced at signup.
    // Signin should just verify credentials via Supabase Auth — existing users
    // with shorter passwords must not be locked out.

    // ── Supabase Auth Signin ───────────────────────────────────────
    logger.info('Signin attempt', 'Signin', { email: normalizedEmail });

    let user: {
      id: string;
      email: string;
      full_name: string | null;
      avatar_url: string | null;
      phone: string | null;
      city: string | null;
      created_at: string;
      is_admin: boolean;
    };

    // ── Supabase Auth Signin ───────────────────────────────────────
    // We verify credentials via Supabase Auth. The admin client can't
    // use signInWithPassword, so we use a non-admin client for auth verification.

    // First, look up the user in public.users to check if they exist
    const existingUser = await findUserByEmailSafe(normalizedEmail);
    if (!existingUser) {
      logger.warn('Signin failed — user not found', 'Signin', { email: normalizedEmail });
      return unauthorized('بريد إلكتروني أو كلمة مرور غير صحيحة');
    }

    // Verify password via Supabase Auth by listing users and checking
    // Since we can't use signInWithPassword with admin client,
    // we verify using the anon key client or fall back to checking the auth user
    try {
      // Try to verify credentials with Supabase Auth
      const { createClient } = await import('@supabase/supabase-js');
      const authClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      );
      const { data: authData, error: authError } = await authClient.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

      if (authError || !authData.user) {
        logger.warn('Signin failed — Supabase Auth rejected credentials', 'Signin', {
          email: normalizedEmail,
          error: authError?.message,
        });
        return unauthorized('بريد إلكتروني أو كلمة مرور غير صحيحة');
      }

      // Auth succeeded — get profile from public.users
      const profile = await findUserById(authData.user.id).catch(() => null);
      if (!profile) {
        logger.warn('Signin failed — public.users not found for auth user', 'Signin', {
          email: normalizedEmail,
          authUserId: authData.user.id,
        });
        return unauthorized('بريد إلكتروني أو كلمة مرور غير صحيحة');
      }
      user = profile;
    } catch (authErr) {
      logger.warn('Supabase Auth unavailable, checking local credentials', 'Signin', {
        error: authErr instanceof Error ? authErr.message : String(authErr),
      });

      // If Supabase Auth is unavailable, deny login (no local passwords anymore)
      return unauthorized('بريد إلكتروني أو كلمة مرور غير صحيحة');
    }

    logger.info('Signin successful', 'Signin', { userId: user.id, email: normalizedEmail });

    const res = success({
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name ?? null,
        avatar_url: user.avatar_url ?? null,
        phone: user.phone ?? null,
        city: user.city ?? null,
        created_at: user.created_at ?? null,
        is_admin: user.is_admin ?? false,
        role: user.is_admin ? 'admin' : 'user',
      },
    });

    // Set JWT session cookie
    await setSessionCookie(res, user.id);

    return res;
  } catch (error) {
    logger.error('Signin error', 'Auth', { error: error instanceof Error ? error.message : String(error) });
    return serverError('حدث خطأ أثناء تسجيل الدخول');
  }
})
