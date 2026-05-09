export const runtime = 'nodejs'
import { NextRequest } from 'next/server';
import { requireAdmin } from '@/server/lib/admin-auth';
import { checkRateLimit, LIMITS } from '@/server/lib/rate-limiter';
import { success, badRequest, notFound, rateLimited, serverError } from '@/lib/api-response';
import { logger } from '@/lib/logger';
import { withRoute } from '@/server/lib/route-wrapper';
import { validateId, validateInt } from '@/utils/validation';
import {
  getSupabaseAdmin,
  findUserById,
  findStoreById,
  findProductById,
  updateUser,
  updateStore,
  updateProduct,
  deleteProduct,
  createNotification,
  logAdminActivity,
  getAppSetting,
  setAppSetting,
  findVerificationByStoreId,
  updateVerification,
  findWalletByUserId,
  upsertWallet,
  createPointTransaction,
  TABLES,
  handleResponse,
  handleCount,
} from '@/lib/supabase-db';

const PERMANENT_BAN_EXPIRY = '9999-12-31T23:59:59.999Z';

export const POST = withRoute(async (req: NextRequest) => {
  // Verify admin access
  const admin = await requireAdmin(req);
  if (!admin.success) return admin.response;

  // Per-admin rate limiting (20 actions per minute per admin)
  const rateCheck = checkRateLimit(`admin:action:${admin.email}`, LIMITS.adminMutation);
  if (!rateCheck.success) {
    return rateLimited('طلبات إدارية كثيرة. حاول بعد دقيقة');
  }

  try {
    const body = await req.json();
    const { action } = body as { action: string; [key: string]: unknown };

    if (!action || typeof action !== 'string' || action.length > 100) {
      return badRequest('Invalid action');
    }

    switch (action) {
      // ===== USER ACTIONS =====
      case 'deleteUser': {
        const { userId } = body as { userId: string };
        const userIdCheck = validateId(userId, 'معرف المستخدم');
        if (!userIdCheck.valid) return badRequest(userIdCheck.error!);
        const sb = getSupabaseAdmin();
        const { data: userExists } = await sb.from(TABLES.USERS).select('id').eq('id', userId).maybeSingle();
        if (!userExists) return notFound('المستخدم غير موجود');
        await sb.from(TABLES.USERS).delete().eq('id', userId);
        return success(null);
      }

      // ===== STORE ACTIONS =====
      case 'deleteStore': {
        const { storeId } = body as { storeId: string };
        const storeIdCheck = validateId(storeId, 'معرف المتجر');
        if (!storeIdCheck.valid) return badRequest(storeIdCheck.error!);
        const sb = getSupabaseAdmin();
        const { data: storeExists } = await sb.from(TABLES.STORES).select('id').eq('id', storeId).maybeSingle();
        if (!storeExists) return notFound('المتجر غير موجود');
        await sb.from(TABLES.STORES).delete().eq('id', storeId);
        return success(null);
      }

      case 'toggleStoreFeatured': {
        const { storeId } = body as { storeId: string };
        const storeIdCheck = validateId(storeId, 'معرف المتجر');
        if (!storeIdCheck.valid) return badRequest(storeIdCheck.error!);
        try {
          const store = await findStoreById(storeId);
          const updated = await updateStore(storeId, { is_featured: !store.is_featured });
          return success({ isFeatured: updated.is_featured });
        } catch {
          return notFound('Store not found');
        }
      }

      case 'toggleStoreVerified': {
        const { storeId } = body as { storeId: string };
        const storeIdCheck = validateId(storeId, 'معرف المتجر');
        if (!storeIdCheck.valid) return badRequest(storeIdCheck.error!);
        try {
          const store = await findStoreById(storeId);
          const updated = await updateStore(storeId, { is_verified: !store.is_verified });
          return success({ isVerified: updated.is_verified });
        } catch {
          return notFound('Store not found');
        }
      }

      // ===== PRODUCT ACTIONS =====
      case 'deleteProduct': {
        const { productId } = body as { productId: string };
        const productIdCheck = validateId(productId, 'معرف المنتج');
        if (!productIdCheck.valid) return badRequest(productIdCheck.error!);
        try {
          await findProductById(productId);
        } catch {
          return notFound('المنتج غير موجود');
        }
        await deleteProduct(productId);
        return success(null);
      }

      case 'toggleProductFeatured': {
        const { productId } = body as { productId: string };
        const productIdCheck = validateId(productId, 'معرف المنتج');
        if (!productIdCheck.valid) return badRequest(productIdCheck.error!);
        try {
          const product = await findProductById(productId);
          const updated = await updateProduct(productId, { is_featured: !product.is_featured });
          return success({ isFeatured: updated.is_featured });
        } catch {
          return notFound('Product not found');
        }
      }

      // ===== OFFER ACTIONS =====
      case 'deleteOffer': {
        const { offerId } = body as { offerId: string };
        const offerIdCheck = validateId(offerId, 'معرف العرض');
        if (!offerIdCheck.valid) return badRequest(offerIdCheck.error!);
        const sb = getSupabaseAdmin();
        const { data: offerExists } = await sb.from(TABLES.STORE_OFFERS).select('id').eq('id', offerId).maybeSingle();
        if (!offerExists) return notFound('العرض غير موجود');
        await sb.from(TABLES.STORE_OFFERS).delete().eq('id', offerId);
        return success(null);
      }

      // ===== BAN / UNBAN ACTIONS =====
      case 'banUser': {
        const { duration, reason } = body as { userId?: string; duration?: string; reason?: string };
        const userIdCheck = validateId((body as { userId?: string }).userId, 'معرف المستخدم');
        if (!userIdCheck.valid) return badRequest(userIdCheck.error!);
        const validatedUserId = userIdCheck.value!;
        const durationMap: Record<string, string> = {
          '1 يوم': '1d', '3 أيام': '3d', '7 أيام': '7d',
          '15 يوم': '15d', '30 يوم': '30d', 'دائم': 'permanent',
        };
        const banDuration = durationMap[duration || ''] || '7d';
        const durationDays: Record<string, number> = { '1d': 1, '3d': 3, '7d': 7, '15d': 15, '30d': 30, 'permanent': 36500 };

        const sb = getSupabaseAdmin();
        // Deactivate existing active bans
        await sb.from(TABLES.USER_BANS).update({ is_active: false }).eq('user_id', validatedUserId).eq('is_active', true);

        // Create new ban
        const expiresAt = banDuration === 'permanent'
          ? PERMANENT_BAN_EXPIRY
          : new Date(Date.now() + (durationDays[banDuration] || 7) * 86400000).toISOString();

        await handleResponse(
          await sb.from(TABLES.USER_BANS).insert({
            user_id: validatedUserId,
            user_email: '',
            user_name: '',
            ban_type: 'full',
            duration: banDuration,
            reason: reason || '',
            is_active: true,
            expires_at: expiresAt,
          }).select().single(),
          'banUser'
        );
        return success(null);
      }

      case 'unbanUser': {
        const userIdCheck = validateId((body as { userId?: string }).userId, 'معرف المستخدم');
        if (!userIdCheck.valid) return badRequest(userIdCheck.error!);
        const sb = getSupabaseAdmin();
        await sb.from(TABLES.USER_BANS).update({ is_active: false }).eq('user_id', userIdCheck.value!).eq('is_active', true);
        return success(null);
      }

      // ===== POINTS ACTIONS =====
      case 'addUserPoints': {
        const { points, reason } = body as { userId?: string; points?: number; reason?: string };
        const userIdCheck = validateId((body as { userId?: string }).userId, 'معرف المستخدم');
        if (!userIdCheck.valid) return badRequest(userIdCheck.error!);
        const validatedUserId = userIdCheck.value!;
        if (points == null || !reason) {
          return badRequest('النقاط والسبب مطلوبان');
        }

        const sb = getSupabaseAdmin();
        const isAdd = points > 0;
        const absPoints = Math.abs(points);

        // Upsert wallet
        const wallet = await findWalletByUserId(validatedUserId);
        let walletData;
        if (wallet) {
          const newBalance = isAdd ? wallet.balance + absPoints : Math.max(0, wallet.balance - absPoints);
          const updateData: Record<string, unknown> = { balance: newBalance };
          if (isAdd) updateData.total_purchased = (wallet.total_purchased || 0) + absPoints;
          else updateData.total_used = (wallet.total_used || 0) + absPoints;
          walletData = await handleResponse(
            await sb.from(TABLES.WALLET).update(updateData).eq('id', wallet.id).select().single(),
            'addUserPoints.wallet'
          );
        } else {
          walletData = await handleResponse(
            await sb.from(TABLES.WALLET).insert({
              user_id: validatedUserId,
              balance: isAdd ? absPoints : 0,
              total_used: isAdd ? 0 : absPoints,
              total_purchased: isAdd ? absPoints : 0,
            }).select().single(),
            'addUserPoints.wallet.create'
          );
        }

        // Create point transaction
        const txData = await handleResponse(
          await sb.from(TABLES.POINT_TRANSACTIONS).insert({
            wallet_id: walletData.id,
            user_id: validatedUserId,
            amount: isAdd ? absPoints : -absPoints,
            type: isAdd ? 'admin_add' : 'admin_reject',
            description: reason,
          }).select().single(),
          'addUserPoints.tx'
        );

        // Notify the user about the points change
        try {
          const notificationTitle = isAdd ? 'تمت إضافة نقاط' : 'تم خصم نقاط';
          const notificationBody = isAdd
            ? `تمت إضافة ${absPoints.toLocaleString('ar-SY')} نقطة إلى محفظتك. السبب: ${reason}`
            : `تم خصم ${absPoints.toLocaleString('ar-SY')} نقطة من محفظتك. السبب: ${reason}`;
          await createNotification({
            user_id: validatedUserId,
            title: notificationTitle,
            body: notificationBody,
            type: 'points',
            category: 'wallet',
            icon: isAdd ? 'plus-circle' : 'minus-circle',
          });
        } catch (notifErr) {
          logger.warn('Failed to create points notification (non-critical)', 'AdminAction', { error: (notifErr as Error)?.message });
        }
        return success({
          wallet: { userId: walletData.user_id, balance: walletData.balance, totalUsed: walletData.total_used, totalPurchased: walletData.total_purchased },
          transaction: { id: txData.id, userId: txData.user_id, type: txData.type, amount: txData.amount, description: txData.description, createdAt: txData.created_at },
        });
      }

      // ===== REPORT ACTIONS =====
      case 'updateReportStatus': {
        const { status, note } = body as { reportId?: string; status?: string; note?: string };
        const reportIdCheck = validateId((body as { reportId?: string }).reportId, 'معرف البلاغ');
        if (!reportIdCheck.valid) return badRequest(reportIdCheck.error!);
        if (!status) {
          return badRequest('حالة البلاغ مطلوبة');
        }
        const sb = getSupabaseAdmin();
        const { data: existing } = await sb.from(TABLES.REPORTS).select('id').eq('id', reportIdCheck.value!).maybeSingle();
        if (!existing) return notFound('Report not found');

        const updateData: Record<string, unknown> = {
          status,
          admin_note: note ?? null,
          action_taken: (body as { actionTaken?: string }).actionTaken ?? null,
          reviewed_at: new Date().toISOString(),
        };
        await handleResponse(
          await sb.from(TABLES.REPORTS).update(updateData).eq('id', reportIdCheck.value!).select().single(),
          'updateReportStatus'
        );
        return success(null);
      }

      // ===== POINT ORDER ACTIONS =====
      case 'approvePointOrder': {
        const orderIdCheck = validateId((body as { orderId?: string }).orderId, 'معرف الطلب');
        if (!orderIdCheck.valid) return badRequest(orderIdCheck.error!);
        const sb = getSupabaseAdmin();
        const { data: order } = await sb.from(TABLES.POINT_ORDERS).select('*').eq('id', orderIdCheck.value!).eq('status', 'pending').maybeSingle();
        if (!order) return notFound('Order not found or not pending');

        // Update order status
        await handleResponse(
          await sb.from(TABLES.POINT_ORDERS).update({ status: 'approved', reviewed_at: new Date().toISOString() }).eq('id', orderIdCheck.value!).select().single(),
          'approveOrder'
        );

        // Add points to wallet
        const wallet = await findWalletByUserId(order.user_id);
        if (wallet) {
          await handleResponse(
            await sb.from(TABLES.WALLET).update({
              balance: (wallet.balance || 0) + order.points,
              total_purchased: (wallet.total_purchased || 0) + order.points,
            }).eq('id', wallet.id).select().single(),
            'approveOrder.wallet'
          );
        } else {
          await handleResponse(
            await sb.from(TABLES.WALLET).insert({
              user_id: order.user_id,
              balance: order.points,
              total_purchased: order.points,
            }).select().single(),
            'approveOrder.wallet.create'
          );
        }

        // Create point transaction
        await handleResponse(
          await sb.from(TABLES.POINT_TRANSACTIONS).insert({
            wallet_id: wallet?.id || '',
            user_id: order.user_id,
            amount: order.points,
            type: 'admin_add',
            description: `تمت الموافقة على شراء ${order.points.toLocaleString('ar-SY')} نقطة`,
          }).select().single(),
          'approveOrder.tx'
        );
        return success(null);
      }

      case 'rejectPointOrder': {
        const { reason: rejectReason } = body as { orderId?: string; reason?: string };
        const orderIdCheck = validateId((body as { orderId?: string }).orderId, 'معرف الطلب');
        if (!orderIdCheck.valid) return badRequest(orderIdCheck.error!);
        const sb = getSupabaseAdmin();
        const { data: order } = await sb.from(TABLES.POINT_ORDERS).select('*').eq('id', orderIdCheck.value!).eq('status', 'pending').maybeSingle();
        if (!order) return notFound('Order not found or not pending');

        await handleResponse(
          await sb.from(TABLES.POINT_ORDERS).update({
            status: 'rejected',
            rejection_reason: rejectReason || '',
            reviewed_at: new Date().toISOString(),
          }).eq('id', orderIdCheck.value!).select().single(),
          'rejectOrder'
        );

        // Create transaction record for rejection
        const wallet = await findWalletByUserId(order.user_id);
        if (wallet) {
          await handleResponse(
            await sb.from(TABLES.POINT_TRANSACTIONS).insert({
              wallet_id: wallet.id,
              user_id: order.user_id,
              amount: 0,
              type: 'admin_reject',
              description: `تم رفض طلب شراء ${order.points.toLocaleString('ar-SY')} نقطة - ${rejectReason || 'بدون سبب'}`,
            }).select().single(),
            'rejectOrder.tx'
          );
        }
        return success(null);
      }

      // ===== ACTIVITY LOG =====
      case 'logActivity': {
        const { action: logAction, targetType, targetId, targetName, details } = body as {
          action?: string; targetType?: string; targetId?: string; targetName?: string; details?: string;
        };
        if (!logAction) return success(null);
        await logAdminActivity({
          action: logAction,
          target_type: targetType || undefined,
          target_id: targetId || undefined,
          target_name: targetName || undefined,
          details: details || undefined,
        });
        return success(null);
      }

      // ===== SETTINGS =====
      case 'updateSettings': {
        const { settings } = body as { settings?: Record<string, unknown> };
        if (!settings) {
          return badRequest('settings are required');
        }
        // Persist settings to AppSetting table via Supabase
        await setAppSetting('admin_settings', JSON.stringify(settings));
        return success(null);
      }

      // ===== VERIFICATION EXTENSION =====
      case 'extendVerification': {
        const { days } = body as { storeId?: string; days?: number };
        const storeIdCheck = validateId((body as { storeId?: string }).storeId, 'معرف المتجر');
        if (!storeIdCheck.valid) return badRequest(storeIdCheck.error!);
        const daysCheck = validateInt(days, 1, undefined, 'عدد الأيام');
        if (!daysCheck.valid) return badRequest(daysCheck.error!);

        const existing = await findVerificationByStoreId(storeIdCheck.value!);
        if (!existing) return notFound('Verification not found');

        const now = new Date();
        const baseDate = existing.is_active && existing.end_date && new Date(existing.end_date) > now
          ? new Date(existing.end_date)
          : now;
        const newEndDate = new Date(baseDate.getTime() + daysCheck.value! * 24 * 60 * 60 * 1000);

        await updateVerification(existing.id, {
          is_active: true,
          end_date: newEndDate.toISOString(),
        });
        return success(null);
      }

      // ===== VERIFICATION REJECTION =====
      case 'rejectVerification': {
        const storeIdCheck = validateId((body as { storeId?: string }).storeId, 'معرف المتجر');
        if (!storeIdCheck.valid) return badRequest(storeIdCheck.error!);

        // Set store as NOT verified
        await updateStore(storeIdCheck.value!, { is_verified: false });

        // Deactivate the verification record
        const existing = await findVerificationByStoreId(storeIdCheck.value!);
        if (existing) {
          await updateVerification(existing.id, {
            is_active: false,
          });
        }

        return success(null);
      }

      default:
        return badRequest(`Unknown action: ${action}`);
    }
  } catch (error: unknown) {
    logger.error('Admin action error', 'AdminAction', { error: (error as Error)?.message });
    const message = process.env.NODE_ENV === 'development'
      ? (error instanceof Error ? error.message : 'Unknown error')
      : 'حدث خطأ غير متوقع';
    return serverError(message);
  }
})
