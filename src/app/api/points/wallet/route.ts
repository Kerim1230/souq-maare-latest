export const runtime = 'nodejs'
import { NextRequest } from 'next/server';
import { getSupabaseAdmin, findWalletByUserId, upsertWallet, createPointTransaction, handleResponse, TABLES } from '@/lib/supabase-db';
import { checkRateLimit, getClientIp, LIMITS } from '@/server/lib/rate-limiter';
import { rateLimited, badRequest, serverError, success } from '@/lib/api-response';
import { requireAuth } from '@/server/lib/auth-guard';
import { sanitizeString } from '@/server/lib/sanitize';
import { logger } from '@/lib/logger';
import { withRoute } from '@/server/lib/route-wrapper';

// Map a Supabase wallet row to the expected response format
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

// POST /api/points/wallet — add/deduct points for the authenticated user
export const POST = withRoute(async (request: NextRequest) => {
  try {
    const ip = getClientIp(request);
    const rl = checkRateLimit(`points:wallet:${ip}`, LIMITS.points);
    if (!rl.success) return rateLimited();

    const auth = await requireAuth(request);
    if (!auth.success) return auth.response;
    const userId = auth.userId;

    const body = await request.json();
    const { amount, description, type } = body as {
      amount: number;
      description: string;
      type: string;
    };

    if (!amount || !description || !type) {
      return badRequest('Missing required fields');
    }

    const sanitizedDescription = sanitizeString(description, 500);
    const sb = getSupabaseAdmin();
    const isPurchaseType = type === 'purchase' || type === 'admin_add' || type === 'welcome_bonus';

    let wallet;
    if (amount > 0) {
      // Add points — sequential: upsert wallet, then create transaction
      wallet = await findWalletByUserId(userId);
      if (!wallet) {
        wallet = await upsertWallet({
          user_id: userId,
          balance: amount,
          total_used: 0,
          total_purchased: isPurchaseType ? amount : 0,
        });
      } else {
        const newBalance = (wallet.balance ?? 0) + amount;
        const newTotalPurchased = (wallet.total_purchased ?? 0) + (isPurchaseType ? amount : 0);
        const { data: updatedWallet, error: walletError } = await sb.from(TABLES.WALLET)
          .update({ balance: newBalance, total_purchased: newTotalPurchased })
          .eq('id', wallet.id)
          .select()
          .single();
        if (walletError) throw new Error(walletError.message);
        wallet = updatedWallet;
      }

      const transaction = await createPointTransaction({
        wallet_id: wallet.id,
        user_id: userId,
        amount,
        type,
        description: sanitizedDescription,
      });

      return success({ wallet: mapWallet(wallet), transaction: mapTransaction(transaction) });
    } else {
      // Deduct points — sequential: upsert wallet, floor balance at 0, then create transaction
      const deductAmount = Math.abs(amount);
      wallet = await findWalletByUserId(userId);
      if (!wallet) {
        wallet = await upsertWallet({
          user_id: userId,
          balance: 0,
          total_used: deductAmount,
          total_purchased: 0,
        });
      } else {
        let newBalance = (wallet.balance ?? 0) - deductAmount;
        // Floor balance at 0
        if (newBalance < 0) newBalance = 0;
        const newTotalUsed = (wallet.total_used ?? 0) + deductAmount;
        const { data: updatedWallet, error: walletError } = await sb.from(TABLES.WALLET)
          .update({ balance: newBalance, total_used: newTotalUsed })
          .eq('id', wallet.id)
          .select()
          .single();
        if (walletError) throw new Error(walletError.message);
        wallet = updatedWallet;
      }

      const transaction = await createPointTransaction({
        wallet_id: wallet.id,
        user_id: userId,
        amount: -deductAmount,
        type,
        description: sanitizedDescription,
      });

      return success({ wallet: mapWallet(wallet), transaction: mapTransaction(transaction) });
    }
  } catch (error) {
    logger.error('Points wallet POST error', 'PointsWallet', { error: (error as Error)?.message });
    return serverError('Failed to update wallet');
  }
})
