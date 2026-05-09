/**
 * Points Data Layer — Supabase Implementation
 *
 * Replaces the old Prisma-based pointsData module that was
 * removed during the SQLite → Supabase migration.
 *
 * Provides server-side wallet operations (getWallet, deductPoints, addPoints)
 * using the Supabase admin client directly — no HTTP API calls needed.
 *
 * IMPORTANT: Wallet balance updates are the source of truth.
 * Transaction logging (createPointTransaction) is best-effort and non-fatal —
 * a failure to log a transaction must NOT abort the wallet update.
 */

import {
  getSupabaseAdmin,
  findWalletByUserId,
  upsertWallet,
  createPointTransaction,
  TABLES,
} from '@/lib/supabase-db';
import { logger } from '@/lib/logger';

// ── Types ──────────────────────────────────────────────────────────────

export interface WalletData {
  id: string;
  userId: string;
  balance: number;
  totalUsed: number;
  totalPurchased: number;
}

type TransactionType = 'admin_add' | 'purchase' | 'verification' | 'share_reward' | 'admin_deduct' | 'verification_deduct' | string;

// ── Helpers ────────────────────────────────────────────────────────────

function mapWallet(w: Record<string, unknown>): WalletData {
  return {
    id: w.id as string,
    userId: w.user_id as string,
    balance: (w.balance as number) ?? 0,
    totalUsed: (w.total_used as number) ?? 0,
    totalPurchased: (w.total_purchased as number) ?? 0,
  };
}

// ── getWallet ──────────────────────────────────────────────────────────

/**
 * Fetch a user's wallet. Creates one with zero balance if it doesn't exist.
 *
 * @param userId - The user's ID
 * @returns WalletData with balance and metadata
 */
export async function getWallet(userId: string): Promise<WalletData> {
  let wallet = await findWalletByUserId(userId);

  if (!wallet) {
    wallet = await upsertWallet({
      user_id: userId,
      balance: 0,
      total_used: 0,
      total_purchased: 0,
    });
  }

  return mapWallet(wallet as Record<string, unknown>);
}

// ── addPoints ──────────────────────────────────────────────────────────

/**
 * Add points to a user's wallet and record the transaction.
 * Returns the new balance after the operation.
 *
 * @param userId      - The user's ID
 * @param amount      - Positive number of points to add
 * @param description - Human-readable description (Arabic)
 * @param type        - Transaction type (e.g. 'admin_add', 'purchase', 'share_reward')
 */
export async function addPoints(
  userId: string,
  amount: number,
  description: string,
  type: TransactionType = 'admin_add',
): Promise<number> {
  console.log('[PointsData] addPoints START', { userId, amount, type, description });

  if (amount <= 0) {
    logger.warn('addPoints called with non-positive amount', 'PointsData', { userId, amount });
    console.log('[PointsData] addPoints SKIPPED — non-positive amount');
    return 0;
  }

  const sb = getSupabaseAdmin();
  const isPurchaseType = type === 'purchase' || type === 'admin_add' || type === 'welcome_bonus';

  console.log('[PointsData] addPoints: Finding wallet for user', { userId });
  let wallet = await findWalletByUserId(userId);

  if (!wallet) {
    console.log('[PointsData] addPoints: No wallet found, creating new wallet', { userId, amount });
    wallet = await upsertWallet({
      user_id: userId,
      balance: amount,
      total_used: 0,
      total_purchased: isPurchaseType ? amount : 0,
    });
    console.log('[PointsData] addPoints: Wallet created', { walletId: wallet?.id });
  } else {
    const newBalance = (wallet.balance as number ?? 0) + amount;
    const newTotalPurchased = (wallet.total_purchased as number ?? 0) + (isPurchaseType ? amount : 0);
    console.log('[PointsData] addPoints: Updating existing wallet', { walletId: wallet.id, oldBalance: wallet.balance, newBalance, newTotalPurchased });

    const { data: updatedWallet, error: walletError } = await sb
      .from(TABLES.WALLET)
      .update({ balance: newBalance, total_purchased: newTotalPurchased })
      .eq('id', wallet.id)
      .select()
      .single();

    if (walletError) {
      console.error('[PointsData] addPoints: Wallet update FAILED', { error: walletError.message, userId });
      logger.error('addPoints wallet update failed', 'PointsData', { error: walletError.message, userId });
      throw new Error(`فشل تحديث المحفظة: ${walletError.message}`);
    }
    wallet = updatedWallet;
    console.log('[PointsData] addPoints: Wallet updated successfully', { newBalance: wallet?.balance });
  }

  // ── Transaction logging (non-fatal) ──
  // The wallet balance has already been updated above. If the transaction
  // log fails, we must NOT throw — that would mislead the caller into
  // thinking the wallet wasn't updated when it actually was.
  try {
    console.log('[PointsData] addPoints: Creating point transaction', { walletId: wallet.id, amount, type });
    await createPointTransaction({
      wallet_id: wallet.id as string,
      user_id: userId,
      amount,
      type,
      description,
    });
  } catch (txErr) {
    console.error('[PointsData] addPoints: Transaction log FAILED (non-fatal)', { error: String(txErr), userId, amount });
    logger.warn('addPoints: transaction log failed (wallet updated successfully)', 'PointsData', { userId, amount, error: String(txErr) });
  }

  const finalBalance = (wallet.balance as number) ?? 0;
  logger.info('Points added', 'PointsData', { userId, amount, type, newBalance: finalBalance });
  console.log('[PointsData] addPoints COMPLETE', { userId, amount, type, newBalance: finalBalance });
  return finalBalance;
}

