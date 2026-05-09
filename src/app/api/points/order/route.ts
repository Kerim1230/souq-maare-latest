export const runtime = 'nodejs'
import { NextRequest } from 'next/server';
import { getSupabaseAdmin, findWalletByUserId, upsertWallet, createPointTransaction, updatePointOrder, handleResponse, handleCount, TABLES } from '@/lib/supabase-db';
import { requireAuth } from '@/server/lib/auth-guard';
import { requireAdmin } from '@/server/lib/admin-auth';
import { badRequest, serverError, rateLimited, success, notFound, created } from '@/lib/api-response';
import { checkRateLimit, getClientIp, LIMITS } from '@/server/lib/rate-limiter';
import { logger } from '@/lib/logger';
import { withRoute } from '@/server/lib/route-wrapper';
import { sanitizeString } from '@/server/lib/sanitize';
import { validateId, validateInt } from '@/utils/validation';

// Map a Supabase point_order row to the expected response format
function mapOrder(o: any) {
  return {
    id: o.id,
    userId: o.user_id,
    userName: o.user_name,
    userEmail: o.user_email,
    points: o.points,
    amount: o.amount,
    paymentCode: o.payment_code,
    receiptImage: o.receipt_image,
    status: o.status,
    rejectionReason: o.rejection_reason || undefined,
    pointPrice: o.point_price,
    createdAt: typeof o.created_at === 'string' ? o.created_at : o.created_at?.toISOString?.() ?? o.created_at,
    reviewedAt: o.reviewed_at ? (typeof o.reviewed_at === 'string' ? o.reviewed_at : o.reviewed_at?.toISOString?.()) : undefined,
  };
}

// POST /api/points/order — create point order (authenticated user)
export const POST = withRoute(async (request: NextRequest) => {
  try {
    const auth = await requireAuth(request);
    if (!auth.success) return auth.response;
    const userId = auth.userId;

    const ip = getClientIp(request);
    const rl = checkRateLimit(`points:order:${ip}`, LIMITS.points);
    if (!rl.success) return rateLimited();

    const body = await request.json();
    const { userName, userEmail, points, paymentCode, receiptImage, pointPrice } = body as {
      userName: string;
      userEmail: string;
      points: number;
      paymentCode: string;
      receiptImage: string | null;
      pointPrice: number;
    };

    if (!points || !paymentCode) {
      return badRequest('Missing required fields');
    }

    const pointsCheck = validateInt(points, 1, 100000, 'عدد النقاط');
    if (!pointsCheck.valid) return badRequest(pointsCheck.error!);

    const sanitizedPaymentCode = sanitizeString(paymentCode, 200);
    const sanitizedUserName = sanitizeString(userName || '', 100);
    const sanitizedUserEmail = sanitizeString(userEmail || '', 200);

    const sb = getSupabaseAdmin();
    const order = handleResponse(
      await sb.from(TABLES.POINT_ORDERS).insert({
        user_id: userId,
        user_name: sanitizedUserName,
        user_email: sanitizedUserEmail,
        points,
        amount: points * (pointPrice || 1),
        payment_code: sanitizedPaymentCode,
        receipt_image: receiptImage,
        point_price: pointPrice || 1,
        status: 'pending',
      }).select().single(),
      'POST /api/points/order create'
    );

    return created({ order: mapOrder(order) });
  } catch (error) {
    logger.error('Points order POST error', 'PointsOrder', { error: (error as Error)?.message });
    return serverError('Failed to create order');
  }
})

// GET /api/points/order — list orders (admin only, or user's own orders)
export const GET = withRoute(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const userIdParam = searchParams.get('userId');

    const sb = getSupabaseAdmin();

    if (userIdParam) {
      // If userId is provided, require admin access
      const admin = await requireAdmin(request);
      if (!admin.success) return admin.response;

      // Admin can request a specific user's orders or all
      let orders;
      if (userIdParam === 'all') {
        orders = handleResponse(
          await sb.from(TABLES.POINT_ORDERS).select('*').order('created_at', { ascending: false }),
          'GET /api/points/order all'
        );
      } else {
        orders = handleResponse(
          await sb.from(TABLES.POINT_ORDERS).select('*').eq('user_id', userIdParam).order('created_at', { ascending: false }),
          'GET /api/points/order by userId'
        );
      }
      return success({ orders: orders.map(mapOrder) });
    }

    // No userId param — return the authenticated user's own orders
    const auth = await requireAuth(request);
    if (!auth.success) return auth.response;
    const userId = auth.userId;

    const orders = handleResponse(
      await sb.from(TABLES.POINT_ORDERS).select('*').eq('user_id', userId).order('created_at', { ascending: false }),
      'GET /api/points/order own'
    );
    return success({ orders: orders.map(mapOrder) });
  } catch (error) {
    logger.error('Points order GET error', 'PointsOrder', { error: (error as Error)?.message });
    return serverError('Failed to fetch orders');
  }
})

