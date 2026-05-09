export const runtime = 'nodejs'
import { NextRequest } from 'next/server'
import { getSupabaseAdmin, createNotification, createAdminNotification, handleResponse, handleCount, TABLES, paginate } from '@/lib/supabase-db'
import { checkRateLimit, getClientIp, LIMITS } from '@/server/lib/rate-limiter'
import { rateLimited, serverError, forbidden, success, created, badRequest } from '@/lib/api-response'
import { requireAuth } from '@/server/lib/auth-guard'
import { requireAdmin } from '@/server/lib/admin-auth'
import { withRoute } from '@/server/lib/route-wrapper'

// GET /api/notifications
export const GET = withRoute(async (request: NextRequest) => {
  try {
    const auth = await requireAuth(request)
    if (!auth.success) return auth.response
    const sessionUserId = auth.userId

    const { searchParams } = new URL(request.url)
    const scope = searchParams.get('scope')
    const pageParam = searchParams.get('page')
    const pageSizeParam = searchParams.get('pageSize')
    const page = Math.max(pageParam ? parseInt(pageParam, 10) || 1 : 1, 1)
    const pageSize = Math.min(Math.max(pageSizeParam ? parseInt(pageSizeParam, 10) || 20 : 20, 1), 100)

    const sb = getSupabaseAdmin()

    if (scope === 'admin') {
      const adminCheck = await requireAdmin(request);
      if (!adminCheck.success) return adminCheck.response;

      // Supabase path for admin notifications
      const { from, to } = paginate(page, pageSize);
      const [adminNotifsResult, adminCountResult] = await Promise.all([
        sb.from(TABLES.ADMIN_NOTIFICATIONS)
          .select('*')
          .order('created_at', { ascending: false })
          .range(from, to),
        sb.from(TABLES.ADMIN_NOTIFICATIONS)
          .select('*', { count: 'exact', head: true }),
      ]);

      if (adminNotifsResult.error) {
        return serverError('حدث خطأ')
      }

      const adminTotal = adminCountResult.count ?? 0;
      return success({ notifications: adminNotifsResult.data || [], total: adminTotal, page, pageSize });
    }

    // Default: user notifications (Supabase path)
    const { from, to } = paginate(page, pageSize);
    const [notificationsResult, countResult] = await Promise.all([
      sb.from(TABLES.NOTIFICATIONS)
        .select('*')
        .eq('user_id', sessionUserId)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
        .range(from, to),
      sb.from(TABLES.NOTIFICATIONS)
        .select('*', { count: 'exact', head: true })
        .eq('user_id', sessionUserId)
        .eq('is_deleted', false),
    ]);

    if (notificationsResult.error) {
      return serverError('حدث خطأ')
    }

    const total = countResult.count ?? 0;
    return success({ notifications: notificationsResult.data || [], total, page, pageSize });
  } catch {
    return serverError('حدث خطأ')
  }
})

// POST /api/notifications
export const POST = withRoute(async (request: NextRequest) => {
  try {
    const auth = await requireAuth(request)
    if (!auth.success) return auth.response
    const sessionUserId = auth.userId

    const ip = getClientIp(request);
    const rl = checkRateLimit(`notifications:${ip}`, LIMITS.notifications);
    if (!rl.success) return rateLimited();

    const body = await request.json()
    const { scope, title } = body

    if (scope === 'admin') {
      const adminCheck = await requireAdmin(request);
      if (!adminCheck.success) return adminCheck.response;

      const {
        title: notifTitle,
        body: notifBody,
        type,
        priority,
        target,
        targetId,
        userName,
        totalRecipients,
      } = body

      if (!notifTitle) {
        return badRequest('title مطلوب')
      }

      // Supabase path for admin notification creation
      const notification = await createAdminNotification({
        title: notifTitle,
        body: notifBody || '',
        type: type || 'announcement',
        priority: priority || 'medium',
        target: target || 'all',
        target_id: targetId || '',
        user_name: userName || '',
        total_recipients: totalRecipients || 0,
      });
      return created({ notification });
    }

    // Default: user notification creation
    if (!title) {
      return badRequest('title مطلوب')
    }

    const {
      user_id: targetUserId,
      is_read, body: notifBody, type: notifType, category, icon,
      priority: notifPriority, deep_link,
    } = body

    // Target user: use body's user_id if provided (server-generated notifications
    // from comments/follow/etc.), otherwise fall back to session user
    const effectiveUserId = targetUserId || sessionUserId;

    // Security: only allow notifications to OTHER users for specific server-generated categories
    const isServerGenerated = !!targetUserId && targetUserId !== sessionUserId;
    if (isServerGenerated) {
      const allowedCategories = ['new_comment', 'follow_store', 'new_product', 'new_offer', 'new_contest', 'chat_message', 'product_like', 'store_like'];
      if (!allowedCategories.includes(category || '')) {
        return forbidden('فئة الإشعار غير مسموحة');
      }
    }

    // ── Dedup: expiry notifications — only ONE per item per category ──
    const isExpiryCategory = category === 'expiry_warning' || category === 'expiry_urgent' || category === 'expiry';
    if (isExpiryCategory && body.data?.contentId) {
      const sb = getSupabaseAdmin();
      const contentId = String(body.data.contentId);
      const { data: existing } = await sb.from(TABLES.NOTIFICATIONS)
        .select('id, data')
        .eq('user_id', effectiveUserId)
        .eq('category', category)
        .eq('is_deleted', false);

      // Check if any existing notification for this category has the same contentId in its data
      const alreadyExists = (existing || []).some((n: Record<string, unknown>) => {
        try {
          const nd = n.data as Record<string, unknown> | undefined;
          return nd?.contentId === contentId;
        } catch { return false; }
      });

      if (alreadyExists) {
        // Already sent this exact expiry notification — skip duplicate
        return created({ notification: { id: 'dedup-skipped', deduplicated: true }, skipped: true });
      }
    }

    // Supabase path
    const notification = await createNotification({
      user_id: effectiveUserId,
      title,
      body: notifBody || '',
      type: notifType || 'info',
      category: category || undefined,
      icon: icon || undefined,
      priority: notifPriority || 'medium',
      deep_link: deep_link || undefined,
    });

    // Apply is_read if explicitly set
    if (is_read !== undefined && is_read !== false) {
      const sb = getSupabaseAdmin();
      await sb.from(TABLES.NOTIFICATIONS).update({ is_read: !!is_read }).eq('id', notification.id);
      notification.is_read = !!is_read;
    }

    return created({ notification });
  } catch {
    return serverError('حدث خطأ')
  }
})

