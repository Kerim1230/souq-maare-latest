export const runtime = 'nodejs'
import { NextRequest } from 'next/server';
import { getSupabaseAdmin, handleResponse, TABLES } from '@/lib/supabase-db';
import { requireAdmin } from '@/server/lib/admin-auth';
import { success, forbidden } from '@/lib/api-response';
import { withRoute } from '@/server/lib/route-wrapper';

// Map a Supabase wallet row to the expected response format (keyed by userId)
function mapWallet(w: any) {
  return {
    userId: w.user_id,
    balance: w.balance ?? 0,
    totalUsed: w.total_used ?? 0,
    totalPurchased: w.total_purchased ?? 0,
  };
}

// GET /api/points/wallets — returns all wallets (admin-only)
export const GET = withRoute(async (request: NextRequest) => {
  try {
    const auth = await requireAdmin(request);
    if (!auth.success) return auth.response;

    const sb = getSupabaseAdmin();
    const wallets = handleResponse(
      await sb.from(TABLES.WALLET).select('*'),
      'GET /api/points/wallets'
    );

    const result: Record<string, ReturnType<typeof mapWallet>> = {};
    for (const w of wallets) {
      result[w.user_id] = mapWallet(w);
    }

    return success({ wallets: result });
  } catch {
    return forbidden();
  }
});
