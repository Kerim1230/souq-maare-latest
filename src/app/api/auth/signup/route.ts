export const runtime = 'nodejs'
import { NextRequest } from 'next/server';
import { validateEmail, validatePassword, sanitizeAndValidate } from '@/utils/validation';
import { logger } from '@/lib/logger';
import { withRoute } from '@/server/lib/route-wrapper';
import { checkRateLimit, getClientIp, LIMITS } from '@/server/lib/rate-limiter';
import { badRequest, conflict, serverError, created, rateLimited } from '@/lib/api-response';
import { setSessionCookie } from '@/lib/session';
import {
  findUserByEmailSafe,
  findUserById,
  findWalletByUserId,
  createUser,
  createWallet,
  updateUser,
  getSupabaseAdmin,
} from '@/lib/supabase-db';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Try to disable the handle_new_user trigger that causes signup failures.
 * The trigger tries to insert into public.users when auth.users is created,
 * but it references columns that may not exist (e.g., `role`), causing the
 * entire auth.users insert to roll back.
 */
async function disableNewUserTrigger(): Promise<boolean> {
  try {
    const supabase = createAdminClient();
    // Use admin SQL to disable the trigger
    const { error } = await supabase.rpc('exec_sql', {
      query: 'ALTER TABLE auth.users DISABLE TRIGGER on_auth_user_created;',
    });
    if (error) {
      logger.warn('Could not disable trigger via RPC (may not exist)', 'Signup', { error: error.message });
      return false;
    }
    logger.info('Disabled on_auth_user_created trigger', 'Signup');
    return true;
  } catch {
    return false;
  }
}

