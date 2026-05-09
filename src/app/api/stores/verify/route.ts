export const runtime = 'nodejs'
import { withRoute } from '@/server/lib/route-wrapper';
import { NextRequest } from 'next/server';
import { requireAdmin } from '@/server/lib/admin-auth';
import { requireAuth } from '@/server/lib/auth-guard';
import { mapStore } from '@/lib/api-utils';
import { success, badRequest, notFound, forbidden, serverError } from '@/lib/api-response';
import { logger } from '@/lib/logger';
import { type VerificationTier, getPlan, VERIFICATION_PLANS } from '@/lib/constants';
import { getWallet, deductPoints } from '@/server/lib/pointsData';
import {
  findStoreById,
  updateStore,
  findVerificationByStoreId,
  createVerification,
  updateVerification,
} from '@/lib/supabase-db';
import { serverCache } from '@/lib/cache';

export const PUT = withRoute(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const { storeId, isVerified, tier: requestedTier } = body;

    console.log('[StoreVerify] Step 1: Received request', { storeId, isVerified, requestedTier });

    if (!storeId || isVerified === undefined) {
      return badRequest('معرف المتجر وحالة التوثيق مطلوبان');
    }

    // ── Strategy: Try admin first, fallback to owner verification ──
    // This allows both admin-granted verification AND self-purchased verification

    const admin = await requireAdmin(request);
    console.log('[StoreVerify] Step 2: Admin check', { isAdmin: admin.success });

    // Determine user info for auth/ownership checks
    let sessionUserId: string | null = null;
    if (!admin.success) {
      const auth = await requireAuth(request);
      console.log('[StoreVerify] Step 3: Auth check', { authSuccess: auth.success });
      if (!auth.success) return auth.response;
      sessionUserId = auth.userId;
    }

    // ── Supabase path (default) ──

    // Check store exists (fetch raw to access is_verified and user_id)
    let existing;
    try {
      existing = await findStoreById(storeId);
      console.log('[StoreVerify] Step 4: Store found', { storeId, isVerified: existing.is_verified, userId: existing.user_id });
    } catch (err) {
      console.error('[StoreVerify] Step 4 FAILED: Store not found', err);
      return notFound('المتجر غير موجود');
    }

    // Tier ranking helper
    const tierRank = (t: string | null | undefined): number =>
      VERIFICATION_PLANS.findIndex(p => p.tier === t);

    // Prevent duplicate verification — but allow:
    //   1. Re-verification if the previous verification has expired
    //   2. UPGRADE if the requested tier is higher than the current active tier
    if (isVerified && existing.is_verified) {
      console.log('[StoreVerify] Step 5: Store already marked verified, checking verification record...');
      const existingVer = await findVerificationByStoreId(storeId);
      const hasActiveVerification =
        existingVer &&
        existingVer.is_active &&
        existingVer.end_date &&
        new Date(existingVer.end_date) > new Date();

      const currentTier = (existingVer?.tier as string) || 'bronze';
      const requestedRank = tierRank(requestedTier);
      const currentRank = tierRank(currentTier);
      const isUpgrade = requestedRank > currentRank;

      console.log('[StoreVerify] Step 5: Verification record check', {
        hasRecord: !!existingVer,
        isActive: existingVer?.is_active,
        endDate: existingVer?.end_date,
        hasActiveVerification,
        currentTier,
        requestedTier,
        currentRank,
        requestedRank,
        isUpgrade,
      });

      if (hasActiveVerification && !isUpgrade) {
        // Same tier or downgrade — not allowed for self-verification
        return badRequest('هذا المتجر موثق بالفعل بهذه الخطة أو بخطة أعلى');
      }

      if (hasActiveVerification && isUpgrade) {
        // Allow upgrade — will deduct the NEW plan's cost below
        console.log('[StoreVerify] Step 5b: Allowing tier upgrade', { from: currentTier, to: requestedTier });
        logger.info('Allowing tier upgrade', 'StoreVerify', { storeId, from: currentTier, to: requestedTier });
        // Do NOT reset is_verified — it stays true, we just update the tier
      } else {
        // Verification expired — reset is_verified so we can re-verify
        logger.info('Verification expired, allowing re-verification', 'StoreVerify', { storeId });
        await updateStore(storeId, { is_verified: false });
        existing = await findStoreById(storeId);
      }
    }

    // Validate tier
    const validTiers: VerificationTier[] = ['bronze', 'silver', 'gold', 'diamond'];
    const tier: VerificationTier = validTiers.includes(requestedTier) ? requestedTier : 'bronze';

    if (admin.success) {
      // Admin path — full authority, no ownership check needed
      console.log('[StoreVerify] Step 6: Admin path');
      const updatedStore = await updateStore(storeId, { is_verified: isVerified });

      // Upsert verification record with tier (non-fatal)
      const now = new Date();
      const plan = getPlan(tier);
      const endDate = new Date(now.getTime() + plan.durationDays * 24 * 60 * 60 * 1000);

      try {
        const existingVerification = await findVerificationByStoreId(storeId);
        if (existingVerification) {
          await updateVerification(existingVerification.id, {
            tier,
            is_active: true,
            start_date: now.toISOString(),
            end_date: endDate.toISOString(),
            granted_by: admin.userId,
          });
        } else {
          await createVerification({
            store_id: storeId,
            user_id: existing.user_id,
            store_name: existing.name,
            tier,
            is_active: true,
            start_date: now.toISOString(),
            end_date: endDate.toISOString(),
            granted_by: admin.userId,
          });
        }
      } catch (verErr) {
        console.error('[StoreVerify] Step 6: Verification record FAILED (non-fatal)', String(verErr));
        logger.warn('Admin verification: record creation failed', 'StoreVerify', { storeId, error: String(verErr) });
      }

      logger.info('Admin updated verification', 'StoreVerify', { storeId, isVerified, tier, adminId: admin.userId });

      // Invalidate store and home caches after admin verification
      serverCache.invalidateByPrefix('stores:');
      serverCache.invalidateByPrefix('home:');

      return success({ store: mapStore(updatedStore), tier });
    }

    // ── Self-verification path (non-admin, store owner) ──
    console.log('[StoreVerify] Step 7: Self-verification path', { sessionUserId, storeOwner: existing.user_id });

    // Only allow store OWNER to self-verify their own store
    if (existing.user_id !== sessionUserId) {
      return forbidden('ليس لديك صلاحية لتعديل حالة توثيق هذا المتجر');
    }

    // Only allow setting isVerified = true for self-purchased verification
    if (!isVerified) {
      return forbidden('لا يمكنك إزالة التوثيق بنفسك. تواصل مع الإدارة.');
    }

    // ── Server-side points deduction for self-verification ──
    // This is the CRITICAL path. If points are deducted, the store MUST be
    // marked as verified regardless of whether the verification record
    // creation succeeds.
    const plan = getPlan(tier);
    let cost = plan.costPerMonth;

    // If upgrading from an existing active verification, charge only the DIFFERENCE
    const existingVerForCost = await findVerificationByStoreId(storeId);
    const hasActiveVer =
      existingVerForCost &&
      existingVerForCost.is_active &&
      existingVerForCost.end_date &&
      new Date(existingVerForCost.end_date) > new Date();

    if (hasActiveVer) {
      const currentTierForCost = (existingVerForCost!.tier as string) || 'bronze';
      const currentPlan = getPlan(currentTierForCost as VerificationTier);
      cost = plan.costPerMonth - currentPlan.costPerMonth;
      if (cost < 0) {
        console.log('[StoreVerify] 💰 Upgrade cost is negative — rejecting', {
          currentTier: currentTierForCost,
          requestedTier: tier,
          currentCost: currentPlan.costPerMonth,
          newCost: plan.costPerMonth,
        });
        return badRequest('لا يمكن الترقية إلى مستوى أدنى');
      }
      console.log('[StoreVerify] 💰 Upgrade: charging difference', {
        currentTier: currentTierForCost,
        requestedTier: tier,
        currentCost: currentPlan.costPerMonth,
        newCost: plan.costPerMonth,
        difference: cost,
      });
    }

    let newBalance: number | null = null;

    console.log('[StoreVerify] 💰 Step 8: Points deduction phase', { tier, cost, planName: plan.nameAr, durationDays: plan.durationDays });

    if (cost > 0) {
      console.log('[StoreVerify] 💰 Step 8a: Fetching wallet for user', { sessionUserId });
      const wallet = await getWallet(sessionUserId!);
      console.log('[StoreVerify] 💰 Step 8b: Wallet balance', { balance: wallet.balance, cost, sufficient: wallet.balance >= cost });

      if (wallet.balance < cost) {
        console.log('[StoreVerify] 💰 Step 8c: INSUFFICIENT BALANCE — aborting before any changes');
        return forbidden('رصيدك غير كافٍ لهذه العملية');
      }

      // ── DEDUCT POINTS ──
      // deductPoints now returns the new balance and makes transaction logging non-fatal.
      // If the wallet update succeeds but the transaction log fails, the deduction
      // is still considered successful and we continue with verification.
      console.log('[StoreVerify] 💰 Step 8d: About to call deductPoints', {
        userId: sessionUserId,
        cost,
        description: `ترقية المتجر إلى مستوى ${plan.nameAr} - ${plan.durationDays} يوم`,
      });

      try {
        newBalance = await deductPoints(
          sessionUserId!,
          cost,
          `ترقية المتجر إلى مستوى ${plan.nameAr} - ${plan.durationDays} يوم`,
          'verification_deduct',
        );
        console.log('[StoreVerify] 💰 Step 8e: Points deducted successfully', { newBalance });
      } catch (deductErr) {
        // This is FATAL — if we can't deduct points, we must NOT verify the store.
        console.error('[StoreVerify] 💰 Step 8e: deductPoints THREW an error', String(deductErr));
        logger.error('Points deduction failed during verification', 'StoreVerify', {
          storeId, userId: sessionUserId, cost, error: String(deductErr),
        });
        return serverError('فشل خصم النقاط من المحفظة. حاول مرة أخرى.');
      }
    } else {
      console.log('[StoreVerify] 💰 Step 8: Cost is 0, skipping deduction');
    }

    // ── MARK STORE AS VERIFIED ──
    // Points have been deducted (or cost is 0). The store MUST be marked verified.
    let updatedStore;
    try {
      updatedStore = await updateStore(storeId, { is_verified: true });
      console.log('[StoreVerify] Step 9: Store updated to verified');
    } catch (storeErr) {
      // CRITICAL: Points were deducted but store update failed.
      // Log prominently so we can investigate and potentially refund.
      console.error('[StoreVerify] ⚠️ Step 9: Store update FAILED after points were deducted!', {
        storeId, userId: sessionUserId, cost, newBalance, error: String(storeErr),
      });
      logger.error('Store update failed AFTER points deduction — potential data inconsistency', 'StoreVerify', {
        storeId, userId: sessionUserId, cost, error: String(storeErr),
      });
      return serverError('تم خصم النقاط لكن فشل تحديث حالة المتجر. تواصل مع الإدارة.');
    }

    // ── CREATE/UPDATE VERIFICATION RECORD (non-fatal) ──
    // If this fails (e.g., verifications table missing), the store is still
    // verified (is_verified = true) and points were deducted. The verification
    // record is metadata for tier tracking, not for the verification itself.
    const now = new Date();
    const endDate = new Date(now.getTime() + plan.durationDays * 24 * 60 * 60 * 1000);

    try {
      const existingVerification = await findVerificationByStoreId(storeId);
      if (existingVerification) {
        await updateVerification(existingVerification.id, {
          tier,
          is_active: true,
          start_date: now.toISOString(),
          end_date: endDate.toISOString(),
          granted_by: 'self',
        });
        console.log('[StoreVerify] Step 10: Verification record updated');
      } else {
        await createVerification({
          store_id: storeId,
          user_id: existing.user_id,
          store_name: existing.name,
          tier,
          is_active: true,
          start_date: now.toISOString(),
          end_date: endDate.toISOString(),
          granted_by: 'self',
        });
        console.log('[StoreVerify] Step 10: Verification record created');
      }
    } catch (verErr) {
      // Non-fatal: Store is verified, points are deducted. The verification
      // record is just for tier tracking and countdown display.
      console.error('[StoreVerify] Step 10: Verification record FAILED (non-fatal)', String(verErr));
      logger.warn('Verification record creation failed — store is still verified', 'StoreVerify', {
        storeId, tier, error: String(verErr),
      });
    }

    // Re-fetch the store to get the freshest data after updateStore
    const refreshedStore = await findStoreById(storeId);

    logger.info('Self-verification completed', 'StoreVerify', { storeId, userId: sessionUserId, tier, cost, newBalance });
    console.log('[StoreVerify] Step 11: SUCCESS', { storeId, tier, newBalance });

    // Invalidate store and home caches after self-verification
    serverCache.invalidateByPrefix('stores:');
    serverCache.invalidateByPrefix('home:');

    return success({
      store: mapStore(refreshedStore || updatedStore),
      tier,
      newBalance,
      verification: {
        storeId,
        userId: existing.user_id,
        storeName: existing.name,
        tier,
        isActive: true,
        startDate: now.toISOString(),
        endDate: endDate.toISOString(),
        grantedBy: 'self',
      },
    });
  } catch (error) {
    console.error('[StoreVerify] UNHANDLED ERROR:', error);
    logger.error('Store verification update error', 'StoreVerify', { error: (error as Error)?.message, stack: (error as Error)?.stack });
    return serverError('حدث خطأ أثناء تحديث حالة التوثيق');
  }
})
