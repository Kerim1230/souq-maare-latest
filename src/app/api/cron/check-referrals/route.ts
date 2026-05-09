export const runtime = 'nodejs'
import { NextRequest } from 'next/server';
import { withRoute } from '@/server/lib/route-wrapper';
import { requireAdmin } from '@/server/lib/admin-auth';
import { getSupabaseAdmin, TABLES, handleResponse } from '@/lib/supabase-db';
import { addPoints } from '@/server/lib/pointsData';
import { success, serverError } from '@/lib/api-response';
import { logger } from '@/lib/logger';

const REFERRAL_BONUS_POINTS = 5;

/**
 * GET /api/cron/check-referrals — CRON job to activate and reward referrals
 * Checks registered referrals: if the referred user has logged in within
 * 24 hours of registration, mark as active and reward the referrer.
 */
export const GET = withRoute(async (_request: NextRequest) => {
  // Allow Vercel Cron requests (x-vercel-cron header) or CRON_SECRET, plus admin auth as fallback
  const isCronRequest = _request.headers.get('x-vercel-cron') === 'true'
    || _request.headers.get('authorization') === `Bearer ${process.env.CRON_SECRET}`;
  if (!isCronRequest) {
    const admin = await requireAdmin(_request);
    if (!admin.success) return admin.response;
  }

  try {
    const sb = getSupabaseAdmin();

    // Find all referrals that haven't been rewarded yet
    const pendingReferrals = handleResponse(
      await sb.from(TABLES.REFERRALS)
        .select('*')
        .in('status', ['registered', 'active'])
        .is('rewarded_at', null),
      'CRON check-referrals fetch'
    );

    let activated = 0;
    let rewarded = 0;
    let errors = 0;

    for (const referral of pendingReferrals) {
      try {
        if (!referral.referred_user_id) continue; // No user linked yet

        // Get the referred user's auth data to check last_sign_in_at
        const { data: authUserData, error: authError } = await sb.auth.admin.getUserById(referral.referred_user_id);

        if (authError || !authUserData?.user) {
          logger.warn('Could not fetch auth user for referral', 'CheckReferrals', {
            referralId: referral.id,
            error: authError?.message,
          });
          continue;
        }

        const authUser = authUserData.user;
        const lastSignIn = authUser.last_sign_in_at;
        const createdAt = new Date(referral.created_at);

        // Check if the user has logged in within 24 hours of registration
        if (lastSignIn) {
          const lastSignInDate = new Date(lastSignIn);
          const hoursSinceCreation = (lastSignInDate.getTime() - createdAt.getTime()) / (1000 * 60 * 60);

          if (hoursSinceCreation <= 24) {
            // User is active — update status to 'active' if still 'registered'
            const newStatus = referral.status === 'registered' ? 'active' : referral.status;
            const updateData: Record<string, unknown> = { status: newStatus };

            if (!referral.activated_at) {
              updateData.activated_at = new Date().toISOString();
            }

            // Reward the referrer if not yet rewarded
            if (!referral.rewarded_at) {
              try {
                await addPoints(
                  referral.referrer_id,
                  REFERRAL_BONUS_POINTS,
                  `مكافأة إحالة نشطة - ${REFERRAL_BONUS_POINTS} نقاط`,
                  'referral_bonus',
                );

                updateData.rewarded_at = new Date().toISOString();
                updateData.status = 'rewarded';
                rewarded++;

                logger.info('Referral rewarded', 'CheckReferrals', {
                  referralId: referral.id,
                  referrerId: referral.referrer_id,
                  points: REFERRAL_BONUS_POINTS,
                });
              } catch (pointsErr) {
                logger.error('Failed to add referral bonus points', 'CheckReferrals', {
                  referralId: referral.id,
                  error: (pointsErr as Error)?.message,
                });
                errors++;
                // Don't update status if points failed — will retry next run
                delete updateData.rewarded_at;
                delete updateData.status;
              }
            }

            if (referral.status === 'registered') {
              activated++;
            }

            // Only update if there are fields to update
            if (Object.keys(updateData).length > 0) {
              await sb.from(TABLES.REFERRALS)
                .update(updateData)
                .eq('id', referral.id);
            }
          }
        }
      } catch (referralErr) {
        logger.error('Error processing referral', 'CheckReferrals', {
          referralId: referral.id,
          error: (referralErr as Error)?.message,
        });
        errors++;
      }
    }

    logger.info('Referral check complete', 'CheckReferrals', {
      total: pendingReferrals.length,
      activated,
      rewarded,
      errors,
    });

    return success({
      processed: pendingReferrals.length,
      activated,
      rewarded,
      errors,
    });
  } catch (error) {
    logger.error('CRON check-referrals failed', 'CheckReferrals', { error: (error as Error)?.message });
    return serverError('حدث خطأ أثناء فحص الإحالات');
  }
});