// PUT /api/points/order — approve/reject order (admin only)
export const PUT = withRoute(async (request: NextRequest) => {
  try {
    const admin = await requireAdmin(request);
    if (!admin.success) return admin.response;

    const ip = getClientIp(request);
    const rl = checkRateLimit(`points:order:${ip}`, LIMITS.admin);
    if (!rl.success) return rateLimited();

    const body = await request.json();
    const { orderId, status, rejectionReason } = body as {
      orderId: string;
      status: 'approved' | 'rejected';
      rejectionReason?: string;
    };

    if (!orderId || !status) {
      return badRequest('Missing required fields');
    }

    const orderIdCheck = validateId(orderId, 'معرف الطلب');
    if (!orderIdCheck.valid) return badRequest(orderIdCheck.error!);

    const sb = getSupabaseAdmin();

    if (status === 'approved') {
      // Find the order
      let order;
      try {
        order = handleResponse(
          await sb.from(TABLES.POINT_ORDERS).select('*').eq('id', orderId).single(),
          'PUT /api/points/order approve find'
        );
      } catch {
        return notFound('Order not found or not pending');
      }

      if (order.status !== 'pending') {
        return notFound('Order not found or not pending');
      }

      // Update order status (sequential, no $transaction)
      const updatedOrder = handleResponse(
        await sb.from(TABLES.POINT_ORDERS)
          .update({ status: 'approved', reviewed_at: new Date().toISOString() })
          .eq('id', orderId)
          .select()
          .single(),
        'PUT /api/points/order approve update'
      );

      // Add points to wallet (sequential after order update)
      const isPurchaseType = true; // approved orders are always purchases
      let wallet = await findWalletByUserId(order.user_id);
      if (!wallet) {
        wallet = await upsertWallet({
          user_id: order.user_id,
          balance: order.points,
          total_used: 0,
          total_purchased: isPurchaseType ? order.points : 0,
        });
      } else {
        const newBalance = (wallet.balance ?? 0) + order.points;
        const newTotalPurchased = (wallet.total_purchased ?? 0) + (isPurchaseType ? order.points : 0);
        const { data: updatedWallet, error: walletError } = await sb.from(TABLES.WALLET)
          .update({ balance: newBalance, total_purchased: newTotalPurchased })
          .eq('id', wallet.id)
          .select()
          .single();
        if (walletError) {
          logger.error('Failed to update wallet on approval', 'PointsOrder', { error: walletError.message });
        } else {
          wallet = updatedWallet;
        }
      }

      // Create point transaction
      try {
        await createPointTransaction({
          wallet_id: wallet.id,
          user_id: order.user_id,
          amount: order.points,
          type: 'admin_add',
          description: `تمت الموافقة على شراء ${order.points.toLocaleString('ar-SY')} نقطة`,
        });
      } catch (txErr) {
        logger.error('Failed to create transaction on approval', 'PointsOrder', { error: (txErr as Error)?.message });
      }

      return success({ order: mapOrder(updatedOrder) });
    }

    if (status === 'rejected') {
      // Find the order
      let order;
      try {
        order = handleResponse(
          await sb.from(TABLES.POINT_ORDERS).select('*').eq('id', orderId).single(),
          'PUT /api/points/order reject find'
        );
      } catch {
        return notFound('Order not found or not pending');
      }

      if (order.status !== 'pending') {
        return notFound('Order not found or not pending');
      }

      const sanitizedReason = rejectionReason
        ? sanitizeString(rejectionReason, 500)
        : '';

      // Update order status
      const updatedOrder = handleResponse(
        await sb.from(TABLES.POINT_ORDERS)
          .update({ status: 'rejected', rejection_reason: sanitizedReason, reviewed_at: new Date().toISOString() })
          .eq('id', orderId)
          .select()
          .single(),
        'PUT /api/points/order reject update'
      );

      // Create a transaction record for the rejection (sequential)
      const wallet = await findWalletByUserId(order.user_id);
      if (wallet) {
        try {
          await createPointTransaction({
            wallet_id: wallet.id,
            user_id: order.user_id,
            amount: 0,
            type: 'admin_reject',
            description: `تم رفض طلب شراء ${order.points.toLocaleString('ar-SY')} نقطة - ${sanitizedReason || 'بدون سبب'}`,
          });
        } catch (txErr) {
          logger.error('Failed to create rejection transaction', 'PointsOrder', { error: (txErr as Error)?.message });
        }
      }

      return success({ order: mapOrder(updatedOrder) });
    }

    return badRequest('Invalid status');
  } catch (error) {
    logger.error('Points order PUT error', 'PointsOrder', { error: (error as Error)?.message });
    return serverError('Failed to update order');
  }
})