export const POST = withRoute(async (request: NextRequest) => {
  try {
    const ip = getClientIp(request);
    const rl = checkRateLimit(`auth:signup:${ip}`, LIMITS.signup);
    if (!rl.success) return rateLimited('طلبات إنشاء حساب كثيرة. حاول بعد دقيقة');

    const body = await request.json();
    const { email, password, fullName, referrer } = body as { email?: string; password?: string; fullName?: string; referrer?: string };

    // ── Validation ──
    if (!email) return badRequest('البريد الإلكتروني مطلوب');
    const normalizedEmail = email.toLowerCase().trim();
    if (!validateEmail(normalizedEmail)) return badRequest('صيغة البريد الإلكتروني غير صحيحة');
    if (!password) return badRequest('كلمة المرور مطلوبة');
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) return badRequest(passwordValidation.error!);
    if (fullName) {
      const nameCheck = sanitizeAndValidate(fullName, 50, 'الاسم');
      if (!nameCheck.valid) return badRequest(nameCheck.error!);
    }

    // ── Check for existing user ──
    const existingUser = await findUserByEmailSafe(normalizedEmail);
    if (existingUser) return conflict('هذا البريد الإلكتروني مسجل مسبقاً');

    const displayName = fullName?.trim() || normalizedEmail.split('@')[0];
    const isAdmin = normalizedEmail === process.env.ADMIN_EMAIL;

    logger.info('Signup attempt', 'Signup', { email: normalizedEmail });

    // ── Create Auth User ──────────────────────────────────────────────
    const supabase = createAdminClient();
    let authUserId: string | null = null;

    // Attempt 1: Try admin.createUser directly
    try {
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: normalizedEmail,
        password,
        email_confirm: true,
      });

      if (authError) {
        const errMsg = authError.message || '';
        logger.warn('Auth createUser error', 'Signup', { error: errMsg });

        // If "Database error creating new user" → trigger is broken
        if (errMsg.includes('Database error')) {
          // Check if user was still created despite the error
          const { data: listData } = await supabase.auth.admin.listUsers();
          const found = listData?.users?.find(u => u.email === normalizedEmail);
          if (found) {
            authUserId = found.id;
            logger.info('Auth user found after trigger error', 'Signup', { authUserId });
          } else {
            // Attempt 2: Try disabling the trigger and retrying
            logger.info('Attempting to disable trigger and retry', 'Signup');
            const disabled = await disableNewUserTrigger();
            if (disabled) {
              const { data: retryData, error: retryError } = await supabase.auth.admin.createUser({
                email: normalizedEmail,
                password,
                email_confirm: true,
              });
              if (!retryError && retryData.user) {
                authUserId = retryData.user.id;
                logger.info('User created after disabling trigger', 'Signup', { authUserId });
              }
            }

            if (!authUserId) {
              return serverError(
                'تعذر إنشاء الحساب. ترايجر handle_new_user في Supabase يسبب مشكلة. ' +
                'يرجى تشغيل SQL التالي في Supabase SQL Editor:\n' +
                'DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;\n' +
                'DROP FUNCTION IF EXISTS public.handle_new_user();'
              );
            }
          }
        } else {
          // Other auth error (e.g., user already exists in auth)
          const { data: listData } = await supabase.auth.admin.listUsers();
          const found = listData?.users?.find(u => u.email === normalizedEmail);
          if (found) {
            authUserId = found.id;
          } else {
            return serverError('حدث خطأ في إنشاء حساب المصادقة: ' + errMsg);
          }
        }
      } else {
        authUserId = authData.user?.id || null;
      }
    } catch (err) {
      logger.error('Auth createUser exception', 'Signup', { error: err instanceof Error ? err.message : String(err) });
      return serverError('حدث خطأ أثناء إنشاء الحساب');
    }

    if (!authUserId) {
      return serverError('حدث خطأ أثناء إنشاء الحساب — لم يتم إنشاء معرف المستخدم');
    }

    // ── Create/Verify public.users record ──
    let user = await findUserById(authUserId).catch(() => null);

    if (!user) {
      try {
        user = await createUser({
          id: authUserId,
          email: normalizedEmail,
          full_name: displayName,
          is_admin: isAdmin,
        });
      } catch (createErr) {
        logger.warn('createUser failed, re-fetching', 'Signup', {
          error: createErr instanceof Error ? createErr.message : String(createErr),
        });
        user = await findUserById(authUserId).catch(() => null);
        if (!user) {
          return serverError('حدث خطأ أثناء إنشاء ملف المستخدم');
        }
      }
    }

    if (isAdmin && !user.is_admin) {
      user = await updateUser(authUserId, { is_admin: true });
    }

    // ── Create wallet ──
    const existingWallet = await findWalletByUserId(authUserId);
    if (!existingWallet) {
      await createWallet({ user_id: authUserId, balance: 0, total_used: 0, total_purchased: 0 }).catch(() => {});
    }

    // ── Referral tracking ──
    if (referrer) {
      try {
        // Prevent self-referral
        if (referrer !== authUserId) {
          // Verify referrer exists in users table
          const referrerUser = await findUserById(referrer).catch(() => null);
          if (referrerUser) {
            const sb = getSupabaseAdmin();
            await sb.from('referrals').insert({
              referrer_id: referrer,
              referred_email: normalizedEmail,
              referred_user_id: authUserId,
              status: 'registered',
            });
            logger.info('Referral record created', 'Signup', { referrer, referredUserId: authUserId });
          } else {
            logger.warn('Referrer not found in users table, skipping referral', 'Signup', { referrer });
          }
        } else {
          logger.warn('Self-referral attempt blocked', 'Signup', { userId: authUserId });
        }
      } catch (refErr) {
        // Referral tracking failure should not block signup
        logger.warn('Failed to create referral record (non-blocking)', 'Signup', {
          error: refErr instanceof Error ? refErr.message : String(refErr),
        });
      }
    }

    logger.info('Signup successful', 'Signup', { userId: user.id, email: normalizedEmail });

    const res = created({
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

    await setSessionCookie(res, user.id);
    return res;
  } catch (error) {
    logger.error('Signup error', 'Auth', { error: error instanceof Error ? error.message : String(error) });
    return serverError('حدث خطأ أثناء إنشاء الحساب');
  }
})
