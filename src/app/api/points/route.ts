export const runtime = 'nodejs'
import { NextRequest } from 'next/server';
import { getSupabaseAdmin, findWalletByUserId, upsertWallet, TABLES } from '@/lib/supabase-db';
import { requireAuth } from '@/server/lib/auth-guard';
import { requireAdmin } from '@/server/lib/admin-auth';
import { serverError, success } from '@/lib/api-response';
import { logger } from '@/lib/logger';
import { withRoute } from '@/server/lib/route-wrapper';

// Map a Supabase wallet row (snake_case) to the expected response format
function mapWallet(w: any) {
  return {
    userId: w.user_id,
    balance: w.balance ?? 0,
    totalUsed: w.total_used ?? 0,
    totalPurchased: w.total_purchased ?? 0,
  };
}

// Map a Supabase point_transaction row to the expected response format
function mapTransaction(t: any) {
  return {
    id: t.id,
    userId: t.user_id,
    type: t.type,
    amount: t.amount,
    description: t.description,
    createdAt: typeof t.created_at === 'string' ? t.created_at : t.created_at?.toISOString?.() ?? t.created_at,
  };
}

// GET /api/points — get wallet + transactions for a user
// ✅ FIX: Wallet data is ALWAYS returned even if transaction fetch fails.
// Previously, if point_transactions table had issues, the entire endpoint
// crashed and the frontend couldn't get the wallet balance — making it look
// like points were never deducted.
export const GET = withRoute(async (request: NextRequest) => {
  try {
    // Always authenticate first to get session userId
    const auth = await requireAuth(request);
    if (!auth.success) return auth.response;

    const sessionUserId = auth.userId;

    const { searchParams } = new URL(request.url);
    const userIdParam = searchParams.get('user_id');

    let userId: string;

    if (userIdParam && userIdParam !== sessionUserId) {
      // Cross-user lookup: require admin
      const admin = await requireAdmin(request);
      if (!admin.success) return admin.response;
      userId = userIdParam;
      logger.info('Admin cross-user wallet lookup', 'Points', { adminId: sessionUserId, targetUserId: userIdParam });
    } else {
      // Own wallet: use session userId (ignore matching user_id param)
      userId = sessionUserId;
    }

    const sb = getSupabaseAdmin();

    // ── STEP 1: Get or create wallet (CRITICAL — must succeed) ──
    let wallet;
    try {
      wallet = await findWalletByUserId(userId);
      if (!wallet) {
        wallet = await upsertWallet({ user_id: userId, balance: 0, total_used: 0, total_purchased: 0 });
      }
      console.log('[GET /api/points] Wallet fetched', { userId, balance: wallet?.balance });
    } catch (walletErr) {
      console.error('[GET /api/points] Wallet fetch FAILED', { userId, error: String(walletErr) });
      logger.error('Wallet fetch failed', 'Points', { userId, error: String(walletErr) });
      return serverError('فشل جلب بيانات المحفظة');
    }

    // ── STEP 2: Get transactions (NON-CRITICAL — must NOT block wallet response) ──
    // If the point_transactions table is missing or has issues, we still return
    // the wallet data. The frontend can function without transaction history.
    let transactions: any[] = [];
    try {
      const txResult = await sb.from(TABLES.POINT_TRANSACTIONS)
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (txResult.error) {
        console.warn('[GET /api/points] Transaction fetch failed (non-fatal)', { userId, error: txResult.error.message });
        logger.warn('Transaction fetch failed (returning wallet only)', 'Points', { userId, error: txResult.error.message });
      } else {
        transactions = (txResult.data || []).map(mapTransaction);
      }
    } catch (txErr) {
      console.warn('[GET /api/points] Transaction fetch threw (non-fatal)', { userId, error: String(txErr) });
      logger.warn('Transaction fetch threw (returning wallet only)', 'Points', { userId, error: String(txErr) });
    }

    logger.debug('Wallet fetched', 'Points', { userId, balance: wallet?.balance, txCount: transactions.length });

    return success({ wallet: mapWallet(wallet), transactions });
  } catch (error) {
    logger.error('Points GET error', 'Points', { error: (error as Error)?.message });
    return serverError('Failed to fetch points data');
  }
})
