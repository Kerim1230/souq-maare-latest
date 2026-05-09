export const runtime = 'nodejs'
import { NextRequest } from 'next/server';
import { withRoute } from '@/server/lib/route-wrapper';
import { requireAuth } from '@/server/lib/auth-guard';
import { getSupabaseAdmin, TABLES, handleResponse } from '@/lib/supabase-db';
import { success, serverError } from '@/lib/api-response';
import { logger } from '@/lib/logger';

/**
 * GET /api/referrals — fetch current user's referrals + stats
 */
export const GET = withRoute(async (request: NextRequest) => {
  const auth = await requireAuth(request);
  if (!auth.success) return auth.response;
  const userId = auth.userId;

  try {
    const sb = getSupabaseAdmin();

    const referrals = handleResponse(
      await sb.from(TABLES.REFERRALS)
        .select('*')
        .eq('referrer_id', userId)
        .order('created_at', { ascending: false }),
      'GET /api/referrals'
    );

    const total = referrals.length;
    const active = referrals.filter((r: any) => r.status === 'active').length;
    const rewarded = referrals.filter((r: any) => r.status === 'rewarded').length;
    const totalPointsEarned = rewarded * 5; // 5 points per rewarded referral

    return success({
      referrals: referrals.map((r: any) => ({
        id: r.id,
        referrerId: r.referrer_id,
        referredEmail: r.referred_email,
        referredUserId: r.referred_user_id,
        status: r.status,
        createdAt: r.created_at,
        activatedAt: r.activated_at,
        rewardedAt: r.rewarded_at,
      })),
      stats: { total, active, rewarded, totalPointsEarned },
    });
  } catch (error) {
    logger.error('Failed to fetch referrals', 'Referrals', { error: (error as Error)?.message });
    return serverError('حدث خطأ أثناء جلب بيانات الإحالة');
  }
});