// PUT /api/notifications
export const PUT = withRoute(async (request: NextRequest) => {
  try {
    const auth = await requireAuth(request)
    if (!auth.success) return auth.response
    const sessionUserId = auth.userId

    const body = await request.json()
    const { action, user_id: batchUserId, id, is_read, title, body: notifBody, category, icon, priority, deep_link } = body

    const sb = getSupabaseAdmin()

    if (action === 'mark_all_read') {
      const targetUserId = batchUserId || sessionUserId
      if (targetUserId !== sessionUserId) {
        return forbidden('ليس لديك صلاحية لتعديل إشعارات مستخدم آخر')
      }

      await sb.from(TABLES.NOTIFICATIONS)
        .update({ is_read: true })
        .eq('user_id', targetUserId)
        .eq('is_read', false)
        .eq('is_deleted', false);
      return success({ updated: true })
    }

    if (action === 'dismiss') {
      const notificationId = body.notificationId || id
      if (!notificationId) return badRequest('notificationId مطلوب')

      const { data: existingNotif } = await sb.from(TABLES.NOTIFICATIONS)
        .select('user_id')
        .eq('id', notificationId)
        .single();
      if (existingNotif && existingNotif.user_id !== sessionUserId) {
        return forbidden('ليس لديك صلاحية لهذا الإشعار')
      }
      await sb.from(TABLES.NOTIFICATIONS)
        .update({ is_deleted: true })
        .eq('id', notificationId);
      return success({ dismissed: true })
    }

    if (!id) return badRequest('id مطلوب')

    // Supabase path
    const { data: existingNotif } = await sb.from(TABLES.NOTIFICATIONS)
      .select('user_id')
      .eq('id', id)
      .single();
    if (existingNotif && existingNotif.user_id !== sessionUserId) {
      return forbidden('ليس لديك صلاحية لتعديل هذا الإشعار')
    }

    const updates: Record<string, unknown> = {}
    if (is_read !== undefined) updates.is_read = is_read
    if (title !== undefined) updates.title = title
    if (notifBody !== undefined) updates.body = notifBody
    if (category !== undefined) updates.category = category
    if (icon !== undefined) updates.icon = icon
    if (priority !== undefined) updates.priority = priority
    if (deep_link !== undefined) updates.deep_link = deep_link

    const { data: notification, error: updateError } = await sb.from(TABLES.NOTIFICATIONS)
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      return serverError('حدث خطأ')
    }
    return success({ notification });
  } catch {
    return serverError('حدث خطأ')
  }
})

// DELETE /api/notifications?id=xxx  → Soft-delete (set is_deleted=true)
export const DELETE = withRoute(async (request: NextRequest) => {
  try {
    const auth = await requireAuth(request)
    if (!auth.success) return auth.response
    const sessionUserId = auth.userId

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const userIdParam = searchParams.get('user_id')

    const sb = getSupabaseAdmin()

    // Bulk soft-delete: clear all notifications for user
    if (!id && userIdParam) {
      if (userIdParam !== sessionUserId) {
        return forbidden('ليس لديك صلاحية لحذف إشعارات مستخدم آخر')
      }

      await sb.from(TABLES.NOTIFICATIONS)
        .update({ is_deleted: true })
        .eq('user_id', userIdParam)
        .eq('is_deleted', false);
      return success({ cleared: true })
    }

    if (!id) return badRequest('id مطلوب')

    // Supabase path — soft delete
    const { data: existingNotif } = await sb.from(TABLES.NOTIFICATIONS)
      .select('user_id')
      .eq('id', id)
      .single();
    if (existingNotif && existingNotif.user_id !== sessionUserId) {
      return forbidden('ليس لديك صلاحية لحذف هذا الإشعار')
    }
    await sb.from(TABLES.NOTIFICATIONS)
      .update({ is_deleted: true })
      .eq('id', id);
    return success({ dismissed: true })
  } catch {
    return serverError('حدث خطأ')
  }
})