// ── deductPoints ───────────────────────────────────────────────────────

/**
 * Deduct points from a user's wallet and record the transaction.
 * Throws an error if balance is insufficient (defense-in-depth).
 * Returns the new balance after the operation.
 *
 * IMPORTANT: The wallet balance update is the authoritative operation.
 * Transaction logging is best-effort — a failure to log must NOT abort
 * the deduction, as the balance has already been changed in the database.
 *
 * @param userId      - The user's ID
 * @param amount      - Positive number of points to deduct
 * @param description - Human-readable description (Arabic)
 * @param type        - Transaction type (e.g. 'verification_deduct', 'admin_deduct')
 * @returns New wallet balance after deduction
 */
export async function deductPoints(
  userId: string,
  amount: number,
  description: string,
  type: TransactionType = 'admin_deduct',
): Promise<number> {
  console.log('[PointsData] 💰 deductPoints START', { userId, amount, type, description });

  if (amount <= 0) {
    logger.warn('deductPoints called with non-positive amount', 'PointsData', { userId, amount });
    console.log('[PointsData] deductPoints SKIPPED — non-positive amount');
    return 0;
  }

  const sb = getSupabaseAdmin();

  // ── Step 0: Ensure wallet row exists (INSERT if missing, DO NOTHING if exists) ──
  // CRITICAL: We must NOT overwrite an existing wallet's balance!
  // Previously, `upsertWallet({ balance: 0 })` with `onConflict: 'user_id'`
  // would UPDATE the existing row and RESET balance to 0, causing ALL points
  // to be lost instead of just deducting `amount`.
  // Now we use `ignoreDuplicates: true` so that if a wallet already exists,
  // the INSERT is silently ignored and the existing balance is preserved.
  console.log('[PointsData] 💰 Step 0: Ensuring wallet row exists (insert-only, no overwrite)', { userId });
  try {
    const { error: insertError } = await sb
      .from(TABLES.WALLET)
      .upsert(
        { user_id: userId, balance: 0, total_used: 0, total_purchased: 0 },
        { onConflict: 'user_id', ignoreDuplicates: true },
      );
    if (insertError) {
      console.error('[PointsData] 💰 Step 0: Insert-if-missing FAILED', { error: insertError.message, userId });
      // Don't throw — the wallet might already exist. We'll try the fetch + UPDATE anyway.
    } else {
      console.log('[PointsData] 💰 Step 0: Insert-if-missing succeeded — wallet row guaranteed to exist');
    }
  } catch (step0Err) {
    console.error('[PointsData] 💰 Step 0: Insert-if-missing threw (will attempt to continue)', { error: String(step0Err), userId });
  }

  // ── Step A: Fetch the wallet (now guaranteed to exist) ──
  console.log('[PointsData] 💰 Step A: Fetching wallet for user', { userId });
  let wallet = await findWalletByUserId(userId);

  if (!wallet) {
    // Still no wallet after upsert — this is unexpected but handle gracefully
    console.error('[PointsData] 💰 Step A: CRITICAL — No wallet found even after upsert!', { userId });
    logger.error('deductPoints: no wallet after upsert', 'PointsData', { userId });
    throw new Error('فشل إنشاء أو العثور على المحفظة');
  }

  console.log('[PointsData] 💰 Step A: Wallet found', {
    walletId: wallet.id,
    currentBalance: wallet.balance,
    totalUsed: wallet.total_used,
  });

  // ── Step B: Deduct points via UPDATE ──
  const currentBalance = (wallet.balance as number) ?? 0;
  if (currentBalance < amount) {
    console.error('[PointsData] 💰 Step B: INSUFFICIENT BALANCE — rejecting deduction', {
      walletId: wallet.id,
      currentBalance,
      requestedAmount: amount,
    });
    throw new Error(`رصيد غير كافٍ: الرصيد الحالي ${currentBalance}، المطلوب ${amount}`);
  }
  const newBalance = currentBalance - amount;
  const newTotalUsed = (wallet.total_used as number ?? 0) + amount;

  console.log('[PointsData] 💰 Step B: Updating wallet in Supabase', {
    walletId: wallet.id,
    oldBalance: wallet.balance,
    newBalance,
    newTotalUsed,
    deductionAmount: amount,
  });

  const { data: updatedWallet, error: walletError } = await sb
    .from(TABLES.WALLET)
    .update({ balance: newBalance, total_used: newTotalUsed })
    .eq('id', wallet.id)
    .select();

  console.log('[PointsData] 💰 Step B: Update result', {
    hasError: !!walletError,
    errorMessage: walletError?.message,
    returnedCount: updatedWallet?.length ?? 0,
    returnedData: updatedWallet ? JSON.stringify(updatedWallet) : 'null',
  });

  if (walletError) {
    console.error('[PointsData] 💰 Step B: Wallet update FAILED', { error: walletError.message, userId, walletId: wallet.id });
    logger.error('deductPoints wallet update failed', 'PointsData', { error: walletError.message, userId });
    throw new Error(`فشل تحديث المحفظة: ${walletError.message}`);
  }

  // ── Step B2: Verify the update actually affected a row ──
  if (!updatedWallet || updatedWallet.length === 0) {
    console.error('[PointsData] 💰 Step B2: CRITICAL — UPDATE matched 0 rows! Wallet may not exist. Attempting direct upsert with deducted balance.');
    // Last resort: upsert with the deducted balance directly
    try {
      const emergencyWallet = await upsertWallet({
        user_id: userId,
        balance: newBalance,
        total_used: newTotalUsed,
        total_purchased: 0,
      });
      console.log('[PointsData] 💰 Step B2: Emergency upsert succeeded', { newBalance: (emergencyWallet as unknown as Record<string, unknown>)?.balance });
      wallet = emergencyWallet as unknown as Record<string, unknown>;
    } catch (emergencyErr) {
      console.error('[PointsData] 💰 Step B2: Emergency upsert also FAILED', { error: String(emergencyErr) });
      throw new Error('فشل خصم النقاط — المحفظة غير موجودة ولا يمكن إنشاؤها');
    }
  } else {
    wallet = updatedWallet[0] as Record<string, unknown>;
    console.log('[PointsData] 💰 Step B: Wallet updated successfully in Supabase', { newBalance: (wallet as Record<string, unknown>).balance });
  }

  // ── Transaction logging (NON-FATAL) ──
  // The wallet balance has already been deducted above. If the transaction
  // log fails (e.g., point_transactions table missing), we must NOT throw —
  // the deduction has already happened and throwing would mislead the caller.
  try {
    console.log('[PointsData] 💰 Step C: Creating point transaction record', { walletId: wallet.id, amount: -amount, type });
    await createPointTransaction({
      wallet_id: wallet.id as string,
      user_id: userId,
      amount: -amount,
      type,
      description,
    });
    console.log('[PointsData] 💰 Step C: Transaction record created');
  } catch (txErr) {
    console.error('[PointsData] 💰 Step C: Transaction log FAILED (non-fatal — wallet WAS updated)', { error: String(txErr), userId, amount });
    logger.warn('deductPoints: transaction log failed (wallet balance WAS deducted successfully)', 'PointsData', { userId, amount, error: String(txErr) });
  }

  const finalBalance = (wallet.balance as number) ?? 0;
  logger.info('Points deducted', 'PointsData', { userId, amount, type, newBalance: finalBalance });
  console.log('[PointsData] 💰 deductPoints COMPLETE', { userId, amount, type, newBalance: finalBalance });
  return finalBalance;
}
