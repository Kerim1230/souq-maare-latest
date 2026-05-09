export const runtime = 'nodejs'
import { NextRequest } from 'next/server';
import { requireAuth } from '@/server/lib/auth-guard';
import { checkRateGuard } from '@/server/lib/rate-guard';
import { serverError, forbidden, success, created, badRequest, notFound, apiError } from '@/lib/api-response';
import { logger } from '@/lib/logger';
import { withRoute } from '@/server/lib/route-wrapper';
import { getSupabaseAdmin, createOrder, updateOrder, deleteOrder, findStoreById, findProductById, handleResponse, handleCount, TABLES, paginate } from '@/lib/supabase-db';
import { validateId } from '@/utils/validation';

export const GET = withRoute(async (request: NextRequest) => {
  try {
    const auth = await requireAuth(request);
    if (!auth.success) return auth.response;
    const sessionUserId = auth.userId;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const storeId = searchParams.get('storeId');
    const action = searchParams.get('action');

    // Single order by ID
    if (id) {
      const idCheck = validateId(id, 'معرف الطلب');
      if (!idCheck.valid) return badRequest(idCheck.error!);

      const sb = getSupabaseAdmin();
      const order = handleResponse(
        await sb.from(TABLES.ORDERS).select('*, store:stores(*), product:products(*)').eq('id', id).single(),
        'GET /api/orders by id'
      );
      if (!order) {
        return notFound('الطلب غير موجود');
      }
      const isCustomer = order.user_id === sessionUserId;
      if (!isCustomer && order.store_id && order.store?.user_id !== sessionUserId) {
        return forbidden('ليس لديك صلاحية لعرض هذا الطلب');
      }
      return success({ order });
    }

    // Store-specific endpoints
    if (storeId) {
      let store;
      try {
        store = await findStoreById(storeId);
      } catch {
        return forbidden('ليس لديك صلاحية للوصول إلى بيانات هذا المتجر');
      }
      if (!store || store.user_id !== sessionUserId) {
        return forbidden('ليس لديك صلاحية للوصول إلى بيانات هذا المتجر');
      }
    }

    if (storeId && action === 'stats') {
      // Group orders by status in JS (Supabase doesn't have groupBy)
      const sb = getSupabaseAdmin();
      const allOrders = handleResponse(
        await sb.from(TABLES.ORDERS).select('status').eq('store_id', storeId),
        'GET /api/orders stats'
      );
      const statsMap: Record<string, number> = {};
      for (const o of allOrders) {
        statsMap[o.status] = (statsMap[o.status] || 0) + 1;
      }
      return success({ stats: statsMap });
    }

    if (storeId) {
      const status = searchParams.get('status');
      const page = parseInt(searchParams.get('page') || '1', 10);
      const pageSize = Math.min(parseInt(searchParams.get('pageSize') || '20', 10), 100);

      const sb = getSupabaseAdmin();
      const { from, to } = paginate(page, pageSize);

      let query = sb.from(TABLES.ORDERS).select('*, store:stores(*), product:products(*)', { count: 'exact' }).eq('store_id', storeId);
      if (status) query = query.eq('status', status);
      query = query.order('created_at', { ascending: false }).range(from, to);

      const resp = await query;
      const orders = handleResponse(resp, 'GET /api/orders store list');
      const total = handleCount(resp, 'GET /api/orders store count');

      return success({ orders, total, page, pageSize });
    }

    // List orders filtered by session userId
    const status = searchParams.get('status');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = Math.min(parseInt(searchParams.get('pageSize') || '20', 10), 100);

    const sb = getSupabaseAdmin();
    const { from, to } = paginate(page, pageSize);

    let query = sb.from(TABLES.ORDERS).select('*, store:stores(*), product:products(*)', { count: 'exact' }).eq('user_id', sessionUserId);
    if (status) query = query.eq('status', status);
    query = query.order('created_at', { ascending: false }).range(from, to);

    const resp = await query;
    const orders = handleResponse(resp, 'GET /api/orders user list');
    const total = handleCount(resp, 'GET /api/orders user count');

    return success({ orders, total, page, pageSize });
  } catch {
    return serverError('حدث خطأ أثناء جلب الطلبات');
  }
})

export const POST = withRoute(async (request: NextRequest) => {
  try {
    const rl = checkRateGuard(request, { category: 'order' });
    if (rl) return rl;

    const auth = await requireAuth(request);
    if (!auth.success) return auth.response;
    const sessionUserId = auth.userId;

    const body = await request.json();
    const orderData = { ...body, userId: sessionUserId };

    // Idempotency check
    if (orderData.productId && orderData.storeId) {
      const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const sb = getSupabaseAdmin();
      const existingOrders = handleResponse(
        await sb.from(TABLES.ORDERS)
          .select('id')
          .eq('user_id', sessionUserId)
          .eq('product_id', orderData.productId)
          .eq('store_id', orderData.storeId)
          .gte('created_at', fiveMinAgo)
          .limit(1),
        'POST /api/orders idempotency'
      );
      if (existingOrders.length > 0) {
        logger.warn('Duplicate order prevented', 'Orders', {
          userId: sessionUserId,
          productId: orderData.productId,
          storeId: orderData.storeId,
        });
        return apiError('يوجد طلب مماثل تم إنشاؤه مؤخراً', 409, { existingOrderId: existingOrders[0].id });
      }
    }

    logger.info('Creating order', 'Orders', {
      userId: sessionUserId,
      storeId: orderData.storeId,
      productId: orderData.productId,
    });

    // Verify store exists
    try {
      await findStoreById(orderData.storeId);
    } catch {
      return notFound('المتجر غير موجود');
    }

    let finalAmount = orderData.totalAmount;
    if (orderData.productId) {
      try {
        const product = await findProductById(orderData.productId);
        finalAmount = product.price * (orderData.quantity || 1);
      } catch {
        return notFound('المنتج غير موجود');
      }
    }

    const order = await createOrder({
      user_id: sessionUserId,
      store_id: orderData.storeId,
      product_id: orderData.productId || null,
      status: 'pending',
      total_amount: finalAmount,
      quantity: orderData.quantity || 1,
      notes: orderData.notes || null,
      customer_name: orderData.customerName || null,
      customer_phone: orderData.customerPhone || null,
      customer_address: orderData.customerAddress || null,
    });

    // Fetch with relations for response
    const sb = getSupabaseAdmin();
    const orderWithRelations = handleResponse(
      await sb.from(TABLES.ORDERS).select('*, store:stores(*), product:products(*)').eq('id', order.id).single(),
      'POST /api/orders fetch after create'
    );

    return created({ order: orderWithRelations });
  } catch {
    return serverError('حدث خطأ أثناء إنشاء الطلب');
  }
})

export const PUT = withRoute(async (request: NextRequest) => {
  try {
    const rl = checkRateGuard(request, { category: 'mutation' });
    if (rl) return rl;

    const auth = await requireAuth(request);
    if (!auth.success) return auth.response;
    const sessionUserId = auth.userId;

    const body = await request.json();
    const { id, ...updateData } = body;

    const idCheck = validateId(id, 'معرف الطلب');
    if (!idCheck.valid) return badRequest(idCheck.error!);

    // Find existing order
    const sb = getSupabaseAdmin();
    let existingOrder;
    try {
      existingOrder = handleResponse(
        await sb.from(TABLES.ORDERS).select('*').eq('id', id).single(),
        'PUT /api/orders find'
      );
    } catch {
      return notFound('الطلب غير موجود');
    }

    if (existingOrder.user_id !== sessionUserId) {
      return forbidden('ليس لديك صلاحية لتعديل هذا الطلب');
    }

    const supabaseUpdate: Record<string, unknown> = {};
    if (updateData.status !== undefined) supabaseUpdate.status = updateData.status;
    if (updateData.notes !== undefined) supabaseUpdate.notes = updateData.notes;
    if (updateData.customerName !== undefined) supabaseUpdate.customer_name = updateData.customerName;
    if (updateData.customerPhone !== undefined) supabaseUpdate.customer_phone = updateData.customerPhone;
    if (updateData.customerAddress !== undefined) supabaseUpdate.customer_address = updateData.customerAddress;

    await updateOrder(id, supabaseUpdate);

    // Fetch with relations for response
    const updated = handleResponse(
      await sb.from(TABLES.ORDERS).select('*, store:stores(*), product:products(*)').eq('id', id).single(),
      'PUT /api/orders fetch after update'
    );

    return success({ order: updated });
  } catch {
    return serverError('حدث خطأ أثناء تحديث الطلب');
  }
})

export const DELETE = withRoute(async (request: NextRequest) => {
  try {
    const rl = checkRateGuard(request, { category: 'mutation' });
    if (rl) return rl;

    const auth = await requireAuth(request);
    if (!auth.success) return auth.response;
    const sessionUserId = auth.userId;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    const idCheck = validateId(id, 'معرف الطلب');
    if (!idCheck.valid) return badRequest(idCheck.error!);
    const validatedOrderId = idCheck.value!;

    const sb = getSupabaseAdmin();
    let order;
    try {
      order = handleResponse(
        await sb.from(TABLES.ORDERS).select('*').eq('id', validatedOrderId).single(),
        'DELETE /api/orders find'
      );
    } catch {
      return notFound('الطلب غير موجود');
    }

    if (order.user_id !== sessionUserId) {
      return forbidden('ليس لديك صلاحية لحذف هذا الطلب');
    }
    await deleteOrder(validatedOrderId);
    return success(null);
  } catch {
    return serverError('حدث خطأ أثناء حذف الطلب');
  }
})
